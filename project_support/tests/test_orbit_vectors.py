"""T032 typed vector boundary parity, ownership and failure checks."""
import numpy as np
import pytest
import erfa
from astropy.time import Time,TimeDelta
from dataclasses import replace
from foundation import orbit_time
from digital_twin.contracts import orbit as contracts
from user_application.orbit_calculation import create_orbit_calculation
from digital_twin.simulation.visibility import search_visibility
from test_orbit_batch import orbit,eop,TIMES
from pathlib import Path
import hashlib,tomllib
from data.orbit_inputs import load_orbit_input

def test_canonical_vector_exact_scalar_parse_nanoseconds_and_leap():
    times=Time([t.removesuffix('Z').removesuffix('+00:00') for t in TIMES],format='isot',scale='utc',precision=9)
    times=times+TimeDelta([.123456789,.000000001,-.000000001,.999999999],format='sec',scale='tai')
    result=orbit_time.canonical_utc_times(times)
    scalar=orbit_time.parse_utc_batch(orbit_time.format_utc_times(times))
    np.testing.assert_array_equal(result.jd1,[t.jd1 for t in scalar])
    np.testing.assert_array_equal(result.jd2,[t.jd2 for t in scalar])

def test_vector_calculation_matches_scalar_and_owns_arrays(orbit,eop):
    ts=Time(['2020-07-12T21:16:01.000416','2020-07-13T21:16:01.000416'],format='isot',scale='utc')
    calculate=create_orbit_calculation(eop);ground=contracts.GroundPoint(33.4996,126.5312,0)
    vector=calculate.evaluate_times(orbit,ts,ground)
    scalar=calculate(orbit,orbit_time.format_utc_times(ts),ground)
    np.testing.assert_array_equal(vector.position_m,[r.position_m for r in scalar.rows])
    np.testing.assert_array_equal(vector.elevation_deg,[r.elevation_deg for r in scalar.rows])
    assert vector.errors==tuple(r.error_code for r in scalar.rows)
    for field in ('jd1','jd2','position_m','elevation_deg'):
        with pytest.raises(ValueError):getattr(vector,field).setflags(write=True)
    original=vector.jd1.copy();ts[0]=ts[1]
    np.testing.assert_array_equal(vector.jd1,original)

def test_visibility_vector_partial_failure_and_misalignment():
    start='2016-12-31T23:59:59.000000000Z';end='2017-01-01T00:00:03.000000000Z'
    origin=orbit_time.parse_utc(start).as_time()
    def evaluate(times):
        t=(times.tai-origin.tai).sec
        errors=tuple('native_failure' if abs(v-2)<.1 else None for v in t)
        positions=np.tile([7000000.,0.,0.],(len(times),1));angles=np.full(len(times),11.)
        mask=np.array([v is not None for v in errors]);positions[mask]=np.nan;angles[mask]=np.nan
        return contracts.OrbitVectorCalculation(times.jd1,times.jd2,positions,angles,errors,'eop','leap')
    result=search_visibility(calculate=lambda _:pytest.fail('scalar callback called'),calculate_times=evaluate,
        start_utc=start,end_utc=end,minimum_elevation_deg=10.)
    assert result.status=='partial' and result.errors and result.errors[0].utc.startswith('2017-01-01T00:00:00.')
    def bad(times):return replace(evaluate(times),jd2=evaluate(times).jd2+1)
    with pytest.raises(ValueError,match='UTC mismatch'):
        search_visibility(calculate=lambda _:None,calculate_times=bad,start_utc=start,end_utc=end,minimum_elevation_deg=10.)

def test_vector_contract_masks_only_failed_rows_and_copies_input():
    positions=np.array([[1.,2.,3.],[np.nan,np.nan,np.nan]])
    vector=contracts.OrbitVectorCalculation([2450000.,2450000.],[0.,.1],positions,[10.,np.nan],(None,'error'),'eop','leap')
    positions[0]=0;assert vector.position_m[0,0]==1
    with pytest.raises(ValueError):replace(vector,errors=(None,None))
    with pytest.raises(ValueError):replace(vector,errors=('error','error'))
    with pytest.raises(ValueError):replace(vector,elevation_deg=[91.,np.nan])

def test_dense_nanosecond_canonicalization_exact_near_leap():
    times=orbit_time.parse_utc('2016-12-31T23:59:59.123456789Z').as_time()+TimeDelta(np.linspace(-1,3,10001),format='sec',scale='tai')
    result=orbit_time.canonical_utc_times(times)
    scalar=orbit_time.parse_utc_batch(orbit_time.format_utc_times(times))
    np.testing.assert_array_equal(result.jd1,[t.jd1 for t in scalar])
    np.testing.assert_array_equal(result.jd2,[t.jd2 for t in scalar])

