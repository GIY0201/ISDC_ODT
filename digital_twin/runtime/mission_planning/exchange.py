"""Serialized source ICD-03 module state; no twin clock or transport owner."""
from copy import deepcopy
from hashlib import sha256
import json
import re
from uuid import uuid4

from foundation.mission_planning_errors import MissionPlanningConflict
from digital_twin.simulation.mission_planning.scheduler import parse_time
from threading import RLock

from .stand_in import OrchestrationStandIn


def _same_json(left, right):
    """Compare JSON values across browser/Python numeric serialization.

    JSON has one number kind: 4 and 4.0 carry the same value. Booleans,
    missing keys, array order and every nonnumeric field remain distinct.
    """
    if type(left) in (int, float) and type(right) in (int, float):
        return left == right
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(_same_json(left[k], right[k]) for k in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(_same_json(a, b) for a, b in zip(left, right))
    return left == right


class MissionPlanningExchange:
    implementation = OrchestrationStandIn.implementation
    version = OrchestrationStandIn.version
    exchange_contract = "guarded-v1"

    def __init__(self, *, max_missions: int = 60) -> None:
        if type(max_missions) is not int or not 1 <= max_missions <= 60:
            raise ValueError("max_missions must be between 1 and 60")
        self._lock = RLock()
        self._module = OrchestrationStandIn()
        self._max_missions = max_missions
        self._instance_id = uuid4().hex
        self._clients = {}
        self._receipt = None
        self._plans = {}
        self._decisions = {}

    @staticmethod
    def _copy(value):
        result = deepcopy(value)
        json.dumps(result, allow_nan=False)
        return result

    def _apply(self, operation, message):
        request = self._copy(message)
        with self._lock:
            candidate = deepcopy(self._module)
            result = getattr(candidate, operation)(request)
            reply = self._copy(result)
            state = self._copy(candidate.status())
            if len(set(state["missions"]) | set(state["committed"])) > self._max_missions:
                raise ValueError("mission module capacity reached; accepted records retained")
            self._module = candidate
            self._plans.pop(request.get("mission_id") or request.get("mission", {}).get("id"), None)
            self._decisions.pop(request.get("mission_id") or request.get("mission", {}).get("id"), None)
            self._receipt = None
            return reply

    def plan(self, request: dict) -> dict:
        return self._apply("plan", request)

    def commit(self, message: dict) -> dict:
        return self._apply("commit", message)

    def status(self) -> dict:
        with self._lock:
            return {**self._copy(self._module.status()), "instance_id": self._instance_id,
                    "exchange_contract": self.exchange_contract,
                    "accepted_plans": self._copy(self._plans),
                    "accepted_decisions": self._copy(self._decisions)}


    def _guarded(self, operation, message, request_id, sequence, instance_id,
                 context_hash, version_or_plan):
        request = self._copy(message)
        if not isinstance(request, dict):
            raise ValueError("command must be an object")
        match = re.fullmatch(r"([A-Za-z0-9_-]{1,80}):([1-9][0-9]{0,15})", request_id) if isinstance(request_id, str) else None
        if not match or int(match[2]) > 9007199254740991:
            raise ValueError("request_id must be client:positive_counter")
        if type(sequence) is not int or not 0 <= sequence <= 9007199254740991:
            raise ValueError("invalid base sequence")
        if type(version_or_plan) is not int or not 1 <= version_or_plan <= 9007199254740991:
            raise ValueError("invalid mission version or plan sequence")
        if not isinstance(context_hash, str) or not re.fullmatch(r"[a-f0-9]{64}", context_hash):
            raise ValueError("verified context hash required")
        encoded = json.dumps([operation, request, sequence, instance_id, context_hash, version_or_plan],
                             sort_keys=True, allow_nan=False, separators=(",", ":"))
        fingerprint = sha256(encoded.encode()).hexdigest()
        client, counter = match[1], int(match[2])
        with self._lock:
            if instance_id != self._instance_id:
                raise MissionPlanningConflict("module instance changed")
            previous = self._clients.get(client)
            current = self._module.status()["sequence"]
            if previous and counter <= previous[0]:
                if (counter, fingerprint, current) != previous or self._receipt is None:
                    raise MissionPlanningConflict("request reused or superseded")
                return self._copy(self._receipt)
            if sequence != current:
                raise MissionPlanningConflict("module sequence changed")
            if previous is None and len(self._clients) >= 64:
                raise MissionPlanningConflict("exchange client capacity reached")
            mission_id = request.get("mission", {}).get("id") if operation == "plan" else request.get("mission_id")
            if not isinstance(mission_id, str) or not mission_id.strip() or mission_id != mission_id.strip() or len(mission_id) > 80:
                raise ValueError("valid mission ID required")
            accepted = self._plans.get(mission_id)
            if operation == "plan":
                if mission_id in self._module.status()["committed"]:
                    raise MissionPlanningConflict("abort held mission before replanning")
            else:
                if not accepted or accepted["plan_sequence"] != version_or_plan:
                    raise MissionPlanningConflict("accepted plan changed or missing")
                if context_hash != accepted["context_hash"] or request.get("version") != accepted["mission_version"] or type(request.get("version")) is not int:
                    raise MissionPlanningConflict("plan version/context changed")
                if request.get("time") != accepted["time"]:
                    raise MissionPlanningConflict("plan UTC changed")
                if request.get("decision") == "commit":
                    if mission_id in self._module.status()["committed"]:
                        raise MissionPlanningConflict("mission already held; retry original command")
                    if not accepted["feasible"] or not _same_json(request.get("tasks"), accepted["tasks"]):
                        raise MissionPlanningConflict("infeasible or changed plan tasks")
                    self._check_overlaps(mission_id, request["tasks"])
                elif request.get("decision") == "abort":
                    if request.get("tasks") not in ([], accepted["tasks"]):
                        raise MissionPlanningConflict("changed abort tasks")
            reply = self._apply(operation, request)
            receipt = {**reply, "instance_id": self._instance_id, "request_id": request_id,
                       "exchange_contract": self.exchange_contract, "context_hash": context_hash}
            if operation == "plan":
                receipt.update(mission_version=version_or_plan, plan_sequence=reply["sequence"])
                self._plans[mission_id] = self._copy(receipt)
            else:
                receipt.update(mission_version=accepted["mission_version"], plan_sequence=version_or_plan)
                self._decisions[mission_id] = self._copy(receipt)
                if request["decision"] == "commit":
                    self._plans[mission_id] = accepted
            self._clients[client] = (counter, fingerprint, reply["sequence"])
            self._receipt = self._copy(receipt)
            return self._copy(receipt)

    def _check_overlaps(self, mission_id, tasks):
        for other_id, held in self._module._committed.items():
            if other_id == mission_id:
                continue
            for task in tasks:
                for interval in held["tasks"]:
                    if task["satellite"] == interval["satellite"] and max(parse_time(task["start"]), parse_time(interval["start"])) < min(parse_time(task["end"]), parse_time(interval["end"])):
                        raise MissionPlanningConflict("held satellite intervals overlap")

    def guarded_plan(self, request, request_id, expected_sequence, instance_id, context_hash, mission_version):
        return self._guarded("plan", request, request_id, expected_sequence, instance_id, context_hash, mission_version)

    def guarded_commit(self, message, request_id, expected_sequence, instance_id, plan_sequence, context_hash):
        return self._guarded("commit", message, request_id, expected_sequence, instance_id, context_hash, plan_sequence)
