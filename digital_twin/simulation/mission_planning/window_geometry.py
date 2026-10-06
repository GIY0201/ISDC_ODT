"""Original mission off-nadir/elevation relation, no orbit propagation."""
import math


def elevation_for_off_nadir(altitude_km,off_nadir_degrees):
    if any(type(v) not in (int,float) or not math.isfinite(v) for v in (altitude_km,off_nadir_degrees)):
        raise ValueError('finite numeric altitude and off-nadir angle required')
    if not 0<=off_nadir_degrees<=90:raise ValueError('off-nadir angle must be0..90deg')
    ratio=(6378.137+max(0,altitude_km))/6378.137*math.sin(max(0,off_nadir_degrees)*math.pi/180)
    return 0.0 if ratio>=1 else math.acos(ratio)*180/math.pi
