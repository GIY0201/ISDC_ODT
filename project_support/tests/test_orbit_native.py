import pathlib, tomllib
import numpy as np
import pytest
import isdc_orbit_propagation as native

FIXTURE=pathlib.Path(__file__).parent/'fixtures/orbit/sgp4_test_cases.toml'

def test_official_states_and_row_errors():
    cases=tomllib.loads(FIXTURE.read_text(encoding="utf-8"))['list']
    count=0
    for case in cases:
        states=case['states']
        buf, errors=native.propagate_tle(case['line1'],case['line2'],[s['time'] for s in states])
        rows=np.frombuffer(buf,dtype='<f8').reshape(-1,6)
        assert not rows.flags.writeable
        for index,state in enumerate(states):
            if 'error' in state:
                assert errors[index] == state['error']
                assert np.isnan(rows[index]).all()
            else:
                assert errors[index] is None
                np.testing.assert_allclose(rows[index,:3],state['position'],rtol=0,atol=1e-6)
                np.testing.assert_allclose(rows[index,3:],state['velocity'],rtol=0,atol=1e-9)
            count+=1
    assert len(cases)==33 and count==668

def test_order_owned_buffer_and_validation():
    case=tomllib.loads(FIXTURE.read_text(encoding="utf-8"))['list'][0]
    times=[1.,-1.,1.,0.]
    first,errors=native.propagate_tle(case['line1'],case['line2'],times)
    times.clear()
    second,_=native.propagate_tle(case['line1'],case['line2'],[0.])
    assert isinstance(first,bytes) and len(first)==192 and not any(errors)
    assert first[:48]==first[96:144] and first[-48:]==second
    for bad in ([float('nan')],[float('inf')],[0.]*86402):
        with pytest.raises(ValueError): native.propagate_tle(case['line1'],case['line2'],bad)
    with pytest.raises(ValueError): native.propagate_tle('bad','bad',[0.])
    assert native.propagate_tle(case['line1'],case['line2'],[])==(b'',[])

def test_tle_omm_adapter_and_immutable_batch(tmp_path):
    import json, hashlib
    from dataclasses import replace,FrozenInstanceError
    from data.orbit_inputs import load_orbit_input
    from communication.native.orbit_adapter import propagate
    l1='1 25544U 98067A   20194.88612269 -.00002218  00000-0 -31515-4 0  9992'
    l2='2 25544  51.6461 221.2784 0001413  89.1723 280.4612 15.49507896236008'
    omm={'NORAD_CAT_ID':25544,'EPOCH':'2020-07-12T21:16:01.000416','MEAN_MOTION':15.49507896,'ECCENTRICITY':.0001413,'INCLINATION':51.6461,'RA_OF_ASC_NODE':221.2784,'ARG_OF_PERICENTER':89.1723,'MEAN_ANOMALY':280.4612,'BSTAR':-.000031515,'MEAN_MOTION_DOT':-.00002218,'MEAN_MOTION_DDOT':0}
    records=[]
    for fmt,raw in [('TLE',(l1+'\n'+l2).encode()),('OMM',json.dumps(omm).encode())]:
        path=tmp_path/fmt;path.write_bytes(raw)
        records.append(load_orbit_input(path,format=fmt,source='historical test',fetched_utc='2026-10-01T00:00:00Z',expected_sha256=hashlib.sha256(raw).hexdigest()))
    times=['2020-07-12T21:16:01.000416Z','2020-07-11T21:16:01.000416Z','2020-07-13T21:16:01.000416Z']
    a,b=[propagate(record,times) for record in records]
    for i in range(3):np.testing.assert_allclose(a.row(i),b.row(i),rtol=0,atol=1e-9)
    indices,values=a.valid_rows()
    assert indices==(0,1,2) and not values.flags.writeable
    with pytest.raises(ValueError):values.setflags(write=True)
    with pytest.raises(FrozenInstanceError):a.input_id='changed'
    with pytest.raises(ValueError):propagate(replace(records[0],profile='WGS84'),times)
    with pytest.raises(ValueError):propagate(records[0],times[0])
    with pytest.raises(ValueError):propagate(records[0],[['bad']])
    assert propagate(records[0],[]).valid_rows()[1].shape==(0,6)

def test_adapter_masks_failed_rows(tmp_path):
    import hashlib
    from data.orbit_inputs import load_orbit_input
    from communication.native.orbit_adapter import propagate
    from foundation.orbit_time import parse_utc,advance_seconds
    cases=tomllib.loads(FIXTURE.read_text(encoding="utf-8"))['list']
    case=next(case for case in cases if any('error' in s for s in case['states']) and any('position' in s for s in case['states']))
    raw=(case['line1'][:69]+'\n'+case['line2'][:69]).encode()
    path=tmp_path/'orbit';path.write_bytes(raw)
    orbit=load_orbit_input(path,format='TLE',source='SGP4 verification case',fetched_utc='2026-10-01T00:00:00Z',expected_sha256=hashlib.sha256(raw).hexdigest())
    failed=next(s for s in case['states'] if 'error' in s)
    valid=next(s for s in case['states'] if 'position' in s)
    epoch=parse_utc(orbit.epoch_utc)
    result=propagate(orbit,[advance_seconds(epoch,s['time']*60).iso_utc for s in [failed,valid]])
    assert result.row(0) is None and result.errors[0]==failed['error']
    assert result.row(1) is not None and result.errors[1] is None
    indices,values=result.valid_rows()
    assert indices==(1,) and values.shape==(1,6) and np.isfinite(values).all()
