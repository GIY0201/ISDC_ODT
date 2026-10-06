from copy import deepcopy
import httpx
import pytest
from fastapi.testclient import TestClient
from project_support.tests.test_mission_planning_http import create_app
from project_support.tests.test_mission_planning_exchange import message
from communication.external.orchestration import RemoteOrchestration
from foundation.mission_planning_errors import MissionPlanningUnavailable

CTX='a'*64

def headers(s,request_id='window:1',plan=None):
    return {'X-ISDC-Orchestration-Instance':s['instance_id'], 'X-ISDC-Orchestration-Sequence':str(s['sequence']),
            'X-ISDC-Orchestration-Request-Id':request_id,'X-ISDC-Orchestration-Context':CTX,
            'X-ISDC-Orchestration-Plan-Sequence':str(plan)} if plan else {
            'X-ISDC-Orchestration-Instance':s['instance_id'], 'X-ISDC-Orchestration-Sequence':str(s['sequence']),
            'X-ISDC-Orchestration-Request-Id':request_id,'X-ISDC-Orchestration-Context':CTX,
            'X-ISDC-Orchestration-Mission-Version':'1'}

def test_guarded_http_exact_retry_conflict_and_partial_header_rejection():
    with TestClient(create_app()) as c:
        s=c.get('/api/orchestration/status').json();h=headers(s)
        p=c.post('/api/orchestration/plan',json=message(),headers=h)
        assert p.status_code==200;report=p.json()
        assert c.post('/api/orchestration/plan',json=message(),headers=h).json()==report
        assert c.post('/api/orchestration/plan',json=message(),headers={'X-ISDC-Orchestration-Context':CTX}).status_code==400
        state=c.get('/api/orchestration/status').json();commit={'time':report['time'],'mission_id':report['mission_id'],'decision':'commit','version':1,'tasks':report['tasks']}
        h=headers(state,'window:2',report['plan_sequence'])
        changed=deepcopy(commit);changed['tasks']=[]
        assert c.post('/api/orchestration/commit',json=changed,headers=h).status_code==409
        r=c.post('/api/orchestration/commit',json=commit,headers=h)
        assert r.status_code==200 and r.json()['accepted'] is True
        assert c.post('/api/orchestration/commit',json=commit,headers=h).json()==r.json()
        assert c.get('/api/orchestration/status').json()['sequence']==2

def test_remote_guarded_roundtrip_and_no_fallback_without_capability():
    with TestClient(create_app()) as server:
        transport=httpx.MockTransport(lambda req:server.request(req.method,req.url.path,content=req.content,headers=dict(req.headers)))
        remote=RemoteOrchestration('http://ops.example',client=httpx.Client(base_url='http://ops.example',transport=transport))
        s=remote.status();p=remote.guarded_plan(message(),'window:1',s['sequence'],s['instance_id'],CTX,1)
        assert p['feasible'] is True
        s=remote.status();body={'time':p['time'],'mission_id':p['mission_id'],'decision':'commit','version':1,'tasks':p['tasks']}
        assert remote.guarded_commit(body,'window:2',s['sequence'],s['instance_id'],p['plan_sequence'],CTX)['accepted'] is True
    calls=[]
    def old(req):
        calls.append(req.method);return httpx.Response(200,json={'reachable':True})
    remote=RemoteOrchestration('http://old.example',client=httpx.Client(base_url='http://old.example',transport=httpx.MockTransport(old)))
    with pytest.raises(MissionPlanningUnavailable):remote.guarded_plan(message(),'w:1',0,'instance',CTX,1)
    assert calls==['GET']

@pytest.mark.parametrize('payload',[[],None,{'exchange_contract':'guarded-v1','instance_id':'wrong','sequence':1}])
def test_remote_invalid_acceptance_is_unavailable(payload):
    def reply(req):
        return httpx.Response(200,json={'reachable':True,'exchange_contract':'guarded-v1'}) if req.method=='GET' else httpx.Response(200,json=payload)
    remote=RemoteOrchestration('http://ops.example',client=httpx.Client(base_url='http://ops.example',transport=httpx.MockTransport(reply)))
    with pytest.raises(MissionPlanningUnavailable):remote.guarded_plan(message(),'w:1',0,'instance',CTX,1)


def test_remote_boolean_versions_are_not_valid_integer_receipts():
    def reply(req):
        if req.method=='GET':return httpx.Response(200,json={'reachable':True,'exchange_contract':'guarded-v1'})
        return httpx.Response(200,json={'exchange_contract':'guarded-v1','instance_id':'instance','request_id':'w:1',
            'context_hash':CTX,'sequence':1,'mission_id':'MSN-0001','mission_version':True,'plan_sequence':1,
            'feasible':True,'tasks':[],'time':message()['time']})
    remote=RemoteOrchestration('http://ops.example',client=httpx.Client(base_url='http://ops.example',transport=httpx.MockTransport(reply)))
    with pytest.raises(MissionPlanningUnavailable):remote.guarded_plan(message(),'w:1',0,'instance',CTX,1)
