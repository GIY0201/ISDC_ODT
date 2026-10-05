import test from 'node:test';
import assert from 'node:assert/strict';
import {createNodeTimeline} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256),start=codec.advance('2026-10-04T22:01:12Z',0),hash='a'.repeat(64);
const nodes=count=>Array.from({length:count},(_,i)=>({schema:1,id:`N-${i}`,catalog_number:900001+i,name:`node${i}`,orbit:{epoch:1791151272000,altitude_km:550,eccentricity:0,inclination:53,raan:0,argp:0,mean_anomaly:0}}));
function response(p){return {schema_version:1,request_id:p.request_id,status:'valid',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption',nodes:p.nodes.map(node=>({node_id:node.id,definition_hash:hash,rows:Array.from({length:p.count},(_,i)=>({utc:codec.advance(p.start_utc,i),status:'valid',error_code:null,position_m:[7000000+i,node.catalog_number,0],inertial_velocity_km_s:[0,7.5,0],raan_deg:0,argp_deg:0,mean_anomaly_deg:i,sunlit:true,longitude_deg:0,latitude_deg:0,height_km:550}))}))};}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw Error('test event did not arrive');}
function setup(handler){const calls=[],changes=[];let yields=0;const timeline=createNodeTimeline({api:{nodeSamples:async(p,options)=>{calls.push({p:structuredClone(p),signal:options.signal});return handler?handler(p,options,calls):response(p);}},requestId:()=> 'test',yieldControl:async()=>{yields++;},onChange:state=>changes.push(state)});return {timeline,calls,changes,get yields(){return yields;}};}
test('240 nodes use83/83/74 sequential native chunks with one UTC grid and atomic visibility',async()=>{
  let finish;const s=setup((p,_,calls)=>calls.length===3?new Promise(resolve=>{finish=()=>resolve(response(p));}):response(p)),defs=nodes(240);s.timeline.setDefinitions(defs);const work=s.timeline.calculate(start);await until(()=>s.calls.length===3);
  assert.equal(s.timeline.geometryFor(defs[0],{utc:start}),null);assert.equal(s.timeline.geometryFor(defs[239],{utc:start}),null);assert.equal(s.timeline.snapshot().pending,true);
  assert.deepEqual(s.calls.map(call=>call.p.nodes.length),[83,83,74]);assert.equal(new Set(s.calls.map(call=>call.p.request_id)).size,3);for(const call of s.calls){assert.equal(call.p.start_utc,start);assert.equal(call.p.count,601);assert.ok(call.p.nodes.length*call.p.count<=50000);}
  finish();assert.equal(await work,true);assert.equal(s.timeline.geometryFor(defs[239],{utc:codec.advance(start,600)}).row.position_m[1],900240);assert.equal(s.yields,240);assert.equal(s.timeline.snapshot().pending,false);s.timeline.destroy();
});
test('clear or changed definitions abort the concrete signal and discard responses even if transport ignores abort',async()=>{
  let release;const s=setup(p=>new Promise(resolve=>{release=()=>resolve(response(p));}));const defs=nodes(1);s.timeline.setDefinitions(defs);const work=s.timeline.calculate(start);await until(()=>s.calls.length===1);s.timeline.setDefinitions([{...defs[0],name:'changed'}]);assert.equal(s.calls[0].signal.aborted,true);release();assert.equal(await work,false);assert.equal(s.timeline.geometryFor(defs[0],{utc:start}),null);assert.equal(s.timeline.snapshot().pending,false);s.timeline.destroy();
});
test('out-of-order explicit queries cannot overwrite the latest accepted UTC or hashes',async()=>{
  const release=[];const s=setup(p=>new Promise(resolve=>release.push(()=>resolve(response(p))))),defs=nodes(1);s.timeline.setDefinitions(defs);const old=s.timeline.calculate(start);await until(()=>release.length===1);const later=codec.advance(start,20),next=s.timeline.calculate(later);await until(()=>release.length===2);release[1]();assert.equal(await next,true);release[0]();assert.equal(await old,false);assert.equal(s.timeline.snapshot().startUtc,later);assert.equal(s.timeline.geometryFor(defs[0],{utc:start}),null);s.timeline.destroy();
});
test('background refresh keeps only the previous complete buffer until commit and deduplicates repeated requests',async()=>{
  let finish;const s=setup((p,_,calls)=>calls.length===1?response(p):new Promise(resolve=>{finish=()=>resolve(response(p));})),defs=nodes(1);s.timeline.setDefinitions(defs);await s.timeline.calculate(start);const nextUtc=codec.advance(start,300),next=s.timeline.calculate(nextUtc,{background:true}),again=s.timeline.calculate(nextUtc,{background:true});await until(()=>s.calls.length===2);
  assert.ok(s.timeline.geometryFor(defs[0],{utc:start}));assert.equal(s.calls.length,2);finish();assert.equal(await next,true);assert.equal(await again,true);assert.equal(s.timeline.geometryFor(defs[0],{utc:start}),null);s.timeline.destroy();
});
test('a bad later receipt or known-definition hash mismatch rejects all candidate chunks and clears failed buffers',async()=>{
  const s=setup((p,_,calls)=>{const v=response(p);if(calls.length>1)v.nodes[0].definition_hash='b'.repeat(64);return v;}),defs=nodes(1);s.timeline.setDefinitions(defs);assert.equal(await s.timeline.calculate(start),true);assert.equal(await s.timeline.calculate(codec.advance(start,300),{background:true}),false);assert.ok(s.timeline.snapshot().error);assert.equal(s.timeline.geometryFor(defs[0],{utc:start}),null);s.timeline.destroy();
});
test('API cannot mutate captured definitions; lookup/snapshots never issue additional requests or change source context',async()=>{
  const s=setup(p=>{const v=response(p);p.nodes[0].name='transport mutation';return v;}),defs=nodes(1);s.timeline.setDefinitions(defs);defs[0].name='external mutation';await s.timeline.calculate(start);const captured=nodes(1)[0];assert.equal(s.timeline.geometryFor(captured,{utc:start}).node_definition.name,'node0');for(let i=0;i<100;i++){s.timeline.geometryFor(captured,{utc:codec.advance(start,i)});s.timeline.snapshot();}assert.equal(s.calls.length,1);s.timeline.destroy();
});
test('cancel during cooperative assembly prevents a partial commit and disposal makes held callbacks inert',async()=>{
  let resume;const calls=[];const timeline=createNodeTimeline({api:{nodeSamples:async p=>{calls.push(p);return response(p);}},requestId:()=> 'yield',yieldControl:()=>new Promise(resolve=>{resume=resolve;})});const defs=nodes(1);timeline.setDefinitions(defs);const work=timeline.calculate(start);await until(()=>resume);timeline.destroy();resume();assert.equal(await work,false);assert.equal(timeline.geometryFor(defs[0],{utc:start}),null);assert.throws(()=>timeline.setDefinitions(defs),/disposed/);assert.equal(calls.length,1);
});
test('empty scope stays empty; failed HTTP and invalid scope do not start a clock or retry on readonly access',async()=>{
  const s=setup(()=>{throw Error('native unavailable');});assert.equal(await s.timeline.calculate(start),false);assert.equal(s.calls.length,0);s.timeline.setDefinitions(nodes(1));assert.equal(await s.timeline.calculate(start),false);assert.match(s.timeline.snapshot().error,/native unavailable/);assert.throws(()=>s.timeline.setDefinitions(nodes(241)));assert.equal(s.calls.length,1);s.timeline.destroy();
});
test('second chunk failure leaves no first-chunk candidate visible',async()=>{
  const s=setup((p,_,calls)=>{if(calls.length===2)throw Error('chunk two unavailable');return response(p);}),defs=nodes(84);s.timeline.setDefinitions(defs);
  assert.equal(await s.timeline.calculate(start),false);assert.equal(s.calls.length,2);assert.match(s.timeline.snapshot().error,/chunk two unavailable/);
  assert.equal(s.timeline.geometryFor(defs[0],{utc:start}),null);assert.equal(s.timeline.geometryFor(defs[83],{utc:start}),null);s.timeline.destroy();
});
test('reverse seek invalidates future data and unchanged captured definitions do not cancel a live request',async()=>{
  let finish;const s=setup((p,_,calls)=>calls.length===1?response(p):new Promise(resolve=>{finish=()=>resolve(response(p));})),defs=nodes(1);s.timeline.setDefinitions(defs);await s.timeline.calculate(start);
  const past=codec.advance(start,-700),pending=s.timeline.calculate(past);await until(()=>finish);assert.equal(s.timeline.setDefinitions(structuredClone(defs)),false);assert.equal(s.calls[1].signal.aborted,false);assert.equal(s.timeline.geometryFor(defs[0],{utc:start}),null);finish();assert.equal(await pending,true);assert.equal(s.timeline.snapshot().startUtc,past);assert.equal(s.timeline.geometryFor(defs[0],{utc:start}),null);s.timeline.destroy();
});
test('notification errors do not turn an accepted atomic receipt into failure or start another request',async()=>{
  let calls=0;const errors=[];const t=createNodeTimeline({api:{nodeSamples:async p=>{calls++;return response(p);}},requestId:()=> 'notify',yieldControl:async()=>{},onChange:()=>{throw Error('display notification failed');},onError:e=>errors.push(e)}),defs=nodes(1);
  t.setDefinitions(defs);assert.equal(await t.calculate(start),true);assert.ok(t.geometryFor(defs[0],{utc:start}));assert.equal(t.snapshot().error,'');assert.equal(calls,1);assert.ok(errors.includes('display notification failed'));t.destroy();
});
