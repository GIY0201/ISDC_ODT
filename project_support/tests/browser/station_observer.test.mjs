import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {GROUND_STATIONS} from '../../../digital_twin/model_library/browser/ground_station_sites.js';
import vm from 'node:vm';
for(const [w,h] of [[1280,720],[1920,1080]])test(`station explicit draft preserves height UTC and applies via existing workflow ${w}x${h}`,async()=>{
 const f=fixture(w,h,{hash:'#ground'});try{
  const before=f.snapshot();
  for(const [id,value] of [['ground-height','123.45'],['visibility-start','2020-07-12T21:16:01.000416000Z'],['visibility-end','2020-07-12T21:17:01.000416000Z']]){f.get(id).value=value;await f.get(id).dispatch('input');}
  f.get('station-select').value='DAEJEON';await f.get('station-select').dispatch('change');
  assert.equal(f.doc.getElementById('station-use').disabled,false);
  await f.get('station-use').dispatch('click');
  assert.equal(f.get('ground-lat').value,'36.3742');assert.equal(f.get('ground-lon').value,'127.3567');assert.equal(f.get('ground-angle').value,'5');assert.equal(f.get('ground-height').value,'123.45');
  assert.equal(f.get('visibility-end').value,'2020-07-12T21:17:01.000416000Z');assert.deepEqual(f.snapshot(),before);assert.equal(f.counts().commands,0);assert.match(f.get('visibility-status').textContent,/高さ|높이/);
  await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.get('ground-height').value,'123.45');
  await f.get('visibility-query').dispatch('click');assert.equal(f.counts().commands,1);
  assert.equal(f.snapshot().state.input_id,before.state.input_id);assert.equal(f.snapshot().state.current_utc,before.state.current_utc);assert.equal(f.snapshot().state.ground_point.latitude_deg,36.3742);assert.equal(f.snapshot().state.ground_point.ellipsoid_height_m,123.45);assert.equal(f.snapshot().state.minimum_elevation_deg,5);
  assert.match(f.get('visibility-result').innerHTML,/実際|실제 통신 미확인/);assert.equal(f.viewers.length,1);
 }finally{f.dispose();}
});
test('invalid presets preserve draft and direct handoff stages before ground panel exists',async()=>{
 const f=fixture(1280,720,{hash:'#satellite'});try{
  f.context.testSite={...GROUND_STATIONS.DAEJEON,latitude:NaN};assert.equal(vm.runInContext('groundPanel.stageStation(testSite)',f.context),false);
  assert.equal(f.doc.getElementById('station-workspace'),null);f.context.testSite=GROUND_STATIONS.SVALBARD;assert.equal(vm.runInContext('groundPanel.stageStation(testSite)',f.context),true);f.context.location.hash='#ground';await f.win.dispatch('hashchange');
  assert.equal(f.get('ground-lat').value,'78.2298');assert.equal(f.get('ground-angle').value,'3');assert.equal(f.get('ground-height').value,'0');assert.equal(f.counts().commands,0);
 }finally{f.dispose();}
});
test('missing stored selection requests selection first and disposed panel refuses staging',async()=>{
 const f=fixture();try{
  f.context.testSite=GROUND_STATIONS.DAEJEON;f.context.testSnapshot=f.snapshot();f.context.testSnapshot.state.input_id=null;
  vm.runInContext('client.snapshot=()=>structuredClone(testSnapshot)',f.context);
  assert.equal(vm.runInContext('groundPanel.stageStation(testSite)',f.context),false);assert.match(f.get('visibility-status').textContent,/먼저 선택/);assert.equal(f.get('ground-lat').value,'33.4996');
  await f.win.dispatch('pagehide',{persisted:false});assert.equal(vm.runInContext('groundPanel.stageStation(testSite)',f.context),false);
 }finally{f.dispose();}
});
test('busy application refuses replacement and a failed apply stays visible',async()=>{
 let reject;const f=fixture(1280,720,{hash:'#ground',setGround:()=>new Promise((_,r)=>{reject=r;})});try{
  f.context.testSite=GROUND_STATIONS.DAEJEON;vm.runInContext('groundPanel.stageStation(testSite)',f.context);
  const pending=f.get('ground-apply').dispatch('click');
  f.context.testSite=GROUND_STATIONS.SVALBARD;assert.equal(vm.runInContext('groundPanel.stageStation(testSite)',f.context),false);
  assert.equal(f.get('ground-lat').value,'36.3742');reject(Error('observer apply failed'));await pending;
  assert.match(f.get('visibility-status').textContent,/observer apply failed/);assert.equal(f.snapshot().state.ground_point.latitude_deg,33.4996);
 }finally{f.dispose();}
});
test('staging invalidates old intervals without commands and clearing map selection does not undo applied point',async()=>{
 const f=fixture();try{
  await f.get('visibility-query').dispatch('click');assert.match(f.get('visibility-result').innerHTML,/가시 구간 없음/);
  f.context.testSite=GROUND_STATIONS.DAEJEON;vm.runInContext('groundPanel.stageStation(testSite)',f.context);assert.equal(f.get('visibility-result').innerHTML,'');assert.equal(f.counts().commands,0);
  await f.get('ground-apply').dispatch('click');const applied=f.snapshot();await f.get('station-clear').dispatch('click');assert.deepEqual(f.snapshot(),applied);
 }finally{f.dispose();}
});
