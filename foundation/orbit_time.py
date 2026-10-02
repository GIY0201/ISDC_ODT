"""Stateless UTC input and SGP4 time convention."""
from dataclasses import dataclass
import math
import re
import warnings
from astropy.time import Time, TimeDelta

@dataclass(frozen=True)
class UtcInstant:
    jd1: float
    jd2: float

    def as_time(self) -> Time:
        return Time(self.jd1,self.jd2,format='jd',scale='utc',precision=9)

    @property
    def iso_utc(self) -> str:
        return self.as_time().isot+'Z'


def parse_utc(text: str) -> UtcInstant:
    if not isinstance(text,str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|\+00:00)',text):
        raise ValueError('an explicit UTC ISO timestamp is required')
    raw=text[:-1] if text.endswith('Z') else text[:-6]
    with warnings.catch_warnings(record=True) as emitted:
        warnings.simplefilter('always')
        value=Time(raw,format='isot',scale='utc',precision=9)
    if any('after end of day' in str(w.message) for w in emitted):
        raise ValueError('invalid UTC leap second')
    return UtcInstant(float(value.jd1),float(value.jd2))


def parse_utc_batch(texts) -> tuple[UtcInstant,...]:
    """Same explicit UTC/leap validation as parse_utc, in one Astropy call."""
    if isinstance(texts,(str,bytes)):
        raise ValueError('one-dimensional UTC sequence required')
    texts=tuple(texts)
    raw=[]
    for text in texts:
        if not isinstance(text,str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|\+00:00)',text):
            raise ValueError('an explicit UTC ISO timestamp is required')
        raw.append(text[:-1] if text.endswith('Z') else text[:-6])
    if not raw:return ()
    with warnings.catch_warnings(record=True) as emitted:
        warnings.simplefilter('always')
        value=Time(raw,format='isot',scale='utc',precision=9)
    if any('after end of day' in str(w.message) for w in emitted):
        raise ValueError('invalid UTC leap second')
    return tuple(UtcInstant(float(a),float(b)) for a,b in zip(value.jd1,value.jd2))


def format_utc_batch(instants) -> tuple[str,...]:
    """Canonical nanosecond UTC strings without creating a Time per row."""
    instants=tuple(instants)
    if any(not isinstance(t,UtcInstant) or not math.isfinite(t.jd1) or
           not math.isfinite(t.jd2) for t in instants):
        raise ValueError('finite UTC instants required')
    if not instants:return ()
    value=Time([t.jd1 for t in instants],[t.jd2 for t in instants],
               format='jd',scale='utc',precision=9)
    return tuple(v+'Z' for v in value.isot)


def advance_seconds(instant: UtcInstant, seconds: float) -> UtcInstant:
    if not math.isfinite(seconds):raise ValueError('playback seconds must be finite')
    value=instant.as_time()+TimeDelta(seconds,format='sec',scale='tai')
    return parse_utc(value.utc.isot+'Z')


def minutes_since_epoch(instant: UtcInstant, epoch: UtcInstant) -> float:
    # UTC quasi-Julian dates match SGP4 library convention; not a TAI duration.
    return ((instant.jd1-epoch.jd1)+(instant.jd2-epoch.jd2))*1440
