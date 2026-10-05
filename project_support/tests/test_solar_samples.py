"""Readonly solar wire/application contracts; no satellite selection required."""
import asyncio
import copy
import hashlib,json
from pathlib import Path
import numpy as np
import pytest
import astropy_iers_data
from fastapi.testclient import TestClient
from foundation.orbit_time import parse_utc
from data.earth_orientation import EarthOrientationSnapshot
from digital_twin.simulation.solar_geometry import solar_directions
from digital_twin.contracts.orbit import OrbitBusy
from user_application.solar_geometry import SolarGeometryQuery
from user_application.web.application import create_app


@pytest.fixture
def solar_query():
    a=Path(astropy_iers_data.IERS_A_FILE);l=Path(astropy_iers_data.IERS_LEAP_SECOND_FILE)
    eop=EarthOrientationSnapshot.load(a,l,eop_sha256=hashlib.sha256(a.read_bytes()).hexdigest(),
        leap_sha256=hashlib.sha256(l.read_bytes()).hexdigest(),table_kind='IERS_A')
    calls=[]
    async def execute(work):calls.append(True);return work()
    return SolarGeometryQuery(eop,execute),calls


def payload(**overrides):
    return dict(client_request_id='solar-test',start_utc='2020-07-12T21:16:01.000416000Z',step_seconds=1,count=3)|overrides


def orbit_state(c):
    value=c.get('/api/orbit/state').json();value.pop('observed_monotonic_s');return value


def test_http_scalar_batch_and_no_runtime_mutation(solar_query):
    q,calls=solar_query
    with TestClient(create_app(solar_geometry_query=q)) as c:
        orbit=orbit_state(c);sim=c.get('/api/bootstrap').json()['runtime'];command=payload()
        response=c.post('/api/solar/samples',json=command);assert response.status_code==200,response.text
        data=response.json();assert data['frame']=='ITRF' and data['schema_version']==1
        assert data['client_request_id']==command['client_request_id'] and data['count']==3
        assert data['start_utc']==command['start_utc'] and data['step_seconds']==1
        assert data['solar_model']=='ERFA_builtin' and data['frame_transform']=='IAU2006_2000A'
        assert data['observed_cip_offsets'] is False and data['purpose']=='display_geometry'
        for row in data['rows']:
            assert row['status']=='valid' and row['eop_quality']['ut1'] in ('final_b','observed_a','predicted_a')
            t=parse_utc(row['utc']);v=solar_directions([t],[q.eop.at(t)])
            np.testing.assert_allclose(row['direction_to_sun'],v.direction_to_sun[0],rtol=0,atol=2e-15)
        maximum=c.post('/api/solar/samples',json=payload(count=601)).json()
        assert len(maximum['rows'])==601 and maximum['end_utc']==maximum['rows'][-1]['utc']
        assert orbit_state(c)==orbit
        after=c.get('/api/bootstrap').json()['runtime']
        assert after['run_id']==sim['run_id'] and after['scenario_id']==sim['scenario_id']
        assert calls==[True,True]


def test_si_grid_leap_ownership_and_direct_limits(solar_query):
    q,_=solar_query
    result=asyncio.run(q.samples('2016-12-31T23:59:59Z',1,3,'leap'))
    assert [r['utc'] for r in result['rows']]==['2016-12-31T23:59:59.000000000Z',
        '2016-12-31T23:59:60.000000000Z','2017-01-01T00:00:00.000000000Z']
    original=copy.deepcopy(result);result['rows'][0]['direction_to_sun'][0]=999
    assert asyncio.run(q.samples('2016-12-31T23:59:59Z',1,3,'leap'))==original
    for step,count in [(True,3),(1,True),(2,3),(1,0),(1,602)]:
        with pytest.raises(ValueError):asyncio.run(q.samples(payload()['start_utc'],step,count,'direct'))


@pytest.mark.parametrize('overrides',[{'count':0},{'count':602},{'count':True},{'count':1.5},
    {'step_seconds':True},{'step_seconds':2},{'step_seconds':0},{'start_utc':'local'},
    {'client_request_id':' '},{'client_request_id':'a'*129},{'extra':1}])
def test_invalid_wire_never_executes(solar_query,overrides):
    q,calls=solar_query
    with TestClient(create_app(solar_geometry_query=q)) as c:
        assert c.post('/api/solar/samples',json=payload(**overrides)).status_code==422
    assert calls==[]


def test_missing_profile_outside_eop_and_busy_are_explicit(solar_query):
    with TestClient(create_app()) as c:
        assert c.post('/api/solar/samples',json=payload()).status_code==503
    q,_=solar_query
    with TestClient(create_app(solar_geometry_query=q)) as c:
        assert c.post('/api/solar/samples',json=payload(start_utc='2100-01-01T00:00:00Z')).status_code==422
    async def busy(work):raise OrbitBusy('test queue full')
    with TestClient(create_app(solar_geometry_query=SolarGeometryQuery(q.eop,busy))) as c:
        assert c.post('/api/solar/samples',json=payload()).status_code==503


def test_application_injected_snapshot_is_shared_without_native_requirement(solar_query):
    q,_=solar_query
    with TestClient(create_app(eop_provider=q.eop)) as c:
        assert c.post('/api/solar/samples',json=payload(count=1)).status_code==200


@pytest.mark.parametrize('value',[float('nan'),float('inf'),float('-inf')])
def test_nonfinite_invalid_json_returns_serializable_422(solar_query,value):
    q,calls=solar_query
    with TestClient(create_app(solar_geometry_query=q)) as c:
        reply=c.post('/api/solar/samples',content=json.dumps(payload(count=value)),headers={'Content-Type':'application/json'})
        assert reply.status_code==422 and isinstance(reply.json()['detail'],list)
    assert calls==[]


def test_snapshot_lifespan_and_malformed_snapshot_failure(tmp_path):
    from project_support.tooling.prepare_catalog_geometry import prepare
    path=prepare(tmp_path/'solar_eop')
    with TestClient(create_app(catalog_geometry_manifest_path=path)) as c:
        result=c.post('/api/solar/samples',json=payload()).json()
        assert result['eop_sha256']==json.loads(path.read_text())['eop_sha256']
        assert c.app.state.solar_geometry_query.eop is c.app.state.catalog_geometry_query.eop
    path.write_text('[]')
    with TestClient(create_app(catalog_geometry_manifest_path=path)) as c:
        assert c.post('/api/solar/samples',json=payload()).status_code==503
        assert c.get('/api/orbit/state').status_code==200
