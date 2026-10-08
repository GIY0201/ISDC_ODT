import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [width,height] of [[1280,720],[1920,1080]])test(`actual V6 ground source editor adds and edits independently of GP selection ${width}x${height}`,async()=>{
 const records=new Map();const storage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
 const f=fixture(width,height,{hash:'#ground',storage});
 try{
  assert.ok(f.get('ground-node-network'));const before=f.snapshot();
  f.get('ground-node-preset').value='custom';await f.get('ground-node-add').dispatch('click');
  assert.equal(f.get('ground-node-name').value,'지상국 1');f.get('ground-node-name').value='내 지상국';
  f.get('ground-node-latitude').value='34.6';f.get('ground-node-longitude').value='127.2';
  await f.get('ground-node-editor').dispatch('submit');
  const saved=JSON.parse(records.get('spacetwin-ground-stations-v1'));assert.equal(saved.stations.length,4);
  assert.equal(saved.stations.at(-1).name,'내 지상국');assert.equal(saved.stations.at(-1).latitude,34.6);
  assert.deepEqual(f.snapshot(),before);assert.equal(f.counts().commands,0);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
test('ground editor preserves invalid input and quota failures without claiming saved',async()=>{
 let bytes=null,fail=false;const f=fixture(1280,720,{hash:'#ground',storage:{getItem:()=>bytes,setItem:(_,next)=>{if(fail)throw Error('quota');bytes=next;}}});
 try{
  f.get('ground-node-preset').value='custom';await f.get('ground-node-add').dispatch('click');const saved=bytes;
  f.get('ground-node-latitude').value='';await f.get('ground-node-editor').dispatch('submit');
  assert.equal(bytes,saved);assert.match(f.get('ground-node-status').textContent,/숫자/);assert.equal(f.get('ground-node-latitude').value,'');
  f.get('ground-node-latitude').value='35';f.get('ground-node-name').value='pending edit';fail=true;
  await f.get('ground-node-editor').dispatch('submit');assert.equal(bytes,saved);
  assert.equal(f.get('ground-node-name').value,'pending edit');assert.match(f.get('ground-node-status').textContent,/저장 실패/);
  assert.equal(f.get('ground-node-editor').hidden,false);await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
test('source ground external event preserves pending editor and blocks stale input',async()=>{
 const records=new Map();const f=fixture(1280,720,{hash:'#ground',storage:{getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)}});
 try{
  f.get('ground-node-preset').value='custom';await f.get('ground-node-add').dispatch('click');
  f.get('ground-node-name').value='pending';const saved=JSON.parse(records.get('spacetwin-ground-stations-v1'));saved.stations[0].name='Other window';records.set('spacetwin-ground-stations-v1',JSON.stringify(saved));
  await f.win.dispatch('storage',{key:'spacetwin-ground-stations-v1',newValue:records.get('spacetwin-ground-stations-v1')});
  assert.equal(f.get('ground-node-name').value,'pending');assert.match(f.get('ground-node-status').textContent,/다른 창/);
  await f.get('ground-node-editor').dispatch('submit');assert.equal(JSON.parse(records.get('spacetwin-ground-stations-v1')).stations.at(-1).name,'지상국 1');
  assert.equal(f.get('ground-node-editor').hidden,false);await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
test('actual ground assembly rejects unknown SIM input instead of inventing empty faults',async()=>{
 const f=fixture(1280,720,{hash:'#ground'});
 try{await f.get('ground-node-calculate').dispatch('click');assert.match(f.get('ground-node-status').textContent,/SIM|상태|미확인|오류/);assert.equal(f.get('ground-node-results').textContent,'');assert.equal(f.counts().commands,0);await f.win.dispatch('pagehide',{persisted:false});}finally{f.dispose();}
});

test('ground pending fields survive actual V6 screen reconstruction without saving',async()=>{
 const records=new Map();const f=fixture(1280,720,{hash:'#ground',storage:{getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)}});
 try{
  f.get('ground-node-preset').value='custom';await f.get('ground-node-add').dispatch('click');
  f.get('ground-node-name').value='unsaved ground';f.get('ground-node-latitude').value='';f.get('ground-node-band-X').checked=false;
  const bytes=records.get('spacetwin-ground-stations-v1'),old=f.get('ground-node-network');
  f.evaluate("location.hash='#satellite'");await f.win.dispatch('hashchange');
  f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');
  assert.notEqual(f.get('ground-node-network'),old);
  assert.equal(f.get('ground-node-editor').hidden,false);assert.equal(f.get('ground-node-name').value,'unsaved ground');
  assert.equal(f.get('ground-node-latitude').value,'');assert.equal(f.get('ground-node-band-X').checked,false);
  assert.equal(records.get('spacetwin-ground-stations-v1'),bytes);assert.equal(f.counts().commands,0);
 }finally{f.dispose();}
});

for(const [width,height] of [[1280,720],[1920,1080]])test(`V6 fabric actions require verified input and never automatically send ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#ground'});
 try{
  assert.ok(f.get('ground-node-fabric-send'));assert.equal(f.get('ground-node-fabric-send').disabled,true);
  assert.ok(f.get('ground-node-fabric-refresh'));assert.ok(f.get('ground-node-fabric-route'));
  assert.equal(f.get('ground-node-fabric-route').disabled,true);assert.match(f.get('ground-node-fabric-status').textContent,/미확인|미전송/);
  const before=f.snapshot();await f.get('ground-node-fabric-send').dispatch('click');assert.deepEqual(f.snapshot(),before);assert.equal(f.counts().commands,0);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});

test('ground station browser joins the existing network panel without duplicating controls',()=>{const f=fixture(1280,720,{hash:'#ground'});try{assert.equal(f.get('station-workspace').parentElement,f.get('ground-node-station-browser'));assert.ok(f.get('station-select'));assert.equal(f.get('screen').children.includes(f.get('station-workspace')),false);}finally{f.dispose();}});

import {groundNetworkSummaryMarkup} from '../../../user_application/web/scripts/tabs/ground_network.js';
test('ground overview labels satellite versus ground counts and puts approximation details behind disclosure',()=>{const html=groundNetworkSummaryMarkup({utc:'2026-10-07T11:00:00.000000000Z',network:{nodes:[{kind:'satellite'},{kind:'ground'},{kind:'ground'}],links:[{}]}});assert.match(html,/표시 위성<\/span><strong>1/);assert.match(html,/지상국<\/span><strong>2/);assert.match(html,/计算连接|계산 연결/);assert.match(html,/<time[^>]+>2026-10-07 11:00:00 UTC/);assert.match(html,/<details[\s\S]*GMST/);assert.match(html,/모든 활성 지상국 간 연결 가정/);});
