"""Native node decoding: pinned source rows, no Python orbital reimplementation."""
import json
from pathlib import Path
from types import SimpleNamespace
import numpy as np
import pytest
from foundation.orbit_time import parse_utc
from communication.native.node_adapter import prepare_node_definitions,propagate_nodes,node_unix_millis
from digital_twin.contracts.orbit import OrbitUnavailable

FIXTURE=json.loads((Path(__file__).parent/'fixtures/original_satellite_nodes.json').read_text(encoding='utf-8'))
STATE=next(c for c in FIXTURE['cases'] if c['id']=='state:0:0')['expected']
ORBIT=next(c for c in FIXTURE['cases'] if c['id']=='elements:0')['input']['orbit']
def node(**changes):return {'schema':1,'id':'N-1','catalog_number':900001,'orbit':dict(ORBIT),**changes}
def source_row():
 s=STATE
 return [*s['inertial']['r'],*s['inertial']['v'],*s['fixed']['r'],*s['sunDirection'],*s['basis']['x'],*s['basis']['y'],*s['basis']['z'],s['radius'],s['meanAnomaly'],s['trueAnomaly'],s['raan'],s['argp'],s['gmst'],float(s['sunlit']),s['geodetic']['longitude'],s['geodetic']['latitude'],s['geodetic']['altitude']]
def port(callback):return SimpleNamespace(propagate_nodes=callback,node_calculation_profile='SOURCE_KEPLER_J2_V1',node_frame='EARTH_FIXED_GMST_UTC_APPROX',node_inertial_frame='SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',node_time_model='unix_ms_utc_approx',NODE_ROW_WIDTH=31,MAX_NODE_DEFINITIONS=240,MAX_NODE_ROWS=50000,MAX_NODE_SAMPLES=601)
def success(payload,indices,times):return np.asarray([source_row() for _ in indices],dtype='<f8').tobytes(),[None]*len(indices)
def instant(text='2026-10-04T22:01:12Z'):return parse_utc(text)

def test_source_row_layout_tags_owned_positions_and_input_copies():
 raw=node();prepared=prepare_node_definitions([raw]);raw['orbit']['altitude_km']=800
 assert json.loads(prepared[0].orbit_json)['altitude_km']==550
 result=propagate_nodes(prepared,[instant()],native_port=port(success))
 assert result.frame=='EARTH_FIXED_GMST_UTC_APPROX' and result.profile=='SOURCE_KEPLER_J2_V1'
 assert result.inertial_frame=='SOURCE_MEAN_EQUATOR_EQUINOX_APPROX' and result.time_model=='unix_ms_utc_approx'
 assert result.node_ids==('N-1',) and len(result.definition_hashes[0])==64
 assert result.row(0)==tuple(source_row())
 assert result.fixed_position_m(0)==tuple(v*1000 for v in STATE['fixed']['r'])
 with pytest.raises(TypeError):result.row(0)[0]=0

def test_unix_milliseconds_use_gregorian_clock_without_leap_day_stretch():
 for text,expected in [('1970-01-01T00:00:00Z',0),('1969-12-31T23:59:59.750Z',-250),('2016-12-31T23:59:59Z',1483228799000),('2017-01-01T00:00:00Z',1483228800000)]:assert node_unix_millis(text)==expected
 assert node_unix_millis('2026-10-04T22:01:12.000250000Z')==1791151272000.25
 for text in ['2016-12-31T23:59:60Z','2026-02-30T12:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:00:00']:
  with pytest.raises(ValueError):node_unix_millis(text)

def test_leap_rows_and_epochs_never_enter_native_and_keep_alignment():
 calls=[]
 def calculate(payload,indices,times):calls.append((json.loads(payload),indices,times));return success(payload,indices,times)
 raw=node();second=node(id='N-2',catalog_number=900002);second['orbit']['epoch']='2016-12-31T23:59:60Z'
 result=propagate_nodes(prepare_node_definitions([raw,second]),list(map(instant,['2016-12-31T23:59:59Z','2016-12-31T23:59:60Z','2017-01-01T00:00:00Z'])),native_port=port(calculate))
 assert result.errors==(None,'unsupported_node_time',None,'unsupported_node_time','unsupported_node_time','unsupported_node_time')
 assert result.node_ids==('N-1',)*3+('N-2',)*3
 assert calls[0][1]==[0,0] and calls[0][2]==[1483228799000,1483228800000]
 assert result.row(1) is None and result.fixed_position_m(3) is None

