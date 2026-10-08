import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
const runtime={mode:'SIM',running:false,speed:1,elapsed_seconds:10,sequence:1,run_id:'R',scenario_id:'A',active_faults:[]};
const telemetry=Object.fromEntries(['power','temperature','attitude_error','storage','link_quality','delay_ms','loss_percent','throughput_mbps','ber','auth_percent'].map((key,i)=>[key,i+1]));
for(const [w,h] of [[1280,720],[1920,1080]])test(`SIM readability keeps all native values, event order, escaping and controls ${w}`,async()=>{
 const events=[{simulation_time:10,type:'first<',message:'<unsafe> full detail'},{simulation_time:9,type:'second',message:'previous event'}],f=fixture(w,h,{hash:'#run',planningBootstrap:async()=>({runtime,events,scenarios:[{id:'A',name:'Source'}],missions:[]})});
 try{for(let i=0;i<8;i++)await Promise.resolve();f.flush();const panel=f.get('sim-workspace');assert.match(panel.innerHTML,/aria-label="실행 제어"/);assert.match(panel.innerHTML,/aria-label="배속과 시나리오"/);assert.match(panel.innerHTML,/<details class="sim-guidance">/);
  f.streams[0].message({type:'telemetry',runtime,telemetry,events,missions:[],wall_time:'2026-10-07T00:00:00Z',data_quality:{mode:'SIM',source:'deterministic-sim'}});
  const metrics=f.get('sim-metrics').innerHTML;assert.equal((metrics.match(/class="sim-metric-card"/g)||[]).length,10);for(const value of Object.values(telemetry))assert.match(metrics,new RegExp('<dd title="'+value+'">'));assert.match(metrics,/단위 미확인/);
  const log=f.get('sim-events').innerHTML;assert.match(log,/<table/);assert.match(log,/SIM 시각/);assert.match(log,/first&lt;/);assert.match(log,/&lt;unsafe&gt; full detail/);assert.ok(log.indexOf('first&lt;')<log.indexOf('second'));assert.doesNotMatch(log,/<unsafe>/);
  f.get('sim-target').value='preserved draft';await f.get('sim-target').dispatch('input');f.streams[0].message({type:'telemetry',runtime:{...runtime,sequence:2},telemetry,events,missions:[],wall_time:'2026-10-07T00:00:01Z',data_quality:{mode:'SIM',source:'deterministic-sim'}});assert.equal(f.get('sim-target').value,'preserved draft');assert.equal(f.counts().commands,0);assert.equal(f.viewers.length,1);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
