import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspacePlayback} from '../../../user_application/web/scripts/workspace_playback.js';
import {LEAP_SHA256,createUtcCodec} from '../../../user_application/web/scripts/orbit_utc.js';
import {createOrbitSelection} from '../../../user_application/web/scripts/orbit_selection.js';

test('initialized paused observer discovers another client play and pause on the existing timer without a draft write or focus event',async()=>{
 let server={revision:1,input_id:'iss',input_hash:'hash',current_utc:'2020-07-12T21:16:01.000416000Z',playing:false,play_rate:1,leap_sha256:LEAP_SHA256,ground_point:{latitude_deg:33,longitude_deg:126,ellipsoid_height_m:0},minimum_elevation_deg:10};
 let reads=0,writes=0,timer,driver;const draft={utc:'unsaved UTC',height:'444'},before=structuredClone(draft),frames=[];
 const api={orbitInputs:async()=>({inputs:[{input_id:'iss',epoch_utc:server.current_utc}]}),orbitState:async()=>{reads++;return structuredClone(server);},selectOrbit:async p=>{writes++;assert.equal(p.expected_revision,server.revision);server={...server,...p,current_utc:p.anchor_utc,revision:server.revision+1};return structuredClone(server);},orbitSamples:async p=>({...p,client_request_id:p.client_request_id,revision:p.selection_revision,input_id:p.input_id,input_hash:'hash',leap_sha256:LEAP_SHA256,stale:false,status:'complete',rows:[]})};
 const observer=createOrbitSelection(api,s=>driver?.update(s),()=> 'observer',()=>0),actor=createOrbitSelection(api,()=>{},()=> 'actor',()=>0);
 driver=createWorkspacePlayback(observer,()=>{},{now:()=>0,requestFrame:fn=>(frames.push(fn),1),cancelFrame(){},setTimer:fn=>(timer=fn,1),clearTimer(){}});
 await observer.load();await actor.load();await actor.control('play');const beforeTick=reads;timer();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(reads,beforeTick+1);assert.equal(observer.snapshot().state.playing,true);assert.equal(observer.snapshot().state.revision,server.revision);assert.ok(frames.length>0);assert.equal(writes,1);assert.deepEqual(draft,before);
 await actor.control('pause');timer();await new Promise(resolve=>setImmediate(resolve));assert.equal(observer.snapshot().state.playing,false);assert.equal(writes,2);assert.deepEqual(draft,before);
 driver.destroy();observer.destroy();actor.destroy();
});

test('state observation timer skips uninitialized pending or fetching input and serializes a slow read through disposal',async()=>{
 let timer,finish,calls=0,clears=0;const client={samples(){},refresh(){calls++;return new Promise(resolve=>{finish=resolve;});}};
 const driver=createWorkspacePlayback(client,()=>{},{now:()=>0,requestFrame:()=>1,cancelFrame(){},setTimer:fn=>(timer=fn,1),clearTimer:()=>clears++});
 timer();assert.equal(calls,0);const state={current_utc:'2020-07-12T21:16:01.000416000Z',playing:false,revision:1,leap_sha256:LEAP_SHA256};
 driver.update({state,status:'pending',fetching:false});timer();assert.equal(calls,0);
 driver.update({state,status:'ready',fetching:true});timer();assert.equal(calls,0);
 driver.update({state,status:'ready',fetching:false});timer();timer();assert.equal(calls,1);finish();await new Promise(resolve=>setImmediate(resolve));timer();assert.equal(calls,2);
 driver.destroy();finish();await new Promise(resolve=>setImmediate(resolve));timer();assert.equal(calls,2);assert.equal(clears,1);
});
test('failed timer reads release the observation slot without escaping the timer or creating a frame query',async()=>{
 let timer,calls=0,samples=0;
 const client={samples(){samples++;},refresh(){calls++;if(calls===1)throw new Error('synchronous transport failure');if(calls===2)return Promise.reject(new Error('asynchronous transport failure'));return Promise.resolve();}};
 const driver=createWorkspacePlayback(client,()=>{},{now:()=>0,requestFrame:()=>1,cancelFrame(){},setTimer:fn=>(timer=fn,1),clearTimer(){}});
 driver.update({state:{current_utc:'2020-07-12T21:16:01.000416000Z',playing:false,revision:1,leap_sha256:LEAP_SHA256},status:'ready',fetching:false});
 assert.doesNotThrow(timer);assert.equal(calls,1);timer();timer();assert.equal(calls,2);
 await new Promise(resolve=>setImmediate(resolve));timer();assert.equal(calls,3);assert.equal(samples,0);
 driver.destroy();
});
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
