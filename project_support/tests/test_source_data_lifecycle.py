from fastapi.testclient import TestClient
from user_application.web.application import create_app

def node(identifier):
    return {'id':identifier,'name':'Lifecycle '+identifier,'mode':'nominal','equipment':[{'id':'store','catalog':'dtn_store','enabled':True},{'id':'camera','catalog':'eo_camera','enabled':True}]}

def test_actual_accepted_deployment_generates_objects_and_console_lifecycle_is_scoped():
    app=create_app()
    with TestClient(app) as client:
        assert client.post('/api/runtime/control',json={'action':'pause'}).status_code==200
        accepted=client.post('/api/data-management/deployment',json={'deployment_id':'lifecycle','expected_revision':0,'nodes':[node('A'),node('B'),node('C')]}).json();scope=accepted['scope_id']
        assert client.get('/api/data-management/dashboard').json()['objects']['total']==0
        assert client.post('/api/scenario/advance',json={'seconds':120}).status_code==200
        report=client.get('/api/data-management/dashboard').json()
        assert report['deployment']==accepted and report['objects']['total']>0
        objects=report['objects']['items'];obj=next(o for o in objects if o['class']=='imagery')
        assert obj['source'] in {'A','B','C'} and obj['checksum'] and obj['tier']=='hot'
        assert obj['replicas'] and all('node' in r and 'state' in r and 'lag_s' in r and 'ready_s' in r for r in obj['replicas'])
        assert all('tier' not in r and 'checksum' not in r for r in obj['replicas'])
        for action in ['verify','heal','rebalance']:
            result=client.post('/api/data-management/console/action',json={'scope_id':scope,'action':action,'object_id':obj['id']})
            assert result.status_code==200
            value=result.json();assert value['scope_id']==scope and value['scope_contract']=='isolated-v1' and value['action']==action and value['status'] in {'done','running'}
            if action=='verify':assert value['checked']>0
        served=client.post('/api/data-management/console/request',json={'scope_id':scope,'object_id':obj['id'],'destination':'B'}).json()
        assert served['status']=='served' and served['served_from'] in {'A','B','C'} and served['destination']=='B' and served['object_id']==obj['id'] and served['latency_ms']>0
        report=client.get('/api/data-management/dashboard').json()
        assert report['overview']['requests'][0]['id']==served['id']
        assert any(j['kind']=='verify' for j in report['overview']['jobs'])
        assert client.post('/api/scenario/advance',json={'seconds':60}).status_code==200
        completed=client.get('/api/data-management/dashboard').json()['overview']['jobs']
        assert any(j['kind']=='verify' and j['status']=='done' for j in completed)
        assert any(j['kind']=='rebalance' and j['status']=='done' for j in completed)
        policy=client.post('/api/data-management/console/action',json={'scope_id':scope,'action':'set_replication','class':'imagery','replication':1})
        assert policy.status_code==200
        assert client.get('/api/data-management/dashboard').json()['overview']['policy']['replication']['imagery']==1
        filtered=client.post('/api/data-management/console/action',json={'scope_id':scope,'action':'set_filter','filter':{'min_size_mb':2}})
        assert filtered.status_code==200 and filtered.json()['filters']['min_size_mb']==2
        old_count=app.state.data_management.for_scope(scope).objects()['total']
        recalled=client.post('/api/data-management/deployment',json={'deployment_id':'lifecycle-recall','expected_revision':accepted['revision'],'nodes':[]}).json()
        assert recalled['scope_id']!=scope
        assert client.post('/api/data-management/console/action',json={'scope_id':scope,'action':'verify'}).status_code==409
        assert client.post('/api/data-management/console/request',json={'scope_id':scope,'object_id':obj['id'],'destination':'B'}).status_code==409
        assert client.get('/api/data-management/dashboard').json()['objects']['total']==0
        assert app.state.data_management.for_scope(scope).objects()['total']==old_count

def test_actual_fault_driven_replica_recovery_advances_only_existing_sim_clock():
    app=create_app()
    with TestClient(app) as client:
        client.post('/api/runtime/control',json={'action':'pause'})
        accepted=client.post('/api/data-management/deployment',json={'deployment_id':'heal-lifecycle','expected_revision':0,'nodes':[node(x) for x in 'ABCD']}).json()
        client.post('/api/scenario/advance',json={'seconds':120});first=client.get('/api/data-management/dashboard').json()
        obj=next(o for o in first['objects']['items'] if o['class']=='imagery' and o['source']=='A')
        client.post('/api/scenario/advance',json={'seconds':60});client.get('/api/data-management/dashboard')
        fault=client.post('/api/faults',json={'target':'A','kind':'storage_pressure','severity':'high','duration_seconds':600})
        assert fault.status_code==200
        down=client.get('/api/data-management/dashboard').json()
        current=next(o for o in down['objects']['items'] if o['id']==obj['id'])
        assert any(r['node']=='A' and r['state']=='unreachable' for r in current['replicas'])
        client.post('/api/scenario/advance',json={'seconds':90});recovering=client.get('/api/data-management/dashboard').json()
        assert any(j['kind']=='heal' and j['object_id']==obj['id'] for j in recovering['overview']['jobs'])
        requested=client.post('/api/data-management/console/action',json={'scope_id':accepted['scope_id'],'action':'heal','object_id':obj['id']})
        assert requested.status_code==200 and requested.json()['status'] in {'running','done'}
        client.post('/api/scenario/advance',json={'seconds':60});healed=client.get('/api/data-management/dashboard').json()
        current=next(o for o in healed['objects']['items'] if o['id']==obj['id'])
        assert len([r for r in current['replicas'] if r['state']=='verified'])==3
        assert all(r['node']!='A' for r in current['replicas'] if r['state']=='verified')
        assert any(j['kind']=='heal' and j['object_id']==obj['id'] and j['status']=='done' for j in healed['overview']['jobs'])
