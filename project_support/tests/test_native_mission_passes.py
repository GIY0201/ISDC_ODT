import asyncio
import math
import struct
from dataclasses import replace
import pytest
from foundation.orbit_time import parse_utc
from digital_twin.contracts.orbit import GroundPoint
from digital_twin.contracts.satellite_nodes import NODE_ROW_WIDTH
from user_application.node_geometry import NodeGeometryQuery
from user_application.native_passes import NativeMissionPasses
from digital_twin.simulation.mission_planning.window_geometry import elevation_for_off_nadir
from project_support.tests.test_node_samples import definition,batch
from project_support.tests.test_native_mission_windows import START,at

SITE=GroundPoint(0,0,0)

def query(elevation,*,bad=None):
    def calculate(prepared,grids):
        result=batch(prepared,grids);raw=list(struct.unpack('<'+'d'*(len(result._buffer)//8),result._buffer));errors=list(result.errors);slot=0
        for node,grid in zip(prepared,grids):
            for t in grid:
                seconds=(t.as_time()-parse_utc(START).as_time()).sec
                angle=math.radians(elevation(seconds));radius=1000000
                raw[slot*NODE_ROW_WIDTH+6:slot*NODE_ROW_WIDTH+9]=[(6378137+radius*math.sin(angle))/1000,radius*math.cos(angle)/1000,0]
                if bad and bad(seconds):errors[slot]='invalid_node_orbit'
                slot+=1
        return replace(result,_buffer=struct.pack('<'+'d'*len(raw),*raw),errors=tuple(errors))
    return NodeGeometryQuery(calculate=calculate)


def test_pass_boundaries_peak_and_geometry_metadata_use_native_rows():
    result=asyncio.run(NativeMissionPasses(query(lambda t:20-(t-90)**2/180)).passes([definition()],SITE,START,at(180),mask_degrees=10))
    assert result['status']=='sampled' and len(result['passes'])==1
    item=result['passes'][0];seconds=lambda s:(parse_utc(s).as_time()-parse_utc(START).as_time()).sec
    assert abs(seconds(item['start'])-(90-math.sqrt(1800)))<=1
    assert abs(seconds(item['end'])-(90+math.sqrt(1800)))<=1
    assert abs(seconds(item['peak'])-90)<=0.1
    assert item['max_elevation_deg']==pytest.approx(20)
    assert item['in_progress'] is False and item['truncated'] is False
    assert result['coverage']['short_intervals_may_be_missed'] is True


def test_grazing_peak_between_below_mask_coarse_points_is_retained():
    result=asyncio.run(NativeMissionPasses(query(lambda t:12-(t-45)**2/20)).passes([definition()],SITE,START,at(90),mask_degrees=10))
    assert len(result['passes'])==1
    assert result['passes'][0]['max_elevation_deg']>11.99


def test_start_end_clipping_and_explicit_capacity_have_no_hidden_first_pass_limit():
    result=asyncio.run(NativeMissionPasses(query(lambda t:20)).passes([definition()],SITE,START,at(100),mask_degrees=10))
    item=result['passes'][0];assert item['start']==parse_utc(START).iso_utc and item['end']==parse_utc(at(100)).iso_utc
    assert item['in_progress'] is True and item['truncated'] is True
    with pytest.raises(ValueError,match='capacity'):
        asyncio.run(NativeMissionPasses(query(lambda t:20),max_passes=1).passes([definition(),definition('N-2',900002)],SITE,START,at(100),mask_degrees=10))


def test_required_refinement_error_never_becomes_a_missing_pass():
    q=query(lambda t:20-(t-90)**2/180,bad=lambda t:abs(t/30-round(t/30))>0.001)
    with pytest.raises(RuntimeError,match='native'):
        asyncio.run(NativeMissionPasses(q).passes([definition()],SITE,START,at(180),mask_degrees=10))


@pytest.mark.parametrize('mask',[True,-1,90,float('nan'),float('inf')])
def test_invalid_mask_rejected_without_native(mask):
    class Never:
        async def points(self,*args):pytest.fail('invalid request reached native')
    with pytest.raises(ValueError):asyncio.run(NativeMissionPasses(Never()).passes([definition()],SITE,START,at(180),mask_degrees=mask))


def test_original_off_nadir_mask_and_access_projection_are_preserved():
    assert 55<elevation_for_off_nadir(550,30)<60
    assert elevation_for_off_nadir(550,45)<elevation_for_off_nadir(550,30)
    assert elevation_for_off_nadir(550,70)==0
    result=asyncio.run(NativeMissionPasses(query(lambda t:70)).access([definition()],SITE,START,at(120),off_nadir_degrees=30))
    item=result['passes'][0]
    assert item['minimum_elevation_deg']==pytest.approx(elevation_for_off_nadir(550,30))
    assert item['id'].startswith('access|N-1|')
