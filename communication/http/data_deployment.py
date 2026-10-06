"""Original deployment endpoints, using the injected scoped activation capability.

Application mounting is a separate composition step. Import starts no processes.
"""
from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from digital_twin.contracts.data_management import DataDeploymentConflict, DataManagementUnavailable
from .data_deployment_schemas import DataDeploymentCommand
from .dependencies import runtime_of

router = APIRouter()


@router.get('/api/data-management/deployment')
async def data_management_deployment(request: Request):
    return runtime_of(request).data_deployment()


@router.post('/api/data-management/deployment')
async def data_management_deploy(request: Request, command: DataDeploymentCommand):
    async def activate(context):
        bridge = getattr(request.app.state, 'data_management_bridge', None)
        module = getattr(request.app.state, 'data_management', None)
        if bridge is None or module is None:
            raise DataManagementUnavailable('데이터 관리 배치 수락 경로가 연결되지 않았습니다.')
        return await run_in_threadpool(bridge.sync, module, context)
    try:
        return await runtime_of(request).apply_data_deployment(command.model_dump(), activate)
    except DataDeploymentConflict as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except DataManagementUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
