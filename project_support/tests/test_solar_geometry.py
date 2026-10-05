"""Solar display model consistency, not independent ephemeris accuracy."""
from dataclasses import replace
import hashlib
import json
import numpy as np
import pytest
import astropy_iers_data
from pathlib import Path
from astropy import units as u
from astropy.coordinates import get_sun, ITRS
from astropy.utils import iers
from foundation.orbit_time import parse_utc, UtcInstant
from data.earth_orientation import EarthOrientationSnapshot
from digital_twin.simulation.solar_geometry import solar_directions


@pytest.fixture
def eop():
    a=Path(astropy_iers_data.IERS_A_FILE); leap=Path(astropy_iers_data.IERS_LEAP_SECOND_FILE)
    return EarthOrientationSnapshot.load(a,leap,eop_sha256=hashlib.sha256(a.read_bytes()).hexdigest(),
        leap_sha256=hashlib.sha256(leap.read_bytes()).hexdigest(),table_kind='IERS_A')


def test_scalar_batch_oracle_and_owned_immutable_vectors(eop):
    instants=tuple(map(parse_utc,['2020-03-20T03:50:00Z','2020-06-20T21:44:00Z','2020-12-21T10:02:00Z']))
    points=eop.at_many(instants);result=solar_directions(instants,points)
    assert result.frame=='ITRF' and result.utc==instants
    assert result.eop_sha256==eop.eop_sha256 and result.leap_sha256==eop.leap_sha256
    np.testing.assert_allclose(np.linalg.norm(result.direction_to_sun,axis=1),1,rtol=0,atol=3e-16)
    with iers.earth_orientation_table.set(eop._table):
        for index,(instant,point) in enumerate(zip(instants,points)):
            reference=get_sun(instant.as_time()).transform_to(ITRS(obstime=instant.as_time())).cartesian.xyz.to_value(u.au)
            reference/=np.linalg.norm(reference)
            np.testing.assert_allclose(result.direction_to_sun[index],reference,rtol=0,atol=2e-12)
            scalar=solar_directions([instant],[point])
            np.testing.assert_allclose(result.direction_to_sun[index],scalar.direction_to_sun[0],rtol=0,atol=2e-15)
    assert not result.direction_to_sun.flags.writeable
    with pytest.raises(ValueError):result.direction_to_sun.setflags(write=True)
    with pytest.raises(ValueError):result.direction_to_sun[0,0]=0
    assert solar_directions([],[]).direction_to_sun.shape==(0,3)


def test_no_implicit_eop_lookup_or_download(eop,monkeypatch):
    instant=parse_utc('2020-07-12T21:16:01Z');point=eop.at(instant)
    def forbidden(*a,**kw):raise AssertionError('implicit IERS access')
    monkeypatch.setattr(iers.IERS_Auto,'open',forbidden)
    result=solar_directions([instant],[point])
    assert np.isfinite(result.direction_to_sun).all()


@pytest.mark.parametrize('utc',['2020-03-20T03:50:00Z','2020-06-20T21:44:00Z','2020-12-21T10:02:00Z','2016-12-31T23:59:59Z'])
def test_one_si_second_interpolation_bound_including_leap(eop,utc):
    from astropy.time import TimeDelta
    first=parse_utc(utc).as_time()
    times=first+TimeDelta(np.linspace(0,1,21),format='sec')
    instants=tuple(UtcInstant(float(a),float(b)) for a,b in zip(times.jd1,times.jd2))
    result=solar_directions(instants,eop.at_many(instants)).direction_to_sun
    fractions=np.linspace(0,1,21)[:,None]
    interpolated=result[0]*(1-fractions)+result[-1]*fractions
    interpolated/=np.linalg.norm(interpolated,axis=1)[:,None]
    angle=np.arctan2(np.linalg.norm(np.cross(interpolated,result),axis=1),np.sum(interpolated*result,axis=1))
    assert max(angle)<1e-6


def test_invalid_time_eop_alignment_and_identity(eop):
    instant=parse_utc('2020-07-12T21:16:01Z');point=eop.at(instant)
    for instants,points in [([instant],[]),([UtcInstant(float('nan'),0)],[point]),
            ([instant],[replace(point,xp_rad=float('inf'))]),
            ([instant],[replace(point,ut1_minus_utc_s=True)]),
            ([instant,instant],[point,replace(point,leap_sha256='other')]),
            ([instant,instant],[point,replace(point,snapshot_sha256='other')])]:
        with pytest.raises(ValueError):solar_directions(instants,points)


def test_published_erfa_rotation_fixture():
    import erfa
    fixture=json.loads((Path(__file__).parent/'fixtures/orbit/solar_rotation_erfa.json').read_text())
    matrix=erfa.c2t06a(*fixture['tt_jd'],*fixture['ut1_jd'],fixture['xp_rad'],fixture['yp_rad'])
    np.testing.assert_allclose(matrix,fixture['matrix'],rtol=0,atol=fixture['absolute_tolerance'])


@pytest.mark.parametrize('direction',[[0,0,0],[float('nan'),1,1],[float('inf'),1,1]])
def test_bad_ephemeris_vector_never_becomes_synthetic_sun(eop,monkeypatch,direction):
    from types import SimpleNamespace
    from digital_twin.simulation import solar_geometry as module
    instant=parse_utc('2020-07-12T21:16:01Z');point=eop.at(instant)
    monkeypatch.setattr(module,'get_sun',lambda time:SimpleNamespace(cartesian=SimpleNamespace(xyz=np.array(direction)[:,None]*u.au)))
    with pytest.raises(ValueError,match='solar vector'):solar_directions([instant],[point])


def test_frozen_snapshot_edges_accept_valid_rows_and_reject_outside(eop):
    from astropy.time import Time
    edges=[float(eop._table['MJD'].value[0])+1,float(eop._table['MJD'].value[-1])-1]
    times=Time(edges,format='mjd',scale='utc')
    instants=tuple(UtcInstant(float(a),float(b)) for a,b in zip(times.jd1,times.jd2))
    result=solar_directions(instants,eop.at_many(instants))
    assert np.isfinite(result.direction_to_sun).all()
    for mjd in [edges[0]-2,edges[-1]+2]:
        time=Time(mjd,format='mjd',scale='utc')
        with pytest.raises(ValueError,match='EOP snapshot range'):eop.at_many([UtcInstant(float(time.jd1),float(time.jd2))])
