"""Additive readonly GP inspector values; existing stored OrbitSample is unchanged."""
from dataclasses import dataclass
import math
from numbers import Real
from digital_twin.contracts.orbit import OrbitSample,OrbitCalculation
DETAILS_VERSION=1
DETAILS_PROFILE='WGS84_ERFA_GC2GD_TEME_SPEED'
DETAILS_UNITS={'latitude':'deg','longitude':'deg','ellipsoid_height':'m','teme_speed':'km/s'}
def finite(v):return isinstance(v,Real) and not isinstance(v,bool) and math.isfinite(v)
@dataclass(frozen=True)
class CatalogGeodeticPoint:
    latitude_deg:float
    longitude_deg:float
    ellipsoid_height_m:float
    ellipsoid:str='WGS84'
    def __post_init__(self):
        if not all(finite(x) for x in (self.latitude_deg,self.longitude_deg,self.ellipsoid_height_m)) or abs(self.latitude_deg)>90 or abs(self.longitude_deg)>180 or self.ellipsoid_height_m<0 or self.ellipsoid!='WGS84':raise ValueError('invalid satellite WGS84 geodetic detail')
@dataclass(frozen=True)
class CatalogDetailSample(OrbitSample):
    geodetic:CatalogGeodeticPoint|None=None
    teme_speed_km_s:float|None=None
    def __post_init__(self):
        if self.error_code is not None:
            if not isinstance(self.error_code,str) or not self.error_code or any(x is not None for x in (self.position_m,self.elevation_deg,self.geodetic,self.teme_speed_km_s)):raise ValueError('failed catalog detail must be null')
        elif (not isinstance(self.geodetic,CatalogGeodeticPoint) or not finite(self.teme_speed_km_s) or self.teme_speed_km_s<0 or not isinstance(self.position_m,tuple) or len(self.position_m)!=3 or not all(finite(x) for x in self.position_m) or not finite(self.elevation_deg) or abs(self.elevation_deg)>90):raise ValueError('invalid successful catalog detail')
        if self.geodetic is not None:self.geodetic.__post_init__()
@dataclass(frozen=True)
class CatalogDetailCalculation(OrbitCalculation):
    details_version:int=DETAILS_VERSION
    details_profile:str=DETAILS_PROFILE

def details_metadata(calculation):
    if not isinstance(calculation,CatalogDetailCalculation):return {}
    if type(calculation.details_version) is not int or calculation.details_version!=DETAILS_VERSION or calculation.details_profile!=DETAILS_PROFILE or any(not isinstance(row,CatalogDetailSample) for row in calculation.rows):raise ValueError('invalid catalog detail version/profile/rows')
    return {'details_version':DETAILS_VERSION,'details_profile':DETAILS_PROFILE,'details_units':dict(DETAILS_UNITS)}

def detail_row_payload(row):
    if not isinstance(row,CatalogDetailSample):raise ValueError('typed catalog detail row required')
    row.__post_init__()
    from dataclasses import asdict
    return {'geodetic':None if row.geodetic is None else asdict(row.geodetic),'teme_speed_km_s':row.teme_speed_km_s}
