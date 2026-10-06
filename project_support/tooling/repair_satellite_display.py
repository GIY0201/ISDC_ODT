"""Explicit offline texture embedding; never invent or remove missing textures.

An authoritative texture/source receipt is required before a repaired production
asset can be accepted. Synthetic tests prove conversion mechanics only.
"""
from __future__ import annotations

import argparse
import copy
import io
import json
import struct
import collections
import math
import zlib
from pathlib import Path

if __package__:
    from .validate_satellite_display import _image, inspect_glb, parse_glb, sha256
else:
    from validate_satellite_display import _image, inspect_glb, parse_glb, sha256


def convert_to_png(data: bytes) -> tuple[bytes, dict]:
    try:
        from PIL import Image
        from PIL import __version__
    except ImportError as error:
        raise ValueError('Select a Python environment with Pillow explicitly; runtime dependencies are unchanged.') from error
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            fmt, size = image.format, image.size
            converted = image.convert('RGBA')
        stream = io.BytesIO()
        converted.save(stream, format='PNG', optimize=False, compress_level=9)
        png = stream.getvalue()
        _image(png, 'image/png', True)
    except (OSError, ValueError) as error:
        raise ValueError('texture_conversion_failed') from error
    return png, {'source_format': fmt, 'source_sha256': sha256(data), 'png_sha256': sha256(png),
                 'width': size[0], 'height': size[1], 'converter': f'Pillow {__version__}', 'output_format': 'PNG RGBA'}


def match_source_uv_vertices(source_positions, source_polygon_indices, source_uv, positions, indices):
    """Require an exact float32 vertex permutation and same-winding triangle multiset."""
    if len(source_uv) != len(source_positions) or len(positions) != len(source_positions):
        raise ValueError('source_uv_vertex_count')
    lookup = {}
    for number, position in enumerate(source_positions):
        if len(position) != 3 or not all(math.isfinite(x) for x in position):
            raise ValueError('source_position_invalid')
        key = struct.pack('<3f', *position)
        if key in lookup:
            raise ValueError('ambiguous_source_position')
        lookup[key] = number
    try:
        permutation = [lookup[struct.pack('<3f', *p)] for p in positions]
    except KeyError as error:
        raise ValueError('position_not_in_exact_source') from error
    if len(set(permutation)) != len(source_positions):
        raise ValueError('source_vertex_not_bijective')
    triangles, triangle = [], []
    for number in source_polygon_indices:
        triangle.append(-number - 1 if number < 0 else number)
        if number < 0:
            if len(triangle) != 3 or any(i < 0 or i >= len(source_positions) for i in triangle):
                raise ValueError('source_polygon_not_triangle')
            triangles.append(tuple(triangle)); triangle = []
    if triangle or len(indices) % 3 or any(i < 0 or i >= len(positions) for i in indices):
        raise ValueError('source_topology_invalid')
    cyclic = lambda t: min(t, t[1:] + t[:1], t[2:] + t[:2])
    mapped = [tuple(permutation[i] for i in indices[start:start + 3]) for start in range(0, len(indices), 3)]
    if collections.Counter(map(cyclic, triangles)) != collections.Counter(map(cyclic, mapped)):
        raise ValueError('source_topology_or_winding_changed')
    if any(len(pair) != 2 or not all(math.isfinite(x) for x in pair) for pair in source_uv):
        raise ValueError('source_uv_invalid')
    # FBX2glTF's default convention: FBX bottom-left becomes glTF upper-left.
    return permutation, [(source_uv[i][0], 1.0 - source_uv[i][1]) for i in permutation]


def _fbx_nodes(data):
    """Read bounded FBX7300 metadata/arrays needed for exact source UV recovery."""
    if len(data) > 3_000_000 or data[:23] != b'Kaydara FBX Binary  \x00\x1a\x00' or struct.unpack_from('<I', data, 23)[0] != 7300:
        raise ValueError('uv_source_requires_bounded_fbx7300')
    def sequence(position, end, depth=0):
        if depth > 64:
            raise ValueError('fbx_depth')
        nodes = []
        while position + 13 <= end:
            finish, count, length, name_length = struct.unpack_from('<IIIB', data, position)
            if finish == 0:
                break
            start = position + 13 + name_length
            if not start <= start + length <= finish <= end:
                raise ValueError('fbx_node_range')
            name = data[position + 13:start].decode('utf-8'); cursor = start; values = []
            for _ in range(count):
                tag = chr(data[cursor]); cursor += 1
                if tag in 'SR':
                    size = struct.unpack_from('<I', data, cursor)[0]; cursor += 4
                    values.append(data[cursor:cursor + size]); cursor += size
                elif tag in 'YCFDIL':
                    size, fmt = dict(Y=(2, 'h'), C=(1, '?'), F=(4, 'f'), D=(8, 'd'), I=(4, 'i'), L=(8, 'q'))[tag]
                    values.append(struct.unpack_from('<' + fmt, data, cursor)[0]); cursor += size
                elif tag in 'fdilbc':
                    size, encoding, packed = struct.unpack_from('<III', data, cursor); cursor += 12
                    fmt = dict(f='f', d='d', i='i', l='q', b='b', c='b')[tag]
                    expected = size * struct.calcsize('<' + fmt)
                    if expected > 32_000_000 or encoding not in (0, 1):
                        raise ValueError('fbx_array_limit')
                    payload = data[cursor:cursor + packed]; cursor += packed
                    if encoding:
                        payload = zlib.decompressobj().decompress(payload, expected + 1)
                    if len(payload) != expected:
                        raise ValueError('fbx_array_size')
                    values.append(list(struct.unpack('<' + str(size) + fmt, payload)))
                else:
                    raise ValueError('fbx_property_tag')
                if cursor > start + length:
                    raise ValueError('fbx_property_range')
            if cursor != start + length:
                raise ValueError('fbx_property_length')
            nodes.append((name, values, sequence(cursor, finish, depth + 1)))
            position = finish
        return nodes
    return sequence(27, len(data))


