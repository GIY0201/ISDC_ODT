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
test('cached exact communication reads preserve all240 copies without reserializing the private cohort',async()=>{
 const s=setup((p,kind)=>{const value=receipt(p,kind);for(const node of value.nodes)for(const row of node.rows){row.inertial_position_km=[7000,0,0];row.lvlh_basis={x:[0,1,0],y:[0,0,1],z:[1,0,0]};}return value;}),nodes=Array.from({length:240},(_,i)=>({...defs()[0],id:'N-'+i,catalog_number:900001+i}));
 try{s.timeline.setDefinitions(nodes);await s.timeline.observe(start);await s.timeline.requestCommunicationStates(start);const calls=s.calls.length,stringify=JSON.stringify;let cohortSerializations=0;
  JSON.stringify=function(value,...args){if(Array.isArray(value)&&value.length===240&&value.every(node=>node?.schema===1&&typeof node.id==='string'))cohortSerializations++;return stringify.call(this,value,...args);};
  try{for(let i=0;i<6;i++){const result=await s.timeline.requestCommunicationStates(start);assert.equal(result.states.length,240);assert.deepEqual(result.node_definitions,nodes);result.node_definitions[239].name='foreign';result.states[239][1].inertial.r[0]=0;}}finally{JSON.stringify=stringify;}
  assert.equal(s.calls.length,calls);assert.equal(cohortSerializations,0,'accepted private scope is unchanged; cached reads must not walk all definitions again');assert.equal((await s.timeline.requestCommunicationStates(start)).states[239][1].inertial.r[0],7000);
 }finally{s.timeline.destroy();}
});
test('communication private scope keeps canonical equivalents but revokes active and queued work on every actual scope change',async()=>{
 for(const change of ['equivalent','reordered','foreign-field','clear','destroy']){
  let finish;const s=setup((p,kind,_,calls)=>{const value=receipt(p,kind);for(const node of value.nodes)for(const row of node.rows){row.inertial_position_km=[7000,0,0];row.lvlh_basis={x:[0,1,0],y:[0,0,1],z:[1,0,0]};}return calls.length===1?new Promise(resolve=>{finish=()=>resolve(value);}):value;});
  const nodes=[...defs(),{...defs()[0],id:'N-2',catalog_number:900002}];s.timeline.setDefinitions(nodes);const first=s.timeline.requestCommunicationStates(start),second=s.timeline.requestCommunicationStates(codec.advance(start,1));
  const results=Promise.allSettled([first,second]);await until(()=>finish);nodes[0].name='caller mutation';
  if(change==='equivalent'){const equivalent=[...defs(),{...defs()[0],catalog_number:900002,id:'N-2'}];assert.equal(s.timeline.setDefinitions(equivalent),false);}
  else if(change==='reordered')s.timeline.setDefinitions([...s.calls[0].p.nodes].reverse());
  else if(change==='foreign-field')s.timeline.setDefinitions(s.calls[0].p.nodes.map(node=>({...node,notes:'changed complete definition'})));
  else s.timeline[change]();
  finish();const settled=await results;if(change==='equivalent'){assert.equal(settled.every(value=>value.status==='fulfilled'),true);assert.equal(settled[0].value.node_definitions[0].name,'node');assert.deepEqual(settled[0].value.states.map(([id])=>id),['N-1','N-2']);}
  else{assert.equal(settled.every(value=>value.status==='rejected'&&/invalidated/.test(value.reason.message)),true);assert.equal(s.calls[0].signal.aborted,true);assert.equal(s.calls.length,1);}
  assert.equal(s.max,1);s.timeline.destroy();
 }
});
test('communication state follows the same readonly buffers and exact UTC through the shared owner',async()=>{
 const s=setup((p,kind)=>{
  const value=receipt(p,kind);
  for(const node of value.nodes)for(const row of node.rows){row.inertial_position_km=[7000,0,0];row.lvlh_basis={x:[0,1,0],y:[0,0,1],z:[1,0,0]};}
  return value;
 });
 await s.timeline.observe(start);const before=s.calls.length;
 const state=s.timeline.communicationStateFor(defs()[0]);assert.deepEqual(state.inertial.r,[7000,0,0]);
 state.basis.x[0]=999;assert.deepEqual(s.timeline.communicationStateFor(defs()[0]).basis.x,[0,1,0]);
 assert.equal(s.timeline.communicationStateFor(defs()[0],{utc:codec.advance(start,.5)}),null);
 assert.equal(s.calls.length,before);s.timeline.clear();assert.equal(s.timeline.communicationStateFor(defs()[0]),null);
 s.timeline.destroy();assert.equal(s.timeline.communicationStateFor(defs()[0],{utc:start}),null);
});
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

