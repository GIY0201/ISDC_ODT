import json
from pathlib import Path

from user_application.web.application import create_app


def test_openapi_matches_pre_refactoring_contract():
    # Captured from the verified original ZIP using an isolated Python process.
    baseline = json.loads((Path(__file__).parent / 'fixtures/original_openapi.json').read_text(encoding='utf-8'))
    current = create_app().openapi()
    # Keep every original path/schema exact; approved additions are explicit.
    added_paths = set(current['paths']) - set(baseline['paths'])
    assert added_paths == {'/api/orbit/inputs', '/api/orbit/state', '/api/orbit/selection', '/api/orbit/samples', '/api/orbit/visibility', '/api/orbit/radio-geometry', '/api/orbit/radio-series', '/api/communication/iss-receive-profile', '/api/catalog/position', '/api/catalog/samples', '/api/catalog/scene', '/api/catalog/track', '/api/catalog/visibility', '/api/solar/samples', '/api/nodes/samples', '/api/nodes/track', '/api/data-management/deployment', '/api/data-fabric/network', '/api/data-fabric/route', '/api/data-fabric/status', '/api/nodes/mission-windows', '/api/nodes/mission-context', '/api/orchestration/plan', '/api/orchestration/commit', '/api/orchestration/status'} | {'/api/security/observations', '/api/data-management/status', '/api/data-management/console/action', '/api/security/dashboard', '/api/security/status', '/api/data-management/nodes', '/api/integration/probe', '/api/security/overview', '/api/scenarios/{scenario_id}', '/api/scenarios', '/api/data-management/events', '/api/data-management/requests', '/api/scenario/advance', '/api/data-management/console/request', '/api/data-management/console/snapshot', '/api/security/events', '/api/data-management/dashboard', '/api/data-management/overview', '/api/data-management/actions', '/api/data-management/ingest', '/api/data-management/objects'}
    for path in added_paths:
        del current['paths'][path]
    added_schemas = set(current['components']['schemas']) - set(baseline['components']['schemas'])
    assert added_schemas == {'GroundPointRequest', 'SelectionRequest', 'SamplesRequest', 'VisibilityRequest', 'RadioGeometryRequest', 'RadioSeriesRequest', 'CatalogPositionRequest', 'CatalogSamplesRequest', 'CatalogSceneRequest', 'CatalogTrackRequest', 'CatalogVisibilityRequest', 'SolarSamplesRequest', 'NodeSamplesRequest', 'NodeTrackRequest', 'DataDeploymentCommand', 'DeploymentNode', 'DeploymentEquipment', 'NetworkNode', 'NetworkLink', 'NetworkSnapshot', 'FabricRouteRequest', 'MissionWindowRequest', 'WindowSiteRequest', 'AccessTargetRequest', 'ExternalWindowRequest', 'MissionContextRequest', 'MissionRequest', 'PlanWindows', 'CommitRequest', 'PlanRequest'} | {'ScenarioAdvance', 'StorageTopology', 'DataServiceRequest', 'DataIngestMessage', 'SecurityObservation', 'ConsoleActionRequest', 'ConsoleServiceRequest', 'DataProduct', 'DataActionRequest', 'StorageNodeRecord'}
    for schema in added_schemas:
        del current['components']['schemas'][schema]
    assert current == baseline
