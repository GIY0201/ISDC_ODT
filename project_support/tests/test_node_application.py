"""T151 real composition root, isolated ASGI evidence (not live8891)."""
from copy import deepcopy

from fastapi.testclient import TestClient
import pytest

from digital_twin.contracts.data_management import DataManagementUnavailable
from digital_twin.contracts.orbit import OrbitBusy
from digital_twin.runtime.data_management.scopes import ScopedDataManagement
from user_application.node_geometry import NodeGeometryQuery
from user_application.web.application import create_app
from test_node_http import payload, query
from test_node_deployment import command


def pause(client):
    assert client.post('/api/runtime/control',json={'action':'pause'}).status_code==200


def test_composition_mounts_real_node_queries_without_changing_existing_contexts():
    app=create_app(node_geometry_query=query())
    with TestClient(app) as client:
        pause(client)
        before=deepcopy(app.state.runtime.status())
        response=client.post('/api/nodes/samples',json=payload())
        assert response.status_code==200,response.text
        assert response.json()['nodes'][0]['rows'][1]['error_code']=='unsupported_node_time'
        response=client.post('/api/nodes/track',json={'request_id':'app-track','nodes':payload()['nodes'],'center_utc':'2026-10-04T22:01:12Z'})
        assert response.status_code==200 and len(response.json()['nodes'][0]['rows'])==121
        assert app.state.runtime.status()==before
        for url in ['/api/health','/api/bootstrap','/api/orbit/state']:
            assert client.get(url).status_code==200
        assert client.get('/static/scripts/nodes/optical_timeline.js').status_code==200
        assert client.get('/static/styles/satellite_nodes.css').status_code==200


def test_default_node_query_shares_existing_bounded_executor_and_closes_with_app():
    app=create_app()
    assert isinstance(app.state.node_geometry_query,NodeGeometryQuery)
    assert app.state.node_geometry_query.execute.__self__ is app.state.orbit_executor
    with TestClient(app) as client:
        pause(client)
        assert client.get('/api/data-management/deployment').json()['revision']==0
        assert app.state.data_management._scopes=={},'startup/GET must never activate a scope'
    import asyncio
    with pytest.raises(OrbitBusy):asyncio.run(app.state.node_geometry_query.execute(lambda:None))


def test_real_default_scoped_activation_accepts_idempotent_deploy_and_recall_per_app():
    first,second=create_app(),create_app()
    assert first.state.data_management is not second.state.data_management
    assert first.state.data_management_bridge is not second.state.data_management_bridge
    with TestClient(first) as client,TestClient(second) as other:
        pause(client);pause(other)
        initial=client.get('/api/data-management/deployment').json()
        assert initial['nodes']==[] and initial['revision']==0
        response=client.post('/api/data-management/deployment',json=command())
        assert response.status_code==200,response.text
        accepted=response.json()
        assert accepted['revision']==1 and accepted['nodes']==command()['nodes']
        scope=first.state.data_management.for_scope(accepted['scope_id'])
        assert scope.nodes()['nodes'][0]['capacity_gb']==2000
        assert scope.objects()['total']==0,'acceptance must not backfill products'
        assert client.post('/api/data-management/deployment',json=command()).json()==accepted
        assert client.post('/api/data-management/deployment',json=command('conflict')).status_code==409
        assert other.get('/api/data-management/deployment').json()['nodes']==[]
        recall=client.post('/api/data-management/deployment',json=command('recall',1,[]))
        assert recall.status_code==200 and recall.json()['nodes']==[]
        assert first.state.data_management.for_scope(recall.json()['scope_id']).nodes()['nodes']==[]
        assert scope.nodes()['nodes'][0]['capacity_gb']==2000


def test_injected_activation_failure_and_node_busy_are_visible_and_preserve_runtime():
    class Down:
        def for_scope(self,scope):raise DataManagementUnavailable('offline')
    class Busy:
        async def samples(self,*args):raise OrbitBusy('queue full')
    module=ScopedDataManagement()
    app=create_app(data_management=module,node_geometry_query=Busy())
    assert app.state.data_management is module
    with TestClient(app) as client:
        pause(client)
        prior=client.get('/api/data-management/deployment').json()
        runtime=deepcopy(app.state.runtime.status())
        app.state.data_management=Down()
        assert client.post('/api/data-management/deployment',json=command()).status_code==503
        assert client.get('/api/data-management/deployment').json()==prior
        assert client.post('/api/nodes/samples',json=payload()).status_code==503
        assert app.state.runtime.status()==runtime
