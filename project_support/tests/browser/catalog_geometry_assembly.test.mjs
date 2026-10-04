import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
test('catalog selection uses one globe and restores stored UTC without commands',async()=>{
 const epoch='2026-10-04T01:53:16.268928000Z';
 const f=fixture(1280,720,{hash:'#satellite',satelliteGroups:async()=>({items:[{id:'active',label:'Active'}]}),satellites:async p=>({...p,source:'celestrak-cache',items:[{NORAD_CAT_ID:25544,OBJECT_NAME:'ISS',MEAN_MOTION:15}],count:1,total:1,filtered_total:1}),satelliteProfile:async()=>({source:'gp-cache',catalog:{NORAD_CAT_ID:25544},gp:null}),catalogPosition:async p=>({version:1,status:'valid',...p,name:'ISS',source:'celestrak-cache',utc:epoch,epoch_utc:epoch,frame:'ITRF',profile:'WGS72_AFSPC',position_m:[4000000,5000000,1000000],normalized_gp_sha256:'a'.repeat(64),eop_sha256:'b'.repeat(64),leap_sha256:'c'.repeat(64),eop_kind:'IERS_A',eop_quality:{ut1:'predicted_a',polar_motion:'predicted_a'}})});
 try{
  for(let i=0;i<12;i++)await Promise.resolve();f.flush();const before=f.snapshot();
  await f.get('cat-sat-25544').dispatch('click');for(let i=0;i<12;i++)await Promise.resolve();f.flush();
  assert.equal(f.viewers.length,1);assert.equal(f.viewers[0].clock.currentTime,epoch);assert.match(f.get('cat-position').textContent,/예측 A/);assert.equal(f.counts().commands,0);assert.deepEqual(f.snapshot(),before);
  await f.get('cat-position-clear').dispatch('click');assert.equal(f.viewers[0].clock.currentTime,before.state.current_utc);assert.deepEqual(f.snapshot(),before);
  await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.viewers[0].destroyCount,1);
 }finally{f.dispose();}
});
