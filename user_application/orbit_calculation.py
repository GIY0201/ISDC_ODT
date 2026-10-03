"""Assembly of injected Earth orientation, native propagation and pure geometry."""
import numpy as np
from foundation.orbit_time import parse_utc_batch,canonical_utc_times,UtcInstant
from digital_twin.contracts.orbit import OrbitCalculation,OrbitSample,OrbitUnavailable,OrbitVectorCalculation,EarthOrientationVector,EarthOrientationPoint
from digital_twin.simulation.orbit_geometry import teme_to_itrf,teme_positions_to_itrf,elevation_deg

def create_orbit_calculation(eop_provider):
    def calculate(orbit,utc,ground_point):
        # Import at use, so an unconfigured legacy app can still start without a wheel.
        try:
            from communication.native.orbit_adapter import propagate_instants
        except (ImportError,OSError) as exc:
            raise OrbitUnavailable('Orbit native calculation module unavailable') from exc
        if isinstance(utc,(str,bytes)):raise ValueError('one-dimensional UTC sequence required')
        utc=tuple(utc)
        instants=parse_utc_batch(utc)
        batch_lookup=getattr(eop_provider,'at_many',None)
        points=tuple(batch_lookup(instants)) if callable(batch_lookup) else tuple(eop_provider.at(t) for t in instants)
        native=propagate_instants(orbit,instants);indices,values=native.valid_rows()
        geometry=teme_to_itrf(values[:,:3],[instants[i] for i in indices],[points[i] for i in indices])
        angles=elevation_deg(geometry.position_m,ground_point)
        valid={index:OrbitSample(utc[index],tuple(float(v) for v in position),float(angle),None) for index,position,angle in zip(indices,geometry.position_m,angles)}
        rows=tuple(valid[i] if i in valid else OrbitSample(t,None,None,native.errors[i]) for i,t in enumerate(utc))
        return OrbitCalculation(rows,eop_provider.eop_sha256,eop_provider.leap_sha256)
    def evaluate_times(orbit,times,ground_point):
        try:
            from communication.native.orbit_adapter import propagate_times
        except (ImportError,OSError) as exc:
            raise OrbitUnavailable('Orbit native calculation module unavailable') from exc
        times=canonical_utc_times(times)
        lookup=getattr(eop_provider,'at_times',None)
        if callable(lookup):points=lookup(times)
        else:
            instants=tuple(UtcInstant(float(a),float(b)) for a,b in zip(times.jd1,times.jd2))
            batch_lookup=getattr(eop_provider,'at_many',None)
            scalar=tuple(batch_lookup(instants)) if callable(batch_lookup) else tuple(eop_provider.at(t) for t in instants)
            if any(not isinstance(p,EarthOrientationPoint) or p.snapshot_sha256!=eop_provider.eop_sha256
                   or p.leap_sha256!=eop_provider.leap_sha256 for p in scalar):
                raise ValueError('EOP scalar fallback provenance mismatch')
            points=EarthOrientationVector([p.ut1_minus_utc_s for p in scalar],[p.xp_rad for p in scalar],
                [p.yp_rad for p in scalar],eop_provider.eop_sha256,eop_provider.leap_sha256)
        if not isinstance(points,EarthOrientationVector) or (
            points.snapshot_sha256!=eop_provider.eop_sha256 or points.leap_sha256!=eop_provider.leap_sha256):
            raise ValueError('EOP vector provenance mismatch')
        if len(points.ut1_minus_utc_s)!=len(times):raise ValueError('EOP vector row count mismatch')
        values,errors=propagate_times(orbit,times)
        valid=np.array([e is None for e in errors],dtype=bool)
        valid_eop=EarthOrientationVector(points.ut1_minus_utc_s[valid],points.xp_rad[valid],points.yp_rad[valid],
                                       points.snapshot_sha256,points.leap_sha256)
        positions=np.full((len(times),3),np.nan);angles=np.full(len(times),np.nan)
        positions[valid]=teme_positions_to_itrf(values[valid,:3],times[valid],valid_eop)
        angles[valid]=elevation_deg(positions[valid],ground_point)
        return OrbitVectorCalculation(times.jd1,times.jd2,positions,angles,errors,eop_provider.eop_sha256,eop_provider.leap_sha256)
    calculate.evaluate_times=evaluate_times
    return calculate
