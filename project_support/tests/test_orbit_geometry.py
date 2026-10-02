"""Product geometry tests: fixed public case, analytic horizons and Astropy oracle."""
from dataclasses import replace
import hashlib,json
from pathlib import Path
import numpy as np
import pytest
import erfa,astropy_iers_data
from astropy import units as u
from astropy.time import Time
from astropy.coordinates import TEME,ITRS,AltAz,EarthLocation,CartesianRepresentation,CartesianDifferential
from astropy.utils import iers
from foundation.orbit_time import parse_utc,UtcInstant
from digital_twin.contracts.orbit import EarthOrientationPoint
from data.earth_orientation import EarthOrientationSnapshot
from digital_twin.simulation.orbit_geometry import GroundPoint,station_itrf,teme_to_itrf,elevation_deg

EOP_HASH='31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7'
LEAP_HASH='6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7'
METRICS={}

def snapshot():
    return EarthOrientationSnapshot.load(astropy_iers_data.IERS_B_FILE,astropy_iers_data.IERS_LEAP_SECOND_FILE,eop_sha256=EOP_HASH,leap_sha256=LEAP_HASH)

def test_published_vallado_position():
    fixture=json.loads((Path(__file__).parent/'fixtures/orbit/vallado_teme_itrf.json').read_text(encoding='utf-8'))
    epoch=parse_utc(fixture['utc'])
    correction=EarthOrientationPoint(fixture['ut1_minus_utc_s'],np.deg2rad(fixture['xp_arcsec']/3600),np.deg2rad(fixture['yp_arcsec']/3600),'published-case','published-case')
    result=teme_to_itrf([fixture['position_teme_km']],[epoch],[correction])
    expected=np.array([fixture['position_itrf_km']])*1000
    error=float(np.linalg.norm(result.position_m-expected))
    METRICS['published_position_error_m']=error
    assert error<.3
    assert result.frame=='ITRF' and result.eop_sha256=='published-case'
    assert not result.position_m.flags.writeable
    with pytest.raises(ValueError):result.position_m.setflags(write=True)

@pytest.mark.parametrize('site',[GroundPoint(0,0,0),GroundPoint(33.4996,126.5312,0),GroundPoint(90,180,2000),GroundPoint(-90,-180,-100),GroundPoint(45,-75,10000)])
def test_station_wgs84(site):
    reference=EarthLocation.from_geodetic(site.longitude_deg*u.deg,site.latitude_deg*u.deg,site.ellipsoid_height_m*u.m).get_itrs().cartesian.xyz.to_value(u.m)
    np.testing.assert_allclose(station_itrf(site),reference,rtol=0,atol=1e-7)

@pytest.mark.parametrize('site',[GroundPoint(0,0,0),GroundPoint(33.4996,126.5312,1000),GroundPoint(90,0,0)])
def test_analytic_horizons(site):
    lat,lon=np.deg2rad([site.latitude_deg,site.longitude_deg])
    east=np.array([-np.sin(lon),np.cos(lon),0]);up=np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)])
    station=station_itrf(site)
    positions=station+np.array([up,east,-up,east+up])*100000
    np.testing.assert_allclose(elevation_deg(positions,site),[90,0,-90,45],rtol=0,atol=1e-10)
    with pytest.raises(ValueError,match='coincident'):elevation_deg([station],site)

@pytest.mark.parametrize('values',[(91,0,0),(0,181,0),(0,0,float('nan')),(float('inf'),0,0),(True,0,0)])
def test_invalid_site(values):
    with pytest.raises(ValueError):GroundPoint(*values)

def test_input_errors_and_empty():
    epoch=parse_utc('2020-07-12T21:16:01Z');point=snapshot().at(epoch)
    for values in ([[float('nan'),0,0]],[1,2,3],[[1,2]],[[True,0,0]],np.array([[1+2j,0,0]]),[["1",0,0]]):
        with pytest.raises(ValueError):teme_to_itrf(values,[epoch],[point])
    with pytest.raises(ValueError):teme_to_itrf([[1,2,3]],[],[])
    with pytest.raises(ValueError):teme_to_itrf([[1,2,3]],[epoch],[replace(point,xp_rad=float('inf'))])
    with pytest.raises(ValueError):teme_to_itrf([[1,2,3],[1,2,3]],[epoch,epoch],[point,replace(point,snapshot_sha256='different')])
    with pytest.raises(ValueError):teme_to_itrf([[1,2,3]],[epoch],[point],velocities_km_s=[[0,0,0]],lod_s=float('nan'))
    assert teme_to_itrf(np.empty((0,3)),[],[]).position_m.shape==(0,3)
    assert elevation_deg(np.empty((0,3)),GroundPoint(0,0,0)).size==0

