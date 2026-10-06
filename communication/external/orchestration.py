"""HTTP forwarder to a constellation operations module running in another process (ICD-03 over HTTP).

The remote side must expose the same endpoints this application serves under /api/orchestration.
Failures are reported as OrchestrationUnavailable so the console shows the module as disconnected
instead of pretending it answered.
"""
from __future__ import annotations

import httpx
import json
from copy import deepcopy

from foundation.mission_planning_errors import MissionPlanningConflict

from foundation.mission_planning_errors import MissionPlanningUnavailable as OrchestrationUnavailable


class RemoteOrchestration:
    implementation = "remote"

    def __init__(self, base_url: str, *, timeout_s: float = 4.0, client: httpx.Client | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = client or httpx.Client(base_url=self.base_url, timeout=timeout_s)

    def _call(self, method: str, path: str, **kwargs) -> dict:
        try:
            response = self._client.request(method, path, **kwargs)
        except httpx.HTTPError as error:
            raise OrchestrationUnavailable(f"군집 운용 모듈 {self.base_url} 응답 없음: {error.__class__.__name__}") from error
        if response.status_code >= 500:
            raise OrchestrationUnavailable(f"군집 운용 모듈 {self.base_url} 오류 응답 {response.status_code}")
        if response.status_code >= 400:
            detail = ""
            try:
                body = response.json()
                detail = str(body.get("detail") or "") if isinstance(body, dict) else ""
            except ValueError:
                pass
            if response.status_code == 409:
                raise MissionPlanningConflict(detail or "외부 계획이 변경됐습니다.")
            raise ValueError(detail or f"군집 운용 요청 거부 ({response.status_code})")
        if not 200 <= response.status_code < 300:
            raise OrchestrationUnavailable("군집 운용 모듈의 비정상 응답입니다.")
        try:
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError("object required")
            json.dumps(result, allow_nan=False)
        except (ValueError, TypeError) as error:
            raise OrchestrationUnavailable("군집 운용 모듈의 유효한 JSON 객체 응답이 필요합니다.") from error
        return result

    def plan(self, request: dict) -> dict:
        return self._call("POST", "/api/orchestration/plan", json=request)

    def commit(self, message: dict) -> dict:
        return self._call("POST", "/api/orchestration/commit", json=message)

    def status(self) -> dict:
        remote = self._call("GET", "/api/orchestration/status")
        return {**remote, "placement": "remote", "endpoint": self.base_url, "reachable": remote.get("reachable") is not False}

    def close(self) -> None:
        self._client.close()


    def _guarded(self, operation, body, request_id, sequence, instance, context, number):
        command = deepcopy(body)
        json.dumps(command, allow_nan=False)
        status = self.status()
        if status.get("exchange_contract") != "guarded-v1" or status.get("reachable") is not True:
            raise OrchestrationUnavailable("외부 군집 운용 모듈이 guarded-v1을 지원하지 않습니다.")
        extra = "Mission-Version" if operation == "plan" else "Plan-Sequence"
        headers = {"X-ISDC-Orchestration-"+key:value for key,value in {
            "Instance":instance,"Sequence":str(sequence),"Request-Id":request_id,
            "Context":context,extra:str(number)}.items()}
        reply = self._call("POST", "/api/orchestration/"+operation, json=command, headers=headers)
        mission = command.get("mission", {}).get("id") if operation == "plan" else command.get("mission_id")
        if (reply.get("exchange_contract") != "guarded-v1" or reply.get("instance_id") != instance
                or reply.get("request_id") != request_id or reply.get("context_hash") != context
                or type(reply.get("sequence")) is not int or reply["sequence"] != sequence+1
                or reply.get("mission_id") != mission):
            raise OrchestrationUnavailable("외부 군집 운용 수락 응답이 요청과 일치하지 않습니다.")
        if operation == "plan":
            if (type(reply.get("mission_version")) is not int or reply["mission_version"] != number
                    or type(reply.get("plan_sequence")) is not int or reply["plan_sequence"] != reply["sequence"]
                    or type(reply.get("feasible")) is not bool or not isinstance(reply.get("tasks"), list)
                    or reply.get("time") != command.get("time")):
                raise OrchestrationUnavailable("외부 계획 버전 응답이 일치하지 않습니다.")
        elif (type(reply.get("plan_sequence")) is not int or reply["plan_sequence"] != number
              or type(reply.get("mission_version")) is not int or reply["mission_version"] != command.get("version")
              or type(reply.get("held_tasks")) is not int
              or reply["held_tasks"] != (len(command.get("tasks", [])) if command.get("decision") == "commit" else 0)
              or reply.get("decision") != command.get("decision") or reply.get("accepted") is not True):
            raise OrchestrationUnavailable("외부 확정 응답이 일치하지 않습니다.")
        return reply

    def guarded_plan(self, request, request_id, expected_sequence, instance_id, context_hash, mission_version):
        return self._guarded("plan", request, request_id, expected_sequence, instance_id, context_hash, mission_version)

    def guarded_commit(self, message, request_id, expected_sequence, instance_id, plan_sequence, context_hash):
        return self._guarded("commit", message, request_id, expected_sequence, instance_id, context_hash, plan_sequence)
