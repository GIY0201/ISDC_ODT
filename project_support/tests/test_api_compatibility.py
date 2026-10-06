import json
from pathlib import Path

from user_application.web.application import create_app


def test_openapi_matches_pre_refactoring_contract():
    # Captured from the verified original ZIP using an isolated Python process.
    baseline = json.loads((Path(__file__).parent / 'fixtures/original_openapi.json').read_text(encoding='utf-8'))
    current = create_app().openapi()
    # Keep every original path/schema exact; approved additions are explicit.
    added_paths = set(current['paths']) - set(baseline['paths'])
    assert added_paths == {'/api/orbit/inputs', '/api/orbit/state', '/api/orbit/selection', '/api/orbit/samples', '/api/orbit/visibility', '/api/orbit/radio-geometry', '/api/orbit/radio-series', '/api/communication/iss-receive-profile', '/api/catalog/position', '/api/catalog/samples', '/api/catalog/scene', '/api/catalog/track', '/api/catalog/visibility', '/api/solar/samples', '/api/nodes/samples', '/api/nodes/track', '/api/data-management/deployment', '/api/data-fabric/network', '/api/data-fabric/route', '/api/data-fabric/status', '/api/nodes/mission-windows'}
    for path in added_paths:
        del current['paths'][path]
    added_schemas = set(current['components']['schemas']) - set(baseline['components']['schemas'])
    assert added_schemas == {'GroundPointRequest', 'SelectionRequest', 'SamplesRequest', 'VisibilityRequest', 'RadioGeometryRequest', 'RadioSeriesRequest', 'CatalogPositionRequest', 'CatalogSamplesRequest', 'CatalogSceneRequest', 'CatalogTrackRequest', 'CatalogVisibilityRequest', 'SolarSamplesRequest', 'NodeSamplesRequest', 'NodeTrackRequest', 'DataDeploymentCommand', 'DeploymentNode', 'DeploymentEquipment', 'NetworkNode', 'NetworkLink', 'NetworkSnapshot', 'FabricRouteRequest', 'MissionWindowRequest', 'WindowSiteRequest', 'AccessTargetRequest', 'ExternalWindowRequest'}
    for schema in added_schemas:
        del current['components']['schemas'][schema]
    assert current == baseline
