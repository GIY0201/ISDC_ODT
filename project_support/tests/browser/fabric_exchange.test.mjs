import test from 'node:test';
import assert from 'node:assert/strict';
import {createFabricExchange} from '../../../user_application/web/scripts/tabs/fabric_exchange.js';
function fixture(){
 let value={status:'valid',utc:'2026-09-07T12:00:00.000000000Z',definition_hashes:{A:'native'},stations:[],faults:[],network:{time:'2026-09-07T12:00:00.000Z',nodes:[{id:'A'},{id:'G'}],links:[]}},valid=true,sequence=0,calls=[],mode='',release;
 const receipt=guard=>({exchange_contract:'guarded-v1',instance_id:'one',sequence:guard.expected_sequence+1,request_id:guard.request_id,network_hash:'a'.repeat(64),links:[],routes:{}});
 const client={endpoint:()=>({base:'',placement:'server',source:'server'}),status:async()=>({exchange_contract:'guarded-v1',instance_id:'one',sequence,reachable:true}),
  guardedUpdate:async(body,guard)=>{calls.push({body:structuredClone(body),guard:structuredClone(guard)});if(mode==='wait')await new Promise(r=>release=r);if(mode==='offline')throw Object.assign(Error('offline'),{unavailable:true});if(mode==='conflict')throw Object.assign(Error('changed'),{conflict:true,status:409});sequence=guard.expected_sequence+1;return receipt(guard);},
  guardedRoute:async(source,target,objective,guard)=>({exchange_contract:'guarded-v1',instance_id:'one',sequence:guard.expected_sequence,network_hash:'a'.repeat(64),source,target,objective,path:['A','G']})};
 const network={networkSnapshot:()=>structuredClone(value),verifyNetworkSnapshot:v=>valid&&JSON.stringify(v)===JSON.stringify(value)};
 const controller=createFabricExchange({client,network,clientId:'test_window'});
 return {controller,client,calls,get value(){return value;},change(){value={...value,utc:'2026-09-07T12:00:01.000000000Z',network:{...value.network,time:'2026-09-07T12:00:01.000Z'}};},invalid(){valid=false;},mode:m=>mode=m,release:()=>release(),sequence:n=>sequence=n};
}
test('explicit exchange deduplicates, copies proof and routes only accepted network hash',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);const first=f.controller.send(),same=f.controller.send();assert.equal(first,same);await first;
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].guard.request_id,'test_window:1');
 assert.equal(f.controller.snapshot().status,'accepted');await f.controller.route('A','G','latency');
 const state=f.controller.snapshot();assert.deepEqual(state.route.path,['A','G']);state.receipt.sequence=99;assert.equal(f.controller.snapshot().receipt.sequence,1);
 f.change();assert.equal(f.controller.snapshot().receipt,null);assert.equal(f.controller.snapshot().route,null);await assert.rejects(f.controller.route('A','G','latency'));
});
test('uncertain outcome retry preserves exact identity and payload; changed input cannot retry',async()=>{
 const f=fixture();f.mode('offline');await f.controller.send();assert.equal(f.controller.snapshot().status,'error');f.mode('');await f.controller.send();
 assert.deepEqual(f.calls[1],f.calls[0]);assert.equal(f.controller.snapshot().status,'accepted');
 const g=fixture();g.mode('offline');await g.controller.send();g.change();assert.equal(g.controller.snapshot().retry_available,false);assert.equal(g.controller.snapshot().refresh_required,true);await g.controller.send();assert.equal(g.calls.length,1);await g.controller.refresh();await g.controller.send();assert.equal(g.calls[1].guard.request_id,'test_window:2');
});
test('conflict requires explicit refresh before reapply and refresh rejects other window receipts',async()=>{
 const f=fixture();f.mode('conflict');await f.controller.send();assert.equal(f.controller.snapshot().status,'conflict');assert.equal(f.controller.snapshot().receipt,null);
 await f.controller.send();assert.equal(f.calls.length,1);f.mode('');await f.controller.refresh();await f.controller.send();assert.equal(f.calls[1].guard.request_id,'test_window:2');
 f.sequence(8);await f.controller.refresh();assert.equal(f.controller.snapshot().receipt,null);
});
test('late replies and disposal cannot publish a stale receipt or route',async()=>{
 const f=fixture();f.mode('wait');const pending=f.controller.send();await new Promise(r=>setImmediate(r));f.change();f.release();await pending;assert.equal(f.controller.snapshot().receipt,null);
 const g=fixture();g.mode('wait');const work=g.controller.send();await new Promise(r=>setImmediate(r));g.controller.destroy();g.release();await work;assert.equal(g.controller.snapshot().status,'disposed');assert.equal(g.controller.snapshot().receipt,null);
});
test('unverified network has no exchange and does not allocate hidden clock or query',async()=>{
 const f=fixture();f.invalid();await f.controller.send();assert.equal(f.calls.length,0);assert.equal(f.controller.snapshot().receipt,null);
});

test('changed endpoint or input fields invalidate proof; mismatched route echo is never presented',async()=>{
 const f=fixture();await f.controller.send();f.client.guardedRoute=async()=>({instance_id:'one',sequence:1,network_hash:'a'.repeat(64),source:'wrong',target:'G',objective:'latency',path:['wrong','G']});
 await f.controller.route('A','G','latency');assert.equal(f.controller.snapshot().route,null);assert.equal(f.controller.snapshot().status,'error');
 const g=fixture();await g.controller.send();g.value.faults.push({kind:'outage',target:'A'});assert.equal(g.controller.snapshot().receipt,null);
 const h=fixture();await h.controller.send();h.client.endpoint=()=>({base:'http://other:5102',placement:'remote',source:'settings'});assert.equal(h.controller.snapshot().receipt,null);
});
