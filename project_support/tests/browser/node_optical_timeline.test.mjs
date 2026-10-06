import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createNodeOpticalTimeline} from '../../../user_application/web/scripts/nodes/optical_timeline.js';
import {createNodeLinkResolver} from '../../../user_application/web/scripts/nodes/links.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {NodeScene} from '../../../digital_twin/visualization/node_scene.js';
import {createSatelliteNodePanelTools} from '../../../user_application/web/scripts/tabs/satellite_nodes.js';
const codec=createUtcCodec(LEAP_SHA256),fixture=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/original_node_link_resolution.json.gz',import.meta.url))));
const scenario=fixture.cases.find(c=>c.id==='dense-two-plane:0'),meta={model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:fixture.source_commit,quality:'engineering_assumption'};
const canonical=date=>codec.advance(new Date(date).toISOString(),0),json=value=>JSON.parse(JSON.stringify(value));
const until=async predicate=>{for(let i=0;i<100&&!predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(predicate());};
function setup(action,nodeScopeRevision=null){
 let nodes=structuredClone(scenario.rows[0].input.nodes),utc=canonical(fixture.epoch);const calls=[],events=[];
 const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>{throw Error('no equipment creation');}}),resolver=createNodeLinkResolver({library,oisl});
 const request=async(stamp,options)=>{
  calls.push({utc:stamp,signal:options.signal});
  const source=new Map(scenario.rows.find(row=>row.input.date===Date.parse(stamp))?.input.states??scenario.rows.at(-1).input.states);
  const value={utc:stamp,node_definitions:structuredClone(nodes),states:nodes.map(node=>[node.id,{...meta,...structuredClone(source.get(node.id)),node_id:node.id,node_definition:structuredClone(node),definition_hash:'a'.repeat(64),utc:stamp,interpolated:false}])};
  return action?action(value,options,calls):value;
 };
 const optical=createNodeOpticalTimeline({resolver,requestCommunicationStates:request,readNodes:()=>nodes,nodeScopeRevision,readDisplay:()=>({utc}),advanceUtc:codec.advance,onChange:value=>events.push(value)});
 return {optical,calls,events,library,get nodes(){return structuredClone(nodes);},set nodes(value){nodes=structuredClone(value);},get utc(){return utc;},set utc(value){utc=value;}};
}

function geometry(s,node){
 const state=new Map(scenario.rows.at(-1).input.states).get(node.id);
 return {...meta,node_id:node.id,node_definition:structuredClone(node),definition_hash:'a'.repeat(64),row:{utc:s.utc,status:'valid',error_code:null,position_m:state.fixed.r.map(v=>v*1000),inertial_velocity_km_s:state.inertial.v,raan_deg:state.raan,argp_deg:state.argp,mean_anomaly_deg:state.meanAnomaly,latitude_deg:state.geodetic.latitude,longitude_deg:state.geodetic.longitude,height_km:state.geodetic.altitude,sunlit:state.sunlit}};
}

