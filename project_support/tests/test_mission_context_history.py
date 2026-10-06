"""Past native approval proofs do not replace the single current physical input owner."""
from copy import deepcopy
import asyncio
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from foundation.mission_planning_errors import MissionPlanningConflict
from project_support.tests.test_mission_context import setup


def test_three_original_plans_before_first_commit_keep_earlier_native_proof():
    app,command=setup()
    original=json.loads((Path(__file__).parent/'fixtures/native_source_plan.json').read_text(encoding='utf-8'))
    with TestClient(app) as client:
        client.post('/api/runtime/control',json={'action':'pause'})
        plans=[]
        for number in range(3):
            status=client.get('/api/orchestration/status').json()
            capture=deepcopy(command);capture['module_sequence']=status['sequence'];capture['request_id']=f'context-{number}'
            approval=client.post('/api/nodes/mission-context',json=capture);assert approval.status_code==200,approval.text
            value=approval.json();body=deepcopy(original);body['mission']['id']=f'M-batch-{number}'
            headers={'X-ISDC-Orchestration-Instance':status['instance_id'],'X-ISDC-Orchestration-Sequence':str(status['sequence']),'X-ISDC-Orchestration-Request-Id':f'batch-client:{number+1}','X-ISDC-Orchestration-Context':value['context_hash'],'X-ISDC-Orchestration-Mission-Version':'1'}
            response=client.post('/api/orchestration/plan',json=body,headers=headers);assert response.status_code==200,response.text
            plan=response.json();assert plan['feasible'];plans.append((plan,headers))
        assert len({plan['context_hash'] for plan,_ in plans})==3
        first,headers=plans[0];headers=deepcopy(headers);headers.pop('X-ISDC-Orchestration-Mission-Version');headers.update({'X-ISDC-Orchestration-Sequence':'3','X-ISDC-Orchestration-Request-Id':'batch-client:4','X-ISDC-Orchestration-Plan-Sequence':str(first['plan_sequence'])})
        body={'time':first['time'],'mission_id':first['mission_id'],'decision':'commit','version':1,'tasks':first['tasks']}
        result=client.post('/api/orchestration/commit',json=body,headers=headers);assert result.status_code==200,result.text
        # History never weakens the separately owned overlap or sequence guard.
        second,h=plans[1];h=deepcopy(h);h.pop('X-ISDC-Orchestration-Mission-Version');h.update({'X-ISDC-Orchestration-Sequence':'4','X-ISDC-Orchestration-Request-Id':'batch-client:5','X-ISDC-Orchestration-Plan-Sequence':str(second['plan_sequence'])})
        overlap={'time':second['time'],'mission_id':second['mission_id'],'decision':'commit','version':1,'tasks':second['tasks']}
        rejected=client.post('/api/orchestration/commit',json=overlap,headers=h);assert rejected.status_code==409 and 'overlap' in rejected.text


def approved_runtime():
    app,command=setup()
    with TestClient(app) as client:
        value=client.post('/api/nodes/mission-context',json=command).json()
    return app.state.runtime,value


@pytest.mark.parametrize('change',['utc','nodes','stations','module_instance','external'])
def test_different_physical_approval_evicts_previous_proofs_even_when_latest_is_valid(change):
    runtime,first=approved_runtime();later=deepcopy(first);later['context_hash']='b'*64;later['module_sequence']=1
    if change=='utc':later['utc']='2020-07-12T21:16:02.000416000Z'
    if change=='nodes':later['nodes'][0]['power']['battery_wh']+=1
    if change=='stations':later['stations'][0]['latitude']+=1
    if change=='module_instance':later['module_instance']='other-instance'
    if change=='external':later['external']={'normalized_gp_sha256':'x'}
    async def scenario():
        await runtime.accept_mission_context(later)
        async def consume(value):return value
        with pytest.raises(MissionPlanningConflict):await runtime.with_mission_context(first['context_hash'],consume)
        assert (await runtime.with_mission_context(later['context_hash'],consume))==later
    asyncio.run(scenario())


def test_bounded_proof_eviction_deployment_reset_fault_and_copy_isolation():
    runtime,first=approved_runtime()
    async def scenario():
        async def consume(value):value['nodes'].clear();return value
        for index in range(70):
            value=deepcopy(first);value['context_hash']=f'{index+1:064x}';value['module_sequence']=index
            await runtime.accept_mission_context(value)
        assert len(runtime._mission_context_proofs)<=64
        with pytest.raises(MissionPlanningConflict):await runtime.with_mission_context(f'{1:064x}',consume)
        await runtime.with_mission_context(f'{70:064x}',consume)
        assert runtime.mission_context()['nodes']
        runtime._data_deployment['revision']+=1
        assert runtime.mission_context() is None and not runtime._mission_context_proofs
        # An abort stays available without a valid current proof for existing cleanup semantics.
        assert (await runtime.with_mission_context('missing',lambda value:async_result(value),abort=True)) is None
    asyncio.run(scenario())


async def async_result(value):return value


@pytest.mark.parametrize('action',['reset','scenario','fault','recall'])
def test_authoritative_runtime_changes_proactively_clear_proof_history(action):
    app,command=setup()
    with TestClient(app) as client:
        assert client.post('/api/nodes/mission-context',json=command).status_code==200
        assert app.state.runtime._mission_context_proofs
        if action=='reset':result=client.post('/api/runtime/control',json={'action':'reset'})
        elif action=='scenario':result=client.post('/api/scenario/select',json={'scenario_id':'LEO_STANDARD'})
        elif action=='fault':result=client.post('/api/faults',json={'target':'SAT-01','kind':'link_loss','severity':'medium','duration_seconds':1})
        else:result=client.post('/api/data-management/deployment',json={'deployment_id':'proof-recall','expected_revision':1,'nodes':[]})
        assert result.status_code==200,result.text
        assert not app.state.runtime._mission_context_proofs
        assert app.state.runtime.mission_context() is None
