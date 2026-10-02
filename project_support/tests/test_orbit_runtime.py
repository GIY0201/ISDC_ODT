import asyncio
from dataclasses import FrozenInstanceError
from threading import Event
import pytest
from digital_twin.contracts.orbit import OrbitInput,OrbitSample,OrbitCalculation
from digital_twin.runtime.orbit import OrbitRuntime,OrbitConflict,OrbitUnavailable
from digital_twin.simulation.orbit_geometry import GroundPoint
from communication.native.orbit_execution import BoundedOrbitExecutor,OrbitBusy

UTC='2020-07-12T21:16:01.000416Z'
INPUT=OrbitInput('iss:test',25544,'TLE','test','historical',UTC,UTC,'WGS72_AFSPC',('line1','line2'),(),())

def select(runtime,revision=0,**changes):
    arguments=dict(client_request_id='select',expected_revision=revision,input_id=INPUT.input_id,ground_point=GroundPoint(33.4996,126.5312,0),minimum_elevation_deg=10.,anchor_utc=UTC,playing=False,play_rate=1.)
    return runtime.select(**(arguments|changes))

def test_clock_pause_revision_and_immutable_snapshot():
    async def scenario():
        clock=[100.]
        runtime=OrbitRuntime(lookup_input=lambda key:INPUT if key==INPUT.input_id else None,monotonic=lambda:clock[0])
        assert runtime.snapshot().selection.input_id is None
        snap=await select(runtime,playing=True,play_rate=2.)
        clock[0]+=3
        assert runtime.snapshot().current_utc=='2020-07-12T21:16:07.000416000Z'
        paused=await runtime.control('pause',expected_revision=1,client_request_id='pause')
        clock[0]+=100
        assert runtime.snapshot().current_utc==paused.current_utc
        with pytest.raises(FrozenInstanceError):snap.selection.playing=False
        with pytest.raises(OrbitConflict):await select(runtime,revision=0)
        assert runtime.snapshot().selection.revision==2
        await runtime.control('play',expected_revision=2,client_request_id='play')
        clock[0]+=1
        assert runtime.snapshot().current_utc=='2020-07-12T21:16:09.000416000Z'
    asyncio.run(scenario())

@pytest.mark.parametrize('change',[{'play_rate':float('nan')},{'play_rate':61},{'playing':1},{'minimum_elevation_deg':-1},{'anchor_utc':'2020-01-01'},{'expected_revision':True}])
def test_invalid_selection_is_atomic(change):
    async def scenario():
        runtime=OrbitRuntime(lookup_input=lambda _:INPUT)
        with pytest.raises(ValueError):await select(runtime,**change)
        assert runtime.snapshot().selection.revision==0
    asyncio.run(scenario())

def test_sim_independence_and_composition():
    from user_application.web.application import create_app
    async def scenario():
        app=create_app(orbit_inputs=(INPUT,))
        state=app.state.runtime
        await select(state.orbit)
        before=state.orbit.snapshot()
        await state.control('reset')
        assert state.elapsed_seconds==0 and state.orbit.snapshot().selection==before.selection
        await select(state.orbit,revision=1,anchor_utc='2020-07-13T00:00:00Z')
        assert state.elapsed_seconds==0
        with pytest.raises(OrbitUnavailable):await state.orbit.samples(client_request_id='calc',selection_revision=2,input_id=INPUT.input_id,start_utc=UTC,step_seconds=1,count=1)
        await app.state.orbit_executor.close()
    asyncio.run(scenario())

def test_concurrent_selection_conflicts():
    async def scenario():
        runtime=OrbitRuntime(lookup_input=lambda _:INPUT)
        results=await asyncio.gather(select(runtime),select(runtime),return_exceptions=True)
        assert sum(isinstance(item,OrbitConflict) for item in results)==1
        assert runtime.snapshot().selection.revision==1
    asyncio.run(scenario())

def test_bounded_executor_stale_result_and_event_loop_response():
    async def scenario():
        entered,release=Event(),Event()
        executor=BoundedOrbitExecutor(workers=1,waiting_requests=0)
        def calculate(orbit,times,site):
            entered.set();assert release.wait(3)
            return OrbitCalculation(tuple(OrbitSample(t,(1.,2.,3.),10.,None) for t in times),"eop","leap")
        runtime=OrbitRuntime(lookup_input=lambda _:INPUT,calculate=calculate,execute=executor.run)
        task=None
        try:
            await select(runtime)
            task=asyncio.create_task(runtime.samples(client_request_id='old',selection_revision=1,input_id=INPUT.input_id,start_utc=UTC,step_seconds=1,count=2))
            assert await asyncio.to_thread(entered.wait,2)
            with pytest.raises(OrbitBusy):await runtime.samples(client_request_id='full',selection_revision=1,input_id=INPUT.input_id,start_utc=UTC,step_seconds=1,count=1)
            await asyncio.wait_for(select(runtime,revision=1,anchor_utc='2020-07-13T00:00:00Z'),.5)
            release.set();result=await task
            assert result.stale and result.revision==1 and result.client_request_id=='old'
            assert result.rows[0].utc==UTC.replace('Z','000Z')
            assert runtime.snapshot().selection.revision==2
            assert runtime.snapshot().current_utc=='2020-07-13T00:00:00.000000000Z'
            with pytest.raises(FrozenInstanceError):result.rows[0].elevation_deg=0
        finally:
            release.set()
            if task is not None:await asyncio.gather(task,return_exceptions=True)
            await executor.close()
    asyncio.run(scenario())

