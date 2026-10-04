from copy import deepcopy
from fastapi.testclient import TestClient
from user_application.web.application import create_app
from digital_twin.simulation.mock_hil import apply_device_action, preflight
from digital_twin.model_library.devices import hil_devices


def test_existing_mock_device_and_preflight_golden_copies():
    devices = hil_devices()
    original = deepcopy(devices)
    updated = apply_device_action(devices[2], 'sync')
    assert (updated['latency_ms'], updated['clock_offset_us'], updated['jitter_us'], updated['clock_state']) == (26.2, 21.18, 5.07, 'LOCKED')
    assert apply_device_action(devices[5], 'connect')['health'] == 88
    assert apply_device_action(devices[0], 'loopback')['health'] == 99
    assert devices == original
    status = {'run_id': 'R', 'recording': True}
    assert preflight(devices, status)['status'] == 'BLOCKED'
    devices = [apply_device_action(apply_device_action(d, 'connect'), 'sync') for d in devices]
    assert preflight(devices, status)['status'] == 'READY'
    devices[0]['clock_offset_us'] = 0
    assert not preflight(devices, status)['passed']  # Preserve original `or 999999`.


def test_existing_hil_http_sequence_recording_failures_and_readonly_clock():
    with TestClient(create_app()) as client:
        client.post('/api/runtime/control', json={'action': 'pause'})
        before = client.get('/api/bootstrap').json()
        assert client.post('/api/hil/device', json={'device_id': 'missing', 'action': 'connect'}).status_code == 400
        assert client.post('/api/hil/device', json={'device_id': 'KRS-HIL', 'action': 'sync'}).status_code == 400
        assert client.post('/api/hil/sequence', json={'sequence_id': 'bad'}).status_code == 422
        assert client.post('/api/hil/sequence', json={'sequence_id': 'closed_loop'}).json()['status'] == 'failed'
        for device in before['devices']:
            for action in ['connect', 'sync', 'loopback']:
                assert client.post('/api/hil/device', json={'device_id': device['id'], 'action': action}).status_code == 200
        assert client.get('/api/hil/preflight').json()['status'] == 'READY'
        for kind, count in [('preflight', 4), ('closed_loop', 4), ('fault_recovery', 5)]:
            result = client.post('/api/hil/sequence', json={'sequence_id': kind}).json()
            assert result['status'] == 'completed' and len(result['steps']) == count
        client.post('/api/hil/recording', json={'enabled': False})
        assert client.get('/api/hil/preflight').json()['status'] == 'BLOCKED'
        assert client.post('/api/hil/sequence', json={'sequence_id': 'closed_loop'}).json()['status'] == 'failed'
        after = client.get('/api/bootstrap').json()
        for key in ['elapsed_seconds', 'run_id', 'speed', 'scenario_id', 'sequence']:
            assert before['runtime'][key] == after['runtime'][key]
        assert before['missions'] == after['missions']
        assert any(e['type'] == 'recording.stopped' for e in after['events'])
