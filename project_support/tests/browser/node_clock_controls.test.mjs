import test from 'node:test';
import assert from 'node:assert/strict';
import {createNodeClockControls} from '../../../user_application/web/scripts/nodes/clock_controls.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const utc='2026-10-04T22:01:12.000000000Z',hash='a'.repeat(64);
function fixture(){
 const calls=[],codec=createUtcCodec(LEAP_SHA256);let context={key:'stored:input:raw',utc,leap_sha256:LEAP_SHA256};
 const state={input_id:'input',input_hash:'raw',playing:false,play_rate:1,current_utc:utc},catalogState={selected:{catalog_number:25544,normalized_gp_sha256:hash},buffer:{count:601},playing:false,rate:10};
 const stored={snapshot:()=>({state:structuredClone(state),status:'ready'}),control:async(...v)=>calls.push(['stored-control',...v]),seek:async value=>calls.push(['stored-seek',value])};
 const catalog={snapshot:()=>structuredClone(catalogState),play:()=>calls.push(['catalog-play']),pause:()=>calls.push(['catalog-pause']),rate:v=>calls.push(['catalog-rate',v]),seek:v=>calls.push(['catalog-seek',v]),calculate:async()=>calls.push(['catalog-calculate'])};
 const clock=createNodeClockControls({readContext:()=>context,stored,catalog,advanceUtc:codec.advance,now:()=>Date.parse(utc),runStored:async fn=>{calls.push(['stored-run']);return fn();}});
 return{clock,calls,state,catalogState,context:value=>context=value,get current(){return context;}};
}
test('node controls read existing owner capabilities without starting timers or changing UTC',()=>{
 const f=fixture(),before=structuredClone(f.current);assert.deepEqual(f.clock.read(f.current),{mode:'저장 궤도',running:false,speed:1,speeds:[.1,1,10,60]});assert.deepEqual(f.current,before);assert.deepEqual(f.calls,[]);
 const result=f.clock.read(f.current);result.speeds.push(600);assert.deepEqual(f.clock.read(f.current).speeds,[.1,1,10,60]);
});
test('stored play, speed, step and live use the existing server command path and displayed UTC',async()=>{
 const f=fixture();await f.clock.actions.play();await f.clock.actions.setSpeed(60);await f.clock.actions.step(-60);await f.clock.actions.live();
 assert.deepEqual(f.calls,[['stored-run'],['stored-control','play'],['stored-run'],['stored-control','speed',60],['stored-run'],['stored-seek','2026-10-04T22:00:12.000000000Z'],['stored-run'],['stored-seek',utc]]);
});
test('catalog commands stay on the catalog owner and seek calculates through its existing query',async()=>{
 const f=fixture();f.context({key:`catalog:25544:${hash}`,utc,leap_sha256:LEAP_SHA256});assert.equal(f.clock.read(f.current).speed,10);
 await f.clock.actions.pause();await f.clock.actions.play();await f.clock.actions.setSpeed(.1);await f.clock.actions.step(60);
 assert.deepEqual(f.calls,[['catalog-pause'],['catalog-play'],['catalog-rate',.1],['catalog-seek','2026-10-04T22:02:12.000000000Z'],['catalog-calculate']]);
});
test('display UTC steps preserve SI seconds across a leap second through the existing codec',async()=>{
 const f=fixture();f.context({...f.current,utc:'2016-12-31T23:59:59.000000000Z'});await f.clock.actions.step(1);
 assert.deepEqual(f.calls,[['stored-run'],['stored-seek','2016-12-31T23:59:60.000000000Z']]);
 f.context({...f.current,utc:'2016-12-31T23:59:60.000000000Z'});await f.clock.actions.step(1);
 assert.deepEqual(f.calls.at(-1),['stored-seek','2017-01-01T00:00:00.000000000Z']);
});
test('missing, foreign, noncanonical or stale display identity never selects a fallback clock',async()=>{
 const f=fixture();for(const value of [null,{key:'scene:x',utc,leap_sha256:LEAP_SHA256},{...f.current,key:'stored:other:raw'},{...f.current,utc:'bad'},{...f.current,leap_sha256:'wrong'}]){
  f.context(value);assert.deepEqual(f.clock.read(value),{});await assert.rejects(f.clock.actions.play());
 }
 assert.deepEqual(f.calls,[]);f.context({key:'stored:input:raw',utc,leap_sha256:LEAP_SHA256});await assert.rejects(f.clock.actions.setSpeed(600));assert.deepEqual(f.calls,[]);
 f.clock.destroy();await assert.rejects(f.clock.actions.pause());assert.deepEqual(f.clock.read(f.current),{});
});
