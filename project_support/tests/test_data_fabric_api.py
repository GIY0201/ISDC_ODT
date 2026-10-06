import httpx
import pytest
from fastapi.testclient import TestClient
from user_application.web.application import create_app
from project_support.tests.test_data_fabric_source import snapshot, oisl

def test_icd_endpoints_and_remote_forwarding():
    from user_application.web.application import create_app

    with TestClient(create_app()) as client:
        status = client.get("/api/data-fabric/status").json()
        assert status["placement"] == "embedded" and status["reachable"] is True
        assert client.post("/api/data-fabric/route", json={"source": "S1", "target": "G1", "objective": "latency"}).json()["status"] == "no_network"
        report = client.post("/api/data-fabric/network", json=snapshot())
        assert report.status_code == 200 and report.json()["summary"]["usable_links"] == 3
        assert client.post("/api/data-fabric/network", json={"time": "x", "nodes": [], "links": []}).status_code == 400
        assert client.post("/api/data-fabric/network", json={"nodes": []}).status_code == 422
        assert client.post("/api/data-fabric/route", json={"source": "S1", "target": "G1", "objective": "fastest"}).status_code == 422
        route = client.post("/api/data-fabric/route", json={"source": "S1", "target": "G1", "objective": "latency"}).json()
        assert route["path"] == ["S1", "S2", "S3", "G1"]

    # A second application acting as the external module answers the same ICD over HTTP.
    from communication.external.data_fabric import RemoteDataFabric

    module_app = create_app()
    with TestClient(module_app) as module_client:
        transport = httpx.MockTransport(lambda request: module_client.request(request.method, request.url.path, content=request.content, headers=dict(request.headers)))
        remote = RemoteDataFabric("http://fabric.example:8792", client=httpx.Client(base_url="http://fabric.example:8792", transport=transport))
        with TestClient(create_app(data_fabric=remote)) as client:
            assert client.get("/api/data-fabric/status").json()["placement"] == "remote"
            assert client.post("/api/data-fabric/network", json=snapshot()).json()["summary"]["satellites_with_ground_path"] == 3
            assert client.post("/api/data-fabric/network", json=snapshot(links=[oisl("S1", "GHOST")])).status_code == 400
    dead = RemoteDataFabric("http://127.0.0.1:9", client=httpx.Client(base_url="http://127.0.0.1:9", transport=httpx.MockTransport(lambda request: (_ for _ in ()).throw(httpx.ConnectError("refused")))))
    with TestClient(create_app(data_fabric=dead)) as client:
        assert client.post("/api/data-fabric/network", json=snapshot()).status_code == 503
        status = client.get("/api/data-fabric/status").json()
        assert status["reachable"] is False and status["placement"] == "remote"


def test_status_and_exchange_do_not_change_paused_twin_or_other_application():
    with TestClient(create_app()) as a, TestClient(create_app()) as b:
        a.post('/api/runtime/control',json={'action':'pause'})
        before=a.get('/api/bootstrap').json()
        assert a.get('/api/data-fabric/status').json()['sequence']==0
        assert a.post('/api/data-fabric/network',json=snapshot()).status_code==200
        assert a.get('/api/bootstrap').json()==before
        assert a.get('/api/data-fabric/status').json()['sequence']==1
        assert b.get('/api/data-fabric/status').json()['sequence']==0
        assert b.post('/api/data-fabric/route',json={'source':'S1','target':'G1'}).json()['status']=='no_network'


@pytest.mark.parametrize('payload',[b'{"time":"2026-09-07T12:00:00Z","nodes":[{"id":"S","kind":"satellite","generation_mbps":NaN}],"links":[]}', b'{"time":"2026-09-07T12:00:00Z","nodes":[],"links":[{"id":"bad","a":"x","b":"y","kind":"oisl","margin_db":Infinity}]}'])
def test_nonfinite_wire_error_never_becomes_internal_server_failure(payload):
    with TestClient(create_app()) as client:
        response=client.post('/api/data-fabric/network',content=payload,headers={'content-type':'application/json'})
        assert response.status_code in (400,422)
        assert client.get('/api/data-fabric/status').json()['sequence']==0


@pytest.mark.parametrize('reply',[httpx.Response(200,text='not JSON'),httpx.Response(200,json=[]),httpx.Response(302,headers={'location':'https://other.example'})])
def test_remote_invalid_success_is_unavailable_not_fabric_report(reply):
    from communication.external.data_fabric import RemoteDataFabric
    remote=RemoteDataFabric('http://fabric.example',client=httpx.Client(base_url='http://fabric.example',transport=httpx.MockTransport(lambda _:reply)))
    with TestClient(create_app(data_fabric=remote)) as client:
        assert client.post('/api/data-fabric/network',json=snapshot()).status_code==503
        assert client.get('/api/data-fabric/status').json()['reachable'] is False
