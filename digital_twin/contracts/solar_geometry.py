"""Readonly solar display query boundary, no runtime or transport dependency."""
from typing import Protocol


class SolarGeometryPort(Protocol):
    async def samples(self,start_utc:str,step_seconds:int,count:int,client_request_id:str)->dict: ...
