"""Source ICD-01 module parity and scope isolation, before HTTP/UI mounting."""
from copy import deepcopy
import json
from pathlib import Path

import pytest

from digital_twin.runtime.data_management.stand_in import DataManagementStandIn
from digital_twin.runtime.data_management.scopes import ScopedDataManagement

GOLDEN = json.loads((Path(__file__).parent / 'fixtures/original_data_management.json').read_text(encoding='utf-8'))


def test_complete_original_command_and_report_trace():
    module = DataManagementStandIn()
    for step in GOLDEN['trace']:
        args = deepcopy(step['args'])
        assert getattr(module, step['method'])(*args) == step['result'], step['method']
        assert args == step['args']
        for method, expected in step['reports'].items():
            before = module.status()
            assert getattr(module, method)() == expected, method
            assert module.status() == before, 'reads must not advance the supplied SIM clock'


def test_original_scope_trace_and_readonly_independent_copies():
    owner = ScopedDataManagement()
    scopes = {key: owner.for_scope('run:deployment:' + key) for key in ['A', 'B']}
    for step in GOLDEN['scope_trace']:
        assert getattr(scopes[step['scope']], step['method'])(*deepcopy(step['args'])) == step['result']
    assert scopes['B'].objects()['total'] == 0
    result = scopes['A'].objects()
    result['items'][0]['replicas'][0]['state'] = 'invented'
    assert scopes['A'].objects()['items'][0]['replicas'][0]['state'] == 'verified'
    assert owner.status()['scope_contract'] == 'isolated-v1'


@pytest.mark.parametrize('scope', ['', None, 1, 'x' * 241])
def test_scope_identity_rejects_invalid_values(scope):
    with pytest.raises(ValueError):
        ScopedDataManagement().for_scope(scope)


def test_unknown_source_destination_and_empty_storage_fail_without_other_scope_damage():
    owner = ScopedDataManagement()
    ready = owner.for_scope('accepted')
    empty = owner.for_scope('unconfigured')
    ready.update_nodes(deepcopy(GOLDEN['trace'][0]['args'][0]))
    ready.ingest(deepcopy(GOLDEN['trace'][1]['args'][0]))
    before = ready.objects()
    for method, message in [('ingest', {'sim_elapsed_s': 0, 'products': [{'source': 'foreign'}]}), ('request', {'sim_elapsed_s': 0, 'object_id': 'missing', 'destination': 'foreign'}), ('action', {'sim_elapsed_s': 0, 'action': 'verify'})]:
        with pytest.raises(ValueError):
            getattr(empty, method)(message)
    with pytest.raises(ValueError):
        ready.request({'sim_elapsed_s': 0, 'object_id': 'OBJ-000001', 'destination': 'foreign'})
    assert ready.objects() == before
    assert empty.objects()['total'] == 0


def test_input_reasons_and_nested_event_reports_do_not_leak_owned_state():
    module = DataManagementStandIn()
    nodes = deepcopy(GOLDEN['trace'][0]['args'][0])
    nodes['nodes'][0]['reason'] = {'text': ['original']}
    module.update_nodes(nodes)
    nodes['nodes'][0]['reason']['text'][0] = 'mutated input'
    assert module.nodes()['nodes'][0]['reason'] == {'text': ['original']}
    report = module.nodes()
    report['nodes'][0]['reason']['text'][0] = 'mutated report'
    assert module.nodes()['nodes'][0]['reason'] == {'text': ['original']}
    module.action({'sim_elapsed_s': 1, 'action': 'set_filter', 'filter': {'accept_classes': ['imagery']}})
    event = next(e for e in module.events()['items'] if e['kind'] == 'policy_changed')
    event['filters']['accept_classes'].append('invented')
    assert next(e for e in module.events()['items'] if e['kind'] == 'policy_changed')['filters']['accept_classes'] == ['imagery']


def test_source_filter_placement_and_service_units():
    from digital_twin.simulation.data_management.catalog import filter_product
    from digital_twin.simulation.data_management.placement import choose_targets, serve_latency_ms
    filters = {'min_size_mb': 1.0, 'accept_classes': ['imagery', 'telemetry'], 'drop_priority_below': 1, 'dedupe_by_ref': True}
    product = {'ref': 'a', 'class': 'imagery', 'source': 'S1', 'size_mb': 500, 'priority': 1}
    assert filter_product(product, filters, set()) is None
    for field, value, reason in [('size_mb', 0, 'empty'), ('size_mb', .2, 'below_min_size'), ('class', 'science', 'class_filtered'), ('class', 'invented', 'unknown_class'), ('priority', 0, 'low_priority')]:
        assert filter_product({**product, field: value}, filters, set()) == reason
    assert filter_product(product, filters, {'a'}) == 'duplicate'
    nodes = {n['id']: {**n, 'used_gb': 0} for n in GOLDEN['trace'][0]['args'][0]['nodes']}
    assert choose_targets(nodes, 'S1', 500, 3) == ['S1', 'C1', 'C2']
    assert choose_targets(nodes, 'S1', 3000, 3) == ['C1', 'C2', 'E1']
    assert serve_latency_ms('core', 1000) == pytest.approx(40 + 4000)
    assert serve_latency_ms('onboard', 10) > serve_latency_ms('edge', 10) > serve_latency_ms('core', 10)


def test_empty_scope_stays_unevaluated_and_queries_never_generate_demo_nodes():
    owner = ScopedDataManagement()
    scope = owner.for_scope('unconfigured')
    for _ in range(3):
        assert scope.nodes()['nodes'] == []
        assert scope.objects()['items'] == []
        report = scope.overview()
        assert report['capacity']['nodes'] == 0
        assert report['stability']['score'] is None
        assert report['stability']['grade'] == 'unevaluated'
        assert scope.events()['items'] == []
        assert scope.status()['sequence'] == 0


def test_source_calculations_and_policy_are_unchanged_except_declared_copy_boundary():
    import ast
    import hashlib
    root = Path(__file__).resolve().parents[2]
    paths = {'policy.py': 'digital_twin/model_library/data_management_policy.py', 'catalog.py': 'digital_twin/simulation/data_management/catalog.py', 'placement.py': 'digital_twin/simulation/data_management/placement.py', 'stand_in.py': 'digital_twin/runtime/data_management/stand_in.py', 'scopes.py': 'digital_twin/runtime/data_management/scopes.py'}
    for name, path in paths.items():
        text = (root / path).read_text(encoding='utf-8')
        if name == 'stand_in.py':
            text = text.replace('"available": available, "reason": deepcopy(record.get("reason"))}', '"available": available, "reason": record.get("reason")}')
            text = text.replace('"available": node["available"], "reason": deepcopy(node.get("reason")),', '"available": node["available"], "reason": node.get("reason"),')
            text = text.replace('items = [deepcopy(event) for event in self._events if event["sequence"] > after]', 'items = [dict(event) for event in self._events if event["sequence"] > after]')
        tree = ast.parse(text)
        tree.body = [node for node in tree.body if not isinstance(node, (ast.Import, ast.ImportFrom))]
        assert hashlib.sha256(ast.dump(tree, include_attributes=False).encode('utf-8')).hexdigest() == GOLDEN['semantic_hashes'][name], name


def test_model_policy_accessors_return_copies_and_unknown_classes_stay_unknown():
    from digital_twin.model_library.data_management_policy import default_policy, class_spec
    policy = default_policy()
    policy['replication']['imagery'] = 99
    assert default_policy()['replication']['imagery'] == 3
    spec = class_spec('imagery')
    spec['replication'] = 99
    assert class_spec('imagery')['replication'] == 3
    assert class_spec('invented') is None
