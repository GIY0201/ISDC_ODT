"""Accepted runtime deployment with the real scoped module; ASGI component proof."""
import asyncio
from copy import deepcopy

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from communication.data_management_delivery import DataManagementBridge
from communication.http.data_deployment import router
from communication.http.data_deployment_schemas import DataDeploymentCommand
from digital_twin.contracts.data_management import DataDeploymentConflict, DataManagementUnavailable
from digital_twin.runtime.data_management.scopes import ScopedDataManagement
from user_application.bootstrap import create_runtime


def node(identifier='A'):
    return {'id':identifier,'name':'  이름 '+identifier+'  ','mode':'nominal',
            'equipment':[{'id':'store','catalog':'dtn_store','enabled':True}]}


def command(identifier='deploy-a',revision=0,nodes=None):
    return {'deployment_id':identifier,'expected_revision':revision,'nodes':[node()] if nodes is None else nodes}


def assemble(module=None):
    app=FastAPI();app.state.runtime=create_runtime()
    app.state.data_management=ScopedDataManagement() if module is None else module
    app.state.data_management_bridge=DataManagementBridge(now=lambda:'2026-10-06T00:00:00Z')
    app.include_router(router)
    return app


def test_actual_acceptance_idempotency_revisions_copies_and_no_initial_backfill():
    app=assemble()
    with TestClient(app) as client:
        initial=client.get('/api/data-management/deployment').json()
        assert initial['nodes']==[] and initial['revision']==0 and initial['deployment_id'] is None
        response=client.post('/api/data-management/deployment',json=command())
        assert response.status_code==200
        accepted=response.json();assert accepted['nodes']==[node()] and accepted['revision']==1
        scope=app.state.data_management.for_scope(accepted['scope_id'])
        assert scope.objects()['total']==0 and scope.nodes()['nodes'][0]['capacity_gb']==2000
        sequence=scope.status()['sequence']
        assert client.post('/api/data-management/deployment',json=command()).json()==accepted
        assert scope.status()['sequence']==sequence
        for body in [command(nodes=[node('B')]),command('deploy-b'),command(revision=1,nodes=[node('B')])]:
            assert client.post('/api/data-management/deployment',json=body).status_code==409
        result=app.state.runtime.data_deployment();result['nodes'][0]['equipment'].clear()
        assert app.state.runtime.data_deployment()==accepted


@pytest.mark.parametrize('mutation',[
    lambda c:c.update(expected_revision=True),lambda c:c.update(expected_revision='0'),
    lambda c:c.update(deployment_id='a:b'),lambda c:c.update(scope_id='caller-scope'),
    lambda c:c['nodes'].append(deepcopy(c['nodes'][0])),
    lambda c:c['nodes'][0].update(mode='bad'),
    lambda c:c['nodes'][0].update(capacity_gb=4000),
    lambda c:c['nodes'][0]['equipment'][0].update(enabled=1),
    lambda c:c['nodes'][0]['equipment'].append(deepcopy(c['nodes'][0]['equipment'][0])),
    lambda c:c.update(nodes=[node(str(i)) for i in range(241)]),
    lambda c:c['nodes'][0].update(equipment=[{'id':str(i),'catalog':'dtn_store','enabled':True} for i in range(101)]),
])
def test_invalid_schema_never_calls_module_or_changes_runtime(mutation):
    class NoWrites:
        def for_scope(self,scope):raise AssertionError('invalid wire command reached module')
    app=assemble(NoWrites());body=command();mutation(body)
    with TestClient(app) as client:
        assert client.post('/api/data-management/deployment',json=body).status_code==422
        assert app.state.runtime.data_deployment()['revision']==0
    with pytest.raises(ValidationError):DataDeploymentCommand.model_validate(body)


