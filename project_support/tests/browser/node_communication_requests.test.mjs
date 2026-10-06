import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createNodeLinkResolver,linkSummary} from '../../../user_application/web/scripts/nodes/links.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import {createNodeDisplayTimeline,createNodeSampleBufferAsync} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createNodeOpticalTimeline} from '../../../user_application/web/scripts/nodes/optical_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256),start=codec.advance('2026-10-04T22:01:12Z',0),H='a'.repeat(64),period=95;
const nodes=(count=1,name='node')=>Array.from({length:count},(_,i)=>({schema:1,id:`N-${i}`,catalog_number:900001+i,name,orbit:{altitude_km:550,inclination:53,epoch:'2026-10-04T00:00:00Z'}}));
function receipt(p,kind){
 const track=kind==='track',count=track?121:p.count;
 return {schema_version:1,request_id:p.request_id,status:'valid',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption',nodes:p.nodes.map((node,n)=>({node_id:node.id,definition_hash:H,...(track?{period_minutes:period,path_visible:true}:{}),rows:Array.from({length:count},(_,i)=>({utc:track?codec.advance(new Date(Date.parse(p.center_utc)+(i-60)*period*60000/120).toISOString(),0):codec.advance(p.start_utc,i),status:'valid',error_code:null,position_m:[7000000+n,0,0],inertial_position_km:[7000+n,0,0],inertial_velocity_km_s:[0,7,0],lvlh_basis:{x:[0,1,0],y:[0,0,1],z:[1,0,0]},raan_deg:0,argp_deg:0,mean_anomaly_deg:0,sunlit:true,longitude_deg:0,latitude_deg:0,height_km:550}))}))};
}
function setup(action=(p,kind)=>receipt(p,kind)){
 const calls=[];let active=0,max=0;
 const query=kind=>async(p,o)=>{calls.push({kind,p:structuredClone(p),signal:o.signal});active++;max=Math.max(max,active);try{return await action(p,kind,o,calls);}finally{active--;}};
 const timeline=createNodeDisplayTimeline({api:{nodeSamples:query('samples'),nodeTrack:query('track')},periodFor:()=>period,requestId:()=> 'native',yieldControl:async()=>{}});
 timeline.setDefinitions(nodes());return {timeline,calls,get max(){return max;}};
}
const until=async predicate=>{for(let i=0;i<100&&!predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(predicate());};

test('past exact native requests share display ownership and preserve the601-row future grid',async()=>{
 const s=setup();await s.timeline.observe(start);const initial=s.calls.length;
 for(const seconds of [-120,-60,0]){
  const utc=codec.advance(start,seconds),value=await s.timeline.requestCommunicationStates(utc);
  assert.equal(value.utc,utc);assert.deepEqual(value.node_definitions,nodes());assert.equal(value.states[0][1].utc,utc);
  assert.equal(value.states[0][1].interpolated,false);assert.equal(value.states[0][1].quality,'engineering_assumption');
  value.states[0][1].inertial.r[0]=0;
 }
 assert.equal(s.calls.length,initial+2,'current exact sample reuses existing native buffer');
 assert.deepEqual(s.calls.slice(initial).map(c=>[c.p.start_utc,c.p.count,c.p.nodes.length]),[[-120,1,1],[-60,1,1]].map(([seconds,count,total])=>[codec.advance(start,seconds),count,total]));
 assert.equal(s.calls[0].p.count,601);assert.equal(s.timeline.snapshot().samples.startUtc,start);assert.equal(s.timeline.snapshot().utc,start);
 assert.equal(s.timeline.communicationStateFor(nodes()[0]).inertial.r[0],7000);assert.equal(s.max,1);s.timeline.destroy();
});

test('communication waits for an existing ignored-abort display response, never concurrent native calls',async()=>{
 let finish;const s=setup((p,kind,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));
 const display=s.timeline.observe(start);await until(()=>finish);
 const work=s.timeline.requestCommunicationStates(codec.advance(start,-120));assert.equal(s.calls.length,1);
 finish();const value=await work;await display;assert.equal(value.states.length,1);assert.equal(s.max,1);assert.ok(s.timeline.geometryFor(nodes()[0]));s.timeline.destroy();
});

test('fractional exact points are queried instead of substituting display interpolation',async()=>{
 const s=setup();await s.timeline.observe(start);const utc=codec.advance(start,.5);
 assert.equal(s.timeline.communicationStateFor(nodes()[0],{utc}),null);
 const value=await s.timeline.requestCommunicationStates(utc);assert.equal(value.states[0][1].utc,utc);assert.equal(value.states[0][1].interpolated,false);
 assert.equal(s.calls.at(-1).p.count,1);assert.equal(s.calls.at(-1).p.start_utc,utc);assert.equal(s.timeline.snapshot().utc,start);s.timeline.destroy();
});

test('full240 point query stays atomic and does not change83/83/74 display chunking',async()=>{
 const s=setup();s.timeline.setDefinitions(nodes(240));await s.timeline.observe(start);
 const value=await s.timeline.requestCommunicationStates(codec.advance(start,-120));assert.equal(value.states.length,240);assert.equal(value.states[239][0],'N-239');
 assert.deepEqual(s.calls.map(c=>[c.kind,c.p.nodes.length,c.p.count??121]),[['samples',83,601],['samples',83,601],['samples',74,601],['track',240,121],['samples',240,1]]);
 assert.equal(s.max,1);assert.ok(s.timeline.geometryFor(nodes(240)[239]));s.timeline.destroy();
});

test('native communication failures preserve valid display inputs and never return partial success',async()=>{
 for(const invalid of ['hash','basis','native']){
  const s=setup((p,kind)=>{const value=receipt(p,kind);if(p.count===1){if(invalid==='hash')value.nodes[0].definition_hash='b'.repeat(64);else if(invalid==='basis')value.nodes[0].rows[0].lvlh_basis.z=[0,0,0];else throw Error('native unavailable');}return value;});
  await s.timeline.observe(start);await assert.rejects(s.timeline.requestCommunicationStates(codec.advance(start,-120)));
  assert.ok(s.timeline.geometryFor(nodes()[0]));assert.equal(s.timeline.snapshot().samples.startUtc,start);s.timeline.destroy();
 }
});

test('edit, clear and dispose abort and reject late communication receipts without starting extra queries',async()=>{
 for(const operation of ['edit','clear','destroy']){
  let finish;const s=setup((p,kind)=>p.count===1?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));await s.timeline.observe(start);
  const work=s.timeline.requestCommunicationStates(codec.advance(start,-120)),rejected=assert.rejects(work);await until(()=>finish);
  const call=s.calls.at(-1);if(operation==='edit')s.timeline.setDefinitions(nodes(1,'edited'));else s.timeline[operation]();
  assert.equal(call.signal.aborted,true);finish();await rejected;
  if(operation==='destroy')assert.throws(()=>s.timeline.requestCommunicationStates(start));else s.timeline.destroy();
 }
});

test('queued caller cancellation issues no query and rejects without changing display UTC',async()=>{
 let finish;const s=setup((p,kind,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));
 const display=s.timeline.observe(start);await until(()=>finish);const controller=new AbortController();
 const work=s.timeline.requestCommunicationStates(codec.advance(start,-120),{signal:controller.signal}),rejected=assert.rejects(work);
 controller.abort();finish();await rejected;await display;assert.equal(s.calls.length,2);assert.equal(s.max,1);s.timeline.destroy();
});

test('invalid UTC and an empty scope cannot start network or adopt a display clock',async()=>{
 const s=setup();await assert.rejects(s.timeline.requestCommunicationStates('invalid'));
 assert.equal(s.calls.length,0);assert.equal(s.timeline.snapshot().utc,null);
 s.timeline.setDefinitions([]);const value=await s.timeline.requestCommunicationStates(start);assert.deepEqual(value.states,[]);assert.deepEqual(value.node_definitions,[]);assert.equal(s.calls.length,0);s.timeline.destroy();
});

test('original -120/-60/current native receipt flow feeds the actual source resolver and carried history',async()=>{
 const fixture=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/original_node_link_resolution.json.gz',import.meta.url))));
 const scenario=fixture.cases.find(c=>c.id==='dense-two-plane:0'),calls=[];
 const timeline=createNodeDisplayTimeline({api:{nodeSamples:async p=>{
   calls.push(structuredClone(p));assert.equal(p.count,1);const row=scenario.rows.find(row=>row.input.date===Date.parse(p.start_utc));assert.ok(row);
   const source=new Map(row.input.states),value=receipt(p,'samples');
   for(const item of value.nodes){const state=source.get(item.node_id),target=item.rows[0];
     Object.assign(target,{position_m:state.fixed.r.map(v=>v*1000),inertial_position_km:state.inertial.r,inertial_velocity_km_s:state.inertial.v,lvlh_basis:state.basis,raan_deg:state.raan,argp_deg:state.argp,mean_anomaly_deg:state.meanAnomaly,sunlit:state.sunlit,longitude_deg:state.geodetic.longitude,latitude_deg:state.geodetic.latitude,height_km:state.geodetic.altitude});
   }
   return value;
 },nodeTrack:()=>{throw Error('point requests cannot start display tracks');}},periodFor:()=>period,requestId:()=> 'prime',yieldControl:async()=>{}});
 const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>{throw Error('no equipment creation');}}),{resolveLinks}=createNodeLinkResolver({library,oisl});
 timeline.setDefinitions(scenario.rows[0].input.nodes);let histories=new Map(),result;
 for(const row of scenario.rows){
   const utc=codec.advance(new Date(row.input.date).toISOString(),0),value=await timeline.requestCommunicationStates(utc);
   result=resolveLinks(value.node_definitions,new Map(value.states),histories,row.input.date);histories=result.histories;
   assert.deepEqual(JSON.parse(JSON.stringify({terminals:result.terminals,pairs:result.pairs,histories:[...result.histories],summary:linkSummary(result.pairs)})),row.expected);
 }
 assert.deepEqual(calls.map(c=>Date.parse(c.start_utc)),[-120,-60,0].map(s=>fixture.epoch+s*1000));
 assert.ok(result.pairs.some(p=>p.state==='locked'));assert.equal(timeline.snapshot().utc,null);timeline.destroy();
});