def test_vector_eop_scalar_provider_fallback_empty_and_range(orbit,eop):
    class Scalar:
        eop_sha256=eop.eop_sha256;leap_sha256=eop.leap_sha256
        def at(self,t):return eop.at(t)
    ground=contracts.GroundPoint(33,126,0)
    times=Time(['2020-07-12T21:16:01.000416'],format='isot',scale='utc')
    a=create_orbit_calculation(eop).evaluate_times(orbit,times,ground)
    b=create_orbit_calculation(Scalar()).evaluate_times(orbit,times,ground)
    np.testing.assert_array_equal(a.position_m,b.position_m)
    empty=create_orbit_calculation(eop).evaluate_times(orbit,Time([],format='jd',scale='utc'),ground)
    assert empty.position_m.shape==(0,3) and not empty.errors
    with pytest.warns(erfa.ErfaWarning,match='dubious year'),pytest.raises(ValueError,match='range'):
        create_orbit_calculation(eop).evaluate_times(orbit,Time(['1900-01-01T00:00:00'],format='isot',scale='utc'),ground)

def test_native_vector_error_rows_identical_to_scalar(tmp_path,eop):
    path=Path(__file__).parent/'fixtures/orbit/sgp4_test_cases.toml'
    cases=tomllib.loads(path.read_text(encoding='utf-8'))['list']
    case=next(c for c in cases if any('error' in s for s in c['states']) and any('position' in s for s in c['states']))
    raw=(case['line1'][:69]+'\n'+case['line2'][:69]).encode();source=tmp_path/'case.tle';source.write_bytes(raw)
    orbit=load_orbit_input(source,format='TLE',source='official SGP4 cases',fetched_utc='2026-10-03T00:00:00Z',expected_sha256=hashlib.sha256(raw).hexdigest())
    states=[next(s for s in case['states'] if 'error' in s),next(s for s in case['states'] if 'position' in s)]
    times=orbit_time.parse_utc(orbit.epoch_utc).as_time()+TimeDelta([s['time']*60 for s in states],format='sec',scale='tai')
    calculate=create_orbit_calculation(eop);ground=contracts.GroundPoint(33,126,0)
    vector=calculate.evaluate_times(orbit,times,ground)
    scalar=calculate(orbit,orbit_time.format_utc_times(times),ground)
    assert vector.errors==tuple(r.error_code for r in scalar.rows)
    assert vector.errors[0] and np.isnan(vector.position_m[0]).all() and np.isnan(vector.elevation_deg[0])
    np.testing.assert_array_equal(vector.position_m[1],scalar.rows[1].position_m)

def test_actual_day_scalar_vector_search_exact_parity(orbit,eop):
    calculate=create_orbit_calculation(eop);ground=contracts.GroundPoint(33.4996,126.5312,0)
    start=orbit_time.parse_utc(orbit.epoch_utc).as_time()
    end=orbit_time.format_utc_times(start+TimeDelta([86400],format='sec',scale='tai'))[0]
    args=dict(calculate=lambda ts:calculate(orbit,ts,ground),start_utc=orbit.epoch_utc,end_utc=end,minimum_elevation_deg=10.)
    scalar=search_visibility(**args)
    vector=search_visibility(**args,calculate_times=lambda ts:calculate.evaluate_times(orbit,ts,ground))
    assert vector==scalar

def test_vector_eop_snapshot_identity_mismatch_is_not_relabelled(orbit,eop):
    class WrongSnapshot:
        eop_sha256=eop.eop_sha256;leap_sha256=eop.leap_sha256
        def at_times(self,times):return replace(eop.at_times(times),snapshot_sha256='other snapshot')
    with pytest.raises(ValueError,match='provenance'):
        create_orbit_calculation(WrongSnapshot()).evaluate_times(orbit,
            Time(['2020-07-12T21:16:01.000416'],format='isot',scale='utc'),contracts.GroundPoint(33,126,0))

def test_scalar_eop_fallback_cannot_mix_snapshot_identity(orbit,eop):
    class MixedSnapshot:
        eop_sha256=eop.eop_sha256;leap_sha256=eop.leap_sha256
        def at(self,t):return replace(eop.at(t),snapshot_sha256='other snapshot')
    with pytest.raises(ValueError,match='provenance'):
        create_orbit_calculation(MixedSnapshot()).evaluate_times(orbit,
            Time(['2020-07-12T21:16:01.000416'],format='isot',scale='utc'),contracts.GroundPoint(33,126,0))

def test_eop_vector_row_count_is_checked_before_native_indexing(orbit,eop):
    class WrongRows:
        eop_sha256=eop.eop_sha256;leap_sha256=eop.leap_sha256
        def at_times(self,times):return eop.at_times(times[:0])
    with pytest.raises(ValueError,match='row count'):
        create_orbit_calculation(WrongRows()).evaluate_times(orbit,
            Time(['2020-07-12T21:16:01.000416'],format='isot',scale='utc'),contracts.GroundPoint(33,126,0))

def test_vector_callback_mutation_cannot_change_request_utc_reference():
    def mutate(times):
        times[:]=times+TimeDelta(1,format='sec',scale='tai')
        return contracts.OrbitVectorCalculation(times.jd1,times.jd2,
            np.tile([7000000.,0.,0.],(len(times),1)),np.full(len(times),11.),
            (None,)*len(times),'eop','leap')
    with pytest.raises(ValueError,match='UTC mismatch'):
        search_visibility(calculate=lambda _:None,calculate_times=mutate,
            start_utc='2020-07-12T21:16:01.000416000Z',
            end_utc='2020-07-12T21:16:04.000416000Z',minimum_elevation_deg=10.)
