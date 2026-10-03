import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRfReceiveProfile,profileMarkup,fieldOrigin} from '../../../user_application/web/scripts/tabs/rf_receive_profile.js';
const profile=JSON.parse(await readFile(new URL('../../../digital_twin/model_library/packages/iss_aprs_receive_v1/profile.json',import.meta.url)));
const payload={...profile,profile_sha256:'a'.repeat(64)};
test('only official frequency applies; identical application invalidates every result',async()=>{
 const changes=[],invalidations=[];const c=createRfReceiveProfile({issReceiveProfile:async()=>payload},()=>{},v=>changes.push(v),()=>invalidations.push(1));
 await c.load();assert.equal(c.snapshot().status,'ready');assert.equal(fieldOrigin('frequency_ghz','.437825',c.snapshot()),'user_assumption');
 c.apply();assert.deepEqual(changes,[{frequency_ghz:'0.437825'}]);assert.equal(fieldOrigin('frequency_ghz','.437825',c.snapshot()),'official_confirmed');
 assert.equal(fieldOrigin('tx_power_w','25',c.snapshot()),'user_assumption');assert.equal(fieldOrigin('rx_gain_dbi','',c.snapshot()),'unknown');
 c.apply();assert.equal(invalidations.length,3);c.manualFrequency();assert.equal(fieldOrigin('frequency_ghz','.437825',c.snapshot()),'user_assumption');
 const copy=c.snapshot();copy.profile.known_inputs.frequency_ghz=26;assert.equal(c.snapshot().profile.known_inputs.frequency_ghz,.437825);
 c.destroy();
});
test('source reload, stale completion and destruction cannot reinstate official authority',async()=>{
 const requests=[];const c=createRfReceiveProfile({issReceiveProfile:({signal})=>new Promise(resolve=>requests.push({resolve,signal}))});
 const first=c.load(),second=c.load();assert.equal(requests[0].signal.aborted,true);requests[1].resolve(payload);await second;c.apply();
 requests[0].resolve({...payload,frequency_mhz:145.825});await first;assert.equal(c.snapshot().applied,true);
 const third=c.load();assert.equal(c.snapshot().applied,false);c.destroy();requests[2].resolve(payload);await third;assert.equal(c.snapshot().profile,null);
});
test('invalid or failed official response leaves equipment and reception unknown',async()=>{
 for(const bad of [{...payload,known_inputs:{frequency_ghz:.437825,tx_power_w:25}},{...payload,communication_status:'pass'},{...payload,frequency_mhz:145.825},{...payload,source:{...payload.source,url:'javascript:alert(1)'}}]){
  const c=createRfReceiveProfile({issReceiveProfile:async()=>bad});await c.load();assert.equal(c.snapshot().status,'error');c.apply();assert.equal(c.snapshot().applied,false);c.destroy();
 }
 const c=createRfReceiveProfile({issReceiveProfile:async()=>{throw Error('offline');}});await c.load();assert.equal(c.snapshot().error,'offline');c.destroy();
});
test('source metadata separates publication, check time, equipment and stored GP time',()=>{
 const html=profileMarkup({profile:payload,status:'ready',applied:true,error:''},'2026-10-04T00:00:00Z');
 for(const value of ['2026-09-25','437.825','9일','실제 통신 미확인','장비 미선정','GP','SSTV'])assert.ok(html.includes(value),value);
 assert.ok(!html.includes('통신 가능'));
});
