"""Pinned source display asset identity/static availability, separate from GPU rendering."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urljoin
from fastapi.testclient import TestClient
from project_support.tooling.validate_satellite_display import validate_package,parse_glb

ROOT=Path(__file__).resolve().parents[2]
PACKAGE=ROOT/'digital_twin/model_library/packages/satellite_display/v1'
HEAD='1a1e00297a0301637455b0ef2cf48b2e74576b07'
TERRA_URIS=['..\\Terra.fbm\\Side_Panels_TERRA.tga','..\\Terra.fbm\\solarpanels.tga']

def test_complete_source_manifest_identity_and_all_model_thumbnail_http_bytes():
 from user_application.web.application import create_app
 provenance=json.loads((PACKAGE/'provenance.json').read_text(encoding='utf-8'))
 manifest=json.loads((PACKAGE/'manifest.json').read_text(encoding='utf-8'))
 original=json.loads((PACKAGE/'original_manifest.json').read_text(encoding='utf-8'))
 assert provenance['source_head']==HEAD
 assert hashlib.sha256((PACKAGE/'original_manifest.json').read_bytes()).hexdigest()==provenance['original_manifest_sha256']
 assert len(manifest['models'])==len(original['models'])==56
 assert [m['key'] for m in manifest['models']]==[m['key'] for m in original['models']]
 assert len({m['file'] for m in manifest['models']})==50
 assert len({m['thumbnail'] for m in manifest['models']})==50
 assert provenance['derivatives']==[]
 records=provenance['original_assets'];assert len(records)==100
 with TestClient(create_app()) as client:
  for record in records:
   response=client.get('/static/satellite_display/'+record['file'])
   assert response.status_code==200,record['file']
   assert 'text/html' not in response.headers['content-type'],record['file']
   assert len(response.content)==record['bytes'],record['file']
   assert hashlib.sha256(response.content).hexdigest()==record['sha256'],record['file']

def test_active_dependency_structure_except_explicit_original_terra_defect():
 receipt=validate_package(PACKAGE,decode_images=False)
 assert receipt['mapping_count']==56 and receipt['unique_model_files']==50
 assert receipt['complete'] is False and receipt['render_status']=='unverified'
 assert receipt['errors']==['terra.glb:external_image:0:'+TERRA_URIS[0],'terra.glb:external_image:1:'+TERRA_URIS[1]]
 assert [r['file'] for r in receipt['assets'] if not r['valid']]==['terra.glb']
 for record in receipt['assets']:
  assert all(t['bytes']>0 for t in record['thumbnails'])
  assert all(i['bytes']>0 for i in record['image_checks'])

def test_terra_relative_dependencies_are_missing_and_never_html_success():
 from user_application.web.application import create_app
 document,_=parse_glb((PACKAGE/'terra.glb').read_bytes())
 assert [image['uri'] for image in document['images']]==TERRA_URIS
 assert [t['source'] for t in document['textures']]==[0,1]
 assert document['materials'][2]['pbrMetallicRoughness']['baseColorTexture']['index']==0
 assert document['materials'][4]['pbrMetallicRoughness']['baseColorTexture']['index']==1
 with TestClient(create_app()) as client:
  for uri in TERRA_URIS:
   url=urljoin('/static/satellite_display/terra.glb',uri.replace('\\','/'))
   assert url.startswith('/static/Terra.fbm/')
   assert not (PACKAGE.parent/'Terra.fbm'/uri.replace('\\','/').rsplit('/',1)[-1]).exists()
   response=client.get(url)
   assert response.status_code==404,url

def test_unknown_asset_and_api_namespaces_do_not_become_spa_success():
 from user_application.web.application import create_app
 with TestClient(create_app()) as client:
  for url in ['/api/definitely-missing','/static/definitely-missing','/api','/static']:
   response=client.get(url)
   assert response.status_code==404,url
   assert 'text/html' not in response.headers['content-type'],url
  for url in ['/','/ground','/satellite','/legacy']:
   response=client.get(url)
   assert response.status_code==200,url
   assert 'text/html' in response.headers['content-type'],url
