"""Assembly of injected Earth orientation, native propagation and pure geometry."""
from foundation.orbit_time import parse_utc
from digital_twin.contracts.orbit import OrbitCalculation,OrbitSample,OrbitUnavailable
from digital_twin.simulation.orbit_geometry import teme_to_itrf,elevation_deg

def create_orbit_calculation(eop_provider):
    def calculate(orbit,utc,ground_point):
        # Import at use, so an unconfigured legacy app can still start without a wheel.
        try:
            from communication.native.orbit_adapter import propagate
        except (ImportError,OSError) as exc:
            raise OrbitUnavailable('Orbit native calculation module unavailable') from exc
        instants=tuple(parse_utc(t) for t in utc)
        points=tuple(eop_provider.at(t) for t in instants)
        native=propagate(orbit,utc);indices,values=native.valid_rows()
        geometry=teme_to_itrf(values[:,:3],[instants[i] for i in indices],[points[i] for i in indices])
        angles=elevation_deg(geometry.position_m,ground_point)
        valid={index:OrbitSample(utc[index],tuple(float(v) for v in position),float(angle),None) for index,position,angle in zip(indices,geometry.position_m,angles)}
        rows=tuple(valid[i] if i in valid else OrbitSample(t,None,None,native.errors[i]) for i,t in enumerate(utc))
        return OrbitCalculation(rows,eop_provider.eop_sha256,eop_provider.leap_sha256)
    return calculate
