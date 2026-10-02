"""Product time contract: UTC-JD and SI playback are distinct."""
import math
import pytest
from foundation.orbit_time import parse_utc, advance_seconds, minutes_since_epoch


def test_same_utc_and_fraction_round_trip():
    a=parse_utc('2020-07-12T21:16:01.000000123Z')
    b=parse_utc('2020-07-12T21:16:01.000000123+00:00')
    assert a==b
    assert a.iso_utc=='2020-07-12T21:16:01.000000123Z'
    assert minutes_since_epoch(a,b)==0

@pytest.mark.parametrize('text',['2020-07-12T21:16:01','2020-13-12T21:16:01Z','2020-07-12T21:16:01+09:00','2019-12-31T23:59:60Z','NaN'])
def test_invalid_or_non_utc_time_is_rejected(text):
    with pytest.raises(ValueError):parse_utc(text)


def test_si_playback_crosses_known_leap_second_without_skipping_it():
    initial=parse_utc('2016-12-31T23:59:59Z')
    leap=advance_seconds(initial,1)
    final=advance_seconds(initial,2)
    assert leap.iso_utc.startswith('2016-12-31T23:59:60.')
    assert final.iso_utc.startswith('2017-01-01T00:00:00.')
    assert 0<minutes_since_epoch(leap,initial)<1/60
    assert advance_seconds(final,-2)==initial
    with pytest.raises(ValueError):advance_seconds(initial,math.inf)
