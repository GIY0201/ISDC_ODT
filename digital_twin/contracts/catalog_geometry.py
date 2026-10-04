from typing import Protocol

class CatalogGeometryPort(Protocol):
    async def position(self,group:str,catalog_number:int)->dict: ...
