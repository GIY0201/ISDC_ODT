import asyncio
from dataclasses import replace,asdict
import numpy as np
import pytest
from test_catalog_scene import scene_query
from digital_twin.contracts.orbit import GroundPoint,OrbitSample
from digital_twin.contracts.catalog_geometry import CatalogGpChanged
from digital_twin.simulation.visibility import search_visibility
from foundation.orbit_time import parse_utc

def selected(q):return asyncio.run(q.position('active',103))
def track(q,base,**changes):
    args=dict(group='active',catalog_number=103,expected_hash=base['normalized_gp_sha256'],utc=base['utc'],client_request_id='track-test');args.update(changes)
    return asyncio.run(q.track(**args))

def test_track_source_period_dense_samples_and_same_native_reference(scene_query):
    q=scene_query;base=selected(q);value=track(q,base)
    period=86400/q.catalog.items[-1]['MEAN_MOTION'];assert value['period_seconds']==pytest.approx(period)
    assert 901<=value['count']<=1023 and value['count']==value['valid_count']+value['error_count'] and value['error_count']==0
    times=np.array([(parse_utc(row['utc']).as_time().tai-parse_utc(base['utc']).as_time().tai).sec for row in value['rows']])
    assert np.all(np.diff(times)>0);assert times[0]==pytest.approx(-period/2,abs=1e-7);assert times[-1]==pytest.approx(period/2,abs=1e-7)
    dense=times[np.abs(times)<=45+1e-7];assert len(dense)==901;assert np.diff(dense)==pytest.approx(np.full(900,.1),abs=1e-7)
    center=value['rows'][np.argmin(abs(times))];assert center['utc']==base['utc'];assert center['position_m']==pytest.approx(base['position_m'],abs=1e-8)
    assert value['normalized_gp_sha256']==base['normalized_gp_sha256'] and value['frame']=='ITRF'
    assert value['units']=={'position':'m','time':'UTC','period':'s'}

def test_track_failure_mask_and_gp_conflict(scene_query):
    q=scene_query;base=selected(q);original=q.calculate
    def calculate(orbit,utc,point):
        result=original(orbit,utc,point);rows=list(result.rows);rows[len(rows)//2]=OrbitSample(rows[len(rows)//2].utc,None,None,'decayed');return replace(result,rows=tuple(rows))
    q.calculate=calculate;value=track(q,base)
    assert value['status']=='partial' and value['error_count']==1
    assert sum(row['position_m'] is None for row in value['rows'])==1
    with pytest.raises(CatalogGpChanged):track(q,base,expected_hash='0'*64)
    with pytest.raises(ValueError):track(q,base,utc='local')

def test_catalog_visibility_reuses_precise_search_and_keeps_catalog_readonly(scene_query):
    q=scene_query;base=selected(q);point=GroundPoint(36.3742,127.3567,123.45);start=base['utc'];end='2020-07-12T21:17:41.000416000Z'
    orbit=asyncio.run(q._input('active',103))[2]
    expected=search_visibility(calculate=lambda stamps:q.calculate(orbit,stamps,point),calculate_times=lambda times:q.calculate.evaluate_times(orbit,times,point),start_utc=start,end_utc=end,minimum_elevation_deg=5)
    value=asyncio.run(q.visibility('active',103,base['normalized_gp_sha256'],start,end,point,5,'passes-test'))
    for key,item in asdict(expected).items():assert value[key]==item
    assert value['ground_point']['ellipsoid_height_m']==123.45 and value['communication_status']=='unknown'
    assert value['normalized_gp_sha256']==base['normalized_gp_sha256'];assert selected(q)==base
    with pytest.raises(CatalogGpChanged):asyncio.run(q.visibility('active',103,'0'*64,start,end,point,5,'changed'))

def test_track_and_visibility_http_strict_errors_and_readonly(scene_query):
    from fastapi.testclient import TestClient
    from user_application.web.application import create_app
    q=scene_query;base=selected(q)
    identity=dict(group='active',catalog_number=103,normalized_gp_sha256=base['normalized_gp_sha256'],client_request_id='http-track')
    point=dict(latitude_deg=36.3742,longitude_deg=127.3567,ellipsoid_height_m=123.45,virtual=True,ellipsoid='WGS84')
    requests=[('/api/catalog/track',identity|dict(utc=base['utc'])),('/api/catalog/visibility',identity|dict(query_start_utc=base['utc'],query_end_utc='2020-07-12T21:17:41.000416000Z',ground_point=point,minimum_elevation_deg=5.0))]
    with TestClient(create_app(catalog_geometry_query=q)) as client:
        # Pause this isolated fixture so natural SIM ticks cannot be mistaken
        # for mutation by a long readonly calculation.
        assert client.post('/api/runtime/control',json={'action':'pause'}).status_code==200
        before=client.get('/api/orbit/state').json();sim=client.get('/api/bootstrap').json()['runtime']
        for path,payload in requests:
            response=client.post(path,json=payload);assert response.status_code==200,response.text
            assert response.json()['normalized_gp_sha256']==identity['normalized_gp_sha256']
            for bad in [dict(client_request_id=' '),dict(catalog_number=True),dict(normalized_gp_sha256='BAD'),dict(input_id='stored-orbit')]:assert client.post(path,json=payload|bad).status_code==422
            assert client.post(path,json=payload|dict(normalized_gp_sha256='0'*64)).status_code==409
        payload=requests[1][1]
        for bad in [dict(query_end_utc=base['utc']),dict(query_end_utc='2020-07-14T21:17:41.000416000Z'),dict(query_start_utc='local'),dict(minimum_elevation_deg=91)]:assert client.post(requests[1][0],json=payload|bad).status_code==422
        after=client.get('/api/orbit/state').json();before.pop('observed_monotonic_s');after.pop('observed_monotonic_s');assert after==before
        assert client.get('/api/bootstrap').json()['runtime']==sim
    with TestClient(create_app()) as client:
        for path,payload in requests:assert client.post(path,json=payload).status_code==503

def test_track_and_visibility_http_preserve_busy_errors(scene_query):
    from fastapi.testclient import TestClient
    from user_application.web.application import create_app
    from digital_twin.contracts.orbit import OrbitBusy
    class Busy:
        async def track(self,*args):raise OrbitBusy('queue full')
        async def visibility(self,*args):raise OrbitBusy('queue full')
    base=selected(scene_query);identity=dict(group='active',catalog_number=103,normalized_gp_sha256=base['normalized_gp_sha256'],client_request_id='busy')
    with TestClient(create_app(catalog_geometry_query=Busy())) as client:
        assert client.post('/api/catalog/track',json=identity|dict(utc=base['utc'])).status_code==503
        assert client.post('/api/catalog/visibility',json=identity|dict(query_start_utc=base['utc'],query_end_utc='2020-07-12T21:17:41.000416000Z',ground_point=dict(latitude_deg=0.,longitude_deg=0.,ellipsoid_height_m=0.,virtual=True,ellipsoid='WGS84'),minimum_elevation_deg=5.)).status_code==503
