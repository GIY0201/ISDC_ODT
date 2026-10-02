"""T017 numerical gate for a candidate one-second linear display interpolation.

Fresh Rust propagation at fractional instants is the oracle, not a second
interpolation. This validates the frozen historical ISS/virtual Jeju fixture;
it is not a bound for arbitrary satellites or terrain/RF conditions.
"""
import json
from pathlib import Path
import numpy as np
import pytest
import astropy_iers_data
import isdc_orbit_propagation as native
from astropy.time import Time,TimeDelta
from foundation.orbit_time import UtcInstant
from data.earth_orientation import EarthOrientationSnapshot
from digital_twin.contracts.orbit import GroundPoint
from digital_twin.simulation.orbit_geometry import teme_to_itrf,elevation_deg

L1='1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992'
L2='2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'
SITE=GroundPoint(33.4996,126.5312,0)

@pytest.fixture(scope='module')
def oracle():
    eop=EarthOrientationSnapshot.load(astropy_iers_data.IERS_B_FILE,astropy_iers_data.IERS_LEAP_SECOND_FILE,eop_sha256='31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7',leap_sha256='6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7')
    epoch=Time('2020-07-12T21:16:01.000416',scale='utc',precision=9)
    def calculate(seconds):
        seconds=np.asarray(seconds,dtype=float)
        times=epoch+TimeDelta(seconds,format='sec',scale='tai')
        instants=[UtcInstant(float(a),float(b)) for a,b in zip(times.jd1,times.jd2)]
        minutes=((times.jd1-epoch.jd1)+(times.jd2-epoch.jd2))*1440
        buffer,errors=native.propagate_tle(L1,L2,minutes.tolist())
        assert not any(errors)
        teme=np.frombuffer(buffer,dtype='<f8').reshape(-1,6)[:,:3]
        positions=teme_to_itrf(teme,instants,[eop.at(t) for t in instants]).position_m
        return positions,elevation_deg(positions,SITE)
    return calculate

def test_one_second_fractional_samples_meet_display_gate(oracle):
    # Locate the strongest pass on a ten-minute coarse grid, then cover a
    # continuous ten-minute window around it and the epoch window. Additional
    # samples span the first day; this is deliberately a finite regression.
    grid=np.arange(0,86401,600)
    _,angles=oracle(grid)
    peak=float(grid[np.argmax(angles)])
    start=max(0,min(peak-300,85800))
    bases=np.unique(np.concatenate((np.arange(0,600),np.arange(start,start+600),np.arange(0,86400,3600))))
    fractions=np.array([0,.25,.5,.75,1.])
    positions,elevations=oracle((bases[:,None]+fractions).ravel())
    positions=positions.reshape(-1,5,3);elevations=elevations.reshape(-1,5)
    linear=positions[:,0,None,:]*(1-fractions[None,:,None])+positions[:,-1,None,:]*fractions[None,:,None]
    angle_linear=elevations[:,0,None]*(1-fractions)+elevations[:,-1,None]*fractions
    position_error=float(np.linalg.norm(linear-positions,axis=2).max())
    angle_error=float(np.abs(angle_linear-elevations).max())
    assert position_error<=10
    assert angle_error<=.01
    receipt={'fixture':'historical ISS 2020-07-12 / virtual Jeju','interval_seconds':1,'tested_intervals':len(bases),'fractions':fractions.tolist(),'peak_coarse_utc_offset_seconds':peak,'position_error_m':position_error,'elevation_error_deg':angle_error,'speed_scope':'0.1..60x changes display clock only, not interpolation spacing'}
    destination=Path(__file__).parents[2]/'data/workspace/validation/v6_migration/t017_interpolation.json'
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(receipt,indent=2),encoding='utf-8')

def test_sixty_second_spacing_is_not_implicitly_approved(oracle):
    positions,_=oracle([0,30,60])
    assert np.linalg.norm((positions[0]+positions[2])/2-positions[1])>10
