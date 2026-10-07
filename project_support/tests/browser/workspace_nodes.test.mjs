import test from 'node:test';
import {projectWorkspaceContext} from '../../../user_application/web/scripts/workspace_context.js';
import assert from 'node:assert/strict';
import {createWorkspaceNodes} from '../../../user_application/web/scripts/workspace_nodes.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import {NODE_COMMUNICATION_METADATA} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {fixture as actualWorkspaceFixture} from './workspace_fixture.mjs';
import * as stationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
import {createGroundLinkModel} from '../../../digital_twin/simulation/browser/ground_links.js';
import {createNetworkSnapshotModel} from '../../../digital_twin/simulation/browser/network_snapshot.js';

test('mounted network consumer shares sampled analysis cadence and explicit activation authority',async()=>{
 const codec=createUtcCodec(LEAP_SHA256),start=codec.advance('2026-10-04T22:01:12Z',0),lease=Object.freeze({});
 let valid=true,listener,rendererOptions,sequence=0,faults=[];const scheduled=new Map(),activation=[];
 const NetworkScene=class{constructor(options){rendererOptions=options;}setGroundLinksVisible(){}setCoverageVisible(){}setSampledActive(v){activation.push(v);}clear(){}destroy(){}syncFrame(){}};
 const f=fixture({native:true,networkInputs:{readStations:()=>stationModel.DEFAULT_STATION_KEYS.map(preset=>stationModel.createStation({preset})),readFaults:()=>faults},networkSceneClass:NetworkScene,
  timers:{set(fn,ms){if(ms===1000){const id=++sequence;scheduled.set(id,fn);return id;}return setTimeout(fn,ms);},clear(id){if(scheduled.has(id))scheduled.delete(id);else clearTimeout(id);}},
  view:{captureDisplayContinuity:()=>valid?lease:null,verifyDisplayContinuity:v=>valid&&v===lease,observeDisplayContinuity(fn){listener=fn;return()=>{};}}});
 const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();await new Promise(resolve=>setTimeout(resolve,20));};
 try{
  await f.workspace.start();f.workspace.show('satellite');f.attach();f.options.store.add({name:'network scope'});f.context({utc:start,key:'catalog:scope',source:'catalog'});await flush();
  assert.equal(typeof f.workspace.setNetworkVisualActive,'function');assert.equal(rendererOptions.sampledNetwork.read({utc:start}),null);
  f.workspace.setNetworkVisualActive(true);await flush();const first=f.workspace.networkSampledPresentation();assert.equal(first.status,'valid');assert.equal(first.analysis_utc,start);assert.equal(f.workspace.verifySampledNetworkPresentation(first,{utc:start}),true);assert.equal(f.workspace.verifyNetworkSnapshot(first),false);
  const requests=f.calls.filter(c=>c[0]==='samples').length;
  for(let i=1;i<=30;i++)f.context({utc:codec.advance(start,i/30),key:'catalog:scope',source:'catalog'});await flush();
  const retained=f.workspace.networkSampledPresentation();assert.equal(retained.analysis_utc,start);assert.equal(retained.age_seconds,1);assert.equal(f.workspace.verifySampledNetworkPresentation(retained,{utc:codec.advance(start,1)}),true);assert.equal(f.calls.filter(c=>c[0]==='samples').length,requests);
  const [id,tick]=scheduled.entries().next().value;scheduled.delete(id);tick();await flush();assert.equal(f.workspace.networkSampledPresentation().analysis_utc,codec.advance(start,1));assert.equal(scheduled.size,1);
  f.workspace.clearNetworkScene();assert.equal(rendererOptions.sampledNetwork.read({utc:codec.advance(start,1)}),null);f.context({utc:codec.advance(start,2),key:'catalog:scope',source:'catalog'});await flush();assert.equal(rendererOptions.sampledNetwork.read({utc:codec.advance(start,2)}),null);
  f.workspace.setNetworkVisualActive(true);await flush();assert.equal(f.workspace.networkSampledPresentation().analysis_utc,codec.advance(start,2));assert.ok(activation.includes(false));
  f.workspace.observeNetworkInputs();faults=[{kind:'link_loss',target:f.options.store.drafts[0].id}];f.workspace.observeNetworkInputs();await flush();assert.deepEqual(f.workspace.networkSampledPresentation().faults,faults,'actual fault change refreshes sameUTC through existing scheduler');
  const current=f.workspace.networkSampledPresentation();valid=false;listener({phase:'invalidated',reason:'pause'});assert.equal(f.workspace.verifySampledNetworkPresentation(current,{utc:codec.advance(start,2)}),false);assert.notEqual(f.workspace.networkSampledPresentation().status,'valid');
 }finally{f.workspace.destroy();}
});

test('mounted catalog consumer samples once per analysis tick and revokes same-UTC control immediately',async()=>{
 const codec=createUtcCodec(LEAP_SHA256),start=codec.advance('2026-10-04T22:01:12Z',0),lease=Object.freeze({});
 let valid=true,listener=null,sequence=0;const scheduled=new Map();
 const f=fixture({native:true,timers:{set(fn,ms){if(ms===1000){const id=++sequence;scheduled.set(id,fn);return id;}return setTimeout(fn,ms);},clear(id){if(scheduled.has(id))scheduled.delete(id);else clearTimeout(id);}},view:{captureDisplayContinuity:()=>valid?lease:null,verifyDisplayContinuity:value=>valid&&value===lease,observeDisplayContinuity(fn){listener=fn;return()=>{listener=null;};}}});
 const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();await new Promise(resolve=>setTimeout(resolve,15));};
 try{
  await f.workspace.start();f.workspace.show('satellite');f.attach();f.options.store.add({name:'sampled source'});
  f.context({utc:start,key:'catalog:1:hash',source:'catalog'});await flush();
  assert.equal(typeof listener,'function');assert.equal(scheduled.size,1);
  const view=f.options.sampledLinksPresentationFor();assert.equal(view.status,'valid');assert.equal(f.options.verifySampledLinkPresentation(view,{utc:start}),true);
  const before=f.calls.filter(c=>c[0]==='samples').length;
  for(let i=1;i<=100;i++)f.context({utc:codec.advance(start,i/100),key:'catalog:1:hash',source:'catalog'});
  await flush();assert.equal(f.calls.filter(c=>c[0]==='samples').length,before,'natural frames retain analysis rather than query each fractional UTC');
  assert.equal(f.options.sampledLinksPresentationFor().analysis_utc,start);
  const pendingTimer=[...scheduled.entries()][0];scheduled.delete(pendingTimer[0]);pendingTimer[1]();await flush();assert.equal(f.options.sampledLinksPresentationFor().analysis_utc,codec.advance(start,1),'timer advances analysis even when native states are already cached');
  valid=false;listener({phase:'invalidated',reason:'pause'});assert.equal(f.options.verifySampledLinkPresentation(view,{utc:start}),false);
  listener({phase:'settled',reason:'pause'});await flush();assert.notEqual(f.options.sampledLinksPresentationFor().status,'valid');
  f.workspace.destroy();assert.equal(scheduled.size,0);assert.equal(listener,null);
 }finally{f.workspace.destroy();}
});

for(const [width,height] of [[1280,720],[1920,1080]])test(`accepted receipt with denied local persistence preserves drafts and identical reviewed retry ${width}x${height}`,async()=>{
 const records=new Map(),posts=[];let deny=false,server={revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]};
 const storage={getItem:key=>records.get(key)??null,setItem(key,value){if(deny&&key==='spacetwin-nodes-deployed-v1')throw Error('denied');records.set(key,value);}};
 const f=actualWorkspaceFixture(width,height,{hash:'#scene',storage,fetch:async(url,options)=>{if(options.method==='GET')return{ok:true,json:async()=>structuredClone(server)};const p=JSON.parse(options.body);posts.push(p);server={revision:1,run_id:'fixture',scope_id:`fixture:deployment:${p.deployment_id}`,deployment_id:p.deployment_id,nodes:p.nodes};return{ok:true,json:async()=>structuredClone(server)};}});
 try{
  await new Promise(resolve=>setTimeout(resolve,10));await f.get('node-add').dispatch('click');const drafts=f.evaluate('nodeWorkspace.sceneSnapshot().drafts'),before=new Map(records);deny=true;await f.get('nodes-deploy').dispatch('click');
  for(let i=0;i<60&&f.evaluate('nodeWorkspace.snapshot().deployment.busy');i++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().drafts'),drafts);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().deployed'),[]);assert.deepEqual(records,before);assert.match(f.get('deploy-state').textContent,/저장/);assert.equal(f.get('nodes-reapply').disabled,false);
  deny=false;await f.get('nodes-reapply').dispatch('click');for(let i=0;i<60&&f.evaluate('nodeWorkspace.snapshot().deployment.busy');i++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.deepEqual(posts[1],posts[0]);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().deployed'),drafts);assert.equal(f.evaluate('nodeWorkspace.sceneSnapshot().deployment_confirmed'),true);await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});

for(const failure of ['timeout','dispose'])test(`actual V6 ${failure} rejects a transport ignoring abort and its late accepted receipt`,async()=>{
 const records=new Map(),timers=new Map(),posts=[];let sequence=0,resolveReply,signal;
 const storage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
 const empty={revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]};
 const response=p=>({ok:true,json:async()=>({revision:1,run_id:'fixture',scope_id:`fixture:deployment:${p.deployment_id}`,deployment_id:p.deployment_id,nodes:p.nodes})});
 const f=actualWorkspaceFixture(1280,720,{hash:'#satellite',storage,setTimeout:(fn,ms)=>{const id=++sequence;if(ms===15000)timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),fetch:async(url,options)=>{if(options.method==='GET')return{ok:true,json:async()=>empty};const p=JSON.parse(options.body);posts.push(p);if(posts.length===1){signal=options.signal;return new Promise(resolve=>resolveReply=()=>resolve(response(p)));}return response(p);}});
 try{
  await new Promise(resolve=>setTimeout(resolve,10));await f.get('node-add').dispatch('click');const before=new Map(records),drafts=f.evaluate('nodeWorkspace.sceneSnapshot().drafts');await f.get('nodes-deploy').dispatch('click');for(let i=0;i<30&&!resolveReply;i++)await Promise.resolve();assert.ok(resolveReply);
  if(failure==='timeout'){assert.equal(timers.size,1);[...timers.values()][0]();}else await f.win.dispatch('pagehide',{persisted:false});assert.equal(signal.aborted,true);resolveReply();for(let i=0;i<30;i++)await Promise.resolve();assert.deepEqual(records,before);assert.equal(timers.size,0);
  if(failure==='timeout'){
   assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().drafts'),drafts);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().deployed'),[]);assert.match(f.get('deploy-state').textContent,/시간 제한/);await f.get('nodes-deploy').dispatch('click');for(let i=0;i<30&&f.evaluate('nodeWorkspace.snapshot().deployment.busy');i++)await Promise.resolve();assert.deepEqual(posts[1],posts[0]);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().deployed'),drafts);await f.win.dispatch('pagehide',{persisted:false});
  }else assert.equal(f.evaluate('nodeWorkspace.sceneSnapshot()'),null);
 }finally{f.dispose();}
});

