import test from 'node:test';
import assert from 'node:assert/strict';
import {createNodeDisplayTimeline} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256),start=codec.advance('2026-10-04T22:01:12Z',0),period=95.651,H='a'.repeat(64);
const defs=(name='node')=>[{schema:1,id:'N-1',catalog_number:900001,name,orbit:{altitude_km:550,inclination:53,epoch:'2026-10-04T00:00:00Z'}}];
function receipt(p,kind){
 const track=kind==='track',center=Date.parse(p.center_utc),count=track?121:p.count;
 return {schema_version:1,request_id:p.request_id,status:'valid',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption',nodes:p.nodes.map(n=>({node_id:n.id,definition_hash:H,...(track?{period_minutes:period,path_visible:true}:{}),rows:Array.from({length:count},(_,i)=>({utc:track?codec.advance(new Date(Math.trunc(center+(i-60)*period*60000/120)).toISOString(),0):codec.advance(p.start_utc,i),status:'valid',error_code:null,position_m:[i,2,3],inertial_velocity_km_s:[1,2,3],raan_deg:1,argp_deg:2,mean_anomaly_deg:3,sunlit:true,longitude_deg:4,latitude_deg:5,height_km:550}))}))};
}
function setup(action=(p,kind)=>receipt(p,kind)){
 const calls=[];let active=0,max=0;
 const query=kind=>async(p,o)=>{active++;max=Math.max(max,active);calls.push({kind,p:structuredClone(p),signal:o.signal});try{return await action(p,kind,o,calls);}finally{active--;}};
 const timeline=createNodeDisplayTimeline({api:{nodeSamples:query('samples'),nodeTrack:query('track')},periodFor:()=>period,requestId:()=> 'display',yieldControl:async()=>{}});
 timeline.setDefinitions(defs());return {timeline,calls,get max(){return max;}};
}
const until=async predicate=>{for(let i=0;i<100&&!predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(predicate());};
test('one shared UTC drives serial sample then track requests; read and paused frames stay request-free',async()=>{
 const s=setup();assert.equal(s.calls.length,0);await s.timeline.observe(start);assert.deepEqual(s.calls.map(c=>c.kind),['samples','track']);assert.equal(s.max,1);
 assert.ok(s.timeline.geometryFor(defs()[0]));assert.equal(s.timeline.pathFor(defs()[0]).positions_m.length,121);
 for(let i=0;i<20;i++){await s.timeline.observe(start);s.timeline.geometryFor(defs()[0]);s.timeline.pathFor(defs()[0]);s.timeline.snapshot();}assert.equal(s.calls.length,2);s.timeline.destroy();
});
test('forward half-buffer prefetch starts at fixed300seconds and track refresh stays serial',async()=>{
 const s=setup();await s.timeline.observe(start);await s.timeline.observe(codec.advance(start,299));assert.equal(s.calls.filter(c=>c.kind==='samples').length,1);
 await s.timeline.observe(codec.advance(start,300));const samples=s.calls.filter(c=>c.kind==='samples');assert.equal(samples.length,2);assert.equal(samples[1].p.start_utc,codec.advance(start,300));assert.equal(s.max,1);assert.ok(s.timeline.geometryFor(defs()[0]));s.timeline.destroy();
});
test('reverse out-of-range seek builds600seconds of history then prefetches backwards',async()=>{
 const s=setup();await s.timeline.observe(start);const reverse=codec.advance(start,-1);await s.timeline.observe(reverse);
 assert.equal(s.calls.filter(c=>c.kind==='samples').at(-1).p.start_utc,codec.advance(reverse,-600));assert.ok(s.timeline.geometryFor(defs()[0]));
 await s.timeline.observe(codec.advance(reverse,-300));assert.equal(s.calls.filter(c=>c.kind==='samples').at(-1).p.start_utc,codec.advance(reverse,-900));assert.ok(s.timeline.geometryFor(defs()[0]));s.timeline.destroy();
});
test('many pending frames coalesce to latest shared UTC without concurrent native calls',async()=>{
 let finish;const s=setup((p,kind,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));
 const first=s.timeline.observe(start);await until(()=>finish);const next=s.timeline.observe(codec.advance(start,10));s.timeline.observe(codec.advance(start,20));assert.equal(s.calls.length,1);finish();await first;await next;
 assert.equal(s.calls[1].p.center_utc,codec.advance(start,20));assert.equal(s.max,1);assert.equal(s.timeline.snapshot().utc,codec.advance(start,20));s.timeline.destroy();
});
test('definition change aborts old request and waits for its terminal response before querying new scope',async()=>{
 let finish;const s=setup((p,kind,_,calls)=>calls.length===1?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));
 const first=s.timeline.observe(start);await until(()=>finish);s.timeline.setDefinitions(defs('changed'));assert.equal(s.calls[0].signal.aborted,true);assert.equal(s.calls.length,1);finish();await first;
 assert.equal(s.max,1);assert.equal(s.timeline.geometryFor(defs()[0]),null);assert.ok(s.timeline.geometryFor(defs('changed')[0]));assert.equal(s.calls[1].p.nodes[0].name,'changed');s.timeline.destroy();
});
test('failed samples latch across moving frames and only explicit retry starts another query',async()=>{
 let fail=true;const s=setup((p,kind)=>{if(fail)throw Error('native unavailable');return receipt(p,kind);});await s.timeline.observe(start);assert.match(s.timeline.snapshot().error,/unavailable/);
 for(let i=1;i<20;i++)await s.timeline.observe(codec.advance(start,i));assert.equal(s.calls.length,1);assert.equal(s.timeline.geometryFor(defs()[0]),null);
 fail=false;await s.timeline.retry();assert.equal(s.calls.length,3);assert.ok(s.timeline.geometryFor(defs()[0]));s.timeline.destroy();
});
test('track hash must match samples and track error cannot erase valid sampled geometry',async()=>{
 const s=setup((p,kind)=>{const value=receipt(p,kind);if(kind==='track')value.nodes[0].definition_hash='b'.repeat(64);return value;});await s.timeline.observe(start);
 assert.ok(s.timeline.geometryFor(defs()[0]));assert.equal(s.timeline.pathFor(defs()[0]),null);assert.match(s.timeline.snapshot().error,/hash/);await s.timeline.observe(codec.advance(start,40));assert.equal(s.calls.length,2);s.timeline.destroy();
});
test('explicit seek clears old geometry/path and dispose never schedules late work',async()=>{
 let finish;const s=setup((p,kind,_,calls)=>calls.length===3?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));await s.timeline.observe(start);
 const work=s.timeline.observe(codec.advance(start,20),{seek:true});await until(()=>finish);assert.equal(s.timeline.geometryFor(defs()[0]),null);assert.equal(s.timeline.pathFor(defs()[0]),null);
 s.timeline.destroy();assert.equal(s.calls[2].signal.aborted,true);finish();await work;assert.equal(s.calls.length,3);assert.equal(s.timeline.geometryFor(defs()[0]),null);
});
test('leap display preserves aligned native error geometry and hides unsupported source track without collapsing UTC',async()=>{
 const s=setup((p,kind)=>{const value=receipt(p,kind);if(kind==='samples'){let errors=0;for(const row of value.nodes[0].rows)if(row.utc.includes(':60.')){for(const key of Object.keys(row))if(!['utc','status','error_code'].includes(key))row[key]=null;row.status='error';row.error_code='unsupported_node_time';errors++;}if(errors)value.status='partial';}return value;});
 const first=codec.advance('2016-12-31T23:59:30Z',0);await s.timeline.observe(first);const leap=codec.advance('2016-12-31T23:59:60Z',0);await s.timeline.observe(leap);
 const geometry=s.timeline.geometryFor(defs()[0]);assert.ok(geometry);assert.equal(geometry.row.utc,leap);assert.equal(geometry.row.error_code,'unsupported_node_time');assert.equal(s.timeline.pathFor(defs()[0]),null);assert.match(s.timeline.snapshot().tracks.error,/unsupported_node_time/);s.timeline.destroy();
});
test('full240 scope stays serial across83/83/74 samples then one track request',async()=>{
 const s=setup(),nodes=Array.from({length:240},(_,i)=>({...defs()[0],id:'N-'+i,catalog_number:900001+i}));s.timeline.setDefinitions(nodes);await s.timeline.observe(start);
 assert.deepEqual(s.calls.map(c=>[c.kind,c.p.nodes.length]),[['samples',83],['samples',83],['samples',74],['track',240]]);assert.equal(s.max,1);assert.ok(s.timeline.geometryFor(nodes[239]));assert.equal(s.timeline.pathFor(nodes[239]).positions_m.length,121);s.timeline.destroy();
});
test('pending fixed prefetch keeps old complete geometry until commit; repeated frames do not duplicate it',async()=>{
 let finish;const s=setup((p,kind,_,calls)=>kind==='samples'&&calls.length>2?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));await s.timeline.observe(start);
 const work=s.timeline.observe(codec.advance(start,300));await until(()=>finish);const pending=s.timeline.observe(codec.advance(start,301));assert.equal(s.calls.filter(c=>c.kind==='samples').length,2);assert.ok(s.timeline.geometryFor(defs()[0]));
 finish();await work;await pending;assert.equal(s.timeline.snapshot().samples.startUtc,codec.advance(start,300));assert.equal(s.max,1);s.timeline.destroy();
});
