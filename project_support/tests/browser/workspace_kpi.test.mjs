import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
const runtime={mode:'SIM',running:false,speed:1,elapsed_seconds:0,sequence:0,run_id:'R',scenario_id:'S',active_faults:[]};
const analytics={run_id:'R',scenario_id:'S',generated_at:'2026-10-04T00:00:00Z',overall:100,verdict:'PASS',provenance:{mode:'SIM',data_quality:'GOOD',is_simulation:true,rule_set:'SIM-VNV-0.2',recording:true},kpis:[{id:'KPI-02',name:'Delay',value:20,target:50,unit:'ms',inverse:true,status:'pass',formula:'current',source:'SIM',delta:-30,samples:1,missing_percent:0}],requirements:[{id:'REQ',name:'Requirement',test:'TC',result:'PASS',evidence:'R',kpi_id:'KPI-02'}]};
for(const [w,h] of [[1280,720],[1920,1080]])test(`V6 KPI actual assembly/shared stream/filters/window retention ${w}x${h}`,async()=>{
 const f=fixture(w,h,{hash:'#data',planningBootstrap:async()=>({runtime,analytics,events:[],missions:[]})});
 try{await Promise.resolve();await Promise.resolve();f.flush();assert.ok(f.doc.getElementById('kpi-workspace'));assert.equal(f.streams.length,1);
 const selected=f.get('kpi-select');assert.match(f.get('kpi-summary').textContent,/PASS/);assert.match(f.get('kpi-detail').innerHTML,/20.*ms/);
 const filter=f.get('kpi-filter-PASS');filter.checked=false;await filter.dispatch('change');
 f.streams[0].message({type:'telemetry',runtime,analytics,events:[],missions:[],wall_time:'2026-10-04T00:00:00Z',data_quality:{mode:'SIM',source:'deterministic-sim'},telemetry:Object.fromEntries(['power','temperature','attitude_error','storage','link_quality','delay_ms','loss_percent','throughput_mbps','ber','auth_percent'].map(k=>[k,20]))});
 assert.equal(f.get('kpi-select'),selected);assert.equal(f.get('kpi-filter-PASS'),filter);assert.equal(filter.checked,false);assert.match(f.get('kpi-requirements').innerHTML,/조건에 맞는 요구사항 없음/);
 await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.streams.length,1);assert.equal(f.get('kpi-filter-PASS').checked,false);
 assert.equal(f.viewers.length,1);assert.equal(f.counts().commands,0);
 await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.streams[0].closed,1);
 }finally{f.dispose();}
});
