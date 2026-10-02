"""Stored orbit input provenance must survive normalization."""
import hashlib,json
from dataclasses import FrozenInstanceError
import pytest
from data.orbit_inputs import load_orbit_input
from data.earth_orientation import EarthOrientationSnapshot
from foundation.orbit_time import parse_utc
import astropy_iers_data

L1='1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992'
L2='2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'
OMM={'NORAD_CAT_ID':25544,'OBJECT_NAME':'ISS','EPOCH':'2020-07-12T21:16:01.000416','MEAN_MOTION':15.49507896,'ECCENTRICITY':.0001413,'INCLINATION':51.6461,'RA_OF_ASC_NODE':221.2784,'ARG_OF_PERICENTER':89.1723,'MEAN_ANOMALY':280.4612,'BSTAR':-.000031515,'MEAN_MOTION_DOT':-.00002218,'MEAN_MOTION_DDOT':0}

def load(tmp_path,raw,fmt='TLE',checksum=None):
    path=tmp_path/'input.txt';path.write_bytes(raw)
    return load_orbit_input(path,format=fmt,source='historical test fixture',fetched_utc='2026-10-01T00:00:00Z',expected_sha256=checksum or hashlib.sha256(raw).hexdigest())

def test_tle_preserves_raw_hash_epoch_and_immutable_elements(tmp_path):
    raw=(L1+'\n'+L2+'\n').encode()
    record=load(tmp_path,raw)
    assert record.satellite_id==25544 and record.raw_sha256==hashlib.sha256(raw).hexdigest()
    assert record.tle==(L1,L2)
    assert record.epoch_utc.startswith('2020-07-12T21:16:')
    assert record.profile=='WGS72_AFSPC'
    with pytest.raises(FrozenInstanceError):record.source='changed'

def test_hash_and_tle_checksum_are_validated(tmp_path):
    raw=(L1+'\n'+L2).encode()
    with pytest.raises(ValueError,match='hash'):load(tmp_path,raw,checksum='0'*64)
    with pytest.raises(ValueError,match='checksum'):load(tmp_path,raw.replace(b'9992',b'9993'))

def test_omm_defaults_are_explicit_and_not_source_mutation(tmp_path):
    record=load(tmp_path,json.dumps(OMM).encode(),'OMM')
    assert dict(record.defaults)=={'CENTER_NAME':'EARTH','REF_FRAME':'TEME','TIME_SYSTEM':'UTC','MEAN_ELEMENT_THEORY':'SGP4'}
    assert record.satellite_id==25544 and dict(record.elements)['MEAN_MOTION']==15.49507896
    assert 'CENTER_NAME' not in OMM

@pytest.mark.parametrize('update',[{'REF_FRAME':'J2000'},{'CENTER_NAME':'MARS'},{'ECCENTRICITY':1.2},{'BSTAR':float('nan')},{'EPOCH':'not a date'},{'NORAD_CAT_ID':True}])
def test_unsupported_or_invalid_omm_is_rejected(tmp_path,update):
    with pytest.raises(ValueError):load(tmp_path,json.dumps(OMM|update).encode(),'OMM')

def test_eop_snapshot_hash_range_and_leap_corrected_values():
    snapshot=EarthOrientationSnapshot.load(astropy_iers_data.IERS_B_FILE,astropy_iers_data.IERS_LEAP_SECOND_FILE,eop_sha256='31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7',leap_sha256='6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7')
    before=snapshot.at(parse_utc('2016-12-31T23:59:59Z'))
    after=snapshot.at(parse_utc('2017-01-01T00:00:00Z'))
    assert .999<after.ut1_minus_utc_s-before.ut1_minus_utc_s<1.001
    with pytest.raises(ValueError,match='range'):snapshot.at(parse_utc('2100-01-01T00:00:00Z'))
    with pytest.raises(ValueError,match='hash'):EarthOrientationSnapshot.load(astropy_iers_data.IERS_B_FILE,astropy_iers_data.IERS_LEAP_SECOND_FILE,eop_sha256='0'*64,leap_sha256='0'*64)

@pytest.mark.parametrize('key',['EPOCH','NORAD_CAT_ID','MEAN_MOTION','BSTAR'])
def test_missing_omm_element_has_a_domain_error(tmp_path,key):
    payload=OMM.copy();payload.pop(key)
    with pytest.raises(ValueError,match='required'):load(tmp_path,json.dumps(payload).encode(),'OMM')