def test_all_240_nodes_and_100_equipment_preserved_then_explicit_recall():
    app=assemble();rows=[node(str(i)) for i in range(240)]
    rows[0]['equipment']=[{'id':str(i),'catalog':'dtn_store','enabled':True} for i in range(100)]
    with TestClient(app) as client:
        accepted=client.post('/api/data-management/deployment',json=command(nodes=rows)).json()
        assert accepted['nodes']==rows
        owner=app.state.data_management.for_scope(accepted['scope_id'])
        assert len(owner.nodes()['nodes'])==240 and owner.nodes()['nodes'][0]['capacity_gb']==200000
        recall=client.post('/api/data-management/deployment',json=command('recall',1,[]))
        assert recall.status_code==200 and recall.json()['nodes']==[] and recall.json()['revision']==2
        assert len(owner.nodes()['nodes'])==240
        assert app.state.data_management.for_scope(recall.json()['scope_id']).nodes()['nodes']==[]


def test_unavailable_and_wrong_roster_leave_accepted_state_unchanged():
    app=assemble()
    class Down:
        def for_scope(self,scope):raise DataManagementUnavailable('offline')
    with TestClient(app) as client:
        prior=client.post('/api/data-management/deployment',json=command()).json()
        app.state.data_management=Down()
        assert client.post('/api/data-management/deployment',json=command('deploy-b',1,[node('B')])).status_code==503
        assert client.get('/api/data-management/deployment').json()==prior
        class Bad:
            def for_scope(self,scope):self.scope_id=scope;return self
            def status(self):return {'scope_id':self.scope_id,'scope_contract':'isolated-v1','reachable':True}
            def update_nodes(self,message):return {**self.status(),'sequence':1,'sim_elapsed_s':124.5,'nodes':[]}
        app.state.data_management=Bad()
        assert client.post('/api/data-management/deployment',json=command('deploy-b',1,[node('B')])).status_code==503
        assert app.state.runtime.data_deployment()==prior


def test_missing_composition_reports_unavailable_without_acceptance():
    app=FastAPI();app.state.runtime=create_runtime();app.include_router(router)
    with TestClient(app) as client:
        assert client.post('/api/data-management/deployment',json=command()).status_code==503
        assert app.state.runtime.data_deployment()['revision']==0


def test_module_domain_rejection_is_400_and_does_not_commit():
    class Refused:
        def for_scope(self,scope):raise ValueError('module rejected roster')
    app=assemble(Refused())
    with TestClient(app) as client:
        assert client.post('/api/data-management/deployment',json=command()).status_code==400
        assert app.state.runtime.data_deployment()['revision']==0


def test_runtime_refuses_unconditional_or_mismatched_activation_receipt():
    async def run():
        runtime=create_runtime();module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t')
        before=runtime.data_deployment()
        async def nothing(context):return None
        with pytest.raises(DataManagementUnavailable):await runtime.apply_data_deployment(command(),nothing)
        assert runtime.data_deployment()==before
        async def mismatched(context):
            scoped,sync=bridge.sync(module,context);sync['scope_id']='foreign';return scoped,sync
        with pytest.raises(DataManagementUnavailable):await runtime.apply_data_deployment(command(),mismatched)
        assert runtime.data_deployment()==before
        async def activate(context):return bridge.sync(module,context)
        assert (await runtime.apply_data_deployment(command(),activate))['revision']==1
    asyncio.run(run())


def test_same_size_wrong_roster_receipt_cannot_publish_candidate():
    async def run():
        runtime=create_runtime();module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t')
        before=runtime.data_deployment()
        async def activate(context):
            context['inputs']['nodes'][0]['id']='foreign'
            return bridge.sync(module,context)
        with pytest.raises(DataManagementUnavailable):await runtime.apply_data_deployment(command(),activate)
        assert runtime.data_deployment()==before
    asyncio.run(run())


def test_cancellation_after_candidate_write_keeps_prior_runtime_and_scope():
    async def run():
        runtime=create_runtime();module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t')
        async def activate(context):return bridge.sync(module,context)
        before=await runtime.apply_data_deployment(command(),activate)
        old=module.for_scope(before['scope_id']).nodes()
        async def cancel(context):bridge.sync(module,context);raise asyncio.CancelledError()
        with pytest.raises(asyncio.CancelledError):await runtime.apply_data_deployment(command('deploy-b',1,[node('B')]),cancel)
        assert runtime.data_deployment()==before and module.for_scope(before['scope_id']).nodes()==old
        assert (await runtime.apply_data_deployment(command('deploy-b',1,[node('B')]),activate))['revision']==2
    asyncio.run(run())


