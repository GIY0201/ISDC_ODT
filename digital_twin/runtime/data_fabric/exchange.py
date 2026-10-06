"""Serialized ICD-02 module memory, separate from the twin runtime and clock."""
from copy import deepcopy
from hashlib import sha256
import json
import re
from threading import RLock
from uuid import uuid4

from foundation.data_fabric_errors import DataFabricConflict
from .stand_in import DataFabricStandIn


class DataFabricExchange:
    implementation = DataFabricStandIn.implementation
    version = DataFabricStandIn.version
    exchange_contract = "guarded-v1"

    def __init__(self, *, max_clients: int = 64) -> None:
        if type(max_clients) is not int or not 1 <= max_clients <= 64:
            raise ValueError("max_clients must be between 1 and 64")
        self._lock = RLock()
        self._module = DataFabricStandIn()
        self._instance_id = uuid4().hex
        self._clients: dict[str, tuple[int, str, int]] = {}
        self._max_clients = max_clients
        self._receipt = None
        self._network_hash = None

    @staticmethod
    def _request(snapshot):
        request = deepcopy(snapshot)
        encoded = json.dumps(request, allow_nan=False, sort_keys=True, separators=(",", ":"))
        return request, sha256(encoded.encode()).hexdigest()

    def _apply(self, request, fingerprint):
        candidate = deepcopy(self._module)
        report = candidate.update(request)
        json.dumps(report, allow_nan=False)
        self._module = candidate
        self._network_hash = fingerprint
        self._receipt = None
        return report

    def update(self, snapshot: dict) -> dict:
        request, fingerprint = self._request(snapshot)
        with self._lock:
            return self._apply(request, fingerprint)

    def _check(self, sequence, instance_id):
        if type(sequence) is not int or not 0 <= sequence <= 9007199254740991:
            raise ValueError("유효한 통신망 sequence가 필요합니다.")
        if instance_id != self._instance_id:
            raise DataFabricConflict("통신 모듈 실행이 변경됐습니다. 상태를 다시 확인하세요.")
        if sequence != self._module.status()["sequence"]:
            raise DataFabricConflict("다른 통신망이 수락됐습니다. 상태를 확인하고 다시 요청하세요.")

    def guarded_update(self, snapshot, request_id, expected_sequence, instance_id):
        match = re.fullmatch(r"([A-Za-z0-9_-]{1,80}):([1-9][0-9]{0,15})", request_id) if isinstance(request_id, str) else None
        if not match or int(match[2]) > 9007199254740991:
            raise ValueError("요청 ID는 client_id:양의 정수 형식이어야 합니다.")
        if type(expected_sequence) is not int or not 0 <= expected_sequence <= 9007199254740991:
            raise ValueError("유효한 통신망 sequence가 필요합니다.")
        client, counter = match[1], int(match[2])
        request, fingerprint = self._request(snapshot)
        with self._lock:
            if instance_id != self._instance_id:
                raise DataFabricConflict("통신 모듈 실행이 변경됐습니다. 상태를 다시 확인하세요.")
            previous = self._clients.get(client)
            if previous and counter <= previous[0]:
                if counter != previous[0] or fingerprint != previous[1]:
                    raise DataFabricConflict("이미 사용한 요청 ID 또는 변경된 요청입니다.")
                if previous[2] != self._module.status()["sequence"] or self._receipt is None:
                    raise DataFabricConflict("이 요청은 수락됐지만 다른 통신망으로 바뀌었습니다.")
                return deepcopy(self._receipt)
            self._check(expected_sequence, instance_id)
            if previous is None and len(self._clients) >= self._max_clients:
                raise DataFabricConflict("통신 교환 창 수 한도에 도달했습니다.")
            report = self._apply(request, fingerprint)
            receipt = {**report, "exchange_contract": self.exchange_contract,
                       "instance_id": self._instance_id, "request_id": request_id,
                       "network_hash": fingerprint}
            self._clients[client] = (counter, fingerprint, report["sequence"])
            self._receipt = deepcopy(receipt)
            return receipt

    def route(self, source: str, target: str, objective: str = "balanced") -> dict:
        with self._lock:
            return deepcopy(self._module.route(source, target, objective))

    def guarded_route(self, source, target, objective, expected_sequence, instance_id):
        with self._lock:
            self._check(expected_sequence, instance_id)
            return {**deepcopy(self._module.route(source, target, objective)),
                    "exchange_contract": self.exchange_contract, "instance_id": self._instance_id,
                    "network_hash": self._network_hash}

    def status(self) -> dict:
        with self._lock:
            return {**deepcopy(self._module.status()), "exchange_contract": self.exchange_contract,
                    "instance_id": self._instance_id, "network_hash": self._network_hash}