test('computed producer receipt reaches real NodeScene and revoked results clear owned lines',async()=>{
 const s=setup(),value=await s.optical.update();
 class Collection{constructor(){this.items=[];}add(v){this.items.push(v);return v;}remove(v){this.items=this.items.filter(item=>item!==v);return true;}}
 class Cartesian3{constructor(x,y,z){Object.assign(this,{x,y,z});}}
 class Color{constructor(css,alpha=1){Object.assign(this,{css,alpha});}static fromCssColorString(css){return new Color(css);}withAlpha(alpha){return new Color(this.css,alpha);}}
 class Material{constructor(options){this.uniforms=options.fabric.uniforms;}static fromType(type,uniforms){return {type,uniforms};}}
 const viewer={scene:{primitives:new Collection(),mode:3}},foreign={};viewer.scene.primitives.add(foreign);
 const scene=new NodeScene({viewer,cesium:{Cartesian3,Color,Material,PolylineCollection:Collection},timeSource:()=>s.utc,advanceUtc:codec.advance,geometryFor:node=>geometry(s,node),pathFor:()=>null,verifyLinkSnapshot:s.optical.verifyLinkSnapshot});
 await scene.setNodes(s.nodes.map(definition=>({id:definition.id,definition,model:null})));
 assert.equal(scene.setLinks(value),true);assert.equal(scene.links.size,value.pairs.length);
 const visible=[...scene.links.values()].filter(entry=>entry.line.show);assert.ok(visible.length>0);
 for(const entry of visible){const expected=geometry(s,s.nodes.find(node=>node.id===entry.a)).row.position_m;assert.deepEqual([entry.positions[0].x,entry.positions[0].y,entry.positions[0].z],expected);}
 const altered=structuredClone(value);altered.pairs[0].state=altered.pairs[0].state==='locked'?'idle':'locked';assert.equal(scene.setLinks(altered),false);assert.equal(scene.links.size,0);
 assert.equal(scene.setLinks(value),true);s.optical.resetHistories();assert.equal(scene.setLinks(value),false);assert.equal(scene.links.size,0);
 scene.destroy();assert.deepEqual(viewer.scene.primitives.items,[foreign]);s.optical.destroy();
});

test('status panel consumes actual verified terminal activity and rejects modified or stale receipts',async()=>{
 const s=setup(),links=await s.optical.update(),node=s.nodes.find(node=>node.equipment.some(item=>s.library.equipmentSpec(item)?.kind==='oisl'));
 assert.ok(node);const tools=createSatelliteNodePanelTools({library:s.library});
 const input={utc:s.utc,geometry:geometry(s,node),links,nodes:s.nodes,verifyLinkSnapshot:s.optical.verifyLinkSnapshot,oislPresentation:oisl};
 const valid=tools.statusPresentation(node,input);assert.equal(valid.linksStatus,'valid');assert.equal(valid.geometryStatus,'valid');assert.notEqual(valid.texts.consumption,'미확인');
 const altered=structuredClone(links);altered.terminals[0].dataRateMbps=123;
 const rejected=tools.statusPresentation(node,{...input,links:altered});assert.equal(rejected.linksStatus,'unknown');assert.equal(rejected.texts.consumption,'미확인');
 s.utc=canonical(fixture.epoch+1000);const stale=tools.statusPresentation(node,input);assert.equal(stale.linksStatus,'unknown');assert.equal(stale.texts.consumption,'미확인');s.optical.destroy();
});

test('actual source resolver primes at -120/-60/current and publishes exact complete current results',async()=>{
 const s=setup(),value=await s.optical.update(),expected=scenario.rows.at(-1).expected;
 assert.deepEqual(s.calls.map(c=>Date.parse(c.utc)),[-120,-60,0].map(seconds=>fixture.epoch+seconds*1000));
 assert.deepEqual(json(value.terminals),expected.terminals);assert.deepEqual(json(value.pairs),expected.pairs);assert.deepEqual(json(s.optical.historyEntries()),expected.histories);
 assert.equal(value.status,'valid');assert.equal(value.utc,s.utc);assert.deepEqual(value.node_definitions,s.nodes);
 assert.equal(s.optical.verifyLinkSnapshot(value,{nodes:s.nodes,utc:s.utc}),true);s.optical.destroy();
});

test('same-instant callers share pending work; paused repeated updates make no extra requests',async()=>{
 let finish;const s=setup((value,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(value);}):value);
 const first=s.optical.update(),second=s.optical.update();assert.equal(first,second);assert.equal(s.optical.snapshot().status,'pending');
 await until(()=>finish);
 finish();await first;for(let i=0;i<10;i++)await s.optical.update();assert.equal(s.calls.length,3);s.optical.destroy();
});

