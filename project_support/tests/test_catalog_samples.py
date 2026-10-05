import asyncio,hashlib,json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from test_catalog_position import OMM
from data.earth_orientation import EarthOrientationSnapshot
from user_application.catalog_geometry import CatalogGeometryQuery
from user_application.orbit_calculation import create_orbit_calculation
from user_application.web.application import create_app

@pytest.fixture
def catalog_query():
 import astropy_iers_data as files
 a=Path(files.IERS_A_FILE);leap=Path(files.IERS_LEAP_SECOND_FILE)
 eop=EarthOrientationSnapshot.load(a,leap,eop_sha256=hashlib.sha256(a.read_bytes()).hexdigest(),leap_sha256=hashlib.sha256(leap.read_bytes()).hexdigest(),table_kind='IERS_A')
 item=OMM.copy()
 class Catalog:
  def catalog_groups(self):return [{'id':'active'}]
  async def get_satellites(self,**kw):return {'source':'celestrak-cache','fetched_at':'2026-10-01T00:00:00Z','items':[item]}
 calls=[]
 async def execute(work):calls.append(True);return work()
 q=CatalogGeometryQuery(Catalog(),eop,create_orbit_calculation(eop),execute)
 return q,item,calls

def payload(position,**overrides):
 p=dict(client_request_id='catalog-test',group='active',catalog_number=25544,normalized_gp_sha256=position['normalized_gp_sha256'],start_utc=position['epoch_utc'],step_seconds=1,count=3,ground_point={'latitude_deg':36.3742,'longitude_deg':127.3567,'ellipsoid_height_m':123.45,'virtual':True,'ellipsoid':'WGS84'},minimum_elevation_deg=5)
 return p|overrides

def test_native_samples_epoch_equality_observation_and_state_isolation(catalog_query):
 q,item,calls=catalog_query
 with TestClient(create_app(catalog_geometry_query=q)) as c:
  pos=c.post('/api/catalog/position',json={'group':'active','catalog_number':25544}).json()
  before=c.get('/api/orbit/state').json();sim=c.get('/api/bootstrap').json()['runtime']
  r=c.post('/api/catalog/samples',json=payload(pos));assert r.status_code==200,r.text
  v=r.json();assert len(v['rows'])==3 and v['rows'][0]['position_m']==pos['position_m']
  assert v['rows'][1]['position_m']!=v['rows'][0]['position_m'] and v['status']=='valid'
  assert v['ground_point']==payload(pos)['ground_point'] and v['communication_status']=='unknown'
  assert all(row['range_m']>0 and 0<=row['azimuth_deg']<360 and row['visible']==(row['elevation_deg']>=5) for row in v['rows'])
  after=c.get('/api/orbit/state').json();before.pop('observed_monotonic_s');after.pop('observed_monotonic_s');assert before==after
  assert c.get('/api/bootstrap').json()['runtime']['run_id']==sim['run_id']
  max_result=c.post('/api/catalog/samples',json=payload(pos,count=601));assert max_result.status_code==200 and len(max_result.json()['rows'])==601

@pytest.mark.parametrize('overrides',[{'count':602},{'count':0},{'count':True},{'step_seconds':0},{'step_seconds':61},{'step_seconds':1.5},{'start_utc':'local'},{'normalized_gp_sha256':'bad'},{'minimum_elevation_deg':91},{'extra':1}])
def test_invalid_request_never_executes(catalog_query,overrides):
 q,_,calls=catalog_query;pos=asyncio.run(q.position('active',25544));calls.clear()
 with TestClient(create_app(catalog_geometry_query=q)) as c:assert c.post('/api/catalog/samples',json=payload(pos,**overrides)).status_code==422
 assert not calls

def test_changed_gp_conflicts_before_native_and_unavailable_is_503(catalog_query):
 q,item,calls=catalog_query;pos=asyncio.run(q.position('active',25544));calls.clear();item['MEAN_ANOMALY']+=1
 with TestClient(create_app(catalog_geometry_query=q)) as c:assert c.post('/api/catalog/samples',json=payload(pos)).status_code==409
 assert not calls
 with TestClient(create_app()) as c:assert c.post('/api/catalog/samples',json=payload(pos)).status_code==503

def test_leap_si_grid_and_partial_native_errors(catalog_query):
 from digital_twin.contracts.orbit import OrbitCalculation,OrbitSample
 q,_,_=catalog_query;pos=asyncio.run(q.position('active',25544))
 captured=[]
 def calculate(orbit,utc,ground):
  captured.extend(utc)
  return OrbitCalculation(tuple(OrbitSample(t,(7000000.,100.,300.),10.,None) if i!=1 else OrbitSample(t,None,None,'decayed') for i,t in enumerate(utc)),q.eop.eop_sha256,q.eop.leap_sha256)
 q.calculate=calculate
 with TestClient(create_app(catalog_geometry_query=q)) as c:
  r=c.post('/api/catalog/samples',json=payload(pos,start_utc='2016-12-31T23:59:59Z'));assert r.status_code==200,r.text
  rows=r.json()['rows'];assert r.json()['status']=='partial'
  assert captured==['2016-12-31T23:59:59.000000000Z','2016-12-31T23:59:60.000000000Z','2017-01-01T00:00:00.000000000Z']
  assert rows[1]['status']=='error' and rows[1]['position_m'] is None and rows[1]['visible'] is None and rows[1]['range_m'] is None
  assert c.post('/api/catalog/samples',json=payload(pos,start_utc='2100-01-01T00:00:00Z')).status_code==422
