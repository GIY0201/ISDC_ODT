"""Validate/own native source-node rows. No Python orbital propagation or runtime state."""
import importlib
import json
import math
import re
import numpy as np
from digital_twin.contracts.satellite_nodes import (PreparedNodeDefinition,NativeNodeBatch,
    NODE_PROFILE,NODE_FRAME,NODE_INERTIAL_FRAME,NODE_TIME_MODEL,NODE_ROW_WIDTH,
    MAX_NODE_DEFINITIONS,MAX_NODE_ROWS,MAX_NODE_SAMPLES,prepare_node_definitions)
from digital_twin.contracts.orbit import OrbitUnavailable
from foundation.orbit_time import UtcInstant,format_utc_batch,unix_millis_without_leap_seconds as node_unix_millis






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


def propagate_node_grids(prepared,grids,*,native_port=None):
    prepared=tuple(prepared);grids=tuple(tuple(grid) for grid in grids)
    if not 1<=len(prepared)<=MAX_NODE_DEFINITIONS or len(grids)!=len(prepared) or any(not 1<=len(grid)<=MAX_NODE_SAMPLES for grid in grids) or sum(map(len,grids))>MAX_NODE_ROWS:
        raise ValueError('node batch limits exceeded')
    if any(not isinstance(p,PreparedNodeDefinition) or not isinstance(p.node_id,str) or not p.node_id.strip() or len(p.node_id)>80 or not isinstance(p.definition_hash,str) or not re.fullmatch(r'[0-9a-f]{64}',p.definition_hash) for p in prepared) or len({p.node_id for p in prepared})!=len(prepared):
        raise ValueError('unique prepared node definitions required')
    instants=tuple(t for grid in grids for t in grid)
    if any(not isinstance(t,UtcInstant) or not math.isfinite(t.jd1) or not math.isfinite(t.jd2) for t in instants):raise ValueError('finite UTC instants required')
    # Request-local preparation deduplicates shared sample grids, never current states.
    unique=tuple(dict.fromkeys(instants));formatted=format_utc_batch(unique)
    by_instant=dict(zip(unique,formatted));times={}
    for stamp in set(formatted):
        try:times[stamp]=node_unix_millis(stamp)
        except ValueError as error:
            if str(error)!='unsupported_node_time':raise
            times[stamp]=None
    rows=np.full((len(instants),NODE_ROW_WIDTH),np.nan,dtype='<f8');errors=['unsupported_node_time']*len(rows)
    definitions=[];indices=[];native_times=[];destinations=[];node_ids=[];hashes=[];utc=[]
    for item,grid in zip(prepared,grids):
        slot=len(definitions)
        if item.epoch_error is None:
            if not isinstance(item.orbit_json,str):raise ValueError('prepared node orbit required')
            orbital=json.loads(item.orbit_json)
            keys=('altitude_km','eccentricity','inclination','raan','argp','mean_anomaly','epoch')
            if not isinstance(orbital,dict) or set(orbital)!=set(keys) or any(type(orbital[key]) not in (int,float) or not math.isfinite(orbital[key]) for key in keys):
                raise ValueError('finite prepared orbital fields required')
            definitions.append(orbital)
        elif item.epoch_error!='unsupported_node_time':raise ValueError('invalid prepared epoch error')
        for instant in grid:
            stamp=by_instant[instant];time=times[stamp]
            destination=len(node_ids);node_ids.append(item.node_id);hashes.append(item.definition_hash);utc.append(stamp)
            if item.epoch_error is None and time is not None:indices.append(slot);native_times.append(time);destinations.append(destination)
    if indices:
        port=_native_port(native_port)
        buffer,native_errors=port.propagate_nodes(json.dumps(definitions,allow_nan=False,separators=(',',':')),indices,native_times)
        native_rows=_validate_rows(buffer,native_errors,len(indices))
        rows[destinations]=native_rows
        for destination,error in zip(destinations,native_errors):errors[destination]=error
    return NativeNodeBatch(tuple(node_ids),tuple(hashes),tuple(utc),tuple(errors),rows.tobytes())


def propagate_nodes(prepared,instants,*,native_port=None):
    prepared=tuple(prepared);instants=tuple(instants)
    return propagate_node_grids(prepared,[instants]*len(prepared),native_port=native_port)
