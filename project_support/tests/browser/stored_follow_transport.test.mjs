// Actual assembled handlers with injected source capability; no native proof claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [width,height] of [[1280,720],[1920,1080]])test(`stored transport follows source and refuses independent UTC ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#satellite'});
 try{
  f.evaluate("globalThis.followControlCalls=[];globalThis.followCapability={running:false,speed:120,play:async()=>{followControlCalls.push('play');followCapability.running=true;},pause:async()=>{followControlCalls.push('pause');followCapability.running=false;},setSpeed:async n=>{followControlCalls.push(['speed',n]);followCapability.speed=n;}};followPorts.source=()=>followCapability;followPorts.locked=()=>true;render();");
  assert.match(f.get('stored-orbit').innerHTML,/<option value="120" selected>/);
  await f.get('orbit-play').dispatch('click');
  const pause=f.get('stored-orbit').innerHTML.match(/<button id="orbit-pause"[^>]*>/)[0];assert.doesNotMatch(pause,/disabled/,'source running state must enable pause');
  await f.get('orbit-pause').dispatch('click');f.get('orbit-rate').value='20';await f.get('orbit-rate').dispatch('change');
  assert.deepEqual(f.evaluate('structuredClone(followControlCalls)'),['play','pause',['speed',20]]);assert.equal(f.counts().commands,0);
  f.get('orbit-utc').value='2026-10-07T00:00:00Z';await f.get('orbit-seek').dispatch('click');assert.match(f.get('stored-orbit').innerHTML,/해제/);assert.equal(f.counts().commands,0);assert.equal(f.evaluate('followControlCalls.length'),3);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
