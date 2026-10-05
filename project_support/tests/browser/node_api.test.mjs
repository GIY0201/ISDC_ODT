import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api,OrbitApiError} from '../../../communication/browser/api.js';

test('node transports preserve payload, readonly paths and cancellation signal',async()=>{
 const original=globalThis.fetch;const calls=[];const controller=new AbortController();
 const payload={request_id:'node-1',nodes:[{id:'N-1',orbit:{epoch:1}}],start_utc:'2026-10-04T22:01:12Z',count:3,step_seconds:1};
 const before=JSON.stringify(payload);
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({request_id:'node-1'});};
  assert.equal((await api.nodeSamples(payload,{signal:controller.signal})).request_id,'node-1');
  await api.nodeTrack({request_id:'track',nodes:payload.nodes,center_utc:payload.start_utc},{signal:controller.signal});
  assert.deepEqual(calls.map(c=>c.url),['/api/nodes/samples','/api/nodes/track']);
  for(const c of calls){assert.equal(c.options.method,'POST');assert.equal(c.options.cache,'no-store');assert.equal(c.options.signal,controller.signal);}
  assert.equal(calls[0].options.body,before);assert.equal(JSON.stringify(payload),before);
  controller.abort();globalThis.fetch=async(url,{signal})=>signal.throwIfAborted();
  await assert.rejects(api.nodeSamples(payload,{signal:controller.signal}),e=>e.name==='AbortError');
 }finally{globalThis.fetch=original;}
});

test('node transport surfaces HTTP failures and rejects HTML or malformed JSON',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({detail:'native missing'},{status:503});
  await assert.rejects(api.nodeSamples({}),e=>e instanceof OrbitApiError&&e.status===503&&e.message==='native missing');
  for(const response of [new Response('<html>proxy</html>',{status:200,headers:{'Content-Type':'text/html'}}),new Response('{',{status:502,headers:{'Content-Type':'application/json'}})]){
   globalThis.fetch=async()=>response;
   await assert.rejects(api.nodeTrack({}),e=>e instanceof OrbitApiError&&/응답/.test(e.message));
  }
 }finally{globalThis.fetch=original;}
});
