"""Same-epoch geometric one-way Doppler; not measured RF or device tuning.

The displacement/relative-velocity dot product follows the prototype's
oisl.js pointingTo, adapted from inertial km to ITRF SI units. A fixed
ground point has zero ITRF velocity. Optical pointing/LOS is not reused.
"""
import numbers
import numpy as np
from digital_twin.simulation.orbit_geometry import station_itrf

SPEED_OF_LIGHT_M_S=299792458.
MAX_FREQUENCY_HZ=300000000000.

def validate_frequency(frequency_hz):
    if isinstance(frequency_hz,(bool,np.bool_)) or not isinstance(frequency_hz,numbers.Real) or not np.isfinite(frequency_hz) or not 0<frequency_hz<=MAX_FREQUENCY_HZ:
        raise ValueError('finite frequency >0 and <=300GHz required')

def radio_geometry(position_m,velocity_m_s,ground_point,frequency_hz):
    validate_frequency(frequency_hz)
    vectors=[]
    for values in (position_m,velocity_m_s):
        raw=np.asarray(values,dtype=object)
        if raw.shape!=(3,) or any(isinstance(x,(bool,np.bool_)) or not isinstance(x,numbers.Real) for x in raw):raise ValueError('real three-vector required')
        vector=np.asarray(values,dtype=float)
        if not np.isfinite(vector).all():raise ValueError('finite three-vector required')
        vectors.append(vector)
    displacement=vectors[0]-station_itrf(ground_point)
    distance=float(np.linalg.norm(displacement))
    if not np.isfinite(distance) or distance<=0:raise ValueError('satellite and ground point coincident or invalid range')
    rate=float(np.dot(displacement/distance,vectors[1]))
    if not np.isfinite(rate) or abs(rate)>=SPEED_OF_LIGHT_M_S:raise ValueError('invalid first-order range rate')
    shift=-float(frequency_hz)*rate/SPEED_OF_LIGHT_M_S
    return distance,rate,shift,float(frequency_hz)+shift


def validate_radio_calculation(result,utc,ground_point,frequency_hz,profile,calculator):
    """Same strict contract for injected single and batch calculation rows."""
    import re
    import math
    from digital_twin.contracts.orbit import OrbitRadioCalculation
    from digital_twin.simulation.orbit_geometry import elevation_deg
    if not isinstance(result,OrbitRadioCalculation) or result.utc!=utc or result.frequency_hz!=frequency_hz or result.frame!='ITRF' or result.profile!=profile:
        raise RuntimeError('invalid orbit radio contract')
    for key in ('eop_sha256','leap_sha256'):
        expected=getattr(calculator,key,None)
        if not isinstance(expected,str) or re.fullmatch('[a-f0-9]{64}',expected) is None or getattr(result,key)!=expected:
            raise RuntimeError('invalid orbit radio provenance')
    metrics=(result.elevation_deg,result.range_m,result.range_rate_m_s,result.doppler_hz,result.received_frequency_hz)
    if result.error_code is None:
        if (type(result.position_m) is not tuple or type(result.velocity_m_s) is not tuple or len(result.position_m)!=3 or len(result.velocity_m_s)!=3
            or not all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) for x in (*result.position_m,*result.velocity_m_s,*metrics))
            or abs(result.elevation_deg)>90):raise RuntimeError('invalid orbit radio success row')
        expected=radio_geometry(result.position_m,result.velocity_m_s,ground_point,frequency_hz)
        if not all(math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-6) for a,b in zip(metrics[1:],expected)):raise RuntimeError('inconsistent orbit radio metrics')
        if not math.isclose(result.elevation_deg,float(elevation_deg([result.position_m],ground_point)[0]),rel_tol=0,abs_tol=1e-8):
            raise RuntimeError('inconsistent orbit radio elevation')
    elif (not isinstance(result.error_code,str) or not result.error_code or result.position_m is not None or result.velocity_m_s is not None or any(x is not None for x in metrics)):
        raise RuntimeError('invalid orbit radio error row')


def radio_time_grid(start_utc,end_utc):
    """Endpoint-inclusive bounded SI grid; UTC leap seconds remain explicit."""
    import math
    import numpy as np
    from astropy.time import TimeDelta
    from foundation.orbit_time import parse_utc,format_utc_times
    start,end=parse_utc(start_utc),parse_utc(end_utc)
    duration=round(float((end.as_time().tai-start.as_time().tai).sec),9)
    if not 0<duration<=86400:raise ValueError('radio series range must be >0 and <=24h SI')
    count=min(601,math.ceil(duration)+1)
    times=start.as_time()+TimeDelta(np.linspace(0,duration,count),format='sec',scale='tai')
    utc=list(format_utc_times(times.utc));utc[0]=start.iso_utc;utc[-1]=end.iso_utc
    return tuple(utc),duration,duration/(count-1)