test('actual conflicting server-only deployment can be explicitly recalled without creating a draft',async()=>{
 const server={revision:1,run_id:'fixture',scope_id:'fixture:deployment:other',deployment_id:'other',nodes:[{id:'NODE-1',name:'Server-only',mode:'nominal',equipment:[]}]};let posts=0;
 const f=actualWorkspaceFixture(1280,720,{hash:'#scene',fetch:async(url,options)=>{if(options.method==='GET')return{ok:true,json:async()=>server};posts++;const p=JSON.parse(options.body);assert.equal(p.expected_revision,1);assert.deepEqual(p.nodes,[]);return{ok:true,json:async()=>({revision:2,run_id:'fixture',scope_id:`fixture:deployment:${p.deployment_id}`,deployment_id:p.deployment_id,nodes:[]})};}});
 try{
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(posts,0);assert.equal(f.get('nodes-recall').disabled,true);const recall=f.doc.getElementById('nodes-recall-reviewed');assert.ok(recall);assert.equal(recall.disabled,false);assert.match(f.get('node-server-configuration').textContent,/Server-only/);
  await recall.dispatch('click');for(let i=0;i<60&&f.evaluate('nodeWorkspace.snapshot().deployment.busy');i++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.equal(posts,1);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().drafts'),[]);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().deployed'),[]);assert.equal(f.evaluate('nodeWorkspace.sceneSnapshot().deployment_confirmed'),true);assert.equal(recall.disabled,true);await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});

for(const [width,height] of [[1280,720],[1920,1080]])test(`actual V6409 preserves drafts and offers explicit reapply after server review ${width}x${height}`,async()=>{
 let server={revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]},posts=0;const requests=[];
 const f=actualWorkspaceFixture(width,height,{hash:'#satellite',fetch:async(url,options)=>{requests.push({method:options.method,body:options.body});if(options.method==='GET')return{ok:true,json:async()=>structuredClone(server)};
  const p=JSON.parse(options.body);posts++;if(posts===1){server={revision:1,run_id:'fixture',scope_id:'fixture:deployment:other',deployment_id:'other',nodes:p.nodes.map(n=>({...n,name:'Other server draft'}))};return{ok:false,status:409,json:async()=>({detail:'configuration conflict'})};}
  assert.equal(p.expected_revision,1);server={revision:2,run_id:'fixture',scope_id:`fixture:deployment:${p.deployment_id}`,deployment_id:p.deployment_id,nodes:p.nodes};return{ok:true,json:async()=>structuredClone(server)};
 }});
 try{
  await new Promise(resolve=>setTimeout(resolve,10));await f.get('node-add').dispatch('click');const drafts=f.evaluate('nodeWorkspace.sceneSnapshot().drafts');await f.get('nodes-deploy').dispatch('click');
  for(let i=0;i<60&&f.evaluate('nodeWorkspace.snapshot().deployment.busy');i++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.equal(posts,1);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().drafts'),drafts);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().deployed'),[]);assert.equal(f.get('nodes-deploy').disabled,true);
  const reapply=f.doc.getElementById('nodes-reapply');assert.ok(reapply);assert.equal(reapply.disabled,false);assert.match(f.get('deploy-state').textContent,/conflict|충돌/);assert.match(f.get('node-server-configuration').textContent,/Other server draft/);
  await reapply.dispatch('click');for(let i=0;i<60&&f.evaluate('nodeWorkspace.snapshot().deployment.busy');i++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.equal(posts,2);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().deployed'),drafts);assert.equal(f.evaluate('nodeWorkspace.sceneSnapshot().deployment_confirmed'),true);assert.equal(f.get('nodes-reapply').disabled,true);assert.deepEqual(requests.map(r=>r.method),['GET','POST','GET','POST']);
  await f.win.dispatch('pagehide',{persisted:false});assert.equal(reapply.listeners.get('click').size,0);
 }finally{f.dispose();}
});

for(const [width,height] of [[1280,720],[1920,1080]])test(`lost accepted reply retries identical request; restored copy remains unconfirmed and GET-only ${width}x${height}`,async()=>{
 const records=new Map(),posts=[];let server={revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]};
 const storage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
 const fetch=async(url,options)=>{if(options.method==='GET')return{ok:true,json:async()=>structuredClone(server)};const p=JSON.parse(options.body);posts.push(p);if(posts.length===1){server={revision:1,run_id:'fixture',scope_id:`fixture:deployment:${p.deployment_id}`,deployment_id:p.deployment_id,nodes:p.nodes};throw Error('lost accepted reply');}return{ok:true,json:async()=>structuredClone(server)};};
 const f=actualWorkspaceFixture(width,height,{hash:'#satellite',storage,fetch});let drafts;
 try{
  await new Promise(resolve=>setTimeout(resolve,10));await f.get('node-add').dispatch('click');drafts=f.evaluate('nodeWorkspace.sceneSnapshot().drafts');
  await f.get('nodes-deploy').dispatch('click');for(let i=0;i<60&&f.evaluate('nodeWorkspace.snapshot().deployment.busy');i++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().deployed'),[]);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().drafts'),drafts);assert.match(f.get('deploy-state').textContent,/lost accepted reply/);
  await f.get('nodes-deploy').dispatch('click');for(let i=0;i<60&&f.evaluate('nodeWorkspace.snapshot().deployment.busy');i++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.deepEqual(posts[1],posts[0]);assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().deployed'),drafts);assert.equal(f.evaluate('nodeWorkspace.sceneSnapshot().deployment_confirmed'),true);await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
 const before=posts.length,g=actualWorkspaceFixture(width,height,{hash:'#composer',storage,fetch});try{
  await new Promise(resolve=>setTimeout(resolve,10));assert.deepEqual(g.evaluate('nodeWorkspace.sceneSnapshot().drafts'),drafts);assert.deepEqual(g.evaluate('nodeWorkspace.sceneSnapshot().deployed'),drafts);assert.equal(g.evaluate('nodeWorkspace.sceneSnapshot().deployment_confirmed'),false);assert.equal(posts.length,before);assert.match(g.get('node-scene-summary').textContent,/배치 수락 미확인/);
  await g.win.dispatch('pagehide',{persisted:false});
 }finally{g.dispose();}
});

test('scene snapshot copies the original draft/deployment definitions and never treats passive restore as acceptance',async()=>{
 const f=fixture();await f.workspace.start();f.workspace.show('scene');assert.equal(f.sections.get('satellite-nodes')?.hidden,false);
 f.options.store.add({name:'Shared scene'});const s=f.workspace.sceneSnapshot();assert.equal(s.drafts[0].name,'Shared scene');assert.equal(s.selected_id,s.drafts[0].id);assert.deepEqual(s.deployed,[]);assert.equal(s.deployment_confirmed,false);assert.equal(s.display,null);
 s.drafts[0].name='foreign';s.server.nodes.push({id:'foreign'});assert.equal(f.workspace.sceneSnapshot().drafts[0].name,'Shared scene');assert.deepEqual(f.workspace.sceneSnapshot().server.nodes,[]);
 f.workspace.show('composer');assert.equal(f.sections.get('satellite-nodes').hidden,false);assert.equal(f.options.store.drafts.length,1);assert.deepEqual(f.calls.filter(c=>c[0]==='http').map(c=>c[2]),['GET']);
 f.workspace.destroy();assert.equal(f.workspace.sceneSnapshot(),null);
});

