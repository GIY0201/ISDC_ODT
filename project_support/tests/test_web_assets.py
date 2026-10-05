import re
from urllib.parse import urljoin, urlsplit

from fastapi.testclient import TestClient


def test_every_local_script_import_and_stylesheet_is_served():
    from user_application.web.application import create_app

    with TestClient(create_app()) as client:
        html = client.get('/').text + client.get('/legacy').text
        roots = re.findall(r'(?:src|href)="(/static/[^"?]+)(?:\?[^" ]*)?"', html)
        pending, seen = list(roots), set()
        while pending:
            url = pending.pop()
            if url in seen:
                continue
            seen.add(url)
            result = client.get(url)
            assert result.status_code == 200, url
            assert 'text/html' not in result.headers['content-type'], url
            if url.endswith('.js'):
                for imported in re.findall(r'from\s+["\']([^"\']+)["\']', result.text):
                    pending.append(urlsplit(urljoin(url, imported)).path)
        assert len(seen) >= 15


def test_python_source_and_generated_data_are_not_published():
    from user_application.web.application import create_app

    with TestClient(create_app()) as client:
        for path in ['/static/application.py', '/static/../application.py',
                     '/data/workspace/catalog_cache/active.json.gz', '/main.py']:
            result = client.get(path)
            assert result.status_code == 404 or '<html' in result.text.lower()
            assert 'import FastAPI' not in result.text


def test_versioned_satellite_package_serves_exact_original_assets_only():
    import hashlib
    from user_application.web.application import create_app
    from user_application.configs.paths import VISUALIZATION_DIR
    package = VISUALIZATION_DIR.parent / 'model_library/packages/satellite_display/v1'
    with TestClient(create_app()) as client:
        for name in ['manifest.json', 'iss.glb', 'iss.jpg', 'terra.glb']:
            response = client.get('/static/satellite_display/' + name)
            assert response.status_code == 200
            assert 'text/html' not in response.headers['content-type']
            assert hashlib.sha256(response.content).digest() == hashlib.sha256((package / name).read_bytes()).digest()
        for path in ['%2e%2e/%2e%2e/network.py', '%2e%2e/%2e%2e/%2e%2e/runtime/state.py', 'missing.glb']:
            assert client.get('/static/satellite_display/' + path).status_code == 404
