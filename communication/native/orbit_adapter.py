"""Owned native TEME batches; failure rows are never exposed as numeric samples."""
from dataclasses import dataclass
import json
import math
import numpy as np
import isdc_orbit_propagation as native
from digital_twin.contracts.orbit import OrbitInput
from foundation.orbit_time import UtcInstant,parse_utc,parse_utc_batch,format_utc_batch,minutes_since_epoch

@dataclass(frozen=True)
class NativeOrbitBatch:
    input_id: str
    utc: tuple[str,...]
    errors: tuple[str|None,...]
    _buffer: bytes
    frame: str='TEME'
    profile: str='WGS72_AFSPC'
    def row(self,index):
        if self.errors[index] is not None:return None
        return tuple(np.frombuffer(self._buffer,dtype='<f8').reshape(-1,6)[index])
    def valid_rows(self):
        indices=tuple(i for i,error in enumerate(self.errors) if error is None)
        values=np.frombuffer(self._buffer,dtype='<f8').reshape(-1,6)[list(indices)].copy()
        # bytes-backed array cannot have its write flag re-enabled.
        values=np.frombuffer(values.tobytes(),dtype='<f8').reshape(-1,6)
        return indices,values

def propagate(orbit:OrbitInput,utc)->NativeOrbitBatch:
    if orbit.profile!=native.calculation_profile or orbit.frame!='TEME' or orbit.time_system!='UTC':raise ValueError('unsupported native profile')
    if isinstance(utc,(str,bytes)):raise ValueError('one-dimensional UTC sequence required')
    utc=tuple(utc)
    if any(not isinstance(value,str) for value in utc):raise ValueError("UTC rows must be strings")
    if len(utc)>native.MAX_BATCH_ROWS:raise ValueError('native batch limit exceeded')
    return propagate_instants(orbit,parse_utc_batch(utc))


def propagate_instants(orbit:OrbitInput,instants)->NativeOrbitBatch:
    """Reuse validated UTC instants from the calculation assembly boundary."""
    if orbit.profile!=native.calculation_profile or orbit.frame!='TEME' or orbit.time_system!='UTC':raise ValueError('unsupported native profile')
    instants=tuple(instants)
    if len(instants)>native.MAX_BATCH_ROWS:raise ValueError('native batch limit exceeded')
    if any(not isinstance(t,UtcInstant) or not math.isfinite(t.jd1) or not math.isfinite(t.jd2) for t in instants):
        raise ValueError('finite UTC instants required')
    epoch=parse_utc(orbit.epoch_utc);minutes=[minutes_since_epoch(t,epoch) for t in instants]
    if orbit.format=='TLE' and orbit.tle is not None:
        buffer,errors=native.propagate_tle(*orbit.tle,minutes)
    elif orbit.format=='OMM':
        payload=dict(orbit.elements)
        payload.update(NORAD_CAT_ID=orbit.satellite_id,EPOCH=orbit.epoch_utc.removesuffix('Z'),CLASSIFICATION_TYPE='U',ELEMENT_SET_NO=0,REV_AT_EPOCH=0,EPHEMERIS_TYPE=0)
        buffer,errors=native.propagate_omm(json.dumps(payload,allow_nan=False),minutes)
    else:raise ValueError('unsupported orbit format')
    if len(buffer)!=len(instants)*48 or len(errors)!=len(instants):raise RuntimeError('invalid native batch shape')
    rows=np.frombuffer(buffer,dtype='<f8').reshape(-1,6)
    valid=np.array([error is None for error in errors],dtype=bool)
    if not np.isfinite(rows[valid]).all():raise RuntimeError('nonfinite native success')
    return NativeOrbitBatch(orbit.input_id,format_utc_batch(instants),tuple(errors),buffer)
