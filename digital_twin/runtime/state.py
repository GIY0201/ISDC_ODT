from __future__ import annotations

import asyncio
import uuid
from collections import deque, OrderedDict
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from .missions import MissionRuntime
from digital_twin.simulation.telemetry import calculate_telemetry
from digital_twin.simulation.mock_hil import apply_device_action, preflight
from digital_twin.contracts.state import RuntimeSnapshot
from digital_twin.contracts.data_management import DataDeploymentConflict, DataManagementUnavailable
from digital_twin.simulation.data_deployment import deployment_inputs, deployment_products


class RuntimeState:
    """Thread-safe-enough asyncio state for a single-process simulation console."""

    def __init__(self, *, missions: list[dict], devices: list[dict], scenarios: list[dict], orbit=None) -> None:
        self.orbit = orbit
        self._lock = asyncio.Lock()
        self.random_seed = 2042
        self.running = True
        self.speed = 1.0
        self.elapsed_seconds = 124.5
        self.scenario_id = "LEO_STANDARD"
        self.started_at = datetime.now(timezone.utc)
        self.run_id = f"RUN-{uuid.uuid4().hex[:12].upper()}"
        self.mode = "SIM"
        self.scenario_version = "1.0"
        self.recording = True
        self.data_quality = "GOOD"
        self.sequence = 0
        self.faults: list[dict[str, Any]] = []
        self._missions = MissionRuntime(missions, self._lock, self._emit)
        self.scenarios = deepcopy(scenarios)
        self.devices = deepcopy(devices)
        self.events: deque[dict[str, Any]] = deque(maxlen=200)
        self._task: asyncio.Task[None] | None = None
        self._stop = asyncio.Event()
        self._last_snapshot_second = -1
        self.current_telemetry: dict[str, Any] = {}
        self._data_deployment = {"deployment_id": None, "revision": 0, "nodes": []}
        self._mission_context = None
        self._mission_context_proofs = OrderedDict()
        self._deployment_ids: set[str] = set()
        self._data_scope_started_s = self.elapsed_seconds
        self._refresh_telemetry()
        self._emit("runtime.started", "info", "시뮬레이션 런타임 시작")

    def resume_unconfigured_development(self, value: dict) -> None:
        """Before-start development transition only; reject active deployment/fault owners.

        Uses captured public SIM state. It does not restore hardware or accepted module work.
        Analysis elapsed time has the existing status API's millisecond precision.
        """
        import json, math, re
        candidate=deepcopy(value)
        if self._task is not None:raise ValueError('resume requires stopped development runtime')
        json.dumps(candidate,allow_nan=False)
        status=candidate['runtime'];deployment=candidate['deployment']
        revision=deployment.get('revision');identifier=deployment.get('deployment_id')
        scope='unconfigured' if identifier is None else 'deployment:'+str(identifier)
        if (type(revision) is not int or revision<0 or (revision==0)!=(identifier is None)
            or (identifier is not None and (not isinstance(identifier,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',identifier)))
            or status.get('mode')!='SIM' or status.get('active_faults')!=[] or deployment.get('nodes')!=[]
            or deployment.get('run_id')!=status.get('run_id') or deployment.get('scope_id')!=str(status.get('run_id'))+':'+scope):
            raise ValueError('only unconfigured SIM without active faults can resume')
        if not isinstance(status.get('run_id'),str) or not re.fullmatch(r'RUN-[A-F0-9]{12}',status['run_id']):raise ValueError('invalid captured run id')
        if status.get('scenario_id') not in {s['id'] for s in self.scenarios}:raise ValueError('captured scenario is not registered')
        for key in ('elapsed_seconds','speed'):
            n=status.get(key)
            if type(n) not in (float,int) or not math.isfinite(n) or n<0 or (key=='speed' and n==0):raise ValueError('invalid captured simulation time/speed')
        for key in ('sequence','random_seed'):
            if type(status.get(key)) is not int or status[key]<0:raise ValueError('invalid captured simulation counter')
        if any(type(status.get(k)) is not bool for k in ('running','recording')):raise ValueError('invalid captured simulation flags')
        if status.get('scenario_version')!=self.scenario_version or status.get('data_quality') not in ('GOOD','DEGRADED','INVALID'):raise ValueError('invalid captured simulation version/quality')
        started=datetime.fromisoformat(status['started_at'])
        if started.tzinfo is None:raise ValueError('captured start time needs timezone')
        for key,original in [('missions',self.missions),('devices',self.devices)]:
            items=candidate.get(key)
            if not isinstance(items,list) or {i.get('id') for i in items}!={i['id'] for i in original} or len(items)!=len(original):raise ValueError('captured model roster changed')
        events=candidate.get('events')
        if not isinstance(events,list) or len(events)>200 or any(not isinstance(e,dict) or e.get('run_id')!=status['run_id'] for e in events):raise ValueError('invalid captured event log')
        # All validation precedes the single owner replacement; no synthetic startup event.
        for key in ('running','speed','elapsed_seconds','scenario_id','sequence','run_id','mode','scenario_version','random_seed','recording','data_quality'):setattr(self,key,status[key])
        self.started_at=started;self.faults=[];self._missions.items=candidate['missions'];self.devices=candidate['devices'];self.events=deque(events,maxlen=200)
        self._data_deployment={k:deepcopy(deployment[k]) for k in ('deployment_id','revision','nodes')}
        self._deployment_ids={identifier} if identifier is not None else set()
        self._data_scope_started_s=self.elapsed_seconds;self._clear_mission_context();self._refresh_telemetry()

    @property
    def missions(self) -> list[dict]:
        return self._missions.items

    def snapshot(self) -> RuntimeSnapshot:
        return RuntimeSnapshot(
            current_telemetry=deepcopy(self.current_telemetry),
            missions=deepcopy(self.missions), faults=deepcopy(self.faults),
            data_quality=self.data_quality, elapsed_seconds=self.elapsed_seconds,
            sequence=self.sequence, run_id=self.run_id, scenario_id=self.scenario_id,
            mode=self.mode, recording=self.recording,
        )

    def data_deployment(self) -> dict:
        deployment_id = self._data_deployment["deployment_id"]
        scope = f"deployment:{deployment_id}" if deployment_id is not None else "unconfigured"
        return {**deepcopy(self._data_deployment), "run_id": self.run_id,
                "scope_id": f"{self.run_id}:{scope}"}

    def _data_context(self, deployment: dict | None = None, start_s: float | None = None) -> dict:
        accepted = deployment or self.data_deployment()
        # Public display status is rounded to milliseconds. Delivery timestamps
        # must retain the owner's precision, including the deployment boundary.
        status = self.status()
        status["elapsed_seconds"] = self.elapsed_seconds
        return {"deployment": deepcopy(accepted), "runtime": status,
                "started_s": self._data_scope_started_s if start_s is None else start_s,
                "inputs": deployment_inputs(accepted, deepcopy(self.faults)), "products": deployment_products}

    async def apply_data_deployment(self, command: dict, activate) -> dict:
        command = deepcopy(command)
        async with self._lock:
            current = self.data_deployment()
            if command["deployment_id"] == current["deployment_id"] and command["nodes"] == current["nodes"]:
                return current
            if command["expected_revision"] != current["revision"] or command["deployment_id"] in self._deployment_ids:
                raise DataDeploymentConflict("서버 배치 버전이 달라졌습니다. 현재 배치를 다시 확인하세요.")
            candidate = {"deployment_id": command["deployment_id"], "revision": current["revision"] + 1,
                         "nodes": deepcopy(command["nodes"]), "run_id": self.run_id,
                         "scope_id": f"{self.run_id}:deployment:{command['deployment_id']}"}
            # Publish configuration only after the separately addressed module accepts its roster.
            context = self._data_context(candidate, self.elapsed_seconds)
            if not callable(activate):
                raise DataManagementUnavailable("데이터 관리 배치 수락 경로가 없습니다.")
            result = await activate(context)
            if not isinstance(result, tuple) or len(result) != 2:
                raise DataManagementUnavailable("데이터 관리 배치 수락 응답이 없습니다.")
            scoped, receipt = result
            expected_roster = deployment_inputs(candidate, deepcopy(self.faults))["nodes"]
            if (not isinstance(receipt, dict)
                    or getattr(scoped, "scope_id", None) != candidate["scope_id"]
                    or receipt.get("scope_id") != candidate["scope_id"]
                    or receipt.get("sim_elapsed_s") != self.elapsed_seconds
                    or type(receipt.get("nodes")) is not int
                    or receipt["nodes"] != len(expected_roster)
                    or receipt.get("node_roster") != expected_roster
                    or type(receipt.get("products")) is not int
                    or receipt["products"] != 0
                    or receipt.get("ingest") is not None):
                raise DataManagementUnavailable("데이터 관리 배치 수락 응답이 후보와 일치하지 않습니다.")
            self._data_deployment = {key: deepcopy(candidate[key]) for key in ("deployment_id", "revision", "nodes")}
            self._deployment_ids.add(candidate["deployment_id"])
            self._data_scope_started_s = self.elapsed_seconds
            self._clear_mission_context()
            return self.data_deployment()

    def _clear_mission_context(self) -> None:
        self._mission_context = None
        self._mission_context_proofs.clear()

    @staticmethod
    def _mission_physical_scope(value: dict) -> dict:
        # Module sequence/hash describe approval metadata, not different physical inputs.
        # Every other field, including full nodes/stations/external provenance and
        # module instance, must remain identical for past proof reuse.
        return {key: item for key, item in value.items() if key not in ("context_hash", "module_sequence")}

    def mission_context(self) -> dict | None:
        """Accepted static analysis inputs, not another running clock or position owner."""
        value = self._mission_context
        if value is None or value["deployment"] != self.data_deployment() or value["faults"] != self.status()["active_faults"]:
            self._clear_mission_context()
            return None
        return deepcopy(value)

    async def accept_mission_context(self, value: dict) -> dict:
        from foundation.mission_planning_errors import MissionPlanningConflict
        async with self._lock:
            if value["deployment"] != self.data_deployment() or value["faults"] != self.status()["active_faults"]:
                raise MissionPlanningConflict("mission deployment or faults changed during native verification")
            current = self.mission_context()
            if current is None or self._mission_physical_scope(current) != self._mission_physical_scope(value):
                self._mission_context_proofs.clear()
            accepted = deepcopy(value)
            # Bounded past immutable approval evidence owned by this same runtime.
            # FIFO eviction requires explicit reapproval of the evicted proof; never fallback.
            self._mission_context_proofs[accepted["context_hash"]] = deepcopy(accepted)
            while len(self._mission_context_proofs) > 64:
                self._mission_context_proofs.popitem(last=False)
            self._mission_context = accepted
            return deepcopy(accepted)

    async def with_mission_context(self, expected_hash: str, consume, *, abort=False):
        from foundation.mission_planning_errors import MissionPlanningConflict
        async with self._lock:
            accepted = self.mission_context()
            if not abort:
                proof = self._mission_context_proofs.get(expected_hash)
                if accepted is None or proof is None or self._mission_physical_scope(proof) != self._mission_physical_scope(accepted):
                    raise MissionPlanningConflict("accepted native mission context changed or missing")
                accepted = proof
            return await consume(deepcopy(accepted))

    async def with_data_deployment(self, consume):
        """Serialize accepted configuration, run reset and the complete ICD exchange."""
        async with self._lock:
            return await consume(self._data_context())

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._clock_loop(), name="simulation-clock")

    async def shutdown(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _clock_loop(self) -> None:
        last = asyncio.get_running_loop().time()
        while not self._stop.is_set():
            await asyncio.sleep(0.2)
            now = asyncio.get_running_loop().time()
            delta = now - last
            last = now
            async with self._lock:
                if self.running:
                    self.elapsed_seconds += delta * self.speed
                    self.sequence += 1
                self._expire_faults()
                if int(self.elapsed_seconds) != self._last_snapshot_second:
                    self._refresh_telemetry()

    def _emit(self, event_type: str, severity: str, message: str, payload: dict | None = None) -> None:
        self.events.appendleft(
            {
                "id": f"EVT-{uuid.uuid4().hex[:16].upper()}",
                "event_id": str(uuid.uuid4()),
                "run_id": self.run_id,
                "scenario_id": self.scenario_id,
                "schema_version": "1.0",
                "source": "runtime.core",
                "sequence": self.sequence,
                "type": event_type,
                "severity": severity,
                "message": message,
                "payload": deepcopy(payload or {}),
                "simulation_time": round(self.elapsed_seconds, 3),
                "wall_time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
        )

    def _expire_faults(self) -> None:
        active: list[dict[str, Any]] = []
        for fault in self.faults:
            if self.elapsed_seconds < fault["expires_at"]:
                active.append(fault)
            elif fault.get("active", True):
                fault["active"] = False
                self._emit("fault.cleared", "info", f"{fault['target']} 장애 해제", fault)
        if self.faults != active:self._clear_mission_context()
        self.faults = active

    async def control(self, action: str, speed: float | None = None) -> dict:
        async with self._lock:
            if speed is not None:
                self.speed = speed
            if action == "start":
                self.running = True
            elif action == "pause":
                self.running = False
            elif action == "reset":
                self.running = False
                self.elapsed_seconds = 0.0
                self._data_scope_started_s = 0.0
                self.faults.clear()
                self.run_id = f"RUN-{uuid.uuid4().hex[:12].upper()}"
                self.started_at = datetime.now(timezone.utc)
                self._clear_mission_context()
            elif action == "step":
                self.running = False
                self.elapsed_seconds += max(self.speed, 1.0)
            self._emit(f"runtime.{action}", "info", f"런타임 {action}", {"speed": self.speed})
            self._refresh_telemetry()
            return self.status()

    async def set_speed(self, speed: float) -> dict:
        async with self._lock:
            self.speed = speed
            self._emit("runtime.speed.changed", "info", f"배속 {speed:g}x", {"speed": speed})
            return self.status()

    async def select_scenario(self, scenario_id: str) -> dict:
        valid = {item["id"] for item in self.scenarios}
        if scenario_id not in valid:
            raise ValueError("알 수 없는 시나리오입니다.")
        async with self._lock:
            self.scenario_id = scenario_id
            self.elapsed_seconds = 0.0
            self._data_scope_started_s = 0.0
            self.faults.clear()
            self.run_id = f"RUN-{uuid.uuid4().hex[:12].upper()}"
            self.started_at = datetime.now(timezone.utc)
            self._clear_mission_context()
            self._emit("scenario.loaded", "info", f"{scenario_id} 시나리오 로드")
            return self.status()

    async def advance(self, seconds: float) -> dict:
        """Move the simulation clock forward (never backward): the scenario player's skip."""
        if not (0 < float(seconds) <= 3600):
            raise ValueError("시계 전진은 0초 초과 3600초 이하만 가능합니다.")
        async with self._lock:
            self.elapsed_seconds += float(seconds)
            self.sequence += 1
            self._expire_faults()
            self._refresh_telemetry()
            self._emit("runtime.advance", "info", f"시계 {float(seconds):g}초 전진", {"seconds": float(seconds)})
            return self.status()


    async def inject_fault(self, request: dict) -> dict:
        async with self._lock:
            fault = {
                "id": f"FLT-{self.sequence:06d}-{len(self.faults) + 1:02d}",
                **request,
                "active": True,
                "created_at": self.elapsed_seconds,
                "expires_at": self.elapsed_seconds + request["duration_seconds"],
            }
            self.faults.append(fault)
            self._clear_mission_context()
            self._emit("fault.injected", "warning", f"{fault['target']} · {fault['kind']}", fault)
            return deepcopy(fault)

    async def mission_action(self, mission_id: str, action: str) -> dict:
        return await self._missions.mission_action(mission_id, action)

    def validate_mission(self, mission_id: str) -> dict:
        return self._missions.validate_mission(mission_id)

    async def mutate_task(self, payload: dict[str, Any]) -> dict:
        return await self._missions.mutate_task(payload)

    async def replan_mission(self, mission_id: str, apply: bool = True) -> dict:
        return await self._missions.replan_mission(mission_id, apply)

    async def device_action(self, device_id: str, action: str) -> dict:
        async with self._lock:
            device = next((d for d in self.devices if d["id"] == device_id), None)
            if not device:
                raise ValueError("장비를 찾을 수 없습니다.")
            device.update(apply_device_action(deepcopy(device), action))
            self._emit(f"hil.{action}", "info", f"{device_id} · {action}", device)
            return deepcopy(device)

    def hil_preflight(self) -> dict:
        return preflight(deepcopy(self.devices), self.status())

    async def run_hil_sequence(self, sequence_id: str) -> dict:
        async with self._lock:
            preflight = self.hil_preflight()
            steps = [
                {"id": "S1", "name": "Preflight", "status": "passed" if preflight["passed"] else "failed"},
                {"id": "S2", "name": "Clock Sync", "status": "passed" if all((not d["connected"]) or d.get("clock_state") == "LOCKED" for d in self.devices) else "failed"},
                {"id": "S3", "name": "Channel Loopback", "status": "passed" if all((not d["connected"]) or d["health"] >= 80 for d in self.devices) else "failed"},
                {"id": "S4", "name": "Safety Interlock", "status": "passed" if not any(f.get("severity") == "high" for f in self.faults) else "failed"},
            ]
            if sequence_id == "fault_recovery":
                steps.append({"id": "S5", "name": "Fault Recovery", "status": "passed" if not self.faults else "failed"})
            status = "completed" if all(step["status"] == "passed" for step in steps) else "failed"
            self._emit("hil.sequence.completed", "info" if status == "completed" else "warning", f"{sequence_id} · {status}", {"sequence_id": sequence_id, "steps": steps})
            return {"sequence_id": sequence_id, "run_id": self.run_id, "status": status, "steps": steps, "preflight": preflight}

    async def set_recording(self, enabled: bool) -> dict:
        async with self._lock:
            self.recording = enabled
            self._emit("recording.started" if enabled else "recording.stopped", "info", "시험 기록 ON" if enabled else "시험 기록 OFF")
            return {"run_id": self.run_id, "recording": self.recording}

    def status(self) -> dict:
        return {
            "running": self.running,
            "speed": self.speed,
            "elapsed_seconds": round(self.elapsed_seconds, 3),
            "scenario_id": self.scenario_id,
            "sequence": self.sequence,
            "active_faults": deepcopy(self.faults),
            "started_at": self.started_at.isoformat(),
            "run_id": self.run_id,
            "mode": self.mode,
            "scenario_version": self.scenario_version,
            "random_seed": self.random_seed,
            "recording": self.recording,
            "data_quality": self.data_quality,
        }

    def _refresh_telemetry(self) -> None:
        self.current_telemetry = calculate_telemetry(self.elapsed_seconds, deepcopy(self.faults))
        self._last_snapshot_second = int(self.elapsed_seconds)

    def telemetry(self) -> dict:
        return {
            "type": "telemetry",
            "runtime": self.status(),
            "telemetry": deepcopy(self.current_telemetry),
            "events": deepcopy(list(self.events)[:12]),
            "devices": deepcopy(self.devices),
            "missions": deepcopy(self.missions),
            "wall_time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "data_quality": {"status": self.data_quality, "mode": self.mode, "source": "deterministic-sim", "sequence": self.sequence},
        }



