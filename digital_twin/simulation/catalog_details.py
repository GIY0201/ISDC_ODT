"""Compiled ERFA WGS84 conversion of existing native ITRF and TEME velocity."""
import numpy as np
import erfa
from digital_twin.contracts.catalog_details import CatalogGeodeticPoint
from digital_twin.simulation.orbit_geometry import _vectors

def catalog_detail_values(positions_m,teme_velocities_km_s):
    positions=_vectors(positions_m);velocities=_vectors(teme_velocities_km_s)
    if len(positions)!=len(velocities) or np.any(np.linalg.norm(positions,axis=1)==0):raise ValueError('aligned nonzero satellite position and velocity required')
    longitude,latitude,height=erfa.gc2gd(1,positions)
    speeds=np.linalg.norm(velocities,axis=1)
    if not np.isfinite(speeds).all():raise ValueError('nonfinite TEME speed')
    return tuple((CatalogGeodeticPoint(float(np.degrees(lat)),float(np.degrees(lon)),float(h)),float(speed)) for lon,lat,h,speed in zip(longitude,latitude,height,speeds))