@pytest.mark.parametrize('kind',['shape','errors','nonfinite','boolean','unit','height','mutable'])
def test_malformed_native_success_is_rejected(kind):
 def bad(payload,indices,times):
  row=source_row();buf=np.asarray([row],dtype='<f8').tobytes();errors=[None]
  if kind=='shape':buf=buf[:-1]
  if kind=='errors':errors=['']
  if kind=='nonfinite':row[0]=float('nan')
  if kind=='boolean':row[27]=2
  if kind=='unit':row[9]=4
  if kind=='height':row[30]=-1
  if kind not in ['shape','errors']:buf=np.asarray([row],dtype='<f8').tobytes()
  if kind=='mutable':buf=bytearray(buf)
  return buf,errors
 with pytest.raises(RuntimeError):propagate_nodes(prepare_node_definitions([node()]),[instant()],native_port=port(bad))

def test_native_error_rows_remain_hidden_and_other_rows_remain_valid():
 def calculate(payload,indices,times):return np.asarray([source_row(),[float('nan')]*31,source_row()],dtype='<f8').tobytes(),[None,'invalid_node_orbit',None]
 result=propagate_nodes(prepare_node_definitions([node()]),[instant()]*3,native_port=port(calculate))
 assert result.row(0)==result.row(2) and result.row(1) is None

@pytest.mark.parametrize('change',[{'schema':2},{'id':''},{'catalog_number':True},{'catalog_number':900000.5},{'orbit':None}])
def test_prepare_identity_and_definition_checks(change):
 with pytest.raises(ValueError):prepare_node_definitions([node(**change)])

def test_definition_identity_capacity_time_limits_and_profile_are_explicit():
 for values in [[],[node(),node()],[node(),node(id='N-2')],[node(id=f'N-{i}',catalog_number=900001+i) for i in range(241)]]:
  with pytest.raises(ValueError):prepare_node_definitions(values)
 prepared=prepare_node_definitions([node()])
 for times in [[],[instant()]*602,['bad']]:
  with pytest.raises(ValueError):propagate_nodes(prepared,times,native_port=port(success))
 changed=port(success);changed.node_frame='ITRF'
 with pytest.raises(OrbitUnavailable):propagate_nodes(prepared,[instant()],native_port=changed)
 with pytest.raises(OrbitUnavailable):propagate_nodes(prepared,[instant()],native_port=SimpleNamespace())
 many=prepare_node_definitions([node(id=f'N-{i}',catalog_number=900001+i) for i in range(84)])
 with pytest.raises(ValueError):propagate_nodes(many,[instant()]*601,native_port=port(success))

def test_prepared_values_are_validated_before_native_and_hash_changes_track_all_fields():
 from dataclasses import replace
 prepared=prepare_node_definitions([node()])
 for change in [{'definition_hash':None},{'node_id':None},{'definition_hash':'bad'},{'orbit_json':'invalid JSON'},{'epoch_error':'fake'}]:
  with pytest.raises(ValueError):propagate_nodes([replace(prepared[0],**change)],[instant()],native_port=port(success))
 changed=prepare_node_definitions([node(notes='changed')])
 assert prepared[0].definition_hash!=changed[0].definition_hash

def test_every_unsupported_row_is_hidden_without_calling_native():
 def calculate(*args):pytest.fail('unsupported UTC must not enter native')
 prepared=prepare_node_definitions([node()])
 result=propagate_nodes(prepared,[instant('2016-12-31T23:59:60Z')],native_port=port(calculate))
 assert result.errors==('unsupported_node_time',) and result.row(0) is None

def test_corrupt_prepared_orbital_payload_is_rejected_before_native_call():
 from dataclasses import replace
 prepared=prepare_node_definitions([node()])[0]
 def calculate(*args):pytest.fail('invalid prepared orbit must not enter native')
 for payload in ['[]','{}','null','{"epoch":true,"altitude_km":550,"inclination":53,"eccentricity":0,"raan":0,"argp":0,"mean_anomaly":0}']:
  with pytest.raises(ValueError):propagate_nodes([replace(prepared,orbit_json=payload)],[instant()],native_port=port(calculate))

def test_per_node_grids_preserve_order_and_use_one_native_call():
 from communication.native.node_adapter import propagate_node_grids
 calls=[]
 def calculate(payload,indices,times):calls.append((indices,times));return success(payload,indices,times)
 prepared=prepare_node_definitions([node(),node(id='N-2',catalog_number=900002)])
 grids=[[instant('2016-12-31T23:59:59Z'),instant('2016-12-31T23:59:60Z'),instant('2017-01-01T00:00:00Z')],[instant(),instant('2026-10-04T22:01:13Z')]]
 result=propagate_node_grids(prepared,grids,native_port=port(calculate))
 assert result.node_ids==('N-1',)*3+('N-2',)*2
 assert result.errors==(None,'unsupported_node_time',None,None,None)
 assert len(calls)==1 and calls[0][0]==[0,0,1,1]
 assert calls[0][1]==[1483228799000,1483228800000,1791151272000,1791151273000]
 for bad in [[],[[]],[[instant()]],[[instant()]*602,[instant()]],[[instant()],['bad']]]:
  with pytest.raises(ValueError):propagate_node_grids(prepared,bad,native_port=port(calculate))
