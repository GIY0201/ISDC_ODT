import asyncio,hashlib,json,math,tomllib
from pathlib import Path
import numpy as np
import pytest
import erfa
from dataclasses import asdict
from digital_twin.contracts.orbit import GroundPoint
from user_application.orbit_calculation import create_orbit_calculation
from test_orbit_batch import orbit,eop
from test_catalog_samples import catalog_query

def test_wgs84_native_detail_known_equator_pole_and_round_trip():
 from digital_twin.simulation.catalog_details import catalog_detail_values
 b=6356752.314245179
 points=[[6778137.,0.,0.],[0.,0.,b+400000.]]
 result=catalog_detail_values(points,[[3.,4.,0.],[0.,0.,7.]])
 assert result[0][0].latitude_deg==pytest.approx(0,abs=1e-12)
 assert result[0][0].longitude_deg==pytest.approx(0,abs=1e-12)
 assert result[0][0].ellipsoid_height_m==pytest.approx(400000,abs=1e-8)
 assert result[1][0].latitude_deg==pytest.approx(90,abs=1e-12)
 assert result[1][0].ellipsoid_height_m==pytest.approx(400000,abs=1e-8)
 assert [x[1] for x in result]==[5.,7.]
 for position,(geo,_) in zip(points,result):np.testing.assert_allclose(erfa.gd2gc(1,math.radians(geo.longitude_deg),math.radians(geo.latitude_deg),geo.ellipsoid_height_m),position,rtol=0,atol=1e-8)

@pytest.mark.parametrize('positions,velocities', [([[0,0,0]],[[1,2,3]]),([[float('nan'),0,0]],[[1,2,3]]),([[6778137,0,0]],[[True,0,0]]),([[6778137,0,0]],[[float('inf'),0,0]]),([[6778137,0,0]],[]),([[1,2]],[[1,2,3]])])
def test_detail_invalid_shape_nonfinite_center_bool_rejected(positions,velocities):
 from digital_twin.simulation.catalog_details import catalog_detail_values
 with pytest.raises(ValueError):catalog_detail_values(positions,velocities)

def test_native_details_single_propagation_and_original_calculation_unchanged(orbit,eop,monkeypatch):
 import communication.native.orbit_adapter as adapter
 calculate=create_orbit_calculation(eop);utc=[orbit.epoch_utc];ground=GroundPoint(36,127,0)
 before=calculate(orbit,utc,ground);original=adapter.propagate_instants;calls=[]
 def counted(*args):calls.append(args);return original(*args)
 monkeypatch.setattr(adapter,'propagate_instants',counted)
 result=calculate.catalog_details(orbit,utc,ground)
 assert len(calls)==1
 row=result.rows[0];assert row.position_m==before.rows[0].position_m and row.elevation_deg==before.rows[0].elevation_deg
 assert asdict(before.rows[0]).keys()=={'utc','position_m','elevation_deg','error_code'}
 assert result.details_version==1 and result.details_profile=='WGS84_ERFA_GC2GD_TEME_SPEED'
 batch=original(orbit,adapter.parse_utc_batch(utc));_,vectors=batch.valid_rows()
 assert row.teme_speed_km_s==pytest.approx(math.sqrt(sum(float(v)**2 for v in vectors[0,3:])),abs=1e-12)
 np.testing.assert_allclose(erfa.gd2gc(1,math.radians(row.geodetic.longitude_deg),math.radians(row.geodetic.latitude_deg),row.geodetic.ellipsoid_height_m),row.position_m,rtol=0,atol=1e-7)

def test_official_vallado_velocity_magnitude_golden_is_native_input():
 import isdc_orbit_propagation as native
 from digital_twin.simulation.catalog_details import catalog_detail_values
 case=tomllib.loads((Path(__file__).parent/'fixtures/orbit/sgp4_test_cases.toml').read_text(encoding='utf-8'))['list'][0]
 buf,errors=native.propagate_tle(case['line1'],case['line2'],[0.]);assert errors==[None]
 row=np.frombuffer(buf,dtype='<f8').reshape(-1,6)[0]
 actual=catalog_detail_values([[6778137.,0,0]],[row[3:]])[0][1]
 expected=math.sqrt(sum(x*x for x in case['states'][0]['velocity']))
 assert actual==pytest.approx(expected,abs=2e-9)

