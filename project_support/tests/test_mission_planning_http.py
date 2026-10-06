from communication.external.orchestration import RemoteOrchestration
from digital_twin.contracts.orchestration import OrchestrationUnavailable
import httpx
import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from digital_twin.runtime.mission_planning.exchange import MissionPlanningExchange
from project_support.tests.test_mission_planning_source import T0, at, request, observe, satellite, access, contact
from project_support.tests.test_mission_planning_commit_source import TASKS

def create_app(*, orchestration=None):
    from communication.http.orchestration import router
    app=FastAPI()
    app.state.orchestration=orchestration if orchestration is not None else MissionPlanningExchange()
    app.include_router(router)
    @app.exception_handler(ValueError)
    async def invalid(request,error):
        return JSONResponse(status_code=400,content={'detail':str(error)})
    return app

def test_icd_endpoints_and_remote_forwarding():

    sats = [satellite("S1")]
    windows = {"target_access": [access("S1", 30, 38)], "contacts": [contact("S1", "GS-DAEJEON", 60, 70)]}
    body = request(observe(), sats, windows)
    with TestClient(create_app()) as client:
        assert client.get("/api/orchestration/status").json()["placement"] == "embedded"
        answer = client.post("/api/orchestration/plan", json=body)
        assert answer.status_code == 200 and answer.json()["feasible"] is True and answer.json()["sequence"] == 1
        assert client.post("/api/orchestration/plan", json={"time": T0, "mission": {"id": "X", "kind": "nap", "deadline": at(60)}}).status_code == 422
        assert client.post("/api/orchestration/plan", json={"time": T0, "mission": {"id": "X", "kind": "observe", "deadline": T0}}).status_code == 400
    from communication.external.orchestration import RemoteOrchestration

    module_app = create_app()
    with TestClient(module_app) as module_client:
        transport = httpx.MockTransport(lambda req: module_client.request(req.method, req.url.path, content=req.content, headers=dict(req.headers)))
        remote = RemoteOrchestration("http://ops.example:5103", client=httpx.Client(base_url="http://ops.example:5103", transport=transport))
        with TestClient(create_app(orchestration=remote)) as client:
            assert client.get("/api/orchestration/status").json()["placement"] == "remote"
            assert client.post("/api/orchestration/plan", json=body).json()["feasible"] is True
    dead = RemoteOrchestration("http://127.0.0.1:9", client=httpx.Client(base_url="http://127.0.0.1:9", transport=httpx.MockTransport(lambda req: (_ for _ in ()).throw(httpx.ConnectError("refused")))))
    with TestClient(create_app(orchestration=dead)) as client:
        assert client.post("/api/orchestration/plan", json=body).status_code == 503
        assert client.get("/api/orchestration/status").json()["reachable"] is False


def test_commit_endpoint_and_status_expose_the_confirmed_plan():
    with TestClient(create_app()) as client:
        response = client.post("/api/orchestration/commit", json={"time": T0, "mission_id": "MSN-0007", "decision": "commit", "version": 1, "tasks": TASKS})
        assert response.status_code == 200 and response.json()["held_tasks"] == 2
        assert client.get("/api/orchestration/status").json()["committed"]["MSN-0007"]["tasks"] == 2
        assert client.post("/api/orchestration/commit", json={"time": T0, "mission_id": "MSN-0007", "decision": "later"}).status_code == 422


def test_remote_forwarder_relays_commit_and_reports_outages():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path.endswith("/commit"):
            return httpx.Response(200, json={"accepted": True, "held_tasks": 2, "sequence": 9})
        return httpx.Response(500)

    remote = RemoteOrchestration("http://module.example", client=httpx.Client(base_url="http://module.example", transport=httpx.MockTransport(handler)))
    assert remote.commit({"time": T0, "mission_id": "MSN-0001", "decision": "commit", "tasks": TASKS})["sequence"] == 9
    with pytest.raises(OrchestrationUnavailable):
        remote.plan({"time": T0})
    assert calls == ["/api/orchestration/commit", "/api/orchestration/plan"]
