import json
import os
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from data.workspace_configuration import PostgresWorkspaceConfiguration, ConfigurationConflict
from user_application.web.application import create_app


@pytest.fixture
def repository():
    path = os.environ.get('ISDC_TEST_DATABASE_CONFIG')
    if not path:
        pytest.skip('explicit PostgreSQL test connection required')
    config = json.loads(Path(path).read_text(encoding='utf-8'))
    repo = PostgresWorkspaceConfiguration(config['app'], workspace_id='test-' + uuid4().hex)
    yield repo
    repo.remove_test_workspace()


def test_postgres_roundtrip_conflict_and_history(repository):
    value = {'schema': 1, 'sequence': 0, 'selectedId': None, 'stations': []}
    assert repository.read('ground_stations')['revision'] == 0
    first = repository.save('ground_stations', value, 0)
    assert first['revision'] == 1
    other = PostgresWorkspaceConfiguration(repository.connection, workspace_id=repository.workspace_id)
    assert other.read('ground_stations') == first
    with pytest.raises(ConfigurationConflict):
        other.save('ground_stations', {**value, 'sequence': 2}, 0)
    assert repository.read('ground_stations') == first
    assert repository.history('ground_stations')[0]['value'] == value
    with pytest.raises(ValueError):
        repository.save('ground_stations', {**value, 'stations': [{'latitude': float('nan')}]}, 1)
    assert repository.read('ground_stations') == first


def test_configuration_api_uses_injected_store_and_rejects_cross_origin(repository):
    with TestClient(create_app(workspace_configuration=repository)) as client:
        path = '/api/workspace/configurations/ground_stations'
        value = {'schema': 1, 'sequence': 0, 'selectedId': None, 'stations': []}
        assert client.get(path).json()['revision'] == 0
        body = {'expected_revision': 0, 'value': value}
        assert client.put(path, json=body).status_code == 403
        headers = {'X-ISDC-Configuration': '1'}
        assert client.put(path, json=body, headers={**headers, 'Origin': 'https://unrelated.invalid'}).status_code == 403
        assert client.put(path, json=body, headers=headers).status_code == 200
        assert client.put(path, json=body, headers=headers).status_code == 409
        assert client.get('/api/workspace/configurations/arbitrary').status_code == 404


def test_unconfigured_database_is_explicit():
    with TestClient(create_app()) as client:
        assert client.get('/api/workspace/configurations/status').json()['enabled'] is False
        assert client.get('/api/workspace/configurations/ground_stations').status_code == 503
