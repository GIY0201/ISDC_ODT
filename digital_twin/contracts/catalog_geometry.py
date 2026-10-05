from typing import Protocol
from digital_twin.contracts.orbit import GroundPoint

class CatalogGpChanged(ValueError):pass

class CatalogGeometryPort(Protocol):
    async def position(self,group:str,catalog_number:int)->dict: ...
    async def samples(self,group:str,catalog_number:int,expected_hash:str,start_utc:str,step_seconds:int,count:int,ground_point:GroundPoint,minimum_elevation_deg:float,client_request_id:str)->dict: ...
