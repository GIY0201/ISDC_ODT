"""Scoped ICD-01 delivery; the runtime owns the accepted roster and SIM clock.

Preserves the prototype's serialized cursor, 2000-product batches and retry refs.
Receipts are checked before publishing a cursor; partial remote writes can be
retried using the original module's ref deduplication.
"""
from copy import deepcopy
import math
import threading

from foundation.data_management_errors import DataManagementUnavailable


def _receipt(value, scope):
    if not isinstance(value, dict) or value.get('scope_id') != scope or value.get('scope_contract') != 'isolated-v1':
        raise DataManagementUnavailable('데이터 관리 응답의 범위가 일치하지 않습니다.')
    return value


def _sequence(value):
    sequence = value.get('sequence')
    if isinstance(sequence, bool) or not isinstance(sequence, int) or sequence < 1:
        raise DataManagementUnavailable('데이터 관리 수락 sequence가 유효하지 않습니다.')


class DataManagementBridge:
    """Delivery cursor only; no independent simulation clock or deployment state."""

    def __init__(self, *, now):
        self.lock = threading.RLock()
        self._now = now
        self.last_scope = self.last_elapsed = self.last_sync = None

    def sync(self, module, context):
        with self.lock:
            scope = context['deployment']['scope_id']
            method = getattr(module, 'for_scope', None)
            if not callable(method):
                raise DataManagementUnavailable('범위 분리 계약 isolated-v1이 필요합니다.')
            scoped = method(scope)
            status = _receipt(scoped.status(), scope)
            if status.get('reachable') is not True:
                raise DataManagementUnavailable('데이터 관리 모듈에 연결할 수 없습니다.')
            elapsed = context['runtime']['elapsed_seconds']
            started = context['started_s']
            for number in (elapsed, started):
                if isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or number < 0:
                    raise ValueError('유효한 SIM 시간이 필요합니다.')
            if started > elapsed:
                raise ValueError('배치 시작은 현재 SIM 시간 이후일 수 없습니다.')
            begin = started if self.last_scope != scope or self.last_elapsed is None else max(started, self.last_elapsed)
            if begin > elapsed:
                raise ValueError('같은 운용 범위의 SIM 시간이 역행했습니다.')
            stamp = {'time': self._now(), 'sim_elapsed_s': elapsed, 'scope_id': scope}
            inputs = deepcopy(context['inputs'])
            expected = {node['id']: node for node in inputs['nodes']}
            if len(expected) != len(inputs['nodes']):
                raise ValueError('저장 노드 id가 중복됩니다.')
            previous = None
            while True:
                report = _receipt(scoped.update_nodes(deepcopy({**stamp, 'nodes': inputs['nodes']})), scope)
                _sequence(report)
                nodes = report.get('nodes')
                if not isinstance(nodes, list) or any(not isinstance(node, dict) or not isinstance(node.get('id'), str) for node in nodes):
                    raise DataManagementUnavailable('저장 노드 수락 명부가 없습니다.')
                received = {node.get('id'): node for node in nodes}
                if len(received) != len(nodes) or received.keys() != expected.keys() or any(
                    any(received[key].get(field) != value for field, value in node.items())
                    for key, node in expected.items()
                ):
                    raise DataManagementUnavailable('저장 노드 수락 명부가 요청과 다릅니다.')
                clock = report.get('sim_elapsed_s')
                if isinstance(clock, bool) or not isinstance(clock, (int, float)) or not math.isfinite(clock) or clock < 0 or clock > round(elapsed, 3):
                    raise DataManagementUnavailable('데이터 관리 SIM 시간 수락이 유효하지 않습니다.')
                if clock == round(elapsed, 3):
                    break
                if previous is not None and clock <= previous:
                    raise DataManagementUnavailable('데이터 관리 SIM 시간이 진행되지 않습니다.')
                previous = clock
            products = context['products'](deepcopy(inputs), begin, elapsed)
            ingest = None
            for offset in range(0, len(products), 2000):
                chunk = products[offset:offset + 2000]
                report = _receipt(scoped.ingest(deepcopy({**stamp, 'products': chunk})), scope)
                _sequence(report)
                accepted, rejected = report.get('accepted'), report.get('rejected')
                if not isinstance(accepted, list) or not isinstance(rejected, list) or any(not isinstance(item, dict) for item in accepted + rejected):
                    raise DataManagementUnavailable('제품 수락 결과가 없습니다.')
                refs = [item.get('ref') for item in accepted + rejected]
                expected_refs = [item['ref'] for item in chunk]
                if any(not isinstance(ref, str) for ref in refs) or len(set(refs)) != len(refs) or len(refs) != len(expected_refs) or set(refs) != set(expected_refs):
                    raise DataManagementUnavailable('제품 수락 결과가 요청과 다릅니다.')
                if ingest is None:
                    ingest = {**deepcopy(report), 'accepted': [], 'rejected': []}
                ingest['accepted'].extend(deepcopy(accepted))
                ingest['rejected'].extend(deepcopy(rejected))
            self.last_scope, self.last_elapsed = scope, elapsed
            self.last_sync = {**stamp, 'nodes': len(expected), 'node_roster': deepcopy(inputs['nodes']), 'products': len(products), 'ingest': ingest}
            return scoped, deepcopy(self.last_sync)