test('active caller abort cannot release the serial native lane before its ignored-abort response ends',async()=>{
 let finish;const s=setup((p,kind,_,calls)=>p.count===1&&calls.filter(c=>c.p.count===1).length===1?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));
 await s.timeline.observe(start);const controller=new AbortController();
 const first=s.timeline.requestCommunicationStates(codec.advance(start,-120),{signal:controller.signal}),rejected=assert.rejects(first);
 await until(()=>finish);controller.abort();const second=s.timeline.requestCommunicationStates(codec.advance(start,-60));
 await rejected;assert.equal(s.calls.length,3);finish();await second;assert.equal(s.calls.length,4);assert.equal(s.max,1);s.timeline.destroy();
});

test('forty-node concurrent exact requests coalesce in the existing lane and repeated reads return immutable copies',async()=>{
 let finish;const s=setup((p,kind,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));s.timeline.setDefinitions(nodes(40));
 const first=s.timeline.requestCommunicationStates(start);await until(()=>finish);const second=s.timeline.requestCommunicationStates(start);finish();
 const [a,b]=await Promise.all([first,second]);assert.equal(s.calls.length,1);assert.equal(s.calls[0].p.count,1);assert.equal(s.max,1);assert.equal(a.states.length,40);
 a.states[0][1].inertial.r[0]=0;b.node_definitions[0].name='corrupt';const c=await s.timeline.requestCommunicationStates(start);
 assert.equal(c.states[0][1].inertial.r[0],7000);assert.equal(c.node_definitions[0].name,'node');assert.equal(s.calls.length,1);assert.equal(s.timeline.snapshot().utc,null);s.timeline.destroy();
});
test('cached exact states never approve interpolation or a nearby nanosecond UTC',async()=>{
 const s=setup();for(const utc of [start,codec.advance(start,.5),codec.advance(start,.500000001),start]){const r=await s.timeline.requestCommunicationStates(utc);assert.equal(r.states[0][1].utc,utc);assert.equal(r.states[0][1].interpolated,false);}
 assert.equal(s.calls.length,3);assert.ok(s.calls.every(c=>c.p.count===1));s.timeline.destroy();
});
test('exact point cache is bounded and edit/clear/retry invalidate cached receipt ownership',async()=>{
 const s=setup();for(let i=0;i<9;i++)await s.timeline.requestCommunicationStates(codec.advance(start,i));assert.equal(s.calls.length,9);
 await s.timeline.requestCommunicationStates(start);assert.equal(s.calls.length,10,'oldest of eight exact entries evicted');
 s.timeline.clear();await s.timeline.requestCommunicationStates(start);assert.equal(s.calls.length,11);
 await s.timeline.retry();await s.timeline.requestCommunicationStates(start);assert.equal(s.calls.length,12);
 s.timeline.setDefinitions(nodes(1,'edited'));const r=await s.timeline.requestCommunicationStates(start);assert.equal(r.node_definitions[0].name,'edited');assert.equal(s.calls.length,13);s.timeline.destroy();
});
test('failed or malformed native points are not cached as success and retry performs native validation',async()=>{
 let fail=true;const s=setup((p,kind)=>{const r=receipt(p,kind);if(fail)r.nodes[0].rows[0].lvlh_basis.z=[0,0,0];return r;});
 await assert.rejects(s.timeline.requestCommunicationStates(start));fail=false;assert.equal((await s.timeline.requestCommunicationStates(start)).states.length,1);assert.equal(s.calls.length,2);await s.timeline.requestCommunicationStates(start);assert.equal(s.calls.length,2);s.timeline.destroy();
});
test('one canceled same-UTC caller cannot cancel another caller or poison the accepted point cache',async()=>{
 let finish;const s=setup((p,kind)=>new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}));
 const first=s.timeline.requestCommunicationStates(start);await until(()=>finish);const controller=new AbortController();
 const second=s.timeline.requestCommunicationStates(start,{signal:controller.signal}),rejected=assert.rejects(second);controller.abort();finish();await first;await rejected;
 assert.equal((await s.timeline.requestCommunicationStates(start)).states.length,1);assert.equal(s.calls.length,1);s.timeline.destroy();
});
test('new display-native definition binding cannot be replaced by a cached point with another hash',async()=>{
 const s=setup((p,kind)=>{const r=receipt(p,kind);if(p.count!==1)for(const item of r.nodes)item.definition_hash='b'.repeat(64);return r;});
 await s.timeline.requestCommunicationStates(start);await s.timeline.observe(start);
 await assert.rejects(s.timeline.requestCommunicationStates(start),/hash mismatch/);
 assert.equal(s.timeline.snapshot().samples.definitionHashes['N-0'],'b'.repeat(64));assert.equal(s.timeline.snapshot().samples.error,'');s.timeline.destroy();
});
test('forty-row exact native validation completes despite a blocked timer executor;601 display validation remains cooperative',async()=>{
 const p={request_id:'bounded-point',nodes:nodes(40),start_utc:start,count:1,step_seconds:1};let waits=0;
 const buffer=await createNodeSampleBufferAsync(p,receipt(p,'samples'),{yieldControl:()=>{waits++;throw Error('timer executor blocked');}});
 assert.equal(buffer.nodeIds().length,40);assert.equal(waits,0);assert.ok(buffer.communicationStateFor(p.nodes[39],{utc:start}));
 const display={...p,count:601};await assert.rejects(createNodeSampleBufferAsync(display,receipt(display,'samples'),{yieldControl:()=>{waits++;throw Error('timer executor blocked');}}),/timer executor blocked/);assert.equal(waits,1);
 const controller=new AbortController();controller.abort();await assert.rejects(createNodeSampleBufferAsync(p,receipt(p,'samples'),{yieldControl:async()=>{},signal:controller.signal}));
 const malformed=receipt(p,'samples');malformed.nodes[39].rows[0].position_m=[NaN,0,0];await assert.rejects(createNodeSampleBufferAsync(p,malformed,{yieldControl:async()=>{}}),/malformed/);
});
test('original optical historical point queue can finish with blocked timers after native responses',async()=>{
 const golden=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/original_node_link_resolution.json.gz',import.meta.url)))),scenario=golden.cases.find(c=>c.id==='dense-two-plane:0'),calls=[],library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>{throw Error('no equipment creation');}});
 const defs=scenario.rows[0].input.nodes,source=new Map(scenario.rows.map(row=>[Date.parse(new Date(row.input.date).toISOString()),row]));
 const timeline=createNodeDisplayTimeline({api:{nodeSamples:async p=>{calls.push(p);const v=receipt(p,'samples'),row=source.get(Date.parse(p.start_utc)),states=new Map(row.input.states);for(const item of v.nodes){const s=states.get(item.node_id);Object.assign(item.rows[0],{position_m:s.fixed.r.map(n=>n*1000),inertial_position_km:s.inertial.r,inertial_velocity_km_s:s.inertial.v,lvlh_basis:s.basis,raan_deg:s.raan,argp_deg:s.argp,mean_anomaly_deg:s.meanAnomaly,sunlit:s.sunlit,longitude_deg:s.geodetic.longitude,latitude_deg:s.geodetic.latitude,height_km:s.geodetic.altitude});}return v;},nodeTrack:()=>{throw Error('point lane cannot request tracks');}},periodFor:()=>period,requestId:()=> 'optical-bounded',yieldControl:()=>{throw Error('timer executor blocked');}});
 timeline.setDefinitions(defs);const utc=codec.advance(new Date(golden.epoch).toISOString(),0),optical=createNodeOpticalTimeline({resolver:createNodeLinkResolver({library,oisl}),requestCommunicationStates:timeline.requestCommunicationStates,readNodes:()=>defs,readDisplay:()=>({utc}),advanceUtc:codec.advance});
 const value=await optical.update();assert.equal(value.status,'valid');assert.deepEqual(JSON.parse(JSON.stringify(value.pairs)),scenario.rows.at(-1).expected.pairs);assert.deepEqual(calls.map(p=>[Date.parse(p.start_utc),p.count]),[-120,-60,0].map(s=>[golden.epoch+s*1000,1]));assert.equal(timeline.snapshot().utc,null);optical.destroy();timeline.destroy();
});
test('exact point queue runs after display HTTP returns without waiting for a blocked render-validation yield',async()=>{
 let releaseYield;const calls=[];let active=0,max=0;
 const query=kind=>async p=>{active++;max=Math.max(max,active);calls.push({kind,p});try{return receipt(p,kind);}finally{active--;}};
 const timeline=createNodeDisplayTimeline({api:{nodeSamples:query('samples'),nodeTrack:query('track')},periodFor:()=>period,requestId:()=> 'validation-priority',yieldControl:()=>new Promise(resolve=>{releaseYield=resolve;})});timeline.setDefinitions(nodes(40));
 const display=timeline.observe(start);await until(()=>releaseYield);assert.equal(timeline.snapshot().activeKind,'samples');
 let exact=null;const point=timeline.requestCommunicationStates(codec.advance(start,.5)).then(v=>exact=v,()=>{});
 try{await until(()=>exact);assert.equal(exact.states.length,40);assert.equal(calls.filter(c=>c.p.count===1).length,1);assert.equal(max,1);assert.equal(timeline.geometryFor(nodes(40)[0],{utc:start}),null,'uncommitted display candidate remains hidden');}
 finally{timeline.clear();releaseYield();await display;await point;timeline.destroy();}
});
test('clear during a validation-priority ignored-abort point keeps native HTTP serial and discards both candidates',async()=>{
 let releaseYield,finish;const calls=[];let active=0,max=0;
 const query=kind=>async p=>{calls.push({kind,p});active++;max=Math.max(max,active);try{return p.count===1?await new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind);}finally{active--;}};
 const timeline=createNodeDisplayTimeline({api:{nodeSamples:query('samples'),nodeTrack:query('track')},periodFor:()=>period,requestId:()=> 'priority-clear',yieldControl:()=>new Promise(resolve=>{releaseYield=resolve;})});timeline.setDefinitions(nodes(40));const display=timeline.observe(start);await until(()=>releaseYield);
 const exact=timeline.requestCommunicationStates(codec.advance(start,.5)),rejected=assert.rejects(exact);await until(()=>finish);timeline.clear();await rejected;assert.equal(calls.length,2);assert.equal(active,1);assert.equal(timeline.geometryFor(nodes(40)[0],{utc:start}),null);
 finish();releaseYield();await display;assert.equal(active,0);assert.equal(max,1);assert.equal(calls.length,2);assert.equal(timeline.snapshot().communicationPending,0);timeline.destroy();
});
