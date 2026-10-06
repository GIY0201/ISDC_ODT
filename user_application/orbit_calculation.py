"""Assembly of injected Earth orientation, native propagation and pure geometry."""
import numpy as np
from foundation.orbit_time import parse_utc_batch,canonical_utc_times,UtcInstant
from digital_twin.contracts.orbit import OrbitCalculation,OrbitSample,OrbitUnavailable,OrbitVectorCalculation,EarthOrientationVector,EarthOrientationPoint
from digital_twin.simulation.orbit_geometry import teme_to_itrf,teme_positions_to_itrf,elevation_deg

def create_orbit_calculation(eop_provider):
    def calculate(orbit,utc,ground_point):
        return calculate_rows(orbit,utc,ground_point)
    def calculate_rows(orbit,utc,ground_point,details=False):
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
        if details:
            from digital_twin.contracts.catalog_details import CatalogDetailSample,CatalogDetailCalculation
            from digital_twin.simulation.catalog_details import catalog_detail_values
            if any(point.snapshot_sha256!=eop_provider.eop_sha256 or point.leap_sha256!=eop_provider.leap_sha256 for point in points):raise ValueError('catalog detail EOP provenance mismatch')
            detail_values=catalog_detail_values(geometry.position_m,values[:,3:])
            valid={index:CatalogDetailSample(utc[index],tuple(float(v) for v in position),float(angle),None,geo,speed) for index,position,angle,(geo,speed) in zip(indices,geometry.position_m,angles,detail_values)}
            rows=tuple(valid[i] if i in valid else CatalogDetailSample(t,None,None,native.errors[i]) for i,t in enumerate(utc))
            return CatalogDetailCalculation(rows,eop_provider.eop_sha256,eop_provider.leap_sha256)
        valid={index:OrbitSample(utc[index],tuple(float(v) for v in position),float(angle),None) for index,position,angle in zip(indices,geometry.position_m,angles)}
        rows=tuple(valid[i] if i in valid else OrbitSample(t,None,None,native.errors[i]) for i,t in enumerate(utc))
        return OrbitCalculation(rows,eop_provider.eop_sha256,eop_provider.leap_sha256)
    calculate.catalog_details=lambda orbit,utc,ground_point:calculate_rows(orbit,utc,ground_point,details=True)
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
    def radio(orbit,utc,ground_point,frequency_hz):
        from digital_twin.contracts.orbit import OrbitRadioCalculation
        from digital_twin.simulation.orbit_radio import radio_geometry,validate_frequency
        try:
            from communication.native.orbit_adapter import propagate_instants
        except (ImportError,OSError) as exc:
            raise OrbitUnavailable('Orbit native calculation module unavailable') from exc
        validate_frequency(frequency_hz)
        instant=parse_utc_batch([utc])[0];point=eop_provider.at(instant)
        if point.snapshot_sha256!=eop_provider.eop_sha256 or point.leap_sha256!=eop_provider.leap_sha256:
            raise ValueError('EOP radio provenance mismatch')
        native=propagate_instants(orbit,[instant]);_,values=native.valid_rows()
        if native.errors[0] is not None:
            return OrbitRadioCalculation(utc,float(frequency_hz),None,None,None,None,None,None,None,native.errors[0],eop_provider.eop_sha256,eop_provider.leap_sha256)
        geometry=teme_to_itrf(values[:,:3],[instant],[point],velocities_km_s=values[:,3:])
        position=tuple(float(x) for x in geometry.position_m[0]);velocity=tuple(float(x) for x in geometry.velocity_m_s[0])
        distance,rate,shift,received=radio_geometry(position,velocity,ground_point,frequency_hz)
        return OrbitRadioCalculation(utc,float(frequency_hz),position,velocity,float(elevation_deg([position],ground_point)[0]),distance,rate,shift,received,None,geometry.eop_sha256,geometry.leap_sha256)
    def radio_series(orbit,start_utc,end_utc,ground_point,frequency_hz):
        from digital_twin.contracts.orbit import OrbitRadioCalculation,OrbitRadioSeriesCalculation
        from digital_twin.simulation.orbit_radio import radio_geometry,validate_frequency,radio_time_grid
        try:
            from communication.native.orbit_adapter import propagate_instants
        except (ImportError,OSError) as exc:
            raise OrbitUnavailable('Orbit native calculation module unavailable') from exc
        validate_frequency(frequency_hz);utc,duration,step=radio_time_grid(start_utc,end_utc)
        instants=parse_utc_batch(utc);lookup=getattr(eop_provider,'at_many',None)
        points=tuple(lookup(instants)) if callable(lookup) else tuple(eop_provider.at(t) for t in instants)
        if len(points)!=len(utc) or any(p.snapshot_sha256!=eop_provider.eop_sha256 or p.leap_sha256!=eop_provider.leap_sha256 for p in points):
            raise ValueError('EOP radio series provenance mismatch')
        native=propagate_instants(orbit,instants);indices,values=native.valid_rows()
        geometry=teme_to_itrf(values[:,:3],[instants[i] for i in indices],[points[i] for i in indices],velocities_km_s=values[:,3:])
        angles=elevation_deg(geometry.position_m,ground_point);valid={}
        for index,position,velocity,angle in zip(indices,geometry.position_m,geometry.velocity_m_s,angles):
            distance,rate,shift,received=radio_geometry(position,velocity,ground_point,frequency_hz)
            valid[index]=OrbitRadioCalculation(utc[index],float(frequency_hz),tuple(float(x) for x in position),tuple(float(x) for x in velocity),float(angle),distance,rate,shift,received,None,eop_provider.eop_sha256,eop_provider.leap_sha256)
        rows=tuple(valid[i] if i in valid else OrbitRadioCalculation(t,float(frequency_hz),None,None,None,None,None,None,None,native.errors[i],eop_provider.eop_sha256,eop_provider.leap_sha256) for i,t in enumerate(utc))
        return OrbitRadioSeriesCalculation(utc[0],utc[-1],duration,step,rows,eop_provider.eop_sha256,eop_provider.leap_sha256)
    radio_series.eop_sha256=eop_provider.eop_sha256
    radio_series.leap_sha256=eop_provider.leap_sha256
    calculate.radio_series=radio_series
    radio.eop_sha256=eop_provider.eop_sha256
    radio.leap_sha256=eop_provider.leap_sha256
    calculate.radio=radio
    calculate.evaluate_times=evaluate_times
    return calculate
