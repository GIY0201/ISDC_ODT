import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {hilTopology} from '../../../digital_twin/visualization/hil_topology.js';
const device={id:'A',name:'Mock',role:'clock',protocol:'UDP',mode:'MOCK',connected:true,health:88,latency_ms:14.2,channels:2,clock_offset_us:12,jitter_us:2,clock_state:'LOCKED'};
const runtime={mode:'SIM',running:false,speed:1,elapsed_seconds:0,sequence:1,run_id:'R',scenario_id:'S',active_faults:[],recording:true};
const flight={run_id:'R',mode:'MOCK-HIL',passed:true,status:'READY',evaluated_at:'2026-10-05T00:00:00Z',checks:[{id:'recording',name:'Flag',passed:true,value:'REC'}]};
for(const [w,h]of[[1280,720],[1920,1080]])test(`MOCK-HIL real V6 assembly/one stream/controls/restore ${w}x${h}`,async()=>{
 const f=fixture(w,h,{hash:'#em',planningBootstrap:async()=>({runtime,devices:[device],events:[],missions:[]}),hilPreflight:async()=>flight});
 try{for(let i=0;i<6;i++)await Promise.resolve();f.flush();assert.ok(f.doc.getElementById('hil-workspace'));assert.equal(f.streams.length,1);assert.match(f.get('hil-checks').innerHTML,/READY/);assert.match(f.get('hil-topology').innerHTML,/MOCK-HIL/);
 const select=f.get('hil-sequence');select.value='fault_recovery';await select.dispatch('change');f.streams[0].message({type:'telemetry',runtime,devices:[device],missions:[],events:[],wall_time:'2026-10-05T00:00:00Z',data_quality:{mode:'SIM',source:'deterministic-sim'},telemetry:Object.fromEntries(['power','temperature','attitude_error','storage','link_quality','delay_ms','loss_percent','throughput_mbps','ber','auth_percent'].map(k=>[k,20]))});
 assert.equal(f.get('hil-sequence'),select);assert.equal(select.value,'fault_recovery');assert.equal(f.charts.length>0,true);assert.equal(f.viewers.length,1);assert.equal(f.counts().commands,0);
 await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.get('hil-sequence').value,'fault_recovery');assert.equal(f.streams.length,1);
 await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.streams[0].closed,1);
 }finally{f.dispose();}
});
test('topology escapes untrusted device text and uses supplied connection state',()=>{const html=hilTopology([{...device,name:'<script>x</script>',connected:false}],device.id);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/#e75555/);assert.match(html,/data-hil-device="A"/);assert.match(html,/role="button" tabindex="0"/);});
