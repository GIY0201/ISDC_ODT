"""ICD-02 endpoints between the twin console and the data fabric module."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from digital_twin.contracts.data_fabric import DataFabricUnavailable, DataFabricConflict
from .dependencies import data_fabric_of
from .data_fabric_schemas import FabricRouteRequest, NetworkSnapshot

router = APIRouter()


async def _guarded(call, *args):
    try:
        return await run_in_threadpool(call, *args)
    except DataFabricConflict as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except DataFabricUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


def _headers(request, *, need_id=False):
    instance = request.headers.get("X-ISDC-Fabric-Instance")
    sequence = request.headers.get("X-ISDC-Fabric-Sequence")
    request_id = request.headers.get("X-ISDC-Fabric-Request-Id")
    if instance is None and sequence is None and request_id is None:
        return None
    if not instance or not sequence or not sequence.isascii() or not sequence.isdecimal() or (need_id and not request_id):
        raise ValueError("통신망 검증 헤더를 모두 제공하세요.")
    value = int(sequence)
    if value > 9007199254740991:
        raise ValueError("통신망 sequence 범위를 확인하세요.")
    return instance, value, request_id


def _port(fabric, name):
    call = getattr(fabric, name, None)
    if not callable(call):
        raise HTTPException(status_code=503, detail="통신 모듈이 guarded-v1을 지원하지 않습니다.")
    return call


@router.post("/api/data-fabric/network")
async def data_fabric_network(request: Request, snapshot: NetworkSnapshot) -> dict:
    fabric = data_fabric_of(request)
    guard = _headers(request, need_id=True)
    if guard is not None:
        instance, sequence, request_id = guard
        return await _guarded(_port(fabric, "guarded_update"), snapshot.model_dump(), request_id, sequence, instance)
    return await _guarded(fabric.update, snapshot.model_dump())


@router.post("/api/data-fabric/route")
async def data_fabric_route(request: Request, command: FabricRouteRequest) -> dict:
    fabric = data_fabric_of(request)
    guard = _headers(request)
    if guard is not None:
        instance, sequence, _ = guard
        return await _guarded(_port(fabric, "guarded_route"), command.source, command.target, command.objective, sequence, instance)
    return await _guarded(fabric.route, command.source, command.target, command.objective)


@router.get("/api/data-fabric/status")
async def data_fabric_status(request: Request) -> dict:
    fabric = data_fabric_of(request)
    try:
        return await run_in_threadpool(fabric.status)
    except DataFabricUnavailable as error:
        return {"module": "data_fabric", "implementation": getattr(fabric, "implementation", "unknown"), "placement": "remote",
                "endpoint": getattr(fabric, "base_url", None), "reachable": False, "detail": str(error)}
