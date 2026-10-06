from fastapi.testclient import TestClient
from user_application.web.application import create_app

def test_source_forward_advance_uses_existing_runtime_and_expires_faults():
    app=create_app()
    with TestClient(app) as client:
        client.post('/api/runtime/control',json={'action':'pause'})
        before=app.state.runtime.status()
        client.post('/api/faults',json={'target':'A','kind':'link_loss','severity':'medium','duration_seconds':10})
        result=client.post('/api/scenario/advance',json={'seconds':30})
        assert result.status_code==200 and result.headers['content-type'].startswith('application/json')
        report=result.json()
        assert report['elapsed_seconds']==before['elapsed_seconds']+30
        assert report['running'] is False and report['run_id']==before['run_id']
        assert report['active_faults']==[]
        assert any(e['type']=='runtime.advance' for e in app.state.runtime.events)
        for seconds in [0,-1,3601]:
            assert client.post('/api/scenario/advance',json={'seconds':seconds}).status_code==422
        assert app.state.runtime.status()['elapsed_seconds']==report['elapsed_seconds']
