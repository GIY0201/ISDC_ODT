import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture} from './workspace_fixture.mjs';
const profile={...JSON.parse(await readFile(new URL('../../../digital_twin/model_library/packages/iss_aprs_receive_v1/profile.json',import.meta.url))),profile_sha256:'a'.repeat(64)};
const draft={link_id:'TEST',frequency_ghz:'.437825',distance_km:'500',tx_power_w:'5',tx_gain_dbi:'0',rx_gain_dbi:'5',misc_losses_db:'2',bandwidth_mhz:'0.02',data_rate_mbps:'0.002',system_temp_k:'300',required_ebno_db:'8'};
const response=p=>({link_id:p.link_id,model:'RF-Friis-v1',inputs:{...p},eirp_dbw:1,fspl_db:1,received_power_dbw:1,noise_power_dbw:1,cn_db:1,ebno_db:1,margin_db:1,capacity_mbps:1,status:'marginal',assumptions:[]});
for(const [w,h] of [[1280,720],[1920,1080]])test(`official profile UI preserves equipment assumptions and GP at ${w}x${h}`,async()=>{
 let reads=0;const f=fixture(w,h,{rfProfileRequest:async()=>{reads++;return profile;},rfRequest:async p=>response(p)});
 try{
  const before=f.snapshot().state,counts=f.counts();assert.equal(reads,0);
  for(const [key,value] of Object.entries(draft)){const field=f.get('rf-'+key.replaceAll('_','-'));field.value=value;await field.dispatch('input');}
  await f.get('rf-calculate').dispatch('click');assert.ok(f.get('rf-result').innerHTML);
  await f.get('rf-profile-load').dispatch('click');assert.equal(reads,1);assert.equal(f.get('rf-result').innerHTML,'');
  await f.get('rf-profile-apply').dispatch('click');assert.equal(f.get('rf-frequency-ghz').value,'0.437825');assert.equal(f.get('rf-tx-power-w').value,'5');assert.equal(f.get('rf-origin-frequency-ghz').textContent,'공식 공지 확인값');
  assert.equal(f.get('rf-origin-tx-power-w').textContent,'사용자 가정');
  await f.get('rf-calculate').dispatch('click');await f.get('rf-profile-apply').dispatch('click');assert.equal(f.get('rf-result').innerHTML,'');
  await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');
  for(const view of ['satellite','ground'])await f.doc.dispatch('click',{target:{dataset:{view},closest(){return this;}}});assert.match(f.get('rf-profile-status').innerHTML,/2026-09-25/);assert.equal(f.get('rf-origin-frequency-ghz').textContent,'공식 공지 확인값');
  await f.get('rf-frequency-ghz').dispatch('input');assert.equal(f.get('rf-origin-frequency-ghz').textContent,'사용자 가정');
  assert.deepEqual(f.snapshot().state,before);assert.deepEqual(f.counts(),counts);assert.equal(f.viewers.length,1);
 }finally{f.dispose();}
});
test('profile lookup failure has no fallback frequency',async()=>{
 const f=fixture(1280,720,{rfProfileRequest:async()=>{throw Error('unavailable');}});try{await f.get('rf-profile-load').dispatch('click');assert.match(f.get('rf-profile-status').innerHTML,/조회 실패/);assert.equal(f.get('rf-frequency-ghz').value,'');assert.equal(f.get('rf-profile-apply').disabled,true);}finally{f.dispose();}
});
test('same numeric frequency from another window loses official authority and result',async()=>{
 const f=fixture(1280,720,{rfProfileRequest:async()=>profile,rfRequest:async p=>response(p)});try{
  for(const [key,value] of Object.entries(draft)){const field=f.get('rf-'+key.replaceAll('_','-'));field.value=value;await field.dispatch('input');}
  await f.get('rf-profile-load').dispatch('click');await f.get('rf-profile-apply').dispatch('click');await f.get('rf-calculate').dispatch('click');
  const channel=f.channels.find(c=>c.name==='isdc-odt-v6-mock');await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'ground',id:'rf-frequency-ghz',value:'0.437825'}});
  assert.equal(f.get('rf-origin-frequency-ghz').textContent,'사용자 가정');assert.equal(f.get('rf-result').innerHTML,'');
 }finally{f.dispose();}
});
