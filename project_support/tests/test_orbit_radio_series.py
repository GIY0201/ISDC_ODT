import asyncio
from dataclasses import replace
import pytest
from fastapi.testclient import TestClient
from foundation.orbit_time import parse_utc,advance_seconds
from user_application.orbit_calculation import create_orbit_calculation
from user_application.web.application import create_app
from digital_twin.contracts.orbit import GroundPoint
from project_support.tests.test_orbit_api import inputs,eop,selection,UTC
F=437825000.
def payload(inputs,seconds=10):return dict(client_request_id='series',selection_revision=1,input_id=inputs[0].input_id,start_utc=UTC,end_utc=advance_seconds(parse_utc(UTC),seconds).iso_utc,frequency_hz=F)
@pytest.mark.parametrize('seconds,count',[(.25,2),(10,11),(7200,601),(86400,601)])
def test_batch_matches_scalar_and_one_native_call(inputs,eop,monkeypatch,seconds,count):
 import communication.native.orbit_adapter as adapter
 real=adapter.propagate_instants;calls=[]
 def spy(*args):calls.append(len(args[1]));return real(*args)
 monkeypatch.setattr(adapter,'propagate_instants',spy)
 calc=create_orbit_calculation(eop);p=payload(inputs,seconds);site=GroundPoint(33.4996,126.5312,0)
 result=calc.radio_series(inputs[0],p['start_utc'],p['end_utc'],site,F)
 assert calls==[count] and len(result.rows)==count
 assert result.rows[0].utc==parse_utc(p['start_utc']).iso_utc and result.rows[-1].utc==p['end_utc']
 assert result.duration_seconds==pytest.approx(seconds,abs=1e-8)
 for row in (result.rows[0],result.rows[len(result.rows)//2],result.rows[-1]):
  single=calc.radio(inputs[0],row.utc,site,F)
  for key in ['range_m','range_rate_m_s','doppler_hz','received_frequency_hz','elevation_deg']:assert getattr(row,key)==pytest.approx(getattr(single,key),abs=1e-6)
def test_leap_grid_is_si(inputs,eop):
 result=create_orbit_calculation(eop).radio_series(inputs[0],'2016-12-31T23:59:59Z','2017-01-01T00:00:00Z',GroundPoint(0,0,0),F)
 assert result.duration_seconds==pytest.approx(2) and len(result.rows)==3
 assert result.rows[1].utc=='2016-12-31T23:59:60.000000000Z'
@pytest.mark.parametrize('all_errors',[False,True])
def test_native_error_rows_preserved(inputs,eop,monkeypatch,all_errors):
 import communication.native.orbit_adapter as adapter
 real=adapter.propagate_instants
 def failed(*args):
  value=real(*args);return replace(value,errors=tuple('DECAYED' if all_errors or i==1 else None for i in range(len(value.errors))))
 monkeypatch.setattr(adapter,'propagate_instants',failed)
 with TestClient(create_app(orbit_inputs=inputs,eop_provider=eop)) as client:
  client.put('/api/orbit/selection',json=selection(inputs[0].input_id))
  r=client.post('/api/orbit/radio-series',json=payload(inputs,2));assert r.status_code==200
  value=r.json();assert value['status']==('error' if all_errors else 'partial')
  row=value['rows'][1];assert row['error_code']=='DECAYED' and row['position_m'] is None and row['doppler_hz'] is None
@pytest.mark.parametrize('changes',[{'end_utc':UTC},{'end_utc':'2020-07-14T00:00:00Z'},{'frequency_hz':True},{'frequency_hz':0},{'start_utc':'invalid'},{'count':1000},{'selection_revision':True}])
def test_strict_request_bounds(inputs,eop,changes):
 with TestClient(create_app(orbit_inputs=inputs,eop_provider=eop)) as client:assert client.post('/api/orbit/radio-series',json=payload(inputs)|changes).status_code==422
def test_api_readonly_context_and_unavailable(inputs,eop):
 with TestClient(create_app(orbit_inputs=inputs,eop_provider=eop)) as client:
  client.put('/api/orbit/selection',json=selection(inputs[0].input_id));before=client.get('/api/orbit/state').json()
  r=client.post('/api/orbit/radio-series',json=payload(inputs));assert r.status_code==200 and len(r.json()['rows'])==11
  after=client.get('/api/orbit/state').json();assert {k:v for k,v in before.items() if k!='observed_monotonic_s'}=={k:v for k,v in after.items() if k!='observed_monotonic_s'}
  assert r.json()['communication_status']=='unknown' and r.json()['stale'] is False
  assert client.post('/api/orbit/radio-series',json=payload(inputs)|{'selection_revision':0}).status_code==409
 with TestClient(create_app(orbit_inputs=inputs)) as client:
  client.put('/api/orbit/selection',json=selection(inputs[0].input_id));assert client.post('/api/orbit/radio-series',json=payload(inputs)).status_code==503
def test_series_stale_after_selection_change(inputs,eop):
 from digital_twin.runtime.orbit import OrbitRuntime
 async def scenario():
  entered=asyncio.Event();release=asyncio.Event()
  async def execute(work):entered.set();await release.wait();return work()
  runtime=OrbitRuntime(lookup_input=lambda _:inputs[0],calculate=create_orbit_calculation(eop),execute=execute)
  args=selection(inputs[0].input_id)|{'ground_point':GroundPoint(0,0,0)};await runtime.select(**args)
  pending=asyncio.create_task(runtime.radio_series(**payload(inputs,2)));await entered.wait();await runtime.select(**(args|{'expected_revision':1}));release.set();assert (await pending).stale is True
 asyncio.run(scenario())
@pytest.mark.parametrize('field',['eop_sha256','rows','step_seconds','row'])
def test_injected_bad_series_is_rejected(inputs,eop,field):
 from digital_twin.runtime.orbit import OrbitRuntime
 async def scenario():
  calc=create_orbit_calculation(eop);original=calc.radio_series
  def fake(*args):
   result=original(*args)
   if field=='eop_sha256':return replace(result,eop_sha256='0'*64)
   if field=='rows':return replace(result,rows=result.rows[:-1])
   if field=='step_seconds':return replace(result,step_seconds=result.step_seconds+1)
   return replace(result,rows=(replace(result.rows[0],elevation_deg=0),*result.rows[1:]))
  fake.eop_sha256=eop.eop_sha256;fake.leap_sha256=eop.leap_sha256;calc.radio_series=fake
  async def execute(work):return work()
  runtime=OrbitRuntime(lookup_input=lambda _:inputs[0],calculate=calc,execute=execute);await runtime.select(**(selection(inputs[0].input_id)|{'ground_point':GroundPoint(0,0,0)}))
  with pytest.raises(RuntimeError):await runtime.radio_series(**payload(inputs,2))
 asyncio.run(scenario())
