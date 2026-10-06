import test from 'node:test';
import assert from 'node:assert/strict';
import { FABRIC_LINK_ID, INTEGRATION_SETTINGS_KEY, createDataFabricClient, isLocalHost, resolveEndpoint } from '../../../communication/browser/data_fabric.js';

const storageWith = value => ({ getItem: key => (key === INTEGRATION_SETTINGS_KEY && value != null ? JSON.stringify(value) : null) });

test('the endpoint is this server unless the settings tab points link L02 at another host', () => {
  assert.deepEqual(resolveEndpoint({ storage: null }), { base: '', placement: 'server', source: 'server' });
  assert.deepEqual(resolveEndpoint({ storage: storageWith({ links: { [FABRIC_LINK_ID]: { host: '127.0.0.1', port: 5102 } } }) }).placement, 'server');
  assert.deepEqual(resolveEndpoint({ storage: storageWith({ links: { [FABRIC_LINK_ID]: { host: '10.0.0.7', port: 5102, transport: 'TCP' } } }) }), { base: 'http://10.0.0.7:5102', placement: 'remote', source: 'settings' });
  assert.equal(resolveEndpoint({ storage: storageWith({ links: { [FABRIC_LINK_ID]: { host: '10.0.0.7', port: 5102, enabled: false } } }) }).placement, 'server');
  assert.equal(resolveEndpoint({ storage: { getItem: () => '{bad json' } }).placement, 'server');
  assert.ok(isLocalHost('self') && isLocalHost('localhost') && isLocalHost('127.0.0.1') && isLocalHost(''));
  assert.equal(isLocalHost('192.168.0.3'), false);
});

test('requests carry the message, and 503 or network failures are flagged unavailable', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/status')) return { ok: true, status: 200, json: async () => ({ placement: 'embedded' }) };
    if (url.endsWith('/route')) return { ok: false, status: 400, json: async () => ({ detail: '출발지 없음' }) };
    return { ok: false, status: 503, json: async () => ({ detail: '패브릭 응답 없음' }) };
  };
  const client = createDataFabricClient({ fetchImpl, storage: null });
  assert.deepEqual(await client.status(), { placement: 'embedded' });
  assert.equal(calls[0].url, '/api/data-fabric/status');
  await assert.rejects(client.update({ time: 't', nodes: [], links: [] }), error => error.unavailable === true && /응답 없음/.test(error.message));
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), { time: 't', nodes: [], links: [] });
  await assert.rejects(client.route('A', 'B', 'latency'), error => error.status === 400 && !error.unavailable && error.message === '출발지 없음');
  assert.deepEqual(JSON.parse(calls[2].options.body), { source: 'A', target: 'B', objective: 'latency' });
  const offline = createDataFabricClient({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, storage: storageWith({ links: { L02: { host: '10.0.0.7', port: 5102 } } }) });
  await assert.rejects(offline.status(), error => error.unavailable === true && error.endpoint.base === 'http://10.0.0.7:5102');
});

test('guarded requests preserve headers, endpoint and abort signal and reject unadvertised capability',async()=>{
 const calls=[],signal=new AbortController().signal;
 const guard={instance_id:'instance1',expected_sequence:3,request_id:'window_A:1'};
 const client=createDataFabricClient({storage:null,fetchImpl:async(url,options)=>{
  calls.push({url,options});
  return {ok:true,status:200,json:async()=>url.endsWith('/status')?{exchange_contract:'guarded-v1',instance_id:'instance1',sequence:3,reachable:true}:
   {exchange_contract:'guarded-v1',instance_id:'instance1',sequence:4,request_id:'window_A:1',network_hash:'a'.repeat(64)}};
 }});
 const body={time:'2026-09-07T12:00:00Z',nodes:[],links:[]};const before=JSON.stringify(body);
 assert.equal((await client.guardedUpdate(body,guard,{signal})).sequence,4);
 assert.deepEqual(calls.map(c=>c.url),['/api/data-fabric/status','/api/data-fabric/network']);
 assert.equal(calls[1].options.headers['X-ISDC-Fabric-Request-Id'],'window_A:1');
 assert.equal(calls[1].options.headers['X-ISDC-Fabric-Sequence'],'3');
 assert.equal(calls[1].options.signal,signal);assert.equal(calls[1].options.body,before);assert.equal(JSON.stringify(body),before);
 let sent=0;const old=createDataFabricClient({storage:null,fetchImpl:async()=>{sent++;return {ok:true,status:200,json:async()=>({reachable:true})};}});
 await assert.rejects(old.guardedUpdate(body,guard),error=>error.unavailable===true);assert.equal(sent,1);
});

