"""Strict readonly node geometry transport over an injected native query port."""
from fastapi import APIRouter,Request,HTTPException
from fastapi.routing import APIRoute
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel,ConfigDict,Field,field_validator,model_validator
from digital_twin.contracts.orbit import OrbitBusy,OrbitUnavailable
from digital_twin.contracts.satellite_nodes import NodeGeometryPort,MAX_NODE_ROWS,prepare_node_definitions
from foundation.orbit_time import parse_utc


class NodeGeometryRoute(APIRoute):
    def get_route_handler(self):
        handler=super().get_route_handler()
        async def safe_validation(request):
            try:return await handler(request)
            except RequestValidationError as error:
                # Do not echo nonfinite or complete node definitions into error JSON.
                return JSONResponse(status_code=422,content={'detail':[
                    {'type':item['type'],'loc':item['loc'],'msg':item['msg']} for item in error.errors()]})
        return safe_validation


router=APIRouter(prefix='/api/nodes',tags=['nodes'],route_class=NodeGeometryRoute)


class NodeGeometryRequest(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True,allow_inf_nan=False)
    request_id:str=Field(min_length=1,max_length=128)
    nodes:list[dict]=Field(min_length=1,max_length=240)

    @field_validator('request_id')
    @classmethod
    def nonblank(cls,value):
        if not value.strip():raise ValueError('nonblank request id required')
        return value

    @field_validator('nodes')
    @classmethod
    def definitions(cls,value):
        # Geometry consumes copied complete definitions, with finite schema/identity/orbit validation.
        # Editor equipment/mode domain and accepted deployment use their own contracts.
        prepare_node_definitions(value)
        return value


class NodeSamplesRequest(NodeGeometryRequest):
    start_utc:str
    count:int=Field(ge=1,le=601)
    step_seconds:int=Field(ge=1,le=1)

    @field_validator('start_utc')
    @classmethod
    def utc(cls,value):return parse_utc(value).iso_utc

    @model_validator(mode='after')
    def row_limit(self):
        if len(self.nodes)*self.count>MAX_NODE_ROWS:raise ValueError('node batch limits exceeded')
        return self


class NodeTrackRequest(NodeGeometryRequest):
    center_utc:str

    @field_validator('center_utc')
    @classmethod
    def utc(cls,value):return parse_utc(value).iso_utc


async def _query(request,method,*args):
    port:NodeGeometryPort|None=getattr(request.app.state,'node_geometry_query',None)
    if port is None:raise HTTPException(503,'Node native profile unavailable')
    try:return await getattr(port,method)(*args)
    except (OrbitBusy,OrbitUnavailable,ImportError,OSError) as error:raise HTTPException(503,str(error)) from error
    except (ValueError,KeyError,TypeError) as error:raise HTTPException(422,str(error)) from error
    except RuntimeError as error:raise HTTPException(502,'Invalid native node result') from error


@router.post('/samples')
async def samples(request:Request,command:NodeSamplesRequest)->dict:
    return await _query(request,'samples',command.nodes,command.start_utc,command.count,command.step_seconds,command.request_id)


@router.post('/track')
async def track(request:Request,command:NodeTrackRequest)->dict:
    return await _query(request,'track',command.nodes,command.center_utc,command.request_id)
