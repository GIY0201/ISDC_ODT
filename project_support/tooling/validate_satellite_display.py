"""Offline build-time checks for the versioned selected-satellite asset package.

Static validity is distinct from GPU rendering or legal permission. No network,
runtime state, or implicit external-file lookup is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import struct
from pathlib import Path

SUPPORTED_EXTENSIONS = {'KHR_draco_mesh_compression', 'EXT_texture_webp',
                        'KHR_materials_specular', 'KHR_texture_transform',
                        'KHR_materials_transmission', 'KHR_materials_unlit',
                        'KHR_materials_ior', 'KHR_materials_clearcoat',
                        'KHR_materials_emissive_strength'}
PNG_MAGIC = b'\x89PNG\r\n\x1a\n'


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _json(data):
    def invalid(value):
        raise ValueError(f'nonfinite_json:{value}')
    return json.loads(data, parse_constant=invalid)


def parse_glb(data: bytes) -> tuple[dict, bytes]:
    if len(data) < 20 or data[:4] != b'glTF':
        raise ValueError('glb_magic')
    version, declared = struct.unpack_from('<II', data, 4)
    if version != 2 or declared != len(data):
        raise ValueError('glb_version_or_length')
    chunks, offset = [], 12
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError('glb_chunk_header')
        length, kind = struct.unpack_from('<I4s', data, offset)
        offset += 8
        if length % 4 or offset + length > len(data):
            raise ValueError('glb_chunk_range_or_alignment')
        chunks.append((kind, data[offset:offset + length])); offset += length
    if not chunks or chunks[0][0] != b'JSON' or sum(kind == b'JSON' for kind, _ in chunks) != 1:
        raise ValueError('glb_json_chunk')
    if sum(kind == b'BIN\0' for kind, _ in chunks) > 1:
        raise ValueError('glb_duplicate_bin')
    try:
        document = _json(chunks[0][1].decode('utf-8'))
    except (ValueError, UnicodeError) as error:
        raise ValueError('glb_json') from error
    if not isinstance(document, dict) or document.get('asset', {}).get('version') != '2.0':
        raise ValueError('gltf_asset_version')
    binary = next((content for kind, content in chunks if kind == b'BIN\0'), b'')
    return document, binary


def _image(data: bytes, mime: str, decode: bool) -> dict:
    if mime == 'image/png':
        valid = len(data) >= 33 and data.startswith(PNG_MAGIC) and data[12:16] == b'IHDR'
    elif mime == 'image/jpeg':
        valid = len(data) >= 4 and data.startswith(b'\xff\xd8\xff')
    elif mime == 'image/webp':
        valid = len(data) >= 16 and data[:4] == b'RIFF' and data[8:12] == b'WEBP'
    else:
        valid = False
    if not valid:
        raise ValueError('image_mime_or_signature')
    result = {'mime_type': mime, 'sha256': sha256(data), 'bytes': len(data), 'decoded': False}
    if decode:
        try:
            from PIL import Image
        except ImportError as error:
            raise ValueError('image_decode_requires_explicit_Pillow_environment') from error
        try:
            with Image.open(io.BytesIO(data)) as image:
                size, fmt = image.size, image.format
                image.verify()
            # verify checks the container; load separately proves pixel decoding.
            with Image.open(io.BytesIO(data)) as image:
                image.load()
            expected = {'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WEBP'}[mime]
            if fmt != expected or min(size) <= 0:
                raise ValueError('image_decoded_format')
            result.update(decoded=True, width=size[0], height=size[1])
        except (OSError, ValueError) as error:
            raise ValueError('image_decode_failed') from error
    return result


def inspect_glb(data: bytes, *, decode_images: bool = False) -> dict:
    result = {'valid': False, 'errors': [], 'active_image_indices': [],
              'extensions_used': [], 'required_codecs': [], 'image_checks': []}
    errors = result['errors']
    try:
        d, binary = parse_glb(data)
        arrays = {}
        for name in ['buffers', 'bufferViews', 'accessors', 'meshes', 'nodes', 'scenes', 'materials', 'textures', 'images']:
            value = d.get(name, [])
            if not isinstance(value, list) or any(not isinstance(row, dict) for row in value):
                raise ValueError(f'gltf_array:{name}')
            arrays[name] = value
        used, required = d.get('extensionsUsed', []), d.get('extensionsRequired', [])
        if not isinstance(used, list) or not isinstance(required, list) or any(not isinstance(x, str) for x in used + required):
            raise ValueError('gltf_extensions')
        result['extensions_used'] = sorted(set(used + required))
        unsupported = set(required) - SUPPORTED_EXTENSIONS
        if unsupported:
            errors.append('unsupported_required_extension:' + ','.join(sorted(unsupported)))
        result['required_codecs'] = [name for extension, name in [('KHR_draco_mesh_compression', 'draco'), ('EXT_texture_webp', 'webp')]
                                     if extension in result['extensions_used']]

        def integer(value):
            return isinstance(value, int) and not isinstance(value, bool)

        def index(name, value):
            if not integer(value) or value < 0 or value >= len(arrays[name]):
                raise ValueError(f'gltf_reference:{name}:{value}')
            return arrays[name][value]

        buffers = arrays['buffers']
        if len(buffers) != 1 or 'uri' in buffers[0]:
            raise ValueError('external_or_missing_buffer')
        declared = buffers[0].get('byteLength')
        if not integer(declared) or declared <= 0 or not 0 <= len(binary) - declared <= 3:
            raise ValueError('binary_declared_range')
        for view in arrays['bufferViews']:
            if view.get('buffer') != 0:
                raise ValueError('buffer_view_buffer')
            start, length = view.get('byteOffset', 0), view.get('byteLength')
            if not integer(start) or not integer(length) or start < 0 or length <= 0 or start + length > declared:
                raise ValueError('buffer_view_range')
        for accessor in arrays['accessors']:
            if 'bufferView' in accessor:
                index('bufferViews', accessor['bufferView'])

        def image_bytes(number):
            image = index('images', number)
            if 'uri' in image:
                raise ValueError(f'external_image:{number}:{image["uri"]}')
            view = index('bufferViews', image.get('bufferView'))
            start, length = view.get('byteOffset', 0), view['byteLength']
            return binary[start:start + length], image.get('mimeType', '')

        def material_textures(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    if key.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                        yield child['index']
                    yield from material_textures(child)
            elif isinstance(value, list):
                for child in value:
                    yield from material_textures(child)

        active_materials, visited = set(), set()

        def visit(number, stack):
            node = index('nodes', number)
            if number in stack:
                raise ValueError('node_cycle')
            if number in visited:
                return
            visited.add(number)
            if 'mesh' in node:
                mesh = index('meshes', node['mesh'])
                for primitive in mesh.get('primitives', []):
                    for accessor in primitive.get('attributes', {}).values():
                        index('accessors', accessor)
                    if 'indices' in primitive:
                        index('accessors', primitive['indices'])
                    draco = primitive.get('extensions', {}).get('KHR_draco_mesh_compression')
                    if draco is not None:
                        index('bufferViews', draco.get('bufferView'))
                    if 'material' in primitive:
                        index('materials', primitive['material']); active_materials.add(primitive['material'])
            for child in node.get('children', []):
                visit(child, stack | {number})

        roots = index('scenes', d.get('scene', 0)).get('nodes', []) if arrays['scenes'] else range(len(arrays['nodes']))
        for root in roots:
            visit(root, set())
        images = set()
        for number in sorted(active_materials):
            for texture_number in material_textures(index('materials', number)):
                texture = index('textures', texture_number)
                if 'source' in texture:
                    index('images', texture['source']); images.add(texture['source'])
                webp = texture.get('extensions', {}).get('EXT_texture_webp')
                if webp is not None:
                    index('images', webp.get('source')); images.add(webp['source'])
                if 'source' not in texture and webp is None:
                    raise ValueError('texture_without_source')
        result['active_image_indices'] = sorted(images)
        for number in result['active_image_indices']:
            try:
                content, mime = image_bytes(number)
                result['image_checks'].append({'index': number, **_image(content, mime, decode_images)})
            except ValueError as error:
                errors.append(str(error))
        result['valid'] = not errors
    except (ValueError, TypeError, KeyError, RecursionError) as error:
        errors.append(str(error))
    return result


def validate_package(root: Path, *, decode_images: bool = False) -> dict:
    root = Path(root).resolve()
    receipt = {'schema': 1, 'package': 'satellite_display', 'complete': False,
               'render_status': 'unverified', 'mapping_count': 0, 'unique_model_files': 0,
               'assets': [], 'errors': []}
    errors = receipt['errors']

    def read(name):
        if not isinstance(name, str) or not re.fullmatch(r'[a-z0-9_]+\.(glb|jpg|jpeg|png|webp|json)', name):
            raise ValueError(f'unsafe_package_path:{name}')
        path = (root / name).resolve()
        if path.parent != root:
            raise ValueError(f'outside_package:{name}')
        try:
            return path.read_bytes()
        except OSError as error:
            raise ValueError(f'asset_read_failed:{name}') from error

    try:
        runtime = _json(read('manifest.json'))
        original_bytes = read('original_manifest.json'); original = _json(original_bytes)
        provenance = _json(read('provenance.json'))
        if runtime.get('schema') != 2 or original.get('schema') != 2 or provenance.get('schema') != 1:
            raise ValueError('package_schema')
        models, old_models = runtime.get('models'), original.get('models')
        if not isinstance(models, list) or not 1 <= len(models) <= 512 or not isinstance(old_models, list):
            raise ValueError('package_models')
        keys = [m.get('key') for m in models]
        if len(set(keys)) != len(keys) or keys != [m.get('key') for m in old_models]:
            raise ValueError('original_mapping_coverage_or_order')
        if provenance.get('original_manifest_sha256') != sha256(original_bytes) or not re.fullmatch(r'[a-f0-9]{40}', provenance.get('source_head', '')):
            raise ValueError('original_manifest_provenance')
        original_files = {m['file'] for m in old_models} | {m['thumbnail'] for m in old_models if m.get('thumbnail')}
        source_assets = provenance.get('original_assets', [])
        if not isinstance(source_assets, list) or {row.get('file') for row in source_assets} != original_files or len(source_assets) != len(original_files):
            raise ValueError('original_asset_coverage')
        for record in source_assets:
            data = read(record['file'])
            if sha256(data) != record.get('sha256') or len(data) != record.get('bytes'):
                errors.append(f'original_asset_hash:{record["file"]}')
        derivatives = {row['file']: row for row in provenance.get('derivatives', [])}
        receipt['mapping_count'] = len(models)
        groups = {}
        for model, old in zip(models, old_models):
            for field in ['key', 'provider', 'title', 'exact', 'series', 'family', 'size_m', 'extent', 'orientation', 'origin', 'origin_image']:
                if model.get(field) != old.get(field):
                    errors.append(f'original_mapping_changed:{model["key"]}:{field}')
            if model.get('thumbnail') != old.get('thumbnail'):
                errors.append(f'original_thumbnail_mapping_changed:{model["key"]}')
            if model['file'] != old['file']:
                record = derivatives.get(model['file'])
                if not record or record.get('original_file') != old['file'] or record.get('original_sha256') != old.get('sha256') or record.get('derived_sha256') != model.get('sha256') or not record.get('textures'):
                    errors.append(f'derivative_provenance:{model["key"]}')
            groups.setdefault(model['file'], []).append(model)
        receipt['unique_model_files'] = len(groups)
        for filename, aliases in groups.items():
            check = {'file': filename, 'keys': [m['key'] for m in aliases], 'valid': False}
            try:
                data = read(filename)
                if any(m.get('sha256') != sha256(data) or m.get('bytes') != len(data) for m in aliases):
                    raise ValueError('runtime_asset_hash_or_bytes')
                check.update(sha256=sha256(data), bytes=len(data), **inspect_glb(data, decode_images=decode_images))
                for thumbnail in sorted({m['thumbnail'] for m in aliases if m.get('thumbnail')}):
                    extension = thumbnail.rsplit('.', 1)[1]
                    mime = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}.get(extension, '')
                    check.setdefault('thumbnails', []).append({'file': thumbnail, **_image(read(thumbnail), mime, decode_images)})
                for error in check['errors']:
                    errors.append(f'{filename}:{error}')
            except ValueError as error:
                check['valid'] = False; check.setdefault('errors', []).append(str(error)); errors.append(f'{filename}:{error}')
            receipt['assets'].append(check)
        receipt['complete'] = not errors
    except (ValueError, TypeError, KeyError, AttributeError) as error:
        errors.append(str(error))
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    parser.add_argument('--decode-images', action='store_true', help='Requires an explicitly selected Python environment with Pillow.')
    args = parser.parse_args()
    receipt = validate_package(args.package, decode_images=args.decode_images)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0 if receipt['complete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
