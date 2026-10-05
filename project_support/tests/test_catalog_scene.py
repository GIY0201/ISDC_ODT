"""Full filtered catalog observations, not a table page or runtime mutation."""
import asyncio
import copy
import hashlib
from pathlib import Path
import pytest
from test_catalog_position import OMM
from data.earth_orientation import EarthOrientationSnapshot
from user_application.catalog_geometry import CatalogGeometryQuery
from user_application.orbit_calculation import create_orbit_calculation


@pytest.fixture
def scene_query():
    import astropy_iers_data as files
    a=Path(files.IERS_A_FILE);leap=Path(files.IERS_LEAP_SECOND_FILE)
    eop=EarthOrientationSnapshot.load(a,leap,eop_sha256=hashlib.sha256(a.read_bytes()).hexdigest(),
        leap_sha256=hashlib.sha256(leap.read_bytes()).hexdigest(),table_kind='IERS_A')
    class Catalog:
        items=[OMM|{'NORAD_CAT_ID':i,'ORBIT_REGIME':'LEO'} for i in range(1,104)]
        source='celestrak-cache';calls=[];warning='';fetched='2026-10-01T00:00:00Z'
        def catalog_groups(self):return [{'id':'active'}]
        async def get_satellites(self,**kwargs):
            self.calls.append(kwargs)
            return dict(items=copy.deepcopy(self.items),source=self.source,fetched_at=self.fetched,
                        warning=self.warning,filtered_total=len(self.items))
    async def execute(work):return work()
    return CatalogGeometryQuery(Catalog(),eop,create_orbit_calculation(eop),execute)


def scene(q,**kwargs):
    return asyncio.run(q.scene('active',kwargs.pop('query',''),kwargs.pop('orbit','all'),
        kwargs.pop('utc',OMM['EPOCH']+'Z'),kwargs.pop('request_id','scene-test'),**kwargs))


def test_full_scene_no_page_limit_matches_selected_scalar_and_owns_response(scene_query):
    q=scene_query;r=scene(q)
    assert q.catalog.calls[-1]==dict(group='active',limit=0,query='',orbit='all')
    assert r['count']==103 and r['valid_count']==103 and r['error_count']==0
    assert r['status']=='valid' and r['frame']=='ITRF' and r['eop_quality']['ut1']=='final_b'
    selected=asyncio.run(q.position('active',103))
    assert r['rows'][-1]['normalized_gp_sha256']==selected['normalized_gp_sha256']
    assert r['rows'][-1]['position_m']==pytest.approx(selected['position_m'],abs=1e-8)
    r['rows'][0]['position_m'][0]=0
    again=scene(q);assert again['rows'][0]['position_m'][0]!=0
    assert again['scene_sha256']==r['scene_sha256']


def test_preparation_cache_fresh_metadata_changed_gp_and_conflict(scene_query,monkeypatch):
    import user_application.catalog_geometry as module
    from digital_twin.contracts.catalog_geometry import CatalogGpChanged
    q=scene_query;first=scene(q)
    original=module.load_orbit_input_bytes
    monkeypatch.setattr(module,'load_orbit_input_bytes',lambda *a,**k:pytest.fail('GP prepared again'))
    q.catalog.source='celestrak-stale';q.catalog.warning='offline';q.catalog.fetched='2026-10-02T00:00:00Z'
    second=scene(q,utc='2020-07-12T21:17:01.000416Z',expected_scene_sha256=first['scene_sha256'])
    assert second['warning']=='offline' and second['source']=='celestrak-stale'
    assert second['fetched_at']==q.catalog.fetched and second['rows'][0]['position_m']!=first['rows'][0]['position_m']
    q.catalog.items[0]['MEAN_ANOMALY']+=1
    with pytest.raises(CatalogGpChanged):scene(q,expected_scene_sha256=first['scene_sha256'])
    monkeypatch.setattr(module,'load_orbit_input_bytes',original)
    assert scene(q)['scene_sha256']!=first['scene_sha256']


def test_partial_gp_and_native_errors_never_produce_fabricated_positions(scene_query,monkeypatch):
    import user_application.catalog_geometry as module
    from communication.native.orbit_adapter import NativeCatalogBatch
    q=scene_query;q.catalog.items=q.catalog.items[:3]
    q.catalog.items[1]['ECCENTRICITY']=2
    original=module.propagate_catalog
    def propagate(prepared,instant):
        batch=original(prepared,instant)
        return NativeCatalogBatch(batch.input_ids,batch.utc,('decayed',None),batch._buffer)
    monkeypatch.setattr(module,'propagate_catalog',propagate)
    r=scene(q)
    assert (r['count'],r['valid_count'],r['error_count'],r['status'])==(3,1,2,'partial')
    assert [row['catalog_number'] for row in r['rows']]==[1,2,3]
    assert all(row['position_m'] is None and row['error_code'] for row in r['rows'][:2])
    assert r['rows'][2]['status']=='valid'