def test_catalog_http_details_additive_position_samples_and_runtime_readonly(catalog_query):
 from fastapi.testclient import TestClient
 from user_application.web.application import create_app
 from test_catalog_samples import payload
 q,_,_=catalog_query
 with TestClient(create_app(catalog_geometry_query=q)) as client:
  before=client.get('/api/orbit/state').json();run=client.get('/api/bootstrap').json()['runtime']['run_id']
  position=client.post('/api/catalog/position',json={'group':'active','catalog_number':25544}).json()
  assert position['details_version']==1
  assert position['details_units']=={'latitude':'deg','longitude':'deg','ellipsoid_height':'m','teme_speed':'km/s'}
  response=client.post('/api/catalog/samples',json=payload(position));assert response.status_code==200,response.text
  samples=response.json();assert samples['rows'][0]['geodetic']==position['geodetic'];assert samples['rows'][0]['teme_speed_km_s']==position['teme_speed_km_s']
  assert samples['details_profile']==position['details_profile']=='WGS84_ERFA_GC2GD_TEME_SPEED'
  for row in samples['rows']:
   geo=row['geodetic'];assert geo['ellipsoid']=='WGS84' and -90<=geo['latitude_deg']<=90 and -180<=geo['longitude_deg']<=180 and geo['ellipsoid_height_m']>=0
   assert math.isfinite(row['teme_speed_km_s']) and row['teme_speed_km_s']>0
  after=client.get('/api/orbit/state').json();before.pop('observed_monotonic_s');after.pop('observed_monotonic_s');assert after==before
  assert client.get('/api/bootstrap').json()['runtime']['run_id']==run

def test_detailed_native_failure_rows_are_null_and_do_not_skip_other_samples(orbit,eop,monkeypatch):
 import communication.native.orbit_adapter as adapter
 original=adapter.propagate_instants
 def partial(*args):
  batch=original(*args)
  values=np.frombuffer(batch._buffer,dtype='<f8').reshape(-1,6).copy();values[1]=np.nan
  return adapter.NativeOrbitBatch(batch.input_id,batch.utc,(None,'native_failure'),values.tobytes())
 monkeypatch.setattr(adapter,'propagate_instants',partial)
 result=create_orbit_calculation(eop).catalog_details(orbit,[orbit.epoch_utc,orbit.epoch_utc],GroundPoint(36,127,0))
 assert result.rows[0].geodetic is not None
 row=result.rows[1];assert row.error_code=='native_failure' and row.geodetic is None and row.teme_speed_km_s is None and row.position_m is None

def test_detail_geodetic_of_trusted_vallado_itrf_fixture_roundtrips_published_position():
 from digital_twin.simulation.catalog_details import catalog_detail_values
 from digital_twin.simulation.orbit_geometry import teme_to_itrf
 from digital_twin.contracts.orbit import EarthOrientationPoint
 from foundation.orbit_time import parse_utc
 fixture=json.loads((Path(__file__).parent/'fixtures/orbit/vallado_teme_itrf.json').read_text(encoding='utf-8'))
 point=EarthOrientationPoint(fixture['ut1_minus_utc_s'],np.deg2rad(fixture['xp_arcsec']/3600),np.deg2rad(fixture['yp_arcsec']/3600),'published-case','published-case')
 positions=teme_to_itrf([fixture['position_teme_km']],[parse_utc(fixture['utc'])],[point]).position_m
 geo,_=catalog_detail_values(positions,[[3.,4.,0.]])[0]
 restored=erfa.gd2gc(1,math.radians(geo.longitude_deg),math.radians(geo.latitude_deg),geo.ellipsoid_height_m)
 assert np.linalg.norm(restored-np.array(fixture['position_itrf_km'])*1000)<fixture['position_tolerance_m']

def test_strict_detail_contract_errors_nulls_versions_and_mutation():
 from digital_twin.contracts.catalog_details import CatalogGeodeticPoint,CatalogDetailSample,CatalogDetailCalculation,details_metadata,detail_row_payload
 from dataclasses import replace
 for kwargs in [{'latitude_deg':91},{'longitude_deg':181},{'ellipsoid_height_m':-1},{'latitude_deg':True},{'ellipsoid':'WGS72'}]:
  with pytest.raises(ValueError):CatalogGeodeticPoint(**({'latitude_deg':0.,'longitude_deg':0.,'ellipsoid_height_m':400000.}|kwargs))
 geo=CatalogGeodeticPoint(0.,0.,400000.)
 good=CatalogDetailSample('2026-10-07T00:00:00Z',(6778137.,0.,0.),10.,None,geo,7.)
 for kwargs in [{'teme_speed_km_s':True},{'teme_speed_km_s':float('nan')},{'error_code':'failed'},{'geodetic':None}]:
  with pytest.raises(ValueError):replace(good,**kwargs)
 calc=CatalogDetailCalculation((good,),'eop','leap')
 for kwargs in [{'details_version':True},{'details_profile':'unknown'}]:
  with pytest.raises(ValueError):details_metadata(replace(calc,**kwargs))
 object.__setattr__(geo,'latitude_deg',100.)
 with pytest.raises(ValueError):detail_row_payload(good)
