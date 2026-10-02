"""T019 acceptance tests, written before T020 implementation.

The injected evaluator returns immutable product OrbitCalculation rows. Search
uses SI seconds and UTC, and must not own runtime state or read files itself.
Extremum recovery assumes smooth isolated extrema resolvable in sampled
brackets; these tests do not promise detection of arbitrary oscillatory curves.
"""
import importlib
import json
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import numpy as np
import pytest
from astropy.time import Time, TimeDelta
from foundation.orbit_time import parse_utc, advance_seconds
from digital_twin.contracts.orbit import OrbitCalculation, OrbitSample

UTC = '2020-07-12T21:16:01.000416000Z'
EOP_HASH = '31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7'
LEAP_HASH = '6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7'


def seconds(utc, start=UTC):
    return float((parse_utc(utc).as_time().tai - parse_utc(start).as_time().tai).sec)


def utc_at(value, start=UTC):
    return advance_seconds(parse_utc(start), value).iso_utc


def evaluator(fn, failed=None):
    def calculate(times):
        rows = []
        for utc in times:
            t = seconds(utc)
            if failed is not None and failed(t):
                rows.append(OrbitSample(utc, None, None, 'synthetic_failure'))
            else:
                rows.append(OrbitSample(utc, (7000000., 0., 0.), float(fn(t)), None))
        return OrbitCalculation(tuple(rows), EOP_HASH, LEAP_HASH)
    return calculate


@pytest.fixture
def search():
    # Deliberate RED until T020. No skip/xfail or placeholder implementation.
    return importlib.import_module('digital_twin.simulation.visibility').search_visibility


def query(search, fn, *, start=0., end=30., threshold=10., failed=None):
    return search(calculate=evaluator(fn, failed), start_utc=utc_at(start),
                  end_utc=utc_at(end), minimum_elevation_deg=threshold)


def bounds(result):
    return [(seconds(i.start_utc), seconds(i.end_utc)) for i in result.intervals]


def test_short_pass_between_one_second_samples(search):
    fn = lambda t: 10.01 - (t - 15.123)**2
    assert all(fn(t) < 10 for t in range(14, 18))
    result = query(search, fn, start=14, end=17)
    assert result.status == 'complete' and not result.contacts
    np.testing.assert_allclose(bounds(result), [[15.023, 15.223]], atol=.01, rtol=0)
    interval = result.intervals[0]
    assert seconds(interval.peak_utc) == pytest.approx(15.123, abs=.01)
    assert interval.max_elevation_deg == pytest.approx(10.01, abs=.0001)


def test_short_gap_is_not_merged(search):
    result = query(search, lambda t: 9.99 + (t - 15.123)**2, start=14, end=17)
    np.testing.assert_allclose(bounds(result), [[14, 15.023], [15.223, 17]], atol=.01, rtol=0)
    assert result.intervals[0].start_clipped and result.intervals[1].end_clipped


@pytest.mark.parametrize('peak', [.123, 2.877])
def test_short_pass_near_query_edge(search, peak):
    result = query(search, lambda t: 10.01-(t-peak)**2, end=3)
    np.testing.assert_allclose(bounds(result), [[peak-.1,peak+.1]], atol=.01, rtol=0)


def test_short_pass_in_single_equal_endpoint_cell(search):
    def curve(t):
        # Make the mathematically equal endpoints exactly equal in floating
        # arithmetic rather than accidentally relying on UTC roundoff.
        return 9.76 if min(abs(t),abs(t-1)) < 1e-8 else 10.01-(t-.5)**2
    result = query(search, curve, end=1)
    np.testing.assert_allclose(bounds(result), [[.4,.6]], atol=.01, rtol=0)


@pytest.mark.parametrize('peak', [15., 15.123])
def test_tangent_is_zero_duration_contact(search, peak):
    result = query(search, lambda t: 10 - (t - peak)**2, start=14, end=17)
    assert not result.intervals and len(result.contacts) == 1
    assert result.status == 'complete'
    assert seconds(result.contacts[0].utc) == pytest.approx(peak, abs=.01)
    assert result.contacts[0].duration_seconds == 0


@pytest.mark.parametrize('fn,expected,clipped', [
    (lambda t: 11, [[0, 30]], [(True, True)]),
    (lambda t: 10, [[0, 30]], [(True, True)]),
    (lambda t: 10 + (t - 12.123) / 10, [[12.123, 30]], [(False, True)]),
    (lambda t: 10 - (t - 12.123) / 10, [[0, 12.123]], [(True, False)]),
])
def test_clipping_and_equality_plateau(search, fn, expected, clipped):
    result = query(search, fn)
    np.testing.assert_allclose(bounds(result), expected, atol=.01, rtol=0)
    assert [(i.start_clipped, i.end_clipped) for i in result.intervals] == clipped


