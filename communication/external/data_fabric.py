"""HTTP forwarder to a data fabric module running in another process (ICD-02 over HTTP).

The remote side must expose the same three endpoints this application serves under
/api/data-fabric. Failures are reported as DataFabricUnavailable so the caller can show the module
as disconnected instead of pretending it answered.
"""
from __future__ import annotations

import httpx

from foundation.data_fabric_errors import DataFabricUnavailable


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
        return {**remote, "placement": "remote", "endpoint": self.base_url, "reachable": True}

    def close(self) -> None:
        self._client.close()
