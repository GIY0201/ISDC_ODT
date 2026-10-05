import test from 'node:test';import assert from 'node:assert/strict';
import {createSolarTimeline} from '../../../user_application/web/scripts/solar_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256),H='a'.repeat(64),utc='2020-07-12T21:16:01.000416000Z';
const context=(time=utc,key='catalog:25544')=>({key,utc:time,leap_sha256:LEAP_SHA256,eop_sha256:H});
function response(p){return {...p,schema_version:1,status:'valid',frame:'ITRF',end_utc:codec.advance(p.start_utc,p.count-1),eop_sha256:H,leap_sha256:LEAP_SHA256,solar_model:'ERFA_builtin',frame_transform:'IAU2006_2000A',observed_cip_offsets:false,purpose:'display_geometry',units:{direction:'unitless',time:'UTC'},rows:Array.from({length:p.count},(_,i)=>({utc:codec.advance(p.start_utc,i),status:'valid',direction_to_sun:[Math.cos(i*1e-4),Math.sin(i*1e-4),0],eop_quality:{ut1:'final_b',polar_motion:'final_b'}}))};}
function fixture(call=p=>Promise.resolve(response(p))){const requests=[],shown=[],signals=[];let serial=0;const c=createSolarTimeline({solarSamples(p,options){requests.push(p);signals.push(options.signal);return call(p);}},v=>shown.push(v),()=>{},{requestId:()=>`solar-${++serial}`});return{c,requests,shown,signals};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('601 SI samples, normalized adjacent interpolation, endpoint exactness and readonly copied access',async()=>{
 const f=fixture();f.c.setContext(context());await flush();assert.equal(f.requests.length,1);assert.equal(f.requests[0].count,601);assert.equal(f.requests[0].step_seconds,1);assert.equal(f.shown.at(-1).utc,utc);
 const before=f.c.snapshot(),shown=f.shown.length,half=codec.advance(utc,.5),row=f.c.sampleAt(half);
 assert.ok(Math.abs(Math.hypot(...row.direction_to_sun)-1)<1e-14);assert.ok(Math.abs(Math.atan2(row.direction_to_sun[1],row.direction_to_sun[0])-5e-5)<1e-12);assert.equal(row.interpolated,true);
 assert.deepEqual(f.c.sampleAt(codec.advance(utc,600)).direction_to_sun,response(f.requests[0]).rows[600].direction_to_sun);assert.equal(f.c.sampleAt(codec.advance(utc,600)).interpolated,false);
 row.direction_to_sun[0]=9;row.eop_quality.ut1='bad';assert.notEqual(f.c.sampleAt(half).direction_to_sun[0],9);assert.equal(f.c.sampleAt(half).eop_quality.ut1,'final_b');assert.deepEqual(f.c.snapshot(),before);assert.equal(f.shown.length,shown);assert.equal(f.c.sampleAt(codec.advance(utc,-.1)),null);assert.equal(f.c.sampleAt(codec.advance(utc,600.1)),null);f.c.destroy();
});
test('60x display updates prefetch with120 SI seconds left, coalesce and retain available samples',async()=>{
 let release;const f=fixture(p=>f.requests.length===1?Promise.resolve(response(p)):new Promise(r=>release=()=>r(response(p))));f.c.setContext(context());await flush();
 for(let i=1;i<480;i++)f.c.setContext(context(codec.advance(utc,i)));assert.equal(f.requests.length,1);
 f.c.setContext(context(codec.advance(utc,480)));assert.equal(f.requests.length,2);assert.equal(f.requests[1].start_utc,codec.advance(utc,480));
 for(let i=481;i<=599;i++)f.c.setContext(context(codec.advance(utc,i)));assert.equal(f.requests.length,2);assert.equal(f.shown.at(-1).utc,codec.advance(utc,599));release();await flush();assert.equal(f.shown.at(-1).utc,codec.advance(utc,599));f.c.destroy();
});
test('seek/reverse latest UTC and context generation discard late responses and abort old work',async()=>{
 const pending=[];const f=fixture(p=>new Promise(r=>pending.push(()=>r(response(p)))));f.c.setContext(context());f.c.setContext(context(codec.advance(utc,50)));assert.equal(f.requests.length,1);pending[0]();await flush();assert.equal(f.shown.at(-1).utc,codec.advance(utc,50));
 f.c.setContext(context(codec.advance(utc,900)));assert.equal(f.shown.at(-1),null);f.c.setContext(context(codec.advance(utc,-10)));assert.equal(f.signals[1].aborted,true);assert.equal(f.requests.length,3);pending[1]();await flush();assert.equal(f.shown.at(-1),null);pending[2]();await flush();assert.equal(f.shown.at(-1).utc,codec.advance(utc,-10));
 f.c.setContext(context(utc,'stored:ISS'));assert.equal(f.shown.at(-1),null);f.c.clear();assert.equal(f.signals[3].aborted,true);pending[3]();await flush();assert.equal(f.shown.at(-1),null);assert.equal(f.c.snapshot().key,null);f.c.destroy();
});
test('leap-second buffer and fractional seek reuse the shared UTC codec',async()=>{
 const f=fixture(),start='2016-12-31T23:59:59.000000000Z';f.c.setContext(context(start));await flush();assert.equal(f.c.sampleAt(codec.advance(start,1)).utc,'2016-12-31T23:59:60.000000000Z');assert.equal(f.c.sampleAt(codec.advance(start,1.5)).utc,'2016-12-31T23:59:60.500000000Z');f.c.setContext(context(codec.advance(start,2)));assert.equal(f.shown.at(-1).utc,'2017-01-01T00:00:00.000000000Z');assert.equal(f.requests.length,1);f.c.destroy();
});
test('malformed or mismatched provenance, bounds, cadence, units and vectors never produce geometry',async()=>{
 for(const mutate of [v=>v.schema_version=2,v=>v.status='unknown',v=>v.client_request_id='other',v=>v.frame='TEME',v=>v.eop_sha256='b'.repeat(64),v=>v.leap_sha256='b'.repeat(64),v=>v.solar_model='synthetic',v=>v.observed_cip_offsets=true,v=>v.units.direction='m',v=>v.end_utc=v.start_utc,v=>v.step_seconds=2,v=>v.rows.pop(),v=>v.rows[1].utc=v.rows[0].utc,v=>v.rows[1].status='error',v=>v.rows[1].direction_to_sun=[0,0,0],v=>v.rows[1].direction_to_sun=[NaN,0,0],v=>v.rows[1].eop_quality.ut1='unknown']){
  const f=fixture(p=>{const v=response(p);mutate(v);return Promise.resolve(v);});f.c.setContext(context());await flush();assert.equal(f.shown.at(-1),null);assert.ok(f.c.snapshot().error);assert.equal(f.c.sampleAt(utc),null);f.c.destroy();
 }
});
test('prefetch hashes stay pinned even when context did not supply an EOP hash',async()=>{
 const f=fixture(p=>{const v=response(p);if(f.requests.length>1)v.eop_sha256='b'.repeat(64);return Promise.resolve(v);}),input={...context(),eop_sha256:null};f.c.setContext(input);await flush();f.c.setContext({...input,utc:codec.advance(utc,480)});await flush();assert.equal(f.shown.at(-1),null);assert.ok(f.c.snapshot().error);f.c.destroy();
});
test('request failure suppresses per-frame retry storms, explicit retry recovers, destroy fences late results',async()=>{
 let fail=true;const f=fixture(p=>fail?Promise.reject(Error('EOP unavailable')):Promise.resolve(response(p)));f.c.setContext(context());await flush();for(let i=0;i<100;i++)f.c.setContext(context(codec.advance(utc,i)));assert.equal(f.requests.length,1);assert.equal(f.shown.at(-1),null);fail=false;f.c.retry();await flush();assert.equal(f.requests.length,2);assert.equal(f.shown.at(-1).utc,codec.advance(utc,99));
 f.c.setContext(null);assert.equal(f.c.sampleAt(utc),null);f.c.setContext({...context(),utc:'invalid'});assert.equal(f.requests.length,2);f.c.destroy();f.c.setContext(context());f.c.retry();assert.equal(f.requests.length,2);
});

test('reverse prefetch retains old overlap and same-UTC updates never requery cached intervals',async()=>{
 const f=fixture();f.c.setContext(context());await flush();f.c.setContext(context(codec.advance(utc,480)));await flush();
 f.c.setContext(context(codec.advance(utc,500)));f.c.setContext(context(codec.advance(utc,490)));await flush();assert.equal(f.requests.length,2);
 f.c.setContext(context(codec.advance(utc,100)));await flush();assert.equal(f.requests.length,3);assert.equal(f.requests[2].start_utc,codec.advance(utc,-480));
 for(let i=0;i<100;i++)f.c.setContext(context(codec.advance(utc,100)));assert.equal(f.requests.length,3);assert.equal(f.shown.at(-1).utc,codec.advance(utc,100));assert.ok(f.c.snapshot().buffers.length<=2);f.c.destroy();
});
test('interpolated quality is conservative and malformed adjacency cannot invent a direction',async()=>{
 const f=fixture(p=>{const v=response(p);v.rows[1].eop_quality={ut1:'predicted_a',polar_motion:'observed_a'};return Promise.resolve(v);});f.c.setContext(context());await flush();assert.deepEqual(f.c.sampleAt(codec.advance(utc,.5)).eop_quality,{ut1:'predicted_a',polar_motion:'observed_a'});f.c.destroy();
 const g=fixture(p=>{const v=response(p);v.rows[0].direction_to_sun=[1,0,0];v.rows[1].direction_to_sun=[-1,0,0];return Promise.resolve(v);});g.c.setContext(context());await flush();assert.equal(g.c.sampleAt(codec.advance(utc,.5)),null);g.c.setContext(context(codec.advance(utc,.5)));await flush();assert.equal(g.shown.at(-1),null);assert.ok(g.c.snapshot().error);for(let i=0;i<10;i++)g.c.setContext(context(codec.advance(utc,.5)));assert.equal(g.requests.length,1);g.c.destroy();
});
test('destroy aborts in-flight transport and fences late completion without callbacks or retained cache',async()=>{
 let release;const f=fixture(p=>new Promise(r=>release=()=>r(response(p))));f.c.setContext(context());f.c.destroy();const count=f.shown.length;assert.equal(f.signals[0].aborted,true);release();await flush();assert.equal(f.shown.length,count);assert.equal(f.c.sampleAt(utc),null);assert.equal(f.c.snapshot().buffers.length,0);assert.equal(f.c.snapshot().pending,false);
});
