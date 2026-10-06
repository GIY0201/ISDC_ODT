"""Readonly captured native mission geometry transport, no source scheduling command."""
from typing import Literal
from fastapi import APIRouter,Request,HTTPException
from pydantic import Field,model_validator
from communication.http.node_geometry import NodeGeometryRequest,NodeGeometryRoute
from communication.http.orbit_schemas import GroundPointRequest,OrbitRequest
from digital_twin.contracts.mission_windows import MissionWindowSite,MissionAccessTarget,MissionWindowPort
from digital_twin.contracts.orbit import OrbitBusy,OrbitUnavailable
from digital_twin.contracts.catalog_geometry import CatalogGpChanged
from foundation.orbit_time import parse_utc

class WindowSiteRequest(OrbitRequest):
    station_id:str=Field(min_length=1,max_length=80)
    ground_point:GroundPointRequest
    minimum_elevation_deg:float=Field(ge=0,lt=90)
    def contract(self):return MissionWindowSite(self.station_id,self.ground_point.contract(),self.minimum_elevation_deg)

class AccessTargetRequest(OrbitRequest):
    ground_point:GroundPointRequest
    off_nadir_degrees:float=Field(gt=0,le=90)
    def contract(self):return MissionAccessTarget(self.ground_point.contract(),self.off_nadir_degrees)

class ExternalWindowRequest(OrbitRequest):
    group:str=Field(min_length=1,max_length=80)
    catalog_number:int=Field(ge=1,le=999999999)
    normalized_gp_sha256:str=Field(pattern='^[a-f0-9]{64}$')
    eop_sha256:str=Field(pattern='^[a-f0-9]{64}$')
    leap_sha256:str=Field(pattern='^[a-f0-9]{64}$')
    profile:Literal['WGS72_AFSPC']

class MissionWindowRequest(NodeGeometryRequest):
    sites:list[WindowSiteRequest]=Field(default_factory=list,max_length=64)
    start_utc:str
    end_utc:str
    target:AccessTargetRequest|None=None
    external:ExternalWindowRequest|None=None
    max_external_range_km:float|None=Field(default=None,gt=0)
    @model_validator(mode='after')
    def captured_domain(self):
        first,last=parse_utc(self.start_utc),parse_utc(self.end_utc)
        if not 0<float((last.as_time()-first.as_time()).sec)<=86400.00000001:raise ValueError('window horizon must be positive and at most24h')
        self.start_utc=first.iso_utc;self.end_utc=last.iso_utc
        sites=[site.contract() for site in self.sites]
        if len({site.station_id for site in sites})!=len(sites):raise ValueError('unique station identities required')
        if self.target:self.target.contract()
        if (self.external is None)!=(self.max_external_range_km is None):raise ValueError('external GP and range required together')
        if self.external and not self.external.group.strip():raise ValueError('nonblank external group required')
        return self

router=APIRouter(prefix='/api/nodes',tags=['mission-windows'],route_class=NodeGeometryRoute)
@router.post('/mission-windows')
async def mission_windows(request:Request,command:MissionWindowRequest)->dict:
    port:MissionWindowPort|None=getattr(request.app.state,'mission_window_query',None)
    if port is None:raise HTTPException(503,'Native mission geometry unavailable')
    accepted=None
    expected=request.headers.get('X-ISDC-Mission-Context')
    def current_context():
        value=request.app.state.runtime.mission_context()
        if value is None or value['context_hash']!=expected or value['nodes']!=command.nodes or value['utc']!=command.start_utc:
            raise HTTPException(409,'accepted native mission context changed')
        sites=[{'station_id':s['id'],'ground_point':{'latitude_deg':s['latitude'],'longitude_deg':s['longitude'],'ellipsoid_height_m':s.get('altitude_km',0)*1000},'minimum_elevation_deg':s.get('min_elevation_deg',0)} for s in value['stations']]
        given=[{'station_id':s.station_id,'ground_point':{'latitude_deg':s.ground_point.latitude_deg,'longitude_deg':s.ground_point.longitude_deg,'ellipsoid_height_m':s.ground_point.ellipsoid_height_m},'minimum_elevation_deg':s.minimum_elevation_deg} for s in command.sites]
        external=command.external.model_dump() if command.external else None
        if given!=sites or external!=value['external']:raise HTTPException(409,'accepted mission site/external changed')
        return value
    if expected is not None:accepted=current_context()
    try:
        result=await port.calculate(command.nodes,[site.contract() for site in command.sites],command.start_utc,command.end_utc,command.request_id,
            target=command.target.contract() if command.target else None,external=command.external.model_dump() if command.external else None,max_external_range_km=command.max_external_range_km)
        if expected is not None:
            current_context();result['accepted_context']=accepted
        return result
    except CatalogGpChanged as error:raise HTTPException(409,str(error)) from error
    except (OrbitBusy,OrbitUnavailable,ImportError,OSError) as error:raise HTTPException(503,str(error)) from error
    except RuntimeError as error:raise HTTPException(502,'Invalid required native mission window result') from error
    except (ValueError,KeyError,TypeError) as error:raise HTTPException(422,str(error)) from error
