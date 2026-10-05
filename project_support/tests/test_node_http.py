"""Readonly node wire gates against real application/query/native decoding."""
import copy
import json
import struct
from pathlib import Path
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from communication.http.node_geometry import router
from communication.native.node_adapter import propagate_node_grids
from digital_twin.contracts.orbit import OrbitUnavailable,OrbitBusy
from user_application.node_geometry import NodeGeometryQuery
from user_application.web.application import create_app

ORBIT=next(c for c in json.loads((Path(__file__).parent/'fixtures/original_satellite_nodes.json').read_text(encoding='utf-8'))['cases'] if c['id']=='elements:0')['input']['orbit']
def payload(**changes):
 return {'request_id':'http-node','nodes':[{'schema':1,'id':'N-1','catalog_number':900001,'orbit':dict(ORBIT)}],
  'start_utc':'2016-12-31T23:59:59Z','step_seconds':1,'count':3}|changes

def query():
 def native(definitions,indices,times):
  row=[0.0]*31;row[6:9]=[7000,0,0];row[9]=row[12]=row[16]=row[20]=1;row[21]=7000;row[27]=1;row[30]=550
  return struct.pack('<'+'d'*31*len(indices),*(row*len(indices))),[None]*len(indices)
 port=SimpleNamespace(propagate_nodes=native,node_calculation_profile='SOURCE_KEPLER_J2_V1',node_frame='EARTH_FIXED_GMST_UTC_APPROX',node_inertial_frame='SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',node_time_model='unix_ms_utc_approx',NODE_ROW_WIDTH=31,MAX_NODE_DEFINITIONS=240,MAX_NODE_ROWS=50000,MAX_NODE_SAMPLES=601)
 return NodeGeometryQuery(calculate=lambda p,g:propagate_node_grids(p,g,native_port=port))

def client(query_port=None):
 app=create_app();app.include_router(router);app.state.node_geometry_query=query_port
 return TestClient(app)

def state(c):
 orbit=c.get('/api/orbit/state').json();orbit.pop('observed_monotonic_s')
 return orbit,c.get('/api/bootstrap').json()['runtime']

def test_http_samples_tracks_copies_and_runtime_readonly():
 with client(query()) as c:
  before=state(c);request=payload();original=copy.deepcopy(request)
  response=c.post('/api/nodes/samples',json=request);assert response.status_code==200,response.text
  value=response.json();assert value['model_profile']=='SOURCE_KEPLER_J2_V1' and value['frame']=='EARTH_FIXED_GMST_UTC_APPROX'
  assert value['request_id']==request['request_id'] and value['status']=='partial'
  rows=value['nodes'][0]['rows'];assert rows[0]['position_m']==[7000000,0,0] and rows[1]['position_m'] is None
  assert rows[1]['error_code']=='unsupported_node_time' and request==original
  track={'request_id':'track','nodes':request['nodes'],'center_utc':'2026-10-04T22:01:12Z'}
  response=c.post('/api/nodes/track',json=track);assert response.status_code==200,response.text
  assert len(response.json()['nodes'][0]['rows'])==121 and response.json()['nodes'][0]['path_visible']
  assert state(c)==before

@pytest.mark.parametrize('change',[{'count':0},{'count':602},{'count':True},{'step_seconds':2},{'request_id':' '},{'extra':1},{'start_utc':'2026-01-01'},{'nodes':[]},{'nodes':'x'}])
def test_http_strict_outer_input_rejected_before_native(change):
 with client() as c:assert c.post('/api/nodes/samples',json=payload(**change)).status_code==422

@pytest.mark.parametrize('change',[{'schema':2},{'schema':True},{'id':''},{'catalog_number':True},{'orbit':None}])
def test_http_node_identity_orbit_schema_rejected(change):
 body=payload();body['nodes'][0].update(change)
 with client() as c:assert c.post('/api/nodes/samples',json=body).status_code==422

def test_http_duplicates_limits_and_nan_do_not_reach_query_or_echo_nonfinite():
 with client() as c:
  body=payload();body['nodes']*=2;assert c.post('/api/nodes/samples',json=body).status_code==422
  body=payload(count=601);body['nodes']=[dict(body['nodes'][0],id=f'N-{i}',catalog_number=900000+i) for i in range(84)]
  assert c.post('/api/nodes/samples',json=body).status_code==422
  body=payload();body['nodes'][0]['orbit']['altitude_km']=float('nan')
  response=c.post('/api/nodes/samples',content=json.dumps(body),headers={'Content-Type':'application/json'})
  assert response.status_code==422 and 'NaN' not in response.text

@pytest.mark.parametrize('error',[OrbitUnavailable('missing wheel'),OrbitBusy('busy')])
def test_http_native_unavailable_and_busy_preserve_runtime(error):
 class Failed:
  async def samples(self,*args):raise error
 with client(Failed()) as c:
  before=state(c);assert c.post('/api/nodes/samples',json=payload()).status_code==503;assert state(c)==before

def test_http_absent_port_leap_track_and_malformed_batch():
 with client() as c:assert c.post('/api/nodes/samples',json=payload()).status_code==503
 with client(query()) as c:
  response=c.post('/api/nodes/track',json={'request_id':'leap','nodes':payload()['nodes'],'center_utc':'2016-12-31T23:59:60Z'})
  assert response.status_code==422 and 'unsupported_node_time' in response.text
 with client(NodeGeometryQuery(calculate=lambda *args:None)) as c:
  assert c.post('/api/nodes/samples',json=payload()).status_code==502
