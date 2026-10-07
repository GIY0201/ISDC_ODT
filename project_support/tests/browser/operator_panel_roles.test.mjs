import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [removed,proper,ids] of [['satellite','ground',['station-workspace','orbit-radio-series']],['normal','mission',['source-mission-services']],['data','compare',['kpi-workspace']]])test(`source panels have one proper role: ${removed} → ${proper}`,async()=>{
 const f=fixture(1280,720,{hash:'#'+removed});
 try{
  for(const id of ids)assert.ok(!f.doc.getElementById(id)||f.doc.getElementById(id).hidden,`${id} must not duplicate in ${removed}`);
  f.evaluate(`location.hash='#${proper}'`);await f.win.dispatch('hashchange');
  for(const id of ids)assert.ok(f.doc.getElementById(id)&&!f.doc.getElementById(id).hidden,`${id} remains accessible in ${proper}`);
  assert.equal(f.counts().commands,0);
  f.evaluate(`location.hash='#${removed}'`);await f.win.dispatch('hashchange');
  for(const id of ids)assert.ok(!f.doc.getElementById(id)||f.doc.getElementById(id).hidden,`${id} cannot remount in ${removed}`);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
