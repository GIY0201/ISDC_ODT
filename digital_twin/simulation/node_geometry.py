"""Static source-node period and request track grid. No orbital propagation or clock."""
from datetime import datetime,timedelta,timezone
import math
from digital_twin.simulation.orbital_elements import EARTH_RADIUS_KM,EARTH_MU_KM3_S2
from foundation.orbit_time import unix_millis_without_leap_seconds,parse_utc_batch


def node_period_minutes(orbit):
    if not isinstance(orbit,dict):raise ValueError('source orbital definition required')
    values=[orbit.get('altitude_km'),orbit.get('eccentricity',0),orbit.get('inclination')]
    if any(type(x) not in (int,float) or not math.isfinite(x) for x in values):raise ValueError('finite source orbital fields required')
    altitude,e,inc=values;a=EARTH_RADIUS_KM+altitude
    if not 0<=e<0.95 or not 0<=inc<=180 or a*(1-e)-EARTH_RADIUS_KM<120 or a*(1+e)-EARTH_RADIUS_KM>200000:
        raise ValueError('source node orbit outside model domain')
    # Source n0 (not J2 corrected mean motion); positive JavaScript Math.round.
    period=2*math.pi/math.sqrt(EARTH_MU_KM3_S2/(a*a*a))/60
    return math.floor(period*1000+0.5)/1000


def node_track_grid(center_utc,period_minutes):
    if type(period_minutes) not in (int,float) or not math.isfinite(period_minutes) or period_minutes<=0:
        raise ValueError('finite positive source period required')
    center=unix_millis_without_leap_seconds(center_utc);step=period_minutes*60000/120
    origin=datetime(1970,1,1,tzinfo=timezone.utc)
    try:
        stamps=[(origin+timedelta(milliseconds=math.trunc(center+(i-60)*step))).isoformat(timespec='milliseconds').replace('+00:00','Z') for i in range(121)]
    except (OverflowError,ValueError) as error:raise ValueError('source track time outside supported calendar') from error
    return parse_utc_batch(stamps)
