"""Explicit Pillow-environment probe; synthetic TGA is not Terra source data."""
import io
import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from PIL import Image
from project_support.tooling.repair_satellite_display import convert_to_png, embed_png_images
from project_support.tooling.validate_satellite_display import inspect_glb, parse_glb


def main():
    header = struct.pack('<BBBHHBHHHHBB', 0, 0, 2, 0, 0, 0, 0, 0, 2, 1, 24, 0x20)
    tga = header + bytes([0, 0, 255, 0, 255, 0])
    png, conversion = convert_to_png(tga)
    with Image.open(io.BytesIO(png)) as image:
        assert image.size == (2, 1)
        assert image.getpixel((0, 0)) == (255, 0, 0, 255)
        assert image.getpixel((1, 0)) == (0, 255, 0, 255)
    # Geometry prefix and material/image index survive conversion and embedding.
    document = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': 4}],
                'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 4}],
                'images': [{'uri': 'official_source_texture.tga'}], 'textures': [{'source': 0}],
                'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}],
                'meshes': [{'primitives': [{'attributes': {}, 'material': 0}]}],
                'nodes': [{'mesh': 0}], 'scenes': [{'nodes': [0]}], 'scene': 0}
    text = json.dumps(document).encode(); text += b' ' * (-len(text) % 4)
    chunks = struct.pack('<I4s', len(text), b'JSON') + text + struct.pack('<I4s', 4, b'BIN\0') + b'ABCD'
    source = b'glTF' + struct.pack('<II', 2, 12 + len(chunks)) + chunks
    derived, ledger = embed_png_images(source, {'official_source_texture.tga': png})
    result, binary = parse_glb(derived)
    assert binary[:4] == b'ABCD'
    for key in ['materials', 'meshes', 'nodes', 'textures']:
        assert result[key] == document[key]
    assert inspect_glb(derived, decode_images=True)['valid']
    print(json.dumps({'synthetic_tga_conversion': 'passed', 'pixel_preservation': 'passed',
                      'aligned_embedding': 'passed', 'conversion': conversion,
                      'derived_sha256': ledger['derived_sha256'], 'Terra_source_status': 'unresolved'}))


if __name__ == '__main__':
    main()
