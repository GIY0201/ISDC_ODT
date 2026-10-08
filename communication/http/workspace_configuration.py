"""Persisted definitions API. Runtime commands are outside this boundary."""
from urllib.parse import urlsplit
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool
from digital_twin.contracts.workspace_configuration import ConfigurationConflict, ConfigurationUnavailable
router=APIRouter(prefix='/api/workspace/configurations')
KINDS=('ground_stations','scenario_drafts')
class ConfigurationWrite(BaseModel):
    model_config=ConfigDict(extra='forbid')
    expected_revision:int=Field(strict=True,ge=0)
    value:dict

def repository(request):
    value=getattr(request.app.state,'workspace_configuration',None)
    if value is None: raise HTTPException(503,'서버 DB 저장이 구성되지 않았습니다.')
    return value

@router.get('/status')
async def status(request:Request):
    return {'enabled':getattr(request.app.state,'workspace_configuration',None) is not None,'provider':'postgresql','kinds':KINDS}

@router.get('/{kind}')
async def read(request:Request,kind:str):
    if kind not in KINDS: raise HTTPException(404)
    try: return await run_in_threadpool(repository(request).read,kind)
    except ConfigurationUnavailable as exc: raise HTTPException(503,str(exc)) from exc

@router.put('/{kind}')
async def save(request:Request,kind:str,command:ConfigurationWrite):
    if kind not in KINDS: raise HTTPException(404)
    origin=request.headers.get('origin')
    if request.headers.get('x-isdc-configuration')!='1' or (origin and (urlsplit(origin).scheme,urlsplit(origin).netloc)!=(request.url.scheme,request.url.netloc)): raise HTTPException(403,'같은 사이트의 설정 저장 요청이 필요합니다.')
    try: return await run_in_threadpool(repository(request).save,kind,command.value,command.expected_revision)
    except ConfigurationConflict as exc: raise HTTPException(409,str(exc)) from exc
    except ConfigurationUnavailable as exc: raise HTTPException(503,str(exc)) from exc
    except ValueError as exc: raise HTTPException(400,str(exc)) from exc
