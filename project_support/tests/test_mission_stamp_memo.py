import asyncio,json
from pathlib import Path
import pytest
from digital_twin.contracts.orbit import GroundPoint
from project_support.tests.test_native_mission_passes import query as pass_query
from project_support.tests.test_native_mission_windows import query as eclipse_query
from project_support.tests.test_node_samples import definition
from user_application.native_passes import NativeMissionPasses
from user_application.mission_windows import NativeMissionWindows
from user_application.node_geometry import NodeGeometryQuery

START='2026-10-04T22:01:12.123456789Z';END='2026-10-04T22:02:12.987654321Z'
GOLDEN=json.loads((Path(__file__).parent/'fixtures/mission_stamp_precision_golden.json').read_text(encoding='utf-8'))
@pytest.mark.parametrize('kind',['passes','eclipses'])
def test_stamp_memo_preserves_whole_report_and_every_exact_native_request(kind):
 nodes=[definition(),definition('N-2',900002)];q=pass_query(lambda t:20) if kind=='passes' else eclipse_query(lambda n,t:n=='N-2');trace=[];points=q.points
 async def tracked(ns,utc,request_id):trace.append([list(n['id'] for n in ns),list(utc)]);return await points(ns,utc,request_id)
 q.points=tracked
 result=asyncio.run(NativeMissionPasses(q).passes(nodes,GroundPoint(0,0,0),START,END,mask_degrees=10) if kind=='passes' else NativeMissionWindows(q).eclipses(nodes,START,END))
 assert result==GOLDEN[kind]['report'] and trace==GOLDEN[kind]['query_trace']
 assert result['coverage']['start_utc']==START and result['coverage']['end_utc']==END

def test_repeated_node_formatting_is_reused_without_skipping_any_native_query(monkeypatch):
 import user_application.native_passes as module
 original=module.TimeDelta;formatted=[]
 def counted(*args,**kw):formatted.append(args[0]);return original(*args,**kw)
 monkeypatch.setattr(module,'TimeDelta',counted)
 result=asyncio.run(NativeMissionPasses(pass_query(lambda t:20)).passes([definition(),definition('N-2',900002)],GroundPoint(0,0,0),START,END,mask_degrees=10))
 assert result==GOLDEN['passes']['report']
 assert len(formatted)<len(GOLDEN['passes']['query_trace'])

def test_new_call_scope_preserves_its_own_endpoints_and_point_receipts():
 q=pass_query(lambda t:20);producer=NativeMissionPasses(q);nodes=[definition()]
 a=asyncio.run(producer.passes(nodes,GroundPoint(0,0,0),START,END))
 other_start='2026-10-04T22:03:12.111111111Z';other_end='2026-10-04T22:04:12.222222222Z'
 b=asyncio.run(producer.passes(nodes,GroundPoint(0,0,0),other_start,other_end))
 assert a['passes'][0]['start']==START and a['passes'][0]['end']==END
 assert b['passes'][0]['start']==other_start and b['passes'][0]['end']==other_end
 assert not any('cache' in key or 'stamp' in key for key in vars(producer))

@pytest.mark.parametrize('kind',['passes','eclipses'])
def test_unsupported_native_leap_sample_still_fails_required_receipt(kind):
 q=NodeGeometryQuery();nodes=[definition()];start='2016-12-31T23:59:60.123456789Z';end='2017-01-01T00:00:02.123456789Z'
 with pytest.raises(RuntimeError,match='native'):
  asyncio.run(NativeMissionPasses(q).passes(nodes,GroundPoint(0,0,0),start,end) if kind=='passes' else NativeMissionWindows(q).eclipses(nodes,start,end))
