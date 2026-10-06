from types import SimpleNamespace
from fastapi import FastAPI
from fastapi.testclient import TestClient
from communication.http.scenarios import router
from user_application.configs.scenarios import scenario_library, scenario_definition, scenario_summaries, validate_definition

def test_source_definition_is_valid_and_read_as_copies():
    original = scenario_definition('SDC_POC_01')
    assert validate_definition(original) == []
    assert original['constellation']['planes'] * original['constellation']['per_plane'] == 40
    assert [step['order'] for step in original['steps']] == [1, 2, 3, 4, 5]
    original['constellation']['planes'] = 0
    assert scenario_definition('SDC_POC_01')['constellation']['planes'] == 4
    assert scenario_definition('LEO_STANDARD') is None
    assert scenario_summaries()[3]['missions'] == 3

def test_source_scenario_router_queries_injected_catalogue_without_runtime_mutation():
    app=FastAPI()
    app.state.scenario_library=scenario_library()
    app.state.runtime=SimpleNamespace(status=lambda: {'scenario_id':'LEO_STANDARD'})
    app.include_router(router)
    with TestClient(app) as client:
        listing=client.get('/api/scenarios').json()
        assert listing['current']=='LEO_STANDARD'
        assert any(s['kind']=='poc' for s in listing['scenarios'])
        detail=client.get('/api/scenarios/SDC_POC_01').json()
        assert detail['missions'][0]['params']['destination']=='satellite:@gateway'
        assert client.get('/api/scenarios/LEO_STANDARD').status_code==404
        assert client.get('/api/scenarios/NOPE').status_code==404
