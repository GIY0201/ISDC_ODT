import {createRfReceiveProfile,profileMarkup,fieldOrigin} from './rf_receive_profile.js?v=t039-r1';
// RF-Friis-v1 is calculated by the preserved upstream HTTP endpoint.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const RF_FIELDS=[
  {key:'link_id',label:'링크 이름'},
  {key:'frequency_ghz',label:'주파수 GHz',min:.1,max:300,exclusive:true},
  {key:'distance_km',label:'거리 km',min:1,max:100000,exclusive:true},
  {key:'tx_power_w',label:'송신 전력 W',min:.01,max:100000,exclusive:true},
  {key:'tx_gain_dbi',label:'송신 이득 dBi',min:-20,max:100},
  {key:'rx_gain_dbi',label:'수신 이득 dBi',min:-20,max:100},
  {key:'misc_losses_db',label:'기타 손실 dB',min:0,max:100},
  {key:'bandwidth_mhz',label:'대역폭 MHz',min:.001,max:100000,exclusive:true},
  {key:'data_rate_mbps',label:'데이터율 Mbps',min:.001,max:100000,exclusive:true},
  {key:'system_temp_k',label:'시스템 잡음온도 K',min:1,max:5000,exclusive:true},
  {key:'required_ebno_db',label:'요구 Eb/N0 dB',min:-10,max:50},
];
const METRICS=[['eirp_dbw','EIRP dBW'],['fspl_db','자유공간 손실 dB'],['received_power_dbw','수신 전력 dBW'],['noise_power_dbw','잡음 전력 dBW'],['cn_db','C/N dB'],['ebno_db','Eb/N0 dB'],['margin_db','링크 여유 dB'],['capacity_mbps','Shannon 이론 용량 Mbps']];
const fieldId=key=>'rf-'+key.replaceAll('_','-');
export function validateRfDraft(draft){
  const payload={};
  for(const field of RF_FIELDS){
    const text=String(draft[field.key]??'').trim();
    if(!text)throw new Error(`${field.label}을 입력하세요.`);
    if(field.key==='link_id'){
      if([...text].length>40)throw new Error('링크 이름은 40자 이내로 입력하세요.');
      payload[field.key]=text;continue;
    }
    const value=Number(text);
    if(!Number.isFinite(value)||(field.exclusive?value<=field.min:value<field.min)||value>field.max)throw new Error(`${field.label}: ${field.min}${field.exclusive?' 초과':' 이상'}, ${field.max} 이하의 유한한 값을 입력하세요.`);
    payload[field.key]=value;
  }
  return payload;
}
function validateResult(result,payload){
  if(!result||result.model!=='RF-Friis-v1'||!['pass','marginal','fail'].includes(result.status)||result.link_id!==payload.link_id||RF_FIELDS.some(({key})=>result.inputs?.[key]!==payload[key])||METRICS.some(([key])=>!Number.isFinite(result[key]))||!Array.isArray(result.assumptions)||result.assumptions.some(value=>typeof value!=='string'))throw new Error('입력 또는 RF 모델 계약과 일치하지 않는 응답을 폐기했습니다.');
}
export function createRfLinkBudget(api,notify=()=>{}){
  let draft=Object.fromEntries(RF_FIELDS.map(({key})=>[key,''])),result=null,status='idle',error='',generation=0,abort=null,destroyed=false;
  const snapshot=()=>structuredClone({draft,result,status,error});
  function invalidate(){generation++;abort?.abort();abort=null;result=null;status='idle';error='';}
  function setDraft(values){
    if(destroyed)return;
    const next={...draft};for(const {key} of RF_FIELDS)if(typeof values[key]==='string')next[key]=values[key];
    if(RF_FIELDS.every(({key})=>next[key]===draft[key]))return;
    invalidate();draft=next;notify();
  }
  async function calculate(){
    if(destroyed)return;
    invalidate();let payload;
    try{payload=validateRfDraft(draft);}catch(exc){status='error';error=exc.message;notify();return;}
    const ticket=generation;abort=new AbortController();status='pending';notify();
    try{
      const response=await api.linkBudget(payload,{signal:abort.signal});
      if(ticket!==generation||destroyed)return;
      validateResult(response,payload);result=structuredClone(response);status='ready';
    }catch(exc){
      if(ticket!==generation||destroyed)return;
      result=null;status=exc.name==='AbortError'?'idle':'error';error=status==='error'?exc.message:'';
    }
    if(ticket===generation&&!destroyed){abort=null;notify();}
  }
  return {snapshot,setDraft,calculate,cancel(){if(destroyed)return;invalidate();notify();},destroy(){invalidate();destroyed=true;}};
}
export function rfResultMarkup(result){
  if(!result)return '';
  const label={pass:'기존 모델 여유 충족',marginal:'여유 경계',fail:'기존 모델 여유 부족'}[result.status];
  return `<p><strong>${escape(label)}</strong> · 실제 통신 미확인</p><p>${escape(result.model)} · 기존 분류: 여유 ≥3 dB / ≥0 dB / &lt;0 dB. 서버의 반올림 전 분류를 표시합니다.</p><dl class="rf-metrics">${METRICS.map(([key,name])=>`<dt>${escape(name)}</dt><dd>${escape(result[key])}</dd>`).join('')}</dl><p>Shannon 이론 용량은 실제 전송 속도를 보장하지 않습니다.</p><details><summary>계산에 사용한 입력 · 공식 주파수 또는 사용자 설정 가정</summary><dl>${RF_FIELDS.map(({key,label})=>`<dt>${escape(label)}</dt><dd>${escape(result.inputs[key])}</dd>`).join('')}</dl></details><ul>${result.assumptions.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>`;
}
export function createRfPanel(api){
  let active=false,panel=null;
  const controller=createRfLinkBudget(api,render);
  const profile=createRfReceiveProfile(api,render,values=>{controller.setDraft(values);writeFields();},()=>controller.cancel());
  function writeFields(){const {draft}=controller.snapshot();for(const {key} of RF_FIELDS){const field=panel?.querySelector('#'+fieldId(key));if(field)field.value=draft[key];}}
  function render(){
    if(!active)return;
    if(!panel?.isConnected){
      panel=document.createElement('section');panel.id='rf-link-budget';panel.className='panel';document.getElementById('screen').prepend(panel);
      panel.innerHTML=`<header><h2>RF 링크 계산</h2><small>선배 프로토타입 RF-Friis-v1 / 실제 통신 미확인</small></header><div class="body"><p>사용자 설정 가정으로 계산합니다. 거리는 직접 입력하며 위성 위치·가시 구간과 자동 연결하지 않습니다.</p><div class="rf-profile"><div class="rf-actions"><button type="button" id="rf-profile-load">ISS 공식 조건 불러오기</button><button type="button" id="rf-profile-apply">공식 주파수 적용</button></div><div id="rf-profile-status" role="status" aria-live="polite"></div></div><div class="rf-fields">${RF_FIELDS.map(field=>`<label>${escape(field.label)}<input id="${fieldId(field.key)}" ${field.key==='link_id'?'type="text"':'type="number" step="any"'} aria-describedby="rf-input-help"><small id="${fieldId('origin_'+field.key)}"></small></label>`).join('')}</div><p id="rf-input-help">공식 주파수는 선택적으로 적용할 수 있습니다. 나머지는 직접 입력한 가정이며 장비 조건과 실제 수신은 미확인입니다.</p><div class="rf-actions"><button type="button" id="rf-calculate">모델 계산</button><button type="button" id="rf-cancel">조회 취소</button></div><p id="rf-status" role="status" aria-live="polite"></p><div id="rf-result"></div></div>`;
      writeFields();
      for(const {key} of RF_FIELDS)panel.querySelector('#'+fieldId(key)).addEventListener('input',event=>{controller.setDraft({[key]:event.target.value});if(key==='frequency_ghz')profile.manualFrequency();});
      panel.querySelector('#rf-calculate').addEventListener('click',()=>controller.calculate());
      panel.querySelector('#rf-cancel').addEventListener('click',()=>controller.cancel());
      panel.querySelector('#rf-profile-load').addEventListener('click',()=>profile.load());
      panel.querySelector('#rf-profile-apply').addEventListener('click',()=>profile.apply());
    }
    const {status,error,result,draft}=controller.snapshot(),source=profile.snapshot();
    const holder=panel.querySelector('#rf-profile-status'),metadata=profileMarkup(source);if(holder.innerHTML!==metadata)holder.innerHTML=metadata;
    panel.querySelector('#rf-profile-apply').disabled=source.status!=='ready';
    for(const {key} of RF_FIELDS)panel.querySelector('#'+fieldId('origin_'+key)).textContent={unknown:'미확인',user_assumption:'사용자 가정',official_confirmed:'공식 공지 확인값'}[fieldOrigin(key,draft[key],source)];
    panel.querySelector('#rf-status').textContent={idle:'입력 후 계산하세요. 입력이 변경되면 재계산이 필요합니다.',pending:'기존 RF API 계산 중…',ready:'모델 계산 완료 · 실제 통신 미확인',error:'계산 실패: '+error}[status];
    panel.querySelector('#rf-cancel').disabled=status!=='pending';
    const output=panel.querySelector('#rf-result'),html=rfResultMarkup(result);
    if(output.innerHTML!==html)output.innerHTML=html;
  }
  return {show(view){active=view==='ground';render();},update:render,applyDraft(items,remote=false){const values={};for(const {key} of RF_FIELDS){const item=items.find(item=>item.id===fieldId(key)&&typeof item.value==='string');if(item)values[key]=item.value;}if('frequency_ghz' in values&&(remote||values.frequency_ghz!==controller.snapshot().draft.frequency_ghz))profile.manualFrequency();controller.setDraft(values);writeFields();},destroy:()=>{profile.destroy();controller.destroy();}};
}
