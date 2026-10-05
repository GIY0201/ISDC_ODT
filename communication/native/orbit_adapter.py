"""Owned native TEME batches; failure rows are never exposed as numeric samples."""
from dataclasses import dataclass
import json
import math
import numpy as np
from astropy.time import Time
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


@dataclass(frozen=True)
class PreparedCatalogOrbit:
    """Immutable GP and epoch preparation, independent of observation UTC."""
    input_id: str
    payload: str
    epoch: UtcInstant


@dataclass(frozen=True)
class NativeCatalogBatch:
    input_ids: tuple[str,...]
    utc: str
    errors: tuple[str|None,...]
    _buffer: bytes
    frame: str='TEME'
    profile: str='WGS72_AFSPC'

    def row(self,index):
        if self.errors[index] is not None:return None
        return tuple(np.frombuffer(self._buffer,dtype='<f8').reshape(-1,6)[index])

    def valid_rows(self):
        indices=tuple(i for i,error in enumerate(self.errors) if error is None)
        rows=np.frombuffer(self._buffer,dtype='<f8').reshape(-1,6)[list(indices)]
        return indices,np.frombuffer(rows.tobytes(),dtype='<f8').reshape(-1,6)


def _omm_payload(orbit):
    payload=dict(orbit.elements)
    payload.update(NORAD_CAT_ID=orbit.satellite_id,EPOCH=orbit.epoch_utc.removesuffix('Z'),CLASSIFICATION_TYPE='U',ELEMENT_SET_NO=0,REV_AT_EPOCH=0,EPHEMERIS_TYPE=0)
    return json.dumps(payload,allow_nan=False)


def prepare_catalog_orbits(orbits):
    prepared=[]
    for orbit in orbits:
        if not isinstance(orbit,OrbitInput) or orbit.format!='OMM' or orbit.profile!=native.calculation_profile or orbit.frame!='TEME' or orbit.time_system!='UTC':
            raise ValueError('supported catalog OMM inputs required')
        prepared.append(PreparedCatalogOrbit(orbit.input_id,_omm_payload(orbit),parse_utc(orbit.epoch_utc)))
    return tuple(prepared)


def propagate_catalog(prepared,instant:UtcInstant)->NativeCatalogBatch:
    """Observe every prepared GP at one UTC; native limits never truncate it."""
    prepared=tuple(prepared)
    if not isinstance(instant,UtcInstant) or not math.isfinite(instant.jd1) or not math.isfinite(instant.jd2):
        raise ValueError('finite UTC instant required')
    if any(not isinstance(row,PreparedCatalogOrbit) or not isinstance(row.epoch,UtcInstant) or
           not math.isfinite(row.epoch.jd1) or not math.isfinite(row.epoch.jd2) for row in prepared):
        raise ValueError('prepared catalog inputs required')
    buffers=[];errors=[]
    for start in range(0,len(prepared),native.MAX_CATALOG_BATCH_ROWS):
        chunk=prepared[start:start+native.MAX_CATALOG_BATCH_ROWS]
        buffer,failed=native.propagate_omm_many([row.payload for row in chunk],
            [minutes_since_epoch(instant,row.epoch) for row in chunk])
        if not isinstance(buffer,bytes) or len(buffer)!=len(chunk)*48 or len(failed)!=len(chunk) or any(
            error is not None and (not isinstance(error,str) or not error) for error in failed):
            raise RuntimeError('invalid native catalog batch shape or errors')
        rows=np.frombuffer(buffer,dtype='<f8').reshape(-1,6)
        valid=np.array([error is None for error in failed],dtype=bool)
        if not np.isfinite(rows[valid]).all():raise RuntimeError('nonfinite native catalog success')
        buffers.append(buffer);errors.extend(failed)
    return NativeCatalogBatch(tuple(row.input_id for row in prepared),instant.iso_utc,tuple(errors),b''.join(buffers))

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
    buffer,errors=_propagate_minutes(orbit,minutes)
    return NativeOrbitBatch(orbit.input_id,format_utc_batch(instants),errors,buffer)


def propagate_times(orbit:OrbitInput,times:Time):
    """Owned native numeric rows for a validated UTC vector; no UTC formatting."""
    if not isinstance(times,Time) or times.scale!='utc' or times.ndim!=1 or not np.isfinite(times.jd).all():
        raise ValueError('finite UTC Time vector required')
    epoch=parse_utc(orbit.epoch_utc)
    minutes=((times.jd1-epoch.jd1)+(times.jd2-epoch.jd2))*1440
    buffer,errors=_propagate_minutes(orbit,minutes.tolist())
    return np.frombuffer(buffer,dtype='<f8').reshape(-1,6),errors


def _propagate_minutes(orbit,minutes):
    if orbit.profile!=native.calculation_profile or orbit.frame!='TEME' or orbit.time_system!='UTC':raise ValueError('unsupported native profile')
    if len(minutes)>native.MAX_BATCH_ROWS:raise ValueError('native batch limit exceeded')
    if orbit.format=='TLE' and orbit.tle is not None:
        buffer,errors=native.propagate_tle(*orbit.tle,minutes)
    elif orbit.format=='OMM':
        buffer,errors=native.propagate_omm(_omm_payload(orbit),minutes)
    else:raise ValueError('unsupported orbit format')
    if len(buffer)!=len(minutes)*48 or len(errors)!=len(minutes):raise RuntimeError('invalid native batch shape')
    rows=np.frombuffer(buffer,dtype='<f8').reshape(-1,6)
    valid=np.array([error is None for error in errors],dtype=bool)
    if not np.isfinite(rows[valid]).all():raise RuntimeError('nonfinite native success')
    return buffer,tuple(errors)
