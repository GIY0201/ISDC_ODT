"""Orbit wire adapter: only injected runtime and immutable input metadata."""
from dataclasses import asdict
from fastapi import APIRouter,Request,HTTPException
from digital_twin.contracts.orbit import OrbitConflict,OrbitUnavailable,OrbitBusy
from .orbit_schemas import SelectionRequest,SamplesRequest

router=APIRouter(prefix='/api/orbit',tags=['orbit'])
UNITS={'position':'m','elevation':'deg','time':'UTC','ground_height':'m (WGS84 ellipsoid)'}

def _input(request,input_id):
    record=next((item for item in request.app.state.orbit_inputs if item.input_id==input_id),None)
    if record is None:raise HTTPException(404,detail={'code':'input_not_found','message':'Stored orbit input not found'})
    return record

def _state(request):
    snapshot=request.app.state.runtime.orbit.snapshot()
    value=asdict(snapshot.selection)
    value.update(current_utc=snapshot.current_utc,observed_monotonic_s=snapshot.observed_monotonic_s,frame='ITRF',profile='WGS72_AFSPC',units=UNITS,communication_status='unknown')
    value['ground_point'].update(virtual=True,ellipsoid='WGS84')
    value['input_hash']=None if value['input_id'] is None else _input(request,value['input_id']).raw_sha256
    value.update(request.app.state.orbit_provenance)
    return value

def _error(request,error):
    if isinstance(error,OrbitConflict):return HTTPException(409,detail={'code':'revision_conflict','message':str(error),'state':_state(request)})
    if isinstance(error,(OrbitUnavailable,OrbitBusy)):return HTTPException(503,detail={'code':'calculation_unavailable','message':str(error)})
    if isinstance(error,ModuleNotFoundError) and error.name=='isdc_orbit_propagation':return HTTPException(503,detail={'code':'native_unavailable','message':'Orbit native module not installed'})
    if isinstance(error,ValueError):
        code='eop_out_of_range' if 'EOP snapshot range' in str(error) else 'invalid_calculation_input'
        return HTTPException(422,detail={'code':code,'message':str(error)})
    return error

@router.get('/inputs')
async def inputs(request:Request):
    if request.app.state.orbit_load_error:raise HTTPException(503,detail={'code':'stored_snapshot_invalid','message':'Stored orbit snapshot unavailable'})
    return {'inputs':[{'input_id':item.input_id,'satellite_id':item.satellite_id,'format':item.format,'source':item.source,'fetched_utc':item.fetched_utc,'epoch_utc':item.epoch_utc,'raw_sha256':item.raw_sha256,'frame':item.frame,'time_system':item.time_system,'profile':item.profile,'defaults':dict(item.defaults)} for item in request.app.state.orbit_inputs],**request.app.state.orbit_provenance}

@router.get('/state')
async def state(request:Request):return _state(request)

@router.put('/selection')
async def select(request:Request,command:SelectionRequest):
    _input(request,command.input_id)
    arguments=command.model_dump();arguments['ground_point']=command.ground_point.contract()
    try:await request.app.state.runtime.orbit.select(**arguments)
    except (OrbitConflict,ValueError) as exc:raise _error(request,exc) from exc
    return _state(request)

@router.post('/samples')
async def samples(request:Request,command:SamplesRequest):
    _input(request,command.input_id)
    try:result=await request.app.state.runtime.orbit.samples(**command.model_dump())
    except (OrbitConflict,OrbitUnavailable,OrbitBusy,ModuleNotFoundError,ValueError) as exc:raise _error(request,exc) from exc
    value=asdict(result)
    for row in value['rows']:row['status']='valid' if row['error_code'] is None else 'error'
    failures=sum(row['status']=='error' for row in value['rows'])
    value.update(status='error' if failures==len(value['rows']) else 'partial' if failures else 'complete',units=UNITS,communication_status='unknown')
    return value
