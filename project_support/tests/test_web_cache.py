"""Mutable development modules revalidate without changing API or binary caching."""
from fastapi.testclient import TestClient
from user_application.web.application import create_app


def test_workspace_module_and_manifest_revalidation_contract():
    with TestClient(create_app()) as client:
        for path in ["/", "/static/scripts/workspace.js", "/static/scripts/tabs/catalog_workspace.js", "/static/styles/satellite_nodes.css", "/static/satellite_display/manifest.json"]:
            response = client.get(path)
            assert response.status_code == 200
            assert response.headers.get("cache-control") == "no-cache", path
        path = "/static/scripts/tabs/catalog_workspace.js?v=cache-regression"
        response = client.get(path)
        assert "observeSelection" in response.text
        validator = response.headers["etag"]
        response = client.get(path, headers={"If-None-Match": validator})
        assert response.status_code == 304
        assert response.headers.get("cache-control") == "no-cache"
        for path in ["/api/health", "/static/satellite_display/iss.glb"]:
            response = client.get(path)
            assert response.status_code == 200
            assert response.headers.get("cache-control") != "no-cache", path
