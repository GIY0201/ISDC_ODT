import json
import pytest
from data.orbit_catalog import load_stored_orbit
from project_support.tooling.prepare_orbit_inputs import prepare
from user_application.web.application import create_app
from fastapi.testclient import TestClient

def test_stored_bundle_inputs_hashes_and_overwrite_guard(tmp_path):
    manifest=prepare(tmp_path/'saved')
    bundle=load_stored_orbit(manifest)
    assert len(bundle.inputs)==2 and {r.format for r in bundle.inputs}=={'TLE','OMM'}
    assert all(r.satellite_id==25544 and r.epoch_utc.startswith('2020-07-12') for r in bundle.inputs)
    original=manifest.read_bytes()
    with pytest.raises(FileExistsError):prepare(tmp_path/'saved')
    assert manifest.read_bytes()==original
    item=json.loads(original)['inputs'][0]
    (manifest.parent/item['file']).write_bytes(b'broken')
    with pytest.raises(ValueError,match='hash'):load_stored_orbit(manifest)

def test_manifest_cannot_escape_bundle(tmp_path):
    manifest=prepare(tmp_path/'saved')
    payload=json.loads(manifest.read_text(encoding='utf-8'));payload['inputs'][0]['file']='../outside.tle'
    manifest.write_text(json.dumps(payload),encoding='utf-8')
    with pytest.raises(ValueError,match='outside'):load_stored_orbit(manifest)

def test_configured_server_loads_both_formats_and_matches_results(tmp_path):
    manifest=prepare(tmp_path/'saved')
    with TestClient(create_app(orbit_manifest_path=manifest)) as client:
        records=client.get('/api/orbit/inputs').json()['inputs'];assert len(records)==2
        rows=[]
        for revision,item in enumerate(records):
            selected=client.put('/api/orbit/selection',json=dict(client_request_id='select',expected_revision=revision,input_id=item['input_id'],ground_point=dict(latitude_deg=33.4996,longitude_deg=126.5312,ellipsoid_height_m=0),minimum_elevation_deg=10,anchor_utc=item['epoch_utc'],playing=False,play_rate=1))
            assert selected.status_code==200
            response=client.post('/api/orbit/samples',json=dict(client_request_id='calc',selection_revision=revision+1,input_id=item['input_id'],start_utc=item['epoch_utc'],step_seconds=1,count=3))
            assert response.status_code==200 and response.json()['status']=='complete'
            rows.append(response.json()['rows'])
        import numpy as np
        for a,b in zip(*rows):np.testing.assert_allclose(a['position_m'],b['position_m'],rtol=0,atol=1e-6)

def test_invalid_bundle_is_unavailable_without_breaking_legacy(tmp_path):
    manifest=tmp_path/'missing.json'
    with TestClient(create_app(orbit_manifest_path=manifest)) as client:
        assert client.get('/api/orbit/inputs').status_code==503
        assert client.get('/api/health').status_code==200
