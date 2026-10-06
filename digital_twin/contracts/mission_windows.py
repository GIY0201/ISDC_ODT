"""Typed readonly mission-window composition inputs; no runtime ownership."""
from dataclasses import dataclass
import math
from typing import Protocol
from digital_twin.contracts.orbit import GroundPoint


def validate_point(point):
    if not isinstance(point,GroundPoint) or point.ellipsoid_height_m<=-6356752.314245:
        raise ValueError('typed WGS84 observation point outside source domain')

@dataclass(frozen=True)
class MissionWindowSite:
    station_id:str
    ground_point:GroundPoint
    minimum_elevation_deg:float
    def __post_init__(self):
        validate_point(self.ground_point)
        if not isinstance(self.station_id,str) or not self.station_id.strip() or len(self.station_id)>80:raise ValueError('station identity required')
        angle=self.minimum_elevation_deg
        if type(angle) not in (int,float) or not math.isfinite(angle) or not 0<=angle<90:raise ValueError('station elevation mask must be0..<90deg')

@dataclass(frozen=True)
class MissionAccessTarget:
    ground_point:GroundPoint
    off_nadir_degrees:float
    def __post_init__(self):
        validate_point(self.ground_point)
        angle=self.off_nadir_degrees
        if type(angle) not in (int,float) or not math.isfinite(angle) or not 0<angle<=90:raise ValueError('camera angle must be0..<90deg with90 allowed')

class MissionWindowPort(Protocol):
    async def calculate(self,nodes:list[dict],sites:list[MissionWindowSite],start_utc:str,end_utc:str,request_id:str,*,target:MissionAccessTarget|None=None,external:dict|None=None,max_external_range_km:float|None=None)->dict: ...
