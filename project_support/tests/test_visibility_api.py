"""T021 HTTP acceptance tests before T022 endpoint/runtime assembly.

Use the real app, selection and visibility search. Only injected propagation
is replaced for analytic/failure cases; one case uses the installed native
wheel and frozen EOP. A missing endpoint is RED, never skipped or mocked.
"""
from dataclasses import replace
import hashlib
import json

import astropy_iers_data
import pytest
from fastapi.testclient import TestClient
from foundation.orbit_time import parse_utc, advance_seconds
from data.orbit_inputs import load_orbit_input
from data.earth_orientation import EarthOrientationSnapshot
from digital_twin.contracts.orbit import OrbitCalculation, OrbitSample, OrbitBusy, OrbitUnavailable
from user_application.web.application import create_app

UTC = '2020-07-12T21:16:01.000416000Z'
EOP_HASH = '31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7'
LEAP_HASH = '6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7'
SITE = dict(latitude_deg=33.4996, longitude_deg=126.5312, ellipsoid_height_m=0)
L1 = '1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992'
L2 = '2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'


def at(seconds):
    return advance_seconds(parse_utc(UTC), seconds).iso_utc


@pytest.fixture
def inputs(tmp_path):
    raw = (L1+'\n'+L2).encode()
    path = tmp_path/'iss.tle'
    path.write_bytes(raw)
    record = load_orbit_input(path, format='TLE', source='frozen historical ISS fixture',
        fetched_utc='2026-10-02T00:00:00Z', expected_sha256=hashlib.sha256(raw).hexdigest())
    # A second valid metadata ID tests routing against an unselected input;
    # it deliberately uses the same physical orbit, not a second satellite.
    return record, replace(record, input_id='other-context-fixture')


def choose(client, input_id, **changes):
    body = dict(client_request_id='visibility-selection', expected_revision=0,
        input_id=input_id, ground_point=SITE, minimum_elevation_deg=10,
        anchor_utc=UTC, playing=False, play_rate=1) | changes
    response = client.put('/api/orbit/selection', json=body)
    assert response.status_code == 200
    return response.json()


def query(selected_input_id, **changes):
    return dict(client_request_id='visibility-query', selection_revision=1,
        input_id=selected_input_id, start_utc=UTC, end_utc=at(30), ground_point=SITE,
        minimum_elevation_deg=10) | changes


def post(client, body):
    # Raw JSON also permits invalid NaN/Inf payloads for schema rejection;
    # the response must never echo those values into strict JSON.
    return client.post('/api/orbit/visibility', content=json.dumps(body),
                       headers={'Content-Type':'application/json'})


def calculator(fn, failures=None, calls=None):
    def calculate(orbit, times, site):
        if calls is not None: calls.append((orbit.input_id, times, site))
        rows = []
        for utc in times:
            t = float((parse_utc(utc).as_time().tai-parse_utc(UTC).as_time().tai).sec)
            if failures is not None and failures(t):
                rows.append(OrbitSample(utc, None, None, 'synthetic_failure'))
            else:
                rows.append(OrbitSample(utc,(7000000.,0.,0.),float(fn(t)),None))
        return OrbitCalculation(tuple(rows),EOP_HASH,LEAP_HASH)
    return calculate


def test_existing_selection_setup_is_independently_valid(inputs):
    with TestClient(create_app(orbit_inputs=inputs)) as client:
        data = choose(client, inputs[0].input_id)
        assert data['revision'] == 1 and data['current_utc'] == UTC
        assert data['ground_point']['virtual'] and data['communication_status'] == 'unknown'


def test_complete_query_context_provenance_and_read_only_state(inputs):
    calls = []
    with TestClient(create_app(orbit_inputs=inputs, orbit_calculator=calculator(lambda t:11,calls=calls))) as client:
        before = choose(client,inputs[0].input_id)
        response = post(client,query(inputs[0].input_id))
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'complete' and not data['stale'] and not data['errors']
        assert data['client_request_id'] == 'visibility-query' and data['revision'] == 1
        assert data['input_id'] == inputs[0].input_id and data['input_hash'] == inputs[0].raw_sha256
        assert data['eop_sha256'] == EOP_HASH and data['leap_sha256'] == LEAP_HASH
        assert data['frame'] == 'ITRF' and data['profile'] == 'WGS72_AFSPC'
        assert data['units']['time'] == 'UTC' and data['units']['elevation'] == 'deg'
        assert data['communication_status'] == 'unknown'
        assert data['query_start_utc'] == UTC and data['query_end_utc'] == at(30)
        assert data['minimum_elevation_deg'] == 10
        interval = data['intervals'][0]
        assert interval['start_clipped'] and interval['end_clipped']
        assert interval['start_utc'] == UTC and interval['end_utc'] == at(30)
        assert interval['max_elevation_deg'] == 11
        assert not data['contacts'] and calls
        assert 'tle' not in data and 'path' not in data
        after = client.get('/api/orbit/state').json()
        for key in ('revision','input_id','anchor_utc','current_utc','ground_point','minimum_elevation_deg','playing','play_rate'):
            assert after[key] == before[key]
        assert client.get('/api/health').status_code == 200


