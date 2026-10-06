import asyncio,copy
import pytest
from fastapi.testclient import TestClient
from digital_twin.contracts.orbit import GroundPoint,OrbitUnavailable
from digital_twin.contracts.mission_windows import MissionWindowSite,MissionAccessTarget
from user_application.mission_window_batch import MissionWindowQuery
from user_application.web.application import create_app
from project_support.tests.test_native_mission_passes import query
from project_support.tests.test_native_mission_windows import START,at
from project_support.tests.test_node_samples import definition

SITE=MissionWindowSite('GS-1',GroundPoint(0,0,0),10)

def test_batch_reuses_producers_and_captures_whole_input_before_await():
 nodes=[definition()];sites=[SITE];q=query(lambda t:70);execute=q.execute
 async def mutate(work):nodes[0]['id']='CHANGED';sites.clear();return await execute(work)
 q.execute=mutate
 result=asyncio.run(MissionWindowQuery(q,lambda:None).calculate(nodes,sites,START,at(120),'batch-test',target=MissionAccessTarget(GroundPoint(0,0,0),30)))
 assert result['request_id']=='batch-test' and result['status']=='sampled'
 assert result['node_definitions'][0]['id']=='N-1' and len(result['contact_reports'])==1
 assert len(result['contact_reports'][0]['geometry']['passes'])==1 and len(result['target_report']['passes'])==1
 assert result['definition_hashes']==result['eclipse_report']['definition_hashes']
 assert result['external_report'] is None


def payload(**kw):return dict(request_id='http-mission-windows',nodes=[definition()],sites=[dict(station_id='GS-1',ground_point=dict(latitude_deg=0,longitude_deg=0,ellipsoid_height_m=0),minimum_elevation_deg=10)],start_utc=START,end_utc=at(120))|kw


def test_real_app_route_returns_native_batch_without_changing_orbit_selection():
 with TestClient(create_app(node_geometry_query=query(lambda t:70))) as c:
  before=c.get('/api/orbit/state').json();before.pop('observed_monotonic_s')
  command=payload();original=copy.deepcopy(command)
  reply=c.post('/api/nodes/mission-windows',json=command);assert reply.status_code==200,reply.text
  result=reply.json();assert len(result['contact_reports'][0]['geometry']['passes'])==1
  assert result['request_id']==command['request_id'] and command==original
  after=c.get('/api/orbit/state').json();after.pop('observed_monotonic_s');assert after==before

@pytest.mark.parametrize('changes',[{'end_utc':START},{'end_utc':at(86401)},{'request_id':' '},{'nodes':[]},{'unknown':1},{'target':dict(ground_point=dict(latitude_deg=0,longitude_deg=0,ellipsoid_height_m=0),off_nadir_degrees=True)}])
def test_invalid_batch_wire_input_rejects_before_native(changes):
 class Never:
  async def points(self,*args):pytest.fail('bad request reached native')
 with TestClient(create_app(node_geometry_query=Never())) as c:
  assert c.post('/api/nodes/mission-windows',json=payload(**changes)).status_code==422


def test_duplicate_station_identity_rejects_before_query():
 class Never:
  async def points(self,*args):pytest.fail('duplicate station reached native')
 with pytest.raises(ValueError):asyncio.run(MissionWindowQuery(Never(),lambda:None).calculate([definition()],[SITE,SITE],START,at(120),'batch-test'))


def test_pickup_without_precise_catalog_port_is_unavailable_not_empty_success():
 from project_support.tests.test_native_crosslinks import EXTERNAL
 with TestClient(create_app(node_geometry_query=query(lambda t:70))) as c:
  reply=c.post('/api/nodes/mission-windows',json=payload(external=EXTERNAL,max_external_range_km=2000))
  assert reply.status_code==503


def test_later_required_geometry_failure_does_not_publish_earlier_contacts():
 from dataclasses import replace
 q=query(lambda t:70);calculate=q.calculate
 def fail_eclipse(prepared,grids):
  value=calculate(prepared,grids)
  if len(grids[0])==3:return replace(value,errors=tuple('invalid_node_orbit' for _ in value.errors))
  return value
 q.calculate=fail_eclipse
 with TestClient(create_app(node_geometry_query=q)) as c:
  result=c.post('/api/nodes/mission-windows',json=payload())
  assert result.status_code==502 and 'contact_reports' not in result.json()


def test_busy_native_queue_preserves_http_unavailable_semantics():
 from digital_twin.contracts.orbit import OrbitBusy
 q=query(lambda t:70)
 async def busy(work):raise OrbitBusy('native queue full')
 q.execute=busy
 with TestClient(create_app(node_geometry_query=q)) as c:assert c.post('/api/nodes/mission-windows',json=payload()).status_code==503


def test_external_gp_change_is_conflict_without_a_plausible_empty_plan():
 from project_support.tests.test_native_crosslinks import EXTERNAL
 from digital_twin.contracts.catalog_geometry import CatalogGpChanged
 class Changed:
  async def points(self,*args):raise CatalogGpChanged('external GP changed')
 with TestClient(create_app(node_geometry_query=query(lambda t:70),catalog_geometry_query=Changed())) as c:
  result=c.post('/api/nodes/mission-windows',json=payload(external=EXTERNAL,max_external_range_km=2000))
  assert result.status_code==409 and 'contact_reports' not in result.json()
