import csv
import io
from copy import deepcopy

from fastapi.testclient import TestClient
from user_application.web.application import create_app
from user_application.bootstrap import create_runtime
from digital_twin.verification.kpis import evaluate


def test_existing_kpi_golden_pass_fail_invalid_and_copy():
    runtime = create_runtime()
    original = deepcopy(runtime.current_telemetry)
    result = evaluate(runtime.snapshot())
    assert [k['value'] for k in result['kpis']] == [98.0, 33.6, 0.0, 99.81]
    assert result['overall'] == 100 and result['verdict'] == 'PASS'
    result['kpis'][0]['value'] = -1
    assert evaluate(runtime.snapshot())['kpis'][0]['value'] == 98
    runtime.current_telemetry['delay_ms'] = 51
    assert evaluate(runtime.snapshot())['verdict'] == 'FAIL'
    assert evaluate(runtime.snapshot())['overall'] == 75
    runtime.data_quality = 'UNKNOWN'
    invalid = evaluate(runtime.snapshot())
    assert invalid['verdict'] == 'INVALID' and invalid['overall'] == 0
    assert all(r['result'] == 'INVALID' for r in invalid['requirements'])
    assert original['delay_ms'] == 33.6


def test_existing_exports_are_readonly_and_csv_matches_json_for_paused_runtime():
    with TestClient(create_app()) as client:
        client.post('/api/runtime/control', json={'action': 'pause'})
        before = client.get('/api/bootstrap').json()
        json_response = client.get('/api/reports/snapshot.json')
        payload = json_response.json()
        csv_response = client.get('/api/reports/summary.csv')
        assert csv_response.content.startswith(b'\xef\xbb\xbf')
        assert csv_response.headers['content-disposition'] == 'attachment; filename="spacetwin-report.csv"'
        assert json_response.headers['content-disposition'] == 'attachment; filename="spacetwin-snapshot.json"'
        rows = list(csv.DictReader(io.StringIO(csv_response.content.decode('utf-8-sig'))))
        for row, kpi in zip(rows, payload['analytics']['kpis'], strict=True):
            assert [row['KPI'],row['Name'],float(row['Value']),float(row['Target']),row['Unit'],row['Status']] == [kpi['id'],kpi['name'],kpi['value'],kpi['target'],kpi['unit'],kpi['status']]
        assert payload['runtime']['run_id'] == payload['analytics']['run_id']
        assert payload['analytics']['provenance']['is_simulation'] is True
        assert payload['events'] == before['events']
        after = client.get('/api/bootstrap').json()
        assert after['runtime'] == before['runtime']
        assert after['missions'] == before['missions'] and after['events'] == before['events']
