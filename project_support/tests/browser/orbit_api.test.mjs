import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../../communication/browser/api.js',import.meta.url),'utf8');
const { api, OrbitApiError } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('orbit requests preserve body, method and cancellation signal', async () => {
  const calls=[];const controller=new AbortController();
  globalThis.fetch=async (url,options)=>{calls.push({url,options});return new Response(JSON.stringify({revision:2}),{status:200});};
  const payload={client_request_id:'request',expected_revision:1,input_id:'ISS'};
  assert.deepEqual(await api.selectOrbit(payload,{signal:controller.signal}),{revision:2});
  await api.orbitSamples({client_request_id:'samples'},{signal:controller.signal});
  await api.orbitInputs();await api.orbitState();
  assert.equal(calls[0].url,'/api/orbit/selection');assert.equal(calls[0].options.method,'PUT');
  assert.equal(calls[0].options.signal,controller.signal);assert.deepEqual(JSON.parse(calls[0].options.body),payload);
  assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.signal,controller.signal);
  assert.equal(calls[2].url,'/api/orbit/inputs');assert.equal(calls[3].url,'/api/orbit/state');
});

test('revision conflict exposes HTTP status, error code and current state', async () => {
  const state={revision:8};
  globalThis.fetch=async()=>new Response(JSON.stringify({detail:{code:'revision_conflict',message:'conflict',state}}),{status:409});
  await assert.rejects(api.selectOrbit({}),error=>error instanceof OrbitApiError && error.status===409 && error.code==='revision_conflict' && error.state.revision===8);
});

test('abort remains an abort instead of a successful response', async () => {
  const controller=new AbortController();controller.abort();
  globalThis.fetch=async(url,{signal})=>{signal.throwIfAborted();};
  await assert.rejects(api.orbitSamples({}, {signal:controller.signal}),error=>error.name==='AbortError');
});

test('visibility POST preserves query and abort signal',async()=>{let request;globalThis.fetch=async(url,options)=>{request={url,options};return new Response('{}');};const controller=new AbortController(),body={selection_revision:2,start_utc:'start',end_utc:'end'};await api.orbitVisibility(body,{signal:controller.signal});assert.equal(request.url,'/api/orbit/visibility');assert.equal(request.options.method,'POST');assert.deepEqual(JSON.parse(request.options.body),body);assert.equal(request.options.signal,controller.signal);});
