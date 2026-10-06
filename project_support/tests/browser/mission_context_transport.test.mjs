import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../../../communication/browser/api.js';
test('native mission approval transport sends exact body, signal and context header',async()=>{
 const previous=globalThis.fetch,calls=[],controller=new AbortController();
 globalThis.fetch=async(path,options)=>{calls.push({path,options});return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});};
 try{
  await api.nodeMissionContext({request_id:'scope'},{signal:controller.signal});
  await api.nodeMissionWindows({request_id:'windows'},{signal:controller.signal,contextHash:'a'.repeat(64)});
  assert.equal(calls[0].path,'/api/nodes/mission-context');assert.equal(calls[0].options.body,'{"request_id":"scope"}');assert.equal(calls[0].options.signal,controller.signal);
  assert.equal(calls[1].options.headers['X-ISDC-Mission-Context'],'a'.repeat(64));
 }finally{globalThis.fetch=previous;}
});