test('verifier rejects altered, foreign, stale, unsupported and replayed source receipts',async()=>{
 const s=setup(),value=await s.optical.update();
 for(const mutate of [v=>v.terminals[0].state.phase=v.terminals[0].state.phase==='tracking'?'blocked':'tracking',v=>v.pairs[0].state='idle',v=>v.node_definitions[0].name='foreign',v=>v.utc='old',v=>v.quality='measured',v=>v.definition_hashes['GRID-1']='b'.repeat(64)]){
  const altered=structuredClone(value);mutate(altered);assert.equal(s.optical.verifyLinkSnapshot(altered,{nodes:s.nodes,utc:s.utc}),false);
 }
 assert.equal(s.optical.verifyLinkSnapshot(value,{nodes:[],utc:s.utc}),false);
 value.pairs.length=0;assert.notEqual(s.optical.snapshot().pairs.length,0,'returned values cannot modify private proof');
 const receipt=s.optical.snapshot();s.utc=canonical(fixture.epoch+1000);assert.equal(s.optical.verifyLinkSnapshot(receipt,{nodes:s.nodes,utc:receipt.utc}),false);
 assert.equal(s.optical.snapshot().status,'unavailable');s.utc=receipt.utc;s.optical.resetHistories();assert.equal(s.optical.verifyLinkSnapshot(receipt,{nodes:s.nodes,utc:s.utc}),false);s.optical.destroy();
});

test('reversal uses original fresh acquisition rather than replaying a former lock',async()=>{
 const s=setup();await s.optical.update();s.utc=canonical(fixture.epoch-60000);const value=await s.optical.update();
 assert.equal(s.calls.length,4,'reverse seek keeps source history and executes one current-state tick');
 assert.ok(value.pairs.some(p=>p.state==='acquiring'));assert.ok(value.pairs.some(p=>p.state!=='locked'));s.optical.destroy();
});

test('full-definition changes invalidate cache even when source updated_at remains unchanged',async()=>{
 const s=setup(),first=await s.optical.update(),changed=s.nodes;changed[0].notes='edited';s.nodes=changed;
 assert.equal(s.optical.verifyLinkSnapshot(first,{nodes:s.nodes,utc:s.utc}),false);const next=await s.optical.update();
 assert.equal(s.calls.length,4,'only changed owner histories are dropped; unchanged owners remain');assert.equal(next.node_definitions[0].notes,'edited');assert.equal(next.status,'valid');s.optical.destroy();
});

test('missing, foreign or malformed native input never publishes synthetic terminal success',async()=>{
 for(const mutate of [v=>v.states.pop(),v=>v.node_definitions[0].notes='old',v=>v.states[0][1].quality='measured',v=>v.states[0][1].utc='old',v=>v.states[0][1].basis.x=[0,0,0],v=>v.states[0][1].definition_hash='bad',v=>v.states[0][1].inertial.r=[0,0,0]]){
  const s=setup(value=>{mutate(value);return value;}),result=await s.optical.update();assert.equal(result.status,'error');assert.deepEqual(result.pairs,[]);assert.deepEqual(s.optical.historyEntries(),[]);assert.equal(s.optical.verifyLinkSnapshot(result,{nodes:s.nodes,utc:s.utc}),false);s.optical.destroy();
 }
});

test('hash changes across historical receipts reject atomically without publishing partial histories',async()=>{
 const s=setup((value,_,calls)=>{if(calls.length===2)value.states[0][1].definition_hash='b'.repeat(64);return value;});
 assert.equal((await s.optical.update()).status,'error');assert.deepEqual(s.optical.historyEntries(),[]);s.optical.destroy();
});

test('clear/dispose or changed time during an ignored-abort request discards every late result',async()=>{
 for(const change of ['reset','destroy','time']){
  let finish;const s=setup((value,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(value);}):value),work=s.optical.update();
  await until(()=>finish);
  if(change==='reset')s.optical.resetHistories();else if(change==='destroy')s.optical.destroy();else s.utc=canonical(fixture.epoch+1000);
  finish();assert.equal(await work,null);assert.equal(s.calls.length,1);assert.deepEqual(s.optical.historyEntries(),[]);s.optical.destroy();
 }
});

