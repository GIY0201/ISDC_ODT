from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import pytest
from digital_twin.runtime.mission_planning.exchange import MissionPlanningExchange
from project_support.tests.test_mission_planning_source import request, observe, satellite, access, contact

def message():
    return request(observe(),[satellite('S1')],{'target_access':[access('S1',30,38)],'contacts':[contact('S1','GS-DAEJEON',60,70)]})

def test_failed_plan_and_commit_preserve_last_sequence_and_whole_module_state():
    module=MissionPlanningExchange();plan=module.plan(message());before=module.status()
    with pytest.raises((ValueError,TypeError)):module.plan({'time':'broken','mission':{'kind':'observe'}})
    assert module.status()==before
    with pytest.raises(ValueError):module.commit({'mission_id':plan['mission_id'],'decision':'commit','tasks':[{'satellite':'S1','start':'broken','end':'broken'}]})
    assert module.status()==before
    for bad in [float('nan'),float('inf')]:
        value=message();value['mission']['params']['product_mb']=bad
        with pytest.raises(ValueError):module.plan(value)
        assert module.status()==before

def test_caller_and_report_copies_cannot_change_committed_module_records():
    module=MissionPlanningExchange();plan=module.plan(message());tasks=deepcopy(plan['tasks']);command={'mission_id':plan['mission_id'],'decision':'commit','version':1,'tasks':tasks}
    count=len(tasks);receipt=module.commit(command);command['tasks'].clear();plan['mission_id']='mutated';receipt['held_tasks']=999
    assert module.status()['committed']['MSN-0001']['tasks']==count
    state=module.status();state['missions'].clear();assert 'MSN-0001' in module.status()['missions']
    module.commit({'mission_id':'MSN-0001','decision':'abort'});assert module.status()['committed']=={}

def test_concurrent_planning_is_serialized_and_capacity_does_not_evict_accepted_missions():
    module=MissionPlanningExchange(max_missions=2)
    with ThreadPoolExecutor(max_workers=8) as pool:
        plans=list(pool.map(lambda _:module.plan(message()),range(24)))
    assert sorted(p['sequence'] for p in plans)==list(range(1,25))
    second=message();second['mission']['id']='MSN-2';module.plan(second);before=module.status()
    third=message();third['mission']['id']='MSN-3'
    with pytest.raises(ValueError,match='capacity'):module.plan(third)
    assert module.status()==before

def test_nonfinite_report_after_source_stamp_is_not_published(monkeypatch):
    from digital_twin.runtime.mission_planning.stand_in import OrchestrationStandIn
    module=MissionPlanningExchange();module.plan(message());before=module.status()
    original=OrchestrationStandIn.plan
    def malformed(self,value):
        report=original(self,value)
        report['summary']['untrusted']=float('nan')
        return report
    monkeypatch.setattr(OrchestrationStandIn,'plan',malformed)
    with pytest.raises(ValueError):module.plan(message())
    assert module.status()==before


def test_original_scheduler_and_stand_in_hashes_are_preserved():
    from pathlib import Path
    from hashlib import sha256
    import json
    root=Path(__file__).resolve().parents[2]
    manifest=json.loads((root/'project_support/tests/fixtures/original_orchestration_source.json').read_text(encoding='utf-8'))
    for path,expected in manifest['files'].items():
        port=(root/path).read_text(encoding='utf-8')
        assert sha256(port.encode()).hexdigest()==expected['port_sha256']
        normalized=port.replace('from digital_twin.simulation.mission_planning.scheduler import Planner, parse_time','from .scheduler import Planner, parse_time')
        assert sha256(normalized.encode()).hexdigest()==expected['normalized_source_sha256']
