"""Real product composition of the original ICD-08 security contract."""
import httpx
from fastapi.testclient import TestClient
from user_application.web.application import create_app
from digital_twin.runtime.security import SecurityStandIn
from communication.external.security import RemoteSecurity


def test_real_product_dashboard_provenance_pause_fault_recovery_and_history(monkeypatch):
    monkeypatch.delenv("SPACETWIN_SECURITY_URL",raising=False)
    app,other=create_app(),create_app()
    with TestClient(app) as client:
        assert client.post('/api/runtime/control',json={'action':'pause'}).status_code==200
        first=client.get('/api/security/dashboard');assert first.status_code==200
        assert first.headers['content-type'].startswith('application/json')
        report=first.json();observation=report['overview']['observation']
        assert report['module']['implementation']=='sim-rule-stand-in'
        assert observation['run_id']==report['runtime']['run_id']==report['events']['run_id']
        assert observation['source']=='SIM' and observation['running'] is False
        assert report['overview']['verdict']['integrity']=='unknown'
        assert report['overview']['verdict']['encryption']=='unknown'
        assert report['events']['persistent'] is False
        assert client.get('/api/security/dashboard').json()['events']==report['events']
        assert other.state.security.overview()['observation'] is None
        assert client.post('/api/faults',json={'target':'SAT-01','kind':'link_loss','severity':'medium','duration_seconds':1}).status_code==200
        client.post('/api/runtime/control',json={'action':'step'})
        fault=client.get('/api/security/dashboard').json()
        # Source auth_percent is independent of link_loss; do not invent a security incident.
        assert fault['overview']['verdict']['authentication']=='nominal'
        assert fault['overview']['observation']['sim_elapsed_s']>observation['sim_elapsed_s']
        for _ in range(4): client.post('/api/runtime/control',json={'action':'step'})
        recovered=client.get('/api/security/dashboard').json()
        assert recovered['overview']['verdict']['authentication']=='nominal'
        assert len(recovered['events']['events'])==1
        assert client.get('/api/security/events?after=1').json()['events']==[]
        assert client.get('/api/security/status').json()['run_id']==report['runtime']['run_id']
        assert client.get('/api/security/overview').json()==recovered['overview']
        assert client.post('/api/security/observations',json={'source':'LIVE'}).status_code==422


def test_real_product_injected_remote_failure_no_fallback_and_caller_owns_close(monkeypatch):
    monkeypatch.delenv('SPACETWIN_SECURITY_URL',raising=False)
    remote=RemoteSecurity('http://security.example',client=httpx.Client(transport=httpx.MockTransport(lambda request:httpx.Response(503))))
    app=create_app(security=remote)
    try:
        with TestClient(app) as client:
            response=client.get('/api/security/dashboard');assert response.status_code==503
            report=response.json();assert report['overview'] is None
            assert report['module']['placement']=='remote'
            assert report['module']['endpoint']=='http://security.example'
            assert report['module']['reachable'] is False
            assert client.get('/api/security/status').status_code==503
        assert remote._client.is_closed is False
    finally: remote.close()


def test_real_product_lazy_configured_remote_is_factory_owned(monkeypatch):
    monkeypatch.setenv('SPACETWIN_SECURITY_URL','http://security.example')
    app=create_app();remote=app.state.security
    assert isinstance(remote,RemoteSecurity) and remote._client is None
    with TestClient(app): pass
    assert remote._closed is True


def test_real_product_injected_embedded_module_preserves_identity_and_copies(monkeypatch):
    monkeypatch.delenv('SPACETWIN_SECURITY_URL',raising=False)
    module=SecurityStandIn(authentication_threshold=100)
    app=create_app(security=module);assert app.state.security is module
    with TestClient(app) as client:
        report=client.get('/api/security/dashboard').json()
        assert report['overview']['verdict']['authentication']=='warning'
        report['overview']['observation']['devices'].clear()
        assert module.overview()['observation']['devices']
