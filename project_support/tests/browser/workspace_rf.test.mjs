import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {RF_FIELDS} from '../../../user_application/web/scripts/tabs/rf_link_budget.js';
const draft={link_id:'SYNTHETIC',frequency_ghz:'26',distance_km:'1200',tx_power_w:'20',tx_gain_dbi:'32',rx_gain_dbi:'34',misc_losses_db:'3',bandwidth_mhz:'20',data_rate_mbps:'10',system_temp_k:'290',required_ebno_db:'7'};
const id=key=>'rf-'+key.replaceAll('_','-');
const response=p=>({link_id:p.link_id,model:'RF-Friis-v1',inputs:{...p},eirp_dbw:45.01,fspl_db:182.333,received_power_dbw:-106.323,noise_power_dbw:-130.965,cn_db:24.642,ebno_db:27.652,margin_db:20.652,capacity_mbps:163.82,status:'pass',assumptions:['자유공간 손실']});
async function fill(f){for(const [key,value] of Object.entries(draft)){const field=f.doc.getElementById(id(key));assert.ok(field,`missing ${id(key)}`);field.value=value;await field.dispatch('input');}}
for(const [width,height] of [[1280,720],[1920,1080]])test(`RF window preserves inputs and results at ${width}x${height} without runtime commands`,async()=>{
 let calls=0;const f=fixture(width,height,{rfRequest:async p=>{calls++;return response(p);}});
 try{
  for(const {key} of RF_FIELDS)assert.equal(f.doc.getElementById(id(key))?.value,'');
  await f.get('rf-calculate').dispatch('click');assert.equal(calls,0);assert.match(f.get('rf-status').textContent,/실패/);
  await fill(f);await f.get('rf-calculate').dispatch('click');assert.equal(calls,1);assert.match(f.get('rf-result').innerHTML,/실제 통신 미확인/);
  const html=f.get('rf-result').innerHTML,before=f.counts(),state=f.snapshot().state;
  await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.get('rf-result').innerHTML,html);
  for(const view of ['satellite','ground'])await f.doc.dispatch('click',{target:{dataset:{view},closest(){return this;}}});assert.equal(f.get('rf-result').innerHTML,html);
  for(const [key,value] of Object.entries(draft))assert.equal(f.get(id(key)).value,value);
  assert.deepEqual(f.snapshot().state,state);assert.deepEqual(f.counts(),before);assert.equal(f.viewers.length,1);
 }finally{f.dispose();}
});
test('remote RF draft invalidates a completed result and survives reconstruction',async()=>{
 const f=fixture(1280,720,{rfRequest:async p=>response(p)});try{
  await fill(f);await f.get('rf-calculate').dispatch('click');
  const channel=f.channels.find(c=>c.name==='isdc-odt-v6-mock');
  await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'ground',id:'rf-distance-km',value:'1500'}});
  assert.equal(f.get('rf-distance-km').value,'1500');assert.equal(f.get('rf-result').innerHTML,'');assert.match(f.get('rf-status').textContent,/재계산/);
  f.context.render();assert.equal(f.get('rf-distance-km').value,'1500');
 }finally{f.dispose();}
});
test('RF popout transfers all eleven drafts and child does not fabricate a result',async()=>{
 const messages=[],child={location:{origin:'http://localhost'},document:{readyState:'complete'},focus(){},postMessage:value=>messages.push(value)};
 const f=fixture(1280,720,{open:()=>child});let rows;try{await fill(f);await f.get('window-popout').dispatch('click');rows=messages[0].draft;for(const [key,value] of Object.entries(draft))assert.ok(rows.some(row=>row.id===id(key)&&row.value===value));}finally{f.dispose();}
 const opener={postMessage(){}};const g=fixture(1280,720,{popout:true,opener});try{await g.win.dispatch('message',{origin:'http://localhost',source:opener,data:{type:'isdc-v6-snapshot',view:'ground',state:{view:'ground'},draft:rows}});for(const [key,value] of Object.entries(draft))assert.equal(g.get(id(key)).value,value);assert.equal(g.get('rf-result').innerHTML,'');}finally{g.dispose();}
});