test('display projection cohort follows actual accepted buffers and revokes old packets on replacement retry clear and disposal',async()=>{
 let finish,delay=false;const s=setup((p,kind)=>delay&&kind==='samples'?new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));}):receipt(p,kind));await s.timeline.observe(start);
 const port=s.timeline.displayGeometry;assert.ok(port);const node=defs()[0],view=port.viewFor(node),revision=port.revision(),packet=port.sampleAt(view,start);
 assert.ok(packet);assert.equal(port.isCurrent(view),true);assert.equal(port.verifySample(view,packet,start),true);
 delay=true;const work=s.timeline.observe(codec.advance(start,300));await until(()=>finish);assert.equal(port.revision(),revision);assert.equal(port.isCurrent(view),true,'pending prefetch retains the original accepted buffer');
 finish();delay=false;await work;assert.notEqual(port.revision(),revision);assert.equal(port.isCurrent(view),false);assert.equal(port.sampleAt(view,start),null);assert.equal(port.verifySample(view,packet,start),false);
 const next=port.viewFor(node);assert.ok(next);assert.equal(port.isCurrent(Object.freeze({...next})),false);
 const retry=s.timeline.retry();assert.equal(port.isCurrent(next),false);await retry;const restored=port.viewFor(node);assert.ok(restored);s.timeline.clear();assert.equal(port.revision(),null);assert.equal(port.isCurrent(restored),false);
 await s.timeline.observe(start);const current=port.viewFor(node);assert.ok(current);s.timeline.destroy();assert.equal(port.revision(),null);assert.equal(port.isCurrent(current),false);assert.equal(port.viewFor(node),null);
});

test('native projection rejects dirty definitions and preserves partial errors without extrapolation or invalid interpolation',async()=>{
 const s=setup((p,kind)=>{const value=receipt(p,kind);if(kind==='samples'){const row=value.nodes[0].rows[1];for(const key of Object.keys(row))if(!['utc','status','error_code'].includes(key))row[key]=null;row.status='error';row.error_code='native_error';value.status='partial';}return value;});await s.timeline.observe(start);
 const port=s.timeline.displayGeometry;assert.ok(port);const node=defs()[0],view=port.viewFor(node);assert.equal(port.viewFor({...node,orbit:{...node.orbit,altitude_km:551}}),null);
 const error=port.sampleAt(view,codec.advance(start,1));assert.equal(error.row.status,'error');assert.equal(port.verifySample(view,error,error.row.utc),true);assert.equal(port.sampleAt(view,codec.advance(start,.5)),null);
 assert.equal(port.sampleAt(view,codec.advance(start,-1)),null);await s.timeline.observe('invalid');assert.equal(port.revision(),null);assert.equal(port.isCurrent(view),false);assert.equal(port.viewFor(node),null);s.timeline.destroy();
});

test('shared display exposes stable track revisions without queries and invalidates on clear/disposal',async()=>{
 const s=setup();await s.timeline.observe(start);const node=defs()[0],token=s.timeline.pathRevisionFor(node);assert.ok(token);
 for(let i=0;i<20;i++){assert.equal(s.timeline.pathRevisionFor(node),token);await s.timeline.observe(start);}assert.equal(s.calls.length,2);
 await s.timeline.observe(codec.advance(start,30));assert.notEqual(s.timeline.pathRevisionFor(node),token);s.timeline.clear();assert.equal(s.timeline.pathRevisionFor(node),null);s.timeline.destroy();assert.equal(s.timeline.pathRevisionFor(node),null);
});

test('exact communication bookkeeping emissions carry an explicit reason without changing snapshots',async()=>{
 const events=[];const timeline=createNodeDisplayTimeline({api:{nodeSamples:async p=>{const v=receipt(p,'samples');for(const n of v.nodes)for(const row of n.rows){row.inertial_position_km=[7000,0,0];row.lvlh_basis={x:[0,1,0],y:[0,0,1],z:[1,0,0]};}return v;},nodeTrack:async p=>receipt(p,'track')},periodFor:()=>period,requestId:()=> 'reason',yieldControl:async()=>{},onChange:(snapshot,reason)=>events.push({snapshot,reason})});
 try{timeline.setDefinitions(defs());await timeline.observe(start);events.length=0;const value=await timeline.requestCommunicationStates(codec.advance(start,-1));assert.equal(value.states.length,1);
  const communication=events.filter(e=>e.reason?.kind==='communication');assert.equal(communication.length,2);assert.equal(communication[0].snapshot.activeKind,'communication');assert.equal(communication[1].snapshot.activeKind,null);assert.equal(communication[0].snapshot.communicationPending,1);assert.equal(communication[1].snapshot.communicationPending,0);assert.equal(communication.every(e=>e.snapshot.utc===start),true);
  events.length=0;await timeline.observe(codec.advance(start,300));assert.ok(events.length);assert.equal(events.some(e=>e.reason?.kind==='communication'),false);
 }finally{timeline.destroy();}
});

