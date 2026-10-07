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
// Pinned communication.js linkDetail/calculateBudget assumptions; not equipment measurements.
export function sourceLinkRfDraft(link){
  const gains={S:3,X:15,Ka:20},temperatures={S:150,X:200,Ka:300};
  if(!link||link.kind!=='ground'||!Object.hasOwn(gains,link.band)||typeof link.id!=='string'||!link.id.trim()||typeof link.a!=='string'||!link.a||typeof link.b!=='string'||!link.b||link.a===link.b||['frequency_ghz','range_km','eirp_dbw','gt_dbk','data_rate_mbps'].some(key=>!Number.isFinite(link[key]))||link.frequency_ghz<=0||link.range_km<=0||link.data_rate_mbps<=0)throw Error('선택한 지상 링크의 RF 입력이 완전하지 않습니다.');
  const gain=gains[link.band],temperature=temperatures[link.band];
  const draft={link_id:link.id.slice(0,40),frequency_ghz:String(link.frequency_ghz),distance_km:String(Math.round(link.range_km)),tx_power_w:String(Math.max(.01,Math.round(10**((link.eirp_dbw-gain)/10)))),tx_gain_dbi:String(gain),rx_gain_dbi:String(Math.round(link.gt_dbk+10*Math.log10(temperature))),misc_losses_db:'6',bandwidth_mhz:String(Math.max(.01,link.data_rate_mbps*1.2)),data_rate_mbps:String(Math.max(.001,link.data_rate_mbps)),system_temp_k:String(temperature),required_ebno_db:'9.6'};
  if(Object.entries(draft).some(([key,value])=>key!=='link_id'&&!Number.isFinite(Number(value))))throw Error('선택한 지상 링크의 RF 변환값이 유한하지 않습니다.');
  return draft;
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
  let active=false,panel=null,dead=false,sourceLink=null,sourceGeneration=0;
  const controller=createRfLinkBudget(api,render);
  const profile=createRfReceiveProfile(api,render,values=>{sourceGeneration++;sourceLink=null;controller.setDraft(values);writeFields();},()=>controller.cancel());
  function writeFields(){const {draft}=controller.snapshot();for(const {key} of RF_FIELDS){const field=panel?.querySelector('#'+fieldId(key));if(field)field.value=draft[key];}}
  function render(){
    if(!active)return;
    if(!panel?.isConnected){
      panel=document.createElement('section');panel.id='rf-link-budget';panel.className='panel';document.getElementById('screen').prepend(panel);
      panel.innerHTML=`<header><h2>RF 링크 계산</h2><small>선배 프로토타입 RF-Friis-v1 / 실제 통신 미확인</small></header><div class="body"><p>사용자 설정 가정으로 계산합니다. 거리는 직접 입력하며 위성 위치·가시 구간과 자동 연결하지 않습니다.</p><div class="rf-profile"><div class="rf-actions"><button type="button" id="rf-profile-load">ISS 공식 조건 불러오기</button><button type="button" id="rf-profile-apply">공식 주파수 적용</button></div><div id="rf-profile-status" role="status" aria-live="polite"></div></div><p id="rf-source-link-status" role="status"></p><div class="rf-fields">${RF_FIELDS.map(field=>`<label>${escape(field.label)}<input id="${fieldId(field.key)}" ${field.key==='link_id'?'type="text"':'type="number" step="any"'} aria-describedby="rf-input-help"><small id="${fieldId('origin_'+field.key)}"></small></label>`).join('')}</div><p id="rf-input-help">공식 주파수는 선택적으로 적용할 수 있습니다. 나머지는 직접 입력한 가정이며 장비 조건과 실제 수신은 미확인입니다.</p><div class="rf-actions"><button type="button" id="rf-calculate">모델 계산</button><button type="button" id="rf-cancel">조회 취소</button></div><p id="rf-status" role="status" aria-live="polite"></p><div id="rf-result"></div></div>`;
      writeFields();
      for(const {key} of RF_FIELDS)panel.querySelector('#'+fieldId(key)).addEventListener('input',event=>{sourceGeneration++;sourceLink=null;controller.setDraft({[key]:event.target.value});if(key==='frequency_ghz')profile.manualFrequency();});
      panel.querySelector('#rf-calculate').addEventListener('click',()=>controller.calculate());
      panel.querySelector('#rf-cancel').addEventListener('click',()=>controller.cancel());
      panel.querySelector('#rf-profile-load').addEventListener('click',()=>profile.load());
      panel.querySelector('#rf-profile-apply').addEventListener('click',()=>profile.apply());
    }
    const {status,error,result,draft}=controller.snapshot(),source=profile.snapshot();
    panel.querySelector('#rf-source-link-status').textContent=sourceLink?`선배 원본 대표 공학 가정 · 입력 분석 UTC ${sourceLink.analysis_utc} · 표시 UTC ${sourceLink.display_utc} · 링크 ${sourceLink.id} · 모든 입력 편집 가능 · 장비와 실제 통신 미확인`:'';
    const holder=panel.querySelector('#rf-profile-status'),metadata=profileMarkup(source);if(holder.innerHTML!==metadata)holder.innerHTML=metadata;
    panel.querySelector('#rf-profile-apply').disabled=source.status!=='ready';
    for(const {key} of RF_FIELDS)panel.querySelector('#'+fieldId('origin_'+key)).textContent={unknown:'미확인',user_assumption:'사용자 가정',official_confirmed:'공식 공지 확인값'}[fieldOrigin(key,draft[key],source)];
    panel.querySelector('#rf-status').textContent={idle:'입력 후 계산하세요. 입력이 변경되면 재계산이 필요합니다.',pending:'기존 RF API 계산 중…',ready:'모델 계산 완료 · 실제 통신 미확인',error:'계산 실패: '+error}[status];
    panel.querySelector('#rf-cancel').disabled=status!=='pending';
    const output=panel.querySelector('#rf-result'),html=rfResultMarkup(result);
    if(output.innerHTML!==html)output.innerHTML=html;
  }
  function applySourceLinkDraft(link,context={}){
    if(dead||!active)return false;
    const ticket=++sourceGeneration;let values,metadata;
    try{
      values=sourceLinkRfDraft(link);
      const analysis=context.analysis_utc??context.utc,display=context.display_utc??analysis;
      if(typeof analysis!=='string'||!analysis.endsWith('Z')||!Number.isFinite(Date.parse(analysis))||typeof display!=='string'||!display.endsWith('Z')||!Number.isFinite(Date.parse(display))||(context.isCurrent!==undefined&&typeof context.isCurrent!=='function'))return false;
      metadata={analysis_utc:analysis,display_utc:display,id:values.link_id};
      if(context.isCurrent&&context.isCurrent()!==true)return false;
    }catch{return false;}
    const current=()=>!dead&&active&&ticket===sourceGeneration;
    if(!current())return false;
    // An explicit copy invalidates old results even if all eleven values are identical.
    controller.cancel();if(!current())return false;
    profile.manualFrequency();if(!current())return false;
    try{if(context.isCurrent&&context.isCurrent()!==true)return false;}catch{return false;}
    if(!current())return false;
    sourceLink=metadata;controller.setDraft(values);if(!current())return false;
    writeFields();render();if(!current())return false;
    panel?.scrollIntoView?.({block:'start',behavior:'smooth'});
    return current();
  }
  return {show(view){if(dead)return;active=view==='ground';sourceGeneration++;render();},update:render,applySourceLinkDraft,applyDraft(items,remote=false){if(dead)return;sourceGeneration++;sourceLink=null;const values={};for(const {key} of RF_FIELDS){const item=items.find(item=>item.id===fieldId(key)&&typeof item.value==='string');if(item)values[key]=item.value;}if('frequency_ghz' in values&&(remote||values.frequency_ghz!==controller.snapshot().draft.frequency_ghz))profile.manualFrequency();controller.setDraft(values);writeFields();},destroy:()=>{dead=true;sourceGeneration++;sourceLink=null;profile.destroy();controller.destroy();}};
}
