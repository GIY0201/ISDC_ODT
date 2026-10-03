"""Immutable inputs; no web, native or runtime dependency."""
from dataclasses import dataclass

@dataclass(frozen=True)
class OrbitInput:
    input_id: str
    satellite_id: int
    format: str
    raw_sha256: str
    source: str
    fetched_utc: str
    epoch_utc: str
    profile: str
    tle: tuple[str,str] | None
    elements: tuple[tuple[str,float],...]
    defaults: tuple[tuple[str,str],...]
    frame: str='TEME'
    time_system: str='UTC'

@dataclass(frozen=True)
class EarthOrientationPoint:
    ut1_minus_utc_s: float
    xp_rad: float
    yp_rad: float
    snapshot_sha256: str
    leap_sha256: str


import numbers
import numpy as np

@dataclass(frozen=True)
class GroundPoint:
    latitude_deg: float
    longitude_deg: float
    ellipsoid_height_m: float
    def __post_init__(self):
        values=(self.latitude_deg,self.longitude_deg,self.ellipsoid_height_m)
        if any(isinstance(v,(bool,np.bool_)) or not isinstance(v,numbers.Real) or not np.isfinite(v) for v in values):raise ValueError('finite numeric ground coordinates required')
        if abs(self.latitude_deg)>90 or abs(self.longitude_deg)>180:raise ValueError('ground coordinates outside range')

@dataclass(frozen=True)
class OrbitSelection:
    revision: int
    input_id: str | None
    ground_point: GroundPoint
    minimum_elevation_deg: float
    anchor_utc: str | None
    anchor_monotonic_s: float
    playing: bool
    play_rate: float
    client_request_id: str

@dataclass(frozen=True)
class OrbitSnapshot:
    selection: OrbitSelection
    current_utc: str | None
    observed_monotonic_s: float

@dataclass(frozen=True)
class OrbitSample:
    utc: str
    position_m: tuple[float,float,float] | None
    elevation_deg: float | None
    error_code: str | None

@dataclass(frozen=True)
class OrbitCalculation:
    rows: tuple[OrbitSample,...]
    eop_sha256: str
    leap_sha256: str
    frame: str='ITRF'
    profile: str='WGS72_AFSPC'


def _owned_numeric(values):
    array=np.asarray(values)
    if array.dtype.kind not in 'iuf':raise ValueError('real numeric vector required')
    array=np.ascontiguousarray(array,dtype='<f8')
    return np.frombuffer(array.tobytes(),dtype='<f8').reshape(array.shape)


@dataclass(frozen=True)
class EarthOrientationVector:
    ut1_minus_utc_s: np.ndarray
    xp_rad: np.ndarray
    yp_rad: np.ndarray
    snapshot_sha256: str
    leap_sha256: str
    def __post_init__(self):
        for name in ('ut1_minus_utc_s','xp_rad','yp_rad'):
            object.__setattr__(self,name,_owned_numeric(getattr(self,name)))
        shape=self.ut1_minus_utc_s.shape
        if len(shape)!=1 or any(getattr(self,k).shape!=shape or not np.isfinite(getattr(self,k)).all()
                               for k in ('ut1_minus_utc_s','xp_rad','yp_rad')):
            raise ValueError('finite aligned EOP vectors required')


@dataclass(frozen=True)
class OrbitVectorCalculation:
    """Owned ephemeral evaluation, not runtime state or an external wire schema."""
    jd1: np.ndarray
    jd2: np.ndarray
    position_m: np.ndarray
    elevation_deg: np.ndarray
    errors: tuple[str|None,...]
    eop_sha256: str
    leap_sha256: str
    frame: str='ITRF'
    profile: str='WGS72_AFSPC'
    def __post_init__(self):
        for name in ('jd1','jd2','position_m','elevation_deg'):
            object.__setattr__(self,name,_owned_numeric(getattr(self,name)))
        object.__setattr__(self,'errors',tuple(self.errors))
        n=len(self.errors)
        if self.jd1.shape!=(n,) or self.jd2.shape!=(n,) or self.position_m.shape!=(n,3) or self.elevation_deg.shape!=(n,):
            raise ValueError('aligned orbit vectors required')
        if not np.isfinite(self.jd1).all() or not np.isfinite(self.jd2).all():raise ValueError('finite UTC vectors required')
        if any(e is not None and (not isinstance(e,str) or not e) for e in self.errors):raise ValueError('invalid vector error')
        good=np.array([e is None for e in self.errors],dtype=bool)
        if (not np.isfinite(self.position_m[good]).all() or not np.isfinite(self.elevation_deg[good]).all()
            or np.any(np.abs(self.elevation_deg[good])>90)):
            raise ValueError('invalid vector success row')
        if not np.isnan(self.position_m[~good]).all() or not np.isnan(self.elevation_deg[~good]).all():
            raise ValueError('numeric vector failure row')

@dataclass(frozen=True)
class OrbitQueryResult:
    client_request_id: str
    revision: int
    input_id: str
    input_hash: str
    rows: tuple[OrbitSample,...]
    eop_sha256: str
    leap_sha256: str
    stale: bool
    frame: str='ITRF'
    profile: str='WGS72_AFSPC'

class OrbitConflict(ValueError):pass
class OrbitUnavailable(RuntimeError):pass
class OrbitBusy(RuntimeError):pass

@dataclass(frozen=True)
class VisibilityInterval:
    start_utc: str
    end_utc: str
    peak_utc: str
    max_elevation_deg: float
    start_clipped: bool
    end_clipped: bool

@dataclass(frozen=True)
class VisibilityContact:
    utc: str
    duration_seconds: float = 0.

@dataclass(frozen=True)
class VisibilityError:
    utc: str
    error_code: str

@dataclass(frozen=True)
class VisibilityResult:
    query_start_utc: str
    query_end_utc: str
    minimum_elevation_deg: float
    intervals: tuple[VisibilityInterval,...]
    contacts: tuple[VisibilityContact,...]
    status: str
    errors: tuple[VisibilityError,...]
    eop_sha256: str
    leap_sha256: str
    frame: str = 'ITRF'
    profile: str = 'WGS72_AFSPC'

@dataclass(frozen=True)
class OrbitVisibilityQueryResult:
    client_request_id: str
    revision: int
    input_id: str
    input_hash: str
    ground_point: GroundPoint
    calculation: VisibilityResult
    stale: bool
