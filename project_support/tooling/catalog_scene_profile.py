import asyncio,copy,json,time,urllib.request
from pathlib import Path
from unittest.mock import patch
import sys
PROJECT_ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(PROJECT_ROOT))
from user_application.catalog_geometry import CatalogGeometryQuery
import user_application.catalog_geometry as module
from user_application.configs.catalog_geometry import CATALOG_GEOMETRY_MANIFEST
from data.catalog.geometry_snapshot import load_geometry_snapshot
from user_application.orbit_calculation import create_orbit_calculation

root=PROJECT_ROOT/'data'/'workspace'/'validation'/'ground_stations'
def main():
    with urllib.request.urlopen('http://127.0.0.1:8891/api/satellites?group=active&limit=0',timeout=60) as response:
        catalog=json.loads(response.read())
    assert len(catalog['items'])==catalog['filtered_total']
    class Reader:
        def catalog_groups(self):return [{'id':'active'}]
        async def get_satellites(self,**kwargs):return copy.deepcopy(catalog)
    async def execute(work):return work()
    eop=load_geometry_snapshot(CATALOG_GEOMETRY_MANIFEST)
    query=CatalogGeometryQuery(Reader(),eop,create_orbit_calculation(eop),execute)
    utc='2026-10-05T03:55:56.547000000Z'
    results=[]
    for mode in ('cold','warm'):
        counters={key:0.0 for key in ('load_orbit_input_bytes','prepare_catalog_orbits','propagate_catalog','teme_positions_at_utc')}
        originals={key:getattr(module,key) for key in counters}
        def wrap(key):
            def call(*args,**kwargs):
                start=time.perf_counter()
                try:return originals[key](*args,**kwargs)
                finally:counters[key]+=time.perf_counter()-start
            return call
        with patch.multiple(module,**{key:wrap(key) for key in counters}):
            start=time.perf_counter();result=asyncio.run(query.scene('active','','all',utc,'profile-'+mode));total=time.perf_counter()-start
        start=time.perf_counter();encoded=json.dumps(result,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode();serialize=time.perf_counter()-start
        assert result['count']==len(catalog['items']) and result['error_count']==0
        results.append(dict(mode=mode,count=result['count'],valid_count=result['valid_count'],scene_sha256=result['scene_sha256'],eop_sha256=result['eop_sha256'],total_query_seconds=total,stages_seconds=counters,other_query_seconds=total-sum(counters.values()),json_encode_seconds=serialize,json_bytes=len(encoded)))
    (root/'t110_profile.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(results))


if __name__=='__main__':main()
