"""Offline source adapter wire trace; no endpoint connections or source imports."""
import ast
import hashlib
import json
from pathlib import Path
import sys

import httpx

EXPECTED = {'communication/external/data_management.py': '134d235ea609f0a7f49e12a29c7ae117583afd6ee1837c28f38739fd11d50841'}


def trace(adapter):
    calls = []
    def respond(request):
        row = {'method': request.method, 'path': request.url.path, 'query': dict(request.url.params),
               'body': json.loads(request.content) if request.content else None}
        calls.append(row)
        scope = (row['body'] or row['query']).get('scope_id')
        return httpx.Response(200, json={'scope_contract': 'isolated-v1', 'reachable': True,
                                       **({'scope_id': scope} if scope else {}), 'echo': row})
    with httpx.Client(base_url='http://module.test', transport=httpx.MockTransport(respond)) as client:
        root = adapter('http://module.test/', client=client)
        results = [root.status()]
        scoped = root.for_scope('run:deployment:A')
        for method in ['update_nodes', 'ingest', 'request', 'action']:
            results.append(getattr(scoped, method)({'scope_id': 'foreign', 'example': method}))
        results.extend([scoped.overview(), scoped.objects({'class': 'telemetry', 'node': None, 'query': ''}),
                        scoped.nodes(), scoped.events(7), scoped.status()])
    return {'calls': calls, 'results': results}


def main(source_root, output):
    path = next(iter(EXPECTED))
    raw = (Path(source_root) / path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != EXPECTED[path]:
        raise ValueError('source hash mismatch')
    tree = ast.parse(raw.decode('utf-8'))
    definition = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'RemoteDataManagement')
    namespace = {'httpx': httpx, 'DataManagementUnavailable': RuntimeError}
    exec(compile(ast.Module(body=[definition], type_ignores=[]), path, 'exec'), namespace)
    capture = {'source_commit': '1a1e00297a0301637455b0ef2cf48b2e74576b07', 'source_hashes': EXPECTED,
               'evidence': 'Original class executed against MockTransport; component wire behavior, not remote connectivity',
               **trace(namespace['RemoteDataManagement'])}
    data = (json.dumps(capture, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    Path(output).write_bytes(data)
    print(json.dumps({'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}))


if __name__ == '__main__':
    main(*sys.argv[1:])
