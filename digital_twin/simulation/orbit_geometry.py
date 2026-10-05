"""Pure batch TEME -> ITRF and geometric elevation, with injected UTC/EOP.

TEME input km/km/s. ITRF output m/m/s. No refraction, terrain or RF model.
Velocity includes Earth rotation with explicitly supplied LOD (default 0 s);
polar motion rates are neglected. No network, file or runtime dependency.
"""
from dataclasses import dataclass
import numbers
import math
import numpy as np
import erfa
from astropy.time import Time
from foundation.orbit_time import UtcInstant
from digital_twin.contracts.orbit import EarthOrientationPoint,EarthOrientationVector,GroundPoint

@dataclass(frozen=True)
class ItrfBatch:
    position_m: np.ndarray
    velocity_m_s: np.ndarray | None
    utc: tuple[UtcInstant,...]
    eop_sha256: str
    leap_sha256: str
    lod_s: float
    frame: str='ITRF'

def _readonly(values):
    array=np.ascontiguousarray(values,dtype='<f8')
    return np.frombuffer(array.tobytes(),dtype='<f8').reshape(array.shape)

def _vectors(values):
    # Owned numeric arrays from the native boundary need no Python object copy.
    if isinstance(values,np.ndarray) and values.dtype.kind in 'iuf':
        original=None
    else:
        original=np.asarray(values,dtype=object)
        if any(isinstance(v,(bool,np.bool_)) or not isinstance(v,numbers.Real) for v in original.flat):raise ValueError('real numeric vector components required')
    try:array=np.asarray(values,dtype=float)
    except (ValueError,TypeError) as exc:raise ValueError('numeric vectors required') from exc
    if array.ndim!=2 or array.shape[1]!=3 or not np.isfinite(array).all():raise ValueError('finite N by 3 vectors required')
    return array

def station_itrf(site:GroundPoint):
    lat,lon=np.deg2rad([site.latitude_deg,site.longitude_deg])
    a=6378137.;flattening=1/298.257223563;e2=flattening*(2-flattening)
    radius=a/np.sqrt(1-e2*np.sin(lat)**2)
    return _readonly([(radius+site.ellipsoid_height_m)*np.cos(lat)*np.cos(lon),(radius+site.ellipsoid_height_m)*np.cos(lat)*np.sin(lon),(radius*(1-e2)+site.ellipsoid_height_m)*np.sin(lat)])

def teme_to_itrf(positions_km,instants,eop,*,velocities_km_s=None,lod_s=0.):
    r=_vectors(positions_km);utc=tuple(instants);points=tuple(eop);n=len(r)
    if len(utc)!=n or len(points)!=n:raise ValueError('UTC/EOP/vector row count mismatch')
    if any(not isinstance(t,UtcInstant) or not math.isfinite(t.jd1) or not math.isfinite(t.jd2) for t in utc):raise ValueError('finite UTC instants required')
    if any(not isinstance(p,EarthOrientationPoint) or not math.isfinite(p.ut1_minus_utc_s) or not math.isfinite(p.xp_rad) or not math.isfinite(p.yp_rad) for p in points):raise ValueError('finite EOP points required')
    if len({(p.snapshot_sha256,p.leap_sha256) for p in points})>1:raise ValueError('mixed EOP snapshots')
    if isinstance(lod_s,(bool,np.bool_)) or not isinstance(lod_s,numbers.Real) or not np.isfinite(lod_s) or abs(lod_s)>=86400:raise ValueError('invalid LOD seconds')
    v=None if velocities_km_s is None else _vectors(velocities_km_s)
    if v is not None and len(v)!=n:raise ValueError('velocity row count mismatch')
    if not n:return ItrfBatch(_readonly(r),None if v is None else _readonly(v),utc,'','',float(lod_s))
    time=Time([t.jd1 for t in utc],[t.jd2 for t in utc],format='jd',scale='utc')
    time.delta_ut1_utc=np.array([p.ut1_minus_utc_s for p in points])
    ut1=time.ut1;theta=erfa.gmst82(ut1.jd1,ut1.jd2);c,s=np.cos(theta),np.sin(theta)
    def rotate(values):return np.column_stack((c*values[:,0]+s*values[:,1],-s*values[:,0]+c*values[:,1],values[:,2]))
    pef=rotate(r)
    polar=erfa.pom00(np.array([p.xp_rad for p in points]),np.array([p.yp_rad for p in points]),np.zeros(n))
    position=np.einsum('nij,nj->ni',polar,pef)*1000
    velocity=None
    if v is not None:
        omega=7.29211514670698e-5*(1-float(lod_s)/86400)
        rotating=rotate(v)-np.cross(np.array([0.,0.,omega]),pef)
        velocity=np.einsum('nij,nj->ni',polar,rotating)*1000
    if not np.isfinite(position).all() or velocity is not None and not np.isfinite(velocity).all():raise ValueError('nonfinite transform result')
    return ItrfBatch(_readonly(position),None if velocity is None else _readonly(velocity),utc,points[0].snapshot_sha256,points[0].leap_sha256,float(lod_s))

