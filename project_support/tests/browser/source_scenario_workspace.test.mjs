import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
const keys=['power','temperature','attitude_error','storage','link_quality','delay_ms','loss_percent','throughput_mbps','ber','auth_percent'];
for(const [width,height] of [[1280,720],[1920,1080]])test(`source scenario view follows existing telemetry owner without GP commands ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#run'});
 try{
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.streams.length,1);const before=f.snapshot().state.current_utc;
  const send=seconds=>f.streams[0].message({type:'telemetry',runtime:{mode:'SIM',running:false,speed:1,elapsed_seconds:seconds,sequence:seconds,run_id:'RUN-A',scenario_id:'A',active_faults:[],started_at:'2026-10-07T01:00:00+09:00'},telemetry:Object.fromEntries(keys.map(k=>[k,1])),events:[],missions:[],wall_time:'2026-10-06T16:00:00Z',data_quality:{mode:'SIM',source:'deterministic-sim'}});
  send(10);assert.match(f.get('sc-utc').textContent,/2026-10-06T16:00:10/);
  send(20);assert.match(f.get('sc-utc').textContent,/2026-10-06T16:00:20/);
  assert.equal(f.snapshot().state.current_utc,before);assert.equal(f.counts().commands,0);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