for(const view of ['scene','composer'])test(`actual V6 ${view} shares source node editor and readonly review snapshot`,async()=>{
 const f=actualWorkspaceFixture(1280,720,{hash:'#'+view});try{
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(f.get('satellite-nodes').hidden,false);await f.get('node-add').dispatch('click');
  assert.equal(f.get('node-count').textContent,'1');assert.match(f.get('node-scene-summary').textContent,/초안 1/);assert.match(f.get('node-scene-summary').textContent,/수락 배치 0/);
  const s=f.evaluate('nodeWorkspace.sceneSnapshot()');assert.equal(s.drafts.length,1);assert.deepEqual(s.deployed,[]);assert.match(f.get('node-scene-definitions').textContent,/'?schema"?:\s*1/);
  const count=f.counts().commands;f.evaluate("showWorkspaceOrbit('satellite')");assert.equal(f.get('node-count').textContent,'1');assert.equal(f.counts().commands,count);assert.equal(f.viewers.length,1);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});

for(const [width,height] of [[1280,720],[1920,1080]])test(`restored source definitions survive actual scene/composer screen reconstruction ${width}x${height}`,async()=>{
 const records=new Map();const storage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
 const seed=fixture({storage});await seed.workspace.start();seed.workspace.show('satellite');seed.options.store.add({name:'Restored source'});const expected=seed.options.store.drafts;seed.workspace.destroy();
 const requests=[],f=actualWorkspaceFixture(width,height,{hash:'#scene',storage,fetch:async(url,options)=>{requests.push(options.method);return{ok:true,json:async()=>({revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]})};}});
 try{
  await new Promise(resolve=>setTimeout(resolve,10));const oldRoot=f.get('satellite-nodes');const before=f.counts().commands;
  assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().drafts'),expected);assert.match(f.get('node-scene-definitions').textContent,/Restored source/);
  f.evaluate("location.hash='#composer'");await f.win.dispatch('hashchange');assert.equal(oldRoot.isConnected,false);assert.notEqual(f.get('satellite-nodes'),oldRoot);
  assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().drafts'),expected);assert.equal(f.get('node-count').textContent,'1');assert.match(f.get('node-scene-definitions').textContent,/Restored source/);
  f.evaluate("location.hash='#satellite'");await f.win.dispatch('hashchange');assert.deepEqual(f.evaluate('nodeWorkspace.sceneSnapshot().drafts'),expected);assert.deepEqual(requests,['GET']);assert.equal(f.counts().commands,before);assert.equal(f.viewers.length,1);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});

for(const [width,height] of [[1280,720],[1920,1080]])test(`actual V6 source node hover uses one card and expires with owned geometry ${width}x${height}`,async()=>{
 const codec=createUtcCodec(LEAP_SHA256);let samples=0;
 const f=actualWorkspaceFixture(width,height,{hash:'#satellite',setTimeout,clearTimeout,nodeSamples:async p=>{samples++;return{schema_version:1,...NODE_COMMUNICATION_METADATA,request_id:p.request_id,status:'valid',nodes:p.nodes.map(node=>({node_id:node.id,definition_hash:'a'.repeat(64),rows:Array.from({length:p.count},(_,i)=>({utc:codec.advance(p.start_utc,i),status:'valid',error_code:null,position_m:[7000000,2,3],inertial_position_km:[7000,0,0],lvlh_basis:{x:[1,0,0],y:[0,1,0],z:[0,0,1]},inertial_velocity_km_s:[0,7.5,0],raan_deg:0,argp_deg:0,mean_anomaly_deg:0,sunlit:true,longitude_deg:0,latitude_deg:0,height_km:550}))}))};}});
 try{
  await new Promise(resolve=>setTimeout(resolve,10));await f.get('node-add').dispatch('click');let point;
  for(let i=0;i<60;i++){await new Promise(resolve=>setTimeout(resolve,5));f.viewers[0].scene.preRender.raise();point=f.viewers[0].primitives.flatMap(p=>p.items??[]).find(p=>p.id?.nodeId&&p.show);if(point)break;}
  assert.ok(point,'accepted current source geometry must reach the actual renderer');
  f.viewers[0].scene.pick=()=>({id:point.id,primitive:point});const before=samples;
  f.pickHandlers[0].move({endPosition:{x:100,y:120}});
  const cards=f.get('stored-orbit-globe').children.filter(c=>c.className==='satellite-hover-card');assert.equal(cards.length,1);const card=cards[0];assert.equal(card.hidden,false);
  assert.match(card.children[1].textContent,/550\.000 km/);assert.doesNotMatch(card.children[1].textContent,/NORAD/);assert.match(card.children[2].textContent,/GMST\/UTC 근사/);assert.match(card.children[2].textContent,/2020-07-12T21:16:01/);
  assert.ok(Number.isFinite(parseFloat(card.style.left)));assert.equal(samples,before);assert.equal(f.viewers.length,1);assert.equal(f.pickHandlers.length,1);
  point.show=false;f.viewers[0].scene.mode=0;f.viewers[0].scene.preRender.raise();assert.equal(card.hidden,true);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});

function fixture({native=false,solar=null,view=null,storage=null,storageGetter=null,fetchOverride=null,onHover=()=>{},networkInputs=null,readClock=()=>({}),networkSceneClass=null,panelRefresh=null,onSampleRequest=null,sceneUpdate=null,sceneLinks=null,timers=null}={}){
 let id=0,context=null,displayListener,rendererFactory,panelOptions,interaction,renderer,removeCount=0;const calls=[],sections=new Map();
 const host={innerWidth:1280,innerHeight:720,localStorage:storage,crypto:{randomUUID:()=>`test-${++id}`},setTimeout,clearTimeout,addEventListener(){},removeEventListener(){},confirm:()=>true};
 if(timers){host.setTimeout=timers.set;host.clearTimeout=timers.clear;}
 if(storageGetter)Object.defineProperty(host,'localStorage',{get:storageGetter});
 const buttons=new Map(['nodes-deploy','nodes-recall','nodes-reapply','nodes-recall-reviewed','deploy-state','node-server-configuration','node-scene-summary'].map(key=>[key,{disabled:false,textContent:'',addEventListener(k,fn){this.fn=fn;},removeEventListener(){}}]));
 const document={getElementById:id=>id==='screen'?{prepend:root=>sections.set(root.id,root)}:sections.get(id)??null,createElement:()=>({querySelector:selector=>buttons.get(selector.slice(1))??null,remove(){sections.delete(this.id);}})};
 const globe={observeDisplayContext(fn){displayListener=fn;fn(context);return()=>removeCount++;},bindNodeRenderer(fn){rendererFactory=fn;return()=>removeCount++;},nodeRendererState:()=>({phase:'ready'}),observeNodeRenderer:()=>()=>removeCount++,setSatelliteModel:(...v)=>calls.push(['model',...v]),clearSatelliteModel:()=>calls.push(['clear']),focusSatelliteModel:()=>{calls.push(['focus']);return true;},releaseSatelliteModel:()=>calls.push(['release'])};
 globe.bindNodeInteraction=value=>{interaction=value;return()=>removeCount++;};
 const Scene=class{constructor(options){this.options=options;this.points=new Map();this.labels=new Map();this.models=new Map();}async setNodes(entries){calls.push(['nodes',entries]);this.points=new Map(entries.map(entry=>[entry.id,{show:true}]));}setTheme(value){calls.push(['theme',value]);}setHovered(id){calls.push(['hover',id]);}select(id){calls.push(['select',id]);}setLinks(value){sceneLinks?.(value);}update(){sceneUpdate?.();}destroy(){calls.push(['destroy']);}syncFrame(){}setLinksVisible(){}setModelsVisible(){}};
 const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++id}`});
 const tools={workPanelMarkup:()=>'<panel>',createNodeWorkPanel(options){panelOptions=options;return{refresh(){panelRefresh?.(options);},destroy(){calls.push(['panel-destroy']);}};}};
 const fetchImpl=async(url,options)=>{calls.push(['http',url,options.method]);if(fetchOverride)return fetchOverride(url,options);return{ok:true,json:async()=>({revision:0,run_id:'run',scope_id:'run:unconfigured',deployment_id:null,nodes:[]})};};
 const codec=createUtcCodec(LEAP_SHA256),row=utc=>({utc,status:'valid',error_code:null,position_m:[7000000,2,3],inertial_position_km:[7000,0,0],lvlh_basis:{x:[1,0,0],y:[0,1,0],z:[0,0,1]},inertial_velocity_km_s:[0,7.5,0],raan_deg:0,argp_deg:0,mean_anomaly_deg:0,sunlit:true,longitude_deg:0,latitude_deg:0,height_km:550});
 const api={nodeSamples:async p=>{calls.push(['samples']);await onSampleRequest?.(p);if(!native)throw Error('test unavailable');return{schema_version:1,...NODE_COMMUNICATION_METADATA,request_id:p.request_id,status:'valid',nodes:p.nodes.map(node=>({node_id:node.id,definition_hash:'a'.repeat(64),rows:Array.from({length:p.count},(_,i)=>row(codec.advance(p.start_utc,i)))}))};},nodeTrack:async p=>{if(!native)throw Error('test unavailable');return{schema_version:1,...NODE_COMMUNICATION_METADATA,request_id:p.request_id,status:'valid',nodes:p.nodes.map(node=>{const period=Math.round(orbitElements(node.orbit).period/60*1000)/1000;return{node_id:node.id,definition_hash:'a'.repeat(64),period_minutes:period,path_visible:true,rows:Array.from({length:121},(_,i)=>row(codec.advance(new Date(Math.trunc(Date.parse(p.center_utc)+(i-60)*period*60000/120)).toISOString(),0)))};})};}};
 if(view)Object.assign(globe,view);
 const network=networkInputs?{...networkInputs,model:createNetworkSnapshotModel({library,oisl,groundLinks:createGroundLinkModel({library,stationModel})}),validateStation:stationModel.validateStation}:null;
 const workspace=createWorkspaceNodes({api,globe,solar,library,orbitElements,catalogElements,oisl,Scene,tools,document,host,now:()=>1791151272000,resolveModel:()=>({key:'flat',url:'/flat.glb'}),models:()=>[],fetchImpl,onHover,networkInputs:network,readClock,...(networkSceneClass?{NetworkScene:networkSceneClass}:{})});
 return{workspace,host,globe,calls,buttons,sections,context(value){context=value;displayListener(value);},get options(){return panelOptions;},get interaction(){return interaction;},get renderer(){return renderer;},attach(){return renderer=rendererFactory({},{});},get removeCount(){return removeCount;}};
}

test('existing workspace owns network join and verifies copied ground-only source results without transport or deployment',async()=>{
 const stations=stationModel.DEFAULT_STATION_KEYS.map(preset=>stationModel.createStation({preset}));const events=[];
 const f=fixture({networkInputs:{readStations:()=>stations,readFaults:()=>[],onChange:value=>events.push(value)}});
 await f.workspace.start();f.context({utc:'2026-10-04T22:01:12.000000000Z'});
 assert.equal(f.workspace.networkSnapshot().status,'unavailable');
 const result=await f.workspace.updateNetwork();assert.equal(result.status,'valid');
 assert.equal(result.network.nodes.length,3);assert.equal(result.network.links.length,3);
 assert.equal(f.workspace.verifyNetworkSnapshot(result),true);
 result.network.nodes[0].name='tampered';assert.equal(f.workspace.verifyNetworkSnapshot(result),false);
 assert.equal(f.calls.some(c=>c[0]==='samples'),false);assert.equal(f.calls.filter(c=>c[0]==='http').every(c=>c[2]==='GET'),true);
 const accepted=f.workspace.networkSnapshot();stations[0].dish_m=11;
 assert.equal(f.workspace.verifyNetworkSnapshot(accepted),false);assert.equal(f.workspace.networkSnapshot().status,'unavailable');
 assert.equal((await f.workspace.updateNetwork()).status,'valid');assert.ok(events.length);
 f.context({utc:'2026-10-04T22:01:12.000000000Z'});
 assert.equal(f.workspace.networkSnapshot().status,'valid','repeated common-context event with unchanged UTC retains accepted proof');
 f.context(null);assert.equal(f.workspace.networkSnapshot().status,'error');
 f.workspace.destroy();assert.equal(await f.workspace.updateNetwork(),null);assert.equal(f.workspace.verifyNetworkSnapshot(accepted),false);
});

test('failed ground or SIM input reader revokes workspace network proof and rejects stale roster use',async()=>{
 let failed=false;const stations=stationModel.DEFAULT_STATION_KEYS.map(preset=>stationModel.createStation({preset}));
 const f=fixture({networkInputs:{readStations:()=>{if(failed)throw Error('지상국 불러오기 실패');return stations;},readFaults:()=>[]}});
 await f.workspace.start();f.context({utc:'2026-10-04T22:01:12.000000000Z'});
 const accepted=await f.workspace.updateNetwork();assert.equal(accepted.status,'valid');
 failed=true;assert.equal(f.workspace.verifyNetworkSnapshot(accepted),false);
 assert.match((await f.workspace.updateNetwork()).error,/지상국 불러오기 실패/);
 failed=false;assert.equal((await f.workspace.updateNetwork()).status,'valid');f.workspace.destroy();
});

test('network join cannot create an independent node store, UTC authority or renderer',async()=>{
 const f=fixture({networkInputs:{readStations:()=>[],readFaults:()=>[]}});await f.workspace.start();
 f.workspace.show('satellite');f.options.store.add({name:'native required'});f.context({utc:'2026-10-04T22:01:12.000000000Z'});
 const before=f.workspace.sceneSnapshot().drafts;
 const result=await f.workspace.updateNetwork();assert.equal(result.status,'error');assert.equal(result.network,null);
 assert.deepEqual(f.workspace.sceneSnapshot().drafts,before);assert.equal(f.workspace.snapshot().display.utc,'2026-10-04T22:01:12.000000000Z');
 assert.equal(f.calls.some(c=>c[0]==='focus'),false);assert.equal(f.calls.filter(c=>c[0]==='http').every(c=>c[2]==='GET'),true);
 f.workspace.destroy();
});

test('mounted native node hover publishes copied current geometry without queries and clears unknown/disposed cases',async()=>{
 const seen=[],f=fixture({native:true,onHover:value=>seen.push(value)});await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'Native node'});f.attach();const node=f.options.store.selected;
 f.context({utc:'2026-10-04T22:01:12.000000000Z'});for(let i=0;i<40&&!f.interaction.owns(node.id,f.renderer.points.get(node.id));i++)await new Promise(resolve=>setTimeout(resolve,5));
 const count=f.calls.filter(c=>c[0]==='samples').length;f.interaction.onHover(node.id,{x:10,y:20});const p=seen.at(-1);assert.equal(p.kind,'source_node');assert.equal(p.item.OBJECT_NAME,node.name);assert.equal(p.node_geometry.row.utc,'2026-10-04T22:01:12.000000000Z');assert.equal(p.node_geometry.frame,'EARTH_FIXED_GMST_UTC_APPROX');assert.equal(f.calls.filter(c=>c[0]==='samples').length,count);
 p.node_geometry.row.position_m[0]=0;f.interaction.onHover(node.id,{x:10,y:20});assert.equal(seen.at(-1).node_geometry.row.position_m[0],7000000);
 f.context(null);f.interaction.onHover(node.id,{x:10,y:20});assert.equal(seen.at(-1),null);f.workspace.destroy();assert.equal(seen.at(-1),null);const n=seen.length;f.interaction.onHover(node.id,{x:10,y:20});assert.equal(seen.length,n);
});

test('damaged draft restore mounts an error without replacing bytes and explicit retry recovers read-only',async()=>{
 let raw='broken',writes=0;const f=fixture({storage:{getItem:key=>key==='spacetwin-nodes-draft-v1'?raw:null,setItem(){writes++;}}});
 await assert.doesNotReject(f.workspace.start());f.workspace.show('satellite');assert.ok(f.sections.get('satellite-nodes'));assert.match(f.workspace.snapshot().error,/손상/);assert.equal(f.options.store.loaded,false);assert.equal(raw,'broken');assert.equal(writes,0);
 assert.equal(f.buttons.get('nodes-deploy').disabled,true);raw=JSON.stringify({schema:1,nodes:[],sequence:0,selectedId:null,revision:0});
 await f.workspace.retryRestore();assert.equal(f.options.store.loaded,true);assert.equal(f.workspace.snapshot().error,'');assert.equal(writes,0);assert.equal(f.calls.filter(c=>c[0]==='http').every(c=>c[2]==='GET'),true);
 f.workspace.destroy();await f.workspace.retryRestore();assert.equal(writes,0);
});

test('denied storage property mounts safely and retry recovers after access returns',async()=>{
 let denied=true,writes=0;const f=fixture({storageGetter:()=>{if(denied)throw Error('denied');return{getItem:()=>null,setItem(){writes++;}};}});
 await f.workspace.start();f.workspace.show('satellite');assert.match(f.workspace.snapshot().error,/읽을 수/);assert.equal(f.options.store.loaded,false);assert.equal(f.calls.some(c=>c[0]==='http'),false);
 denied=false;await f.workspace.retryRestore();assert.equal(f.options.store.loaded,true);assert.equal(f.workspace.snapshot().error,'');assert.equal(writes,0);f.workspace.destroy();
});

test('server retry is single-flight and GET-only while retaining restored edited drafts',async()=>{
 let fail=true,finish;const f=fixture({fetchOverride:async()=>{if(fail)throw Error('offline');return new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({revision:0,run_id:'run',scope_id:'run:unconfigured',deployment_id:null,nodes:[]})});});}});
 await f.workspace.start();f.workspace.show('satellite');const node=f.options.store.add({name:'keep'});assert.match(f.workspace.snapshot().error,/offline/);fail=false;
 const first=f.workspace.retryRestore(),second=f.workspace.retryRestore();assert.equal(first,second);for(let i=0;i<10&&!finish;i++)await Promise.resolve();finish();await first;
 assert.equal(f.options.store.selected.name,node.name);assert.equal(f.workspace.snapshot().error,'');assert.equal(f.calls.filter(c=>c[0]==='http').length,2);assert.equal(f.calls.filter(c=>c[0]==='http').every(c=>c[2]==='GET'),true);f.workspace.destroy();
});

test('source node lighting reads shared preference and delegates without another state owner',async()=>{
 let enabled=false,observer,removed=0,writes=0;const solar={state:()=>({enabled}),observe(fn){observer=fn;fn({enabled});return()=>removed++;},setEnabled(value){enabled=value;writes++;observer({enabled});return true;}};
 const f=fixture({solar});await f.workspace.start();f.workspace.show('satellite');assert.equal(f.options.readScene().lighting,false);assert.equal(writes,0);
 assert.equal(f.options.actions.setLighting(true),true);assert.equal(f.options.readScene().lighting,true);assert.equal(writes,1);
 enabled=false;observer({enabled});assert.equal(f.options.readScene().lighting,false);assert.equal(writes,1);
 f.workspace.destroy();assert.equal(removed,1);assert.equal(f.options.actions.setLighting(true),false);assert.equal(writes,1);
});

test('mounted node renderer receives common theme, palette and queued morph state without replacing definitions',async()=>{
 let choice={theme:'light'},mode={phase:'ready'},viewObserver;
 const view={viewState:()=>({choice:{...choice},mode:{...mode}}),observeView:fn=>{viewObserver=fn;fn(view.viewState());return()=>{};},palette:theme=>({LEO:theme==='light'?'#c9651a':'#ff9f43'})};const f=fixture({view});
 await f.workspace.start();f.workspace.show('satellite');const scene=f.attach();
 assert.deepEqual(scene.options.palette('light'),{LEO:'#c9651a'});assert.equal(scene.options.isTransitioning(),false);assert.equal(f.calls.some(c=>c[0]==='theme'&&c[1]==='light'),true);
 const before=f.calls.filter(c=>c[0]==='nodes').length;choice.theme='dark';mode.phase='pending';viewObserver(f.globe.viewState());
 assert.equal(scene.options.isTransitioning(),true);assert.equal(f.calls.filter(c=>c[0]==='nodes').length,before);assert.equal(f.calls.at(-1)[0],'theme');assert.equal(f.calls.at(-1)[1],'dark');
 mode.phase='ready';viewObserver(f.globe.viewState());assert.equal(scene.options.isTransitioning(),false);f.workspace.destroy();
});

test('mounted renderer receives the existing native-owner readonly port and disposal revokes its borrowed packets',async()=>{
 const f=fixture({native:true});await f.workspace.start();f.workspace.show('satellite');const scene=f.attach(),port=scene.options.displayGeometry;assert.ok(port);assert.equal(port.revision(),null);
 f.options.store.add({name:'readonly source'});const node=f.options.store.drafts[0],codec=createUtcCodec(LEAP_SHA256),utc=codec.advance('2026-10-04T22:01:12Z',0);f.context({key:'fixture',utc});
 for(let i=0;i<100&&!port.revision();i++)await new Promise(resolve=>setTimeout(resolve,2));
 const view=port.viewFor(node),packet=port.sampleAt(view,utc);assert.ok(packet);assert.equal(port.verifySample(view,packet,utc),true);
 const copy=scene.options.geometryFor(node,{utc});copy.row.position_m[0]=0;assert.equal(packet.row.position_m[0],7000000);assert.equal(f.calls.filter(c=>c[0]==='http').every(c=>c[2]==='GET'),true);
 f.workspace.destroy();assert.equal(port.revision(),null);assert.equal(port.isCurrent(view),false);assert.equal(port.sampleAt(view,utc),null);assert.equal(port.viewFor(node),null);
});

test('source node panel camera callbacks route to shared owner and reject callbacks after disposal',async()=>{
 const f=fixture();f.globe.cameraState=()=>({ready:true,zoom:42});
 f.globe.zoomBy=value=>f.calls.push(['wheel',value]);f.globe.setZoom=value=>f.calls.push(['zoom',value]);f.globe.home=()=>f.calls.push(['home']);
 await f.workspace.start();f.workspace.show('satellite');assert.equal(f.options.readScene().zoom,42);
 f.options.actions.zoomBy(120);f.options.actions.setZoom(70);f.options.actions.home();
 assert.deepEqual(f.calls.slice(-3),[['wheel',120],['zoom',70],['home']]);
 const held=f.options.actions;f.workspace.destroy();const count=f.calls.length;held.home();held.setZoom(20);held.zoomBy(-120);assert.equal(f.calls.length,count);
});
test('source node workspace starts with readonly GET, mounts existing panel and never deploys or focuses passively',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);await f.workspace.start();assert.deepEqual(f.calls.filter(c=>c[0]==='http').map(c=>c[2]),['GET']);
 f.workspace.show('satellite');assert.ok(f.sections.has('satellite-nodes'));assert.ok(f.options.store);f.options.store.add({name:'test'});
 f.attach();assert.equal(f.calls.some(c=>c[0]==='focus'),false);assert.equal(f.calls.some(c=>c[0]==='samples'),false);
 f.workspace.show('ground');assert.equal(f.sections.get('satellite-nodes').hidden,true);f.workspace.destroy();assert.equal(f.sections.size,0);assert.equal(f.removeCount,4);
});
test('accepted native buffers drive the mounted source selection and explicit focus through the existing globe',async()=>{
 const f=fixture({native:true});await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'test'});f.attach();
 f.options.onSelected(f.options.store.selected);f.context({utc:'2026-10-04T22:01:12.000000000Z'});
 for(let i=0;i<40&&!f.calls.some(c=>c[0]==='model');i++)await new Promise(resolve=>setTimeout(resolve,5));
 const model=f.calls.find(c=>c[0]==='model');assert.ok(model);assert.equal(model[1].pose_source.kind,'source_node');
 const pose=model[2].sampleAt('2026-10-04T22:01:12.000000000Z');assert.deepEqual(pose.row.position_m,[7000000,2,3]);assert.equal(pose.frame,'EARTH_FIXED_GMST_UTC_APPROX');
 assert.equal(f.calls.some(c=>c[0]==='focus'),false);assert.equal(await f.options.onFocus(),true);assert.equal(f.calls.filter(c=>c[0]==='focus').length,1);
 f.options.store.update(f.options.store.selectedId,{...f.options.store.selected,name:'edited'});assert.equal(model[2].sampleAt('2026-10-04T22:01:12.000000000Z'),null);
 f.context(null);assert.equal(await f.options.onFocus(),false);f.workspace.destroy();assert.equal(f.calls.filter(c=>c[0]==='http').every(c=>c[2]==='GET'),true);
});
test('mounted node picking validates current buffer and actual owned primitive before selection',async()=>{
 const f=fixture({native:true});await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'test'});f.attach();
 const node=f.options.store.selected,point=f.renderer.points.get(node.id);assert.equal(f.interaction.owns(node.id,point),false);
 f.context({utc:'2026-10-04T22:01:12.000000000Z'});for(let i=0;i<40&&!f.interaction.owns(node.id,point);i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(f.interaction.owns(node.id,point),true);assert.equal(f.interaction.owns(node.id,{show:true}),false);
 f.interaction.onSelect(node.id);assert.equal(f.calls.some(c=>c[0]==='focus'),false);f.interaction.onHover(node.id);assert.deepEqual(f.calls.at(-1),['hover',node.id]);
 f.context(null);assert.equal(f.interaction.owns(node.id,point),false);f.workspace.destroy();assert.equal(f.interaction.owns(node.id,point),false);
});
test('missing display UTC and native failure cannot produce a model pose or dispatch focus',async()=>{
 const f=fixture();await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'test'});f.attach();
 assert.equal(await f.options.onFocus(),false);assert.equal(f.calls.some(c=>c[0]==='model'),false);
 f.context({utc:'2026-10-04T22:01:12.000000000Z'});await new Promise(resolve=>setTimeout(resolve,30));assert.equal(f.calls.some(c=>c[0]==='samples'),true);
 assert.equal(f.calls.some(c=>c[0]==='model'),false);assert.equal(await f.options.onFocus(),false);f.workspace.destroy();
});
test('real V6 assembly mounts the original work panel, binds add editor and remains read-only on restore',async()=>{
 const requests=[],f=actualWorkspaceFixture(1280,720,{hash:'#satellite',fetch:async(url,options)=>{requests.push([url,options.method]);return{ok:true,json:async()=>({revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]})};}});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.ok(f.doc.getElementById('satellite-nodes'));assert.match(f.get('satellite-nodes').innerHTML,/Walker Δ/);
 assert.equal(f.get('node-count').textContent,'0');assert.deepEqual(requests,[['/api/data-management/deployment','GET']]);
 assert.equal(f.evaluate('nodeClock.read(nodeWorkspace.snapshot().display).mode'),'저장 궤도');
 await f.get('node-add').dispatch('click');assert.equal(f.get('node-count').textContent,'1');assert.equal(f.get('node-editor').hidden,false);
 assert.equal(requests.length,1);await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.get('satellite-nodes').isConnected,false);f.dispose();
});

for(const [width,height] of [[1280,720],[1920,1080]])test(`actual V6 node lighting and common view controls share preferences without orbit/SIM commands ${width}x${height}`,async()=>{
 const f=actualWorkspaceFixture(width,height,{hash:'#satellite'});
 try{
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(f.evaluate('globe.nodeRendererState().phase'),'ready');
  const before=f.counts();assert.equal(f.get('node-lighting').attributes['aria-pressed'],'true');
  await f.get('node-lighting').dispatch('click');assert.equal(f.evaluate('solar.state().enabled'),false);assert.equal(f.get('globe-lighting').checked,false);
  f.get('globe-lighting').checked=true;await f.get('globe-lighting').dispatch('change');assert.equal(f.get('node-lighting').attributes['aria-pressed'],'true');
  f.get('globe-theme').value='light';await f.get('globe-theme').dispatch('change');assert.equal(f.evaluate('globe.viewState().choice.theme'),'light');assert.equal(f.evaluate('solar.state().enabled'),true);
  f.get('globe-mode').value='2d';await f.get('globe-mode').dispatch('change');assert.equal(f.viewers[0].scene.mode,2);assert.equal(f.evaluate('globe.viewState().mode.phase'),'ready');assert.equal(f.counts().commands,before.commands);
  f.get('globe-mode').value='3d';await f.get('globe-mode').dispatch('change');assert.equal(f.viewers.length,1);assert.equal(f.viewers[0].scene.mode,3);
  await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.get('node-lighting').listeners.get('click').size,0);
 }finally{f.dispose();}
});

for(const [width,height] of [[1280,720],[1920,1080]])test(`actual V6 damaged restore retry keeps bytes and cryptographic IDs work without randomUUID ${width}x${height}`,async()=>{
 let raw='broken',writes=0,reads=0,sequence=0;
 const storage={getItem:key=>key==='spacetwin-nodes-draft-v1'?raw:null,setItem(key,value){writes++;if(key==='spacetwin-nodes-draft-v1')raw=value;}};
 const f=actualWorkspaceFixture(width,height,{hash:'#satellite',storage,crypto:{getRandomValues(bytes){bytes.fill(0);bytes[15]=++sequence;return bytes;}},fetch:async()=>{reads++;return{ok:true,json:async()=>({revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]})};}});
 try{
  await new Promise(resolve=>setTimeout(resolve,10));assert.match(f.get('deploy-state').textContent,/손상/);assert.equal(raw,'broken');assert.equal(writes,0);assert.equal(reads,0);
  const retry=f.get('nodes-restore');assert.equal(retry.disabled,false);raw=JSON.stringify({schema:1,nodes:[],sequence:0,selectedId:null,revision:0});await retry.dispatch('click');
  for(let i=0;i<30&&f.evaluate('nodeWorkspace.snapshot().error');i++)await Promise.resolve();
  assert.equal(f.evaluate('nodeWorkspace.snapshot().error'),'');assert.equal(writes,0);assert.equal(reads,1);assert.equal(f.get('nodes-restore'),retry);
  await f.get('node-add').dispatch('click');assert.equal(f.get('node-count').textContent,'1');assert.ok(sequence>0);assert.equal(f.get('node-editor').hidden,false);
  const drafts=JSON.parse(raw);for(const equipment of drafts.nodes[0].equipment)assert.match(equipment.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await f.win.dispatch('pagehide',{persisted:false});assert.equal(retry.listeners.get('click').size,0);
 }finally{f.dispose();}
});

// Actual HTTP track contract rounds the source n0 period to three decimal minutes.
test('mounted workspace accepts server-rounded source period and retains all121 track vertices',async()=>{
 const f=fixture({native:true});await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'Rounded period'});const scene=f.attach(),node=f.options.store.selected;
 f.context({utc:'2026-10-04T22:01:12.000000000Z'});
 for(let i=0;i<120&&f.workspace.snapshot().timeline.pending;i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(f.workspace.snapshot().timeline.error,'');
 const path=scene.options.pathFor(node);assert.ok(path);assert.equal(path.period_minutes,95.65);assert.equal(path.positions_m.length,121);assert.equal(path.visible,true);
 f.workspace.destroy();
});

test('actual node owner exposes only accepted paused mission inputs and existing optical proof',async()=>{
 let running=false,server={revision:0,run_id:'run',scope_id:'run:unconfigured',deployment_id:null,nodes:[]};
 const f=fixture({native:true,readClock:()=>({running}),fetchOverride:async(url,options)=>{if(options.method==='POST'){const p=JSON.parse(options.body);server={...p,revision:server.revision+1,run_id:'run',scope_id:`run:deployment:${p.deployment_id}`};delete server.expected_revision;}return{ok:true,json:async()=>structuredClone(server)};}});
 try{
  assert.equal(typeof f.workspace.missionInputs,'function');
  assert.throws(()=>f.workspace.missionInputs(),/배치|불러/);
  await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'Mission source'});
  assert.throws(()=>f.workspace.missionInputs(),/배치/);
  await f.buttons.get('nodes-deploy').fn();for(let i=0;i<60&&f.workspace.snapshot().deployment.busy;i++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.throws(()=>f.workspace.missionInputs(),/UTC/);
  f.context({utc:'2020-07-12T21:16:01.000416000Z'});
  const c=f.workspace.missionInputs();assert.equal(c.nodes[0].name,'Mission source');assert.equal(c.deployment.revision,1);
  const proof=await f.workspace.updateMissionLinks();assert.equal(proof.status,'valid',proof.error);
  assert.equal(f.workspace.verifyMissionLinks(proof,{nodes:c.nodes,utc:c.utc}),true);
  assert.equal(f.workspace.verifyMissionLinks(proof,{nodes:[],utc:c.utc}),false);
  c.nodes[0].name='foreign';c.deployment.nodes.length=0;assert.equal(f.workspace.missionInputs().nodes[0].name,'Mission source');
  running=true;assert.throws(()=>f.workspace.missionInputs(),/정지/);running=false;
  f.options.store.update(c.nodes[0].id,{name:'Edited'});assert.throws(()=>f.workspace.missionInputs(),/배치/);
  assert.equal(typeof f.workspace.updateMissionLinks,'function');assert.equal(f.workspace.verifyMissionLinks(null),false);
  f.workspace.destroy();assert.throws(()=>f.workspace.missionInputs(),/배치|불러/);
 }finally{f.workspace.destroy();}
});

test('projected running SIM preserves pose buffers without optical query floods or manual network approval',async()=>{const codec=createUtcCodec(LEAP_SHA256),start=codec.advance('2026-10-04T22:01:12Z',0),f=fixture({native:true,networkInputs:{readStations:()=>[],readFaults:()=>[]}});try{await f.workspace.start();f.workspace.show('satellite');f.attach();f.options.store.add({name:'source'});f.context({utc:start,source:'sim',key:'sim:R'});for(let i=0;i<100&&f.workspace.sceneSnapshot().calculation.pending;i++)await new Promise(resolve=>setTimeout(resolve,2));const before=f.calls.filter(c=>c[0]==='samples').length;for(let i=1;i<=60;i++)f.context({utc:codec.advance(start,i/60),source:'sim',key:'sim:R',projected:true});await new Promise(resolve=>setTimeout(resolve,30));assert.equal(f.calls.filter(c=>c[0]==='samples').length,before,'same accepted native buffer services all projected frames');assert.ok(f.renderer.options.geometryFor(f.options.store.drafts[0],{utc:codec.advance(start,1)}));const answer=await f.workspace.updateNetwork();assert.equal(answer.status,'error');assert.match(answer.error,/보간 SIM/);assert.equal(f.workspace.verifyNetworkSnapshot(answer),false);}finally{f.workspace.destroy();}});

test('node frame guards prefer the authoritative transition query and retain legacy view fallback',async()=>{
 let phase='ready',reads=0;const f=fixture({view:{viewState:()=>({choice:{theme:'dark'},mode:{phase}}),isTransitioning:()=>{reads++;return phase!=='ready';}}});
 try{await f.workspace.start();f.attach();f.globe.viewState=()=>{throw Error('frame guard must not clone full view');};
  for(const value of ['ready','pending','error','ready']){phase=value;assert.equal(f.renderer.options.isTransitioning(),value!=='ready');}
  assert.equal(reads,4);f.globe.isTransitioning=()=>{throw Error('owner query failure');};assert.throws(()=>f.renderer.options.isTransitioning(),/owner query failure/);
 }finally{f.workspace.destroy();}
 const legacy=fixture({view:{viewState:()=>({choice:{theme:'dark'},mode:{phase}})}});try{await legacy.workspace.start();legacy.attach();phase='pending';assert.equal(legacy.renderer.options.isTransitioning(),true);phase='ready';assert.equal(legacy.renderer.options.isTransitioning(),false);}finally{legacy.workspace.destroy();}
});

test('ground network frame guards use the same authoritative transition query',async()=>{
 let captured,phase='ready';const NetworkScene=class{constructor(options){captured=options;}setGroundLinksVisible(){}setCoverageVisible(){}destroy(){}syncFrame(){}};
 const f=fixture({networkInputs:{readStations:()=>[],readFaults:()=>[]},networkSceneClass:NetworkScene,view:{viewState:()=>({choice:{theme:'dark'},mode:{phase}}),isTransitioning:()=>phase!=='ready'}});
 try{await f.workspace.start();f.attach();assert.ok(captured);f.globe.viewState=()=>{throw Error('network guard must not copy view state');};for(const value of ['pending','error','ready']){phase=value;assert.equal(captured.isTransitioning(),value!=='ready');}}finally{f.workspace.destroy();}
});

test('workspace metadata refresh bounds repeated panel errors and keeps the latest error',async()=>{
 let refreshes=0,fail=false;const f=fixture({readClock:()=>{if(fail)throw Error('clock input unavailable');return{};},panelRefresh:options=>{refreshes++;if(!fail)return;try{options.readDisplay();}catch(error){options.onError(error);}options.onError('latest panel error');}});
 try{await f.workspace.start();f.workspace.show('satellite');const before=refreshes;fail=true;f.workspace.refresh();assert.equal(refreshes-before,1,'a reported error must not recursively refresh the whole panel');assert.equal(f.workspace.snapshot().error,'latest panel error');
  const again=refreshes;f.workspace.refresh();assert.equal(refreshes-again,1);assert.equal(f.workspace.snapshot().error,'latest panel error');
 }finally{f.workspace.destroy();}
});

test('workspace refresh stops metadata rendering after disposal inside a panel callback',async()=>{
 let dispose=false,f;f=fixture({panelRefresh:()=>{if(dispose)f.workspace.destroy();}});await f.workspace.start();f.workspace.show('satellite');dispose=true;assert.doesNotThrow(()=>f.workspace.refresh());assert.equal(f.workspace.sceneSnapshot(),null);assert.equal(f.sections.size,0);assert.equal(f.calls.filter(c=>c[0]==='panel-destroy').length,1);assert.doesNotThrow(()=>f.workspace.refresh());
});

test('workspace refresh releases its guard after exceptions and reads post-callback definitions',async()=>{
 let throwNext=false,addNext=false;const f=fixture({panelRefresh:options=>{if(throwNext){throwNext=false;throw Error('panel failure');}if(addNext){addNext=false;options.store.add({name:'added during panel refresh'});}}});
 try{await f.workspace.start();f.workspace.show('satellite');throwNext=true;assert.throws(()=>f.workspace.refresh(),/panel failure/);addNext=true;assert.doesNotThrow(()=>f.workspace.refresh());assert.match(f.buttons.get('node-scene-summary').textContent,/초안 1개/);assert.equal(f.options.store.drafts.length,1);
  f.options.store.add({name:'next operation'});f.workspace.refresh();assert.match(f.buttons.get('node-scene-summary').textContent,/초안 2개/);
 }finally{f.workspace.destroy();}
});

test('communication pending notifications leave fleet and scene intact while actual UTC and optical results refresh them',async()=>{
 const codec=createUtcCodec(LEAP_SHA256);let panels=0,updates=0,gate=null;const f=fixture({native:true,panelRefresh:()=>panels++,sceneUpdate:()=>updates++,onSampleRequest:p=>p.count===1?new Promise(resolve=>{gate=resolve;}):undefined});
 const wait=async predicate=>{for(let i=0;i<150&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,2));assert.ok(predicate());};
 try{await f.workspace.start();f.workspace.show('satellite');f.attach();f.options.store.add({name:'notification scope'});const utc=codec.advance('2026-10-04T22:01:12Z',0);f.context({utc,source:'sim',key:'sim:fixture',projected:true});await wait(()=>!f.workspace.snapshot().timeline.pending);
  gate=null;const beforeDisplay=panels;f.context({utc,source:'catalog',key:'catalog:fixture'});assert.ok(panels>beforeDisplay,'actual display change retains full panel refresh');const baseline={panels,updates};await wait(()=>gate);
  assert.equal(panels,baseline.panels+1,'only the independent display-observe completion may rebuild fleet/status; communication start must not');assert.equal(updates,baseline.updates+1,'only the independent display-observe completion may update pose/scene; communication start must not');assert.equal(f.workspace.snapshot().timeline.communicationPending,1);
  // A later display/error boundary is still a complete refresh, even while the
  // exact communication request is waiting in the unchanged native queue.
  const beforeNext=panels;f.context(null);assert.ok(panels>beforeNext);assert.equal(f.workspace.snapshot().display,null);
  const release=gate;gate=null;release();await wait(()=>f.workspace.snapshot().timeline.communicationPending===0);assert.equal(f.workspace.snapshot().display,null);
 }finally{gate?.();f.workspace.destroy();}
});

test('accepted optical result still updates the scene and full panel after communication bookkeeping',async()=>{
 const codec=createUtcCodec(LEAP_SHA256);let panels=0,linkValues=[];const f=fixture({native:true,panelRefresh:()=>panels++,sceneLinks:value=>linkValues.push(value)});
 try{await f.workspace.start();f.workspace.show('satellite');f.attach();f.options.store.add({name:'optical notifications'});const utc=codec.advance('2026-10-04T22:01:12Z',0);f.context({utc,source:'sim',key:'sim:fixture',projected:true});for(let i=0;i<150&&f.workspace.snapshot().timeline.pending;i++)await new Promise(resolve=>setTimeout(resolve,2));
  const before=panels;f.context({utc,source:'catalog',key:'catalog:fixture'});const value=await f.workspace.updateMissionLinks();assert.equal(value.status,'valid');assert.equal(value.utc,utc);assert.ok(linkValues.some(v=>v.status==='valid'&&v.utc===utc));assert.ok(panels>before);assert.equal(f.workspace.verifyMissionLinks(value,{nodes:f.options.store.drafts,utc}),true);
 }finally{f.workspace.destroy();}
});

test('workspace optical cache keeps same-definition selection valid and revokes edited definitions at the same UTC',async()=>{
 const codec=createUtcCodec(LEAP_SHA256),f=fixture({native:true});try{await f.workspace.start();f.workspace.show('satellite');f.attach();f.options.store.add({name:'scope owner'});const utc=codec.advance('2026-10-04T22:01:12Z',0);f.context({utc,source:'catalog',key:'catalog:fixture'});const value=await f.workspace.updateMissionLinks();assert.equal(value.status,'valid');const nodes=f.options.store.drafts;f.options.store.select(nodes[0].id);assert.equal(f.workspace.verifyMissionLinks(value,{nodes:f.options.store.drafts,utc}),true,'selection rotates cache token without changing the actual receipt scope');f.options.store.update(nodes[0].id,{...nodes[0],name:'edited scope'});assert.equal(f.workspace.verifyMissionLinks(value,{nodes:f.options.store.drafts,utc}),false);f.workspace.destroy();assert.equal(f.workspace.verifyMissionLinks(value,{nodes,utc}),false);}finally{f.workspace.destroy();}
});


test('mounted private network summary preserves complete context output across current, changed, missing and disposed inputs',async()=>{
 const codec=createUtcCodec(LEAP_SHA256),utc=codec.advance('2026-10-04T22:01:12Z',0);let faults=[],stations=stationModel.DEFAULT_STATION_KEYS.map(preset=>stationModel.createStation({preset})),fail=false;
 const f=fixture({networkInputs:{readStations:()=>{if(fail)throw Error('station unavailable');return stations;},readFaults:()=>faults}});
 const input={display:{key:'sim:R',utc},sim:{runtime:{mode:'SIM',run_id:'R',elapsed_seconds:0,running:false}},fabric:{status:'accepted',receipt:{network_hash:'a'.repeat(64),time:utc,instance_id:'fabric',sequence:1}}};
 const check=()=>{const proof=f.workspace.networkSnapshot(),summary=f.workspace.networkPresentation(),before=JSON.stringify(proof);assert.deepEqual(projectWorkspaceContext({...input,network:summary}),projectWorkspaceContext({...input,network:{proof,verified:proof?f.workspace.verifyNetworkSnapshot(proof):false}}));assert.equal(JSON.stringify(proof),before);if(summary?.proof){assert.equal(summary.proof.node_definitions,undefined);assert.equal(summary.proof.stations,undefined);assert.equal(summary.proof.network?.links,undefined);assert.equal(f.workspace.verifyNetworkSnapshot(summary.proof),false);}return summary;};
 try{
  await f.workspace.start();check();f.context({utc});check();await f.workspace.updateNetwork();assert.equal(check().verified,true);
  input.fabric.receipt.time=null;assert.equal(projectWorkspaceContext({...input,network:check()}).communication.status,'unavailable');input.fabric.receipt.time=utc;
  input.fabric.pending=true;assert.equal(projectWorkspaceContext({...input,network:check()}).communication.status,'unavailable');input.fabric.pending=false;input.fabric.error='failed';assert.equal(projectWorkspaceContext({...input,network:check()}).communication.status,'unavailable');input.fabric.error='';
  stations[0].dish_m+=1;assert.equal(check().verified,false);await f.workspace.updateNetwork();assert.equal(check().verified,true);
  faults=[{kind:'station_down',target:stations[0].id}];assert.equal(check().verified,false);await f.workspace.updateNetwork();check();
  f.context({utc:codec.advance(utc,1)});assert.equal(check().verified,false);await f.workspace.updateNetwork();check();
  fail=true;assert.equal(check().verified,false);await f.workspace.updateNetwork();check();fail=false;
  f.context({});assert.equal(check().verified,false);f.context(null);assert.equal(check().verified,false);
  f.context({utc});await f.workspace.updateNetwork();f.workspace.clearNetwork();assert.equal(check().verified,false);
  f.workspace.destroy();assert.equal(check().verified,false);
 }finally{f.workspace.destroy();}
});

test('mounted private network summary does not promote pending or failed native requests',async()=>{
 let finish,queries=0;const codec=createUtcCodec(LEAP_SHA256),utc=codec.advance('2026-10-04T22:01:12Z',0),f=fixture({networkInputs:{readStations:()=>[],readFaults:()=>[]},onSampleRequest:()=>++queries===1?new Promise(resolve=>{finish=resolve;}):undefined});
 try{await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'source'});f.context({utc});const pending=f.workspace.updateNetwork();for(let i=0;i<40&&!finish;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.workspace.networkSnapshot().status,'pending');assert.equal(f.workspace.networkPresentation().proof.status,'pending');assert.equal(f.workspace.networkPresentation().verified,false);finish?.();await pending;
  assert.equal(f.workspace.networkSnapshot().status,'error');assert.equal(f.workspace.networkPresentation().proof.status,'error');assert.equal(f.workspace.networkPresentation().verified,false);
 }finally{finish?.();f.workspace.destroy();}
});


test('mounted presentation port is readonly full roster and metadata refresh avoids unchanged240 full clones',async()=>{
 const f=fixture();let equipment=0;const lib=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++equipment}`});try{await f.workspace.start();f.workspace.show('satellite');f.options.store.addMany(Array.from({length:240},(_,i)=>lib.createNode({}, {epoch:1791151272000,id:'N-'+i,catalogNumber:900001+i})));
  assert.equal(typeof f.options.readPresentation,'function');const before=f.options.readPresentation();assert.equal(before.drafts.length,240);assert.equal(Object.isFrozen(before.drafts[0]),true);
  const stringify=JSON.stringify;let serializations=0;JSON.stringify=function(value,...args){if(Array.isArray(value)&&value.length===240&&value.every(n=>n?.schema===1))serializations++;return stringify.call(this,value,...args);};
  const deployment=f.workspace.scenarioPorts().deployment,descriptor=Object.getOwnPropertyDescriptor(deployment,'state');Object.defineProperty(deployment,'state',{get(){throw Error('metadata refresh must not clone full deployment state');},configurable:true});
  try{for(let i=0;i<10;i++)f.workspace.refresh();}finally{JSON.stringify=stringify;Object.defineProperty(deployment,'state',descriptor);}
  assert.equal(serializations,0,'metadata refresh uses counts and flags, not full public roster copies');assert.equal(f.options.readPresentation().drafts,before.drafts);assert.match(f.buttons.get('node-scene-summary').textContent,/초안 240개/);
  f.options.store.select('N-239');assert.equal(f.options.readPresentation().selected.id,'N-239');f.workspace.destroy();assert.equal(f.options.readPresentation(),null);
 }finally{f.workspace.destroy();}
});


