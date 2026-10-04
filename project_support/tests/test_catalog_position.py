import asyncio,hashlib,json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from user_application.web.application import create_app
from data.orbit_inputs import load_orbit_input_bytes
from data.earth_orientation import EarthOrientationSnapshot
from user_application.catalog_geometry import CatalogGeometryQuery
from test_catalog import GP

# Public historical ISS test fixture; independent of ignored deployment inputs.
OMM={'NORAD_CAT_ID': 25544, 'OBJECT_NAME': 'ISS historical validation example', 'EPOCH': '2020-07-12T21:16:01.000416', 'MEAN_MOTION': 15.49507896, 'ECCENTRICITY': 0.0001413, 'INCLINATION': 51.6461, 'RA_OF_ASC_NODE': 221.2784, 'ARG_OF_PERICENTER': 89.1723, 'MEAN_ANOMALY': 280.4612, 'BSTAR': -3.1515e-05, 'MEAN_MOTION_DOT': -2.218e-05, 'MEAN_MOTION_DDOT': 0}
from digital_twin.contracts.orbit import GroundPoint

def test_bytes_parser_preserves_path_contract_and_rejects_missing(tmp_path):
 from data.orbit_inputs import load_orbit_input
 p=tmp_path/'sample.json';p.write_text(json.dumps(OMM));raw=p.read_bytes();kw=dict(format='OMM',source='test',fetched_utc='2026-10-01T00:00:00Z',expected_sha256=hashlib.sha256(raw).hexdigest())
 assert load_orbit_input(p,**kw)==load_orbit_input_bytes(raw,**kw)
 with pytest.raises(ValueError):load_orbit_input_bytes(b'{}',**{**kw,'expected_sha256':hashlib.sha256(b'{}').hexdigest()})

def test_actual_a_quality_native_query_and_readonly_http():
 import astropy_iers_data as files
 from foundation.orbit_time import parse_utc
 from user_application.orbit_calculation import create_orbit_calculation
 a=Path(files.IERS_A_FILE);leap=Path(files.IERS_LEAP_SECOND_FILE)
 eop=EarthOrientationSnapshot.load(a,leap,eop_sha256=hashlib.sha256(a.read_bytes()).hexdigest(),leap_sha256=hashlib.sha256(leap.read_bytes()).hexdigest(),table_kind='IERS_A')
 quality=eop.quality(parse_utc('2026-10-04T01:53:16Z'));assert quality=={'ut1':'predicted_a','polar_motion':'predicted_a'}
 with pytest.raises(ValueError):eop.quality(parse_utc('2100-01-01T00:00:00Z'))
 raw=OMM.copy()
 class Catalog:
  def catalog_groups(self):return [{'id':'active'}]
  async def get_satellites(self,**kwargs):return {'source':'celestrak-cache','fetched_at':'2026-10-01T00:00:00Z','items':[raw]}
 async def execute(work):return work()
 q=CatalogGeometryQuery(Catalog(),eop,create_orbit_calculation(eop),execute)
 result=asyncio.run(q.position('active',25544));assert result['frame']=='ITRF' and result['eop_quality']['ut1']=='final_b';assert result['utc']==result['epoch_utc'];assert len(result['position_m'])==3
 with TestClient(create_app(catalog_geometry_query=q)) as client:
  before=client.get('/api/orbit/state').json();sim=client.get('/api/bootstrap').json()['runtime']
  reply=client.post('/api/catalog/position',json={'group':'active','catalog_number':25544});assert reply.status_code==200 and reply.json()==result
  after=client.get('/api/orbit/state').json();before.pop('observed_monotonic_s');after.pop('observed_monotonic_s');assert after==before
  assert client.get('/api/bootstrap').json()['runtime']['run_id']==sim['run_id']
  assert client.post('/api/catalog/position',json={'group':'active','catalog_number':True}).status_code==422
  assert client.post('/api/catalog/position',json={'group':'active','catalog_number':25544,'utc':'x'}).status_code==422
  assert client.post('/api/catalog/position',json={'group':'../x','catalog_number':25544}).status_code==422
 with TestClient(create_app()) as client:assert client.post('/api/catalog/position',json={'group':'active','catalog_number':25544}).status_code==503


def test_snapshot_integrity_and_reject_overwrite(tmp_path):
 from project_support.tooling.prepare_catalog_geometry import prepare
 from data.catalog.geometry_snapshot import load_geometry_snapshot
 path=prepare(tmp_path/'eop');assert load_geometry_snapshot(path)
 with pytest.raises(FileExistsError):prepare(path.parent)
 manifest=json.loads(path.read_text());manifest['eop_file']='../escape';path.write_text(json.dumps(manifest))
 with pytest.raises(ValueError,match='outside manifest'):load_geometry_snapshot(path)
 manifest['eop_file']='finals2000A.all';manifest['eop_sha256']='0'*64;path.write_text(json.dumps(manifest))
 with pytest.raises(ValueError):load_geometry_snapshot(path)


def test_catalog_demo_and_native_busy_fail_without_marker():
 from digital_twin.contracts.orbit import OrbitBusy
 class Catalog:
  def catalog_groups(self):return [{'id':'active'}]
  async def get_satellites(self,**kwargs):return {'source':'demo-fallback','items':[GP]}
 async def execute(work):raise AssertionError('must not compute synthetic demo')
 q=CatalogGeometryQuery(Catalog(),None,None,execute)
 with pytest.raises(ValueError,match='demo'):asyncio.run(q.position('active',25544))
 class Busy:
  async def position(self,*args):raise OrbitBusy('orbit calculation queue full')
 with TestClient(create_app(catalog_geometry_query=Busy())) as client:
  r=client.post('/api/catalog/position',json={'group':'active','catalog_number':25544});assert r.status_code==503


@pytest.mark.parametrize('manifest',[[],{'version':True,'table_kind':'IERS_A'},{'version':1,'table_kind':'IERS_A','eop_sha256':None,'leap_sha256':'0'*64}])
def test_malformed_snapshot_does_not_disable_existing_app(tmp_path,manifest):
 path=tmp_path/'manifest.json';path.write_text(json.dumps(manifest))
 with TestClient(create_app(catalog_geometry_manifest_path=path)) as client:
  assert client.app.state.catalog_geometry_error=='snapshot_invalid'
  assert client.get('/api/orbit/state').status_code==200
  assert client.post('/api/catalog/position',json={'group':'active','catalog_number':25544}).status_code==503
