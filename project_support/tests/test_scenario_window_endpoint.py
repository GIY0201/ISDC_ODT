"""Actual canonical UTC grid regression, preserving the native strict fence."""
import asyncio
from astropy.time import TimeDelta
from foundation.orbit_time import parse_utc, parse_utc_batch
from user_application.mission_windows import scan_native_intervals, NativeMissionWindows
from user_application.native_passes import NativeMissionPasses
from digital_twin.contracts.orbit import GroundPoint
from project_support.tests.test_node_samples import definition

START = '2026-10-06T17:14:15.520000000Z'
END = '2026-10-06T20:14:15.520000000Z'

class GridReached(Exception): pass

class StrictCapture:
    def __init__(self): self.times = None
    async def points(self, nodes, utc, request_id):
        self.times = utc
        grid = parse_utc_batch(utc)
        assert all((b.jd1-a.jd1)+(b.jd2-a.jd2)>0 for a,b in zip(grid,grid[1:])), utc[-3:]
        raise GridReached

def test_actual_three_hour_astropy_remainder_produces_unique_pass_endpoint():
    capture=StrictCapture()
    try: asyncio.run(NativeMissionPasses(capture).passes([definition()], GroundPoint(36,127,0), START, END))
    except GridReached: pass
    assert len(capture.times)==361
    assert capture.times[-1]==END

def test_actual_three_hour_astropy_remainder_produces_unique_eclipse_endpoint():
    capture=StrictCapture()
    try: asyncio.run(NativeMissionWindows(capture).eclipses([definition()], START, END))
    except GridReached: pass
    assert len(capture.times)==181
    assert capture.times[-1]==END

def test_distinct_nanosecond_final_endpoint_is_preserved_without_tolerance_drop():
    first,last=parse_utc(START),parse_utc('2026-10-06T20:14:15.520000005Z')
    duration=float((last.as_time()-first.as_time()).sec)
    def stamp(offset):
        return last.iso_utc if offset==duration else (first.as_time()+TimeDelta(offset,format='sec')).utc.isot+'Z'
    observed=[]
    async def read(indices,offsets):
        observed.extend(stamp(value) for value in offsets)
        return [[False]*len(offsets)]
    asyncio.run(scan_native_intervals(read,1,duration,60,1,20000,stamp=stamp))
    assert observed[-2:]==[END,last.iso_utc]

def test_passes_preserve_distinct_exact_endpoint_before_interior_millisecond_rounding():
    capture=StrictCapture();end='2026-10-06T20:14:15.520000005Z'
    try: asyncio.run(NativeMissionPasses(capture).passes([definition()], GroundPoint(36,127,0), START, end))
    except GridReached: pass
    assert capture.times[-2:]==[END,end]
