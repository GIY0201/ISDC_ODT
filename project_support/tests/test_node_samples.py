"""Source static period and Date TimeClip track preparation, no propagation."""
import json
import math
from pathlib import Path
import pytest
import asyncio
from dataclasses import replace
from digital_twin.contracts.satellite_nodes import NativeNodeBatch, NODE_ROW_WIDTH
from foundation.orbit_time import format_utc_batch
from user_application.node_geometry import NodeGeometryQuery
from digital_twin.simulation.node_geometry import node_period_minutes,node_track_grid
from communication.native.node_adapter import node_unix_millis
from foundation.orbit_time import parse_utc

FIXTURE=json.loads((Path(__file__).parent/'fixtures/original_satellite_nodes.json').read_text(encoding='utf-8'))


def test_source_oisl_inputs_are_existing_native_vectors_and_null_on_error():
 import struct
 cases=[case for case in FIXTURE['cases'] if case['id'].startswith('state:')]
 assert len(cases)==20
 for case in cases:
  source=case['expected']
  def calculate(prepared,grids):
   value=batch(prepared,grids);row=[0.0]*NODE_ROW_WIDTH;row[27]=1
   row[0:3]=source['inertial']['r'];row[3:6]=source['inertial']['v']
   row[12:15]=source['basis']['x'];row[15:18]=source['basis']['y'];row[18:21]=source['basis']['z']
   return replace(value,_buffer=struct.pack('<'+'d'*NODE_ROW_WIDTH*len(value.utc),*(row*len(value.utc))))
  query=NodeGeometryQuery(calculate=calculate)
  result=asyncio.run(query.samples([definition()],'2026-10-04T22:01:12Z',1,1,'optical'))
  row=result['nodes'][0]['rows'][0]
  assert row['inertial_position_km']==source['inertial']['r'] and row['lvlh_basis']==source['basis']
  row['lvlh_basis']['x'][0]=999;row['inertial_position_km'][0]=999
  again=asyncio.run(query.track([definition()],'2026-10-04T22:01:12Z','optical-track'))
  assert again['nodes'][0]['rows'][0]['lvlh_basis']==source['basis']
  assert again['nodes'][0]['rows'][0]['inertial_position_km']==source['inertial']['r']
 result=asyncio.run(NodeGeometryQuery(calculate=batch).samples([definition()],'2016-12-31T23:59:59Z',3,1,'leap'))
 error=result['nodes'][0]['rows'][1]
 assert error['inertial_position_km'] is None and error['lvlh_basis'] is None


def test_python_native_communication_fields_reach_actual_browser_buffer(tmp_path):
 import struct
 import subprocess
 source=next(case['expected'] for case in FIXTURE['cases'] if case['id'].startswith('state:'))
 def calculate(prepared,grids):
  result=batch(prepared,grids);row=[0.0]*NODE_ROW_WIDTH
  row[0:3]=source['inertial']['r'];row[3:6]=source['inertial']['v'];row[6:9]=source['fixed']['r']
  row[12:15]=source['basis']['x'];row[15:18]=source['basis']['y'];row[18:21]=source['basis']['z'];row[27]=1
  return replace(result,_buffer=struct.pack('<'+'d'*NODE_ROW_WIDTH,*row))
 nodes=[definition()];request={'request_id':'ipc-optical','nodes':nodes,'start_utc':'2026-10-04T22:01:12.000000000Z','count':1,'step_seconds':1}
 response=asyncio.run(NodeGeometryQuery(calculate=calculate).samples(nodes,request['start_utc'],1,1,request['request_id']))
 payload=tmp_path/'communication.json';payload.write_text(json.dumps({'request':request,'response':response,'expected':source}),encoding='utf-8')
 script="""
 import {readFileSync} from 'node:fs';
 import assert from 'node:assert/strict';
 import {createNodeSampleBuffer} from './user_application/web/scripts/nodes/node_timeline.js';
 const f=JSON.parse(readFileSync(process.argv[1],'utf8'));
 const state=createNodeSampleBuffer(f.request,f.response).communicationStateFor(f.request.nodes[0],{utc:f.request.start_utc});
 assert.deepEqual(state.inertial,f.expected.inertial);assert.deepEqual(state.basis,f.expected.basis);
 assert.equal(state.interpolated,false);assert.equal(state.quality,'engineering_assumption');
 """
 result=subprocess.run(['node','--input-type=module','-e',script,str(payload)],cwd=Path(__file__).resolve().parents[2],capture_output=True,text=True,timeout=30)
 assert result.returncode==0,result.stdout+result.stderr

def test_original_static_period_and_invalid_domains():
 count=0
 for case in FIXTURE['cases']:
  if case['id'].startswith('elements:'):
   expected=math.floor(case['expected']['period']/60*1000+0.5)/1000
   assert node_period_minutes(case['input']['orbit'])==expected;count+=1
  if case['id'].startswith('invalid-orbit:'):
   with pytest.raises(ValueError):node_period_minutes(case['input']['orbit'])
 assert count==4

