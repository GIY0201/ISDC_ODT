"""Immutable source-node preparation and owned engineering-frame result contracts."""
from dataclasses import dataclass
from typing import Protocol
import struct
import hashlib
import json
import math
from foundation.orbit_time import parse_utc,unix_millis_without_leap_seconds

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


def prepare_node_definitions(nodes):
    if isinstance(nodes,(str,bytes,dict)):raise ValueError('node definition sequence required')
    nodes=tuple(nodes)
    if not 1<=len(nodes)<=MAX_NODE_DEFINITIONS:raise ValueError('node definition limit1..240')
    ids=set();catalogs=set();prepared=[]
    for node in nodes:
        if not isinstance(node,dict) or type(node.get('schema')) is not int or node['schema']!=1:raise ValueError('node schema1 required')
        identity=node.get('id');catalog=node.get('catalog_number')
        if not isinstance(identity,str) or not identity.strip() or len(identity)>80 or identity in ids:raise ValueError('unique node IDs required')
        if type(catalog) is not int or not 900000<=catalog<=9007199254740991 or catalog in catalogs:raise ValueError('unique virtual catalog numbers required')
        ids.add(identity);catalogs.add(catalog)
        try:encoded=json.dumps(node,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)
        except (TypeError,ValueError) as error:raise ValueError('finite JSON node definition required') from error
        orbit=node.get('orbit')
        if not isinstance(orbit,dict):raise ValueError('node orbit required')
        values={}
        for key in ['altitude_km','eccentricity','inclination','raan','argp','mean_anomaly']:
            value=orbit.get(key,0 if key not in ('altitude_km','inclination') else None)
            if type(value) not in (int,float) or not math.isfinite(value):raise ValueError('finite numeric node orbital fields required')
            values[key]=value
        epoch=orbit.get('epoch');epoch_error=None
        if isinstance(epoch,str):
            parse_utc(epoch) # Valid leap epochs are distinguishable from malformed timestamps.
            try:epoch=unix_millis_without_leap_seconds(epoch)
            except ValueError as error:
                if str(error)!='unsupported_node_time':raise
                epoch_error='unsupported_node_time'
        elif type(epoch) not in (int,float) or not math.isfinite(epoch) or abs(epoch)>8.64e15:raise ValueError('finite explicit node epoch required')
        values['epoch']=epoch
        prepared.append(PreparedNodeDefinition(identity,hashlib.sha256(encoded.encode('utf-8')).hexdigest(),
            None if epoch_error else json.dumps(values,allow_nan=False,separators=(',',':')),epoch_error))
    return tuple(prepared)
