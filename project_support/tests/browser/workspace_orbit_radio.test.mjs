import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
const response=p=>({client_request_id:p.client_request_id,revision:p.selection_revision,input_id:p.input_id,input_hash:'hash',utc:p.utc,frequency_hz:p.frequency_hz,ground_point:{latitude_deg:33.4996,longitude_deg:126.5312,ellipsoid_height_m:0,virtual:true,ellipsoid:'WGS84'},minimum_elevation_deg:10,position_m:[6778137,0,0],velocity_m_s:[-1000,7500,0],elevation_deg:30,range_m:400000,range_rate_m_s:-1000,doppler_hz:p.frequency_hz*1000/299792458,received_frequency_hz:p.frequency_hz*(1+1000/299792458),error_code:null,eop_sha256:'eop',leap_sha256:'6cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7',frame:'ITRF',profile:'WGS72_AFSPC',stale:false,status:'valid',communication_status:'unknown',model:'one_way_first_order_v1',units:{position:'m',velocity:'m/s',range:'m',range_rate:'m/s',frequency:'Hz',doppler:'Hz',elevation:'deg',time:'UTC'},assumptions:['same epoch model']});
async function fill(f){await f.get('radio-use-utc').dispatch('click');f.get('radio-frequency_mhz').value='437.825';await f.get('radio-frequency_mhz').dispatch('input');await f.get('radio-calculate').dispatch('click');}
for(const [width,height] of [[1280,720],[1920,1080]])test(`satellite radio assembly restores result and leaves orbit/RF unchanged ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#satellite',radioRequest:async p=>response(p)});try{assert.ok(f.doc.getElementById('radio-calculate'));const before=f.counts(),state=f.snapshot().state;
 await fill(f);const result=f.get('radio-result').innerHTML;assert.match(result,/실제 수신 미확인/);await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.get('radio-result').innerHTML,result);
 for(const view of ['ground','satellite'])await f.doc.dispatch('click',{target:{dataset:{view},closest(){return this;}}});assert.equal(f.get('radio-result').innerHTML,result);assert.equal(f.get('radio-frequency_mhz').value,'437.825');assert.equal(f.get('rf-frequency-ghz').value,'');assert.deepEqual(f.snapshot().state,state);assert.deepEqual(f.counts(),before);assert.equal(f.viewers.length,1);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
test('same-value remote radio edit invalidates result without runtime commands',async()=>{
 const f=fixture(1280,720,{hash:'#satellite',radioRequest:async p=>response(p)});try{await fill(f);const channel=f.channels.find(c=>c.name==='isdc-odt-v6-mock');await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'satellite',id:'radio-frequency_mhz',value:'437.825'}});assert.equal(f.get('radio-result').innerHTML,'');f.context.render();assert.equal(f.get('radio-frequency_mhz').value,'437.825');assert.match(f.get('radio-origin').textContent,/사용자 가정/);assert.equal(f.counts().commands,0);}finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
import {readFile} from 'node:fs/promises';
const officialProfile={...JSON.parse(await readFile(new URL('../../../digital_twin/model_library/packages/iss_aprs_receive_v1/profile.json',import.meta.url))),profile_sha256:'a'.repeat(64)};
test('official MHz applies exactly and preserves provenance through restoration',async()=>{
 const f=fixture(1280,720,{hash:'#satellite',radioRequest:async p=>response(p),rfProfileRequest:async()=>officialProfile});try{
 await f.get('radio-use-utc').dispatch('click');await f.get('radio-profile-load').dispatch('click');await f.get('radio-profile-apply').dispatch('click');assert.equal(f.get('radio-frequency_mhz').value,'437.825');assert.match(f.get('radio-origin').textContent,/공식 공지 주파수/);
 await f.get('radio-calculate').dispatch('click');const result=f.get('radio-result').innerHTML;assert.ok(result);await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.get('radio-result').innerHTML,result);assert.match(f.get('radio-origin').textContent,/공식 공지 주파수/);
 const channel=f.channels.find(c=>c.name==='isdc-odt-v6-mock');await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'satellite',id:'radio-frequency_mhz',value:'437.825'}});assert.equal(f.get('radio-result').innerHTML,'');assert.match(f.get('radio-origin').textContent,/사용자 가정/);assert.equal(f.counts().commands,0);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
