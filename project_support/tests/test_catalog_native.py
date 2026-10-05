"""The installed product's additive many-orbit boundary, not a research probe."""
import json
import numpy as np
import pytest
import isdc_orbit_propagation as native

OMM = {'NORAD_CAT_ID':25544,'OBJECT_NAME':'ISS','CLASSIFICATION_TYPE':'U',
       'EPOCH':'2020-07-12T21:16:01.000416','MEAN_MOTION':15.49507896,
       'ECCENTRICITY':.0001413,'INCLINATION':51.6461,'RA_OF_ASC_NODE':221.2784,
       'ARG_OF_PERICENTER':89.1723,'MEAN_ANOMALY':280.4612,'BSTAR':-.000031515,
       'MEAN_MOTION_DOT':-.00002218,'MEAN_MOTION_DDOT':0,'ELEMENT_SET_NO':0,
       'REV_AT_EPOCH':0,'EPHEMERIS_TYPE':0}

def test_many_export_matches_scalar_reordered_rows_and_masks_errors():
    payload=json.dumps(OMM)
    inputs=[payload, 'bad', payload, json.dumps(OMM|{'ECCENTRICITY':2}), payload]
    times=[-10.,0.,10.,0.,-10.]
    buffer,errors=native.propagate_omm_many(inputs,times)
    assert isinstance(buffer,bytes) and len(buffer)==5*48
    assert errors==[None,'invalid OMM',None,'invalid SGP4 elements',None]
    rows=np.frombuffer(buffer,dtype='<f8').reshape(-1,6)
    assert not rows.flags.writeable and np.isnan(rows[[1,3]]).all()
    assert buffer[:48]==buffer[-48:]
    for index in [0,2,4]:
        expected,failed=native.propagate_omm(payload,[times[index]])
        assert not any(failed) and buffer[index*48:(index+1)*48]==expected

def test_many_export_limits_and_existing_scalar_contracts():
    assert native.MAX_CATALOG_BATCH_ROWS==50_000 and native.MAX_BATCH_ROWS==86401
    assert native.calculation_profile=='WGS72_AFSPC'
    assert native.propagate_omm_many([],[])==(b'',[])
    for payloads,times in [(['bad'],[]),([], [0.]),(['bad'],[float('nan')]),(['bad'],[float('inf')]),(['bad']*50001,[0.]*50001)]:
        with pytest.raises(ValueError):native.propagate_omm_many(payloads,times)
