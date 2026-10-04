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
