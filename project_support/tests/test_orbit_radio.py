import asyncio
from dataclasses import replace
import numpy as np
import pytest
from fastapi.testclient import TestClient
from digital_twin.simulation.orbit_radio import radio_geometry
from digital_twin.simulation.orbit_geometry import station_itrf
from digital_twin.contracts.orbit import GroundPoint, OrbitConflict
from foundation.orbit_time import parse_utc,advance_seconds
from user_application.orbit_calculation import create_orbit_calculation
from user_application.web.application import create_app
from project_support.tests.test_orbit_api import inputs,eop,selection,UTC

FREQUENCY=437825000.
@pytest.mark.parametrize('velocity,rate',[(1000.,1000.),(-1000.,-1000.),(0.,0.)])
def test_analytic_sign_units_and_frequency_scaling(velocity,rate):
    site=GroundPoint(0,0,0);station=station_itrf(site)
    value=radio_geometry(station+[400000,0,0],[velocity,7500,0],site,FREQUENCY)
    assert value[0]==pytest.approx(400000)
    assert value[1]==pytest.approx(rate)
    assert value[2]==pytest.approx(-FREQUENCY*rate/299792458)
    assert value[3]==pytest.approx(FREQUENCY+value[2])
    assert radio_geometry(station+[400000,0,0],[velocity,7500,0],site,2*FREQUENCY)[2]==pytest.approx(2*value[2])

@pytest.mark.parametrize('frequency',[0,-1,True,float('nan'),float('inf'),300000000001])
def test_frequency_and_geometry_boundaries(frequency):
    site=GroundPoint(0,0,0)
    with pytest.raises(ValueError):radio_geometry([7000000,0,0],[0,7500,0],site,frequency)

def test_coincident_and_nonfinite_vectors():
    site=GroundPoint(0,0,0)
    for position,velocity in [(station_itrf(site),[0,0,0]),([float('nan'),0,0],[0,0,0]),([7000000,0,0],[float('inf'),0,0]),([True,2,3],[0,0,0]),([7000000,0],[0,0,0])]:
        with pytest.raises(ValueError):radio_geometry(position,velocity,site,FREQUENCY)

def request(input_id,**changes):
    return dict(client_request_id='radio',selection_revision=1,input_id=input_id,utc=UTC,frequency_hz=FREQUENCY)|changes

def test_real_native_chain_and_distance_derivative(inputs,eop):
    calc=create_orbit_calculation(eop);site=GroundPoint(33.4996,126.5312,0);instant=parse_utc(UTC)
    result=calc.radio(inputs[0],instant.iso_utc,site,FREQUENCY)
    assert result.error_code is None and result.range_m>0
    assert result.doppler_hz==pytest.approx(-FREQUENCY*result.range_rate_m_s/299792458)
    errors=[]
    for h in [1,.1,.01]:
        left=calc(inputs[0],[advance_seconds(instant,-h).iso_utc],site).rows[0].position_m
        right=calc(inputs[0],[advance_seconds(instant,h).iso_utc],site).rows[0].position_m
        derivative=(np.linalg.norm(np.array(right)-station_itrf(site))-np.linalg.norm(np.array(left)-station_itrf(site)))/(2*h)
        errors.append(abs(derivative-result.range_rate_m_s))
    assert max(errors)<.1
    # Separate coordinate implementation, with common ERFA/theory acknowledged.
    from project_support.tests.test_orbit_geometry import reference
    from communication.native.orbit_adapter import propagate
    from astropy.time import Time
    _,native=propagate(inputs[0],[instant.iso_utc]).valid_rows()
    positions,velocities,_=reference(Time([instant.as_time()]),native[:,:3],native[:,3:],site,eop._table)
    np.testing.assert_allclose(result.position_m,positions[0],rtol=0,atol=1e-5)
    np.testing.assert_allclose(result.velocity_m_s,velocities[0],rtol=0,atol=.1)
    displacement=positions[0]-station_itrf(site)
    assert result.range_rate_m_s==pytest.approx(np.dot(displacement,velocities[0])/np.linalg.norm(displacement),abs=.1)

