"""Validate/own native source-node rows. No Python orbital propagation or runtime state."""
from datetime import date
import hashlib
import importlib
import json
import math
import re
import numpy as np
from digital_twin.contracts.satellite_nodes import (PreparedNodeDefinition,NativeNodeBatch,
    NODE_PROFILE,NODE_FRAME,NODE_INERTIAL_FRAME,NODE_TIME_MODEL,NODE_ROW_WIDTH,
    MAX_NODE_DEFINITIONS,MAX_NODE_ROWS,MAX_NODE_SAMPLES)
from digital_twin.contracts.orbit import OrbitUnavailable
from foundation.orbit_time import UtcInstant,parse_utc,format_utc_batch


def node_unix_millis(text):
    """Gregorian Unix milliseconds, no quasi-JD leap-day stretch or leap collapse."""
    if not isinstance(text,str):raise ValueError('explicit node UTC required')
    match=re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:Z|\+00:00)',text)
    if match is None:raise ValueError('explicit node UTC required')
    year,month,day,hour,minute,second=map(int,match.groups()[:6])
    if second==60:raise ValueError('unsupported_node_time')
    if hour>23 or minute>59 or second>59:raise ValueError('invalid node UTC calendar')
    days=(date(year,month,day)-date(1970,1,1)).days
    fraction=float('0.'+(match[7] or '0'))
    return days*86400000+(hour*3600+minute*60+second)*1000+fraction*1000


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
            try:epoch=node_unix_millis(epoch)
            except ValueError as error:
                if str(error)!='unsupported_node_time':raise
                epoch_error='unsupported_node_time'
        elif type(epoch) not in (int,float) or not math.isfinite(epoch) or abs(epoch)>8.64e15:raise ValueError('finite explicit node epoch required')
        values['epoch']=epoch
        prepared.append(PreparedNodeDefinition(identity,hashlib.sha256(encoded.encode('utf-8')).hexdigest(),
            None if epoch_error else json.dumps(values,allow_nan=False,separators=(',',':')),epoch_error))
    return tuple(prepared)


def _native_port(port):
    if port is None:
        try:port=importlib.import_module('isdc_orbit_propagation')
        except ImportError as error:raise OrbitUnavailable('Node native profile unavailable') from error
    expected={'node_calculation_profile':NODE_PROFILE,'node_frame':NODE_FRAME,
        'node_inertial_frame':NODE_INERTIAL_FRAME,'node_time_model':NODE_TIME_MODEL,
        'NODE_ROW_WIDTH':NODE_ROW_WIDTH,'MAX_NODE_DEFINITIONS':MAX_NODE_DEFINITIONS,
        'MAX_NODE_ROWS':MAX_NODE_ROWS,'MAX_NODE_SAMPLES':MAX_NODE_SAMPLES}
    if not callable(getattr(port,'propagate_nodes',None)) or any(getattr(port,key,None)!=value for key,value in expected.items()):
        raise OrbitUnavailable('Node native profile unavailable or unsupported')
    return port


def _validate_rows(buffer,errors,count):
    if not isinstance(buffer,bytes) or len(buffer)!=count*NODE_ROW_WIDTH*8 or not isinstance(errors,(tuple,list)) or len(errors)!=count:
        raise RuntimeError('invalid native node shape')
    if any(error is not None and (not isinstance(error,str) or not error or len(error)>128) for error in errors):raise RuntimeError('invalid native node errors')
    rows=np.frombuffer(buffer,dtype='<f8').reshape(-1,NODE_ROW_WIDTH)
    valid=rows[np.array([error is None for error in errors],dtype=bool)]
    if not np.isfinite(valid).all():raise RuntimeError('nonfinite native node success')
    if len(valid):
        if np.any((valid[:,27]!=0)&(valid[:,27]!=1)) or np.any(valid[:,30]<0) or np.any(valid[:,21]<=0) or np.any(np.abs(valid[:,29])>90) or np.any(np.abs(valid[:,28])>180):
            raise RuntimeError('invalid native node geometric values')
        for start in [9,12,15,18]:
            if not np.allclose(np.linalg.norm(valid[:,start:start+3],axis=1),1,rtol=0,atol=1e-10):raise RuntimeError('invalid native node unit vector')
    return rows


def propagate_nodes(prepared,instants,*,native_port=None):
    prepared=tuple(prepared);instants=tuple(instants)
    if not 1<=len(prepared)<=MAX_NODE_DEFINITIONS or not 1<=len(instants)<=MAX_NODE_SAMPLES or len(prepared)*len(instants)>MAX_NODE_ROWS:
        raise ValueError('node batch limits exceeded')
    if any(not isinstance(p,PreparedNodeDefinition) or not isinstance(p.node_id,str) or not p.node_id.strip() or len(p.node_id)>80 or not isinstance(p.definition_hash,str) or not re.fullmatch(r'[0-9a-f]{64}',p.definition_hash) for p in prepared) or len({p.node_id for p in prepared})!=len(prepared):
        raise ValueError('unique prepared node definitions required')
    if any(not isinstance(t,UtcInstant) or not math.isfinite(t.jd1) or not math.isfinite(t.jd2) for t in instants):raise ValueError('finite UTC instants required')
    stamps=format_utc_batch(instants);times=[]
    for stamp in stamps:
        try:times.append(node_unix_millis(stamp))
        except ValueError as error:
            if str(error)!='unsupported_node_time':raise
            times.append(None)
    rows=np.full((len(prepared)*len(stamps),NODE_ROW_WIDTH),np.nan,dtype='<f8');errors=['unsupported_node_time']*len(rows)
    definitions=[];indices=[];native_times=[];destinations=[];node_ids=[];hashes=[];utc=[]
    for item in prepared:
        slot=len(definitions)
        if item.epoch_error is None:
            if not isinstance(item.orbit_json,str):raise ValueError('prepared node orbit required')
            orbital=json.loads(item.orbit_json)
            keys=('altitude_km','eccentricity','inclination','raan','argp','mean_anomaly','epoch')
            if not isinstance(orbital,dict) or set(orbital)!=set(keys) or any(type(orbital[key]) not in (int,float) or not math.isfinite(orbital[key]) for key in keys):
                raise ValueError('finite prepared orbital fields required')
            definitions.append(orbital)
        elif item.epoch_error!='unsupported_node_time':raise ValueError('invalid prepared epoch error')
        for stamp,time in zip(stamps,times):
            destination=len(node_ids);node_ids.append(item.node_id);hashes.append(item.definition_hash);utc.append(stamp)
            if item.epoch_error is None and time is not None:indices.append(slot);native_times.append(time);destinations.append(destination)
    if indices:
        port=_native_port(native_port)
        buffer,native_errors=port.propagate_nodes(json.dumps(definitions,allow_nan=False,separators=(',',':')),indices,native_times)
        native_rows=_validate_rows(buffer,native_errors,len(indices))
        rows[destinations]=native_rows
        for destination,error in zip(destinations,native_errors):errors[destination]=error
    return NativeNodeBatch(tuple(node_ids),tuple(hashes),tuple(utc),tuple(errors),rows.tobytes())