def test_none_is_successful_empty_result(search):
    result = query(search, lambda t: 9)
    assert result.status == 'none' and not result.intervals and not result.contacts


def test_all_passes_returned_without_three_pass_limit(search):
    result = query(search, lambda t: 10 + np.sin(2*np.pi*(t-.25)/4), end=24)
    assert len(result.intervals) == 6
    np.testing.assert_allclose(bounds(result), [[.25+4*n, 2.25+4*n] for n in range(6)], atol=.01, rtol=0)


@pytest.mark.parametrize('threshold', [0., 10., 90.])
def test_supported_threshold_endpoints(search, threshold):
    result = query(search, lambda t: threshold, threshold=threshold)
    assert result.minimum_elevation_deg == threshold
    np.testing.assert_allclose(bounds(result), [[0., 30.]], atol=1e-8, rtol=0)


@pytest.mark.parametrize('threshold', [-.001, 90.001, float('nan'), float('inf'), True])
def test_invalid_threshold_rejected_before_calculation(search, threshold):
    def forbidden(times):
        pytest.fail('invalid query called evaluator')
    with pytest.raises(ValueError):
        search(calculate=forbidden, start_utc=UTC, end_utc=utc_at(30), minimum_elevation_deg=threshold)


@pytest.mark.parametrize('end', [0., -1., 86400.001])
def test_invalid_query_range(search, end):
    with pytest.raises(ValueError):
        query(search, lambda t: 11, end=end)


def test_partial_failure_does_not_bridge_unknown_gap(search):
    result = query(search, lambda t: 11, failed=lambda t: 10 <= t <= 12)
    assert result.status == 'partial' and result.errors
    assert all(not (a < 10 and b > 12) for a, b in bounds(result))


def test_total_failure_is_not_none(search):
    result = query(search, lambda t: 11, failed=lambda t: True)
    assert result.status == 'error' and result.errors
    assert not result.intervals and not result.contacts


def test_provenance_and_immutable_result(search):
    result = query(search, lambda t: 11)
    assert result.query_start_utc == UTC and result.query_end_utc == utc_at(30)
    assert result.eop_sha256 == EOP_HASH and result.leap_sha256 == LEAP_HASH
    assert result.frame == 'ITRF' and result.profile == 'WGS72_AFSPC'
    assert type(result.intervals) is tuple and type(result.contacts) is tuple
    with pytest.raises((FrozenInstanceError, AttributeError)):
        result.status = 'none'


def test_changed_snapshot_hash_rejected(search):
    calls = 0
    base = evaluator(lambda t: 10 + (t-12.123)/10)
    def mixed(times):
        nonlocal calls
        calls += 1
        result = base(times)
        return result if calls == 1 else replace(result, eop_sha256='changed')
    with pytest.raises(ValueError):
        search(calculate=mixed, start_utc=UTC, end_utc=utc_at(30), minimum_elevation_deg=10.)


@pytest.mark.parametrize('problem', ['utc', 'nonfinite', 'count'])
def test_malformed_evaluator_result_is_rejected(search, problem):
    base = evaluator(lambda t: 11)
    def broken(times):
        result = base(times)
        rows = list(result.rows)
        if problem == 'utc': rows[0] = replace(rows[0], utc=utc_at(-1))
        elif problem == 'nonfinite': rows[0] = replace(rows[0], elevation_deg=float('nan'))
        else: rows.pop()
        return replace(result, rows=tuple(rows))
    with pytest.raises((ValueError, RuntimeError)):
        search(calculate=broken, start_utc=UTC, end_utc=utc_at(30), minimum_elevation_deg=10.)


@pytest.fixture(scope='module')
def iss_oracle():
    import astropy_iers_data
    import isdc_orbit_propagation as native
    from data.earth_orientation import EarthOrientationSnapshot
    from foundation.orbit_time import UtcInstant
    from digital_twin.contracts.orbit import GroundPoint
    from digital_twin.simulation.orbit_geometry import teme_to_itrf, elevation_deg
    eop = EarthOrientationSnapshot.load(astropy_iers_data.IERS_B_FILE, astropy_iers_data.IERS_LEAP_SECOND_FILE,
                                       eop_sha256=EOP_HASH, leap_sha256=LEAP_HASH)
    epoch = parse_utc(UTC).as_time()
    site = GroundPoint(33.4996, 126.5312, 0)
    l1 = '1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992'
    l2 = '2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'
    def calculate(values):
        times = epoch + TimeDelta(np.asarray(values, dtype=float), format='sec', scale='tai')
        instants = [UtcInstant(float(a), float(b)) for a,b in zip(times.jd1, times.jd2)]
        offsets = ((times.jd1-epoch.jd1)+(times.jd2-epoch.jd2))*1440
        raw, errors = native.propagate_tle(l1, l2, offsets.tolist())
        assert not any(errors)
        positions = teme_to_itrf(np.frombuffer(raw, dtype='<f8').reshape(-1,6)[:,:3],
                                 instants, [eop.at(t) for t in instants]).position_m
        return positions, elevation_deg(positions, site)
    dense_products = {}
    def product(times):
        # Reuse immutable fixture rows for repeated thresholds on the exact
        # same dense UTC tuple. This is test setup, not a product speed claim.
        if len(times) > 3600 and times in dense_products:
            return dense_products[times]
        instants = Time([t[:-1] for t in times], format='isot', scale='utc')
        positions, angles = calculate((instants.tai-epoch.tai).sec)
        rows = tuple(OrbitSample(t, tuple(float(v) for v in p), float(a), None)
                     for t,p,a in zip(times, positions, angles))
        result = OrbitCalculation(rows, EOP_HASH, LEAP_HASH)
        if len(times) > 3600: dense_products[times] = result
        return result
    dense = calculate(np.arange(86401))[1]
    return calculate, product, dense


