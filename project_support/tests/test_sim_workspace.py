from copy import deepcopy

from fastapi.testclient import TestClient
from user_application.web.application import create_app


def test_reused_sim_control_scenario_reset_and_fault_contract():
    with TestClient(create_app()) as client:
        def control(action):
            return client.post('/api/runtime/control', json={'action': action}).json()
        control('pause')
        before = client.get('/api/bootstrap').json()
        missions = deepcopy(before['missions'])
        client.post('/api/runtime/speed', json={'speed': .1})
        prior = control('pause')['elapsed_seconds']
        assert control('step')['elapsed_seconds'] == prior + 1
        client.post('/api/runtime/speed', json={'speed': 2.5})
        assert control('step')['elapsed_seconds'] == prior + 3.5
        fault = client.post('/api/faults', json=dict(target='test-label', kind='latency_spike', severity='high', duration_seconds=60)).json()
        assert fault['expires_at'] == fault['created_at'] + 60
        reset = control('reset')
        assert not reset['running'] and reset['elapsed_seconds'] == 0
        assert reset['speed'] == 2.5 and reset['active_faults'] == []
        assert reset['run_id'] != before['runtime']['run_id']
        assert client.get('/api/bootstrap').json()['missions'] == missions
        chosen = client.post('/api/scenario/select', json={'scenario_id': 'OISL_STRESS'}).json()
        assert chosen['scenario_id'] == 'OISL_STRESS' and chosen['speed'] == 2.5
        assert not chosen['running'] and chosen['run_id'] != reset['run_id']
        assert client.post('/api/scenario/select', json={'scenario_id': 'missing'}).status_code == 400
        assert client.post('/api/runtime/speed', json={'speed': 0}).status_code == 422
        with client.websocket_connect('/ws/telemetry') as ws:
            frame = ws.receive_json()
            assert frame['runtime']['run_id'] == chosen['run_id']
            assert frame['data_quality']['source'] == 'deterministic-sim'
            assert frame['missions'] == missions
            assert any(e['type'] == 'scenario.loaded' for e in frame['events'])
