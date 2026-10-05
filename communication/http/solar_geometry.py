"""Strict readonly solar wire schema over an injected calculation port."""
from fastapi import APIRouter,Request,HTTPException
from pydantic import BaseModel,ConfigDict,Field,field_validator
from foundation.orbit_time import parse_utc
from digital_twin.contracts.solar_geometry import SolarGeometryPort
from digital_twin.contracts.orbit import OrbitBusy,OrbitUnavailable

router=APIRouter(prefix='/api/solar',tags=['solar'])


class SolarSamplesRequest(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)
    client_request_id:str=Field(min_length=1,max_length=128)
    start_utc:str
    step_seconds:int=Field(ge=1,le=1)
    count:int=Field(ge=1,le=601)

    @field_validator('start_utc')
    @classmethod
    def utc(cls,value):return parse_utc(value).iso_utc

    @field_validator('client_request_id')
    @classmethod
    def nonblank(cls,value):
        if not value.strip():raise ValueError('nonblank request id required')
        return value


@router.post('/samples')
async def samples(request:Request,command:SolarSamplesRequest)->dict:
    query:SolarGeometryPort|None=request.app.state.solar_geometry_query
    if query is None:raise HTTPException(503,'Solar EOP profile unavailable')
    try:return await query.samples(command.start_utc,command.step_seconds,command.count,command.client_request_id)
    except (OrbitBusy,OrbitUnavailable,ImportError,OSError) as error:raise HTTPException(503,str(error)) from error
    except (ValueError,KeyError,TypeError) as error:raise HTTPException(422,str(error)) from error