test('review-required metadata refresh retains exact full server review without cloning public state each frame',async()=>{
 const receipt={deployment_id:'foreign',revision:4,run_id:'run',scope_id:'run:deployment:foreign',nodes:Array.from({length:40},(_,i)=>({id:'S-'+i,name:'source '+i,mode:'nominal',equipment:[]}))};const f=fixture({fetchOverride:async()=>({ok:true,json:async()=>structuredClone(receipt)})});
 try{await f.workspace.start();f.workspace.show('satellite');const expected=JSON.stringify(receipt,null,2),deployment=f.workspace.scenarioPorts().deployment,descriptor=Object.getOwnPropertyDescriptor(deployment,'state');assert.equal(f.buttons.get('node-server-configuration').textContent,expected);
  Object.defineProperty(deployment,'state',{get(){throw Error('review refresh must not clone full server');},configurable:true});
  try{for(let i=0;i<10;i++)f.workspace.refresh();}finally{Object.defineProperty(deployment,'state',descriptor);}
  assert.equal(f.buttons.get('node-server-configuration').textContent,expected);assert.equal(f.buttons.get('node-server-configuration').hidden,false);
 }finally{f.workspace.destroy();}
});


test('mounted readonly optical UI proof is current registered owner output and cannot replace action receipts',async()=>{
 const f=fixture(),codec=createUtcCodec(LEAP_SHA256),utc=codec.advance('2026-10-04T22:01:12Z',0);
 try{await f.workspace.start();f.workspace.show('satellite');assert.equal(typeof f.options.linksPresentationFor,'function');assert.equal(typeof f.options.verifyLinkPresentation,'function');f.context({utc});await new Promise(resolve=>setImmediate(resolve));
  const view=f.options.linksPresentationFor();assert.equal(view.presentation_kind,'OPTICAL_UI_V1');assert.equal(Object.isFrozen(view),true);assert.equal(f.options.verifyLinkPresentation(view,{utc}),true);assert.equal(f.options.verifyLinkSnapshot(view,{nodes:f.options.store.drafts,utc}),false);assert.equal(f.options.verifyLinkPresentation(structuredClone(view),{utc}),false);
  f.context(null);assert.equal(f.options.verifyLinkPresentation(view,{utc}),false);f.workspace.destroy();assert.equal(f.options.linksPresentationFor(),null);assert.equal(f.options.verifyLinkPresentation(view,{utc}),false);
 }finally{f.workspace.destroy();}
});

