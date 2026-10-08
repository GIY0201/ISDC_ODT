import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
const r={mode:'SIM',running:false,speed:1,elapsed_seconds:0,sequence:0,run_id:'R',scenario_id:'A',active_faults:[]};
const m={id:'M',name:'Server mission',status:'planned',progress:0,plan_version:1,tasks:[]};
const metrics=Object.fromEntries(['power','temperature','attitude_error','storage','link_quality','delay_ms','loss_percent','throughput_mbps','ber','auth_percent'].map(k=>[k,7]));
const tick=async f=>{await Promise.resolve();await Promise.resolve();f.flush();};
for(const [w,h] of [[1280,720],[1920,1080]])test(`actual SIM assembly preserves form nodes, window drafts and orbit ${w}x${h}`,async()=>{
  const calls=[];const f=fixture(w,h,{hash:'#run',planningBootstrap:async()=>({runtime:r,scenarios:[{id:'A',name:'Server'}],events:[],missions:[m]}),runtimeSpeed:async speed=>{calls.push(speed);return {...r,speed};}});
  try{
    await tick(f);assert.ok(f.doc.getElementById('sim-workspace'));assert.equal(f.streams.length,1);
    const input=f.get('sim-speed');input.value='2.5';await input.dispatch('input');assert.equal(f.get('sim-speed'),input);
    f.streams[0].message({type:'telemetry',runtime:r,telemetry:metrics,events:[],missions:[m],wall_time:'2026-10-04T00:00:00Z',data_quality:{mode:'SIM',source:'deterministic-sim'}});
    assert.equal(f.get('sim-speed'),input);assert.equal(input.value,'2.5');assert.match(f.get('sim-metrics').innerHTML,/7/);
    await f.get('sim-apply-speed').dispatch('click');assert.deepEqual(calls,[2.5]);
    f.context.applyWorkspaceDraft([{id:'sim-target',value:'preserved'}],true);
    await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');
    assert.equal(f.get('sim-target').value,'preserved');assert.equal(f.streams.length,1);
    assert.equal(f.viewers.length,1);assert.equal(f.counts().commands,0);
    await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.streams[0].closed,1);
  }finally{f.dispose();}
});
test('mission telemetry changes readonly status without replacing an edited task input',async()=>{
 const f=fixture(1280,720,{hash:'#mission',planningBootstrap:async()=>({missions:[m]})});
 try{await tick(f);const input=f.get('mw-name');input.value='local draft';await input.dispatch('input');
 f.streams[0].message({type:'telemetry',runtime:r,telemetry:metrics,events:[],missions:[{...m,status:'running',progress:10}],wall_time:'2026-10-04T00:00:00Z',data_quality:{mode:'SIM',source:'deterministic-sim'}});
 assert.equal(f.get('mw-name'),input);assert.equal(input.value,'local draft');assert.match(f.get('mw-summary').innerHTML,/수행 중.*10%/);
 await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.streams[0].closed,1);
 }finally{f.dispose();}
});
