import asyncio
from test_catalog import make_catalog, GP
import httpx


def test_paged_search_and_gp_fallback_preserve_server_contract(tmp_path):
    rows=[{**GP, 'NORAD_CAT_ID':99901+i, 'OBJECT_NAME':f'TEST {i}'} for i in range(205)]
    calls=[]
    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(503) if 'records.php' in request.url.path else httpx.Response(200,json=rows)
    catalog=make_catalog(tmp_path,handler)
    async def scenario():
        first=await catalog.get_satellites(group='active',limit=100)
        second=await catalog.get_satellites(group='active',limit=100,offset=100)
        assert (first['count'],second['count'],second['filtered_total'])==(100,100,205)
        assert second['source']=='celestrak-cache'
        filtered=await catalog.get_satellites(query='99901',orbit='LEO',limit=100)
        assert filtered['items'][0]['NORAD_CAT_ID']==99901
        profile=await catalog.get_satellite_profile(99901)
        assert profile['source']=='gp-cache' and profile['catalog']['OWNER']==''
        assert profile['gp']['OBJECT_NAME']=='TEST 0' and profile['warning']
        profile['gp']['OBJECT_NAME']='modified'
        assert (await catalog.get_satellite_profile(99901))['gp']['OBJECT_NAME']=='TEST 0'
    asyncio.run(scenario())
    assert len(calls)==3  # GP fallback is not cached as a successful SATCAT response
