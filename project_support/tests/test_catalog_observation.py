import numpy as np
import pytest
from digital_twin.contracts.orbit import GroundPoint
from digital_twin.simulation.orbit_geometry import station_itrf,observation_geometry

def test_reference_enu_ranges_azimuth_and_zenith_unknown():
 site=GroundPoint(0,0,0);origin=station_itrf(site)
 result=observation_geometry(origin+np.array([[1000,0,0],[0,1000,0],[0,0,1000],[0,-1000,0]]),site)
 assert result==((1000.,None),(1000.,90.),(1000.,0.),(1000.,270.))
 with pytest.raises(ValueError):observation_geometry([origin],site)
