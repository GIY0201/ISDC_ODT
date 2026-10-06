from copy import deepcopy
import pytest
from digital_twin.runtime.mission_planning.exchange import MissionPlanningExchange
from foundation.mission_planning_errors import MissionPlanningConflict
from project_support.tests.test_mission_planning_exchange import message

CTX='a'*64

def plan(module, counter=1, value=None, version=1):
    state=module.status()
    return module.guarded_plan(value or message(), f'window:{counter}',state['sequence'],state['instance_id'],CTX,version)

def command(report):
    return {'time':report['time'],'mission_id':report['mission_id'],'decision':'commit','version':report['mission_version'],'tasks':deepcopy(report['tasks'])}

def commit(module,report,counter=2,value=None,context=CTX):
    state=module.status()
    return module.guarded_commit(value or command(report),f'window:{counter}',state['sequence'],state['instance_id'],report['plan_sequence'],context)

def test_exact_retries_are_copied_and_do_not_advance_state():
    m=MissionPlanningExchange();s=m.status();p=plan(m)
    retry=m.guarded_plan(message(),'window:1',s['sequence'],s['instance_id'],CTX,1)
    assert retry==p and m.status()['sequence']==1
    retry['tasks'].clear();assert m.guarded_plan(message(),'window:1',s['sequence'],s['instance_id'],CTX,1)['tasks']==p['tasks']
    before=m.status();r=commit(m,p)
    assert m.guarded_commit(command(p),'window:2',before['sequence'],before['instance_id'],p['plan_sequence'],CTX)==r
    assert m.status()['sequence']==2 and r['held_tasks']==len(p['tasks'])

def test_changed_tasks_version_context_time_or_unplanned_commit_cannot_publish():
    m=MissionPlanningExchange();p=plan(m);before=m.status()
    for key,value in [('version',2),('time','2026-09-09T00:00:00Z'),('tasks',[])]:
        c=command(p);c[key]=value
        with pytest.raises(MissionPlanningConflict):commit(m,p,value=c)
        assert m.status()==before
    with pytest.raises(MissionPlanningConflict):commit(m,p,context='b'*64)
    c=command(p);c['mission_id']='missing'
    with pytest.raises(MissionPlanningConflict):commit(m,p,value=c)
    assert m.status()==before

def test_stale_plan_receipt_reused_id_and_committed_replan_are_rejected():
    m=MissionPlanningExchange();old=plan(m);new=plan(m,2,version=2);before=m.status()
    with pytest.raises(MissionPlanningConflict):commit(m,old,3)
    with pytest.raises(MissionPlanningConflict):plan(m,1)
    assert m.status()==before
    commit(m,new,3);before=m.status()
    with pytest.raises(MissionPlanningConflict):plan(m,4)
    assert m.status()==before
    abort=command(new);abort.update(decision='abort',tasks=[])
    commit(m,new,4,value=abort)
    assert m.status()['committed']=={}
    assert plan(m,5,version=3)['mission_version']==3

def test_infeasible_plan_cannot_be_committed_and_legacy_mutation_invalidates_receipt():
    m=MissionPlanningExchange();value=message();value['windows']={};p=plan(m,value=value);before=m.status()
    assert p['feasible'] is False
    with pytest.raises(MissionPlanningConflict):commit(m,p)
    assert m.status()==before
    p=plan(m,2);m.plan(message());before=m.status()
    with pytest.raises(MissionPlanningConflict):commit(m,p,3)
    assert m.status()==before

def test_other_mission_held_intervals_cannot_be_double_booked():
    m=MissionPlanningExchange();p=plan(m);commit(m,p)
    value=message();value['mission']['id']='MSN-2';q=plan(m,3,value);before=m.status()
    with pytest.raises(MissionPlanningConflict,match='overlap'):commit(m,q,4)
    assert m.status()==before


def test_duplicate_commit_with_new_id_and_boolean_numeric_task_change_are_rejected():
    m=MissionPlanningExchange();p=plan(m);changed=command(p)
    changed['tasks'][0]['duration_s']=True
    before=m.status()
    with pytest.raises(MissionPlanningConflict):commit(m,p,value=changed)
    assert m.status()==before
    commit(m,p);before=m.status()
    with pytest.raises(MissionPlanningConflict):commit(m,p,3)
    assert m.status()==before


def test_concurrent_windows_cannot_both_commit_one_base_sequence():
    from concurrent.futures import ThreadPoolExecutor
    m=MissionPlanningExchange();p=plan(m);s=m.status()
    def apply(client):
        try:
            return m.guarded_commit(command(p),client+':1',s['sequence'],s['instance_id'],p['plan_sequence'],CTX)
        except MissionPlanningConflict:
            return None
    with ThreadPoolExecutor(max_workers=2) as pool:
        replies=list(pool.map(apply,['left','right']))
    assert sum(reply is not None for reply in replies)==1
    assert m.status()['sequence']==2


def test_restart_bad_identifiers_and_failed_requests_preserve_plan_and_retry_counter():
    m=MissionPlanningExchange();p=plan(m);before=m.status()
    with pytest.raises(MissionPlanningConflict):
        m.guarded_commit(command(p),'window:2',before['sequence'],'other-instance',p['plan_sequence'],CTX)
    for bad in [True,-1,0]:
        with pytest.raises(ValueError):
            m.guarded_commit(command(p),'window:2',before['sequence'],before['instance_id'],bad,CTX)
    assert m.status()==before
    assert commit(m,p)['accepted'] is True
