import asyncio,math,struct,json
from pathlib import Path
from dataclasses import replace
import pytest
from foundation.orbit_time import parse_utc
from user_application.node_geometry import NodeGeometryQuery
from user_application.native_crosslinks import NativeMissionCrosslinks
from digital_twin.simulation.mission_planning.window_geometry import line_of_sight_clear
from digital_twin.contracts.satellite_nodes import NODE_ROW_WIDTH,NODE_FRAME
from project_support.tests.test_node_samples import definition,batch
from project_support.tests.test_native_mission_windows import START,at

EXTERNAL={'group':'active','catalog_number':25544,'normalized_gp_sha256':'a'*64,'eop_sha256':'b'*64,'leap_sha256':'c'*64,'profile':'WGS72_AFSPC'}

def source_query():
 def calculate(prepared,grids):
  value=batch(prepared,grids);raw=list(struct.unpack('<'+'d'*(len(value._buffer)//8),value._buffer))
  for i in range(len(raw)//NODE_ROW_WIDTH):raw[i*NODE_ROW_WIDTH+6:i*NODE_ROW_WIDTH+9]=[7000,0,0]
  return replace(value,_buffer=struct.pack('<'+'d'*len(raw),*raw))
 return NodeGeometryQuery(calculate=calculate)

class ExternalQuery:
 def __init__(self,position=lambda t:[7000000,100000+(t-90)**2*1000,0],mutate=None):self.position=position;self.mutate=mutate;self.calls=[]
 async def points(self,group,number,digest,utc,request_id):
  self.calls.append(utc)
  rows=[{'utc':s,'status':'valid','error_code':None,'position_m':self.position(float((parse_utc(s).as_time()-parse_utc(START).as_time()).sec)),'eop_quality':{'ut1':'final_b','polar_motion':'final_b'}} for s in utc]
  value={'version':1,'status':'valid','client_request_id':request_id,'group':group,'catalog_number':number,'normalized_gp_sha256':digest,'frame':'ITRF','profile':'WGS72_AFSPC','eop_sha256':'b'*64,'leap_sha256':'c'*64,'eop_kind':'IERS_A','source':'celestrak-cache','fetched_at':START,'stale':False,'warning':'','epoch_utc':START,'name':'external test','count':len(utc),'valid_count':len(utc),'error_count':0,'units':{'position':'m','time':'UTC'},'rows':rows}
  if self.mutate:self.mutate(value,len(self.calls))
  return value

def run(external,**kw):return asyncio.run(NativeMissionCrosslinks(source_query(),external).crosslinks([definition()],EXTERNAL,START,at(180),max_range_km=1000,**kw))

def test_original_earth_segment_clearance_and_zero_length_cases():
 assert line_of_sight_clear([7000,0,0],[7000,100,0]) is True
 assert line_of_sight_clear([7000,0,0],[-7000,0,0]) is False
 assert line_of_sight_clear([7000,0,0],[7000,0,0]) is False
 assert line_of_sight_clear([6478.137,0,0],[6478.137,10,0]) is False


def test_native_external_contacts_refine_edges_and_sample_minimum_range():
 result=run(ExternalQuery());assert len(result['windows'])==1
 item=result['windows'][0];seconds=lambda s:float((parse_utc(s).as_time()-parse_utc(START).as_time()).sec)
 assert abs(seconds(item['start'])-60)<=1 and abs(seconds(item['end'])-120)<=1
 assert item['min_range_km']<=101 and item['external']=='25544'
 assert result['frame']==NODE_FRAME and result['external']['frame']=='ITRF'
 assert result['comparison_frame']=='WGS84_GEODETIC_EARTH_FIXED_APPROX'
 assert result['coverage']['short_intervals_may_be_missed'] is True and result['coverage']['minimum_range_is_sampled'] is True

@pytest.mark.parametrize('mutate',[lambda v,n:v.update(frame='TEME'),lambda v,n:v.update(eop_sha256='d'*64),lambda v,n:v.update(normalized_gp_sha256='e'*64),lambda v,n:v.update(client_request_id='OTHER'),lambda v,n:v.update(status='partial'),lambda v,n:v['rows'][0].update(utc=at(999)),lambda v,n:v['rows'][0].update(position_m=[float('nan'),0,0]),lambda v,n:v['rows'][0].update(error_code='sgp4_failure')])
def test_invalid_required_external_receipt_never_becomes_no_contact(mutate):
 with pytest.raises(RuntimeError):run(ExternalQuery(mutate=mutate))

def test_failed_refinement_or_changed_catalog_provenance_rejects_whole_result():
 def fail(value,count):
  if count>1:value['rows'][0]['status']='error'
 with pytest.raises(RuntimeError):run(ExternalQuery(mutate=fail))
 def change(value,count):
  if count>1:value['fetched_at']=at(1)
 with pytest.raises(RuntimeError):run(ExternalQuery(mutate=change))

def test_blocked_and_full_horizon_geometry_have_distinct_results():
 assert run(ExternalQuery(position=lambda t:[-7000000,0,0]))['windows']==[]
 full=run(ExternalQuery(position=lambda t:[7000000,500000,0]))['windows'][0]
 assert full['in_progress'] is True and full['truncated'] is True and full['min_range_km']==500

@pytest.mark.parametrize('angle',[True,0,-1,float('nan'),float('inf')])
def test_invalid_range_rejects_before_queries(angle):
 class Never:
  async def points(self,*args):pytest.fail('invalid range reached query')
 with pytest.raises(ValueError):asyncio.run(NativeMissionCrosslinks(Never(),Never()).crosslinks([definition()],EXTERNAL,START,at(180),max_range_km=angle))


def test_minimum_range_required_query_failure_is_not_a_successful_contact():
 def fail(value,count):
  if count==2:value['rows'][0]['status']='error'
 with pytest.raises(RuntimeError):run(ExternalQuery(position=lambda t:[7000000,500000,0],mutate=fail))

def test_crosslink_capacity_rejects_without_partial_publication():
 with pytest.raises(ValueError,match='capacity'):
  asyncio.run(NativeMissionCrosslinks(source_query(),ExternalQuery(position=lambda t:[7000000,500000,0]),max_windows=1).crosslinks([definition(),definition('N-2',900002)],EXTERNAL,START,at(180),max_range_km=1000))


GOLDEN=json.loads((Path(__file__).parent/'fixtures/original_mission_crosslinks.json').read_text())
@pytest.mark.parametrize('case',GOLDEN['cases'],ids=lambda c:c['name'])
def test_crosslink_ranges_and_edges_match_original_source_capture(case):
 positions={'parabolic':lambda t:[7000000,100000+(t-90)**2*1000,0],
            'full':lambda t:[7000000,500000,0], 'blocked':lambda t:[-7000000,0,0], 'same':lambda t:[7000000,0,0]}
 actual=run(ExternalQuery(position=positions[case['name']]))['windows'];expected=case['expected']
 assert len(actual)==len(expected)
 for got,want in zip(actual,expected):
  for field in ('start','end'):assert abs(float((parse_utc(got[field]).as_time()-parse_utc(want[field]).as_time()).sec))<=1
  assert got['satellite']==want['satellite'] and got['external']==want['external']
  # A <=1s inside-edge difference also shifts the original minimum-range sample lattice.
  assert abs(got['min_range_km']-want['min_range_km'])<=1

def test_clearance_matches_pinned_original_function_cases():
 for case in GOLDEN['los_cases']:assert line_of_sight_clear(case['a'],case['b']) is case['expected']


def test_exact_nonaligned_end_is_included_in_sampled_minimum_range():
 external=ExternalQuery(position=lambda t:[7000000,1500000-t*1000,0])
 value=asyncio.run(NativeMissionCrosslinks(source_query(),external).crosslinks([definition()],EXTERNAL,START,at(100.75),max_range_km=2000))
 assert value['windows'][0]['min_range_km']==1399
 assert value['windows'][0]['end']==parse_utc(at(100.75)).iso_utc
 assert external.calls[-1][-1]==parse_utc(at(100.75)).iso_utc