def elevation_deg(positions_m,site:GroundPoint):
    positions=_vectors(positions_m);delta=positions-station_itrf(site)
    if np.any(np.linalg.norm(delta,axis=1)==0):raise ValueError('satellite and ground point are coincident')
    lat,lon=np.deg2rad([site.latitude_deg,site.longitude_deg])
    east=-np.sin(lon)*delta[:,0]+np.cos(lon)*delta[:,1]
    north=-np.sin(lat)*np.cos(lon)*delta[:,0]-np.sin(lat)*np.sin(lon)*delta[:,1]+np.cos(lat)*delta[:,2]
    up=np.cos(lat)*np.cos(lon)*delta[:,0]+np.cos(lat)*np.sin(lon)*delta[:,1]+np.sin(lat)*delta[:,2]
    result=np.degrees(np.arctan2(up,np.hypot(east,north)))
    if not np.isfinite(result).all():raise ValueError('nonfinite elevation')
    return _readonly(result)


def observation_geometry(positions_m,site:GroundPoint):
    """Range and clockwise-from-north ENU azimuth; zenith has no azimuth."""
    delta=_vectors(positions_m)-station_itrf(site)
    distance=np.linalg.norm(delta,axis=1)
    if np.any(distance==0) or not np.isfinite(distance).all():raise ValueError('finite nonzero observer range required')
    lat,lon=np.deg2rad([site.latitude_deg,site.longitude_deg])
    east=-np.sin(lon)*delta[:,0]+np.cos(lon)*delta[:,1]
    north=-np.sin(lat)*np.cos(lon)*delta[:,0]-np.sin(lat)*np.sin(lon)*delta[:,1]+np.cos(lat)*delta[:,2]
    angles=np.degrees(np.arctan2(east,north))%360
    return tuple((float(r),None if np.hypot(e,n)<1e-9 else float(a)) for r,e,n,a in zip(distance,east,north,angles))


def teme_positions_to_itrf(positions_km,times:Time,eop:EarthOrientationVector):
    """Position-only form of the same GMST82/polar-motion kernel on vectors."""
    r=_vectors(positions_km);n=len(r)
    if not isinstance(times,Time) or times.scale!='utc' or times.shape!=(n,) or not np.isfinite(times.jd).all():
        raise ValueError('finite aligned UTC Time required')
    if not isinstance(eop,EarthOrientationVector) or len(eop.xp_rad)!=n:raise ValueError('aligned EOP required')
    if not n:return _readonly(r)
    utc=times.copy();utc.delta_ut1_utc=eop.ut1_minus_utc_s
    ut1=utc.ut1;theta=erfa.gmst82(ut1.jd1,ut1.jd2);c,s=np.cos(theta),np.sin(theta)
    pef=np.column_stack((c*r[:,0]+s*r[:,1],-s*r[:,0]+c*r[:,1],r[:,2]))
    polar=erfa.pom00(eop.xp_rad,eop.yp_rad,np.zeros(n))
    position=np.einsum('nij,nj->ni',polar,pef)*1000
    if not np.isfinite(position).all():raise ValueError('nonfinite transform result')
    return _readonly(position)
