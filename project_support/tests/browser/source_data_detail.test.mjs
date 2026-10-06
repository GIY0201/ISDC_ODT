import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceDataPanel} from '../../../user_application/web/scripts/tabs/source_data.js';
import * as model from '../../../user_application/web/scripts/data_management/view_model.js';
function fixture(drawSparkline=null){
 const elements=new Map(),calls=[];const deployment={run_id:'RUN-TEST',scope_id:'scope-1',revision:1,nodes:[{id:'A'}]};
 const report={runtime:{run_id:'RUN-TEST'},deployment,module:{reachable:true,scope_id:'scope-1',scope_contract:'isolated-v1'},overview:{scope_id:'scope-1',scope_contract:'isolated-v1',metrics:{objects:1},policy:{replication:{imagery:3}},jobs:[{id:'JOB-1',kind:'verify',status:'running',started_s:0,eta_s:3}],requests:[{id:'REQ-1',status:'served',served_from:'A',destination:'B',latency_ms:460,object_id:'DM-1'}]},nodes:[{id:'A',name:'Storage A',kind:'onboard',capacity_gb:2000,available:true}],objects:{scope_id:'scope-1',scope_contract:'isolated-v1',total:1,items:[{id:'DM-1',class:'imagery',source:'A',label:'Original product',ref:'A:imagery:1',size_mb:1,version:1,checksum:'0123456789abcdef',tier:'hot',retention_days:365,last_verified_s:15,requests:1,created_s:0,status:'healthy',replicas:[{node:'A',state:'verified',placed_s:0,verified_s:15,lag_s:2.5,ready_s:null}]}]},events:{scope_id:'scope-1',scope_contract:'isolated-v1',items:[]}};
 class Element{constructor(){this.listeners=new Map();this.value='';this.hidden=false;this.html='';}set innerHTML(html){this.html=html;for(const m of html.matchAll(/\bid="([^"]+)"/g))elements.set(m[1],new Element());}get innerHTML(){return this.html;}prepend(child){elements.set(child.id,child);}querySelector(q){return elements.get(q.slice(1));}addEventListener(e,f){this.listeners.set(e,f);}removeEventListener(e){this.listeners.delete(e);}remove(){elements.delete(this.id);}async dispatch(e){return this.listeners.get(e)?.({target:this,preventDefault(){}});}}
 elements.set('screen',new Element());const document={createElement:()=>new Element(),getElementById:id=>elements.get(id)};
 const api={dataDeploymentState:async()=>structuredClone(deployment),dataManagementDashboard:async()=>structuredClone(report),dataManagementAction:async body=>{calls.push(body);return{...body,scope_contract:'isolated-v1',status:'done'};},dataManagementRequest:async body=>{calls.push(body);return{...body,scope_contract:'isolated-v1',status:'served'};}};
 report.overview.sim_elapsed_s=120;report.overview.metrics.ingest_mbps=4;report.overview.metrics.mean_sync_lag_s=2.5;report.overview.metrics.mean_latency_ms=460;
 const panel=createSourceDataPanel({api,model,document,host:{},drawSparkline});panel.show('data');return{panel,calls,api,get:id=>elements.get('dm-'+id)};
}
test('original object checksum/tier are separate from actual replica state and lag; lifecycle job/request reports remain visible',async()=>{
 const f=fixture();await f.get('refresh').dispatch('click');f.get('object').value='DM-1';await f.get('object').dispatch('change');
 assert.match(f.get('detail').innerHTML,/0123456789abcdef/);assert.match(f.get('detail').innerHTML,/2\.5/);assert.match(f.get('detail').innerHTML,/Storage A/);assert.match(f.get('detail').innerHTML,/365/);
 assert.match(f.get('objects').innerHTML,/A/);assert.match(f.get('jobs').innerHTML,/JOB-1/);assert.match(f.get('requests').innerHTML,/REQ-1/);f.panel.destroy();
});
test('replication policy uses selected object class when filter is all, and rejects classless policy before sending',async()=>{
 const f=fixture();await f.get('refresh').dispatch('click');f.get('object').value='DM-1';await f.get('object').dispatch('change');f.get('action').value='set_replication';f.get('replication').value='2';await f.get('action-submit').dispatch('click');
 assert.equal(f.calls[0].class,'imagery');assert.equal(f.calls[0].replication,2);
 f.get('object').value='';await f.get('object').dispatch('change');await f.get('action-submit').dispatch('click');assert.equal(f.calls.length,1);assert.match(f.get('status').textContent,/종류/);f.panel.destroy();
});
test('service uses an available current storage destination and does not publish a foreign scope receipt',async()=>{
 const f=fixture();await f.get('refresh').dispatch('click');f.get('object').value='DM-1';await f.get('object').dispatch('change');f.get('destination').value='undeployed';await f.get('request-submit').dispatch('click');assert.equal(f.calls.length,0);assert.match(f.get('status').textContent,/가용 저장소/);
 await f.get('refresh').dispatch('click');f.get('destination').value='A';f.api.dataManagementRequest=async()=>({scope_id:'foreign',scope_contract:'isolated-v1',status:'served',secret:'must not display'});await f.get('request-submit').dispatch('click');assert.match(f.get('status').textContent,/범위/);assert.equal(f.get('result').textContent,'');f.panel.destroy();
});
test('original local storage-kind and event-severity filters operate without new data writes',async()=>{
 const f=fixture();await f.get('refresh').dispatch('click');f.get('node-kind').value='core';await f.get('node-kind').dispatch('change');assert.doesNotMatch(f.get('nodes').innerHTML,/Storage A/);f.get('node-kind').value='onboard';await f.get('node-kind').dispatch('change');assert.match(f.get('nodes').innerHTML,/Storage A/);f.get('event-severity').value='danger';await f.get('event-severity').dispatch('change');assert.equal(f.calls.length,0);f.panel.destroy();
});
test('original trend renderer receives verified module metrics and repeated SIM time does not duplicate a sample',async()=>{
 const plots=[],f=fixture((canvas,values)=>plots.push({canvas,values}));await f.get('refresh').dispatch('click');await f.get('refresh').dispatch('click');assert.deepEqual(plots.slice(-3).map(p=>p.values),[[4],[2.5],[460]]);assert.match(f.get('trends').textContent,/120/);f.panel.destroy();
});