def test_121_vertices_follow_source_rounded_period_and_integer_millisecond_timeclip():
 center='2026-10-04T22:01:12.000250000Z'
 case=next(c for c in FIXTURE['cases'] if c['id']=='elements:0')
 period=node_period_minutes(case['input']['orbit']);grid=node_track_grid(center,period)
 assert len(grid)==121
 base=node_unix_millis(center);step=period*60000/120
 assert [node_unix_millis(t.iso_utc) for t in grid]==[math.trunc(base+(i-60)*step) for i in range(121)]
 assert grid[60].iso_utc=='2026-10-04T22:01:12.000000000Z'
 assert all(isinstance(t,type(parse_utc(center))) for t in grid)

@pytest.mark.parametrize('period',[0,-1,float('inf'),float('nan'),True])
def test_bad_track_period_is_not_a_fallback_circle(period):
 with pytest.raises(ValueError):node_track_grid('2026-10-04T22:01:12Z',period)

def test_leap_track_center_is_explicitly_unsupported():
 with pytest.raises(ValueError,match='unsupported_node_time'):node_track_grid('2016-12-31T23:59:60Z',95.65)

def test_browser_decoder_accepts_python_track_receipts_with_source_periods(tmp_path):
 """Real Python grid/query and real JS decoder; injected native rows, no live/GPU claim."""
 import subprocess
 root=Path(__file__).resolve().parents[2]
 nodes=[definition('N-'+str(i),900001+i,altitude) for i,altitude in enumerate([550,800,35786])]
 center='2026-10-04T22:01:12.000900000Z'
 result=asyncio.run(NodeGeometryQuery(calculate=batch).track(nodes,center,'cross-language'))
 payload={'request':{'request_id':'cross-language','nodes':nodes,'center_utc':center},'response':result}
 path=tmp_path/'tracks.json';path.write_text(json.dumps(payload),encoding='utf-8')
 script="""
 import {readFileSync} from 'node:fs';
 import assert from 'node:assert/strict';
 import {createNodeTrackBuffer} from './user_application/web/scripts/nodes/node_timeline.js';
 import {catalogElements} from './digital_twin/simulation/browser/node_orbit_definition.js';
 const f=JSON.parse(readFileSync(process.argv[1],'utf8'));
 const buffer=createNodeTrackBuffer(f.request,f.response,{periodFor:n=>catalogElements(n.orbit).PERIOD_MINUTES});
 for(const node of f.request.nodes){const path=buffer.pathFor(node);assert.equal(path.visible,true);assert.equal(path.positions_m.length,121);assert.deepEqual(path.positions_m[120],[1000,2000,3000]);}
 """
 value=subprocess.run(['node','--input-type=module','-e',script,str(path)],cwd=root,capture_output=True,text=True,timeout=30)
 assert value.returncode==0,value.stdout+value.stderr

def definition(identity='N-1',catalog=900001,altitude=550):
 orbit=dict(next(c for c in FIXTURE['cases'] if c['id']=='elements:0')['input']['orbit']);orbit['altitude_km']=altitude
 return {'schema':1,'id':identity,'catalog_number':catalog,'orbit':orbit}

def batch(prepared,grids):
 import struct
 ids=[];hashes=[];utc=[];errors=[];rows=[]
 for item,grid in zip(prepared,grids):
  for stamp in format_utc_batch(grid):
   ids.append(item.node_id);hashes.append(item.definition_hash);utc.append(stamp)
   errors.append('unsupported_node_time' if ':60.' in stamp else None)
   row=[0.0]*NODE_ROW_WIDTH;row[6:9]=[1,2,3];row[3:6]=[4,5,6];row[27]=1
   rows.extend(row)
 return NativeNodeBatch(tuple(ids),tuple(hashes),tuple(utc),tuple(errors),struct.pack('<'+'d'*len(rows),*rows))

def test_query_si_grid_leap_errors_units_and_no_input_mutation():
 nodes=[definition()];original=json.dumps(nodes);calls=[]
 def calculate(prepared,grids):calls.append(grids);return batch(prepared,grids)
 result=asyncio.run(NodeGeometryQuery(calculate=calculate).samples(nodes,'2016-12-31T23:59:59Z',3,1,'request-1'))
 assert json.dumps(nodes)==original and len(calls)==1
 assert result['request_id']=='request-1' and result['quality']=='engineering_assumption'
 rows=result['nodes'][0]['rows']
 assert [r['status'] for r in rows]==['valid','error','valid']
 assert rows[0]['position_m']==[1000,2000,3000] and rows[0]['inertial_velocity_km_s']==[4,5,6]
 assert rows[1]['position_m'] is None and rows[1]['sunlit'] is None and rows[1]['error_code']=='unsupported_node_time'
 rows[0]['position_m'][0]=99
 assert asyncio.run(NodeGeometryQuery(calculate=calculate).samples(nodes,'2016-12-31T23:59:59Z',1,1,'request-2'))['nodes'][0]['rows'][0]['position_m'][0]==1000

