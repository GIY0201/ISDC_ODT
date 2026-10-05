import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateSatelliteManifest,createModelResolver} from '../../../digital_twin/model_library/browser/satellite_models.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {createSatelliteModelSelection} from '../../../user_application/web/scripts/orbit/satellite_model_selection.js';
function fixture(request){
 const calls=[],matches=[],timeline={currentUtc:()=> '2026-10-05T00:00:00.000000000Z',sampleAt:()=>null,advanceUtc:()=>null};
 const globe={setSatelliteModel:(...x)=>calls.push(['show',...x]),clearSatelliteModel:()=>calls.push(['clear']),modelManifestStatus:v=>calls.push(['manifest',v])};
 const c=createSatelliteModelSelection({api:{satelliteModelManifest:request},globe,timeline,validateManifest:v=>{if(v.bad)throw Error('bad schema');return v;},createResolver:()=> (item,catalog)=>{matches.push(structuredClone([item,catalog]));return item.OBJECT_NAME==='NONE'?null:{key:item.OBJECT_NAME,url:'/static/satellite_display/'+item.OBJECT_NAME+'.glb',orientation:{heading:0}};}});
 return{c,calls,matches,timeline};
}
const item=(id=25544)=>({NORAD_CAT_ID:id,OBJECT_NAME:'ISS',EPOCH:'epoch-a'});
const geometry=(id=25544,hash='a'.repeat(64))=>({catalog_number:id,normalized_gp_sha256:hash,frame:'ITRF'});

test('manifest arriving late resolves latest selection only; same target playback does not reload',async()=>{
 let release;const f=fixture(()=>new Promise(r=>release=r)),work=f.c.load();f.c.select(item(),null,geometry());f.c.select({...item(123),OBJECT_NAME:'OTHER'},null,geometry(123));release({schema:2});await work;
 const shows=f.calls.filter(x=>x[0]==='show');assert.equal(shows.at(-1)[1].satelliteId,123);assert.equal(shows.at(-1)[1].key,'OTHER');assert.equal(shows.at(-1)[2].timeSource(),f.timeline.currentUtc());
 const count=shows.length;f.c.select({...item(123),OBJECT_NAME:'OTHER'},null,geometry(123));assert.equal(f.calls.filter(x=>x[0]==='show').length,count);f.c.destroy();
});
test('current metadata only, GP changes replace render target, mismatched geometry clears; caller owned inputs',async()=>{
 const f=fixture(async()=>({schema:2}));await f.c.load();const a=item(),p={catalog:{NORAD_CAT_ID:999,OBJECT_TYPE:'DEB'},gp:{NORAD_CAT_ID:999,EPOCH:'epoch-a'}};f.c.select(a,p,geometry());assert.deepEqual(f.matches.at(-1)[1],{});
 f.c.select(a,{catalog:{NORAD_CAT_ID:25544,OBJECT_TYPE:'PAY'},gp:{NORAD_CAT_ID:25544,EPOCH:'old'}},geometry());assert.deepEqual(f.matches.at(-1)[1],{});
 const profile={catalog:{NORAD_CAT_ID:25544,OBJECT_TYPE:'PAY'},gp:{NORAD_CAT_ID:25544,EPOCH:'epoch-a'}};f.c.select(a,profile,geometry(25544,'b'.repeat(64)));assert.equal(f.matches.at(-1)[1].OBJECT_TYPE,'PAY');assert.equal(f.calls.filter(x=>x[0]==='show').at(-1)[1].normalized_gp_sha256,'b'.repeat(64));assert.deepEqual(a,item());
 f.c.select(a,profile,geometry(123));assert.equal(f.calls.at(-1)[0],'clear');f.c.destroy();
});
test('failed manifest is explicit, retry uses newest request; destroy and cleared selection fence late response',async()=>{
 let release;let attempts=0;const f=fixture(()=>++attempts===1?Promise.resolve({bad:true}):new Promise(r=>release=r));f.c.select(item(),null,geometry());await f.c.load();assert.equal(f.calls.filter(x=>x[0]==='manifest').at(-1)[1].phase,'error');
 const work=f.c.load();f.c.select(null,null,null);release({schema:2});await work;assert.equal(f.calls.filter(x=>x[0]==='show').length,0);
 const next=f.c.load();f.c.destroy();const count=f.calls.length;release({schema:2});await next;assert.equal(f.calls.length,count);
});

test('actual original manifest resolver composes ISS exact model and point-only debris with native identity',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../../digital_twin/model_library/packages/satellite_display/v1/manifest.json',import.meta.url),'utf8'));
 const calls=[],timeline={currentUtc:()=> '2026-10-05T00:00:00.000000000Z',sampleAt:()=>null,advanceUtc:()=>null};
 const c=createSatelliteModelSelection({api:{satelliteModelManifest:async()=>manifest},timeline,globe:{setSatelliteModel:d=>calls.push(d),clearSatelliteModel(){},modelManifestStatus(){}},validateManifest:validateSatelliteManifest,createResolver:createModelResolver});
 c.select(item(),{catalog:{NORAD_CAT_ID:25544,OBJECT_TYPE:'PAY'},gp:item()},geometry());await c.load();assert.equal(calls.at(-1).key,'iss');assert.equal(calls.at(-1).quality,'exact');assert.equal(calls.at(-1).url,'/static/satellite_display/iss.glb');
 c.select({...item(123),OBJECT_NAME:'UNKNOWN DEB'},null,geometry(123));assert.equal(calls.at(-1).url,undefined);assert.equal(calls.at(-1).satelliteId,123);assert.equal(calls.at(-1).normalized_gp_sha256,geometry(123).normalized_gp_sha256);c.destroy();
});

test('scene canonical epoch and original GP UTC epoch match across fractional precision, without accepting another epoch',async()=>{
 const f=fixture(async()=>({schema:2})),codec=createUtcCodec(LEAP_SHA256);f.timeline.advanceUtc=(utc,seconds)=>{try{return codec.advance(utc,seconds);}catch{return null;}};await f.c.load();
 const a={...item(),EPOCH:'2026-10-05T00:00:00.123456000Z'},profile={catalog:{NORAD_CAT_ID:25544,OBJECT_TYPE:'PAY'},gp:{...item(),EPOCH:'2026-10-05T00:00:00.123456'}};
 f.c.select(a,profile,geometry());assert.equal(f.matches.at(-1)[1].OBJECT_TYPE,'PAY');profile.gp.EPOCH='2026-10-05T00:00:00.123456001Z';f.c.select(a,profile,geometry());assert.deepEqual(f.matches.at(-1)[1],{});f.c.destroy();
});