def test_dense_reference_preparation(iss_oracle):
    _, _, dense = iss_oracle
    crossings = np.flatnonzero((dense[:-1]-10)*(dense[1:]-10) < 0)
    assert len(dense) == 86401 and len(crossings) == 8
    destination = Path(__file__).parents[2]/'data/workspace/validation/v6_migration/t019_dense_reference.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({'utc': UTC, 'step_seconds': 1, 'sample_count': len(dense),
        'threshold_deg': 10, 'crossing_brackets_s': [[int(i), int(i)+1] for i in crossings],
        'eop_sha256': EOP_HASH, 'leap_sha256': LEAP_HASH,
        'limitation': 'same propagation/geometry kernel; not independent physical accuracy or RF evidence'}, indent=2), encoding='utf-8')


@pytest.mark.parametrize('threshold', [0., 10., 30., 90.])
def test_iss_full_day_dense_boundary_oracle(search, iss_oracle, threshold):
    calculate, product, dense = iss_oracle
    indices = np.flatnonzero((dense[:-1]-threshold)*(dense[1:]-threshold) < 0)
    roots = []
    # Independent test-only bisection seeded by the one-second full-day grid.
    for index in indices:
        a,b = float(index), float(index+1)
        fa = dense[index]-threshold
        while b-a > .001:
            m = (a+b)/2
            fm = calculate([m])[1][0]-threshold
            if (fa >= 0) == (fm >= 0): a,fa = m,fm
            else: b = m
        roots.append((a+b)/2)
    result = search(calculate=product, start_utc=UTC, end_utc=utc_at(86400), minimum_elevation_deg=threshold)
    actual = [seconds(t) for i in result.intervals for t,clipped in
              ((i.start_utc,i.start_clipped),(i.end_utc,i.end_clipped)) if not clipped]
    assert len(actual) == len(roots)
    np.testing.assert_allclose(actual, roots, atol=1., rtol=0)
    assert result.status == ('complete' if roots or result.intervals else 'none')
    for interval in result.intervals:
        peak = seconds(interval.peak_utc)
        assert seconds(interval.start_utc) <= peak <= seconds(interval.end_utc)
        assert interval.max_elevation_deg == pytest.approx(calculate([peak])[1][0], abs=.01)


def test_si_duration_across_positive_leap(search):
    start = '2016-12-31T23:59:59.000000000Z'
    def calculate(times):
        return OrbitCalculation(tuple(OrbitSample(t, (7000000.,0.,0.), 11., None) for t in times), EOP_HASH, LEAP_HASH)
    result = search(calculate=calculate, start_utc=start, end_utc='2017-01-01T00:00:01.000000000Z', minimum_elevation_deg=10.)
    interval = result.intervals[0]
    assert seconds(interval.end_utc, interval.start_utc) == pytest.approx(3., abs=1e-8)


def test_actual_iss_narrow_pass_around_isolated_peak(search, iss_oracle):
    calculate, product, dense = iss_oracle
    center = float(np.argmax(dense))
    a,b = center-1,center+1
    # Test-only extremum oracle on a known isolated physical peak.
    for _ in range(35):
        x,y = a+(b-a)/3,b-(b-a)/3
        angles = calculate([x,y])[1]
        if angles[0] < angles[1]: a = x
        else: b = y
    peak = (a+b)/2
    threshold = float(calculate([peak])[1][0])-1e-6
    start,end = peak-1.123,peak+1.877
    assert np.all(calculate(np.arange(start,end,1))[1] < threshold)
    result = search(calculate=product, start_utc=utc_at(start), end_utc=utc_at(end), minimum_elevation_deg=threshold)
    assert len(result.intervals) == 1 and not result.contacts
    interval = result.intervals[0]
    assert 0 < seconds(interval.end_utc,interval.start_utc) < 1
    assert seconds(interval.peak_utc) == pytest.approx(peak, abs=.01)