@pytest.mark.parametrize('mode,expected', [('none','none'),('partial','partial'),('error','error')])
def test_no_visibility_is_distinct_from_partial_or_total_failure(inputs,mode,expected):
    failure = (lambda t: 10 <= t <= 12) if mode == 'partial' else (lambda t: True) if mode == 'error' else None
    fn = (lambda t: 9) if mode == 'none' else (lambda t: 11)
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculator(fn,failure))) as client:
        choose(client,inputs[0].input_id)
        response = post(client,query(inputs[0].input_id))
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == expected and data['communication_status'] == 'unknown'
        assert bool(data['errors']) == (mode != 'none')
        if mode != 'partial': assert not data['intervals'] and not data['contacts']
        for error in data['errors']:
            assert error['error_code'] == 'synthetic_failure' and error['utc'].endswith('Z')
        if mode == 'partial':
            for interval in data['intervals']:
                a = float((parse_utc(interval['start_utc']).as_time().tai-parse_utc(UTC).as_time().tai).sec)
                b = float((parse_utc(interval['end_utc']).as_time().tai-parse_utc(UTC).as_time().tai).sec)
                assert not (a < 10 and b > 12)


def test_tangent_contact_is_separate_zero_duration_result(inputs):
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculator(lambda t:10-(t-15.123)**2))) as client:
        choose(client,inputs[0].input_id)
        response = post(client,query(inputs[0].input_id,start_utc=at(14),end_utc=at(17)))
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'complete' and not data['intervals'] and len(data['contacts']) == 1
        assert data['contacts'][0]['duration_seconds'] == 0
        assert data['contacts'][0]['elevation_deg'] == 10
        t = float((parse_utc(data['contacts'][0]['utc']).as_time().tai-parse_utc(UTC).as_time().tai).sec)
        assert t == pytest.approx(15.123,abs=.01)


@pytest.mark.parametrize('changes', [
    {'minimum_elevation_deg':-.001}, {'minimum_elevation_deg':90.001},
    {'minimum_elevation_deg':float('nan')}, {'minimum_elevation_deg':True},
    {'start_utc':'bad'}, {'start_utc':'2020-07-12T21:16:01+09:00'},
    {'end_utc':UTC}, {'end_utc':at(-1)}, {'end_utc':at(86400.001)},
    {'selection_revision':True}, {'selection_revision':-1},
    {'client_request_id':''}, {'client_request_id':' '}, {'unexpected':1},
    {'ground_point':SITE|{'latitude_deg':91}},
    {'ground_point':SITE|{'longitude_deg':181}},
    {'ground_point':SITE|{'ellipsoid_height_m':float('inf')}},
    {'ground_point':SITE|{'virtual':False}},
    {'ground_point':SITE|{'ellipsoid':'sphere'}},
])
def test_invalid_request_is_422_before_evaluation_and_without_mutation(inputs,changes):
    calls = []
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculator(lambda t:11,calls=calls))) as client:
        before = choose(client,inputs[0].input_id)
        response = post(client,query(inputs[0].input_id,**changes))
        assert response.status_code == 422 and not calls
        assert client.get('/api/orbit/state').json()['revision'] == before['revision']
        assert 'NaN' not in response.text and 'Infinity' not in response.text


@pytest.mark.parametrize('changes', [
    {'selection_revision':0}, {'ground_point':SITE|{'longitude_deg':0}},
    {'ground_point':SITE|{'ellipsoid_height_m':1}}, {'minimum_elevation_deg':11},
    {'input_id':'other-context-fixture'},
])
def test_valid_but_different_selected_context_is_409_before_evaluation(inputs,changes):
    calls = []
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculator(lambda t:11,calls=calls))) as client:
        choose(client,inputs[0].input_id)
        response = post(client,query(inputs[0].input_id,**changes))
        assert response.status_code == 409 and not calls
        error = response.json()['detail']
        assert error['code'] == 'revision_conflict' and error['state']['revision'] == 1


