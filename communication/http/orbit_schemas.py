"""Strict JSON requests. UTC strings remain strings to preserve leap seconds."""
from typing import Annotated,Literal
from pydantic import BaseModel,ConfigDict,Field,field_validator,model_validator
from foundation.orbit_time import parse_utc
from digital_twin.contracts.orbit import GroundPoint

class OrbitRequest(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True,allow_inf_nan=False)

class GroundPointRequest(OrbitRequest):
    latitude_deg: float=Field(ge=-90,le=90)
    longitude_deg: float=Field(ge=-180,le=180)
    ellipsoid_height_m: float
    virtual: bool=True
    @field_validator('virtual')
    @classmethod
    def virtual_only(cls,value):
        if not value:raise ValueError('only virtual observation points supported')
        return value
    ellipsoid: Literal['WGS84']='WGS84'
    def contract(self):return GroundPoint(self.latitude_deg,self.longitude_deg,self.ellipsoid_height_m)

class SelectionRequest(OrbitRequest):
    client_request_id: str=Field(min_length=1,max_length=128)
    expected_revision: int=Field(ge=0)
    input_id: str=Field(min_length=1,max_length=100)
    ground_point: GroundPointRequest
    minimum_elevation_deg: float=Field(ge=0,le=90)
    anchor_utc: str
    playing: bool
    play_rate: float=Field(ge=.1,le=60)
    @field_validator('anchor_utc')
    @classmethod
    def utc(cls,value):return parse_utc(value).iso_utc
    @field_validator('client_request_id','input_id')
    @classmethod
    def nonblank(cls,value):
        if not value.strip():raise ValueError('nonblank string required')
        return value

class SamplesRequest(OrbitRequest):
    client_request_id: str=Field(min_length=1,max_length=128)
    selection_revision: int=Field(ge=0)
    input_id: str=Field(min_length=1,max_length=100)
    start_utc: str
    step_seconds: float=Field(gt=0)
    count: int=Field(ge=1,le=3601)
    @field_validator('start_utc')
    @classmethod
    def utc(cls,value):return parse_utc(value).iso_utc
    @field_validator('client_request_id','input_id')
    @classmethod
    def nonblank(cls,value):
        if not value.strip():raise ValueError('nonblank string required')
        return value

class RadioGeometryRequest(OrbitRequest):
    client_request_id: str=Field(min_length=1,max_length=128)
    selection_revision: int=Field(ge=0)
    input_id: str=Field(min_length=1,max_length=100)
    utc: str
    frequency_hz: float=Field(gt=0,le=300000000000)
    @field_validator('utc')
    @classmethod
    def utc_value(cls,value):return parse_utc(value).iso_utc
    @field_validator('client_request_id','input_id')
    @classmethod
    def nonblank(cls,value):
        if not value.strip():raise ValueError('nonblank string required')
        return value

class VisibilityRequest(OrbitRequest):
    client_request_id: str=Field(min_length=1,max_length=128)
    selection_revision: int=Field(ge=0)
    input_id: str=Field(min_length=1,max_length=100)
    start_utc: str
    end_utc: str
    ground_point: GroundPointRequest
    minimum_elevation_deg: float=Field(ge=0,le=90)

    @field_validator('start_utc','end_utc')
    @classmethod
    def utc(cls,value):return parse_utc(value).iso_utc

    @field_validator('client_request_id','input_id')
    @classmethod
    def nonblank(cls,value):
        if not value.strip():raise ValueError('nonblank string required')
        return value

    @model_validator(mode='after')
    def range(self):
        elapsed=float((parse_utc(self.end_utc).as_time().tai-parse_utc(self.start_utc).as_time().tai).sec)
        if not 0<elapsed<=86400+1e-8:raise ValueError('visibility range must be >0 and <=24h SI')
        return self
