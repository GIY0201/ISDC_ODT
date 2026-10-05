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
