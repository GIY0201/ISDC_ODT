"""Acceptance assertions over the real isolated native five-kind capture receipt."""
import json, os, re
from pathlib import Path
import pytest

EVIDENCE=os.environ.get('ISDC_MISSION_MATRIX_EVIDENCE')
@pytest.fixture(scope='module')
def capture():
    if not EVIDENCE:pytest.skip('set ISDC_MISSION_MATRIX_EVIDENCE to actual isolated capture JSON')
    value=json.loads(Path(EVIDENCE).read_text(encoding='utf-8'))
    assert value['returncode']==0
    result=next(r for r in value['records'] if r.get('kind')=='result')
    assert result['success'] is True
    return value,result

def test_actual_installed_native_historical_provenance(capture):
    value,result=capture
    provenance=next(r for r in value['records'] if r.get('kind')=='fixture_provenance')
    assert provenance['native_version']=='0.3.0' and provenance['historical'] is True
    assert provenance['iss_omm']['NORAD_CAT_ID']==25544
    assert result['historical'] is True and result['node_count']==40
    assert result.get('deadline_seconds',result.get('window_seconds'))==360
    assert all(re.fullmatch('[a-f0-9]{64}',provenance[k]) for k in ['eop_sha256','leap_sha256'])
    assert value['point_metrics']['calls']>0 and value['point_metrics']['rows']>=40

@pytest.mark.parametrize('kind',['observe','compute','relay','pickup','fleet_update'])
def test_actual_full_scope_plan_abort_replan_receipts(capture,kind):
    value,result=capture
    row=next(r for r in result['matrix'] if r['kind']==kind)
    context=row['context']
    assert context['status']=='verified_analysis_inputs' and context['communication_status']=='unknown'
    assert len(context['nodes'])==len(context['definition_hashes'])==40
    assert {n['id'] for n in context['nodes']}==set(context['definition_hashes'])
    assert re.fullmatch('[a-f0-9]{64}',context['context_hash'])
    assert context['deployment']['run_id'] and context['deployment']['revision']==1
    assert isinstance(row['feasible'],bool)
    assert row['abort']['accepted'] is True and row['abort']['decision']=='abort'
    assert row['replan']['mission_version']==row['abort']['mission_version']+1
    assert row['final_abort']['accepted'] is True
    if row['feasible']:
        assert row['commit']['accepted'] is True and row['commit']['decision']=='commit'
        assert row['commit']['held_tasks']==len(row['tasks'])
    else:
        assert row['commit'] is None
    if kind=='pickup':
        external=row['external_report']['external']
        provenance=next(r for r in value['records'] if r.get('kind')=='fixture_provenance')
        assert external['catalog_number']==25544 and external['frame']=='ITRF'
        assert external['eop_sha256']==provenance['eop_sha256']
        assert external['leap_sha256']==provenance['leap_sha256']
        assert row['external_report']['comparison_frame']=='WGS84_GEODETIC_EARTH_FIXED_APPROX'
    else:assert row['external_report'] is None
    commands=[r for r in value['records'] if r.get('request',{}).get('path') in ['/api/orchestration/plan','/api/orchestration/commit'] and r['request']['body'].get('mission_id',r['request']['body'].get('mission',{}).get('id'))==row['id']]
    assert len(commands)>=4
    plans=[r['response'] for r in commands if r['request']['path']=='/api/orchestration/plan']
    assert len(plans)==2
    assert all(p['feasible']==row['feasible'] for p in plans)
    if not row['feasible']:
        assert any(check['ok'] is False for check in plans[0]['checks'])
    assert all(r['status']==200 and r['response']['exchange_contract']=='guarded-v1' for r in commands)

def test_all_native_windows_and_approvals_used_actual_http(capture):
    value,result=capture
    replies=[r for r in value['records'] if 'request' in r]
    assert all(r['status']==200 for r in replies)
    windows=[r for r in replies if r['request']['path']=='/api/nodes/mission-windows']
    assert len(windows)==10
    for row in windows:
        accepted=row['response']['accepted_context']
        assert row['request']['headers']['X-ISDC-Mission-Context']==accepted['context_hash']
        assert row['response']['node_definitions']==accepted['nodes']
        assert row['response']['definition_hashes']==accepted['definition_hashes']
        assert row['response']['conditions']['start_utc']==accepted['utc']
        from foundation.orbit_time import parse_utc
        assert abs(float((parse_utc(row['response']['conditions']['end_utc']).as_time()-parse_utc(accepted['utc']).as_time()).sec)-7200)<1e-8
