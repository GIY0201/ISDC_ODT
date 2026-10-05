from fastapi import APIRouter,Request,HTTPException
from pydantic import BaseModel,ConfigDict,Field,field_validator
from digital_twin.contracts.catalog_geometry import CatalogGeometryPort,CatalogGpChanged
from digital_twin.contracts.orbit import OrbitBusy,OrbitUnavailable
from communication.http.orbit_schemas import OrbitRequest,GroundPointRequest
from foundation.orbit_time import parse_utc

router=APIRouter()
class CatalogPositionRequest(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)
    group:str=Field(min_length=1,max_length=32,pattern=r'^[a-zA-Z0-9_-]+$')
    catalog_number:int=Field(ge=1,le=999999999)

class CatalogSamplesRequest(OrbitRequest):
    client_request_id:str=Field(min_length=1,max_length=128)
    group:str=Field(min_length=1,max_length=32,pattern=r'^[a-zA-Z0-9_-]+$')
    catalog_number:int=Field(ge=1,le=999999999)
    normalized_gp_sha256:str=Field(pattern=r'^[a-f0-9]{64}$')
    start_utc:str
    step_seconds:int=Field(ge=1,le=60)
    count:int=Field(ge=1,le=601)
    ground_point:GroundPointRequest
    minimum_elevation_deg:float=Field(ge=0,le=90)
    @field_validator('start_utc')
    @classmethod
    def utc(cls,value):return parse_utc(value).iso_utc
    @field_validator('client_request_id')
    @classmethod
    def nonblank(cls,value):
        if not value.strip():raise ValueError('nonblank request id required')
        return value

@router.post('/api/catalog/position')
async def position(request:Request,command:CatalogPositionRequest)->dict:
    query:CatalogGeometryPort|None=request.app.state.catalog_geometry_query
    if query is None:raise HTTPException(503,'Catalog EOP/native profile unavailable')
    try:return await query.position(command.group,command.catalog_number)
    except (OrbitBusy,OrbitUnavailable,ImportError,OSError) as error:raise HTTPException(503,str(error)) from error
    except (ValueError,KeyError,TypeError) as error:raise HTTPException(422,str(error)) from error

@router.post('/api/catalog/samples')
async def samples(request:Request,command:CatalogSamplesRequest)->dict:
    query:CatalogGeometryPort|None=request.app.state.catalog_geometry_query
    if query is None:raise HTTPException(503,'Catalog EOP/native profile unavailable')
    try:return await query.samples(command.group,command.catalog_number,command.normalized_gp_sha256,command.start_utc,command.step_seconds,command.count,command.ground_point.contract(),command.minimum_elevation_deg,command.client_request_id)
    except CatalogGpChanged as error:raise HTTPException(409,str(error)) from error
    except (OrbitBusy,OrbitUnavailable,ImportError,OSError) as error:raise HTTPException(503,str(error)) from error
    except (ValueError,KeyError,TypeError) as error:raise HTTPException(422,str(error)) from error
