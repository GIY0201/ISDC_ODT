import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../../communication/browser/api.js',import.meta.url),'utf8');
const {api,OrbitApiError}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('solar readonly query preserves explicit UTC/body/signal and structured failure',async()=>{
 const original=globalThis.fetch,controller=new AbortController(),payload={client_request_id:'solar',start_utc:'2016-12-31T23:59:60Z',step_seconds:1,count:601};let call;
 try{globalThis.fetch=async(url,options)=>{call={url,options};return new Response(JSON.stringify({frame:'ITRF'}));};
  assert.deepEqual(await api.solarSamples(payload,{signal:controller.signal}),{frame:'ITRF'});
  assert.equal(call.url,'/api/solar/samples');assert.equal(call.options.method,'POST');assert.equal(call.options.cache,'no-store');assert.equal(call.options.signal,controller.signal);assert.deepEqual(JSON.parse(call.options.body),payload);
  globalThis.fetch=async()=>new Response(JSON.stringify({detail:'Solar EOP profile unavailable'}),{status:503});
  await assert.rejects(api.solarSamples(payload),error=>error instanceof OrbitApiError&&error.status===503&&error.message==='Solar EOP profile unavailable');
  controller.abort();globalThis.fetch=async(url,{signal})=>signal.throwIfAborted();
  await assert.rejects(api.solarSamples(payload,{signal:controller.signal}),error=>error.name==='AbortError');
 }finally{globalThis.fetch=original;}
});
