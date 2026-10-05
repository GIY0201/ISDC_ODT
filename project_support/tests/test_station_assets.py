from fastapi.testclient import TestClient
from user_application.web.application import create_app

def test_station_model_static_mount_is_readonly_and_excludes_workspace():
 with TestClient(create_app()) as c:
  before=c.get('/api/orbit/state').json()
  for name in ('ground_station_sites.js','station_presets.js'):
   r=c.get('/static/model_library/'+name);assert r.status_code==200;assert 'Object.freeze' in r.text
  assert "./station_presets.js" in c.get('/static/model_library/ground_station_sites.js').text
  traversal=c.get('/static/model_library/%2e%2e/%2e%2e/data/workspace/inputs/orbit/manifest.json');assert traversal.status_code==404
  fallback=c.get('/data/workspace/inputs/orbit/manifest.json');assert fallback.status_code==404 or 'text/html' in fallback.headers['content-type']
  after=c.get('/api/orbit/state').json();before.pop('observed_monotonic_s');after.pop('observed_monotonic_s');assert after==before
