from user_application import cli


def test_local_entrypoint_uses_fixed_development_port(monkeypatch):
    calls = []
    monkeypatch.setattr(cli.uvicorn, 'run', lambda *args, **kwargs: calls.append(kwargs))
    cli.main(['--host', '127.0.0.1', '--no-browser'])
    assert calls[0]['host'] == '127.0.0.1'
    assert calls[0]['port'] == 8891
