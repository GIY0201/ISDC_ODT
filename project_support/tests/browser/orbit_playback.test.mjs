// T017 acceptance contract. The T018 implementation intentionally does not exist yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectUtc,interpolateSample} from '../../../user_application/web/scripts/orbit_playback.js';

test('paused snapshot and return to an earlier UTC preserve the server timestamp',()=>{
  const paused={current_utc:'2020-07-12T21:16:01.000416000Z',playing:false,play_rate:1};
  const advance=()=>{throw new Error('paused clock must not advance');};
  assert.equal(projectUtc(paused,1000,9000,advance),paused.current_utc);
  const returned={...paused,current_utc:'2020-07-12T21:15:01.000416000Z'};
  assert.equal(projectUtc(returned,9000,10000,advance),returned.current_utc);
});
test('playback projects elapsed monotonic time and rate without mutating the snapshot',()=>{
  const state={current_utc:'2020-07-12T21:16:01.000416000Z',playing:true,play_rate:60};
  const before=structuredClone(state);const calls=[];
  const advance=(utc,seconds)=>(calls.push([utc,seconds]),'projected');
  assert.equal(projectUtc(state,1000,2000,advance),'projected');
  assert.deepEqual(calls,[[state.current_utc,60]]);assert.deepEqual(state,before);
  projectUtc(state,2000,1000,advance);assert.equal(calls.at(-1)[1],0);
});
test('one-second valid samples interpolate metres and degrees without modifying buffers',()=>{
  const rows=[{utc:0,position_m:[1,2,3],elevation_deg:10,status:'valid'},{utc:1,position_m:[5,6,7],elevation_deg:12,status:'valid'}];
  const before=structuredClone(rows);const difference=(a,b)=>a-b;
  const mid=interpolateSample(rows,.5,difference);
  assert.deepEqual(mid.position_m,[3,4,5]);assert.equal(mid.elevation_deg,11);assert.equal(mid.utc,.5);assert.deepEqual(rows,before);
  assert.deepEqual(interpolateSample(rows,0,difference).position_m,rows[0].position_m);
});
test('outside buffer, missing/error rows, malformed or excessive gaps never extrapolate',()=>{
  const a={utc:0,position_m:[1,2,3],elevation_deg:10,status:'valid'};
  const b={...a,utc:1};const difference=(x,y)=>x-y;
  for(const [rows,utc] of [[[],0],[[a,b],-.1],[[a,b],1.1],[[a,{...b,status:'error',position_m:null}],.5],[[a,{...b,position_m:[NaN,2,3]}],.5],[[a,{...b,utc:60}],30],[[b,a],.5],[[a,{...b,utc:0}],0]]){
    assert.equal(interpolateSample(rows,utc,difference),null);
  }
});
