import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const fabricUrl = new URL('communication/browser/data_fabric.js', root).href;
const source = (await readFile(new URL('communication/browser/orchestration.js', root), 'utf8')).replace('/static/communication/data_fabric.js', fabricUrl);
const { ORCHESTRATION_LINK_ID, createOrchestrationClient, resolveEndpoint } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const storageWith = value => ({ getItem: key => (key === 'spacetwin-integration-settings' && value != null ? JSON.stringify(value) : null) });

test('the endpoint is this server unless link L03 points elsewhere', () => {
  assert.equal(ORCHESTRATION_LINK_ID, 'L03');
  assert.deepEqual(resolveEndpoint({ storage: null }), { base: '', placement: 'server', source: 'server' });
  assert.deepEqual(resolveEndpoint({ storage: storageWith({ links: { L03: { host: '10.0.0.9', port: 5103 } } }) }), { base: 'http://10.0.0.9:5103', placement: 'remote', source: 'settings' });
  assert.equal(resolveEndpoint({ storage: storageWith({ links: { L02: { host: '10.0.0.9', port: 5102 } } }) }).placement, 'server', 'the fabric link does not move the orchestration endpoint');
});

test('plan posts the request and errors are typed', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/status')) return { ok: true, status: 200, json: async () => ({ placement: 'embedded' }) };
    if (url.endsWith('/plan') && JSON.parse(options.body).mission.kind === 'nap') return { ok: false, status: 422, json: async () => ({ detail: [{ msg: 'kind must be observe' }] }) };
    if (url.endsWith('/plan')) return { ok: false, status: 503, json: async () => ({ detail: '모듈 응답 없음' }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const client = createOrchestrationClient({ fetchImpl, storage: null });
  assert.deepEqual(await client.status(), { placement: 'embedded' });
  await assert.rejects(client.plan({ time: 't', mission: { kind: 'nap' } }), error => error.status === 422 && error.message === 'kind must be observe');
  await assert.rejects(client.plan({ time: 't', mission: { kind: 'observe' } }), error => error.unavailable === true);
  assert.equal(calls[1].url, '/api/orchestration/plan');
  assert.equal(calls[1].options.method, 'POST');
});


const ctx='a'.repeat(64), guard=()=>({instance_id:'one',expected_sequence:0,request_id:'window:1',context_hash:ctx,mission_version:1});
const body=()=>({time:'2026-09-08T00:00:00Z',mission:{id:'MSN-1',kind:'observe'}});
const status={exchange_contract:'guarded-v1',instance_id:'one',sequence:0,reachable:true};
const plan={exchange_contract:'guarded-v1',instance_id:'one',sequence:1,request_id:'window:1',context_hash:ctx,mission_id:'MSN-1',mission_version:1,plan_sequence:1,time:body().time,feasible:true,tasks:[]};
const ok=payload=>({ok:true,status:200,json:async()=>payload});

test('guarded plan freezes body/guards/endpoint before capability awaits',async()=>{
 let raw=JSON.stringify({links:{L03:{host:'10.0.0.9',port:5103}}});const calls=[],g=guard(),b=body(),signal=new AbortController().signal;
 const client=createOrchestrationClient({storage:{getItem:()=>raw},fetchImpl:async(url,options)=>{
  calls.push({url,options});if(url.endsWith('/status')){g.mission_version=9;b.mission.id='changed';raw=JSON.stringify({links:{L03:{host:'10.0.0.8',port:5103}}});return ok(status);}return ok(plan);
 }});
 assert.deepEqual(await client.guardedPlan(b,g,{signal}),plan);
 assert.deepEqual(calls.map(c=>c.url),['http://10.0.0.9:5103/api/orchestration/status','http://10.0.0.9:5103/api/orchestration/plan']);
 assert.equal(calls[1].options.signal,signal);assert.equal(calls[1].options.headers['X-ISDC-Orchestration-Mission-Version'],'1');
 assert.equal(JSON.parse(calls[1].options.body).mission.id,'MSN-1');
});

test('unadvertised capability never sends mutation and malformed settings/nonfinite input send nothing',async()=>{
 let calls=0;const client=createOrchestrationClient({storage:null,fetchImpl:async()=>{calls++;return ok({reachable:true});}});
 await assert.rejects(client.guardedPlan(body(),guard()),e=>e.unavailable===true);assert.equal(calls,1);
 for(const raw of ['{bad','null','[]',JSON.stringify({links:{L03:[]}})]){
  const bad=createOrchestrationClient({storage:{getItem:()=>raw},fetchImpl:async()=>{calls++;return ok(status);}});const before=calls;
  await assert.rejects(bad.guardedPlan(body(),guard()),e=>e.unavailable===true);assert.equal(calls,before);
 }
 const b=body();b.invalid=NaN;const before=calls;await assert.rejects(client.guardedPlan(b,guard()),TypeError);assert.equal(calls,before);
});

test('mismatched plan and commit receipts cannot be accepted',async()=>{
 for(const bad of [{...plan,mission_id:'other'},{...plan,mission_version:true},{...plan,time:'other'},null,[],{...plan,tasks:[{invalid:Infinity}]}]){
  const client=createOrchestrationClient({storage:null,fetchImpl:async url=>ok(url.endsWith('/status')?status:bad)});
  await assert.rejects(client.guardedPlan(body(),guard()),e=>e.unavailable===true);
 }
 const command={time:body().time,mission_id:'MSN-1',decision:'commit',version:1,tasks:[]};
 const g={...guard(),plan_sequence:1};delete g.mission_version;
 const reply={...plan,accepted:true,decision:'commit',held_tasks:0};
 const client=createOrchestrationClient({storage:null,fetchImpl:async url=>ok(url.endsWith('/status')?status:reply)});
 assert.deepEqual(await client.guardedCommit(command,g),reply);
 const wrong=createOrchestrationClient({storage:null,fetchImpl:async url=>ok(url.endsWith('/status')?status:{...reply,held_tasks:1})});
 await assert.rejects(wrong.guardedCommit(command,g),e=>e.unavailable===true);
});

test('abort and HTTP409 remain distinct from unavailable',async()=>{
 const aborted=createOrchestrationClient({storage:null,fetchImpl:async()=>{throw new DOMException('cancel','AbortError');}});
 await assert.rejects(aborted.status(),e=>e.name==='AbortError'&&!e.unavailable);
 const conflict=createOrchestrationClient({storage:null,fetchImpl:async()=>({ok:false,status:409,json:async()=>({detail:'changed'})})});
 await assert.rejects(conflict.status(),e=>e.conflict===true&&e.status===409&&!e.unavailable);
});


test('source endpoint resolver and ICD paths remain exact',async()=>{
 const {createHash}=await import('node:crypto');
 const fixture=JSON.parse(await readFile(new URL('project_support/tests/fixtures/original_browser_orchestration.json',root),'utf8'));
 const original=await readFile(new URL('communication/browser/orchestration.js',root),'utf8');
 const prefix=original.slice(0,original.indexOf('// Explicit dependencies:')).replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(prefix).digest('hex'),fixture.source_prefix_sha256);
});


test('abort during JSON response parsing is still cancellation',async()=>{
 const client=createOrchestrationClient({storage:null,fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw new DOMException('cancel','AbortError');}})});
 await assert.rejects(client.status(),e=>e.name==='AbortError'&&!e.unavailable);
});
