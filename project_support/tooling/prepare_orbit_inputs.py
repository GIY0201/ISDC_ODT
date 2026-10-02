"""Preserve historical published ISS example and installed EOP; never download."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json
import astropy_iers_data

L1='1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992'
L2='2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'
SOURCE='https://docs.rs/crate/sgp4/2.4.0/source/examples/tle_afspc.rs'
EOP_HASH='31bb7f67a30f629ad87562cb2b9c22b86e252767cbdda44e40c0afd39b6dccc7'
LEAP_HASH='6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7'

def prepare(destination):
    root=Path(destination);root.mkdir(parents=True,exist_ok=True);manifest=root/'manifest.json'
    if manifest.exists():raise FileExistsError('orbit manifest exists; use a new destination')
    eop=Path(astropy_iers_data.IERS_B_FILE).read_bytes();leap=Path(astropy_iers_data.IERS_LEAP_SECOND_FILE).read_bytes()
    if hashlib.sha256(eop).hexdigest()!=EOP_HASH or hashlib.sha256(leap).hexdigest()!=LEAP_HASH:raise ValueError('installed EOP snapshot differs from validated input')
    omm={'NORAD_CAT_ID':25544,'OBJECT_NAME':'ISS historical validation example','EPOCH':'2020-07-12T21:16:01.000416','MEAN_MOTION':15.49507896,'ECCENTRICITY':.0001413,'INCLINATION':51.6461,'RA_OF_ASC_NODE':221.2784,'ARG_OF_PERICENTER':89.1723,'MEAN_ANOMALY':280.4612,'BSTAR':-.000031515,'MEAN_MOTION_DOT':-.00002218,'MEAN_MOTION_DDOT':0}
    raw={'iss_20200712.tle':(L1+'\n'+L2+'\n').encode(),'iss_20200712_derived_omm.json':json.dumps(omm,indent=2).encode(),'eopc04.1962-now':eop,'Leap_Second.dat':leap}
    if any((root/name).exists() for name in raw):raise FileExistsError('preserved orbit files exist; use a new destination')
    for name,value in raw.items():
        with (root/name).open('xb') as f:f.write(value)
    fetched=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
    entries=[{'file':name,'format':fmt,'sha256':hashlib.sha256(raw[name]).hexdigest(),'source':SOURCE if fmt=='TLE' else 'derived equivalent OMM from '+SOURCE,'fetched_utc':fetched,'historical':True,'epoch_label':'2020-07-12; not current ISS telemetry'} for name,fmt in [('iss_20200712.tle','TLE'),('iss_20200712_derived_omm.json','OMM')]]
    value={'version':1,'inputs':entries,'earth_orientation':{'eop_file':'eopc04.1962-now','eop_sha256':EOP_HASH,'leap_file':'Leap_Second.dat','leap_sha256':LEAP_HASH,'source':'astropy-iers-data 0.2026.9.28.0.59.37 (IERS bundled snapshots)','retrieved_utc':fetched},'station_assumption':{'latitude_deg':33.4996,'longitude_deg':126.5312,'ellipsoid_height_m':0,'virtual':True},'minimum_elevation_deg':10,'communication_status':'unknown','provenance_note':'Preserved published Rust sgp4 2.4.0 example; OMM derived for format equivalence, not independently acquired OMM'}
    with manifest.open('x',encoding='utf-8') as f:json.dump(value,f,indent=2)
    return manifest

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--destination',type=Path,default=Path(__file__).resolve().parents[2]/'data/workspace/inputs/orbit')
    print(prepare(parser.parse_args().destination))