test('mounted node renderer and panels borrow separately verified sampled views without granting action proof',async()=>{
 const f=fixture(),utc=createUtcCodec(LEAP_SHA256).advance('2026-10-04T22:01:12Z',0);
 try{await f.workspace.start();f.workspace.show('satellite');const scene=f.attach();assert.equal(typeof scene.options.sampledLinks?.read,'function');assert.equal(typeof scene.options.sampledLinks?.verify,'function');assert.equal(typeof f.options.sampledLinksPresentationFor,'function');assert.equal(typeof f.options.verifySampledLinkPresentation,'function');f.context({utc});await new Promise(resolve=>setImmediate(resolve));
  const before=f.calls.length,view=scene.options.sampledLinks.read({utc});assert.equal(view.presentation_kind,'OPTICAL_SAMPLED_UI_V1');assert.equal(Object.isFrozen(view),true);assert.equal(view.display_utc,utc);assert.equal(view.status,'unavailable');assert.equal(scene.options.sampledLinks.verify(view,{utc}),false);assert.equal(f.options.verifyLinkSnapshot(view,{nodes:f.options.store.drafts,utc}),false);assert.equal(f.options.verifySampledLinkPresentation(structuredClone(view),{utc}),false);assert.equal(f.calls.length,before,'sampled presentation reads do not issue native or server commands');
  f.workspace.destroy();assert.equal(scene.options.sampledLinks.read({utc}),null);assert.equal(scene.options.sampledLinks.verify(view,{utc}),false);assert.equal(f.options.sampledLinksPresentationFor(),null);
 }finally{f.workspace.destroy();}
});
test('operator station assembly uses registered renderer picks and source store without node or GP selection',async()=>{
 let binding,selected=null,ready=true,alive=true,scene,removed=0,focuses=0;
 const stations=stationModel.DEFAULT_STATION_KEYS.map(preset=>stationModel.createStation({preset})),tokens=new WeakSet();
 const NetworkScene=class{constructor(){scene=this;}setSampledActive(){}setGroundLinksVisible(){}setCoverageVisible(){}clear(){}destroy(){alive=false;}syncFrame(){}
  captureStationPick(id){const station=stations.find(s=>s.id===id);if(!station)return null;const value=Object.freeze({id,station:Object.freeze(structuredClone(station))});tokens.add(value);return value;}
  stationPick(picked){return tokens.has(picked?.token)?picked.token:null;}
  verifyStationPick(value){return alive&&tokens.has(value)&&JSON.stringify(stations.find(s=>s.id===value.id))===JSON.stringify(value.station);}};
 const f=fixture({networkSceneClass:NetworkScene,networkInputs:{readStations:()=>stations,readFaults:()=>[],stationInteractionReady:()=>ready,selectStation:id=>{selected=id;return id;}},view:{bindGroundNetworkInteraction(value){binding=value;return()=>removed++;},focusGroundNetworkStation(station,{verify}){if(!verify())return false;focuses++;return true;}}});
 try{await f.workspace.start();f.context({utc:'2026-10-04T22:01:12.000000000Z'});f.attach();f.workspace.setNetworkVisualActive(true);
  assert.equal(typeof binding?.read,'function');assert.equal(typeof f.workspace.focusGroundNetworkStation,'function');const token=scene.captureStationPick(stations[0].id),baseline=f.calls.length;
  assert.equal(binding.read({token}),token);assert.equal(binding.verify(token),true);assert.equal(binding.verify(structuredClone(token)),false);
  binding.onSelect(token);assert.equal(selected,stations[0].id);assert.equal(focuses,0);assert.equal(f.calls.slice(baseline).some(c=>['model','select','focus','release'].includes(c[0])),false);
  binding.onFocus(token);assert.equal(focuses,1);assert.equal(f.workspace.focusGroundNetworkStation(stations[1].id),true);assert.equal(focuses,2);
  ready=false;binding.onSelect(token);binding.onFocus(token);assert.equal(focuses,2);assert.equal(f.workspace.focusGroundNetworkStation(stations[1].id),false);
  ready=true;stations[0].longitude+=1;assert.equal(binding.verify(token),false);f.workspace.setNetworkVisualActive(false);assert.equal(f.workspace.focusGroundNetworkStation(stations[1].id),false);
  f.workspace.destroy();assert.equal(removed,1);assert.equal(binding.read({token}),null);assert.equal(binding.verify(token),false);
 }finally{f.workspace.destroy();}
});

