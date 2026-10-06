import asyncio
import socket
from types import SimpleNamespace
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from communication.http.integration import router, ProbeLink, probe_link, probe_tcp, probe_udp

def client():
    app = FastAPI(); app.include_router(router)
    app.state.runtime = SimpleNamespace(status=lambda: {'running': False, 'sequence': 17}, scenarios=['one'])
    app.state.queries = SimpleNamespace(network=lambda: {'nodes': [1], 'links': []})
    app.state.data_fabric = SimpleNamespace(status=lambda: {'reachable': True, 'placement': 'embedded', 'implementation': 'test-sim', 'version': '1'})
    return TestClient(app)

def test_explicit_probe_reads_real_owners_and_does_not_claim_missing_stubs_alive():
    with client() as c:
        response=c.post('/api/integration/probe',json={'links': [
            {'id': 'L06','transport':'IPC','host':'in-process','endpoints':['framework','engine']},
            {'id': 'L02','transport':'IPC','host':'in-process','endpoints':['framework','data-fabric']},
            {'id': 'L99','transport':'IPC','host':'in-process','endpoints':['framework','undeployed']}]})
        assert response.status_code==200
        results=response.json()['results']
        assert results['L06']['state']=='up' and '17' in results['L06']['detail']
        assert 'test-sim' in results['L02']['detail']
        assert results['L99']['state']=='unverified'

@pytest.mark.parametrize('links',[
 [{'id':'X','transport':'TCP','host':'http://example.test','port':80}],
 [{'id':'X','transport':'TCP','port':-1}],
 [{'id':'X','transport':'TCP','timeout_s':True}],
 [{'id':'X','transport':'TCP','timeout_s':float('inf')}],
 [{'id':'X'},{'id':'X'}],
 [{'id':'X','unknown':True}],
])
def test_invalid_probe_inputs_fail_closed(links):
    with client() as c:
        if any(v.get('timeout_s')==float('inf') for v in links):
            assert c.post('/api/integration/probe',content='{"links":[{"id":"X","timeout_s":1e999}]}',headers={'content-type':'application/json'}).status_code==422
        else: assert c.post('/api/integration/probe',json={'links':links}).status_code==422

def test_tcp_connect_and_udp_resolution_are_different_evidence():
    listener=socket.socket();listener.bind(('127.0.0.1',0));listener.listen(2)
    try: tcp=asyncio.run(probe_tcp('127.0.0.1',listener.getsockname()[1],1))
    finally: listener.close()
    assert tcp['state']=='up' and tcp['method']=='tcp-connect'
    udp=asyncio.run(probe_udp('localhost',5102,1))
    assert udp['state']=='unverified' and udp['method']=='udp-resolve'

def test_external_security_tcp_reachability_is_not_security_validation():
    listener=socket.socket();listener.bind(('127.0.0.1',0));listener.listen(2)
    try:
        link=ProbeLink(id='L17',transport='TCP',host='127.0.0.1',port=listener.getsockname()[1],endpoints=['dt-comm','security-external'])
        result=asyncio.run(probe_link(SimpleNamespace(app=client().app),link))
    finally: listener.close()
    assert result['state']=='unverified' and '프로토콜 미검증' in result['detail']

def test_missing_reachability_does_not_fall_back_to_success():
    app=client().app;app.state.data_fabric=SimpleNamespace(status=lambda: {'implementation':'original'})
    link=ProbeLink(id='L02',transport='IPC',host='in-process',endpoints=['data-fabric','framework'])
    result=asyncio.run(probe_link(SimpleNamespace(app=app),link))
    assert result['state']=='down'

def test_actual_data_module_placement_and_unavailable_contract_are_reported():
    from foundation.data_management_errors import DataManagementUnavailable
    app=client().app;app.state.data_management=SimpleNamespace(status=lambda:{'reachable':True,'implementation':'stand_in','placement':'embedded','endpoint':'in-process'})
    link=ProbeLink(id='L01',transport='IPC',host='in-process',endpoints=['data-dist','framework'])
    result=asyncio.run(probe_link(SimpleNamespace(app=app),link))
    assert result['state']=='up' and 'stand_in' in result['detail']
    def fail():raise DataManagementUnavailable('scope module unreachable')
    app.state.data_management=SimpleNamespace(status=fail)
    assert asyncio.run(probe_link(SimpleNamespace(app=app),link))['state']=='down'

def test_product_factory_probe_reuses_actual_app_modules_without_deploying_nodes():
    from user_application.web.application import create_app
    app=create_app()
    with TestClient(app) as c:
        before=app.state.runtime.status()
        deployment=app.state.runtime.data_deployment()
        payload={'links':[{'id':f'check-{index}','transport':'IPC','host':'in-process','endpoints':['framework',module]} for index,module in enumerate(['engine','model','data-dist','data-fabric','orchestrator','security-ops'])]}
        response=c.post('/api/integration/probe',json=payload)
        assert response.status_code==200
        results=response.json()['results'];assert len(results)==6
        assert all(result['state']=='up' and result['method']=='in-process' for result in results.values())
        after=app.state.runtime.status()
        assert after['run_id']==before['run_id']
        assert app.state.runtime.data_deployment()==deployment
