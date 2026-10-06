import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture as actualWorkspaceFixture} from './workspace_fixture.mjs';

for(const [width,height] of [[1280,720],[1920,1080]])test(`actual V6 binds catalog command continuity without changing display authority ${width}x${height}`,async()=>{
 const f=actualWorkspaceFixture(width,height,{hash:'#satellite'});
 try{
  f.evaluate('globalThis.catalogContinuityEvents=[]; globe.observeDisplayContinuity(event=>catalogContinuityEvents.push(event));');
  const before=f.evaluate('globe.displayContext()');f.evaluate('catalogTimeline.pause()');
  assert.deepEqual(JSON.parse(JSON.stringify(f.evaluate('catalogContinuityEvents'))),[{phase:'invalidated',reason:'pause'},{phase:'settled',reason:'pause'}]);
  assert.deepEqual(f.evaluate('globe.displayContext()'),before);assert.equal(f.evaluate('globe.captureDisplayContinuity()'),null);
  await f.win.dispatch('pagehide',{persisted:false});const count=f.evaluate('catalogContinuityEvents.length');f.evaluate('catalogTimeline.pause()');assert.equal(f.evaluate('catalogContinuityEvents.length'),count);
 }finally{f.dispose();}
});
