import test from 'node:test';
import assert from 'node:assert/strict';
import {createFabricExchange} from '../../../user_application/web/scripts/tabs/fabric_exchange.js';
import {createDataFabricClient} from '../../../communication/browser/data_fabric.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const copy=value=>structuredClone(value);
function fixture(){
 let endpoint={base:'',placement:'server',source:'server'},sequence=0,instance='one',hash='a'.repeat(64),mode='',holdStatus=false,holdUpdate=false;
 let value={status:'valid',utc:'2026-09-07T12:00:00.000000000Z',network:{time:'2026-09-07T12:00:00.000Z',nodes:[{id:'A'},{id:'G'}],links:[{id:'L',a:'A',b:'G'}]}};
 let metrics=[{id:'L',usable:true,quality:75}],statusCalls=0,updates=0,statusError=null;const waits=[],targets=[];
 const client={endpoint:()=>copy(endpoint),status:async({signal,target}={})=>{
  targets.push(copy(target??endpoint));
  statusCalls++;const answer={exchange_contract:'guarded-v1',reachable:true,instance_id:instance,sequence,network_hash:hash};
  if(holdStatus)await new Promise(resolve=>waits.push({resolve,signal}));if(statusError)throw statusError;return answer;
 },guardedUpdate:async(body,guard)=>{updates++;if(holdUpdate)await new Promise(resolve=>waits.push({resolve}));
  if(mode)throw Object.assign(Error(mode),mode==='conflict'?{conflict:true}:{unavailable:true});sequence=guard.expected_sequence+1;
  return {exchange_contract:'guarded-v1',instance_id:instance,sequence,network_hash:hash,request_id:guard.request_id,links:copy(metrics)};
 },guardedRoute:async(source,target,objective,guard)=>({instance_id:instance,sequence:guard.expected_sequence,network_hash:hash,source,target,objective,path:[source,target]})};
 const network={networkSnapshot:()=>copy(value),verifyNetworkSnapshot:v=>JSON.stringify(v)===JSON.stringify(value)};
 const controller=createFabricExchange({client,network,clientId:'observation'});
 return {controller,client,get statusCalls(){return statusCalls;},get updates(){return updates;},waits,targets,
  holdStatus:v=>holdStatus=v,holdUpdate:v=>holdUpdate=v,mode:v=>mode=v,metrics:v=>metrics=v,statusError:v=>statusError=v,
  endpoint:v=>endpoint=v,instance:v=>instance=v,sequence:v=>sequence=v,hash:v=>hash=v,
  release(){waits.shift()?.resolve();},advance(i=1){const utc=new Date(Date.parse(value.utc)+i*1000).toISOString();value={...value,utc,network:{...value.network,time:utc}};},links:v=>value.network.links=v};
}
test('readonly polling skips a live command rather than returning its promise',async()=>{
 const f=fixture();f.holdUpdate(true);const command=f.controller.send();await tick();
 assert.equal(await f.controller.pollStatus(),null);assert.equal(f.statusCalls,1);assert.equal(f.updates,1);
 f.release();await command;assert.equal(f.controller.snapshot().status,'accepted');
});
test('duplicate polls share only poll work and copied status never authorizes transmission',async()=>{
 const f=fixture();f.holdStatus(true);const a=f.controller.pollStatus(),b=f.controller.pollStatus();assert.equal(a,b);await tick();assert.equal(f.statusCalls,1);
 f.release();await a;const observed=f.controller.moduleStatus();assert.equal(observed.status,'valid');assert.equal(f.controller.snapshot().receipt,null);assert.equal(f.updates,0);
 observed.value.instance_id='forged';assert.equal(f.controller.moduleStatus().value.instance_id,'one');
});
for(const failure of ['offline','conflict'])test(`automatic observation preserves ${failure} command/review state`,async()=>{
 const f=fixture();f.mode(failure);await f.controller.send();const before=f.controller.snapshot();f.mode('');await f.controller.pollStatus();
 assert.deepEqual(f.controller.snapshot(),before);assert.equal(f.updates,1);assert.equal(f.controller.moduleStatus().status,'valid');
});
test('foreign status revokes accepted receipt/route and requires explicit uncertain-command review',async()=>{
 const f=fixture();await f.controller.send();await f.controller.route('A','G');f.hash('b'.repeat(64));await f.controller.pollStatus();assert.equal(f.controller.snapshot().receipt,null);assert.equal(f.controller.snapshot().route,null);
 const g=fixture();g.mode('offline');await g.controller.send();g.instance('foreign');await g.controller.pollStatus();assert.equal(g.controller.snapshot().retry_available,false);assert.equal(g.controller.snapshot().refresh_required,true);await g.controller.send();assert.equal(g.updates,1);
});
test('poll failure has separate observation error without clearing uncertain input review',async()=>{
 const f=fixture();f.mode('offline');await f.controller.send();f.advance();const before=f.controller.snapshot();assert.equal(before.refresh_required,true);
 f.statusError(Error('status offline'));assert.equal(await f.controller.pollStatus(),null);assert.equal(f.controller.moduleStatus().status,'error');assert.match(f.controller.moduleStatus().error,/status offline/);assert.deepEqual(f.controller.snapshot(),before);
 f.statusError(null);await f.controller.pollStatus();assert.equal(f.controller.moduleStatus().status,'valid');assert.equal(f.controller.snapshot().refresh_required,true);await f.controller.send();assert.equal(f.updates,1);
});
for(const change of ['cancel','endpoint','destroy'])test(`${change} fences ignored-abort late status`,async()=>{
 const f=fixture();f.holdStatus(true);const pending=f.controller.pollStatus();await tick();
 if(change==='cancel')f.controller.cancelStatusPoll();if(change==='endpoint')f.endpoint({base:'http://other',placement:'remote',source:'settings'});if(change==='destroy')f.controller.destroy();
 f.release();assert.equal(await pending,null);assert.notEqual(f.controller.moduleStatus().status,'valid');
});
test('new explicit send preempts readonly polling without a foreign poll response publishing',async()=>{
 const f=fixture();f.holdStatus(true);const poll=f.controller.pollStatus();await tick();f.holdStatus(false);const command=f.controller.send();await command;
 assert.equal(f.updates,1);assert.equal(f.controller.snapshot().status,'accepted');f.release();assert.equal(await poll,null);assert.notEqual(f.controller.moduleStatus().status,'valid');
});
test('GET is pinned to captured target even when endpoint changes before the scheduled transport',async()=>{
 const f=fixture();const original=f.client.endpoint();const poll=f.controller.pollStatus();
 f.endpoint({base:'http://other',placement:'remote',source:'settings'});
 f.endpoint(original);
 const transport=f.client.status;f.client.status=async options=>{assert.deepEqual(options.target,original);return transport(options);};
 await poll;assert.equal(f.targets.length,1);assert.deepEqual(f.targets[0],original);assert.equal(f.updates,0);
});
test('observed endpoint ABA cannot resurrect an ignored-abort response',async()=>{
 const f=fixture();const original=f.client.endpoint();f.holdStatus(true);const pending=f.controller.pollStatus();await tick();
 f.endpoint({base:'http://other',placement:'remote',source:'settings'});assert.equal(f.controller.moduleStatus().status,'unavailable');f.endpoint(original);f.controller.moduleStatus();f.release();
 assert.equal(await pending,null);assert.equal(f.controller.moduleStatus().status,'unavailable');
});
test('actual HTTP client uses captured endpoint despite settings changing at transport entry',async()=>{
 let raw=null;const urls=[];const storage={getItem:()=>raw};const client=createDataFabricClient({storage,fetchImpl:async url=>{
  urls.push(url);raw=JSON.stringify({links:{L02:{enabled:true,host:'remote.example',port:5102}}});
  return {ok:true,json:async()=>({exchange_contract:'guarded-v1',reachable:true,instance_id:'one',sequence:0})};
 }});
 const controller=createFabricExchange({client,network:{networkSnapshot:()=>null,verifyNetworkSnapshot:()=>false},clientId:'actual_client'});
 const pending=controller.pollStatus();assert.equal(await pending,null);assert.deepEqual(urls,['/api/data-fabric/status']);assert.equal(controller.moduleStatus().status,'unavailable');
});
test('final endpoint callback cancel at identical endpoint cannot publish revoked observation',async()=>{
 const f=fixture(),original=f.client.endpoint();let reads=0;f.client.endpoint=()=>{if(++reads===4)f.controller.cancelStatusPoll();return original;};
 assert.equal(await f.controller.pollStatus(),null);assert.equal(f.controller.moduleStatus().status,'unavailable');
});
test('accepted history bounds48, preserves provenance/copies, and natural UTC cannot turn history into current approval',async()=>{
 const f=fixture();for(let i=0;i<49;i++){f.advance();f.metrics([{id:'L',usable:true,quality:i}]);await f.controller.send();}
 const history=f.controller.qualityHistory('L');assert.equal(history.length,48);assert.equal(history[0].quality,1);assert.equal(history.at(-1).quality,48);assert.equal(history.at(-1).instance_id,'one');assert.equal(history.at(-1).sequence,49);assert.equal(history.at(-1).network_hash,'a'.repeat(64));assert.equal(history.at(-1).request_id,'observation:49');assert.equal(history.at(-1).link_id,'L');assert.ok(Number.isFinite(Date.parse(history.at(-1).utc)));
 history[0].quality=-1;assert.equal(f.controller.qualityHistory('L')[0].quality,1);await f.controller.send();assert.equal(f.controller.qualityHistory('L').length,48);
 f.advance();assert.equal(f.controller.snapshot().receipt,null);assert.equal(f.controller.qualityHistory('L').length,48);
});
test('known unusable records source zero; unknown or malformed usable quality is not manufactured zero',async()=>{
 const f=fixture();f.links(['L','unknown','nan'].map(id=>({id,a:'A',b:'G'})));f.metrics([{id:'L',usable:false,quality:null},{id:'unknown',quality:50},{id:'nan',usable:true,quality:NaN}]);await f.controller.send();
 assert.equal(f.controller.qualityHistory('L')[0].quality,0);assert.deepEqual(f.controller.qualityHistory('unknown'),[]);assert.deepEqual(f.controller.qualityHistory('nan'),[]);
});
test('changed hash and sequence retain past quality at same link ID without permitting current route',async()=>{
 const f=fixture();await f.controller.send();f.advance();f.hash('b'.repeat(64));f.metrics([{id:'L',usable:true,quality:12}]);await f.controller.send();
 const past=f.controller.qualityHistory('L');assert.equal(past.length,2);assert.deepEqual(past.map(s=>s.network_hash),['a'.repeat(64),'b'.repeat(64)]);f.advance();assert.equal(f.controller.snapshot().receipt,null);await assert.rejects(f.controller.route('A','G'));assert.equal(f.controller.qualityHistory('L').length,2);
});
test('history prunes accepted membership and clears endpoint/instance/invalidate/dispose scopes',async()=>{
 const f=fixture();await f.controller.send();f.advance();f.links([]);f.metrics([]);await f.controller.send();assert.deepEqual(f.controller.qualityHistory('L'),[]);
 for(const kind of ['endpoint','instance','invalidate','destroy']){const g=fixture();await g.controller.send();assert.equal(g.controller.qualityHistory('L').length,1);
  if(kind==='endpoint')g.endpoint({base:'http://other',placement:'remote',source:'settings'});if(kind==='instance'){g.instance('new');await g.controller.pollStatus();}if(kind==='invalidate')g.controller.invalidate();if(kind==='destroy')g.controller.destroy();assert.deepEqual(g.controller.qualityHistory('L'),[]);
 }
});
test('reentrant scope invalidation after native acceptance cannot repopulate cleared history',async()=>{
 const f=fixture(),endpoint=f.client.endpoint();let postReceiptReads=0;
 f.client.endpoint=()=>{if(f.updates===1&&++postReceiptReads===2)f.controller.invalidate();return endpoint;};
 await f.controller.send();assert.deepEqual(f.controller.qualityHistory('L'),[]);assert.equal(f.controller.snapshot().receipt,null);
});
test('command-entry endpoint reentry cannot start an old poll that revokes the newer receipt',async()=>{
 const f=fixture(),endpoint=f.client.endpoint();let once=false,poll;
 f.client.endpoint=()=>{if(!once){once=true;poll=f.controller.pollStatus();}return endpoint;};
 const originalStatus=f.client.status;let release;
 f.client.status=async options=>{const result=await originalStatus(options);if(options.target)await new Promise(resolve=>release=resolve);return result;};
 await f.controller.send();release?.();await tick();assert.equal(await poll,null);assert.equal(f.statusCalls,1);assert.equal(f.updates,1);assert.equal(f.controller.snapshot().status,'accepted');
});
test('scope-entry disposal cannot install pending observation after destroy',async()=>{
 const f=fixture(),endpoint=f.client.endpoint();let once=false;
 f.client.endpoint=()=>{if(!once){once=true;f.controller.destroy();}return endpoint;};
 assert.equal(await f.controller.pollStatus(),null);assert.equal(f.controller.moduleStatus().status,'unavailable');assert.equal(f.statusCalls,0);assert.equal(f.controller.snapshot().status,'disposed');
});
test('native UTC changed inside post-receipt endpoint guard cannot append unapproved historical quality',async()=>{
 const f=fixture(),endpoint=f.client.endpoint();let postReceiptReads=0;
 f.client.endpoint=()=>{if(f.updates===1&&++postReceiptReads===1)f.advance();return endpoint;};
 assert.equal(await f.controller.send(),null);assert.equal(f.controller.snapshot().receipt,null);assert.deepEqual(f.controller.qualityHistory('L'),[]);
});
for(const operation of ['send','refresh','route'])test(`destruction at ${operation} entry cannot install command work after disposal`,async()=>{
 const f=fixture(),endpoint=f.client.endpoint();let once=false;
 f.client.endpoint=()=>{if(!once){once=true;f.controller.destroy();}return endpoint;};
 await Promise.resolve(f.controller[operation](...operation==='route'?['A','G']:[])).catch(()=>null);
 assert.equal(f.controller.snapshot().status,'disposed');assert.equal(f.controller.snapshot().pending,false);assert.equal(f.statusCalls,0);assert.equal(f.updates,0);
});
for(const operation of ['cancelStatusPoll','invalidate','destroy'])test(`${operation} suppresses synchronous abort-listener reentry into a replacement poll`,async()=>{
 const f=fixture();f.holdStatus(true);const original=f.controller.pollStatus();await tick();let replacement;
 f.waits[0].signal.addEventListener('abort',()=>{f.holdStatus(false);replacement=f.controller.pollStatus();});
 f.controller[operation]();f.release();await original;await replacement;await tick();
 assert.equal(f.statusCalls,1);assert.equal(f.controller.moduleStatus().status,'unavailable');assert.equal(f.controller.snapshot().receipt,null);
});
test('cancel at initial endpoint capture revokes poll before any task exists',async()=>{
 const f=fixture(),endpoint=f.client.endpoint();let once=false;
 f.client.endpoint=()=>{if(!once){once=true;f.controller.cancelStatusPoll();}return endpoint;};
 assert.equal(await f.controller.pollStatus(),null);assert.equal(f.statusCalls,0);assert.equal(f.controller.moduleStatus().status,'unavailable');
});