def test_caller_mutation_while_activation_waits_cannot_change_sent_or_accepted_nodes():
    async def run():
        runtime=create_runtime();module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t')
        entered=asyncio.Event();release=asyncio.Event();body=command()
        async def activate(context):entered.set();await release.wait();return bridge.sync(module,context)
        task=asyncio.create_task(runtime.apply_data_deployment(body,activate));await entered.wait()
        body['nodes'][0]['name']='changed';body['deployment_id']='changed';release.set()
        accepted=await task
        assert accepted['deployment_id']=='deploy-a' and accepted['nodes']==[node()]
        assert module.for_scope(accepted['scope_id']).nodes()['nodes'][0]['name']==node()['name']
    asyncio.run(run())


def test_concurrent_candidates_one_winner_and_reset_waits_for_activation():
    async def run():
        runtime=create_runtime();module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t')
        entered=asyncio.Event();release=asyncio.Event()
        async def activate(context):entered.set();await release.wait();return bridge.sync(module,context)
        a=asyncio.create_task(runtime.apply_data_deployment(command(),activate));await entered.wait()
        b=asyncio.create_task(runtime.apply_data_deployment(command('deploy-b'),activate))
        reset=asyncio.create_task(runtime.control('reset'));await asyncio.sleep(0)
        assert not b.done() and not reset.done() and runtime.data_deployment()['revision']==0
        release.set();accepted=await a
        with pytest.raises(DataDeploymentConflict):await b
        await reset
        assert runtime.data_deployment()['scope_id']!=accepted['scope_id']
        assert runtime.data_deployment()['nodes']==accepted['nodes']
        async def consume(context):
            assert context['started_s']==0 and context['runtime']['elapsed_seconds']==0
            return bridge.sync(module,context)
        scoped,receipt=await runtime.with_data_deployment(consume)
        assert receipt['products']==0 and scoped.objects()['total']==0
        assert module.for_scope(accepted['scope_id']).nodes()['nodes']
    asyncio.run(run())


def test_context_exchange_serializes_reset_and_preserves_old_catalogue():
    async def run():
        runtime=create_runtime();module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t')
        async def activate(context):return bridge.sync(module,context)
        accepted=await runtime.apply_data_deployment(command(),activate)
        await runtime.control('step',100)
        entered=asyncio.Event();release=asyncio.Event()
        async def consume(context):entered.set();await release.wait();return bridge.sync(module,context)
        exchange=asyncio.create_task(runtime.with_data_deployment(consume));await entered.wait()
        reset=asyncio.create_task(runtime.control('reset'));await asyncio.sleep(0);assert not reset.done()
        release.set();scoped,sync=await exchange;assert sync['products']>0
        before=scoped.objects();await reset
        assert module.for_scope(accepted['scope_id']).objects()==before
        async def fresh(context):return bridge.sync(module,context)
        new,report=await runtime.with_data_deployment(fresh)
        assert new.objects()['total']==0 and report['products']==0
    asyncio.run(run())


def test_scenario_change_gets_new_scope_and_preserves_configuration_revision():
    async def run():
        runtime=create_runtime();module=ScopedDataManagement();bridge=DataManagementBridge(now=lambda:'t')
        async def activate(context):return bridge.sync(module,context)
        accepted=await runtime.apply_data_deployment(command('unconfigured'),activate)
        await runtime.select_scenario(runtime.scenarios[0]['id'])
        current=runtime.data_deployment()
        assert current['scope_id']!=accepted['scope_id'] and current['nodes']==accepted['nodes'] and current['revision']==1
        async def consume(context):assert context['started_s']==0;return bridge.sync(module,context)
        assert (await runtime.with_data_deployment(consume))[1]['products']==0
    asyncio.run(run())


def test_original_deployment_state_machine_trace_preserved():
    import json
    from pathlib import Path
    from digital_twin.runtime.state import RuntimeState
    from project_support.tooling.capture_original_node_deployment import trace
    expected=json.loads((Path(__file__).parent/'fixtures/original_node_deployment.json').read_text(encoding='utf-8'))
    assert asyncio.run(trace(RuntimeState))==expected['trace']
