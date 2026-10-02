import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspacePlayback} from '../../../user_application/web/scripts/workspace_playback.js';
import {LEAP_SHA256,createUtcCodec} from '../../../user_application/web/scripts/orbit_utc.js';
test('render frames use the prepared buffer without per-frame HTTP and stop cleanly',()=>{
  let now=0,next,queries=0,cancelled=0,cleared=0;const shown=[];
  const client={samples(){queries++;},refresh(){}};
  const driver=createWorkspacePlayback(client,(...args)=>shown.push(args),{now:()=>now,requestFrame:fn=>(next=fn,1),cancelFrame:()=>cancelled++,setTimer:()=>1,clearTimer:()=>cleared++});
  const utc='2020-07-12T21:16:01.000416000Z';
  const state={current_utc:utc,playing:true,play_rate:1,revision:1,leap_sha256:LEAP_SHA256};
  const codec=createUtcCodec(LEAP_SHA256);
  const result={client_request_id:'buffer',rows:Array.from({length:601},(_,i)=>({utc:codec.advance(utc,i),status:'valid',position_m:[1+2*i,2+2*i,3+2*i],elevation_deg:10+.01*i}))};
  driver.update({state,result,status:'ready',fetching:false,receivedAtMs:0});
  for(let i=1;i<=30;i++){now=i*10;next();}
  assert.equal(queries,0);assert.equal(shown.at(-1)[2],'2020-07-12T21:16:01.300416000Z');assert.deepEqual(shown.at(-1)[1].position_m,[1.6,2.6,3.6]);
  driver.update({state:{...state,playing:false},result,status:'ready',receivedAtMs:0});assert.equal(shown.at(-1)[2],utc);
  driver.destroy();driver.destroy();assert.ok(cancelled>=1);assert.equal(cleared,1);
});
test('buffer exhaustion hides positions and requests one bounded prefetch',()=>{
  const requests=[],shown=[];const client={samples:p=>requests.push(p),refresh(){}};
  const driver=createWorkspacePlayback(client,(...args)=>shown.push(args),{now:()=>0,requestFrame:()=>1,cancelFrame(){},setTimer:()=>1,clearTimer(){}});
  const data={state:{current_utc:'2020-07-12T21:16:01Z',playing:true,play_rate:60,revision:1,leap_sha256:LEAP_SHA256},result:null,status:'ready',receivedAtMs:0};
  driver.update(data);driver.update(data);
  assert.equal(shown.at(-1)[1],null);assert.equal(requests.length,1);assert.equal(requests[0].stepSeconds,1);assert.equal(requests[0].count,601);driver.destroy();
});