test('failed and disposed communication work preserves explicit reason and existing failure settlement',async()=>{
 const events=[];let finish;const timeline=createNodeDisplayTimeline({api:{nodeSamples:async p=>{if(p.count===1)return new Promise((resolve,reject)=>{finish=()=>reject(Error('exact native unavailable'));});return receipt(p,'samples');},nodeTrack:async p=>receipt(p,'track')},periodFor:()=>period,requestId:()=> 'reason-failure',yieldControl:async()=>{},onChange:(snapshot,reason)=>events.push({snapshot,reason})});
 timeline.setDefinitions(defs());await timeline.observe(start);events.length=0;const pending=timeline.requestCommunicationStates(codec.advance(start,-1));const rejected=assert.rejects(pending,/exact native unavailable/);await until(()=>finish);finish();await rejected;await until(()=>timeline.snapshot().communicationPending===0);assert.equal(events.filter(e=>e.reason?.kind==='communication').length,2);
 events.length=0;finish=null;const late=timeline.requestCommunicationStates(codec.advance(start,-2));const invalidated=assert.rejects(late,/invalidated/);await until(()=>finish);timeline.destroy();const count=events.length;finish();await invalidated;await new Promise(resolve=>setImmediate(resolve));assert.equal(events.length,count,'disposed owner cannot publish late bookkeeping');
});

test('exact communication batch joins all240 accepted nodes in request order without new HTTP and preserves independent copies',async()=>{
 const s=setup((p,kind)=>{const value=receipt(p,kind);for(const node of value.nodes)for(const row of node.rows){row.inertial_position_km=[7000,0,0];row.lvlh_basis={x:[0,1,0],y:[0,0,1],z:[1,0,0]};}return value;});
 const nodes=Array.from({length:240},(_,i)=>({...defs()[0],id:'N-'+i,catalog_number:900001+i}));try{s.timeline.setDefinitions(nodes);await s.timeline.observe(start);const count=s.calls.length,states=await s.timeline.requestCommunicationStates(start);assert.equal(s.calls.length,count);assert.equal(states.states.length,240);assert.deepEqual(states.states.map(([id])=>id),nodes.map(n=>n.id));
  for(const index of [0,82,83,165,166,239])assert.deepEqual(states.states[index][1],s.timeline.communicationStateFor(nodes[index],{utc:start}));states.states[239][1].inertial.r[0]=0;states.node_definitions[239].name='mutated';const again=await s.timeline.requestCommunicationStates(start);assert.equal(again.states[239][1].inertial.r[0],7000);assert.equal(again.node_definitions[239].name,'node');assert.equal(s.calls.length,count);
 }finally{s.timeline.destroy();}
});

test('aborted queued 240-node exact requests do not copy private definitions per job',async()=>{
 let finish;const s=setup((p,kind)=>new Promise(resolve=>{finish=()=>resolve(receipt(p,kind));})),nodes=Array.from({length:240},(_,i)=>({...defs()[0],id:'N-'+i,catalog_number:900001+i}));
 const clone=globalThis.structuredClone;let cohorts=0;
 try{s.timeline.setDefinitions(nodes);const first=s.timeline.requestCommunicationStates(start).catch(error=>error);await until(()=>finish);
  globalThis.structuredClone=value=>{if(Array.isArray(value)&&value.length===240&&value[0]?.schema===1)cohorts++;return clone(value);};
  const jobs=[];for(let i=1;i<=8;i++){const controller=new AbortController(),work=s.timeline.requestCommunicationStates(codec.advance(start,i),{signal:controller.signal});jobs.push(assert.rejects(work,/cancel queued/));controller.abort(Error('cancel queued'));}
  await Promise.all(jobs);assert.equal(cohorts,0,'queued jobs borrow the validated immutable private cohort before abort');
  globalThis.structuredClone=clone;finish();assert.match((await first).message,/states unavailable/);assert.equal(s.calls.length,1);
 }finally{globalThis.structuredClone=clone;s.timeline.destroy();}
});

