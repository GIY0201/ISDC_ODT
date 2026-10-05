"""Immutable source-node preparation and owned engineering-frame result contracts."""
from dataclasses import dataclass
from typing import Protocol
import struct

NODE_PROFILE='SOURCE_KEPLER_J2_V1'
NODE_FRAME='EARTH_FIXED_GMST_UTC_APPROX'
NODE_INERTIAL_FRAME='SOURCE_MEAN_EQUATOR_EQUINOX_APPROX'
NODE_TIME_MODEL='unix_ms_utc_approx'
SOURCE_COMMIT='1a1e00297a0301637455b0ef2cf48b2e74576b07'
NODE_ROW_WIDTH=31
MAX_NODE_DEFINITIONS=240
MAX_NODE_ROWS=50000
MAX_NODE_SAMPLES=601

@dataclass(frozen=True)
class PreparedNodeDefinition:
    node_id:str
    definition_hash:str
    orbit_json:str|None
    epoch_error:str|None=None

@dataclass(frozen=True)
class NativeNodeBatch:
    node_ids:tuple[str,...]
    definition_hashes:tuple[str,...]
    utc:tuple[str,...]
    errors:tuple[str|None,...]
    _buffer:bytes
    frame:str=NODE_FRAME
    inertial_frame:str=NODE_INERTIAL_FRAME
    profile:str=NODE_PROFILE
    time_model:str=NODE_TIME_MODEL

    def row(self,index):
        if self.errors[index] is not None:return None
        return struct.unpack_from('<31d',self._buffer,index*NODE_ROW_WIDTH*8)

    def fixed_position_m(self,index):
        row=self.row(index)
        return None if row is None else tuple(value*1000 for value in row[6:9])

class NodeGeometryPort(Protocol):
    async def samples(self,nodes,start_utc:str,count:int,step_seconds:int,request_id:str)->dict: ...
    async def track(self,nodes,center_utc:str,request_id:str)->dict: ...
