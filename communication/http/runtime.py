from __future__ import annotations

from fastapi import APIRouter, Request
from .dependencies import runtime_of
from .schemas import RuntimeControl, RuntimeSpeed, FaultRequest, ScenarioSelection
from pydantic import BaseModel, Field

class ScenarioAdvance(BaseModel):
    """Forward-only jump of the simulation clock used by the scenario player."""
    seconds: float = Field(gt=0, le=3600)

router = APIRouter()


@router.post("/api/runtime/control")
async def runtime_control(request: Request, command: RuntimeControl) -> dict:
    runtime = runtime_of(request)
    return await runtime.control(command.action, command.speed)


@router.post("/api/runtime/speed")
async def runtime_speed(request: Request, command: RuntimeSpeed) -> dict:
    runtime = runtime_of(request)
    return await runtime.set_speed(command.speed)


@router.post("/api/scenario/select")
async def scenario_select(request: Request, command: ScenarioSelection) -> dict:
    runtime = runtime_of(request)
    return await runtime.select_scenario(command.scenario_id)


@router.post("/api/faults")
async def inject_fault(request: Request, command: FaultRequest) -> dict:
    runtime = runtime_of(request)
    return await runtime.inject_fault(command.model_dump())


@router.post('/api/scenario/advance')
async def scenario_advance(request: Request, command: ScenarioAdvance) -> dict:
    return await runtime_of(request).advance(command.seconds)
