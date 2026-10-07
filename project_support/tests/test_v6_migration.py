from fastapi.testclient import TestClient


def test_v6_workspace_is_root_and_legacy_is_preserved():
    from user_application.web.application import create_app

    with TestClient(create_app()) as client:
        page = client.get('/').text
        for name in ('rail-groups', 'work-window', 'window-titlebar', 'screen', 'shelf-restore'):
            assert f'id="{name}"' in page
        assert '/static/scripts/workspace.js' in page
        # The user removed the console shortcut; its preserved route still serves
        # the original console independently of the current workspace.
        assert 'href="/legacy"' not in page
        legacy_response = client.get('/legacy')
        assert legacy_response.status_code == 200
        legacy = legacy_response.text
        assert '/static/scripts/app.js' in legacy
        assert 'id="rail-groups"' not in legacy
        for asset in ('styles/workspace.css', 'scripts/workspace.js', 'assets/branding/aerodt.png', 'assets/nasa_blue_marble_september.jpg'):
            result = client.get('/static/' + asset)
            assert result.status_code == 200
            assert 'text/html' not in result.headers['content-type']


def test_original_v6_snapshot_hashes():
    import hashlib
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / 'docs/ui/v6_source'
    expected = {
        'isdc_odt_v6.html': '4e096aea64c1c9beac3218ff40bbe7f6bdd5b3f16750ae92ef3ac16da8c64c5b',
        'isdc_odt_v6.css': 'c0ab17d9d496dd3eb78d984a661793d1cc266fde9c03ed7643dcc16b97a0e262',
        'isdc_odt_v6.js': '7301c5872fd19cb4260dca1424398f37605d425c31397f08022e97feba9fd2c6',
    }
    for name, digest in expected.items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
