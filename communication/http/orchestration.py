"""ICD-03 endpoints between the twin console and the constellation operations module."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from digital_twin.contracts.orchestration import OrchestrationUnavailable, MissionPlanningConflict
from .dependencies import orchestration_of
from .orchestration_schemas import CommitRequest, PlanRequest

router = APIRouter()


async def _guarded(call, *args):
    try:
        return await run_in_threadpool(call, *args)
    except MissionPlanningConflict as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except OrchestrationUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/api/orchestration/plan")
async def orchestration_plan(request: Request, command: PlanRequest) -> dict:
    module = orchestration_of(request)
    guard = _headers(request, "Mission-Version")
    if guard is not None:
        instance, sequence, request_id, context, version = guard
        return await _guarded(_port(module, "guarded_plan"), command.model_dump(), request_id, sequence, instance, context, version)
    return await _guarded(module.plan, command.model_dump())


@router.post("/api/orchestration/commit")
async def orchestration_commit(request: Request, command: CommitRequest) -> dict:
    module = orchestration_of(request)
    guard = _headers(request, "Plan-Sequence")
    if guard is not None:
        instance, sequence, request_id, context, plan = guard
        return await _guarded(_port(module, "guarded_commit"), command.model_dump(), request_id, sequence, instance, plan, context)
    return await _guarded(module.commit, command.model_dump())


@router.get("/api/orchestration/status")
async def orchestration_status(request: Request) -> dict:
    module = orchestration_of(request)
    try:
        return await run_in_threadpool(module.status)
    except OrchestrationUnavailable as error:
        return {"module": "orchestration", "implementation": getattr(module, "implementation", "unknown"), "placement": "remote",
                "endpoint": getattr(module, "base_url", None), "reachable": False, "detail": str(error)}


def _headers(request, extra):
    prefix = "X-ISDC-Orchestration-"
    names = ("Instance", "Sequence", "Request-Id", "Context", extra)
    values = [request.headers.get(prefix + name) for name in names]
    # Any orchestration guard header opts into guarded handling, never partial legacy fallback.
    if not any(key.lower().startswith(prefix.lower()) for key in request.headers):
        return None
    if not all(values):
        raise ValueError("군집 운용 검증 헤더를 모두 제공하세요.")
    instance, sequence, request_id, context, version = values
    if not sequence.isascii() or not sequence.isdecimal() or not version.isascii() or not version.isdecimal():
        raise ValueError("군집 운용 sequence/version은 정수여야 합니다.")
    if int(sequence) > 9007199254740991 or not 1 <= int(version) <= 9007199254740991:
        raise ValueError("군집 운용 sequence/version 범위를 확인하세요.")
    return instance, int(sequence), request_id, context, int(version)


def _port(module, name):
    call = getattr(module, name, None)
    if not callable(call):
        raise HTTPException(status_code=503, detail="군집 운용 모듈이 guarded-v1을 지원하지 않습니다.")
    return call
