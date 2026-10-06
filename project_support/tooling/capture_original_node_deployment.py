"""Offline execution of original deployment methods on a current core scaffold.

This isolates the source deployment state machine, not the whole upstream app.
The source-verified actual embedded module supplies activation receipts.
"""
import ast
import asyncio
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from communication.data_management_delivery import DataManagementBridge
from digital_twin.contracts.data_management import DataDeploymentConflict, DataManagementUnavailable
from digital_twin.runtime.data_management.scopes import ScopedDataManagement
from digital_twin.runtime.state import RuntimeState
from digital_twin.simulation.data_deployment import deployment_inputs, deployment_products

EXPECTED = {'digital_twin/runtime/state.py': '8ced51056e8dc9fd86a3fc57c898ea41d6e512a53530fdab55448421c8de9b5b',
            'communication/http/data_deployment_schemas.py': '09e8d4d7e3d5093643346033be7475f56271349260ff2322c4280330ffd92100'}
METHODS = ['data_deployment', '_data_context', 'apply_data_deployment', 'with_data_deployment']


def node(identifier):
    return {'id': identifier, 'name': '  이름 ' + identifier + '  ', 'mode': 'nominal',
            'equipment': [{'id': 'store', 'catalog': 'dtn_store', 'enabled': True}]}


async def trace(runtime_type):
    runtime = runtime_type(missions=[], devices=[], scenarios=[])
    runtime.run_id = 'RUN-SOURCE'
    module = ScopedDataManagement()
    bridge = DataManagementBridge(now=lambda: '2026-10-06T00:00:00Z')
    async def activate(context):
        return bridge.sync(module, context)
    rows = [{'operation': 'initial', 'deployment': runtime.data_deployment()}]
    commands = [('a', 0, [node('A')]), ('a', 0, [node('A')]), ('a', 1, [node('B')]),
                ('b', 0, [node('B')]), ('b', 1, [node('B')])]
    for identifier, revision, nodes in commands:
        body = {'deployment_id': identifier, 'expected_revision': revision, 'nodes': nodes}
        try:
            result = await runtime.apply_data_deployment(body, activate)
            rows.append({'operation': 'apply', 'command': body, 'deployment': result,
                         'module_nodes': module.for_scope(result['scope_id']).nodes()})
        except DataDeploymentConflict:
            rows.append({'operation': 'conflict', 'command': body, 'deployment': runtime.data_deployment()})
    await runtime.control('reset')
    runtime.run_id = 'RUN-RESET'
    async def exchange(context):
        scoped, sync = bridge.sync(module, context)
        return {'deployment': context['deployment'], 'started_s': context['started_s'], 'sync': sync,
                'module_nodes': scoped.nodes(), 'objects': scoped.objects()}
    rows.append({'operation': 'reset_exchange', 'result': await runtime.with_data_deployment(exchange)})
    rows.append({'operation': 'recall', 'deployment': await runtime.apply_data_deployment(
        {'deployment_id': 'recall', 'expected_revision': 2, 'nodes': []}, activate)})
    rows.append({'operation': 'retained_first_scope', 'module_nodes': module.for_scope('RUN-SOURCE:deployment:a').nodes()})
    return rows


def main(source_root, output):
    texts = {}
    for name, sha in EXPECTED.items():
        raw = (Path(source_root) / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != sha:
            raise ValueError('source hash mismatch: ' + name)
        texts[name] = raw.decode('utf-8')
    tree = ast.parse(texts['digital_twin/runtime/state.py'])
    original = next(item for item in tree.body if isinstance(item, ast.ClassDef) and item.name == 'RuntimeState')
    methods = [item for item in original.body if getattr(item, 'name', None) in METHODS]
    definition = ast.ClassDef(name='OriginalDeployment', bases=[ast.Name(id='RuntimeState', ctx=ast.Load())],
                              keywords=[], body=methods, decorator_list=[])
    namespace = {'RuntimeState': RuntimeState, 'deepcopy': deepcopy, 'DataDeploymentConflict': DataDeploymentConflict,
                 'DataManagementUnavailable': DataManagementUnavailable, 'deployment_inputs': deployment_inputs,
                 'deployment_products': deployment_products}
    tree = ast.fix_missing_locations(ast.Module(body=[definition], type_ignores=[]))
    exec(compile(tree, 'original_deployment_methods', 'exec'), namespace)
    capture = {'source_commit': '1a1e00297a0301637455b0ef2cf48b2e74576b07', 'source_hashes': EXPECTED,
               'evidence': 'Original four deployment methods on current core scaffold with source-verified module; not whole app/live TCP',
               'methods': METHODS, 'trace': asyncio.run(trace(namespace['OriginalDeployment']))}
    data = (json.dumps(capture, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    Path(output).write_bytes(data)
    print(json.dumps({'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}))


if __name__ == '__main__':
    main(*sys.argv[1:])