def test_no_selection_is_409_and_unknown_input_is_404(inputs):
    calls = []
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculator(lambda t:11,calls=calls))) as client:
        response = post(client,query(inputs[0].input_id,selection_revision=0))
        assert response.status_code == 409 and not calls
        response = post(client,query('missing-input',selection_revision=0))
        assert response.status_code == 404 and response.json()['detail']['code'] == 'input_not_found'


@pytest.mark.parametrize('error', [OrbitBusy('queue full'),OrbitUnavailable('not ready'),
    ModuleNotFoundError('native missing',name='isdc_orbit_propagation')])
def test_unavailable_calculation_is_503(inputs,error):
    def fail(*args): raise error
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=fail)) as client:
        choose(client,inputs[0].input_id)
        response = post(client,query(inputs[0].input_id))
        assert response.status_code == 503 and 'detail' in response.json()


def test_unconfigured_app_is_503(inputs):
    with TestClient(create_app(orbit_inputs=inputs)) as client:
        choose(client,inputs[0].input_id)
        assert post(client,query(inputs[0].input_id)).status_code == 503


def test_eop_range_error_is_422_not_empty_success(inputs):
    def fail(*args): raise ValueError('UTC outside EOP snapshot range')
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=fail)) as client:
        choose(client,inputs[0].input_id)
        response = post(client,query(inputs[0].input_id))
        assert response.status_code == 422
        assert response.json()['detail']['code'] == 'eop_out_of_range'


def test_positive_leap_second_range_preserves_three_si_seconds(inputs):
    def calculate(orbit,times,site):
        return OrbitCalculation(tuple(OrbitSample(t,(7000000.,0.,0.),11.,None) for t in times),EOP_HASH,LEAP_HASH)
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculate)) as client:
        choose(client,inputs[0].input_id)
        body = query(inputs[0].input_id,start_utc='2016-12-31T23:59:59Z',end_utc='2017-01-01T00:00:01Z')
        response = post(client,body)
        assert response.status_code == 200
        interval = response.json()['intervals'][0]
        elapsed = float((parse_utc(interval['end_utc']).as_time().tai-parse_utc(interval['start_utc']).as_time().tai).sec)
        assert elapsed == pytest.approx(3.,abs=1e-8)


@pytest.mark.parametrize('duration', [.5,86400.])
def test_positive_subsecond_and_exact_24h_ranges_are_accepted(inputs,duration):
    def calculate(orbit,times,site):
        return OrbitCalculation(tuple(OrbitSample(t,(7000000.,0.,0.),11.,None) for t in times),EOP_HASH,LEAP_HASH)
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculate)) as client:
        choose(client,inputs[0].input_id)
        response = post(client,query(inputs[0].input_id,end_utc=at(duration)))
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'complete' and len(data['intervals']) == 1
        assert data['query_end_utc'] == at(duration)


@pytest.mark.parametrize('threshold', [0.,90.])
def test_valid_threshold_limits_match_selection(inputs,threshold):
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculator(lambda t:threshold))) as client:
        choose(client,inputs[0].input_id,minimum_elevation_deg=threshold)
        response = post(client,query(inputs[0].input_id,minimum_elevation_deg=threshold))
        assert response.status_code == 200 and response.json()['status'] == 'complete'
        assert response.json()['minimum_elevation_deg'] == threshold


def test_actual_stored_iss_native_geometry_visibility_path(inputs):
    eop = EarthOrientationSnapshot.load(astropy_iers_data.IERS_B_FILE,astropy_iers_data.IERS_LEAP_SECOND_FILE,
                                        eop_sha256=EOP_HASH,leap_sha256=LEAP_HASH)
    with TestClient(create_app(orbit_inputs=inputs,eop_provider=eop)) as client:
        choose(client,inputs[0].input_id)
        response = post(client,query(inputs[0].input_id,start_utc=at(1900),end_utc=at(2300)))
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'complete' and len(data['intervals']) == 1 and not data['errors']
        interval = data['intervals'][0]
        for key,expected in [('start_utc',1949.5),('end_utc',2212.5)]:
            offset = float((parse_utc(interval[key]).as_time().tai-parse_utc(UTC).as_time().tai).sec)
            assert abs(offset-expected) <= 1
        assert not interval['start_clipped'] and not interval['end_clipped']
        assert data['communication_status'] == 'unknown' and data['eop_sha256'] == EOP_HASH
