"""Pure ERFA solar display directions with injected UTC and Earth orientation.

Caller initializes its hash-checked local leap table. No IERS lookup, network,
runtime state, synthetic fallback, eclipse or power calculation.
"""
from dataclasses import dataclass
import math
import numbers
import numpy as np
import erfa
from astropy.coordinates import get_sun
from astropy.time import Time
from astropy import units as u
from foundation.orbit_time import UtcInstant
from digital_twin.contracts.orbit import EarthOrientationPoint


@dataclass(frozen=True)
class SolarDirectionBatch:
    direction_to_sun: np.ndarray
    utc: tuple[UtcInstant,...]
    eop_sha256: str
    leap_sha256: str
    frame: str='ITRF'


def _finite_real(value):
    return not isinstance(value,(bool,np.bool_)) and isinstance(value,numbers.Real) and math.isfinite(value)


def solar_directions(instants,eop):
    """Unit vectors toward the Sun, using GCRS→ITRF IAU2006/2000A.

    Observed dX/dY corrections are absent. The returned immutable bytes own the
    vectors; results describe the model, not measured illumination or attitude.
    """
    utc=tuple(instants);points=tuple(eop);n=len(utc)
    if len(points)!=n:raise ValueError('UTC/EOP row count mismatch')
    if any(not isinstance(t,UtcInstant) or not _finite_real(t.jd1) or not _finite_real(t.jd2) for t in utc):
        raise ValueError('finite UTC instants required')
    if any(not isinstance(p,EarthOrientationPoint) or not all(_finite_real(v) for v in
            (p.ut1_minus_utc_s,p.xp_rad,p.yp_rad)) for p in points):
        raise ValueError('finite EOP points required')
    if len({(p.snapshot_sha256,p.leap_sha256) for p in points})>1:
        raise ValueError('mixed EOP snapshots')
    if not n:
        return SolarDirectionBatch(np.frombuffer(b'',dtype='<f8').reshape(0,3),utc,'','')
    time=Time([t.jd1 for t in utc],[t.jd2 for t in utc],format='jd',scale='utc')
    time.delta_ut1_utc=np.array([p.ut1_minus_utc_s for p in points])
    tt=time.tt;ut1=time.ut1
    rotation=erfa.c2t06a(tt.jd1,tt.jd2,ut1.jd1,ut1.jd2,
        np.array([p.xp_rad for p in points]),np.array([p.yp_rad for p in points]))
    celestial=get_sun(time).cartesian.xyz.to_value(u.au).T
    fixed=np.einsum('nij,nj->ni',rotation,celestial)
    norm=np.linalg.norm(fixed,axis=1)
    if not np.isfinite(fixed).all() or not np.isfinite(norm).all() or np.any(norm<=0):
        raise ValueError('finite nonzero solar vector required')
    normalized=np.ascontiguousarray(fixed/norm[:,None],dtype='<f8')
    owned=np.frombuffer(normalized.tobytes(),dtype='<f8').reshape(n,3)
    return SolarDirectionBatch(owned,utc,points[0].snapshot_sha256,points[0].leap_sha256)
