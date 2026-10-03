import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from digital_twin.model_library.rf_receive_profile import load_iss_receive_profile
from user_application.web.application import create_app


def test_official_partial_profile_has_only_confirmed_frequency_and_copy():
    profile = load_iss_receive_profile()
    assert profile['known_inputs'] == {'frequency_ghz': pytest.approx(.437825)}
    assert profile['frequency_mhz'] / 1000 == pytest.approx(profile['known_inputs']['frequency_ghz'], abs=1e-12)
    assert profile['source']['status_as_of'] == '2026-09-25'
    assert profile['source']['checked_utc'].endswith('Z')
    assert profile['communication_status'] == 'unknown'
    assert profile['equipment_status'] == 'not_selected'
    assert profile['station'] == 'RS0ISS'
    assert len(profile['profile_sha256']) == 64
    profile['known_inputs']['frequency_ghz'] = 26
    assert load_iss_receive_profile()['known_inputs']['frequency_ghz'] == .437825


def test_endpoint_does_not_select_or_mutate_orbit():
    app = create_app()
    with TestClient(app) as client:
        before = app.state.runtime.snapshot()
        orbit = app.state.runtime.orbit
        response = client.get('/api/communication/iss-receive-profile')
        assert response.status_code == 200
        assert response.json() == load_iss_receive_profile()
        assert app.state.runtime.orbit is orbit
        assert app.state.runtime.snapshot() == before


@pytest.mark.parametrize('change', ['frequency', 'hash', 'status', 'extra', 'missing', 'nan'])
def test_corrupt_package_is_rejected_without_fallback(tmp_path, change):
    source = Path(__file__).resolve().parents[2] / 'digital_twin/model_library/packages/iss_aprs_receive_v1'
    data = json.loads((source / 'profile.json').read_text(encoding='utf-8'))
    manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
    if change == 'frequency': data['frequency_mhz'] = 145.825
    if change == 'hash': manifest['profile_sha256'] = '0' * 64
    if change == 'status': data['communication_status'] = 'pass'
    if change == 'extra': data['known_inputs']['tx_power_w'] = 25
    if change == 'missing': del data['source']
    if change == 'nan': data['known_inputs']['frequency_ghz'] = float('nan')
    (tmp_path / 'profile.json').write_text(json.dumps(data), encoding='utf-8')
    (tmp_path / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    with pytest.raises(ValueError): load_iss_receive_profile(tmp_path)


def test_missing_package_is_domain_error(tmp_path):
    with pytest.raises(ValueError): load_iss_receive_profile(tmp_path)
