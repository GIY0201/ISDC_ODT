import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogScene} from '../../../user_application/web/scripts/catalog_scene.js';
import {LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const utc='2020-07-12T21:16:01.000416000Z';
const context={group:'active',query:'',orbit:'all'};
const deferred=()=>{let resolve,reject;return{promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve,reject};};
const reply=(p,rows=3)=>({version:1,status:'valid',client_request_id:p.client_request_id,...context,utc:p.utc,
 source:'celestrak-cache',fetched_at:utc,warning:'',stale:false,scene_sha256:'a'.repeat(64),count:rows,valid_count:rows,error_count:0,
 frame:'ITRF',profile:'WGS72_AFSPC',eop_kind:'IERS_A',eop_quality:{ut1:'final_b',polar_motion:'final_b'},eop_sha256:'b'.repeat(64),leap_sha256:LEAP_SHA256,units:{position:'m',time:'UTC'},
 rows:Array.from({length:rows},(_,i)=>({catalog_number:i+1,name:`sat${i+1}`,orbit_regime:'LEO',normalized_gp_sha256:'c'.repeat(64),epoch_utc:utc,status:'valid',error_code:null,position_m:[7000000,i+1,3]}))});
function host(){let ms=0,id=0;const timers=new Map();return{now:()=>ms,requestId:()=>String(++id),setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:id=>timers.delete(id),advance:value=>{ms=value;const work=[...timers.values()];timers.clear();for(const fn of work)fn();},timers};}

test('whole16633 owned response, metadata snapshot and off-page pick; explicit load only',async()=>{
 const seen=[],calls=[],h=host();const c=createCatalogScene({catalogScene:async p=>(calls.push(p),reply(p,16633))},v=>seen.push(v),()=>{},h);
 c.configure({...context,limit:100,offset:100});assert.equal(calls.length,0);await c.load(utc);
 assert.equal(c.snapshot().result.count,16633);assert.equal(c.snapshot().result.rows,undefined);
 assert.equal(c.row(16633).catalog_number,16633);assert.equal(calls[0].limit,undefined);
 seen.find(v=>v?.rows).rows[0].position_m[0]=0;const row=c.row(1);assert.equal(row.position_m[0],7000000);row.position_m[0]=4;assert.equal(c.row(1).position_m[0],7000000);
 c.configure({...context,offset:0});assert.equal(c.snapshot().result.count,16633);c.destroy();assert.equal(h.timers.size,0);
});
test('latest UTC coalesces to one pending request and one wall-second cadence',async()=>{
 const h=host(),pending=[],calls=[];const c=createCatalogScene({catalogScene:p=>{calls.push(p);const d=deferred();pending.push(d);return d.promise;}},()=>{},()=>{},h);
 c.configure(context);const first=c.load(utc);c.observe('2020-07-12T21:16:02Z');c.observe('2020-07-12T21:16:03Z');assert.equal(calls.length,1);
 pending[0].resolve(reply(calls[0]));await first;assert.equal(calls.length,1);assert.equal(h.timers.size,1);
 h.advance(1000);await Promise.resolve();assert.equal(calls.length,2);assert.equal(calls[1].utc,'2020-07-12T21:16:03.000000000Z');assert.equal(calls[1].expected_scene_sha256,'a'.repeat(64));
 pending[1].resolve(reply(calls[1]));await Promise.resolve();await Promise.resolve();assert.equal(c.snapshot().pending,false);c.destroy();
});
test('context changes and clear fence late responses and abort old transport',async()=>{
 const h=host(),d=deferred(),signals=[],seen=[];const c=createCatalogScene({catalogScene:(p,o)=>(signals.push(o.signal),d.promise)},v=>seen.push(v),()=>{},h);
 c.configure(context);const request=c.load(utc);c.configure({...context,query:'ISS'});assert.equal(signals[0].aborted,true);d.resolve(reply({client_request_id:'1',utc}));await request;
 assert.equal(c.snapshot().result,null);assert.equal(seen.at(-1),null);c.clear();assert.equal(c.snapshot().enabled,false);c.destroy();
});
test('partial failures are masked; malformed count/UTC/hash/position/duplicate/provenance clear scene',async()=>{
 const h=host();let mutate=v=>v;const seen=[];const c=createCatalogScene({catalogScene:async p=>mutate(reply(p))},v=>seen.push(v),()=>{},h);c.configure(context);
 mutate=v=>{v.rows[1]={...v.rows[1],status:'error',error_code:'decayed',position_m:null};v.status='partial';v.valid_count=2;v.error_count=1;return v;};await c.load(utc);assert.equal(c.row(2).position_m,null);assert.equal(c.snapshot().result.status,'partial');
 for(const change of [v=>v.count++,v=>v.utc='2020-07-12T21:17:01.000416000Z',v=>v.scene_sha256='bad',v=>v.rows[0].position_m[0]=NaN,v=>v.rows[1].catalog_number=1,v=>v.leap_sha256='d'.repeat(64),v=>v.profile='WGS84']){
  mutate=v=>{change(v);return v;};await c.load(utc);assert.equal(c.snapshot().result,null);assert.match(c.snapshot().error,/응답/);assert.equal(seen.at(-1),null);
 }c.destroy();
});
test('changed GP409 notifies conflict and stops automatic retries; invalid UTC never queries',async()=>{
 let calls=0,conflicts=0;const c=createCatalogScene({catalogScene:async()=>{calls++;throw Object.assign(Error('GP changed'),{status:409});}},()=>{},()=>{}, {...host(),onConflict:()=>conflicts++});
 c.configure(context);await c.load('bad');assert.equal(calls,0);await c.load(utc);assert.equal(conflicts,1);assert.equal(c.snapshot().enabled,false);c.observe('2020-07-12T21:17:01Z');assert.equal(calls,1);c.destroy();
});
test('invalid explicit UTC aborts prior in-flight response instead of restoring old points',async()=>{const d=deferred();let p,signal;const c=createCatalogScene({catalogScene:(payload,o)=>(p=payload,signal=o.signal,d.promise)},()=>{},()=>{},host());c.configure(context);const request=c.load(utc);await c.load('bad');assert.equal(signal.aborted,true);d.resolve(reply(p));await request;assert.equal(c.snapshot().result,null);assert.equal(c.snapshot().enabled,false);c.destroy();});

test('large response yields to user interaction before publishing a complete snapshot',async()=>{
 const pause=deferred(),seen=[];let yields=0;
 const c=createCatalogScene({catalogScene:async p=>reply(p,16633)},v=>seen.push(v),()=>{},{...host(),yieldTask:async()=>{yields++;if(yields===1)await pause.promise;}});
 c.configure(context);const load=c.load(utc);await Promise.resolve();await Promise.resolve();
 assert.equal(yields,1);assert.equal(c.snapshot().pending,true);assert.equal(c.snapshot().result,null);assert.equal(seen.filter(Boolean).length,0);
 pause.resolve();await load;assert.ok(yields>1);assert.equal(c.snapshot().result.count,16633);assert.equal(seen.filter(Boolean).length,1);assert.equal(c.row(16633).catalog_number,16633);c.destroy();
});

test('clear during yielded validation fences prepared rows and late failures never publish partial positions',async()=>{
 const pause=deferred(),seen=[];let yields=0;
 const c=createCatalogScene({catalogScene:async p=>reply(p,16633)},v=>seen.push(v),()=>{},{...host(),yieldTask:async()=>{yields++;if(yields===1)await pause.promise;}});
 c.configure(context);const load=c.load(utc);await Promise.resolve();await Promise.resolve();assert.equal(yields,1);
 c.clear();pause.resolve();await load;assert.equal(c.snapshot().result,null);assert.equal(c.snapshot().error,'');assert.equal(c.row(1),null);assert.equal(seen.filter(Boolean).length,0);c.destroy();
 const invalid=createCatalogScene({catalogScene:async p=>{const v=reply(p,16633);v.rows.at(-1).position_m[0]=NaN;return v;}},v=>seen.push(v),()=>{},{...host(),yieldTask:async()=>{}});
 invalid.configure(context);await invalid.load(utc);assert.equal(invalid.snapshot().result,null);assert.match(invalid.snapshot().error,/응답/);assert.equal(seen.filter(Boolean).length,0);invalid.destroy();
});
