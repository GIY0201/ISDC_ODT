"""Single selection/UTC owner; immutable calculation snapshots, injected execution."""
import asyncio
import math
import time
from foundation.orbit_time import parse_utc,advance_seconds
from digital_twin.contracts.orbit import OrbitSelection,OrbitSnapshot,OrbitQueryResult,OrbitCalculation,OrbitSample,GroundPoint,OrbitConflict,OrbitUnavailable,OrbitVisibilityQueryResult


def _integer(value,minimum):
    if type(value) is not int or value<minimum:raise ValueError('invalid integer')

def _real(value):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError('finite number required')

def _request_id(value):
    if not isinstance(value,str) or not value.strip() or len(value)>128:raise ValueError('invalid client_request_id')

class OrbitRuntime:
    def __init__(self,*,lookup_input,calculate=None,execute=None,monotonic=time.monotonic,ground_point=None,minimum_elevation_deg=10.,max_samples=3601):
        _integer(max_samples,1)
        self._lookup_input=lookup_input;self._calculate=calculate;self._execute=execute;self._monotonic=monotonic;self._max_samples=max_samples
        self._lock=asyncio.Lock()
        self._selection=OrbitSelection(0,None,ground_point or GroundPoint(0,0,0),minimum_elevation_deg,None,0.,False,1.,'initial')
    def snapshot(self):
        selection=self._selection;now=self._monotonic()
        _real(now)
        current=selection.anchor_utc
        if current is not None and selection.playing:
            seconds=max(0.,now-selection.anchor_monotonic_s)*selection.play_rate
            current=advance_seconds(parse_utc(current),seconds).iso_utc
        return OrbitSnapshot(selection,current,now)
    async def select(self,*,client_request_id,expected_revision,input_id,ground_point,minimum_elevation_deg,anchor_utc,playing,play_rate):
        _request_id(client_request_id);_integer(expected_revision,0);_real(minimum_elevation_deg);_real(play_rate)
        if not isinstance(ground_point,GroundPoint) or type(playing) is not bool or not 0<=minimum_elevation_deg<=90 or not .1<=play_rate<=60:raise ValueError('invalid orbit selection')
        if not isinstance(input_id,str) or self._lookup_input(input_id) is None:raise ValueError('orbit input not found')
        utc=parse_utc(anchor_utc).iso_utc
        async with self._lock:
            if expected_revision!=self._selection.revision:raise OrbitConflict('orbit revision conflict')
            now=self._monotonic();_real(now)
            self._selection=OrbitSelection(expected_revision+1,input_id,ground_point,float(minimum_elevation_deg),utc,now,playing,float(play_rate),client_request_id)
            return self.snapshot()
    async def control(self,action,*,expected_revision,client_request_id):
        if action not in ('play','pause'):raise ValueError('invalid orbit control')
        snapshot=self.snapshot();selection=snapshot.selection
        if selection.input_id is None:raise ValueError('orbit input not selected')
        return await self.select(client_request_id=client_request_id,expected_revision=expected_revision,input_id=selection.input_id,ground_point=selection.ground_point,minimum_elevation_deg=selection.minimum_elevation_deg,anchor_utc=snapshot.current_utc,playing=action=='play',play_rate=selection.play_rate)
    async def samples(self,*,client_request_id,selection_revision,input_id,start_utc,step_seconds,count):
        _request_id(client_request_id);_integer(selection_revision,0);_integer(count,1);_real(step_seconds)
        if count>self._max_samples or step_seconds<=0 or not math.isfinite((count-1)*step_seconds):raise ValueError('invalid orbit sample range')
        start=parse_utc(start_utc)
        async with self._lock:
            selection=self._selection
            if selection_revision!=selection.revision or input_id!=selection.input_id:raise OrbitConflict('orbit query context conflict')
            orbit=self._lookup_input(input_id)
            if orbit is None:raise ValueError('orbit input not found')
        if self._calculate is None or self._execute is None:raise OrbitUnavailable('orbit calculation/EOP not ready')
        def work():
            times=tuple(advance_seconds(start,i*step_seconds).iso_utc for i in range(count))
            return times,self._calculate(orbit,times,selection.ground_point)
        times,calculation=await self._execute(work)
        if not isinstance(calculation,OrbitCalculation) or type(calculation.rows) is not tuple or len(calculation.rows)!=count or calculation.frame!='ITRF' or calculation.profile!=orbit.profile:raise RuntimeError('invalid orbit calculation contract')
        for utc,row in zip(times,calculation.rows):
            if not isinstance(row,OrbitSample) or row.position_m is not None and type(row.position_m) is not tuple:raise RuntimeError('invalid orbit calculation contract')
            if row.utc!=utc:raise RuntimeError('orbit calculation UTC mismatch')
            if row.error_code is None:
                if row.position_m is None or len(row.position_m)!=3 or row.elevation_deg is None or not all(math.isfinite(value) for value in (*row.position_m,row.elevation_deg)):raise RuntimeError('invalid orbit success row')
            elif row.position_m is not None or row.elevation_deg is not None:raise RuntimeError('orbit error row has numeric values')
        async with self._lock:
            stale=selection.revision!=self._selection.revision
        return OrbitQueryResult(client_request_id,selection.revision,input_id,orbit.raw_sha256,calculation.rows,calculation.eop_sha256,calculation.leap_sha256,stale,calculation.frame,calculation.profile)

    async def visibility(self,*,client_request_id,selection_revision,input_id,start_utc,end_utc,ground_point,minimum_elevation_deg):
        from digital_twin.simulation.visibility import search_visibility
        _request_id(client_request_id);_integer(selection_revision,0);_real(minimum_elevation_deg)
        if not isinstance(ground_point,GroundPoint) or not 0<=minimum_elevation_deg<=90:
            raise ValueError('invalid visibility selection')
        start,end=parse_utc(start_utc),parse_utc(end_utc)
        elapsed=float((end.as_time().tai-start.as_time().tai).sec)
        if not 0<elapsed<=86400+1e-8:raise ValueError('visibility range must be >0 and <=24h SI')
        async with self._lock:
            selection=self._selection
            if (selection_revision!=selection.revision or input_id!=selection.input_id or
                    ground_point!=selection.ground_point or minimum_elevation_deg!=selection.minimum_elevation_deg):
                raise OrbitConflict('orbit visibility context conflict')
            orbit=self._lookup_input(input_id)
            if orbit is None:raise ValueError('orbit input not found')
        if self._calculate is None or self._execute is None:
            raise OrbitUnavailable('orbit calculation/EOP not ready')
        def work():
            return search_visibility(calculate=lambda times:self._calculate(orbit,times,selection.ground_point),
                start_utc=start.iso_utc,end_utc=end.iso_utc,minimum_elevation_deg=selection.minimum_elevation_deg)
        calculation=await self._execute(work)
        if calculation.profile!=orbit.profile:raise RuntimeError('visibility input profile mismatch')
        async with self._lock:
            stale=selection.revision!=self._selection.revision
        return OrbitVisibilityQueryResult(client_request_id,selection.revision,input_id,orbit.raw_sha256,
                                           selection.ground_point,calculation,stale)
