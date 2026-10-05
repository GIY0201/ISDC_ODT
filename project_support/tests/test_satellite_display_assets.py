"""Validate actual active glTF dependencies, not only container headers."""
import base64
import copy
import hashlib
import json
import struct
import subprocess
import sys
from pathlib import Path

import pytest

from project_support.tooling.validate_satellite_display import inspect_glb, parse_glb, validate_package
from project_support.tooling.repair_satellite_display import embed_png_images

ROOT = Path(__file__).resolve().parents[2]
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')


def glb(document, binary=b''):
    text = json.dumps(document, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    chunks = struct.pack('<I4s', len(text), b'JSON') + text
    if binary:
        binary += b'\0' * (-len(binary) % 4)
        chunks += struct.pack('<I4s', len(binary), b'BIN\0') + binary
    return b'glTF' + struct.pack('<II', 2, len(chunks) + 12) + chunks


def document(external=False):
    return {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': len(PNG)}],
            'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(PNG)}],
            'images': [{'uri': '..\\Terra.fbm\\missing.tga'}] if external else [{'bufferView': 0, 'mimeType': 'image/png'}],
            'textures': [{'source': 0}], 'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}],
            'meshes': [{'primitives': [{'attributes': {}, 'material': 0}]}],
            'nodes': [{'mesh': 0}], 'scenes': [{'nodes': [0]}], 'scene': 0}


def package(tmp_path):
    data = glb(document(), PNG)
    model = {'key': 'tiny', 'file': 'tiny.glb', 'thumbnail': 'tiny.png', 'provider': 'nasa',
             'title': 'Tiny', 'label': 'Tiny', 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    manifest = {'schema': 2, 'models': [model], 'representatives': {'payload:LEO': 'tiny'},
                'sources': {'nasa': {'credit': 'NASA', 'repository': 'https://www.nasa.gov/'}}}
    raw = json.dumps(manifest).encode()
    (tmp_path / 'tiny.glb').write_bytes(data)
    (tmp_path / 'tiny.png').write_bytes(PNG)
    (tmp_path / 'manifest.json').write_bytes(raw)
    (tmp_path / 'original_manifest.json').write_bytes(raw)
    provenance = {'schema': 1, 'source_head': '1' * 40, 'original_manifest_sha256': hashlib.sha256(raw).hexdigest(),
                  'original_assets': [{'file': name, 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)}
                                      for name, content in [('tiny.glb', data), ('tiny.png', PNG)]], 'derivatives': []}
    (tmp_path / 'provenance.json').write_text(json.dumps(provenance))
    return tmp_path


def test_active_embedded_image_and_external_dependency_are_distinguished():
    good = inspect_glb(glb(document(), PNG))
    assert good['valid'] and good['active_image_indices'] == [0]
    bad = inspect_glb(glb(document(external=True), PNG))
    assert not bad['valid']
    assert any('external_image' in value and 'missing.tga' in value for value in bad['errors'])
    # An unused export image must not become a false active-render dependency.
    d = document(); d['images'].append({'uri': 'unused.tga'})
    assert inspect_glb(glb(d, PNG))['valid']


@pytest.mark.parametrize('change', [
    lambda d: d['buffers'][0].update(byteLength=1),
    lambda d: d['bufferViews'][0].update(byteOffset=999999),
    lambda d: d['bufferViews'][0].update(buffer=9),
    lambda d: d['images'][0].update(bufferView=9),
    lambda d: d['images'][0].update(mimeType='image/jpeg'),
    lambda d: d['textures'][0].update(source=9),
    lambda d: d['meshes'][0]['primitives'][0].update(material=9),
    lambda d: d['nodes'][0].update(children=[0]),
    lambda d: d.update(extensionsRequired=['UNSUPPORTED_vendor_extension']),
])
def test_invalid_active_references_ranges_mime_and_required_extensions_fail(change):
    d = document(); change(d)
    assert not inspect_glb(glb(d, PNG))['valid']


def test_container_corruption_and_texture_extension_reference_fail():
    data = glb(document(), PNG)
    for bad in [b'', data[:-1], b'xxxx' + data[4:], data[:4] + struct.pack('<I', 1) + data[8:]]:
        with pytest.raises(ValueError): parse_glb(bad)
        assert not inspect_glb(bad)['valid']
    d = document(); d['textures'][0] = {'extensions': {'EXT_texture_webp': {'source': 99}}}
    assert not inspect_glb(glb(d, PNG))['valid']


def test_package_hash_thumbnail_provenance_and_mapping_coverage_are_readonly(tmp_path):
    root = package(tmp_path)
    before = {p.name: p.read_bytes() for p in root.iterdir()}
    receipt = validate_package(root)
    assert receipt['complete'] and receipt['unique_model_files'] == 1
    assert receipt['render_status'] == 'unverified'
    assert {p.name: p.read_bytes() for p in root.iterdir()} == before
    (root / 'tiny.png').write_bytes(b'not an image')
    failed = validate_package(root)
    assert not failed['complete'] and any('tiny.png' in error for error in failed['errors'])


def test_package_paths_and_dropped_original_models_never_pass(tmp_path):
    root = package(tmp_path)
    m = json.loads((root / 'manifest.json').read_text())
    m['models'][0]['file'] = '../secret.glb'
    (root / 'manifest.json').write_text(json.dumps(m))
    assert not validate_package(root)['complete']
    m['models'] = []
    (root / 'manifest.json').write_text(json.dumps(m))
    assert not validate_package(root)['complete']


def test_missing_provenance_or_original_asset_hash_is_not_acceptance(tmp_path):
    root = package(tmp_path)
    p = root / 'provenance.json'
    record = json.loads(p.read_text()); record['original_assets'][0]['sha256'] = '0' * 64
    p.write_text(json.dumps(record))
    assert not validate_package(root)['complete']
    p.unlink()
    assert not validate_package(root)['complete']


def test_embedding_preserves_geometry_material_indices_and_original_bytes():
    d = document(external=True); source = glb(d, PNG)
    original = bytes(source); before = copy.deepcopy(d)
    derived, ledger = embed_png_images(source, {d['images'][0]['uri']: PNG})
    repaired, binary = parse_glb(derived)
    assert source == original and d == before
    for key in ['meshes', 'materials', 'textures', 'nodes', 'scenes']:
        assert repaired[key] == before[key]
    image = repaired['images'][0]; assert 'uri' not in image and image['mimeType'] == 'image/png'
    view = repaired['bufferViews'][image['bufferView']]
    assert view['byteOffset'] % 4 == 0
    assert binary[view['byteOffset']:view['byteOffset'] + view['byteLength']] == PNG
    assert ledger['original_sha256'] == hashlib.sha256(original).hexdigest()
    assert ledger['derived_sha256'] == hashlib.sha256(derived).hexdigest()
    assert inspect_glb(derived)['valid']
    with pytest.raises(ValueError): embed_png_images(source, {})
    with pytest.raises(ValueError): embed_png_images(source, {d['images'][0]['uri']: b'fake png'})


def test_cli_exit_status_does_not_turn_failed_assets_into_success(tmp_path):
    root = package(tmp_path)
    command = [sys.executable, str(ROOT / 'project_support/tooling/validate_satellite_display.py'), str(root)]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    assert result.returncode == 0 and json.loads(result.stdout)['complete']
    (root / 'tiny.glb').write_bytes(b'bad')
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    assert result.returncode == 1 and not json.loads(result.stdout)['complete']
