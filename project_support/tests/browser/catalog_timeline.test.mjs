import test from 'node:test';import assert from 'node:assert/strict';
import {createCatalogTimeline} from '../../../user_application/web/scripts/catalog_timeline.js';
import {LEAP_SHA256,createUtcCodec} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256),H='a'.repeat(64),base={group:'active',catalog_number:25544,name:'ISS',utc:'2020-07-12T21:16:01.000416000Z',epoch_utc:'2020-07-12T21:16:01.000416000Z',normalized_gp_sha256:H,eop_sha256:H,leap_sha256:LEAP_SHA256,frame:'ITRF',profile:'WGS72_AFSPC',eop_kind:'IERS_A',eop_quality:{ut1:'final_b',polar_motion:'final_b'},source:'celestrak-cache',position_m:[7e6,1,2]};
const point={latitude_deg:36.3742,longitude_deg:127.3567,ellipsoid_height_m:0,virtual:true,ellipsoid:'WGS84'};
function response(p){return {...base,...p,version:1,status:'valid',communication_status:'unknown',units:{position:'m',range:'m',elevation:'deg',azimuth:'deg',time:'UTC'},rows:Array.from({length:p.count},(_,i)=>({utc:codec.advance(p.start_utc,i),status:'valid',error_code:null,position_m:[7e6+i,1,2],elevation_deg:10,range_m:1000+i,azimuth_deg:350,visible:true,eop_quality:base.eop_quality}))};}
function fixture(call=p=>Promise.resolve(response(p))){let now=0,frame;const shown=[],requests=[];const c=createCatalogTimeline({catalogSamples:async p=>{requests.push(p);return call(p);}},v=>shown.push(v),()=>{},{now:()=>now,requestFrame:fn=>(frame=fn,1),cancelFrame:()=>{frame=null;},requestId:()=> 'time-test'});return{c,shown,requests,tick(ms){now=ms;const work=frame;frame=null;work?.();}};}
test('time query pins GP and observer with no stored orbit commands; playback uses prepared buffer',async()=>{
 const f=fixture();f.c.select(base);f.c.observer(point,5);await f.c.calculate();assert.equal(f.requests[0].count,601);assert.equal(f.requests[0].normalized_gp_sha256,H);assert.deepEqual(f.requests[0].ground_point,point);assert.equal(f.shown.at(-1).elevation_deg,10);
 f.c.play();f.tick(500);assert.equal(f.shown.at(-1).position_m[0],7000000.5);assert.equal(f.requests.length,1);assert.equal(f.shown.at(-1).observation_utc,base.utc);f.c.pause();f.tick(2000);assert.equal(f.requests.length,1);f.c.destroy();
});
test('late result after observer change or clear never restores position',async()=>{
 let release;const f=fixture(p=>new Promise(r=>release=()=>r(response(p))));f.c.select(base);f.c.observer(point,5);const work=f.c.calculate();f.c.observer({...point,latitude_deg:78},3);release();await work;assert.equal(f.c.snapshot().buffer,null);assert.equal(f.c.snapshot().playing,false);f.c.clear();assert.equal(f.c.snapshot().selected,null);
});
test('bad provenance/row contracts and request failures hide time results',async()=>{
 for(const change of [v=>v.normalized_gp_sha256='b'.repeat(64),v=>v.rows[1].utc=v.rows[0].utc,v=>v.rows[0].range_m=-1,v=>v.ground_point={...point,latitude_deg:0},v=>v.units.range='km',v=>v.rows.pop(),v=>v.rows[0].visible=false]){
  const f=fixture(p=>{const v=response(p);change(v);return Promise.resolve(v);});f.c.select(base);f.c.observer(point,5);await f.c.calculate();assert.ok(f.c.snapshot().error);assert.equal(f.c.snapshot().buffer,null);f.c.destroy();
 }
});
test('failed native rows remain gaps and leap-seconds use the existing codec',async()=>{
 const leap={...base,utc:'2016-12-31T23:59:59.000000000Z',epoch_utc:'2016-12-31T23:59:59.000000000Z'};
 const f=fixture(p=>{const v=response(p);v.epoch_utc=leap.epoch_utc;v.status='partial';v.rows[1]={...v.rows[1],status:'error',error_code:'decayed',position_m:null,elevation_deg:null,range_m:null,azimuth_deg:null,visible:null};return Promise.resolve(v);});f.c.select(leap);f.c.observer(point,5);await f.c.calculate();f.c.play();f.tick(500);assert.equal(f.shown.at(-1),null);f.tick(1000);assert.equal(f.shown.at(-1),null);f.tick(2000);assert.equal(f.c.snapshot().display.utc,'2017-01-01T00:00:00.000000000Z');f.c.destroy();
});
test('prefetch overlaps continuously, suppresses duplicate requests and discards late results after seek',async()=>{
 let release;const f=fixture(p=>f.requests.length===1?Promise.resolve(response(p)):new Promise(r=>release=()=>r(response(p))));
 f.c.select(base);f.c.observer(point,5);await f.c.calculate();f.c.rate(60);f.c.play();f.tick(5000);
 assert.equal(f.requests.length,2);assert.equal(f.requests[1].start_utc,codec.advance(base.utc,300));assert.equal(f.c.snapshot().pending,true);
 f.tick(5500);assert.equal(f.requests.length,2);assert.equal(f.c.snapshot().display.utc,codec.advance(base.utc,330));
 release();await new Promise(r=>setImmediate(r));assert.equal(f.c.snapshot().buffer.start_utc,codec.advance(base.utc,300));
 f.tick(10000);assert.equal(f.requests.length,3);f.c.seek(codec.advance(base.utc,90));release();await new Promise(r=>setImmediate(r));
 assert.equal(f.c.snapshot().utc,codec.advance(base.utc,90));assert.equal(f.c.snapshot().buffer,null);assert.equal(f.c.snapshot().display,null);assert.equal(f.c.snapshot().playing,false);f.c.destroy();
});
test('rate switches preserve elapsed UTC and background failure stops replay and clears marker',async()=>{
 const f=fixture(p=>f.requests.length===1?Promise.resolve(response(p)):Promise.reject(Error('EOP unavailable')));
 f.c.select(base);f.c.observer(point,5);await f.c.calculate();f.c.play();f.tick(1000);f.c.rate(10);f.tick(2000);
 assert.equal(f.c.snapshot().utc,codec.advance(base.utc,11));f.c.rate(60);f.tick(7000);await new Promise(r=>setImmediate(r));
 assert.equal(f.requests.length,2);assert.equal(f.c.snapshot().playing,false);assert.equal(f.c.snapshot().buffer,null);assert.equal(f.shown.at(-1),null);assert.match(f.c.snapshot().error,/EOP unavailable/);f.c.destroy();
});
