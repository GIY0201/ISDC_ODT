from fastapi import APIRouter,Request,HTTPException
from pydantic import BaseModel,ConfigDict,Field
from digital_twin.contracts.catalog_geometry import CatalogGeometryPort
from digital_twin.contracts.orbit import OrbitBusy,OrbitUnavailable

router=APIRouter()
class CatalogPositionRequest(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)
    group:str=Field(min_length=1,max_length=32,pattern=r'^[a-zA-Z0-9_-]+$')
    catalog_number:int=Field(ge=1,le=999999999)

@router.post('/api/catalog/position')
async def position(request:Request,command:CatalogPositionRequest)->dict:
    query:CatalogGeometryPort|None=request.app.state.catalog_geometry_query
    if query is None:raise HTTPException(503,'Catalog EOP/native profile unavailable')
    try:return await query.position(command.group,command.catalog_number)
    except (OrbitBusy,OrbitUnavailable,ImportError,OSError) as error:raise HTTPException(503,str(error)) from error
    except (ValueError,KeyError,TypeError) as error:raise HTTPException(422,str(error)) from error
