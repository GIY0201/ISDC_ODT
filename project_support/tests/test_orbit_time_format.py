"""Nanosecond UTC batch formatting must retain the established Astropy oracle."""
import numpy as np
import pytest
from astropy.time import Time,TimeDelta
from foundation import orbit_time

@pytest.mark.parametrize('start',[
    '2016-12-31T23:59:59.999999999',
    '2016-12-31T23:59:60.000000001',
    '1999-12-31T23:59:59.999999500',
    '2020-07-12T21:16:01.000416000'])
def test_utc_format_retains_precision_leaps_rollover_and_input(start):
    times=Time(start,format='isot',scale='utc',precision=9)+TimeDelta(np.arange(101)/10,format='sec',scale='tai')
    before=(times.jd1.copy(),times.jd2.copy())
    assert orbit_time.format_utc_times(times)==tuple(v+'Z' for v in times.isot)
    assert np.array_equal(times.jd1,before[0]) and np.array_equal(times.jd2,before[1])

def test_utc_format_empty_and_vector_contract():
    assert orbit_time.format_utc_times(Time([],format='jd',scale='utc'))==()
    for invalid in (Time('2020-01-01',scale='utc'),Time([2459000],format='jd',scale='tai'),object()):
        with pytest.raises(ValueError):orbit_time.format_utc_times(invalid)

def test_instant_formatter_matches_scalar_at_fractional_grid():
    times=Time('2016-12-31T23:59:59',scale='utc',precision=9)+TimeDelta(np.arange(401)*.010000123,format='sec',scale='tai')
    instants=tuple(orbit_time.UtcInstant(float(a),float(b)) for a,b in zip(times.jd1,times.jd2))
    assert orbit_time.format_utc_batch(instants)==tuple(t.iso_utc for t in instants)
