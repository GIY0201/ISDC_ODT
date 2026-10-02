import hashlib,json
from dataclasses import replace
import pytest
from fastapi.testclient import TestClient
import astropy_iers_data
from data.orbit_inputs import load_orbit_input
from data.earth_orientation import EarthOrientationSnapshot
from user_application.web.application import create_app
from digital_twin.contracts.orbit import OrbitCalculation,OrbitSample

L1='1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992'
L2='2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'
UTC='2020-07-12T21:16:01.000416Z'

@pytest.fixture
def inputs(tmp_path):
    raw=(L1+'\n'+L2).encode();path=tmp_path/'iss.tle';path.write_bytes(raw)
    return (load_orbit_input(path,format='TLE',source='https://docs.rs/crate/sgp4/2.4.0/source/examples/tle_afspc.rs',fetched_utc='2026-10-02T00:00:00Z',expected_sha256=hashlib.sha256(raw).hexdigest()),)

@pytest.fixture
def eop():
    return EarthOrientationSnapshot.load(astropy_iers_data.IERS_B_FILE,astropy_iers_data.IERS_LEAP_SECOND_FILE,eop_sha256='31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7',leap_sha256='6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7')

def selection(input_id,**changes):
    return dict(client_request_id='selection',expected_revision=0,input_id=input_id,ground_point=dict(latitude_deg=33.4996,longitude_deg=126.5312,ellipsoid_height_m=0),minimum_elevation_deg=10,anchor_utc=UTC,playing=False,play_rate=1)|changes

def samples(input_id,**changes):
    return dict(client_request_id='samples',selection_revision=1,input_id=input_id,start_utc=UTC,step_seconds=1,count=3)|changes

def test_inputs_state_and_actual_samples(inputs,eop):
    with TestClient(create_app(orbit_inputs=inputs,eop_provider=eop)) as client:
        listed=client.get('/api/orbit/inputs').json()
        assert len(listed['inputs'])==1 and listed['inputs'][0]['raw_sha256']==inputs[0].raw_sha256
        assert 'tle' not in listed['inputs'][0] and 'path' not in json.dumps(listed)
        state=client.get('/api/orbit/state').json();assert state['revision']==0 and state['input_id'] is None
        response=client.put('/api/orbit/selection',json=selection(inputs[0].input_id));assert response.status_code==200
        chosen=response.json();assert chosen['revision']==1 and chosen['current_utc'].endswith('Z')
        response=client.post('/api/orbit/samples',json=samples(inputs[0].input_id));assert response.status_code==200
        data=response.json();assert data['status']=='complete' and not data['stale'] and len(data['rows'])==3
        assert data['client_request_id']=='samples' and data['revision']==1 and data['input_hash']==inputs[0].raw_sha256
        assert data['eop_sha256']==eop.eop_sha256 and data['leap_sha256']==eop.leap_sha256
        assert data['frame']=='ITRF' and data['units']['position']=='m' and data['communication_status']=='unknown'
        assert all(row['status']=='valid' and row['position_m'] is not None for row in data['rows'])
        assert client.get('/api/orbit/state').json()['revision']==1
        assert client.post('/api/runtime/control',json={'action':'pause'}).status_code==200

@pytest.mark.parametrize('changes',[{'anchor_utc':'2020-07-12'},{'anchor_utc':'2020-07-12T00:00:00+09:00'},{'playing':1},{'play_rate':float('nan')},{'minimum_elevation_deg':91},{'ground_point':{'latitude_deg':91,'longitude_deg':0,'ellipsoid_height_m':0}},{'expected_revision':True}])
def test_selection_validation_returns_422_without_mutation(inputs,changes):
    with TestClient(create_app(orbit_inputs=inputs)) as client:
        response=client.put('/api/orbit/selection',content=json.dumps(selection(inputs[0].input_id,**changes)),headers={'Content-Type':'application/json'})
        assert response.status_code==422
        assert client.get('/api/orbit/state').json()['revision']==0

def test_missing_input_conflict_and_unavailable(inputs):
    with TestClient(create_app(orbit_inputs=inputs)) as client:
        assert client.put('/api/orbit/selection',json=selection('unknown')).status_code==404
        assert client.put('/api/orbit/selection',json=selection(inputs[0].input_id)).status_code==200
        response=client.put('/api/orbit/selection',json=selection(inputs[0].input_id));assert response.status_code==409
        assert response.json()['detail']['code']=='revision_conflict'
        assert client.post('/api/orbit/samples',json=samples('unknown')).status_code==404
        assert client.post('/api/orbit/samples',json=samples(inputs[0].input_id,selection_revision=0)).status_code==409
        assert client.post('/api/orbit/samples',json=samples(inputs[0].input_id)).status_code==503

@pytest.mark.parametrize('changes',[{'count':3602},{'count':0},{'count':True},{'step_seconds':0},{'step_seconds':float('inf')},{'start_utc':'bad'},{'selection_revision':True}])
def test_sample_validation(inputs,changes):
    with TestClient(create_app(orbit_inputs=inputs)) as client:
        client.put('/api/orbit/selection',json=selection(inputs[0].input_id))
        response=client.post('/api/orbit/samples',content=json.dumps(samples(inputs[0].input_id,**changes)),headers={'Content-Type':'application/json'})
        assert response.status_code==422

def test_partial_errors_and_no_numeric_fallback(inputs):
    def calculate(orbit,utc,site):
        return OrbitCalculation((OrbitSample(utc[0],None,None,'decayed'),OrbitSample(utc[1],(1.,2.,3.),10.,None)),'eop-hash','leap-hash')
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculate)) as client:
        client.put('/api/orbit/selection',json=selection(inputs[0].input_id))
        data=client.post('/api/orbit/samples',json=samples(inputs[0].input_id,count=2)).json()
        assert data['status']=='partial' and data['rows'][0]['status']=='error'
        assert data['rows'][0]['position_m'] is None and data['rows'][0]['elevation_deg'] is None

def test_queue_full_and_missing_native_map_to_503(inputs):
    from communication.native.orbit_execution import OrbitBusy
    for error in (OrbitBusy('full'),ModuleNotFoundError("native missing",name='isdc_orbit_propagation')):
        def calculate(*args):raise error
        with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculate)) as client:
            client.put('/api/orbit/selection',json=selection(inputs[0].input_id))
            assert client.post('/api/orbit/samples',json=samples(inputs[0].input_id)).status_code==503

def test_eop_range_is_422(inputs):
    def calculate(*args):raise ValueError('UTC outside EOP snapshot range')
    with TestClient(create_app(orbit_inputs=inputs,orbit_calculator=calculate)) as client:
        client.put('/api/orbit/selection',json=selection(inputs[0].input_id))
        response=client.post('/api/orbit/samples',json=samples(inputs[0].input_id))
        assert response.status_code==422 and response.json()['detail']['code']=='eop_out_of_range'