test('fresh 240-node exact receipt is cached privately with one public result copy and preserves full isolation',async()=>{
 const s=setup((p,kind)=>{const value=receipt(p,kind);for(const node of value.nodes)for(const row of node.rows){row.inertial_position_km=[7000,0,0];row.lvlh_basis={x:[0,1,0],y:[0,0,1],z:[1,0,0]};}return value;}),nodes=Array.from({length:240},(_,i)=>({...defs()[0],id:'N-'+i,catalog_number:900001+i,notes:`complete-${i}`}));
 const clone=globalThis.structuredClone;let cohorts=0,wholeResults=0,stateCopies=0;
 try{s.timeline.setDefinitions(nodes);await s.timeline.observe(start);
  globalThis.structuredClone=value=>{if(Array.isArray(value)&&value.length===240&&value[0]?.schema===1)cohorts++;if(value?.node_definitions?.length===240&&value?.states?.length===240)wholeResults++;if(Array.isArray(value)&&value.length===240&&Array.isArray(value[0])&&value[0][1]?.inertial)stateCopies++;return clone(value);};
  const result=await s.timeline.requestCommunicationStates(start);
  assert.equal(cohorts,0,'accepted job/result borrow the private fully validated definitions');assert.equal(wholeResults,1,'one complete public result copy');assert.equal(stateCopies,0,'accepted split batches are already independently copied');
  assert.deepEqual(result.node_definitions,nodes);assert.deepEqual(result.states.map(([id])=>id),nodes.map(node=>node.id));
  result.node_definitions[239].orbit.altitude_km=1;result.states[239][1].node_definition.notes='foreign';result.states[0][1].basis.x[0]=99;nodes[0].notes='caller mutation';
  const cached=await s.timeline.requestCommunicationStates(start);assert.equal(cached.node_definitions[239].orbit.altitude_km,550);assert.equal(cached.states[239][1].node_definition.notes,'complete-239');assert.equal(cached.states[0][1].basis.x[0],0);assert.equal(cached.node_definitions[0].notes,'complete-0');
  const freshUtc=codec.advance(start,.5),fresh=await s.timeline.requestCommunicationStates(freshUtc);assert.equal(fresh.utc,freshUtc);assert.equal(fresh.states.length,240);assert.equal(fresh.states[239][1].utc,freshUtc);assert.equal(s.calls.at(-1).p.count,1);
 }finally{globalThis.structuredClone=clone;s.timeline.destroy();}
});

test('exact point cache remains bounded to eight UTCs and rechecks newly accepted native hashes',async()=>{
 let hash=H;const responses=[];const s=setup((p,kind)=>{const value=receipt(p,kind);for(const node of value.nodes){node.definition_hash=hash;for(const row of node.rows){row.inertial_position_km=[7000,0,0];row.lvlh_basis={x:[0,1,0],y:[0,0,1],z:[1,0,0]};}}responses.push(value);return value;});
 try{
  for(let i=0;i<9;i++)await s.timeline.requestCommunicationStates(codec.advance(start,i*.5));assert.equal(s.calls.length,9);
  const first=await s.timeline.requestCommunicationStates(start);assert.equal(s.calls.length,10,'ninth exact point evicts the original UTC');
  responses.at(-1).nodes[0].rows[0].inertial_position_km[0]=123;first.states[0][1].inertial.r[0]=456;assert.equal((await s.timeline.requestCommunicationStates(start)).states[0][1].inertial.r[0],7000);
  hash='b'.repeat(64);await s.timeline.observe(start);assert.equal(s.timeline.snapshot().samples.definitionHashes['N-1'],hash);
  await assert.rejects(s.timeline.requestCommunicationStates(start),/definition hash mismatch/);
  const fresh=await s.timeline.requestCommunicationStates(codec.advance(start,.25));assert.equal(fresh.states[0][1].definition_hash,hash);
 }finally{s.timeline.destroy();}
});

test('fresh exact native errors and inconsistent hashes never enter private cached receipts',async()=>{
 for(const failure of ['hash','row']){
  let invalid=true;const s=setup((p,kind)=>{const value=receipt(p,kind);for(const node of value.nodes)for(const row of node.rows){row.inertial_position_km=[7000,0,0];row.lvlh_basis={x:[0,1,0],y:[0,0,1],z:[1,0,0]};}
   if(p.count===1&&invalid){if(failure==='hash')value.nodes[0].definition_hash='b'.repeat(64);else {value.status='error';const row=value.nodes[0].rows[0];for(const key of Object.keys(row))if(!['utc','status','error_code'].includes(key))row[key]=null;row.status='error';row.error_code='native_failure';}}return value;});
  try{await s.timeline.observe(start);const at=codec.advance(start,.5);await assert.rejects(s.timeline.requestCommunicationStates(at),failure==='hash'?/hash mismatch/:/states unavailable/);invalid=false;const recovered=await s.timeline.requestCommunicationStates(at);assert.equal(recovered.states[0][1].definition_hash,H);assert.equal(recovered.states[0][1].inertial.r[0],7000);assert.equal(s.calls.filter(c=>c.p.count===1).length,2);}finally{s.timeline.destroy();}
 }
});
