"""ICD-01 original console over the existing accepted deployment owner."""
from fastapi.testclient import TestClient
from user_application.web.application import create_app


def test_empty_dashboard_and_console_are_real_scoped_module_not_kpi():
    app=create_app()
    with TestClient(app) as client:
        client.post('/api/runtime/control',json={'action':'pause'})
        response=client.get('/api/data-management/dashboard')
        assert response.status_code==200
        report=response.json()
        assert report['deployment']['nodes']==[]
        assert report['module']['scope_contract']=='isolated-v1'
        assert report['objects']['total']==0
        assert report['runtime']['run_id']==report['deployment']['run_id']
        assert client.post('/api/data-management/console/action',json={'scope_id':report['deployment']['scope_id'],'action':'verify'}).status_code==409
        assert client.post('/api/data-management/console/snapshot').status_code==409


def test_scoped_objects_and_actions_follow_accepted_roster_and_reject_other_scope():
    app=create_app()
    with TestClient(app) as client:
        client.post('/api/runtime/control',json={'action':'pause'})
        node={'id':'A','name':'HTTP validation','mode':'nominal','equipment':[{'id':'store','catalog':'dtn_store','enabled':True}]}
        accepted=client.post('/api/data-management/deployment',json={'deployment_id':'http-check','expected_revision':0,'nodes':[node]}).json()
        scope=accepted['scope_id']
        report=client.get('/api/data-management/dashboard').json()
        assert report['deployment']==accepted
        assert report['module']['reachable'] is True
        assert any(n['id']=='A' for n in report['nodes'])
        assert client.get('/api/data-management/objects').status_code==409
        before=app.state.data_management.for_scope(scope).status()['sequence']
        assert client.post('/api/data-management/console/action',json={'scope_id':'old-scope','action':'verify'}).status_code==409
        assert app.state.data_management.for_scope(scope).status()['sequence']==before
        result=client.post('/api/data-management/console/action',json={'scope_id':scope,'action':'verify'})
        assert result.status_code==200
        assert result.json()['scope_id']==scope
        response=client.get('/api/data-management/events',params={'scope_id':scope})
        assert response.status_code==200 and response.json()['scope_id']==scope
        assert client.post('/api/data-management/console/action',json={'scope_id':scope,'action':'invented'}).status_code==422