def test_query_tracks_have_independent_source_periods_and_hide_entire_failed_path():
 calls=[]
 def calculate(prepared,grids):
  calls.append(grids);value=batch(prepared,grids);errors=list(value.errors);errors[125]='invalid_node_orbit'
  return replace(value,errors=tuple(errors))
 result=asyncio.run(NodeGeometryQuery(calculate=calculate).track([definition(),definition('N-2',900002,800)],'2026-10-04T22:01:12Z','track-1'))
 assert len(calls)==1 and calls[0][0][0]!=calls[0][1][0]
 assert all(len(n['rows'])==121 for n in result['nodes'])
 assert [n['path_visible'] for n in result['nodes']]==[True,False]
 assert result['status']=='partial'

@pytest.mark.parametrize('change', ['frame','hash','utc','ids','length','buffer','profile','time','inertial','error','nan'])
def test_query_rejects_misaligned_injected_results(change):
 def calculate(prepared,grids):
  result=batch(prepared,grids)
  if change=='frame':return replace(result,frame='ITRF')
  if change=='hash':return replace(result,definition_hashes=('0'*64,))
  if change=='utc':return replace(result,utc=('2000-01-01T00:00:00Z',))
  if change=='ids':return replace(result,node_ids=('N-other',))
  if change=='length':return replace(result,errors=())
  if change=='profile':return replace(result,profile='other')
  if change=='time':return replace(result,time_model='UT1')
  if change=='inertial':return replace(result,inertial_frame='TEME')
  if change=='error':return replace(result,errors=('',))
  if change=='nan':
   import struct
   return replace(result,_buffer=struct.pack('<d',float('nan'))+result._buffer[8:])
  return replace(result,_buffer=b'')
 with pytest.raises(RuntimeError):asyncio.run(NodeGeometryQuery(calculate=calculate).samples([definition()],'2026-10-04T22:01:12Z',1,1,'request'))

@pytest.mark.parametrize('count,step,request_id', [(0,1,'r'),(602,1,'r'),(True,1,'r'),(1,2,'r'),(1,True,'r'),(1,1,''),(1,1,'x'*129)])
def test_query_rejects_invalid_requests_before_calculation(count,step,request_id):
 def forbidden(*args):raise AssertionError('native should not run')
 with pytest.raises(ValueError):asyncio.run(NodeGeometryQuery(calculate=forbidden).samples([definition()],'2026-10-04T22:01:12Z',count,step,request_id))

def test_query_snapshots_definitions_before_executor_yields():
 nodes=[definition()];observed=[]
 async def execute(calculate):
  nodes[0]['orbit']['altitude_km']=800
  await asyncio.sleep(0)
  return calculate()
 def calculate(prepared,grids):
  observed.append(json.loads(prepared[0].orbit_json)['altitude_km']);return batch(prepared,grids)
 result=asyncio.run(NodeGeometryQuery(calculate=calculate,execute=execute).track(nodes,'2026-10-04T22:01:12Z','copied'))
 assert observed==[550] and result['nodes'][0]['period_minutes']==node_period_minutes(definition()['orbit'])

def test_query_row_cap_rejects_full_240_by_601_without_truncation():
 def forbidden(*args):raise AssertionError('native should not run')
 nodes=[definition(f'N-{i}',900000+i) for i in range(240)]
 with pytest.raises(ValueError,match='limits'):asyncio.run(NodeGeometryQuery(calculate=forbidden).samples(nodes,'2026-10-04T22:01:12Z',601,1,'large'))

def test_query_track_leap_center_fails_before_native():
 def forbidden(*args):raise AssertionError('native should not run')
 with pytest.raises(ValueError,match='unsupported_node_time'):asyncio.run(NodeGeometryQuery(calculate=forbidden).track([definition()],'2016-12-31T23:59:60Z','leap'))



def test_original_live_angles_are_named_native_degrees_and_null_on_error():
 import struct
 cases=[case for case in FIXTURE['cases'] if case['id'].startswith('state:')]
 assert len(cases)==20
 for case in cases:
  original=case['expected']
  def calculate(prepared,grids):
   value=batch(prepared,grids);row=[0.0]*NODE_ROW_WIDTH
   row[22]=original['meanAnomaly'];row[24]=original['raan'];row[25]=original['argp'];row[27]=1
   return replace(value,_buffer=struct.pack('<'+'d'*NODE_ROW_WIDTH*len(value.utc),*(row*len(value.utc))))
  nodes=[definition()];before=json.dumps(nodes)
  query=NodeGeometryQuery(calculate=calculate)
  result=asyncio.run(query.samples(nodes,'2016-12-31T23:59:59Z',3,1,'angles'))
  rows=result['nodes'][0]['rows']
  assert rows[0].get('mean_anomaly_deg')==original['meanAnomaly']
  assert rows[0].get('raan_deg')==original['raan']
  assert rows[0].get('argp_deg')==original['argp']
  for key in ['mean_anomaly_deg','raan_deg','argp_deg']:
   assert key in rows[1] and rows[1][key] is None
  rows[0]['raan_deg']=-1
  fresh=asyncio.run(query.track(nodes,'2026-10-04T22:01:12Z','angles-track'))
  assert fresh['nodes'][0]['rows'][0]['raan_deg']==original['raan']
  assert json.dumps(nodes)==before
