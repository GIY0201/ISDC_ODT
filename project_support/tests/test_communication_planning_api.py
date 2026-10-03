import math
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from user_application.web.application import create_app


@pytest.mark.parametrize('objective', ['balanced', 'latency', 'reliability'])
def test_preserved_route_matches_independent_fixed_graph_cost(objective):
    app = create_app()
    with TestClient(app) as client:
        before = app.state.runtime.snapshot()
        payload = {'source': 'SAT-01', 'target': 'GS-02', 'objective': objective}
        result = client.post('/api/communication/route', json=payload).json()
        assert result['path'] == ['SAT-01', 'SAT-04', 'GS-02']
        assert result['link_ids'] == ['L03', 'L06']
        expected = sum((18 + (100-q)*1.2) if objective == 'latency' else -math.log(q/100) if objective == 'reliability' else (18+(100-q)*1.2)*.65+(100-q)*1.1 for q in (86,91))
        assert result['cost'] == round(expected, 3)
        assert result['status'] == 'available'
        assert app.state.runtime.snapshot() == before


def test_route_excludes_faults_and_unchanged_gp():
    app = create_app()
    with TestClient(app) as client:
        assert client.post('/api/faults', json={'target':'GS-02','kind':'link_loss'}).status_code == 200
        before = app.state.runtime.snapshot()
        orbit = app.state.runtime.orbit
        result = client.post('/api/communication/route', json={'source':'SAT-01','target':'GS-02','objective':'balanced'}).json()
        assert result['status'] == 'unavailable' and result['path'] == []
        assert 'GS-02' in result['active_fault_targets']
        assert app.state.runtime.orbit is orbit
        assert app.state.runtime.snapshot() == before


@pytest.mark.parametrize('hours', [1,12,72])
def test_contacts_remain_scenario_not_geometric_and_read_only(hours):
    app = create_app()
    with TestClient(app) as client:
        before = app.state.runtime.snapshot()
        result = client.get('/api/communication/contacts',params={'hours':hours}).json()
        assert result['hours'] == hours and result['count'] == 20
        assert result['provenance'] == 'scenario-contact-plan-v1'
        links = {x['id']:x for x in client.get('/api/bootstrap').json()['communication']['links']}
        for row in result['items']:
            link = links[row['link_id']]
            assert row['source'] == link['source'] and row['target'] == link['target']
            assert row['duration_minutes'] == 18+link['quality']%34
            assert (datetime.fromisoformat(row['end'])-datetime.fromisoformat(row['start'])).total_seconds() == row['duration_minutes']*60
            assert row['provenance'] == result['provenance']
        assert app.state.runtime.snapshot() == before


@pytest.mark.parametrize('hours', [0,73,'bad',1.5])
def test_contacts_bad_hours_rejected(hours):
    with TestClient(create_app()) as client:
        assert client.get('/api/communication/contacts',params={'hours':hours}).status_code == 422
