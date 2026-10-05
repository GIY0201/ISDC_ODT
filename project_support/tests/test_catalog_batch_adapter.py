"""Whole catalogs share one UTC without mixing identities or failure rows."""
import hashlib
import json
from dataclasses import replace
import numpy as np
import pytest
from data.orbit_inputs import load_orbit_input_bytes
from foundation.orbit_time import parse_utc, UtcInstant
from digital_twin.contracts.orbit import EarthOrientationPoint
from project_support.tests.test_catalog_native import OMM


def orbit(number=25544, epoch=OMM['EPOCH']):
    raw=json.dumps(OMM|{'NORAD_CAT_ID':number,'EPOCH':epoch}).encode()
    return load_orbit_input_bytes(raw,format='OMM',source='historical test',
        fetched_utc='2026-10-01T00:00:00Z',expected_sha256=hashlib.sha256(raw).hexdigest())


def test_catalog_adapter_matches_scalar_at_shared_utc_and_owns_results(monkeypatch):
    from communication.native import orbit_adapter as adapter
    records=[orbit(),orbit(25545,'2020-07-11T21:16:01.000416'),orbit()]
    prepared=adapter.prepare_catalog_orbits(records)
    instant=parse_utc('2020-07-12T21:16:01.000416Z')
    # Cached epochs must be used on every subsequent observation.
    monkeypatch.setattr(adapter,'parse_utc',lambda _:pytest.fail('epoch parsed again'))
    batch=adapter.propagate_catalog(prepared,instant)
    assert batch.input_ids==tuple(record.input_id for record in records)
    assert batch.utc==instant.iso_utc and batch.errors==(None,)*3
    monkeypatch.undo()
    for index,record in enumerate(records):
        expected=adapter.propagate(record,[instant.iso_utc]).row(0)
        np.testing.assert_array_equal(batch.row(index),expected)
    records.clear()
    indices,values=batch.valid_rows()
    assert indices==(0,1,2) and values.shape==(3,6)
    with pytest.raises(ValueError):values.setflags(write=True)
    assert adapter.propagate_catalog((),instant).valid_rows()[1].shape==(0,6)


def test_catalog_chunks_preserve_failure_alignment_and_validate_native(monkeypatch):
    from communication.native import orbit_adapter as adapter
    prepared=adapter.prepare_catalog_orbits([orbit(i) for i in range(1,6)])
    calls=[]
    def native(payloads,minutes):
        calls.append((payloads,minutes))
        rows=np.ones((len(payloads),6));errors=[None]*len(payloads)
        if len(calls)==2:rows[0]=np.nan;errors[0]='decayed'
        return rows.astype('<f8').tobytes(),errors
    monkeypatch.setattr(adapter.native,'MAX_CATALOG_BATCH_ROWS',2)
    monkeypatch.setattr(adapter.native,'propagate_omm_many',native)
    batch=adapter.propagate_catalog(prepared,parse_utc(OMM['EPOCH']+'Z'))
    assert [len(p) for p,m in calls]==[2,2,1]
    assert batch.errors==(None,None,'decayed',None,None)
    assert batch.row(2) is None and batch.valid_rows()[0]==(0,1,3,4)
    for result in [(b'',[]),(np.full((2,6),np.nan).tobytes(),[None,None]),
                   (np.ones((2,6)).tobytes(),[False,None])]:
        monkeypatch.setattr(adapter.native,'propagate_omm_many',lambda *args:result)
        with pytest.raises(RuntimeError):adapter.propagate_catalog(prepared,parse_utc(OMM['EPOCH']+'Z'))
    for instant in ['bad',UtcInstant(float('nan'),0)]:
        with pytest.raises(ValueError):adapter.propagate_catalog(prepared,instant)
    for record in [replace(orbit(),profile='WGS84'),replace(orbit(),format='TLE')]:
        with pytest.raises(ValueError):adapter.prepare_catalog_orbits([record])


def test_shared_utc_transform_matches_existing_kernel_and_rejects_bad_inputs():
    from digital_twin.simulation.orbit_geometry import teme_positions_at_utc,teme_to_itrf
    utc=parse_utc('2020-07-12T21:16:01.000416Z')
    eop=EarthOrientationPoint(-.2,1e-6,-2e-6,'a'*64,'b'*64)
    positions=np.array([[7000.,100.,200.],[-123.,7000.,2000.],[7000.,100.,200.]])
    expected=teme_to_itrf(positions,[utc]*3,[eop]*3).position_m
    actual=teme_positions_at_utc(positions,utc,eop)
    np.testing.assert_allclose(actual,expected,rtol=0,atol=1e-8)
    positions[:]=0
    assert np.any(actual) and not actual.flags.writeable
    with pytest.raises(ValueError):actual.setflags(write=True)
    assert teme_positions_at_utc(np.empty((0,3)),utc,eop).shape==(0,3)
    for bad_positions,bad_utc,bad_eop in [([[True,0,0]],utc,eop),([[np.nan,0,0]],utc,eop),
        ([[1,2,3]],'bad',eop),([[1,2,3]],UtcInstant(np.inf,0),eop),
        ([[1,2,3]],utc,replace(eop,xp_rad=np.nan))]:
        with pytest.raises(ValueError):teme_positions_at_utc(bad_positions,bad_utc,bad_eop)
