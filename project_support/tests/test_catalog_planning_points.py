import asyncio
from dataclasses import replace
import pytest
from foundation.orbit_time import parse_utc
from digital_twin.contracts.catalog_geometry import CatalogGpChanged
from digital_twin.contracts.orbit import OrbitCalculation,OrbitSample,GroundPoint
from project_support.tests.test_catalog_samples import catalog_query

TIMES=['2020-07-12T21:15:00Z','2020-07-12T21:15:30Z','2020-07-12T21:15:31.250Z']

def identity(q):return asyncio.run(q.position('active',25544))['normalized_gp_sha256']

def test_explicit_fractional_points_reuse_installed_rust_eop_calculation(catalog_query):
 q,item,executions=catalog_query;digest=identity(q);calls=[];calculate=q.calculate
 def record(orbit,utc,ground):calls.append((orbit,tuple(utc),ground));return calculate(orbit,utc,ground)
 q.calculate=record;executions.clear()
 result=asyncio.run(q.points('active',25544,digest,TIMES,'external-points'))
 assert len(calls)==len(executions)==1
 assert calls[0][1]==tuple(parse_utc(t).iso_utc for t in TIMES)
 assert result['frame']=='ITRF' and result['status']=='valid' and result['client_request_id']=='external-points'
 assert result['normalized_gp_sha256']==digest and result['eop_sha256']==q.eop.eop_sha256 and result['leap_sha256']==q.eop.leap_sha256
 direct=calculate(calls[0][0],list(calls[0][1]),GroundPoint(0,0,0))
 assert [r['position_m'] for r in result['rows']]==[list(r.position_m) for r in direct.rows]

@pytest.mark.parametrize('times',[[],TIMES*201,TIMES[::-1],[TIMES[0],TIMES[0]],'2020-07-12T21:15:00Z',['bad'],[None]])
def test_invalid_points_do_not_fetch_catalog_or_execute(catalog_query,times):
 q,item,executions=catalog_query
 async def never(**kw):pytest.fail('invalid grid reached catalog')
 q.catalog.get_satellites=never
 with pytest.raises(ValueError):asyncio.run(q.points('active',25544,'a'*64,times,'external-points'))

@pytest.mark.parametrize('change',['frame','profile','eop','utc','nonfinite','errorcode'])
def test_invalid_required_native_receipt_is_rejected(catalog_query,change):
 q,item,executions=catalog_query;digest=identity(q);calculate=q.calculate
 def bad(orbit,utc,ground):
  value=calculate(orbit,utc,ground)
  if change=='frame':return replace(value,frame='TEME')
  if change=='profile':return replace(value,profile='OTHER')
  if change=='eop':return replace(value,eop_sha256='b'*64)
  row=value.rows[0]
  if change=='utc':row=replace(row,utc=utc[-1])
  if change=='nonfinite':row=replace(row,position_m=(float('nan'),0,0))
  if change=='errorcode':row=replace(row,error_code='')
  return replace(value,rows=(row,*value.rows[1:]))
 q.calculate=bad
 with pytest.raises(ValueError):asyncio.run(q.points('active',25544,digest,TIMES,'external-points'))

def test_native_error_rows_keep_partial_coverage_instead_of_a_zero_position(catalog_query):
 q,item,executions=catalog_query;digest=identity(q);calculate=q.calculate
 def partial(orbit,utc,ground):
  value=calculate(orbit,utc,ground);row=replace(value.rows[1],error_code='sgp4_decay',position_m=None,elevation_deg=None)
  return replace(value,rows=(value.rows[0],row,value.rows[2]))
 q.calculate=partial
 value=asyncio.run(q.points('active',25544,digest,TIMES,'external-points'))
 assert value['status']=='partial' and value['valid_count']==2 and value['error_count']==1
 assert value['rows'][1]['position_m'] is None and value['rows'][1]['status']=='error'

def test_mutation_after_catalog_capture_cannot_rewrite_point_grid_or_provenance(catalog_query):
 q,item,executions=catalog_query;digest=identity(q);times=list(TIMES);expected_name=item['OBJECT_NAME']
 async def execute(work):times.clear();item['OBJECT_NAME']='changed';return work()
 q.execute=execute
 value=asyncio.run(q.points('active',25544,digest,times,'external-points'))
 assert len(value['rows'])==3 and value['name']==expected_name and value['normalized_gp_sha256']==digest

def test_stale_gp_rejects_before_native_executor(catalog_query):
 q,item,executions=catalog_query;executions.clear()
 with pytest.raises(CatalogGpChanged):asyncio.run(q.points('active',25544,'a'*64,TIMES,'external-points'))
 assert executions==[]


@pytest.mark.parametrize('changes',[{'catalog_number':True},{'expected_hash':'BAD'},{'client_request_id':True},{'client_request_id':'x'*129}])
def test_invalid_point_identity_rejects_before_catalog_fetch(catalog_query,changes):
 q,item,executions=catalog_query
 async def never(**kw):pytest.fail('invalid identity reached catalog')
 q.catalog.get_satellites=never
 args=dict(group='active',catalog_number=25544,expected_hash='a'*64,utc=TIMES,client_request_id='external-points')|changes
 with pytest.raises(ValueError):asyncio.run(q.points(**args))


def test_point_query_cancellation_does_not_publish_a_partial_reply(catalog_query):
 q,item,executions=catalog_query;digest=identity(q)
 async def cancel(work):raise asyncio.CancelledError()
 q.execute=cancel
 with pytest.raises(asyncio.CancelledError):asyncio.run(q.points('active',25544,digest,TIMES,'external-points'))
