from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
import pytest
from digital_twin.runtime.data_fabric.exchange import DataFabricExchange
from project_support.tests.test_data_fabric_source import snapshot, oisl, ground


def test_source_files_match_recorded_port_bytes():
    root=Path(__file__).parents[2]
    manifest=json.loads((root/'project_support/tests/fixtures/original_data_fabric_source.json').read_text())
    for item in manifest['files']:
        content=(root/item['target']).read_text(encoding='utf-8').replace('\r\n','\n').encode()
        assert sha256(content).hexdigest()==item['normalized_target_sha256']


def test_exchange_commits_whole_source_state_and_keeps_inputs_outputs_independent():
    exchange=DataFabricExchange()
    request=snapshot();saved=deepcopy(request)
    first=exchange.update(request);assert request==saved
    request['nodes'][0]['id']='changed';first['nodes'][0]['id']='changed'
    assert exchange.route('S1','G1','latency')['path']==['S1','S2','S3','G1']
    cut=exchange.update(snapshot('2026-09-07T12:01:00Z',links=[oisl('S1','S2'),oisl('S2','S3'),ground('G1','S3',elevation=1)]))
    assert cut['summary']['stored_mb']==4.5
    before=exchange.status()
    # Original update resets backlog before computing metrics on backward time.
    bad=snapshot('2026-09-07T11:00:00Z');bad['nodes'][0]['extra_delay_ms']='broken'
    with pytest.raises((ValueError,TypeError)):exchange.update(bad)
    assert exchange.status()==before
    continued=exchange.update(snapshot('2026-09-07T12:01:10Z'))
    assert continued['sequence']==3 and continued['summary']['delivered_mb']==pytest.approx(5.25)
    reversed_report=exchange.update(snapshot('2026-09-07T11:00:00Z'))
    assert reversed_report['elapsed_s']==0 and reversed_report['summary']['delivered_mb']==0


def test_exchange_serializes_source_sequences_and_does_not_invent_initial_network():
    exchange=DataFabricExchange()
    assert exchange.status()['sequence']==0
    assert exchange.route('S1','G1')['status']=='no_network'
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(lambda _:exchange.update(snapshot()),range(24)))
    assert sorted(result['sequence'] for result in results)==list(range(1,25))
    assert exchange.status()['sequence']==24


@pytest.mark.parametrize('bad_value',[float('nan'),float('inf'),-float('inf')])
def test_non_json_numeric_input_never_changes_module_state(bad_value):
    exchange=DataFabricExchange();exchange.update(snapshot());before=exchange.status()
    bad=snapshot();bad['nodes'][0]['generation_mbps']=bad_value
    with pytest.raises(ValueError):exchange.update(bad)
    assert exchange.status()==before
