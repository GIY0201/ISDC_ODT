import test from 'node:test';
import assert from 'node:assert/strict';
import {createDataDeployment} from '../../../user_application/web/scripts/nodes/data_deployment.js';
import {createConstellationStore} from '../../../user_application/web/scripts/nodes/constellation.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import {readFile} from 'node:fs/promises';
import {trace} from '../../tooling/capture_original_data_client.mjs';

const epoch=1791151272000;
const empty=()=>({deployment_id:null,revision:0,nodes:[],run_id:'RUN-1',scope_id:'RUN-1:unconfigured'});
const ok=body=>({ok:true,status:200,json:async()=>structuredClone(body)});
const reply=payload=>({deployment_id:payload.deployment_id,revision:payload.expected_revision+1,nodes:payload.nodes,
  run_id:'RUN-1',scope_id:`RUN-1:deployment:${payload.deployment_id}`});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(fetchImpl,options={}){
  let sequence=0,ids=0,client;const events=[],values=new Map();
  const storage=options.storage??{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++sequence}`});
  const constellation=createConstellationStore({library,storage,now:()=>epoch,
    verifyAcceptance:(...args)=>client.verifyAcceptance(...args)});
  constellation.load();
  client=createDataDeployment({constellation,fetchImpl,createId:()=>`DEP-${++ids}`,
    emit:(type,data)=>events.push({type,data}),...options});
  return {client,constellation,events,values,storage};
}

test('server acceptance commits sent full snapshot while keeping subsequent drafts',async()=>{
  let resolve,sent;
  const f=fixture(async(url,options)=>{
    assert.equal(url,'/api/data-management/deployment');
    if(options.method==='GET')return ok(empty());sent=JSON.parse(options.body);
    return new Promise(r=>{resolve=r;});
  });
  await f.client.initialize();const node=f.constellation.add({name:'sent',bus:'eo_small'});
  const pending=f.client.deploy();await tick();assert.equal(f.client.state.busy,true);
  assert.equal(f.constellation.deployed.length,0);
  assert.deepEqual(Object.keys(sent.nodes[0]),['id','name','mode','equipment']);
  assert.deepEqual(Object.keys(sent.nodes[0].equipment[0]),['id','catalog','enabled']);
  f.constellation.update(node.id,{...node,name:'later'});resolve(ok(reply(sent)));await pending;
  assert.equal(f.constellation.deployed[0].name,'sent');assert.equal(f.constellation.drafts[0].name,'later');
  assert.equal(f.constellation.deploymentConfirmed,true);assert.equal(f.client.state.busy,false);
  assert.equal(f.events.filter(e=>e.type==='nodes:deployed').length,1);
  assert.throws(()=>f.constellation.deploy(f.constellation.drafts,f.client.state.server),/수락/,'receipt replay outside the client commit is refused');
  f.client.destroy();
});

test('ambiguous network failure retries identical command and preserves copies',async()=>{
  const bodies=[];
  const f=fixture(async(_,options)=>{
    if(options.method==='GET')return ok(empty());const body=JSON.parse(options.body);bodies.push(body);
    if(bodies.length===1)throw new TypeError('offline');return ok(reply(body));
  });await f.client.initialize();f.constellation.add({name:'keep'});
  await assert.rejects(f.client.deploy(),/offline/);assert.equal(f.constellation.deployed.length,0);
  await f.client.deploy();assert.deepEqual(bodies[0],bodies[1]);
  const state=f.client.state;state.server.nodes.length=0;assert.equal(f.client.state.server.nodes.length,1);
  f.client.destroy();
});

test('initialize restores no command, reads once and leaves stored deployment unconfirmed',async()=>{
  const methods=[];const f=fixture(async(_,options)=>{methods.push(options.method);return options.method==='GET'?ok(empty()):ok(reply(JSON.parse(options.body)));});
  await f.client.initialize();f.constellation.add({name:'stored'});await f.client.deploy();
  const saved=f.constellation.deployed;f.client.destroy();methods.length=0;
  const g=fixture(async(_,options)=>{methods.push(options.method);return ok(empty());},{storage:f.storage});
  await Promise.all([g.client.initialize(),g.client.initialize()]);await g.client.initialize();
  assert.deepEqual(methods,['GET']);assert.deepEqual(g.constellation.deployed,saved);
  assert.equal(g.constellation.deploymentConfirmed,false);assert.equal(g.client.state.syncRequired,true);g.client.destroy();
});

test('serialized deploy and recall use accepted revision and preserve drafts',async()=>{
  const bodies=[];const f=fixture(async(_,options)=>{
    if(options.method==='GET')return ok(empty());const body=JSON.parse(options.body);bodies.push(body);await tick();return ok(reply(body));
  });await f.client.initialize();f.constellation.add({name:'draft'});
  await Promise.all([f.client.deploy(),f.client.recall()]);
  assert.deepEqual(bodies.map(b=>b.expected_revision),[0,1]);assert.deepEqual(bodies.map(b=>b.nodes.length),[1,0]);
  assert.equal(f.constellation.deployed.length,0);assert.equal(f.constellation.drafts.length,1);f.client.destroy();
});

test('409 refresh requires another explicit apply and sends no silent retry',async()=>{
  let gets=0,posts=0;
  const f=fixture(async(_,options)=>{
    if(options.method==='GET'){gets++;return ok(gets===1?empty():{...empty(),deployment_id:'REMOTE',revision:7,scope_id:'RUN-1:deployment:REMOTE'});}
    posts++;if(posts===1)return {ok:false,status:409,json:async()=>({detail:'version conflict'})};return ok(reply(JSON.parse(options.body)));
  });await f.client.initialize();f.constellation.add({name:'draft'});
  await assert.rejects(f.client.deploy(),error=>error.status===409);
  assert.equal(posts,1);assert.equal(gets,2);assert.equal(f.client.state.server.revision,7);
  assert.equal(f.client.state.syncRequired,true);assert.equal(f.constellation.deployed.length,0);
  await f.client.deploy();assert.equal(posts,2);assert.equal(f.client.state.server.revision,8);f.client.destroy();
});

test('HTML and malformed JSON produce explicit API errors',async()=>{
  for(const response of [new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}}),new Response('{bad',{headers:{'content-type':'application/json'}})]){
    const f=fixture(async()=>response);f.constellation.add({name:'keep'});
    await assert.rejects(f.client.initialize(),/배치 API/);assert.equal(f.constellation.drafts.length,1);f.client.destroy();
  }
});

test('malformed or mismatched server receipts never confirm local deployment',async()=>{
  const mutations=[r=>r.scope_id='foreign',r=>r.revision=0,r=>r.nodes[0].mode='active',r=>r.nodes[0].equipment[0].enabled=1,
    r=>r.nodes[0].name='other',r=>r.deployment_id='other',r=>r.revision=Number.MAX_SAFE_INTEGER+1];
  for(const mutate of mutations){
    const f=fixture(async(_,options)=>{if(options.method==='GET')return ok(empty());const body=reply(JSON.parse(options.body));mutate(body);return ok(body);});
    await f.client.initialize();f.constellation.add({name:'keep'});await assert.rejects(f.client.deploy());
    assert.equal(f.constellation.deployed.length,0);assert.equal(f.constellation.drafts.length,1);f.client.destroy();
  }
});

test('dispose aborts active transport and discards late receipt and queued recall',async()=>{
  let resolve,signal,posts=0;
  const f=fixture(async(_,options)=>{if(options.method==='GET')return ok(empty());posts++;signal=options.signal;
    const sent=JSON.parse(options.body);return new Promise(r=>{resolve=()=>r(ok(reply(sent)));});});
  await f.client.initialize();f.constellation.add({name:'keep'});
  const p=f.client.deploy(),q=f.client.recall();const outcomes=Promise.allSettled([p,q]);await tick();f.client.destroy();
  assert.equal(signal.aborted,true);resolve();assert.deepEqual((await outcomes).map(r=>r.status),['rejected','rejected']);
  assert.equal(posts,1);assert.equal(f.constellation.deployed.length,0);assert.equal(f.events.filter(e=>e.type==='nodes:deployed').length,0);
});

test('source 15s timeout aborts transport, cleans timer and permits identical retry',async()=>{
  let expire,delay,cleared=0,calls=0;const bodies=[];
  const f=fixture(async(_,options)=>{
    if(options.method==='GET')return ok(empty());const body=JSON.parse(options.body);bodies.push(body);calls++;
    if(calls>1)return ok(reply(body));return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
  },{setTimer:(callback,ms)=>{expire=callback;delay=ms;return 1;},clearTimer:()=>{cleared++;}});
  await f.client.initialize();f.constellation.add({name:'retry'});
  const pending=f.client.deploy();await tick();assert.equal(delay,15000);expire();await assert.rejects(pending,/aborted/);
  await f.client.deploy();assert.deepEqual(bodies[0],bodies[1]);assert.equal(cleared,3);f.client.destroy();
});

test('local persistence failure preserves retry command after valid accepted receipt',async()=>{
  const bodies=[];const f=fixture(async(_,options)=>options.method==='GET'?ok(empty()):
    (bodies.push(JSON.parse(options.body)),ok(reply(bodies.at(-1)))));
  await f.client.initialize();f.constellation.add({name:'stored'});const write=f.storage.setItem;
  f.storage.setItem=()=>{throw new Error('denied');};await assert.rejects(f.client.deploy(),/저장/);
  assert.equal(f.constellation.deployed.length,0);assert.equal(f.client.state.syncRequired,true);
  f.storage.setItem=write;await f.client.deploy();assert.deepEqual(bodies[0],bodies[1]);assert.equal(f.constellation.deploymentConfirmed,true);f.client.destroy();
});

test('observers receive independent copies and throwing observers cannot break commands',async()=>{
  const f=fixture(async(_,options)=>options.method==='GET'?ok(empty()):ok(reply(JSON.parse(options.body))));
  f.client.subscribe(state=>{if(state.server)state.server.nodes.length=0;throw new Error('observer');});
  let observed;f.client.subscribe(state=>{observed=state;});await f.client.initialize();f.constellation.add({name:'A'});await f.client.deploy();
  assert.equal(observed.server.nodes.length,1);assert.equal(f.client.state.server.nodes.length,1);assert.equal(f.constellation.deployed.length,1);f.client.destroy();
});

test('destroyed initialized client rejects initialize and cannot send further commands',async()=>{
  let calls=0;const f=fixture(async()=>{calls++;return ok(empty());});
  await f.client.initialize();f.client.destroy();await assert.rejects(f.client.initialize(),/종료/);
  await assert.rejects(f.client.refresh(),/종료/);await assert.rejects(f.client.deploy(),/종료/);assert.equal(calls,1);
});

test('expired request that ignores abort cannot commit its late reply',async()=>{
  let resolve,expire;
  const f=fixture(async(_,options)=>options.method==='GET'?ok(empty()):new Promise(r=>{
    const body=reply(JSON.parse(options.body));resolve=()=>r(ok(body));
  }),{setTimer:callback=>{expire=callback;return 1;},clearTimer:()=>{}});
  await f.client.initialize();f.constellation.add({name:'keep'});const pending=f.client.deploy();await tick();expire();resolve();
  await assert.rejects(pending,/시간|abort|제한/);assert.equal(f.constellation.deployed.length,0);f.client.destroy();
});

test('ambiguous retry commits original full geometry snapshot despite newer orbit-only edits',async()=>{
  let calls=0;const f=fixture(async(_,options)=>{
    if(options.method==='GET')return ok(empty());calls++;if(calls===1)throw new Error('offline');return ok(reply(JSON.parse(options.body)));
  });await f.client.initialize();const node=f.constellation.add({name:'A'});await assert.rejects(f.client.deploy());
  const newer={...node,orbit:{...node.orbit,altitude_km:node.orbit.altitude_km+10}};assert.deepEqual(f.constellation.update(node.id,newer),[]);
  await f.client.deploy();assert.equal(f.constellation.deployed[0].orbit.altitude_km,node.orbit.altitude_km);
  assert.equal(f.constellation.drafts[0].orbit.altitude_km,newer.orbit.altitude_km);f.client.destroy();
});

test('original client wire and valid state transitions remain identical',async()=>{
  const expected=JSON.parse(await readFile(new URL('../fixtures/original_data_client.json',import.meta.url),'utf8'));
  assert.deepEqual(await trace(createDataDeployment),{requests:expected.requests,events:expected.events,rows:expected.rows});
});