test('operator station external readiness callback cannot focus after nested disposal',async()=>{
 let binding,f,dispose=false,focuses=0;const station=stationModel.createStation({preset:'daejeon'}),token=Object.freeze({id:station.id,station:Object.freeze(station)});
 const NetworkScene=class{setSampledActive(){}setGroundLinksVisible(){}setCoverageVisible(){}clear(){}destroy(){}syncFrame(){}captureStationPick(){return token;}stationPick(){return token;}verifyStationPick(v){return v===token;}};
 f=fixture({networkSceneClass:NetworkScene,networkInputs:{readStations:()=>[station],readFaults:()=>[],stationInteractionReady(){if(dispose)f.workspace.destroy();return true;},selectStation:()=>{throw Error('disposed selection must not run');}},view:{bindGroundNetworkInteraction(value){binding=value;return()=>{};},focusGroundNetworkStation(){focuses++;return true;}}});
 try{await f.workspace.start();f.context({utc:'2026-10-04T22:01:12.000000000Z'});f.attach();f.workspace.setNetworkVisualActive(true);assert.equal(typeof binding?.verify,'function');dispose=true;assert.equal(f.workspace.focusGroundNetworkStation(station.id),false);assert.equal(focuses,0);assert.equal(binding.verify(token),false);}finally{f.workspace.destroy();}
});

