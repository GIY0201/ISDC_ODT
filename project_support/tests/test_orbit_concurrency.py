"""T026: real HTTP/runtime/executor with deterministic calculation barriers."""
import asyncio
from threading import Event
import httpx
import pytest
from communication.native.orbit_execution import BoundedOrbitExecutor, OrbitBusy
from digital_twin.contracts.orbit import OrbitCalculation, OrbitSample
from digital_twin.runtime.orbit import OrbitRuntime
from user_application.web.application import create_app
from test_orbit_api import inputs, selection, samples, UTC


def calculation(orbit,times,site):
    return OrbitCalculation(tuple(OrbitSample(t,(1.,2.,3.),20.,None) for t in times),'eop','leap')


def test_simultaneous_http_selection_has_one_winner_and_one_409(inputs):
    async def run():
        app=create_app(orbit_inputs=inputs,orbit_calculator=calculation)
        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
                body=selection(inputs[0].input_id)
                replies=await asyncio.gather(client.put('/api/orbit/selection',json=body),client.put('/api/orbit/selection',json=body|{'client_request_id':'second'}))
                assert sorted(r.status_code for r in replies)==[200,409]
                conflict=next(r.json()['detail'] for r in replies if r.status_code==409)
                assert conflict['code']=='revision_conflict' and conflict['state']['revision']==1
                assert (await client.get('/api/orbit/state')).json()['revision']==1
        finally:await app.state.orbit_executor.close()
    asyncio.run(run())


def test_real_full_queue_returns_http_503_and_state_and_health_remain_responsive(inputs):
    async def run():
        entered,release=Event(),Event();executor=BoundedOrbitExecutor(workers=1,waiting_requests=0)
        def blocked(*args):entered.set();assert release.wait(5);return calculation(*args)
        app=create_app(orbit_inputs=inputs,orbit_calculator=calculation)
        app.state.runtime.orbit=OrbitRuntime(lookup_input={i.input_id:i for i in inputs}.get,calculate=blocked,execute=executor.run)
        task=None
        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
                assert (await client.put('/api/orbit/selection',json=selection(inputs[0].input_id))).status_code==200
                task=asyncio.create_task(client.post('/api/orbit/samples',json=samples(inputs[0].input_id)))
                assert await asyncio.to_thread(entered.wait,2)
                rejected=await asyncio.wait_for(client.post('/api/orbit/samples',json=samples(inputs[0].input_id,client_request_id='full')),1)
                assert rejected.status_code==503 and rejected.json()['detail']['code']=='calculation_unavailable'
                assert (await asyncio.wait_for(client.get('/api/orbit/state'),1)).json()['revision']==1
                assert (await asyncio.wait_for(client.get('/api/health'),1)).status_code==200
                changed=await asyncio.wait_for(client.put('/api/orbit/selection',json=selection(inputs[0].input_id,expected_revision=1)),1)
                assert changed.status_code==200
                release.set();old=await task
                assert old.status_code==200 and old.json()['stale'] and old.json()['revision']==1
                recovered=await client.post('/api/orbit/samples',json=samples(inputs[0].input_id,selection_revision=2))
                assert recovered.status_code==200 and not recovered.json()['stale']
        finally:
            release.set()
            if task:await asyncio.gather(task,return_exceptions=True)
            await executor.close();await app.state.orbit_executor.close()
    asyncio.run(run())


def test_queued_cancellation_never_calls_calculator_and_releases_only_queued_slot():
    async def run():
        entered,release=Event(),Event();executor=BoundedOrbitExecutor(workers=1,waiting_requests=1);calls=[]
        def blocked():entered.set();assert release.wait(5);calls.append('running');return 1
        running=asyncio.create_task(executor.run(blocked));queued=None
        try:
            assert await asyncio.to_thread(entered.wait,2)
            queued=asyncio.create_task(executor.run(lambda:calls.append('cancelled')))
            await asyncio.sleep(0);queued.cancel()
            with pytest.raises(asyncio.CancelledError):await queued
            # Drain completion callbacks for cancelled queued future, not a timing sleep.
            for _ in range(4):await asyncio.sleep(0)
            replacement=asyncio.create_task(executor.run(lambda:2));await asyncio.sleep(0)
            with pytest.raises(OrbitBusy):await executor.run(lambda:3)
            release.set();assert await running==1;assert await replacement==2
            assert calls==['running']
        finally:
            release.set();await executor.close()
            await asyncio.gather(running,*([queued] if queued else []),return_exceptions=True)
    asyncio.run(run())


def test_running_request_cancel_keeps_capacity_until_worker_finishes(inputs):
    async def run():
        entered,release=Event(),Event();executor=BoundedOrbitExecutor(workers=1,waiting_requests=0)
        def blocked(*args):entered.set();assert release.wait(5);return calculation(*args)
        runtime=OrbitRuntime(lookup_input=lambda _:inputs[0],calculate=blocked,execute=executor.run)
        command=selection(inputs[0].input_id);command['ground_point']=runtime.snapshot().selection.ground_point
        await runtime.select(**command);before=runtime.snapshot();query=samples(inputs[0].input_id);task=asyncio.create_task(runtime.samples(**query))
        try:
            assert await asyncio.to_thread(entered.wait,2);task.cancel()
            with pytest.raises(asyncio.CancelledError):await task
            with pytest.raises(OrbitBusy):await runtime.samples(**query)
            assert runtime.snapshot().selection==before.selection
            release.set()
        finally:release.set();await executor.close();await asyncio.gather(task,return_exceptions=True)
    asyncio.run(run())


def test_visibility_started_before_new_selection_returns_old_context_as_stale(inputs):
    async def run():
        entered,release=Event(),Event();executor=BoundedOrbitExecutor(workers=1,waiting_requests=0)
        def blocked(*args):entered.set();assert release.wait(5);return calculation(*args)
        runtime=OrbitRuntime(lookup_input=lambda _:inputs[0],calculate=blocked,execute=executor.run)
        command=selection(inputs[0].input_id);command['ground_point']=runtime.snapshot().selection.ground_point
        await runtime.select(**command)
        query=dict(client_request_id='old-visibility',selection_revision=1,input_id=inputs[0].input_id,start_utc=UTC,end_utc='2020-07-12T21:16:11.000416Z',ground_point=command['ground_point'],minimum_elevation_deg=10)
        task=asyncio.create_task(runtime.visibility(**query))
        try:
            assert await asyncio.to_thread(entered.wait,2)
            await asyncio.wait_for(runtime.select(**(command|{'expected_revision':1,'client_request_id':'new'})),1)
            release.set();result=await task
            assert result.stale and result.revision==1 and result.client_request_id=='old-visibility'
            assert result.ground_point==command['ground_point']
            assert runtime.snapshot().selection.revision==2
        finally:release.set();await asyncio.gather(task,return_exceptions=True);await executor.close()
    asyncio.run(run())
