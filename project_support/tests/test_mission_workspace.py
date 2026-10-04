from copy import deepcopy

from fastapi.testclient import TestClient
from user_application.web.application import create_app


def test_existing_mission_edit_validate_preview_apply_and_delete():
    app = create_app()
    with TestClient(app) as client:
        client.post('/api/runtime/control', json={'action': 'pause'})
        mission = deepcopy(client.get('/api/bootstrap').json()['missions'][1])
        mid = mission['id']
        payload = dict(mission_id=mid, operation='create', lane='관측', name='First', start=0, duration=10, priority=5)
        first = client.post('/api/missions/tasks', json=payload).json()
        tid = first['mission']['tasks'][0]['id']
        second = client.post('/api/missions/tasks', json={**payload, 'name': 'Overlap', 'start': 5}).json()
        assert second['validation']['conflicts'][0]['type'] == 'lane_overlap'
        before = deepcopy(second['mission'])
        preview = client.post('/api/missions/replan', json={'mission_id': mid, 'apply': False}).json()
        assert preview['applied'] is False
        assert preview['mission'] == before
        assert preview['validation']['valid'] is False
        assert preview['diff'] == [{'task_id': 'T-02', 'field': 'start', 'before': 5, 'after': 11}]
        assert any(e['type'] == 'mission.replanned' for e in client.get('/api/bootstrap').json()['events'])
        applied = client.post('/api/missions/replan', json={'mission_id': mid, 'apply': True}).json()
        assert applied['mission']['plan_version'] == before['plan_version'] + 1
        assert applied['validation']['valid'] is True
        changed = client.post('/api/missions/tasks', json={**payload, 'operation': 'update', 'task_id': tid, 'name': 'Edited', 'predecessor': ''}).json()
        assert changed['mission']['tasks'][0]['name'] == 'Edited'
        deleted = client.post('/api/missions/tasks', json={'mission_id': mid, 'operation': 'delete', 'task_id': tid}).json()
        assert len(deleted['mission']['tasks']) == 1
        assert client.get(f'/api/missions/{mid}/validate').json()['mission_id'] == mid


def test_existing_mission_actions_errors_and_snapshot_copy():
    app = create_app()
    with TestClient(app) as client:
        mid = client.get('/api/bootstrap').json()['missions'][1]['id']
        def action(value):
            return client.post('/api/missions/action', json={'mission_id': mid, 'action': value})
        assert action('pause').status_code == 400
        for value, expected in [('start', 'running'), ('pause', 'paused'), ('start', 'running'), ('abort', 'aborted')]:
            assert action(value).json()['status'] == expected
        assert action('start').status_code == 400
        assert action('complete').json()['progress'] == 100
        assert client.post('/api/missions/tasks', json={'mission_id': mid, 'operation': 'create', 'lane': '관측', 'name': 'Bad', 'start': -1, 'duration': 0}).status_code == 422
        assert client.get('/api/missions/missing/validate').status_code == 400
        copy = client.get('/api/bootstrap').json()
        copy['missions'][1]['name'] = 'changed outside'
        assert client.get('/api/bootstrap').json()['missions'][1]['name'] != 'changed outside'