def reference(times,r,v,site,table):
    with iers.conf.set_temp('auto_download',False),iers.earth_orientation_table.set(table):
        teme=TEME(CartesianRepresentation(r.T*u.km,differentials=CartesianDifferential(v.T*u.km/u.s)),obstime=times)
        ref=teme.transform_to(ITRS(obstime=times))
        location=EarthLocation.from_geodetic(site.longitude_deg*u.deg,site.latitude_deg*u.deg,site.ellipsoid_height_m*u.m)
        top=ref.cartesian.without_differentials()-location.get_itrs(obstime=times).cartesian
        alt=ITRS(top,obstime=times,location=location).transform_to(AltAz(obstime=times,location=location,pressure=0*u.hPa)).alt.deg
        return ref.cartesian.xyz.to_value(u.m).T,ref.cartesian.differentials['s'].d_xyz.to_value(u.m/u.s).T,alt

def test_rust_product_chain_and_full_day_oracle(tmp_path):
    from data.orbit_inputs import load_orbit_input
    from communication.native.orbit_adapter import propagate
    l1='1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992'
    l2='2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'
    raw=(l1+'\n'+l2).encode();path=tmp_path/'iss.tle';path.write_bytes(raw)
    orbit=load_orbit_input(path,format='TLE',source='historical fixture',fetched_utc='2026-10-02T00:00:00Z',expected_sha256=hashlib.sha256(raw).hexdigest())
    start=parse_utc(orbit.epoch_utc).as_time();times=start+np.arange(0,86401,240)*u.s
    utc=tuple(t+'Z' for t in times.isot);batch=propagate(orbit,utc);indices,rows=batch.valid_rows()
    assert len(indices)==361
    instants=[parse_utc(t) for t in utc];eop=snapshot();points=[eop.at(t) for t in instants]
    result=teme_to_itrf(rows[:,:3],instants,points,velocities_km_s=rows[:,3:])
    site=GroundPoint(33.4996,126.5312,0)
    reference_position,reference_velocity,reference_alt=reference(Time([t.as_time() for t in instants]),rows[:,:3],rows[:,3:],site,eop._table)
    pos=float(np.max(np.linalg.norm(result.position_m-reference_position,axis=1)))
    vel=float(np.max(np.linalg.norm(result.velocity_m_s-reference_velocity,axis=1)))
    alt=float(np.max(np.abs(elevation_deg(result.position_m,site)-reference_alt)))
    METRICS.update(sample_count=361,max_position_difference_m=pos,max_velocity_difference_m_s=vel,max_elevation_difference_deg=alt)
    assert pos<10 and vel<.01 and alt<.01
    corrected=teme_to_itrf(rows[:,:3],instants,points,velocities_km_s=rows[:,3:],lod_s=.002)
    assert np.max(np.abs(corrected.velocity_m_s-result.velocity_m_s))>0
    assert result.lod_s==0 and corrected.lod_s==.002

def test_leap_second_coordinate_reference():
    eop=snapshot();instants=[parse_utc(t) for t in ['2016-12-31T23:59:59Z','2016-12-31T23:59:60Z','2017-01-01T00:00:00Z']]
    r=np.tile([7000.,200.,500.],(3,1));v=np.tile([0.,7.,1.],(3,1))
    result=teme_to_itrf(r,instants,[eop.at(t) for t in instants],velocities_km_s=v)
    position,velocity,alt=reference(Time([t.as_time() for t in instants]),r,v,GroundPoint(0,0,0),eop._table)
    np.testing.assert_allclose(result.position_m,position,rtol=0,atol=1e-6)
    assert np.all(np.linalg.norm(np.diff(result.position_m,axis=0),axis=1)<600)


@pytest.fixture(scope="module",autouse=True)
def write_validation_metrics():
    yield
    path=Path(__file__).parents[2]/'data/workspace/validation/geometry_implementation/metrics.json'
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(METRICS,indent=2),encoding='utf-8')


def test_ten_degree_boundary_and_input_ownership():
    site=GroundPoint(0,0,0)
    point=station_itrf(site)+np.array([100000*np.tan(np.deg2rad(10)),100000,0])
    positions=np.array([point])
    angle=elevation_deg(positions,site)
    np.testing.assert_allclose(angle,[10],rtol=0,atol=1e-10)
    positions[:]=0
    np.testing.assert_allclose(angle,[10],rtol=0,atol=1e-10)
    with pytest.raises(ValueError):angle.setflags(write=True)
    epoch=parse_utc('2020-07-12T21:16:01Z');correction=snapshot().at(epoch)
    vectors=np.array([[7000.,200.,500.]])
    result=teme_to_itrf(vectors,[epoch],[correction],velocities_km_s=[[0,7,1]])
    before=result.position_m.copy();vectors[:]=0
    np.testing.assert_array_equal(result.position_m,before)
    with pytest.raises(ValueError):result.velocity_m_s.setflags(write=True)
