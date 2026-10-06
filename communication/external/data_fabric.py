"""HTTP forwarder to a data fabric module running in another process (ICD-02 over HTTP).

The remote side must expose the same three endpoints this application serves under
/api/data-fabric. Failures are reported as DataFabricUnavailable so the caller can show the module
as disconnected instead of pretending it answered.
"""
from __future__ import annotations

import httpx

from foundation.data_fabric_errors import DataFabricUnavailable, DataFabricConflict


class RemoteDataFabric:
    implementation = "remote"

    def __init__(self, base_url: str, *, timeout_s: float = 2.5, client: httpx.Client | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = client or httpx.Client(base_url=self.base_url, timeout=timeout_s)

    def _call(self, method: str, path: str, **kwargs) -> dict:
        try:
            response = self._client.request(method, path, **kwargs)
        except httpx.HTTPError as error:
            raise DataFabricUnavailable(f"데이터 패브릭 {self.base_url} 응답 없음: {error.__class__.__name__}") from error
        if response.status_code >= 500:
            raise DataFabricUnavailable(f"데이터 패브릭 {self.base_url} 오류 응답 {response.status_code}")
        if response.status_code >= 400:
            detail = ""
            try:
                body = response.json()
                detail = str(body.get("detail") or "") if isinstance(body, dict) else ""
            except ValueError:
                pass
            if response.status_code == 409:
                raise DataFabricConflict(detail or "외부 통신망이 변경됐습니다.")
            raise ValueError(detail or f"데이터 패브릭 요청 거부 ({response.status_code})")
        if not 200 <= response.status_code < 300:
            raise DataFabricUnavailable(f"데이터 패브릭 오류 응답 {response.status_code}")
        try:
            result = response.json()
        except ValueError as error:
            raise DataFabricUnavailable("데이터 패브릭이 JSON 응답을 반환하지 않았습니다.") from error
        if not isinstance(result, dict):
            raise DataFabricUnavailable("데이터 패브릭 응답은 객체여야 합니다.")
        return result

    def update(self, snapshot: dict) -> dict:
        return self._call("POST", "/api/data-fabric/network", json=snapshot)

    def route(self, source: str, target: str, objective: str = "balanced") -> dict:
        return self._call("POST", "/api/data-fabric/route", json={"source": source, "target": target, "objective": objective})

    def status(self) -> dict:
        remote = self._call("GET", "/api/data-fabric/status")
        return {**remote, "placement": "remote", "endpoint": self.base_url, "reachable": remote.get("reachable") is not False}

    def _guard_status(self):
        status = self.status()
        if status.get("exchange_contract") != "guarded-v1" or status.get("reachable") is not True:
            raise DataFabricUnavailable("외부 통신 모듈이 guarded-v1을 지원하지 않습니다.")

    def guarded_update(self, snapshot, request_id, expected_sequence, instance_id):
        self._guard_status()
        result = self._call("POST", "/api/data-fabric/network", json=snapshot,
                            headers={"X-ISDC-Fabric-Instance":instance_id,
                                     "X-ISDC-Fabric-Sequence":str(expected_sequence),
                                     "X-ISDC-Fabric-Request-Id":request_id})
        if (result.get("exchange_contract") != "guarded-v1" or result.get("instance_id") != instance_id
                or result.get("request_id") != request_id or type(result.get("sequence")) is not int
                or result["sequence"] != expected_sequence + 1):
            raise DataFabricUnavailable("외부 통신 교환 수락 응답이 요청과 일치하지 않습니다.")
        return result

    def guarded_route(self, source, target, objective, expected_sequence, instance_id):
        self._guard_status()
        result = self._call("POST", "/api/data-fabric/route",
                            json={"source":source, "target":target, "objective":objective},
                            headers={"X-ISDC-Fabric-Instance":instance_id,
                                     "X-ISDC-Fabric-Sequence":str(expected_sequence)})
        if (result.get("exchange_contract") != "guarded-v1" or result.get("instance_id") != instance_id
                or type(result.get("sequence")) is not int or result["sequence"] != expected_sequence):
            raise DataFabricUnavailable("외부 통신 경로 응답의 sequence가 일치하지 않습니다.")
        return result

    def close(self) -> None:
        self._client.close()