def test_ambiguous_unavailable_and_incomplete_snapshots_rejected(scene_query):
    from digital_twin.contracts.orbit import OrbitUnavailable
    q=scene_query;q.catalog.items=[q.catalog.items[0]]*2
    with pytest.raises(ValueError,match='duplicate'):scene(q)
    q.catalog.items=[]
    empty=scene(q);assert empty['status']=='valid' and empty['count']==0
    q.catalog.source='demo-fallback'
    with pytest.raises(OrbitUnavailable):scene(q)


def test_full_16633_fixture_and_single_eop_lookup(scene_query,monkeypatch):
    q=scene_query;q.catalog.items=[OMM|{'NORAD_CAT_ID':i,'ORBIT_REGIME':'LEO'} for i in range(1,16634)]
    original=q.eop
    class Eop:
        calls=0
        def quality(self,utc):return original.quality(utc)
        def at(self,utc):self.calls+=1;return original.at(utc)
    q.eop=Eop()
    result=scene(q)
    assert result['count']==16633 and result['valid_count']==16633 and result['error_count']==0
    assert result['rows'][-1]['catalog_number']==16633 and q.eop.calls==1
    assert len(q._scene_prepared)==1


def test_all_bad_demo_and_nonfinite_gp_are_errors_and_cache_is_bounded(scene_query):
    q=scene_query;q.catalog.items=[OMM|{'NORAD_CAT_ID':1,'ECCENTRICITY':float('nan')},
                                 OMM|{'NORAD_CAT_ID':2,'demo':True}]
    r=scene(q);assert r['status']=='error' and r['error_count']==2
    assert all(row['position_m'] is None for row in r['rows'])
    for i in range(3):
        q.catalog.items=[OMM|{'NORAD_CAT_ID':100+i}];scene(q)
    assert len(q._scene_prepared)==2


def test_incomplete_group_snapshot_and_unknown_group_rejected(scene_query):
    q=scene_query;original=q.catalog.get_satellites
    async def incomplete(**kwargs):
        result=await original(**kwargs);result['filtered_total']+=1;return result
    q.catalog.get_satellites=incomplete
    with pytest.raises(ValueError,match='incomplete'):scene(q)
    with pytest.raises(ValueError,match='unknown'):asyncio.run(q.scene('other','','all',OMM['EPOCH']+'Z','test'))


def test_selected_identity_lookup_is_not_truncated_by_broad_numeric_matches(scene_query):
    q=scene_query
    async def matches(**kwargs):
        items=[OMM|{'NORAD_CAT_ID':1000+i,'OBJECT_NAME':'match 1'} for i in range(101)]+[OMM|{'NORAD_CAT_ID':1}]
        return dict(items=items if kwargs['limit']==0 else items[:kwargs['limit']],source='celestrak-cache',fetched_at='2026-10-01T00:00:00Z')
    q.catalog.get_satellites=matches
    assert asyncio.run(q.position('active',1))['catalog_number']==1


@pytest.mark.parametrize('values',[{'query':'a'*101},{'orbit':'OTHER'},{'request_id':'   '},{'utc':'local'},
                                 {'expected_scene_sha256':'bad'}])
def test_scene_domain_validation(scene_query,values):
    with pytest.raises(ValueError):scene(scene_query,**values)


def test_scene_http_is_readonly_strict_and_preserves_conflicts(scene_query):
    from fastapi.testclient import TestClient
    from user_application.web.application import create_app
    from digital_twin.contracts.orbit import OrbitBusy
    q=scene_query
    payload=dict(group='active',query='',orbit='all',utc=OMM['EPOCH']+'Z',client_request_id='http-scene')
    with TestClient(create_app(catalog_geometry_query=q)) as client:
        before=client.get('/api/orbit/state').json();sim=client.get('/api/bootstrap').json()['runtime']
        reply=client.post('/api/catalog/scene',json=payload)
        assert reply.status_code==200,reply.text
        result=reply.json();assert result['count']==103 and result['client_request_id']=='http-scene'
        after=client.get('/api/orbit/state').json()
        before.pop('observed_monotonic_s');after.pop('observed_monotonic_s');assert before==after
        assert client.get('/api/bootstrap').json()['runtime']==sim
        for extra in [dict(query='😀'*101),dict(orbit='OTHER'),dict(utc='local'),dict(client_request_id=' '),
                      dict(expected_scene_sha256='A'*64),dict(limit=100),dict(query=123),dict(orbit=True)]:
            assert client.post('/api/catalog/scene',json=payload|extra).status_code==422
        q.catalog.items[0]['MEAN_ANOMALY']+=1
        assert client.post('/api/catalog/scene',json=payload|dict(expected_scene_sha256=result['scene_sha256'])).status_code==409
        q.catalog.source='demo-fallback'
        assert client.post('/api/catalog/scene',json=payload).status_code==503
    with TestClient(create_app()) as client:assert client.post('/api/catalog/scene',json=payload).status_code==503
    class Busy:
        async def scene(self,*args):raise OrbitBusy('queue full')
    with TestClient(create_app(catalog_geometry_query=Busy())) as client:
        assert client.post('/api/catalog/scene',json=payload).status_code==503