def restore_fbx_uvs(source: bytes, fbx: bytes) -> tuple[bytes, dict]:
    """Append source UV accessors; preserve existing binary data and mesh geometry."""
    document, original_binary = parse_glb(source); document = copy.deepcopy(document)
    nodes = _fbx_nodes(fbx)
    objects = next(n[2] for n in nodes if n[0] == 'Objects')
    connections = next(n[2] for n in nodes if n[0] == 'Connections')
    models = {n[1][0]: n for n in objects if n[0] == 'Model'}
    binary = bytearray(original_binary[:document['buffers'][0]['byteLength']]); rows = []
    def read_accessor(number, dimension, fmt):
        accessor = document['accessors'][number]; view = document['bufferViews'][accessor['bufferView']]
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride', struct.calcsize('<' + fmt) * dimension)
        return [struct.unpack_from('<' + str(dimension) + fmt, original_binary, start + i * stride) for i in range(accessor['count'])]
    for geometry in objects:
        uv = next((n for n in geometry[2] if n[0] == 'LayerElementUV'), None)
        if geometry[0] != 'Geometry' or uv is None:
            continue
        fields = {n[0]: n[1] for n in uv[2]}
        if fields.get('MappingInformationType') != [b'ByVertice'] or fields.get('ReferenceInformationType') != [b'Direct']:
            raise ValueError('unsupported_source_uv_mapping')
        parents = [n[1][2] for n in connections if n[0] == 'C' and n[1][1] == geometry[1][0] and n[1][2] in models]
        if len(parents) != 1:
            raise ValueError('source_geometry_parent')
        name = models[parents[0]][1][1].decode().split('\x00')[0]
        matches = [(i, m) for i, m in enumerate(document['meshes']) if m.get('name') == name]
        if len(matches) != 1 or len(matches[0][1]['primitives']) != 1:
            raise ValueError('source_mesh_identity')
        mesh_index, mesh = matches[0]; primitive = mesh['primitives'][0]
        if 'TEXCOORD_0' in primitive['attributes'] or primitive.get('mode', 4) != 4:
            raise ValueError('uv_restore_requires_missing_triangle_uv')
        positions = read_accessor(primitive['attributes']['POSITION'], 3, 'f')
        index_format = {5121: 'B', 5123: 'H', 5125: 'I'}[document['accessors'][primitive['indices']]['componentType']]
        indices = [n[0] for n in read_accessor(primitive['indices'], 1, index_format)]
        source_positions = next(n[1][0] for n in geometry[2] if n[0] == 'Vertices')
        source_indices = next(n[1][0] for n in geometry[2] if n[0] == 'PolygonVertexIndex')
        source_uv = list(zip(*[iter(fields['UV'][0])] * 2))
        permutation, restored = match_source_uv_vertices(list(zip(*[iter(source_positions)] * 3)), source_indices, source_uv, positions, indices)
        payload = b''.join(struct.pack('<2f', *pair) for pair in restored)
        binary.extend(b'\0' * (-len(binary) % 4)); offset = len(binary); binary.extend(payload)
        view = len(document['bufferViews']); document['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(payload), 'target': 34962})
        accessor = len(document['accessors']); document['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(restored), 'type': 'VEC2'})
        primitive['attributes']['TEXCOORD_0'] = accessor
        rows.append({'mesh': mesh_index, 'source_geometry_id': geometry[1][0], 'source_model': name,
                     'source_uv_set': fields.get('Name', [b''])[0].decode(), 'source_uv_sha256': sha256(b''.join(struct.pack('<2d', *v) for v in source_uv)),
                     'vertex_permutation': permutation, 'vertex_count': len(restored), 'triangle_count': len(indices) // 3,
                     'position_float32_bijection': True, 'topology_same_winding': True, 'texcoord_sha256': sha256(payload), 'accessor': accessor})
    if not rows:
        raise ValueError('no_source_uv_restored')
    document['buffers'][0]['byteLength'] = len(binary)
    text = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8'); text += b' ' * (-len(text) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    chunks = struct.pack('<I4s', len(text), b'JSON') + text + struct.pack('<I4s', len(binary), b'BIN\0') + bytes(binary)
    derived = b'glTF' + struct.pack('<II', 2, len(chunks) + 12) + chunks
    if not inspect_glb(derived)['valid']:
        raise ValueError('uv_restored_dependencies_invalid')
    return derived, {'fbx_sha256': sha256(fbx), 'fbx_bytes': len(fbx), 'meshes': rows, 'conversion': '(u, v) -> (u, 1-v); no clamping; original samplers unchanged',
                     'convention_reference': 'https://github.com/facebookincubator/FBX2glTF', 'input_sha256': sha256(source), 'derived_sha256': sha256(derived)}


def restore_historical_solid_material(source: bytes, historical: bytes, material_name: str) -> tuple[bytes, dict]:
    """Restore only a proven historical solid material; preserve all current binary bytes."""
    current, binary = parse_glb(source)
    old, old_binary = parse_glb(historical)
    matches = [i for i, material in enumerate(current.get('materials', [])) if material.get('name') == material_name]
    old_matches = [i for i, material in enumerate(old.get('materials', [])) if material.get('name') == material_name]
    if len(matches) != 1 or old_matches != matches:
        raise ValueError('solid_material_identity')
    number = matches[0]
    before, prior = copy.deepcopy(current['materials'][number]), copy.deepcopy(old['materials'][number])
    texture = before.get('pbrMetallicRoughness', {}).pop('baseColorTexture', None)
    factor = prior.get('pbrMetallicRoughness', {}).pop('baseColorFactor', None)
    if texture is None or before != prior or not isinstance(factor, list) or len(factor) != 4 or any(not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 1 for v in factor):
        raise ValueError('solid_material_source_semantics')
    consumers, geometry = [], []
    old_consumers = [(m, p) for m, mesh in enumerate(old.get('meshes', [])) for p, primitive in enumerate(mesh['primitives']) if primitive.get('material') == number]
    for m, mesh in enumerate(current.get('meshes', [])):
        for p, primitive in enumerate(mesh['primitives']):
            if primitive.get('material') != number:
                continue
            if (m, p) not in old_consumers or primitive != old['meshes'][m]['primitives'][p] or mesh.get('name') != old['meshes'][m].get('name'):
                raise ValueError('solid_material_geometry_identity')
            if any(key.startswith('TEXCOORD_') for key in primitive.get('attributes', {})):
                raise ValueError('solid_material_has_uv_consumer')
            draco = primitive.get('extensions', {}).get('KHR_draco_mesh_compression')
            accessor_numbers = list(primitive.get('attributes', {}).values()) + ([primitive['indices']] if 'indices' in primitive else [])
            if any(current['accessors'][i] != old['accessors'][i] for i in accessor_numbers):
                raise ValueError('solid_material_accessor_identity')
            if draco:
                if any(key.startswith('TEXCOORD_') for key in draco.get('attributes', {})):
                    raise ValueError('solid_material_has_draco_uv')
                view = current['bufferViews'][draco['bufferView']]
                previous_view = old['bufferViews'][draco['bufferView']]
                def payload(v, data):
                    if v.get('buffer') != 0:
                        raise ValueError('solid_material_buffer_identity')
                    offset = v.get('byteOffset', 0)
                    return data[offset:offset + v['byteLength']]
                compressed = payload(view, binary)
                if len(compressed) != view['byteLength'] or compressed != payload(previous_view, old_binary):
                    raise ValueError('solid_material_draco_geometry_identity')
                geometry.append({'mesh': m, 'primitive': p, 'buffer_view': draco['bufferView'], 'bytes': len(compressed), 'sha256': sha256(compressed)})
            elif binary != old_binary:
                raise ValueError('solid_material_binary_geometry_identity')
            consumers.append({'mesh': m, 'primitive': p})
    if not consumers or len(consumers) != len(old_consumers):
        raise ValueError('solid_material_consumer_identity')
    document = copy.deepcopy(current)
    document['materials'][number]['pbrMetallicRoughness'].pop('baseColorTexture')
    document['materials'][number]['pbrMetallicRoughness']['baseColorFactor'] = factor
    text = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8'); text += b' ' * (-len(text) % 4)
    chunks = struct.pack('<I4s', len(text), b'JSON') + text + struct.pack('<I4s', len(binary), b'BIN\0') + binary
    derived = b'glTF' + struct.pack('<II', 2, len(chunks) + 12) + chunks
    if not inspect_glb(derived)['valid']:
        raise ValueError('solid_material_derived_invalid')
    return derived, {'kind': 'historical_solid_material_restoration', 'material': number, 'name': material_name,
                     'removed_base_color_texture': texture, 'restored_base_color_factor': factor, 'consumers': consumers,
                     'geometry': geometry, 'historical_glb_sha256': sha256(historical), 'binary_preserved': True,
                     'original_sha256': sha256(source), 'derived_sha256': sha256(derived), 'render_status': 'unverified'}


def embed_png_images(source: bytes, png_images: dict[str, bytes]) -> tuple[bytes, dict]:
    document, original_binary = parse_glb(source)
    document = copy.deepcopy(document)
    buffers = document.get('buffers', [])
    if len(buffers) != 1 or 'uri' in buffers[0]:
        raise ValueError('repair_requires_one_embedded_buffer')
    declared = buffers[0].get('byteLength')
    if not isinstance(declared, int) or not 0 < declared <= len(original_binary) or len(original_binary) - declared > 3:
        raise ValueError('repair_source_buffer_range')
    binary = bytearray(original_binary[:declared])
    views = document.setdefault('bufferViews', [])
    textures = []
    for number, image in enumerate(document.get('images', [])):
        if 'uri' not in image:
            continue
        uri = image['uri']
        data = png_images.get(uri)
        if not isinstance(data, bytes):
            raise ValueError(f'missing_verified_texture:{uri}')
        _image(data, 'image/png', False)
        binary.extend(b'\0' * (-len(binary) % 4))
        offset = len(binary); binary.extend(data)
        view = len(views)
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)})
        image.pop('uri'); image['bufferView'] = view; image['mimeType'] = 'image/png'
        textures.append({'image_index': number, 'source_uri': uri, 'png_sha256': sha256(data),
                         'buffer_view': view, 'byte_offset': offset, 'bytes': len(data)})
    if not textures:
        raise ValueError('no_external_textures_to_embed')
    buffers[0]['byteLength'] = len(binary)
    text = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    text += b' ' * (-len(text) % 4); binary.extend(b'\0' * (-len(binary) % 4))
    chunks = struct.pack('<I4s', len(text), b'JSON') + text + struct.pack('<I4s', len(binary), b'BIN\0') + bytes(binary)
    derived = b'glTF' + struct.pack('<II', 2, len(chunks) + 12) + chunks
    receipt = inspect_glb(derived)
    if not receipt['valid']:
        raise ValueError('derived_dependencies_invalid:' + ';'.join(receipt['errors']))
    ledger = {'schema': 1, 'original_sha256': sha256(source), 'original_bytes': len(source),
              'derived_sha256': sha256(derived), 'derived_bytes': len(derived), 'textures': textures,
              'steps': ['preserve source bytes', 'verify PNG signatures', 'append aligned PNG bufferViews',
                        'replace image URIs preserving image/material/mesh indices', 'validate derived active dependencies'],
              'render_status': 'unverified'}
    return derived, ledger


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--textures', required=True, type=Path, help='Explicit local URI→path/hash/https source receipt JSON.')
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    ledger_path = output.with_name(output.stem + '_provenance.json')
    if source == output or output.exists() or ledger_path.exists():
        parser.error('Preserve originals; output and ledger must be new files.')
    texture_root = args.textures.resolve().parent
    entries = json.loads(args.textures.read_text(encoding='utf-8'))
    converted, conversions = {}, {}
    for uri, entry in entries.items():
        path = (texture_root / entry['path']).resolve()
        if not path.is_relative_to(texture_root) or not entry.get('source_url', '').startswith('https://'):
            raise ValueError('texture_path_or_source_provenance')
        data = path.read_bytes()
        if sha256(data) != entry.get('sha256'):
            raise ValueError('source_texture_hash_mismatch')
        png, conversion = convert_to_png(data)
        converted[uri] = png
        conversions[uri] = {**conversion, 'source_url': entry['source_url']}
    derived, ledger = embed_png_images(source.read_bytes(), converted)
    for row in ledger['textures']:
        row.update(conversions[row['source_uri']])
    ledger['original_file'], ledger['file'] = source.name, output.name
    # The receipt is necessary evidence, not a claim that the URL is authoritative.
    ledger['source_authority_status'] = 'requires_source_review'
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as stream:
        stream.write(derived)
    with ledger_path.open('x', encoding='utf-8') as stream:
        json.dump(ledger, stream, ensure_ascii=False, indent=2); stream.write('\n')
    print(json.dumps({'file': output.name, 'ledger': ledger_path.name, 'derived_sha256': ledger['derived_sha256']}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
