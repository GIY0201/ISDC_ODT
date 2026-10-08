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
test('technical data reports are collapsed without hiding lifecycle actions',()=>{
 const f=fixture(1280,720,{hash:'#data'});
 try{
  const markup=f.get('source-data-services').innerHTML;
  for(const [id,content] of [['module-details','<div id="dm-module"></div>'],['policy-details','<pre id="dm-policy"></pre>']]){
   const match=markup.match(new RegExp('<details id="dm-'+id+'"[^>]*>([\\s\\S]*?)</details>'));
   assert.ok(match,id+' must be a disclosure');
   assert.ok(match[1].includes(content),id+' retains report content');
   assert.doesNotMatch(match[0],/\bopen\b|<button|<input|<select|<textarea/);
  }
  assert.ok(f.get('dm-refresh'));
  assert.ok(f.get('dm-action-submit'));
  assert.ok(f.get('dm-request-submit'));
 }finally{f.dispose();}
});
