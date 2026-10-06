import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [width,height] of [[1280,720],[1920,1080]])test(`V6 source mission console mounts five service kinds ${width}x${height}`,async()=>{const f=fixture(width,height,{hash:'#mission'});try{assert.ok(f.get('source-mission-services'));assert.match(f.get('source-mission-services').innerHTML,/fleet_update/);assert.ok(f.get('ms-plan'));await f.get('ms-plan').dispatch('click');assert.match(f.get('ms-status').textContent,/등록|선택/);await f.win.dispatch('pagehide',{persisted:false});}finally{f.dispose();}});

test('source form preserves invalid and pending fields through V6 screen reconstruction',async()=>{
 const records=new Map(),f=fixture(1280,720,{hash:'#mission',storage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}});
 try{
  f.get('ms-name').value='keep edit';f.get('ms-start').value='2020-07-12T21:16:01Z';f.get('ms-deadline').value='2020-07-12T23:16:01Z';f.get('ms-param-input_mb').value='';await f.get('ms-editor').dispatch('input');await f.get('ms-editor').dispatch('submit');
  assert.match(f.get('ms-status').textContent,/숫자/);assert.equal(records.get('spacetwin-missions-v1'),undefined);
  f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');f.evaluate("location.hash='#mission'");await f.win.dispatch('hashchange');
  assert.equal(f.get('ms-name').value,'keep edit');assert.equal(f.get('ms-param-input_mb').value,'');
  f.get('ms-param-input_mb').value='10';await f.get('ms-editor').dispatch('input');await f.get('ms-editor').dispatch('submit');
  assert.equal(JSON.parse(records.get('spacetwin-missions-v1')).missions[0].params.input_mb,10);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
test('source editor keeps unsaved input after other-window storage changes and blocks stale commands',async()=>{
 const records=new Map(),f=fixture(1280,720,{hash:'#mission',storage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}});
 try{
  f.get('ms-name').value='unsaved';await f.get('ms-editor').dispatch('input');
  await f.win.dispatch('storage',{key:'spacetwin-missions-v1',newValue:'other'});
  assert.equal(f.get('ms-name').value,'unsaved');assert.match(f.get('ms-status').textContent,/다른 창/);assert.equal(f.get('ms-plan').disabled,true);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
