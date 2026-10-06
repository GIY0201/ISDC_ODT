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
const codec=createUtcCodec(LEAP_SHA256),golden=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/original_node_link_resolution.json.gz',import.meta.url)))),scenario=golden.cases.find(c=>c.id==='dense-two-plane:0');
const metadata={model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:golden.source_commit,quality:'engineering_assumption'};
const start=codec.advance(new Date(golden.epoch).toISOString(),0),until=async predicate=>{for(let i=0;i<100&&!predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(predicate());};
function setup(action,{count=0}={}){
 let displayHook=null;let nodes=structuredClone(scenario.rows[0].input.nodes),utc=start,token=Object.freeze({}),available=true,key='catalog:25544:'+ 'c'.repeat(64);const calls=[];
 let equipment=0;const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-SAMPLED-${++equipment}`}),resolver=createNodeLinkResolver({library,oisl});if(count)nodes=Array.from({length:count},(_,i)=>library.cloneNode(nodes[0],{epoch:golden.epoch,id:'SAMPLED-'+i,catalogNumber:900001+i}));
 const request=async stamp=>{const source=new Map(scenario.rows.find(row=>row.input.date===Date.parse(stamp))?.input.states??scenario.rows.at(-1).input.states),value={utc:stamp,node_definitions:structuredClone(nodes),states:nodes.map(node=>[node.id,{...metadata,...structuredClone(source.get(node.id)??source.values().next().value),node_id:node.id,node_definition:structuredClone(node),definition_hash:'a'.repeat(64),utc:stamp,interpolated:false}])};return value;};
 const optical=createNodeOpticalTimeline({resolver,requestCommunicationStates:async(stamp,options)=>{calls.push({utc:stamp,signal:options.signal});const value=await request(stamp);return action?await action(value,options,calls):value;},readNodes:()=>nodes,readDisplay:()=>{const display={utc,key,source:'catalog',leap_sha256:LEAP_SHA256,eop_sha256:'d'.repeat(64)};displayHook?.();return display;},advanceUtc:codec.advance,readContinuity:()=>available?token:null,verifyContinuity:lease=>available&&lease===token});
 return{optical,calls,set displayHook(value){displayHook=value;},get nodes(){return structuredClone(nodes);},set nodes(v){nodes=structuredClone(v);},get utc(){return utc;},set utc(v){utc=v;},get key(){return key;},set key(v){key=v;},revoke(){token=Object.freeze({});},unavailable(){available=false;},recover(){available=true;token=Object.freeze({});}};
}

test('captured exact native sample completes during natural UTC movement as readonly visual only with original single history',async()=>{
 let finish;const s=setup((value,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(value);}):value);
 try{const pending=s.optical.updateSampled();await until(()=>finish);s.utc=codec.advance(start,.5);finish();const view=await pending;
  assert.equal(view.status,'valid');assert.equal(view.presentation_kind,'OPTICAL_SAMPLED_UI_V1');assert.equal(view.utc,start);assert.equal(view.analysis_utc,start);assert.equal(view.display_utc,s.utc);assert.equal(view.age_seconds,.5);assert.equal(view.current_analysis,false);assert.equal(view.reason,'current_analysis_unavailable');assert.deepEqual(view.node_definitions,s.nodes);assert.deepEqual(JSON.parse(JSON.stringify(view.terminals)),scenario.rows.at(-1).expected.terminals);assert.deepEqual(JSON.parse(JSON.stringify(s.optical.historyEntries())),scenario.rows.at(-1).expected.histories);
  assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc}),true);assert.equal(s.optical.verifyLinkSnapshot(view,{nodes:s.nodes,utc:s.utc}),false);assert.equal(s.optical.verifyPresentation(view,{utc:s.utc}),false);assert.equal(s.optical.snapshot().status,'unavailable');assert.equal(s.calls.length,3);
  const histories=s.optical.historyEntries();s.optical.sampledPresentation();s.optical.sampledPresentation();assert.deepEqual(s.optical.historyEntries(),histories);assert.equal(s.calls.length,3);
 }finally{s.optical.destroy();}
});

test('sampled visual registration refuses forged/cloned/full current action reuse and does not resurrect across sameUTC seek or gap',async()=>{
 const s=setup();try{const view=await s.optical.updateSampled();assert.equal(view.current_analysis,true);assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc,nodes:s.nodes}),true);assert.equal(Object.isFrozen(view.terminals[0].state),true);assert.equal(s.optical.verifySampledPresentation(structuredClone(view),{utc:s.utc}),false);assert.equal(s.optical.verifyLinkSnapshot(view,{nodes:s.nodes,utc:s.utc}),false);assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc,nodes:[]}),false);
  s.revoke();assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc}),false);assert.notEqual(s.optical.sampledPresentation().status,'valid');s.unavailable();assert.notEqual((await s.optical.updateSampled()).status,'valid');s.recover();assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc}),false);
 }finally{s.optical.destroy();}
});

for(const change of ['scope','source','seek','unavailable','reset','prune','destroy'])test(`sampled pending exact receipts cannot publish after ${change}`,async()=>{
 let finish;const s=setup((value,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(value);}):value);
 try{const work=s.optical.updateSampled();await until(()=>finish);if(change==='scope'){const nodes=s.nodes;nodes[0].notes='changed full scope';s.nodes=nodes;}else if(change==='source')s.key='catalog:other';else if(change==='seek')s.revoke();else if(change==='unavailable')s.unavailable();else if(change==='reset')s.optical.resetHistories();else if(change==='prune')s.optical.pruneHistories(new Set());else s.optical.destroy();finish();const result=await work;assert.notEqual(result?.status,'valid');assert.deepEqual(s.optical.historyEntries(),[]);assert.notEqual(s.optical.sampledPresentation().status,'valid');assert.equal(s.calls.length,1);
 }finally{finish?.();s.optical.destroy();}
});

for(const fail of ['hash','partial','native'])test(`sampled ${fail} failure leaves no approved history or retained success`,async()=>{
 const s=setup((value,_,calls)=>{if(calls.length===2){if(fail==='hash')value.states[0][1].definition_hash='b'.repeat(64);else if(fail==='partial')value.states.pop();else throw Error('native failure');}return value;});try{const result=await s.optical.updateSampled();assert.equal(result.status,'error');assert.equal(result.availability,'error');assert.deepEqual(s.optical.historyEntries(),[]);assert.equal(s.optical.verifySampledPresentation(result,{utc:s.utc}),false);assert.equal(s.optical.verifyLinkSnapshot(result,{nodes:s.nodes,utc:s.utc}),false);}finally{s.optical.destroy();}
});

test('same sampled scope coalesces moving-display work; exact action preempts differentUTC and drains ignored abort before shared history commit',async()=>{
 let finish;const s=setup((value,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(value);}):value);
 try{const sampled=s.optical.updateSampled();await until(()=>finish);s.utc=codec.advance(start,1);const same=s.optical.updateSampled();assert.equal(sampled,same);const exact=s.optical.update();assert.equal(s.calls[0].signal.aborted,true);await new Promise(resolve=>setImmediate(resolve));assert.equal(s.calls.length,1,'cancelled transport keeps its serial lane');finish();const old=await sampled;assert.notEqual(old?.status,'valid');const current=await exact;assert.equal(current.status,'valid');assert.equal(current.utc,s.utc);assert.equal(s.optical.verifyLinkSnapshot(current,{nodes:s.nodes,utc:s.utc}),true);assert.equal(s.calls.length,4);assert.notEqual(s.optical.sampledPresentation().status,'valid');
 }finally{finish?.();s.optical.destroy();}
});

test('same exact action safely shares sampled computation but revalidates exact UTC before returning an action result',async()=>{
 let finish;const s=setup((value,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(value);}):value);try{const sample=s.optical.updateSampled();await until(()=>finish);const exact=s.optical.update();s.utc=codec.advance(start,.25);finish();assert.equal((await sample).status,'valid');assert.equal(await exact,null);assert.equal(s.calls.length,3);assert.equal(s.optical.snapshot().status,'unavailable');}finally{finish?.();s.optical.destroy();}
});

test('absent continuity leaves generic exact producer unchanged and sampled mode unavailable',async()=>{
 const s=setup();try{s.unavailable();assert.notEqual((await s.optical.updateSampled()).status,'valid');assert.equal(s.calls.length,0);const current=await s.optical.update();assert.equal(current.status,'valid');assert.equal(s.optical.verifyLinkSnapshot(current,{nodes:s.nodes,utc:s.utc}),true);assert.equal(s.calls.length,3);}finally{s.optical.destroy();}
});


test('new continuity pending view never reuses revoked old success and explicit sampled cancel preserves the one generic history',async()=>{
 let gate=false,finish;const s=setup(value=>gate?new Promise(resolve=>{finish=()=>resolve(value);}):value);try{const old=await s.optical.updateSampled(),histories=s.optical.historyEntries();s.revoke();gate=true;s.utc=codec.advance(start,1);const work=s.optical.updateSampled();await until(()=>finish);const pending=s.optical.sampledPresentation();assert.equal(pending.status,'pending');assert.equal(pending.availability,'pending');assert.equal(s.optical.verifySampledPresentation(old,{utc:s.utc}),false);s.optical.cancelSampled();assert.equal(s.calls.at(-1).signal.aborted,true);finish();assert.notEqual((await work)?.status,'valid');assert.deepEqual(s.optical.historyEntries(),histories);assert.notEqual(s.optical.sampledPresentation().status,'valid');
 }finally{finish?.();s.optical.destroy();}
});

test('each natural frame obtains a fresh registered sampled view without changing history or issuing native requests',async()=>{
 const s=setup();try{let view=await s.optical.updateSampled();const histories=s.optical.historyEntries(),calls=s.calls.length;for(let i=1;i<=12;i++){s.utc=codec.advance(start,i/60);assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc}),false);view=s.optical.sampledPresentation();assert.equal(view.analysis_utc,start);assert.equal(view.display_utc,s.utc);assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc}),true);assert.equal(view.current_analysis,false);}assert.deepEqual(s.optical.historyEntries(),histories);assert.equal(s.calls.length,calls);}finally{s.optical.destroy();}
});


test('full240 sampled receipt preserves complete ordered definitions and hashes without a subset or interpolated native input',async()=>{
 const s=setup(undefined,{count:240});try{const view=await s.optical.updateSampled();assert.equal(view.status,'valid');assert.equal(view.node_definitions.length,240);assert.deepEqual(view.node_definitions,s.nodes);assert.equal(Object.keys(view.definition_hashes).length,240);assert.equal(s.calls.length,3);assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc,nodes:s.nodes}),true);const changed=s.nodes;changed[239].equipment[0].enabled=!changed[239].equipment[0].enabled;s.nodes=changed;assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc,nodes:s.nodes}),false);assert.notEqual(s.optical.sampledPresentation().status,'valid');}finally{s.optical.destroy();}
});


test('sameUTC owner revocation during every display callback refuses visual proof including the final callback',async()=>{
 const baseline=setup();let reads=0;try{const view=await baseline.optical.updateSampled();baseline.displayHook=()=>reads++;assert.equal(baseline.optical.verifySampledPresentation(view,{utc:baseline.utc}),true);}finally{baseline.optical.destroy();}
 assert.ok(reads>0);
 for(let position=1;position<=reads;position++){const s=setup();try{const view=await s.optical.updateSampled(),history=s.optical.historyEntries(),calls=s.calls.length;let seen=0,revoked=false;s.displayHook=()=>{if(++seen===position){revoked=true;s.revoke();}};assert.equal(s.optical.verifySampledPresentation(view,{utc:s.utc}),false,`revocation at display read ${position} must fail closed`);assert.equal(revoked,true);assert.deepEqual(s.optical.historyEntries(),history);assert.equal(s.calls.length,calls);}finally{s.optical.destroy();}}
});


for(const explicitCancel of [false,true])test(`sameUTC capability revocation cannot promote sampled history into exact action approval (cancel=${explicitCancel})`,async()=>{
 const s=setup();try{await s.optical.updateSampled();const receipt=s.optical.snapshot(),ui=s.optical.presentation(),history=s.optical.historyEntries();assert.equal(s.optical.verifyLinkSnapshot(receipt,{utc:s.utc,nodes:s.nodes}),true);s.revoke();if(explicitCancel)s.optical.cancelSampled();assert.notEqual(s.optical.snapshot().status,'valid');assert.notEqual(s.optical.presentation().status,'valid');assert.equal(s.optical.verifyLinkSnapshot(receipt,{utc:s.utc,nodes:s.nodes}),false);assert.equal(s.optical.verifyPresentation(ui,{utc:s.utc}),false);assert.deepEqual(s.optical.historyEntries(),history);const fresh=await s.optical.update();assert.equal(fresh.status,'valid');assert.equal(s.optical.verifyLinkSnapshot(fresh,{utc:s.utc,nodes:s.nodes}),true);assert.equal(s.calls.length,4,'fresh exact receipt uses retained source history but must query native current UTC');}finally{s.optical.destroy();}
});


test('explicit sampled cancellation keeps ignored-abort transport drained before a fresh exact query',async()=>{
 let finish;const s=setup((value,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(value);}):value);try{const sampled=s.optical.updateSampled();await until(()=>finish);s.optical.cancelSampled();const exact=s.optical.update();await new Promise(resolve=>setImmediate(resolve));assert.equal(s.calls.length,1,'revocation must not open a second native transport lane');finish();assert.notEqual((await sampled)?.status,'valid');assert.equal((await exact).status,'valid');assert.equal(s.calls.length,4);}finally{finish?.();s.optical.destroy();}
});
