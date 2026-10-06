import test from 'node:test';
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

function fixture({native=false,solar=null,view=null,storage=null,storageGetter=null,fetchOverride=null,onHover=()=>{},networkInputs=null,readClock=()=>({})}={}){
 let id=0,context=null,displayListener,rendererFactory,panelOptions,interaction,renderer,removeCount=0;const calls=[],sections=new Map();
 const host={innerWidth:1280,innerHeight:720,localStorage:storage,crypto:{randomUUID:()=>`test-${++id}`},setTimeout,clearTimeout,addEventListener(){},removeEventListener(){},confirm:()=>true};
 if(storageGetter)Object.defineProperty(host,'localStorage',{get:storageGetter});
 const buttons=new Map(['nodes-deploy','nodes-recall','nodes-reapply','nodes-recall-reviewed','deploy-state','node-server-configuration'].map(key=>[key,{disabled:false,textContent:'',addEventListener(k,fn){this.fn=fn;},removeEventListener(){}}]));
 const document={getElementById:id=>id==='screen'?{prepend:root=>sections.set(root.id,root)}:sections.get(id)??null,createElement:()=>({querySelector:selector=>buttons.get(selector.slice(1))??null,remove(){sections.delete(this.id);}})};
 const globe={observeDisplayContext(fn){displayListener=fn;fn(context);return()=>removeCount++;},bindNodeRenderer(fn){rendererFactory=fn;return()=>removeCount++;},nodeRendererState:()=>({phase:'ready'}),observeNodeRenderer:()=>()=>removeCount++,setSatelliteModel:(...v)=>calls.push(['model',...v]),clearSatelliteModel:()=>calls.push(['clear']),focusSatelliteModel:()=>{calls.push(['focus']);return true;},releaseSatelliteModel:()=>calls.push(['release'])};
 globe.bindNodeInteraction=value=>{interaction=value;return()=>removeCount++;};
 const Scene=class{constructor(options){this.options=options;this.points=new Map();this.labels=new Map();this.models=new Map();}async setNodes(entries){calls.push(['nodes',entries]);this.points=new Map(entries.map(entry=>[entry.id,{show:true}]));}setTheme(value){calls.push(['theme',value]);}setHovered(id){calls.push(['hover',id]);}select(id){calls.push(['select',id]);}setLinks(){}update(){}destroy(){calls.push(['destroy']);}syncFrame(){}setLinksVisible(){}setModelsVisible(){}};
 const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++id}`});
 const tools={workPanelMarkup:()=>'<panel>',createNodeWorkPanel(options){panelOptions=options;return{refresh(){},destroy(){calls.push(['panel-destroy']);}};}};
 const fetchImpl=async(url,options)=>{calls.push(['http',url,options.method]);if(fetchOverride)return fetchOverride(url,options);return{ok:true,json:async()=>({revision:0,run_id:'run',scope_id:'run:unconfigured',deployment_id:null,nodes:[]})};};
 const codec=createUtcCodec(LEAP_SHA256),row=utc=>({utc,status:'valid',error_code:null,position_m:[7000000,2,3],inertial_position_km:[7000,0,0],lvlh_basis:{x:[1,0,0],y:[0,1,0],z:[0,0,1]},inertial_velocity_km_s:[0,7.5,0],raan_deg:0,argp_deg:0,mean_anomaly_deg:0,sunlit:true,longitude_deg:0,latitude_deg:0,height_km:550});
 const api={nodeSamples:async p=>{calls.push(['samples']);if(!native)throw Error('test unavailable');return{schema_version:1,...NODE_COMMUNICATION_METADATA,request_id:p.request_id,status:'valid',nodes:p.nodes.map(node=>({node_id:node.id,definition_hash:'a'.repeat(64),rows:Array.from({length:p.count},(_,i)=>row(codec.advance(p.start_utc,i)))}))};},nodeTrack:async p=>{if(!native)throw Error('test unavailable');return{schema_version:1,...NODE_COMMUNICATION_METADATA,request_id:p.request_id,status:'valid',nodes:p.nodes.map(node=>{const period=Math.round(orbitElements(node.orbit).period/60*1000)/1000;return{node_id:node.id,definition_hash:'a'.repeat(64),period_minutes:period,path_visible:true,rows:Array.from({length:121},(_,i)=>row(codec.advance(new Date(Math.trunc(Date.parse(p.center_utc)+(i-60)*period*60000/120)).toISOString(),0)))};})};}};
 if(view)Object.assign(globe,view);
 const network=networkInputs?{...networkInputs,model:createNetworkSnapshotModel({library,oisl,groundLinks:createGroundLinkModel({library,stationModel})}),validateStation:stationModel.validateStation}:null;
 const workspace=createWorkspaceNodes({api,globe,solar,library,orbitElements,catalogElements,oisl,Scene,tools,document,host,now:()=>1791151272000,resolveModel:()=>({key:'flat',url:'/flat.glb'}),models:()=>[],fetchImpl,onHover,networkInputs:network,readClock});
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