test('source priming subtracts Unix milliseconds across a leap and never substitutes SI instants',async()=>{
 const s=setup();s.utc=codec.advance('2017-01-01T00:00:00Z',0);await s.optical.update();
 assert.deepEqual(s.calls.map(c=>c.utc),['2016-12-31T23:58:00Z','2016-12-31T23:59:00Z','2017-01-01T00:00:00Z'].map(stamp=>codec.advance(stamp,0)));s.optical.destroy();
});

test('prune keeps only requested owner histories and reset revokes every former receipt',async()=>{
 const s=setup();const receipt=await s.optical.update(),keep=s.nodes.slice(1).map(n=>n.id);
 s.optical.pruneHistories(keep);assert.ok(s.optical.historyEntries().every(([key])=>!key.startsWith(`${s.nodes[0].id}/`)));
 assert.equal(s.optical.verifyLinkSnapshot(receipt,{nodes:s.nodes,utc:s.utc}),false);s.optical.resetHistories();assert.deepEqual(s.optical.historyEntries(),[]);
 await s.optical.update();assert.equal(s.calls.length,6);s.optical.destroy();
});

test('observer mutation/failure cannot change accepted results; disposal cannot reopen through notification',async()=>{
 const s=setup(),options={resolver:createNodeLinkResolver({library:s.library,oisl}),requestCommunicationStates:async(utc)=>{const source=new Map(scenario.rows.find(r=>r.input.date===Date.parse(utc)).input.states);return {utc,node_definitions:s.nodes,states:s.nodes.map(node=>[node.id,{...meta,...source.get(node.id),node_id:node.id,node_definition:node,definition_hash:'a'.repeat(64),utc,interpolated:false}])};},readNodes:()=>s.nodes,readDisplay:()=>({utc:s.utc}),advanceUtc:codec.advance};
 let notifications=0;const optical=createNodeOpticalTimeline({...options,onChange:value=>{notifications++;value.pairs.length=0;throw Error('observer failed');}});
 const value=await optical.update();assert.ok(value.pairs.length>0);assert.equal(optical.observerError,'observer failed');assert.equal(optical.verifyLinkSnapshot(value,{nodes:s.nodes,utc:s.utc}),true);
 const count=notifications;optical.destroy();assert.equal(notifications,count);assert.equal(await optical.update(),null);s.optical.destroy();
});

test('empty input, unavailable UTC and absent dependencies cannot start native work',async()=>{
 const s=setup();s.nodes=[];assert.equal((await s.optical.update()).status,'valid');assert.equal(s.calls.length,0);
 s.utc=codec.advance('2016-12-31T23:59:60Z',0);assert.equal((await s.optical.update()).status,'error');assert.equal(s.calls.length,0);s.optical.destroy();
 assert.throws(()=>createNodeOpticalTimeline(),TypeError);
});

