import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
const graph={nodes:[{id:'A',type:'satellite'},{id:'B',type:'ground'}],links:[{id:'L',source:'A',target:'B',quality:90}]};
const route=(s,t,o)=>({source:s,target:t,objective:o,path:[s,t],link_ids:['L'],hops:1,cost:20,status:'available',active_fault_targets:[]});
const contacts=h=>({hours:h,count:1,provenance:'scenario-contact-plan-v1',items:[{id:'C',link_id:'L',source:'A',target:'B',start:'2026-10-04T00:00:00Z',end:'2026-10-04T00:05:00Z',duration_minutes:5,quality:90,capacity_mb:10,provenance:'scenario-contact-plan-v1'}]});
const options={planningBootstrap:async()=>({communication:graph}),planningRoute:async(s,t,o)=>route(s,t,o),planningContacts:async h=>contacts(h)};
async function fill(f){await f.get('cp-network-load').dispatch('click');for(const [key,value] of [['source','A'],['target','B']]){f.get('cp-'+key).value=value;await f.get('cp-'+key).dispatch('change');}}
for(const [width,height] of [[1280,720],[1920,1080]])test(`planning assembly preserves results and other state at ${width}x${height}`,async()=>{
 const f=fixture(width,height,options);try{
  assert.ok(f.doc.getElementById('cp-network-load'));const before=f.counts(),state=f.snapshot().state;
  await fill(f);await f.get('cp-route-query').dispatch('click');await f.get('cp-contacts-query').dispatch('click');assert.match(f.get('cp-route-result').innerHTML,/시나리오 경로 있음/);assert.match(f.get('cp-contacts-result').innerHTML,/scenario-contact-plan-v1/);
  const html=f.get('cp-route-result').innerHTML;await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.get('cp-route-result').innerHTML,html);
  for(const view of ['satellite','ground'])await f.doc.dispatch('click',{target:{dataset:{view},closest(){return this;}}});assert.equal(f.get('cp-source').value,'A');assert.equal(f.get('cp-route-result').innerHTML,html);
  assert.deepEqual(f.snapshot().state,state);assert.deepEqual(f.counts(),before);assert.equal(f.viewers.length,1);assert.equal(f.get('rf-frequency-ghz').value,'');
  f.get('cp-hours').value='0';await f.get('cp-hours').dispatch('input');await f.get('cp-contacts-query').dispatch('click');assert.match(f.get('cp-contacts-status').textContent,/조회 실패/);assert.equal(f.get('cp-contacts-result').innerHTML,'');assert.equal(f.get('cp-route-result').innerHTML,html);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
test('same-value remote planning draft clears relevant result, preserving contacts',async()=>{
 const f=fixture(1280,720,options);try{await fill(f);await f.get('cp-route-query').dispatch('click');await f.get('cp-contacts-query').dispatch('click');const channel=f.channels.find(c=>c.name==='isdc-odt-v6-mock');await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'ground',id:'cp-source',value:'A'}});assert.equal(f.get('cp-route-result').innerHTML,'');assert.match(f.get('cp-contacts-result').innerHTML,/scenario-contact-plan-v1/);f.context.render();assert.equal(f.get('cp-source').value,'A');}finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
