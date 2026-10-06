"""Pinned source display asset identity/static availability, separate from GPU rendering."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urljoin
from project_support.tooling.validate_satellite_display import validate_package,parse_glb

ROOT=Path(__file__).resolve().parents[2]
PACKAGE=ROOT/'digital_twin/model_library/packages/satellite_display/v1'
HEAD='1a1e00297a0301637455b0ef2cf48b2e74576b07'
TERRA_URIS=['..\\Terra.fbm\\Side_Panels_TERRA.tga','..\\Terra.fbm\\solarpanels.tga']

def test_complete_source_manifest_identity_and_all_model_thumbnail_http_bytes():
 from fastapi.testclient import TestClient
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
 assert [r['original_file'] for r in provenance['derivatives']]==['terra.glb','jason.glb']
 records=provenance['original_assets'];assert len(records)==100
 with TestClient(create_app()) as client:
  for record in records:
   response=client.get('/static/satellite_display/'+record['file'])
   assert response.status_code==200,record['file']
   assert 'text/html' not in response.headers['content-type'],record['file']
   assert len(response.content)==record['bytes'],record['file']
   assert hashlib.sha256(response.content).hexdigest()==record['sha256'],record['file']

def test_active_dependency_structure_reports_source_uv_defects_after_texture_recovery():
 receipt=validate_package(PACKAGE,decode_images=False)
 assert receipt['mapping_count']==56 and receipt['unique_model_files']==50
 assert receipt['complete'] is True and receipt['render_status']=='unverified'
 assert receipt['errors']==[]
 assert [r['file'] for r in receipt['assets'] if not r['valid']]==[]
 for record in receipt['assets']:
  assert all(t['bytes']>0 for t in record['thumbnails'])
  assert all(i['bytes']>0 for i in record['image_checks'])

def test_jason_solid_backside_restoration_preserves_front_texture_and_all_geometry():
 import copy
 original=(PACKAGE/'jason.glb').read_bytes()
 assert hashlib.sha256(original).hexdigest()=='22139020d17a118aeedfa95b8295712b60f1ed992dcd6770b7a59bac57ea225b'
 before,binary=parse_glb(original)
 after,repaired_binary=parse_glb((PACKAGE/'jason_repaired.glb').read_bytes())
 expected=copy.deepcopy(before)
 expected['materials'][7]['pbrMetallicRoughness'].pop('baseColorTexture')
 expected['materials'][7]['pbrMetallicRoughness']['baseColorFactor']=[0.27450981736183167,0.27450981736183167,0.29019609093666077,1]
 assert after==expected and binary==repaired_binary
 assert 'TEXCOORD_0' in after['meshes'][7]['primitives'][0]['attributes']
 front=after['meshes'][7]['primitives'][0]['material']
 assert after['materials'][front]['pbrMetallicRoughness']['baseColorTexture']==before['materials'][front]['pbrMetallicRoughness']['baseColorTexture']
 ledger=json.loads((PACKAGE/'jason_repaired_provenance.json').read_text(encoding='utf-8'))
 assert ledger['historical_source']['glb_sha256']=='ef1439afeabf031a5030bec2f2d996e336a84256af2c10454187bbb7d761eafc'
 assert ledger['historical_source']['fbx_sha256']=='02f6f458615a42b0ca2f6da483f46b4c44d4b9002e2929d34f436ab303aabc4e'
 correction=ledger['material_corrections'][0]
 assert correction['material']==7 and correction['consumers']==[{'mesh':2,'primitive':0}]
 assert correction['geometry'][0]['sha256']=='be0d56ee659462c346d8d6bda7568ce0821d3f2cbcdf02f1811615101d1e3dbe'
 assert ledger['fbx_material_proof']['texture_connections']==[] and ledger['fbx_material_proof']['opacity']==1.0
 assert ledger['lineage_limitation'] and ledger['render_status']=='unverified'

def test_terra_relative_dependencies_are_missing_and_never_html_success():
 from fastapi.testclient import TestClient
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
 from fastapi.testclient import TestClient
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

def test_recovered_terra_preserves_original_geometry_and_verified_texture_pixels():
 import io
 import pytest
 manifest=json.loads((PACKAGE/'manifest.json').read_text(encoding='utf-8'))
 model=next(m for m in manifest['models'] if m['key']=='terra')
 assert model['file']=='terra_repaired.glb'
 original=(PACKAGE/'terra.glb').read_bytes()
 assert hashlib.sha256(original).hexdigest()=='8794857595f7a7d416184fe926ecb50e11bf267dbe471d1cf2728a85e8d017fa'
 before,binary_before=parse_glb(original)
 after,binary_after=parse_glb((PACKAGE/model['file']).read_bytes())
 for key in ['materials','textures','nodes','scenes']:
  assert after[key]==before[key]
 assert after['accessors'][:len(before['accessors'])]==before['accessors']
 import copy
 unchanged_meshes=copy.deepcopy(after['meshes'])
 for mesh in [14,16]:
  assert 'TEXCOORD_0' in unchanged_meshes[mesh]['primitives'][0]['attributes']
  unchanged_meshes[mesh]['primitives'][0]['attributes'].pop('TEXCOORD_0')
 assert unchanged_meshes==before['meshes']
 assert binary_after[:before['buffers'][0]['byteLength']]==binary_before[:before['buffers'][0]['byteLength']]
 ledger=json.loads((PACKAGE/'terra_repaired_provenance.json').read_text(encoding='utf-8'))
 assert ledger['texture_source']['commit']=='2b93e26d1b8705c97b39106b62e938144268cc81'
 assert ledger['texture_source']['fbx_sha256']=='c912aa59e47c28ec65a78e5832c8c8c0e524d7ef75d64cf74a96244979c474ea'
 assert ledger['source_authority_status']=='official_nasa_git_history_verified'
 assert ledger['lineage_limitation']
 uv_ledger=ledger['uv_restoration']
 assert uv_ledger['fbx_sha256']=='5c469714db6aefe6134b119855bc96ce322e4fee4ee60463f63ca48b44f4fed8'
 assert [r['vertex_count'] for r in uv_ledger['meshes']]==[88,80]
 for row in uv_ledger['meshes']:
  assert row['position_float32_bijection'] and row['topology_same_winding']
  assert sorted(row['vertex_permutation'])==list(range(row['vertex_count']))
  accessor=after['accessors'][row['accessor']]
  assert accessor['componentType']==5126 and accessor['type']=='VEC2' and accessor['count']==row['vertex_count']
  view=after['bufferViews'][accessor['bufferView']]
  assert hashlib.sha256(binary_after[view['byteOffset']:view['byteOffset']+view['byteLength']]).hexdigest()==row['texcoord_sha256']
 Image=pytest.importorskip('PIL.Image',reason='Run pixel checks in explicitly selected Pillow environment')
 expected=['a678be2e867a77429699c4905fb8053572921a02fe1e740751959a98db829dab','46bcc28d70b6b5029c9ecd2bf3303431432cd318950d364767e6510dfe6e5358']
 for image,pixel_hash in zip(after['images'],expected,strict=True):
  assert 'uri' not in image and image['mimeType']=='image/png'
  view=after['bufferViews'][image['bufferView']]
  with Image.open(io.BytesIO(binary_after[view['byteOffset']:view['byteOffset']+view['byteLength']])) as decoded:
   assert hashlib.sha256(decoded.convert('RGBA').tobytes()).hexdigest()==pixel_hash
