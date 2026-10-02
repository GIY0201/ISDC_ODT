"""Batch acceleration must retain scalar UTC, EOP and native semantics."""
import hashlib
import numpy as np
import pytest
import astropy_iers_data
from foundation import orbit_time
from data.earth_orientation import EarthOrientationSnapshot
from communication.native import orbit_adapter
from data.orbit_inputs import load_orbit_input
from digital_twin.contracts.orbit import GroundPoint
from user_application.orbit_calculation import create_orbit_calculation
from digital_twin.simulation.orbit_geometry import teme_to_itrf,elevation_deg
from digital_twin.simulation.visibility import search_visibility
from astropy.time import TimeDelta

TIMES=('2016-12-31T23:59:59.000000123Z','2016-12-31T23:59:60Z',
       '2017-01-01T00:00:00+00:00','2020-07-12T21:16:01.000416Z')

@pytest.fixture
def eop():
    return EarthOrientationSnapshot.load(astropy_iers_data.IERS_B_FILE,
        astropy_iers_data.IERS_LEAP_SECOND_FILE,
        eop_sha256='31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7',
        leap_sha256='6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7')

@pytest.fixture
def orbit(tmp_path):
    raw=b'1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992\n2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'
    path=tmp_path/'iss.tle';path.write_bytes(raw)
    return load_orbit_input(path,format='TLE',source='historical fixture',
        fetched_utc='2026-10-02T00:00:00Z',expected_sha256=hashlib.sha256(raw).hexdigest())

def test_batch_utc_exact_scalar_parity_and_order():
    times=TIMES+(TIMES[0],)
    result=orbit_time.parse_utc_batch(times)
    assert result==tuple(orbit_time.parse_utc(t) for t in times)
    assert orbit_time.format_utc_batch(result)==tuple(t.iso_utc for t in result)
    assert orbit_time.parse_utc_batch([])==()
    assert orbit_time.format_utc_batch([])==()

@pytest.mark.parametrize('bad',['2019-12-31T23:59:60Z','2020-13-12T21:16:01Z',
    '2020-07-12T21:16:01','2020-07-12T21:16:01+09:00',None])
def test_batch_rejects_any_invalid_row(bad):
    with pytest.raises(ValueError):orbit_time.parse_utc_batch([TIMES[0],bad,TIMES[-1]])

def test_batch_rejects_scalar_input():
    with pytest.raises(ValueError):orbit_time.parse_utc_batch(TIMES[0])

def test_vector_eop_matches_scalar_and_rejects_out_of_snapshot(eop):
    instants=tuple(orbit_time.parse_utc(t) for t in TIMES)
    assert eop.at_many(instants)==tuple(eop.at(t) for t in instants)
    assert eop.at_many(())==()
    with pytest.raises(ValueError,match='range'):
        eop.at_many(instants+(orbit_time.parse_utc('1900-01-01T00:00:00Z'),))

def test_preparsed_native_uses_identical_time_and_owned_rows(orbit):
    instants=tuple(orbit_time.parse_utc(t) for t in TIMES)
    scalar=orbit_adapter.propagate(orbit,TIMES)
    batch=orbit_adapter.propagate_instants(orbit,instants)
    assert batch.utc==scalar.utc and batch.errors==scalar.errors
    assert batch._buffer==scalar._buffer
    with pytest.raises(ValueError):orbit_adapter.propagate_instants(orbit,[object()])

def test_calculation_batches_eop_and_preserves_scalar_provider(orbit,eop):
    class ScalarProvider:
        eop_sha256=eop.eop_sha256;leap_sha256=eop.leap_sha256
        def at(self,t):return eop.at(t)
    class BatchProvider(ScalarProvider):
        calls=0
        def at(self,t):raise AssertionError('scalar EOP lookup used')
        def at_many(self,ts):self.calls+=1;return eop.at_many(ts)
    times=TIMES[-1:]*3
    scalar=create_orbit_calculation(ScalarProvider())(orbit,times,GroundPoint(33,126,0))
    provider=BatchProvider()
    batch=create_orbit_calculation(provider)(orbit,times,GroundPoint(33,126,0))
    assert batch==scalar and provider.calls==1

@pytest.mark.parametrize('dtype',['bool','complex128','U8','object'])
def test_geometry_array_fast_path_preserves_component_types(dtype,eop):
    values=np.array([[True,False,True]],dtype=dtype)
    if dtype=='object':values[0,0]='7000'
    with pytest.raises(ValueError):
        teme_to_itrf(values,[orbit_time.parse_utc(TIMES[-1])],
                     [eop.at(orbit_time.parse_utc(TIMES[-1]))])
    with pytest.raises(ValueError):elevation_deg(values,GroundPoint(33,126,0))

def test_actual_full_day_refinement_preserves_recorded_boundaries_and_peaks(orbit,eop):
    start=orbit_time.parse_utc(orbit.epoch_utc).as_time()
    end=(start+TimeDelta(86400,format='sec',scale='tai')).utc.isot+'Z'
    calculate=create_orbit_calculation(eop)
    result=search_visibility(calculate=lambda ts:calculate(orbit,ts,GroundPoint(33.4996,126.5312,0)),
        start_utc=orbit.epoch_utc,end_utc=end,minimum_elevation_deg=10.)
    expected=(
        ('2020-07-12T21:48:30.973072250Z','2020-07-12T21:52:53.129322250Z','2020-07-12T21:50:42.222365916Z',16.34968415627627),
        ('2020-07-13T12:50:48.559009750Z','2020-07-13T12:57:28.855884750Z','2020-07-13T12:54:08.198286546Z',68.68052119987094),
        ('2020-07-13T19:23:28.223072250Z','2020-07-13T19:28:48.613697250Z','2020-07-13T19:26:08.696267354Z',21.540080162735297),
        ('2020-07-13T20:59:56.152759750Z','2020-07-13T21:05:55.191822250Z','2020-07-13T21:02:56.056351954Z',30.477378658310762))
    assert result.status=='complete' and not result.errors and not result.contacts
    assert len(result.intervals)==len(expected)
    for interval,(a,b,peak,angle) in zip(result.intervals,expected):
        for actual,reference in ((interval.start_utc,a),(interval.end_utc,b),(interval.peak_utc,peak)):
            delta=(orbit_time.parse_utc(actual).as_time().tai-orbit_time.parse_utc(reference).as_time().tai).sec
            assert abs(delta)<.00001
        assert interval.max_elevation_deg==pytest.approx(angle,abs=1e-9)
        assert not interval.start_clipped and not interval.end_clipped
