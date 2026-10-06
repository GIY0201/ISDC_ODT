import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [width,height] of [[1280,720],[1920,1080]])test(`V6 data center lifecycle controls ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#data'});
 try{
  assert.match(f.get('source-data-services').innerHTML,/ICD-01/);
  assert.match(f.get('source-data-services').innerHTML,/복구|복제/);
  assert.equal(f.get('dm-action-submit').disabled,true,'unqueried deployment must not authorize operation');
  assert.equal(f.get('dm-request-submit').disabled,true);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
