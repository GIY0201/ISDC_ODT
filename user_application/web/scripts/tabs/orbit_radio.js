import {createBrowserId} from '../browser_identity.js';
import {createUtcCodec} from '../orbit_utc.js';
import {createRfReceiveProfile,profileMarkup} from './rf_receive_profile.js?v=t039-r1';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const c=299792458;
const units={position:'m',velocity:'m/s',range:'m',range_rate:'m/s',frequency:'Hz',doppler:'Hz',elevation:'deg',time:'UTC'};
const metrics=['elevation_deg','range_m','range_rate_m_s','doppler_hz','received_frequency_hz'];
const close=(a,b)=>Math.abs(a-b)<=Math.max(1e-5,Math.abs(b)*1e-12);
export function validateRadioResponse(r,p,s){
  const mismatch=!r||r.stale!==false||r.client_request_id!==p.client_request_id||r.revision!==p.selection_revision||r.input_id!==p.input_id||r.input_hash!==s.input_hash||r.utc!==p.utc||r.frequency_hz!==p.frequency_hz||r.minimum_elevation_deg!==s.minimum_elevation_deg||r.model!=='one_way_first_order_v1'||r.communication_status!=='unknown'||!['valid','error'].includes(r.status)||['eop_sha256','leap_sha256','frame','profile'].some(k=>r[k]!==s[k])||['latitude_deg','longitude_deg','ellipsoid_height_m'].some(k=>r.ground_point?.[k]!==s.ground_point?.[k])||r.ground_point?.virtual!==true||r.ground_point?.ellipsoid!=='WGS84'||Object.entries(units).some(([k,v])=>r.units?.[k]!==v)||!Array.isArray(r.assumptions)||r.assumptions.some(x=>typeof x!=='string');
  if(mismatch)throw Error('선택·시각·주파수·출처와 일치하지 않는 응답을 폐기했습니다.');
  if(r.status==='error'){
    if(typeof r.error_code!=='string'||!r.error_code||metrics.some(k=>r[k]!==null)||r.position_m!==null||r.velocity_m_s!==null)throw Error('실패 응답에 숫자 결과가 포함되어 있습니다.');
    throw Error(`궤도 계산 실패: ${r.error_code}`);
  }
  if(r.error_code!==null||metrics.some(k=>typeof r[k]!=='number'||!Number.isFinite(r[k]))||[r.position_m,r.velocity_m_s].some(v=>!Array.isArray(v)||v.length!==3||v.some(x=>typeof x!=='number'||!Number.isFinite(x)))||r.range_m<=0||Math.abs(r.elevation_deg)>90||Math.abs(r.range_rate_m_s)>=c||!close(r.doppler_hz,-p.frequency_hz*r.range_rate_m_s/c)||!close(r.received_frequency_hz,p.frequency_hz+r.doppler_hz))throw Error('거리·도플러 단위 또는 계산 관계가 일치하지 않습니다.');
}
export function createOrbitRadio(client,api,notify=()=>{},requestId=()=>createBrowserId()){
  let draft={utc:'',frequency_mhz:''},result=null,status='idle',error='',generation=0,abort=null,destroyed=false,context='';
  const snapshot=()=>structuredClone({draft,result,status,error});
  function cancel(){generation++;abort?.abort();abort=null;result=null;status='idle';error='';}
  function update(){if(destroyed)return;const {state,status:clientStatus}=client.snapshot();const key=JSON.stringify([state?.revision,state?.input_id,state?.input_hash,state?.ground_point,state?.minimum_elevation_deg,state?.eop_sha256,state?.leap_sha256,state?.frame,state?.profile,clientStatus==='error'||clientStatus==='empty'||clientStatus==='pending']);if(key!==context){context=key;cancel();notify();}}
  function setDraft(values){if(destroyed)return;let changed=false;for(const key of ['utc','frequency_mhz'])if(typeof values[key]==='string'&&draft[key]!==values[key]){draft[key]=values[key];changed=true;}if(changed){cancel();notify();}}
  async function calculate(){
    if(destroyed)return;update();cancel();const ticket=generation;let payload,state;
    try{
      const selected=client.snapshot();state=selected.state;
      if(!state?.input_id||selected.status!=='ready')throw Error('저장 궤도 입력이 준비된 뒤 계산하세요.');
      const frequency=Number(draft.frequency_mhz.trim());
      if(!draft.frequency_mhz.trim()||!Number.isFinite(frequency)||frequency<=0||frequency>300000)throw Error('송신 주파수 MHz는 0 초과, 300000 이하의 유한한 값이 필요합니다.');
      const utc=createUtcCodec(state.leap_sha256).advance(draft.utc.trim(),0);
      payload={client_request_id:requestId(),selection_revision:state.revision,input_id:state.input_id,utc,frequency_hz:frequency*1e6};
      abort=new AbortController();status='pending';notify();const response=await api.orbitRadio(payload,{signal:abort.signal});
      if(destroyed||ticket!==generation)return;
      update();if(ticket!==generation)return;validateRadioResponse(response,payload,state);result=structuredClone(response);status='ready';
    }catch(exc){if(destroyed||ticket!==generation)return;result=null;status=exc.name==='AbortError'?'idle':'error';error=status==='error'?exc.message:'';}
    if(!destroyed&&ticket===generation){abort=null;notify();}
  }
  return {snapshot,setDraft,calculate,update,useUtc(){setDraft({utc:client.snapshot().state?.current_utc||''});},cancel(){if(destroyed)return;cancel();notify();},destroy(){cancel();destroyed=true;}};
}
export function radioMarkup(state){
  const r=state.result;if(!r)return '';
  const direction=r.range_rate_m_s<0?'접근':r.range_rate_m_s>0?'이탈':'순간 거리 변화 없음';
  return `<p><strong>저장 궤도 모델 계산 · 실제 수신 미확인</strong></p><p>계산 UTC ${escape(r.utc)} / 입력 ${escape(r.input_id)} / revision ${r.revision}</p><dl class="rf-metrics"><dt>거리 km</dt><dd>${(r.range_m/1000).toFixed(6)}</dd><dt>거리 변화율 m/s</dt><dd>${r.range_rate_m_s.toFixed(6)} (${direction})</dd><dt>고도각 °</dt><dd>${r.elevation_deg.toFixed(6)}</dd><dt>송신 주파수 MHz</dt><dd>${(r.frequency_hz/1e6).toFixed(9)}</dd><dt>도플러 변화 Hz (수신−송신)</dt><dd>${r.doppler_hz.toFixed(6)}</dd><dt>예측 수신 주파수 MHz</dt><dd>${(r.received_frequency_hz/1e6).toFixed(9)}</dd></dl><p>${r.elevation_deg>=r.minimum_elevation_deg?'선택한 고도각 조건 충족':'선택한 고도각 조건 미충족'} · 실제 RF·장비 조건은 미확인</p><ul>${r.assumptions.map(x=>`<li>${escape(x)}</li>`).join('')}</ul><details><summary>좌표·입력 근거</summary><p>${escape(r.frame)} / ${escape(r.profile)} / 가상 WGS84 지점 ${escape(r.ground_point.latitude_deg)}, ${escape(r.ground_point.longitude_deg)}, ${escape(r.ground_point.ellipsoid_height_m)} m</p><p>ITRF 위치 m ${r.position_m.map(escape).join(', ')} / 속도 m/s ${r.velocity_m_s.map(escape).join(', ')}</p><p>입력 SHA256 ${escape(r.input_hash)} / EOP ${escape(r.eop_sha256)} / 윤초 ${escape(r.leap_sha256)}</p></details>`;
}
export function createOrbitRadioPanel(client,api){
  let active=false,panel=null;
  const controller=createOrbitRadio(client,api,render);
  const profile=createRfReceiveProfile(api,render,()=>{controller.setDraft({frequency_mhz:String(profile.snapshot().profile.frequency_mhz)});writeFields();},()=>controller.cancel());
  const get=id=>panel?.querySelector('#radio-'+id);
  function writeFields(){const {draft}=controller.snapshot();for(const key of ['utc','frequency_mhz'])if(get(key)&&get(key).value!==draft[key])get(key).value=draft[key];}
  function render(){
    if(!active)return;
    if(!panel?.isConnected){
      panel=document.createElement('section');panel.id='orbit-radio';panel.className='panel';document.getElementById('screen').prepend(panel);
      panel.innerHTML=`<header><h2>위성 거리·도플러</h2><small>SGP4 궤도 + 상대속도 모델 / 실제 수신 미확인</small></header><div class="body"><p>선택한 저장 궤도와 가상 지점으로 한 UTC 시점을 계산합니다. 재생 위치를 자동 추종하거나 RF 입력·장비 주파수를 바꾸지 않습니다.</p><div class="rf-fields"><label>계산 UTC<input id="radio-utc" type="text" placeholder="YYYY-MM-DDTHH:mm:ssZ"></label><label>송신 주파수 MHz<input id="radio-frequency_mhz" type="number" step="any"></label></div><button type="button" id="radio-use-utc">서버 UTC 가져오기</button><div class="rf-actions"><button type="button" id="radio-profile-load">ISS 공식 주파수 불러오기</button><button type="button" id="radio-profile-apply">도플러 입력에 공식 주파수 적용</button></div><div id="radio-profile-status"></div><p id="radio-origin"></p><div class="rf-actions"><button type="button" id="radio-calculate">거리·도플러 계산</button><button type="button" id="radio-cancel">거리·도플러 조회 취소</button></div><p id="radio-status" role="status" aria-live="polite"></p><div id="radio-result"></div></div>`;
      for(const key of ['utc','frequency_mhz'])get(key).addEventListener('input',event=>{controller.setDraft({[key]:event.target.value});if(key==='frequency_mhz')profile.manualFrequency();});
      get('use-utc').addEventListener('click',()=>controller.useUtc());get('calculate').addEventListener('click',()=>controller.calculate());get('cancel').addEventListener('click',()=>controller.cancel());get('profile-load').addEventListener('click',()=>profile.load());get('profile-apply').addEventListener('click',()=>profile.apply());
    }
    const s=controller.snapshot(),p=profile.snapshot();writeFields();
    get('status').textContent=`${{idle:'입력 후 계산하세요. 편집·선택 변경 시 재계산합니다.',pending:'모델 계산 중',ready:'모델 계산 완료',error:'계산 실패'}[s.status]} ${s.error}`;
    const html=radioMarkup(s);if(get('result').innerHTML!==html)get('result').innerHTML=html;
    const ph=profileMarkup(p);if(get('profile-status').innerHTML!==ph)get('profile-status').innerHTML=ph;
    get('profile-apply').disabled=p.status!=='ready';get('origin').textContent=!s.draft.frequency_mhz?'주파수 미확인':p.applied&&Number(s.draft.frequency_mhz)===p.profile?.frequency_mhz?'공식 공지 주파수 · 저장 GP 시점의 운용 여부는 미확인':'직접 입력·다른 창 전달 주파수: 사용자 가정';
  }
  return {show(view){active=view==='satellite';controller.update();render();},update(){controller.update();render();},applyDraft(items,remote=false){const values={};for(const item of items)for(const key of ['utc','frequency_mhz'])if(item.id==='radio-'+key&&typeof item.value==='string'){if(remote){controller.cancel();if(key==='frequency_mhz')profile.manualFrequency();}values[key]=item.value;}controller.setDraft(values);writeFields();},destroy(){controller.destroy();profile.destroy();}};
}
