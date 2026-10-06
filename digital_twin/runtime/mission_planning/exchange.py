"""Serialized source ICD-03 module state; no twin clock or transport owner."""
from copy import deepcopy
import json
from threading import RLock

from .stand_in import OrchestrationStandIn


class MissionPlanningExchange:
    implementation = OrchestrationStandIn.implementation
    version = OrchestrationStandIn.version

    def __init__(self, *, max_missions: int = 60) -> None:
        if type(max_missions) is not int or not 1 <= max_missions <= 60:
            raise ValueError("max_missions must be between 1 and 60")
        self._lock = RLock()
        self._module = OrchestrationStandIn()
        self._max_missions = max_missions

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
            return reply

    def plan(self, request: dict) -> dict:
        return self._apply("plan", request)

    def commit(self, message: dict) -> dict:
        return self._apply("commit", message)

    def status(self) -> dict:
        with self._lock:
            return self._copy(self._module.status())
