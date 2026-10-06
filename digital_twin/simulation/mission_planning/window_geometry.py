"""Original mission off-nadir/elevation relation, no orbit propagation."""
import math


def elevation_for_off_nadir(altitude_km,off_nadir_degrees):
    if any(type(v) not in (int,float) or not math.isfinite(v) for v in (altitude_km,off_nadir_degrees)):
        raise ValueError('finite numeric altitude and off-nadir angle required')
    if not 0<=off_nadir_degrees<=90:raise ValueError('off-nadir angle must be0..90deg')
    ratio=(6378.137+max(0,altitude_km))/6378.137*math.sin(max(0,off_nadir_degrees)*math.pi/180)
    return 0.0 if ratio>=1 else math.acos(ratio)*180/math.pi



def line_of_sight_clear(a,b,margin_km=100):
    """Exact source Earth-segment clearance equation, vectors in km."""
    if (not isinstance(a,(list,tuple)) or not isinstance(b,(list,tuple)) or len(a)!=3 or len(b)!=3
        or any(type(v) not in (int,float) or not math.isfinite(v) for v in (*a,*b,margin_km)) or margin_km<0):
        raise ValueError('finite segment vectors and nonnegative margin required')
    d=[y-x for x,y in zip(a,b)];length2=sum(v*v for v in d)
    if not length2>0:return False
    t=max(0,min(1,-sum(x*y for x,y in zip(a,d))/length2))
    return math.hypot(*(x+t*y for x,y in zip(a,d)))>6378.137+margin_km
