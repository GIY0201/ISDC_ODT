import asyncio
import copy
import pytest
from foundation.orbit_time import parse_utc
from user_application.mission_windows import NativeMissionWindows
from user_application.node_geometry import NodeGeometryQuery
from project_support.tests.test_node_samples import definition,batch
from dataclasses import replace
import struct
from digital_twin.contracts.satellite_nodes import NODE_ROW_WIDTH

START='2026-10-04T22:01:12Z'
def at(seconds):
    from astropy.time import TimeDelta
    return (parse_utc(START).as_time()+TimeDelta(seconds,format='sec')).utc.isot+'Z'

def query(predicate,*,bad=None,calls=None):
    def calculate(prepared,grids):
        if calls is not None:calls.append(grids)
        result=batch(prepared,grids);raw=list(struct.unpack('<'+'d'*(len(result._buffer)//8),result._buffer));errors=list(result.errors)
        offset=0
        for node,grid in zip(prepared,grids):
            for t in grid:
                seconds=(t.as_time()-parse_utc(START).as_time()).sec
                raw[offset*NODE_ROW_WIDTH+27]=float(not predicate(node.node_id,seconds))
                if bad and bad(seconds):errors[offset]='invalid_node_orbit'
                offset+=1
        return replace(result,_buffer=struct.pack('<'+'d'*len(raw),*raw),errors=tuple(errors))
    return NodeGeometryQuery(calculate=calculate)

def test_native_eclipse_windows_refine_inside_edges_and_include_nonaligned_end():
    calls=[];q=query(lambda n,t:10<=t<70 or t>=95,calls=calls)
    result=asyncio.run(NativeMissionWindows(q).eclipses([definition()],START,at(100),step_seconds=30))
    windows=result['windows'];assert len(windows)==2
    seconds=lambda s:(parse_utc(s).as_time()-parse_utc(START).as_time()).sec
    assert abs(seconds(windows[0]['start'])-10)<=1 and abs(seconds(windows[0]['end'])-70)<=1
    assert abs(seconds(windows[1]['start'])-95)<=1 and seconds(windows[1]['end'])==pytest.approx(100)
    assert windows[1]['truncated'] is True
    assert result['coverage']['end_utc']==parse_utc(at(100)).iso_utc
    assert result['coverage']['resolution_seconds']==30
    assert result['coverage']['short_intervals_may_be_missed'] is True
    assert any(t.iso_utc==parse_utc(at(100)).iso_utc for call in calls for grid in call for t in grid)

def test_empty_eclipse_full_eclipse_and_two_node_identity_are_distinct():
    q=query(lambda n,t:n=='N-2')
    result=asyncio.run(NativeMissionWindows(q).eclipses([definition(),definition('N-2',900002)],START,at(120)))
    assert result['windows']==[{'id':'eclipse|N-2|'+parse_utc(START).iso_utc,'satellite':'N-2','start':parse_utc(START).iso_utc,'end':parse_utc(at(120)).iso_utc,'in_progress':True,'truncated':True}]
    assert set(result['definition_hashes'])=={'N-1','N-2'}

@pytest.mark.parametrize('bad',[lambda t:abs(t-60)<0.01,lambda t:abs(t-15)<0.01])
def test_native_error_during_coarse_or_refinement_never_becomes_empty_success(bad):
    q=query(lambda n,t:10<=t<70,bad=bad)
    with pytest.raises(RuntimeError,match='native'):
        asyncio.run(NativeMissionWindows(q).eclipses([definition()],START,at(120)))

@pytest.mark.parametrize('seconds,step',[(0,60),(-1,60),(86401,60),(60,0),(60,True),(60,61)])
def test_unsupported_coverage_rejected_before_native(seconds,step):
    class Never:
        async def points(self,*args):pytest.fail('bad coverage reached native')
    with pytest.raises(ValueError):asyncio.run(NativeMissionWindows(Never()).eclipses([definition()],START,at(seconds),step_seconds=step))

def test_window_capacity_is_explicit_failure_and_cancel_is_propagated():
    with pytest.raises(ValueError,match='capacity'):
        asyncio.run(NativeMissionWindows(query(lambda n,t:10<=t<70 or t>=95),max_windows=1).eclipses([definition()],START,at(120),step_seconds=30))
    class Cancel:
        async def points(self,*args):raise asyncio.CancelledError()
    with pytest.raises(asyncio.CancelledError):asyncio.run(NativeMissionWindows(Cancel()).eclipses([definition()],START,at(120)))


def test_unsampled_short_gap_is_disclosed_instead_of_claiming_exhaustive_coverage():
    q=query(lambda n,t:10<=t<70 or t>=95)
    result=asyncio.run(NativeMissionWindows(q).eclipses([definition()],START,at(100),step_seconds=60))
    assert len(result['windows'])==1
    assert result['status']=='sampled' and result['coverage']['short_intervals_may_be_missed'] is True


def test_captured_original_interval_scan_matches_native_predicate_boundaries():
    from pathlib import Path
    import json
    fixture=json.loads((Path(__file__).parent/'fixtures/original_mission_interval_scan.json').read_text(encoding='utf-8'))
    for case in fixture['cases']:
        q=query(lambda n,t:any(a<=t<b for a,b in case['ranges']))
        result=asyncio.run(NativeMissionWindows(q).eclipses([definition()],START,at(case['end']),step_seconds=case['step']))
        assert len(result['windows'])==len(case['expected'])
        for actual,expected in zip(result['windows'],case['expected']):
            for field in ['start','end']:
                seconds=(parse_utc(actual[field]).as_time()-parse_utc(START).as_time()).sec
                assert abs(seconds-expected[field]/1000)<=1
            assert actual['truncated']==expected.get('truncated',False)


@pytest.mark.parametrize('change',['request','profile','hash','utc','sunlit'])
def test_untrusted_point_port_receipt_is_rejected_before_result_publication(change):
    underlying=query(lambda n,t:True)
    class Untrusted:
        async def points(self,*args):
            result=await underlying.points(*args)
            if change=='request':result['request_id']='other'
            if change=='profile':result['model_profile']='other'
            if change=='hash':result['nodes'][0]['definition_hash']='a'*64
            if change=='utc':result['nodes'][0]['rows'][0]['utc']=at(1)
            if change=='sunlit':result['nodes'][0]['rows'][0]['sunlit']=0
            return result
    with pytest.raises(RuntimeError,match='native'):
        asyncio.run(NativeMissionWindows(Untrusted()).eclipses([definition()],START,at(120)))
