import test from 'node:test';
import assert from 'node:assert/strict';
import {RF_FIELDS,validateRfDraft,createRfLinkBudget,rfResultMarkup} from '../../../user_application/web/scripts/tabs/rf_link_budget.js';
import {api} from '../../../communication/browser/api.js';

// Synthetic legacy-model fixture; no real spacecraft or equipment claim.
const input={link_id:'SYNTHETIC',frequency_ghz:26,distance_km:1200,tx_power_w:20,tx_gain_dbi:32,rx_gain_dbi:34,misc_losses_db:3,bandwidth_mhz:20,data_rate_mbps:10,system_temp_k:290,required_ebno_db:7};
const draft=Object.fromEntries(Object.entries(input).map(([key,value])=>[key,String(value)]));
const result=p=>({link_id:p.link_id,model:'RF-Friis-v1',inputs:{...p},eirp_dbw:45.01,fspl_db:182.333,received_power_dbw:-106.323,noise_power_dbw:-130.965,cn_db:24.642,ebno_db:27.652,margin_db:20.652,capacity_mbps:163.82,status:'pass',assumptions:['자유공간 손실']});
test('RF starts with no hidden physical defaults and sends all editable values',async()=>{
 let body,options;const c=createRfLinkBudget({linkBudget:async(p,o)=>{body=p;options=o;return result(p);}},()=>{});
 assert.equal(RF_FIELDS.length,11);assert.ok(Object.values(c.snapshot().draft).every(value=>value===''));
 c.setDraft(draft);await c.calculate();assert.deepEqual(body,input);assert.ok(options.signal instanceof AbortSignal);
 const copy=c.snapshot();copy.result.inputs.distance_km=99;assert.equal(c.snapshot().result.inputs.distance_km,1200);
});
test('RF blank/nonfinite and exact API exclusive/inclusive bounds are enforced',()=>{
 for(const field of RF_FIELDS){assert.throws(()=>validateRfDraft({...draft,[field.key]:''}),/입력/);}
 for(const field of RF_FIELDS.filter(f=>f.key!=='link_id')){
  for(const value of ['NaN','Infinity','-Infinity'])assert.throws(()=>validateRfDraft({...draft,[field.key]:value}));
  const lower=String(field.min);if(field.exclusive)assert.throws(()=>validateRfDraft({...draft,[field.key]:lower}));else assert.equal(validateRfDraft({...draft,[field.key]:lower})[field.key],field.min);
  assert.equal(validateRfDraft({...draft,[field.key]:String(field.max)})[field.key],field.max);
  assert.throws(()=>validateRfDraft({...draft,[field.key]:String(field.max+1)}));
 }
 assert.throws(()=>validateRfDraft({...draft,link_id:'x'.repeat(41)}));assert.throws(()=>validateRfDraft({...draft,link_id:'  '}));
 assert.equal(validateRfDraft({...draft,link_id:'😀'.repeat(40)}).link_id,'😀'.repeat(40));
 assert.throws(()=>validateRfDraft({...draft,link_id:'😀'.repeat(41)}));
});
test('invalid input never invokes HTTP and remains an explicit error',async()=>{
 let calls=0;const c=createRfLinkBudget({linkBudget:()=>{calls++;}},()=>{});await c.calculate();assert.equal(calls,0);assert.equal(c.snapshot().status,'error');assert.equal(c.snapshot().result,null);
});
test('editing and cancellation discard pending responses even when abort is ignored',async()=>{
 const releases=[];const c=createRfLinkBudget({linkBudget:p=>new Promise(resolve=>releases.push(()=>resolve(result(p))))},()=>{});
 c.setDraft(draft);const old=c.calculate();c.setDraft({...draft,distance_km:'2000'});const current=c.calculate();releases[1]();await current;releases[0]();await old;
 assert.equal(c.snapshot().result.inputs.distance_km,2000);c.setDraft({...draft,distance_km:'2000'});assert.equal(c.snapshot().status,'ready');
 c.setDraft({...draft,distance_km:'3000'});assert.equal(c.snapshot().result,null);const pending=c.calculate();c.cancel();releases[2]();await pending;assert.equal(c.snapshot().result,null);
});
test('destroy blocks late response and subsequent queries',async()=>{
 let release,calls=0;const c=createRfLinkBudget({linkBudget:p=>{calls++;return new Promise(r=>release=()=>r(result(p)));}},()=>{});c.setDraft(draft);const pending=c.calculate();c.destroy();release();await pending;await c.calculate();assert.equal(calls,1);assert.equal(c.snapshot().result,null);
});
test('RF rejects mismatched echoes, invalid metrics and unknown model/status',async()=>{
 const changes=[r=>({...r,link_id:'wrong'}),r=>({...r,inputs:{...r.inputs,bandwidth_mhz:1}}),r=>({...r,model:'unknown'}),r=>({...r,status:'success'}),r=>({...r,margin_db:NaN}),r=>({...r,capacity_mbps:Infinity}),r=>({...r,assumptions:[{}]})];
 for(const change of changes){const c=createRfLinkBudget({linkBudget:async p=>change(result(p))},()=>{});c.setDraft(draft);await c.calculate();assert.equal(c.snapshot().status,'error');assert.equal(c.snapshot().result,null);}
});
test('RF output trusts pre-rounding status and labels theory/assumptions/unknown communication',()=>{
 const html=rfResultMarkup({...result(input),margin_db:3,status:'marginal',inputs:{...input,link_id:'<script>'}});
 assert.match(html,/여유 경계/);assert.match(html,/실제 통신 미확인/);assert.match(html,/Shannon 이론 용량/);assert.match(html,/사용자 설정 가정/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>'));assert.match(html,/dBW/);assert.match(html,/Mbps/);
});
test('network failure clears successful RF result rather than displaying old success',async()=>{
 let fail=false;const c=createRfLinkBudget({linkBudget:async p=>{if(fail)throw new Error('network down');return result(p);}},()=>{});c.setDraft(draft);await c.calculate();fail=true;await c.calculate();assert.equal(c.snapshot().result,null);assert.match(c.snapshot().error,/network/);
});
test('RF transport sends signal and provides field-readable 422 without changing payload',async()=>{
 const original=globalThis.fetch;let options;
 try{globalThis.fetch=async(_,o)=>{options=o;return {ok:false,status:422,json:async()=>({detail:[{loc:['body','tx_power_w'],msg:'must be positive'}]})};};const abort=new AbortController();await assert.rejects(api.linkBudget(input,{signal:abort.signal}),/tx_power_w.*must be positive/);assert.equal(options.signal,abort.signal);assert.deepEqual(JSON.parse(options.body),input);}
 finally{globalThis.fetch=original;}
});