test('trusted optical scope token reuses complete immutable scope while same-number store reload invalidates it',async()=>{
 const {createConstellationStore,DRAFT_KEY}=await import('../../../user_application/web/scripts/nodes/constellation.js');
 const s=setup();let raw=JSON.stringify({schema:1,nodes:s.nodes,sequence:10000,revision:0,selectedId:null}),token=Object.freeze({}),reads=0;
 const store=createConstellationStore({library:s.library,now:()=>fixture.epoch,storage:{getItem:key=>key===DRAFT_KEY?raw:null,setItem:(key,value)=>{if(key===DRAFT_KEY)raw=value;}}});store.subscribe(()=>{token=Object.freeze({});});store.load();
 const resolver=createNodeLinkResolver({library:s.library,oisl}),optical=createNodeOpticalTimeline({resolver,nodeScopeRevision:()=>token,readNodes:()=>{reads++;return store.drafts;},readDisplay:()=>({utc:s.utc}),advanceUtc:codec.advance,requestCommunicationStates:async stamp=>{const source=new Map(scenario.rows.find(row=>row.input.date===Date.parse(stamp))?.input.states??scenario.rows.at(-1).input.states),nodes=store.drafts;return {utc:stamp,node_definitions:nodes,states:nodes.map(node=>[node.id,{...meta,...structuredClone(source.get(node.id)),node_id:node.id,node_definition:structuredClone(node),definition_hash:'a'.repeat(64),utc:stamp,interpolated:false}])};}});
 try{const value=await optical.update();assert.equal(value.status,'valid');const after=reads;for(let i=0;i<10;i++){assert.equal(optical.snapshot().status,'valid');assert.equal(optical.verifyLinkSnapshot(value,{nodes:store.drafts,utc:s.utc}),true);}assert.equal(reads,after,'unchanged authoritative cohort must not copy or serialize all node definitions again');
  const changed=JSON.parse(raw);changed.nodes[0].name='Reloaded different node';raw=JSON.stringify(changed);const previousRevision=store.revision;store.load({discardLocal:true});assert.equal(store.revision,previousRevision);assert.equal(optical.verifyLinkSnapshot(value,{nodes:store.drafts,utc:s.utc}),false);assert.equal(optical.snapshot().status,'unavailable');assert.ok(reads>after);const current=await optical.update();assert.equal(current.status,'valid');assert.equal(current.node_definitions[0].name,changed.nodes[0].name);
 }finally{optical.destroy();s.optical.destroy();}
});

test('trusted optical scope rejects token drift during reads and UTC callbacks while generic callers remain fresh',()=>{
 for(const point of ['nodes','advance','display']){
  let token=Object.freeze({}),enabled=false,reads=0,utc=canonical(fixture.epoch);const nodes=structuredClone(scenario.rows[0].input.nodes);
  const optical=createNodeOpticalTimeline({resolver:{resolveLinks(){throw Error('not queried');},terminalKey(){return'';}},requestCommunicationStates:async()=>{throw Error('not queried');},nodeScopeRevision:()=>token,readNodes:()=>{reads++;if(enabled&&point==='nodes')token=Object.freeze({});return nodes;},readDisplay:()=>{const value={utc};if(enabled&&point==='display')utc=canonical(Date.parse(utc)+1000);return value;},advanceUtc:(stamp,delta)=>{if(enabled&&point==='advance')token=Object.freeze({});return codec.advance(stamp,delta);}});
  enabled=true;assert.equal(optical.snapshot().status,'error',point);enabled=false;assert.equal(optical.snapshot().status,'unavailable');const before=reads;optical.snapshot();assert.equal(reads,before);optical.destroy();assert.equal(optical.snapshot().error,'disposed');
 }
 let reads=0;const s=setup(),optical=createNodeOpticalTimeline({resolver:{resolveLinks(){},terminalKey(){}},requestCommunicationStates:async()=>null,readNodes:()=>{reads++;return s.nodes;},readDisplay:()=>({utc:s.utc}),advanceUtc:codec.advance});optical.snapshot();optical.snapshot();assert.equal(reads,2,'generic callers without the trusted token always re-read full definitions');optical.destroy();s.optical.destroy();
});

test('trusted optical scope preserves complete source results histories requests and mutable snapshot boundaries',async()=>{
 const token=Object.freeze({}),legacy=setup(),trusted=setup(undefined,()=>token);try{const expected=await legacy.optical.update(),value=await trusted.optical.update();assert.deepEqual(value,expected);assert.deepEqual(trusted.optical.historyEntries(),legacy.optical.historyEntries());assert.deepEqual(trusted.calls.map(c=>c.utc),legacy.calls.map(c=>c.utc));const altered=trusted.optical.snapshot();altered.node_definitions[0].orbit.altitude_km=0;altered.terminals[0].state.phase='foreign';assert.deepEqual(trusted.optical.snapshot(),expected);assert.equal(trusted.optical.verifyLinkSnapshot(altered,{nodes:trusted.nodes,utc:trusted.utc}),false);}finally{trusted.optical.destroy();legacy.optical.destroy();}
});
