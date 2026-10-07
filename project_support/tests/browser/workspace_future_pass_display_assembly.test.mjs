import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createFuturePasses} from '../../../user_application/web/scripts/nodes/future_passes.js';

for(const [width,height] of [[1920,1080],[2560,1440]])test(`actual workspace wires native future display to existing input/display owners ${width}x${height}`,async()=>{
 let ports,owner,observed=0,destroyed=0,active=[];
 const f=fixture(width,height,{hash:'#satellite',futurePassesFactory:value=>{
  ports=value;owner=createFuturePasses(value);
  return {...owner,observe:()=>{observed++;return owner.observe();},setActive:value=>{active.push(value);return owner.setActive(value);},destroy:()=>{destroyed++;owner.destroy();}};
 }});
 try{
  assert.ok(ports,'actual root must assemble future display owner');
  assert.equal(ports.inputs,f.evaluate('nodeWorkspace'));
  assert.equal(typeof ports.api.nodeMissionWindows,'function');assert.equal(typeof ports.readDisplay,'function');
  assert.deepEqual(ports.readDisplay(),f.evaluate('globe.displayContext()'));
  f.evaluate('notifyWorkspaceContext()');assert.ok(observed>0);
  f.evaluate("showWorkspaceOrbit('ground')");assert.equal(active.at(-1),true);
  assert.ok(f.doc.getElementById('ground-node-future-pass-refresh'));
  f.evaluate("showWorkspaceOrbit('satellite')");assert.equal(active.at(-1),false);
  assert.equal(f.counts().commands,0);
  await f.win.dispatch('pagehide',{persisted:false});assert.equal(destroyed,1);assert.equal(owner.snapshot().disposed,true);
 }finally{f.dispose();}
});
