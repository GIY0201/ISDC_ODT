import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';

for(const [width,height] of [[1920,1080],[2560,1440]])test(`future pass display remains independent of unavailable current optical network ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#ground'});let panel;
 try{
  const store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');
  const station=store.enabled[0],calls=[];let valid=true,proof=null;
  proof=Object.freeze({presentation_kind:'FUTURE_PASSES_UI_V1',status:'valid',availability:'pending',analysis_utc:'2026-10-07T00:00:00.000000000Z',display_utc:'2026-10-07T00:01:01.000000000Z',end_utc:'2026-10-07T03:00:00.000000000Z',age_seconds:61,station,satellite_count:240,coverage:{resolution_seconds:30,short_intervals_may_be_missed:true},communication_status:'unknown',rows:[{satellite:'A',name:'A<script>',start:'2026-10-07T00:00:00.000000000Z',end:'2026-10-07T00:02:00.000000000Z',peak:'2026-10-07T00:01:00.000000000Z',duration_seconds:120,max_elevation_deg:45,live:true,truncated:false}]});
  const futurePasses={setActive:value=>calls.push(['active',value]),selectStation:id=>calls.push(['station',id]),refresh:()=>{calls.push(['refresh']);},presentation:()=>proof,verifyPresentation:value=>valid&&value===proof,snapshot:()=>({status:'pending',station_id:station.id})};
  panel=createGroundNetworkPanel({store,model,network:{networkSnapshot:()=>null,verifyNetworkSnapshot:()=>false,clearNetwork(){}},futurePasses,document:f.doc,host:f.win,refreshRuntime:async()=>{}});
  panel.show('ground');
  assert.deepEqual(calls,[['active',true]]);
  assert.match(f.get('ground-node-future-pass-results').innerHTML,/A&lt;script&gt;.*45.*120.*현재 통과/s);
  assert.match(f.get('ground-node-future-pass-status').textContent,/240.*30.*RF/s);
  assert.match(f.get('ground-node-future-pass-status').textContent,/61.*갱신 중/s);
  assert.equal(f.get('ground-node-pass-results').innerHTML,'');
  await f.get('ground-node-future-pass-refresh').dispatch('click');
  f.get('ground-node-future-pass-station').value=store.enabled[1].id;
  await f.get('ground-node-future-pass-station').dispatch('change');
  assert.deepEqual(calls.slice(-2),[['refresh'],['station',store.enabled[1].id]]);
  valid=false;panel.update();assert.equal(f.get('ground-node-future-pass-results').innerHTML,'');
  panel.show('satellite');assert.deepEqual(calls.at(-1),['active',false]);
  assert.equal(f.counts().commands,0);
 }finally{panel?.destroy();f.dispose();}
});

test('future pass proof revoked during DOM publication is cleared; disposal during proof verification cannot publish',()=>{
 const f=fixture(1920,1080,{hash:'#ground'});let panel;
 try{
  const store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');const station=store.enabled[0];let checks=0,mode='normal';
  const proof={presentation_kind:'FUTURE_PASSES_UI_V1',status:'valid',availability:'sampled',station,rows:[{satellite:'A',name:'A',start:'s',end:'e',max_elevation_deg:40,duration_seconds:10}],coverage:{resolution_seconds:30},satellite_count:1,age_seconds:0};
  const port={setActive(){},selectStation(){},refresh(){},snapshot:()=>({}),presentation:()=>proof,verifyPresentation(){checks++;if(mode==='dispose'){panel.destroy();return true;}return mode!=='revoke'||checks===1;}};
  panel=createGroundNetworkPanel({store,model,network:{networkSnapshot:()=>null,verifyNetworkSnapshot:()=>false,clearNetwork(){}},futurePasses:port,document:f.doc,host:f.win,refreshRuntime:async()=>{}});
  panel.show('ground');assert.match(f.get('ground-node-future-pass-results').innerHTML,/>A</);
  mode='revoke';checks=0;panel.update();assert.equal(f.get('ground-node-future-pass-results').innerHTML,'');assert.ok(checks>=2);
  mode='dispose';assert.doesNotThrow(()=>panel.update());assert.equal(f.doc.getElementById('ground-node-network')?.isConnected,false);
 }finally{panel?.destroy();f.dispose();}
});

for(const action of ['hide','destroy'])test(`ground activation callback ${action} cannot reactivate future query owner`,()=>{
 const f=fixture(1920,1080,{hash:'#ground'});let panel;
 try{
  const store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');const calls=[];
  const port={setActive:value=>calls.push(value),snapshot:()=>({}),presentation:()=>null,verifyPresentation:()=>false};
  const scene={setActive(value){if(value){if(action==='hide')panel.show('satellite');else panel.destroy();}},clear(){}};
  panel=createGroundNetworkPanel({store,model,network:{networkSnapshot:()=>null,verifyNetworkSnapshot:()=>false,clearNetwork(){}},futurePasses:port,networkScene:scene,document:f.doc,host:f.win,refreshRuntime:async()=>{}});
  panel.show('ground');assert.deepEqual(calls,[false]);if(action==='destroy'){panel.show('ground');assert.deepEqual(calls,[false]);}
 }finally{panel?.destroy();f.dispose();}
});

test('ground reconstruction cancels prior future display without issuing an implicit refresh',()=>{
 const f=fixture(1920,1080,{hash:'#ground'});let panel;
 try{
  const store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');let cancels=0,refreshes=0;
  const port={setActive(){},snapshot:()=>({}),presentation:()=>null,verifyPresentation:()=>false,cancel:()=>{cancels++;},refresh:()=>{refreshes++;}};
  panel=createGroundNetworkPanel({store,model,network:{networkSnapshot:()=>null,verifyNetworkSnapshot:()=>false,clearNetwork(){}},futurePasses:port,document:f.doc,host:f.win,refreshRuntime:async()=>{}});
  panel.show('ground');f.doc.getElementById('screen').innerHTML='';panel.update();
  assert.equal(cancels,1);assert.equal(refreshes,0);assert.ok(f.doc.getElementById('ground-node-future-pass-results'));
 }finally{panel?.destroy();f.dispose();}
});

test('external station conflict observes actual input revocation and retains unsaved editor fields',async()=>{
 const f=fixture(1920,1080,{hash:'#ground'});let panel;
 try{
  const store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');let observed=0;
  const port={setActive(){},snapshot:()=>({}),presentation:()=>null,verifyPresentation:()=>false,observe:()=>{observed++;}};
  panel=createGroundNetworkPanel({store,model,network:{networkSnapshot:()=>null,verifyNetworkSnapshot:()=>false,clearNetwork(){}},futurePasses:port,document:f.doc,host:f.win,refreshRuntime:async()=>{}});
  panel.show('ground');store.select(store.enabled[0].id);await f.get('ground-node-edit').dispatch('click');f.get('ground-node-name').value='UNSAVED';
  const before=observed;await f.win.dispatch('storage',{key:'spacetwin-ground-stations-v1'});
  assert.ok(observed>before);assert.equal(panel.hasExternalChange(),true);assert.equal(f.get('ground-node-name').value,'UNSAVED');
  assert.equal(f.get('ground-node-future-pass-refresh').disabled,true);assert.equal(f.get('ground-node-future-pass-results').innerHTML,'');assert.equal(f.counts().commands,0);
 }finally{panel?.destroy();f.dispose();}
});
