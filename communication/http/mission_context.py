"""Explicit acceptance of full native analysis inputs; retains existing roster API."""
import json,math
from fastapi import APIRouter,HTTPException,Request
from pydantic import Field,model_validator
from communication.http.node_geometry import NodeGeometryRequest,NodeGeometryRoute
from communication.http.data_deployment_schemas import DeploymentNode
from communication.http.mission_windows import WindowSiteRequest,ExternalWindowRequest
from foundation.orbit_time import parse_utc
from foundation.mission_planning_errors import MissionPlanningConflict
from digital_twin.contracts.orbit import OrbitBusy,OrbitUnavailable
from digital_twin.contracts.catalog_geometry import CatalogGpChanged
from foundation.mission_planning_errors import MissionPlanningUnavailable

class MissionContextRequest(NodeGeometryRequest):
    run_id:str=Field(min_length=1,max_length=240)
    deployment_revision:int=Field(ge=1)
    utc:str
    stations:list[dict]=Field(max_length=64)
    faults:list[dict]=Field(max_length=200)
    module_instance:str=Field(min_length=1,max_length=128)
    module_sequence:int=Field(ge=0)
    external:ExternalWindowRequest|None=None

    @model_validator(mode='after')
    def captured_inputs(self):
        self.utc=parse_utc(self.utc).iso_utc
        if ':60' in self.utc:raise ValueError('source native analysis does not support leap row')
        json.dumps([self.nodes,self.stations,self.faults],allow_nan=False)
        for node in self.nodes:
            if not all(k in node for k in ('id','name','mode','equipment')) or not isinstance(node['equipment'],list) or any(not isinstance(item,dict) or not all(k in item for k in ('id','catalog','enabled')) for item in node['equipment']):raise ValueError('full source equipment roster required')
            DeploymentNode.model_validate({k:node[k] for k in ('id','name','mode')}|{'equipment':[{k:item[k] for k in ('id','catalog','enabled')} for item in node['equipment']]})
            if not isinstance(node.get('bus'),str) or not node['bus'] or not isinstance(node.get('power'),dict):raise ValueError('full source bus/power required')
            for field in ('generation_w','bus_w','battery_wh'):
                value=node['power'].get(field)
                if type(value) not in (int,float) or not math.isfinite(value) or value<0:raise ValueError('finite nonnegative source power required')
        ids=set()
        for station in self.stations:
            if not all(k in station for k in ('latitude','longitude')):raise ValueError('source station coordinates required')
            if (not isinstance(station.get('id'),str) or station['id'] in ids or not isinstance(station.get('name'),str) or not station['name'].strip() or len(station['name'])>80
                or not isinstance(station.get('bands'),list) or not station['bands'] or any(not isinstance(b,str) for b in station['bands']) or len(set(station['bands']))!=len(station['bands'])
                or any(b not in ('S','X','Ka') for b in station['bands']) or station.get('enabled',True) is not True):raise ValueError('active source station identity/bands required')
            ids.add(station['id'])
            altitude=station.get('altitude_km',0)
            if type(altitude) not in (float,int) or not math.isfinite(altitude):raise ValueError('finite source station altitude required')
            WindowSiteRequest.model_validate({'station_id':station['id'],'ground_point':{'latitude_deg':station['latitude'],'longitude_deg':station['longitude'],'ellipsoid_height_m':station.get('altitude_km',0)*1000},'minimum_elevation_deg':station.get('min_elevation_deg',0)}).contract()
        return self

router=APIRouter(prefix='/api/nodes',route_class=NodeGeometryRoute)
@router.get('/mission-context')
async def context(request:Request):return {'schema_version':1,'context':request.app.state.runtime.mission_context()}
@router.post('/mission-context')
async def accept_context(request:Request,command:MissionContextRequest):
    try:return await request.app.state.mission_context_query.accept(command.model_dump())
    except (MissionPlanningConflict,CatalogGpChanged) as error:raise HTTPException(409,str(error)) from error
    except (OrbitBusy,OrbitUnavailable,MissionPlanningUnavailable,ImportError,OSError) as error:raise HTTPException(503,str(error)) from error
    except (ValueError,KeyError,TypeError) as error:raise HTTPException(422,str(error)) from error
    except RuntimeError as error:raise HTTPException(502,str(error)) from error