def test_cancel_running_does_not_free_capacity_early():
    async def scenario():
        entered,release=Event(),Event();executor=BoundedOrbitExecutor(workers=1,waiting_requests=0)
        def work():entered.set();release.wait(3);return 7
        task=asyncio.create_task(executor.run(work))
        try:
            assert await asyncio.to_thread(entered.wait,2)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):await task
            with pytest.raises(OrbitBusy):await executor.run(lambda:8)
            release.set()
        finally:
            release.set();await executor.close()
    asyncio.run(scenario())

def test_query_limits_errors_and_selection_not_mutated():
    async def scenario():
        executor=BoundedOrbitExecutor(workers=1,waiting_requests=1)
        def fail(*args):raise ValueError('eop_out_of_range')
        runtime=OrbitRuntime(lookup_input=lambda _:INPUT,calculate=fail,execute=executor.run)
        await select(runtime);before=runtime.snapshot().selection
        try:
            for change in [{'count':3602},{'count':True},{'step_seconds':0},{'step_seconds':float('inf')}]:
                args=dict(client_request_id='q',selection_revision=1,input_id=INPUT.input_id,start_utc=UTC,step_seconds=1,count=1)
                with pytest.raises(ValueError):await runtime.samples(**(args|change))
            with pytest.raises(OrbitConflict):await runtime.samples(client_request_id='q',selection_revision=0,input_id=INPUT.input_id,start_utc=UTC,step_seconds=1,count=1)
            with pytest.raises(ValueError,match='eop_out_of_range'):await runtime.samples(client_request_id='q',selection_revision=1,input_id=INPUT.input_id,start_utc=UTC,step_seconds=1,count=1)
            assert runtime.snapshot().selection==before
        finally:await executor.close()
    asyncio.run(scenario())

def test_waiting_queue_bound_and_exception_recovery():
    async def scenario():
        entered,release=Event(),Event();executor=BoundedOrbitExecutor(workers=1,waiting_requests=1)
        def blocking():entered.set();assert release.wait(3);return 'first'
        first=asyncio.create_task(executor.run(blocking));second=None
        try:
            assert await asyncio.to_thread(entered.wait,2)
            second=asyncio.create_task(executor.run(lambda:'second'))
            await asyncio.sleep(0)
            with pytest.raises(OrbitBusy):await executor.run(lambda:'excess')
            release.set()
            assert await first=='first' and await second=='second'
            def fail():raise ValueError('calculation failed')
            with pytest.raises(ValueError,match='calculation failed'):await executor.run(fail)
            assert await executor.run(lambda:'recovered')=='recovered'
        finally:
            release.set()
            await asyncio.gather(*(task for task in [first,second] if task is not None),return_exceptions=True)
            await executor.close()
        with pytest.raises(OrbitBusy):await executor.run(lambda:None)
    asyncio.run(scenario())

def test_product_application_calculation_chain(tmp_path):
    import hashlib
    import astropy_iers_data
    from data.orbit_inputs import load_orbit_input
    from data.earth_orientation import EarthOrientationSnapshot
    from user_application.web.application import create_app
    raw=('1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992\n'
         '2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008').encode()
    path=tmp_path/'iss.tle';path.write_bytes(raw)
    orbit=load_orbit_input(path,format='TLE',source='historical fixture',fetched_utc='2026-10-02T00:00:00Z',expected_sha256=hashlib.sha256(raw).hexdigest())
    eop=EarthOrientationSnapshot.load(astropy_iers_data.IERS_B_FILE,astropy_iers_data.IERS_LEAP_SECOND_FILE,eop_sha256='31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7',leap_sha256='6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7')
    async def scenario():
        app=create_app(orbit_inputs=(orbit,),eop_provider=eop)
        runtime=app.state.runtime.orbit
        try:
            await select(runtime,input_id=orbit.input_id)
            before=runtime.snapshot().selection
            args=dict(client_request_id='product',selection_revision=1,input_id=orbit.input_id,start_utc=UTC,step_seconds=1,count=3)
            result=await runtime.samples(**args)
            repeated=await runtime.samples(**args)
            assert result==repeated and not result.stale
            assert result.eop_sha256==eop.eop_sha256 and result.leap_sha256==eop.leap_sha256
            assert result.input_hash==orbit.raw_sha256 and result.frame=='ITRF'
            assert len(result.rows)==3 and all(row.error_code is None for row in result.rows)
            assert all(-90<=row.elevation_deg<=90 and sum(v*v for v in row.position_m)>6378137**2 for row in result.rows)
            from erfa import ErfaWarning
            with pytest.warns(ErfaWarning,match='dubious year'),pytest.raises(ValueError,match='range'):
                await runtime.samples(**(args|{'start_utc':'2100-01-01T00:00:00Z'}))
            assert runtime.snapshot().selection==before
        finally:await app.state.orbit_executor.close()
    asyncio.run(scenario())

def test_calculation_contract_cannot_smuggle_mutable_or_wrong_frame():
    async def scenario():
        executor=BoundedOrbitExecutor(workers=1,waiting_requests=0)
        for bad in [OrbitCalculation([], 'eop','leap'),OrbitCalculation((OrbitSample(UTC.replace('Z','000Z'),(1.,2.,3.),10.,None),),'eop','leap',frame='TEME')]:
            runtime=OrbitRuntime(lookup_input=lambda _:INPUT,calculate=lambda *args:bad,execute=executor.run)
            await select(runtime)
            with pytest.raises(RuntimeError,match='contract'):await runtime.samples(client_request_id='bad',selection_revision=1,input_id=INPUT.input_id,start_utc=UTC,step_seconds=1,count=1)
        await executor.close()
    asyncio.run(scenario())


def test_fast_completed_work_releases_capacity_immediately():
    async def scenario():
        executor=BoundedOrbitExecutor(workers=1,waiting_requests=0)
        try:
            for value in range(100):
                assert await executor.run(lambda:value)==value
        finally:await executor.close()
    asyncio.run(scenario())
