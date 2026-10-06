"""Serialized ICD-02 module memory, separate from the twin runtime and clock."""
from copy import deepcopy
import json
from threading import RLock

from .stand_in import DataFabricStandIn


class DataFabricExchange:
    implementation = DataFabricStandIn.implementation
    version = DataFabricStandIn.version

    def __init__(self) -> None:
        self._lock = RLock()
        self._module = DataFabricStandIn()

    def update(self, snapshot: dict) -> dict:
        request = deepcopy(snapshot)
        # Non-finite values cannot cross the JSON ICD boundary as valid metrics.
        json.dumps(request, allow_nan=False)
        with self._lock:
            candidate = deepcopy(self._module)
            report = candidate.update(request)
            json.dumps(report, allow_nan=False)
            self._module = candidate
            return report

    def route(self, source: str, target: str, objective: str = "balanced") -> dict:
        with self._lock:
            return deepcopy(self._module.route(source, target, objective))

    def status(self) -> dict:
        with self._lock:
            return deepcopy(self._module.status())