def test_api_read_only_echo_and_conflict(inputs,eop):
    with TestClient(create_app(orbit_inputs=inputs,eop_provider=eop)) as client:
        client.put('/api/orbit/selection',json=selection(inputs[0].input_id))
        before=client.get('/api/orbit/state').json()
        response=client.post('/api/orbit/radio-geometry',json=request(inputs[0].input_id));assert response.status_code==200
        data=response.json();assert data['status']=='valid' and data['communication_status']=='unknown'
        assert data['model']=='one_way_first_order_v1' and data['frequency_hz']==FREQUENCY and data['stale'] is False
        assert data['ground_point']==before['ground_point'] and data['utc']==parse_utc(UTC).iso_utc
        after=client.get('/api/orbit/state').json()
        assert {k:v for k,v in after.items() if k!='observed_monotonic_s'}=={k:v for k,v in before.items() if k!='observed_monotonic_s'}
        assert client.post('/api/orbit/radio-geometry',json=request(inputs[0].input_id,selection_revision=0)).status_code==409

@pytest.mark.parametrize('changes',[{'frequency_hz':0},{'frequency_hz':True},{'frequency_hz':300000000001},{'utc':'2020-01-01'},{'selection_revision':True},{'extra':1}])
def test_api_invalid_request(inputs,eop,changes):
    with TestClient(create_app(orbit_inputs=inputs,eop_provider=eop)) as client:
        assert client.post('/api/orbit/radio-geometry',json=request(inputs[0].input_id,**changes)).status_code==422

def test_missing_calculator_and_eop_boundary(inputs,eop):
    with TestClient(create_app(orbit_inputs=inputs)) as client:
        client.put('/api/orbit/selection',json=selection(inputs[0].input_id))
        assert client.post('/api/orbit/radio-geometry',json=request(inputs[0].input_id)).status_code==503
    with TestClient(create_app(orbit_inputs=inputs,eop_provider=eop)) as client:
        client.put('/api/orbit/selection',json=selection(inputs[0].input_id))
        response=client.post('/api/orbit/radio-geometry',json=request(inputs[0].input_id,utc='1961-01-01T00:00:00Z'))
        assert response.status_code==422 and response.json()['detail']['code']=='eop_out_of_range'

def test_runtime_late_query_is_stale(inputs,eop):
    from digital_twin.runtime.orbit import OrbitRuntime
    async def scenario():
        entered=asyncio.Event();release=asyncio.Event();calc=create_orbit_calculation(eop)
        async def execute(work):entered.set();await release.wait();return work()
        runtime=OrbitRuntime(lookup_input=lambda _:inputs[0],calculate=calc,execute=execute)
        args=selection(inputs[0].input_id);args['ground_point']=GroundPoint(33.4996,126.5312,0)
        await runtime.select(**args)
        pending=asyncio.create_task(runtime.radio_geometry(**request(inputs[0].input_id)))
        await entered.wait();await runtime.select(**(args|{'expected_revision':1}));release.set()
        assert (await pending).stale is True
    asyncio.run(scenario())

@pytest.mark.parametrize('changes',[{'elevation_deg':0},{'eop_sha256':'0'*64},{'leap_sha256':'bad'},{'error_code':'DECAYED'}])
def test_injected_contract_cannot_forge_elevation_or_provenance(inputs,eop,changes):
    from digital_twin.runtime.orbit import OrbitRuntime
    async def scenario():
        site=GroundPoint(0,0,0);base=create_orbit_calculation(eop)
        correct=base.radio(inputs[0],parse_utc(UTC).iso_utc,site,FREQUENCY)
        def fake(*args):return replace(correct,**changes)
        fake.eop_sha256=eop.eop_sha256;fake.leap_sha256=eop.leap_sha256
        def calculator(*args):raise AssertionError('legacy calculation must not run')
        calculator.radio=fake
        async def execute(work):return work()
        runtime=OrbitRuntime(lookup_input=lambda _:inputs[0],calculate=calculator,execute=execute)
        args=selection(inputs[0].input_id);args['ground_point']=site
        await runtime.select(**args)
        with pytest.raises(RuntimeError):await runtime.radio_geometry(**request(inputs[0].input_id))
    asyncio.run(scenario())
