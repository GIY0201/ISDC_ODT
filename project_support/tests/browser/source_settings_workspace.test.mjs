import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [width,height] of [[1280,720],[1920,1080]])test(`real V6 assembly mounts original settings and preserves edits ${width}x${height}`,async()=>{
 const records=new Map(),f=fixture(width,height,{hash:'#settings',storage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}});
 try{
  assert.ok(f.get('source-module-settings'));assert.match(f.get('source-module-settings').innerHTML,/ICD-08/);assert.match(f.get('st-topology').innerHTML,/1320 720/);
  f.get('st-host').value='unsaved.test';await f.get('st-editor').dispatch('input');
  f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');f.evaluate("location.hash='#settings'");await f.win.dispatch('hashchange');
  assert.equal(f.get('st-host').value,'unsaved.test');await f.get('st-save').dispatch('click');assert.match(f.get('st-status').textContent,/반영/);assert.equal(records.has('spacetwin-integration-settings'),false);
  await f.get('st-editor').dispatch('submit');await f.get('st-save').dispatch('click');assert.equal(JSON.parse(records.get('spacetwin-integration-settings')).links.L02.host,'unsaved.test');
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