test('guarded reply mismatch, malformed JSON and HTTP conflicts never become valid reports',async()=>{
 const guard={instance_id:'instance1',expected_sequence:3,request_id:'window_A:1'};
 for(const result of [null,[],{exchange_contract:'guarded-v1',instance_id:'wrong',sequence:4,request_id:guard.request_id,network_hash:'a'.repeat(64)}]){
  const client=createDataFabricClient({storage:null,fetchImpl:async url=>({ok:true,status:200,json:async()=>url.endsWith('/status')?{exchange_contract:'guarded-v1',instance_id:'instance1',sequence:3,reachable:true}:result})});
  await assert.rejects(client.guardedUpdate({},guard),error=>error.unavailable===true);
 }
 const conflict=createDataFabricClient({storage:null,fetchImpl:async()=>({ok:false,status:409,json:async()=>({detail:'다른 창 변경'})})});
 await assert.rejects(conflict.status(),error=>error.status===409&&error.conflict===true);
 const aborted=createDataFabricClient({storage:null,fetchImpl:async()=>{throw new DOMException('cancel','AbortError');}});
 await assert.rejects(aborted.status(),error=>error.name==='AbortError'&&!error.unavailable);
});

test('guarded settings parsing never silently falls back or changes endpoint between GET and POST',async()=>{
 let raw=JSON.stringify({links:{L02:{host:'10.0.0.7',port:5102}}});const calls=[];
 const client=createDataFabricClient({storage:{getItem:()=>raw},fetchImpl:async(url,options)=>{
  calls.push(url);raw=JSON.stringify({links:{L02:{host:'10.0.0.8',port:5102}}});
  return {ok:true,status:200,json:async()=>url.endsWith('/status')?{exchange_contract:'guarded-v1',instance_id:'one',sequence:0,reachable:true}:
   {exchange_contract:'guarded-v1',instance_id:'one',sequence:1,request_id:'window_A:1',network_hash:'a'.repeat(64)}};
 }});
 await client.guardedUpdate({}, {instance_id:'one',expected_sequence:0,request_id:'window_A:1'});
 assert.deepEqual(calls,['http://10.0.0.7:5102/api/data-fabric/status','http://10.0.0.7:5102/api/data-fabric/network']);
 raw='{broken';const count=calls.length;
 await assert.rejects(client.guardedUpdate({}, {instance_id:'one',expected_sequence:0,request_id:'window_A:2'}),error=>error.unavailable===true);
 assert.equal(calls.length,count);
});

test('guarded route uses accepted sequence/hash and caller mutation cannot rewrite pending command',async()=>{
 const guard={instance_id:'one',expected_sequence:4,request_id:'window_A:2'},calls=[];
 const client=createDataFabricClient({storage:null,fetchImpl:async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/status')){guard.instance_id='mutated';guard.expected_sequence=99;guard.request_id='window_A:99';return {ok:true,status:200,json:async()=>({exchange_contract:'guarded-v1',instance_id:'one',sequence:4,reachable:true})};}
  return {ok:true,status:200,json:async()=>({exchange_contract:'guarded-v1',instance_id:'one',sequence:4,network_hash:'b'.repeat(64),status:'unavailable',path:[]})};
 }});
 const result=await client.guardedRoute('A','G','latency',guard);
 assert.equal(result.sequence,4);assert.equal(result.status,'unavailable');
 assert.equal(calls[1].options.headers['X-ISDC-Fabric-Sequence'],'4');
 assert.deepEqual(JSON.parse(calls[1].options.body),{source:'A',target:'G',objective:'latency'});
});

test('non-finite guarded input is rejected before any network call',async()=>{
 let calls=0;const client=createDataFabricClient({storage:null,fetchImpl:async()=>{calls++;throw Error('unexpected');}});
 await assert.rejects(client.guardedUpdate({nodes:[{generation_mbps:NaN}]},{instance_id:'one',expected_sequence:0,request_id:'window_A:1'}),error=>error instanceof TypeError);
 assert.equal(calls,0);
});

test('non-object integration settings are unavailable before guarded requests',async()=>{
 for(const value of [null,[],{links:[]},{links:{L02:[]}}]){
  let calls=0;const client=createDataFabricClient({storage:{getItem:()=>JSON.stringify(value)},fetchImpl:async()=>{calls++;throw Error('unexpected');}});
  await assert.rejects(client.guardedUpdate({}, {instance_id:'one',expected_sequence:0,request_id:'window_A:1'}),error=>error.unavailable===true);
  assert.equal(calls,0);
 }
});