for(const boundary of ['stations','final renderer verifier'])test(`operator station ${boundary} callback cannot revoke readiness and retain focus authority`,async()=>{
 let binding,ready=true,armed=false,reads=0,focuses=0;
 const station=stationModel.createStation({preset:'daejeon'}),token=Object.freeze({id:station.id,station:Object.freeze(station)});
 const NetworkScene=class{setSampledActive(){}setGroundLinksVisible(){}setCoverageVisible(){}clear(){}destroy(){}syncFrame(){}captureStationPick(){return token;}stationPick(){return token;}verifyStationPick(v){if(armed&&boundary==='final renderer verifier'&&++reads===2)ready=false;return v===token;}};
 const f=fixture({networkSceneClass:NetworkScene,networkInputs:{readStations:()=>{if(armed&&boundary==='stations')ready=false;return[station];},readFaults:()=>[],stationInteractionReady:()=>ready,selectStation:()=>{throw Error('revoked selection must not run');}},view:{bindGroundNetworkInteraction(value){binding=value;return()=>{};},focusGroundNetworkStation(){focuses++;return true;}}});
 try{await f.workspace.start();f.context({utc:'2026-10-04T22:01:12.000000000Z'});f.attach();f.workspace.setNetworkVisualActive(true);armed=true;assert.equal(f.workspace.canFocusGroundNetworkStation(station.id),false);assert.equal(ready,false);assert.equal(binding.verify(token),false);assert.equal(f.workspace.focusGroundNetworkStation(station.id),false);assert.equal(focuses,0);}finally{f.workspace.destroy();}
});
