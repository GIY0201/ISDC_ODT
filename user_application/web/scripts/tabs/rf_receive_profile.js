// Official announcement provenance belongs to this view, not runtime state.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validate(profile){
  const source=profile?.source,mhz=profile?.frequency_mhz,known=profile?.known_inputs;
  if(profile?.schema_version!==1||profile.profile_id!=='iss_aprs_receive_v1'||profile.satellite_catalog_number!==25544||profile.service!=='APRS'||profile.station!=='RS0ISS'||profile.direction!=='receive_only'||profile.communication_status!=='unknown'||profile.equipment_status!=='not_selected'||!Number.isFinite(mhz)||mhz<=100||mhz>300000||!known||Object.keys(known).length!==1||(!Number.isFinite(known.frequency_ghz)||Math.abs(known.frequency_ghz-mhz/1000)>1e-12)||source?.url!=='https://www.ariss.org/current-status-of-iss-stations.html'||!/^\d{4}-\d{2}-\d{2}$/.test(source.status_as_of)||!Number.isFinite(Date.parse(source.status_as_of))||!source.checked_utc?.endsWith('Z')||!Number.isFinite(Date.parse(source.checked_utc))||Date.parse(source.status_as_of)>Date.parse(source.checked_utc)||!/^[a-f0-9]{64}$/.test(profile.profile_sha256)||typeof profile.source_report!=='string'||!Array.isArray(profile.notes)||profile.notes.some(note=>typeof note!=='string'))throw Error('공식 조건 응답의 단위·출처·미확인 계약이 일치하지 않습니다.');
}
export function createRfReceiveProfile(api,notify=()=>{},applyDraft=()=>{},invalidate=()=>{}){
  let profile=null,status='idle',error='',applied=false,generation=0,abort=null,destroyed=false;
  const snapshot=()=>structuredClone({profile,status,error,applied});
  async function load(){
    if(destroyed)return;
    const ticket=++generation;abort?.abort();abort=new AbortController();profile=null;applied=false;error='';status='pending';invalidate();notify();
    try{
      const response=await api.issReceiveProfile({signal:abort.signal});
      if(destroyed||ticket!==generation)return;
      validate(response);profile=structuredClone(response);status='ready';
    }catch(exc){if(destroyed||ticket!==generation)return;status='error';error=exc.message;}
    if(!destroyed&&ticket===generation){abort=null;notify();}
  }
  function apply(){if(destroyed||status!=='ready')return;invalidate();applied=true;applyDraft({frequency_ghz:String(profile.known_inputs.frequency_ghz)});notify();}
  function manualFrequency(){if(destroyed)return;applied=false;invalidate();notify();}
  return {snapshot,load,apply,manualFrequency,destroy(){destroyed=true;generation++;abort?.abort();profile=null;applied=false;}};
}
export function fieldOrigin(key,value,state){
  if(!String(value??'').trim())return 'unknown';
  if(key==='frequency_ghz'&&state.applied&&Number(value)===state.profile?.known_inputs.frequency_ghz)return 'official_confirmed';
  return 'user_assumption';
}
export function profileMarkup(state,now=new Date().toISOString()){
  if(state.status==='pending')return '<p>공식 조건 패키지 조회 중…</p>';
  if(state.status==='error')return `<p>공식 조건 조회 실패: ${escape(state.error)}. 직접 입력한 가정으로 계산할 수 있습니다.</p>`;
  if(!state.profile)return '<p>ISS APRS 수신 · 장비 미선정 · 실제 통신 미확인. 공식 공지 조건을 불러온 뒤 주파수만 적용할 수 있습니다.</p>';
  const p=state.profile,source=p.source,age=Math.floor((Date.parse(now)-Date.parse(source.status_as_of))/86400000);
  return `<p><strong>ISS APRS 수신 / ${escape(p.station)}</strong> · 장비 미선정 · 실제 통신 미확인</p><p>공식 공지 주파수 ${escape(p.frequency_mhz)} MHz (${escape(p.known_inputs.frequency_ghz)} GHz) · ${state.applied?'주파수 적용됨':'적용 전'}</p><p><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">ARISS 공식 출처</a> · 공지 기준일 ${escape(source.status_as_of)} · 현재 날짜 기준 ${Number.isFinite(age)&&age>=0?age+'일 경과':'날짜 비교 불가'}</p><p>출처 확인 UTC ${escape(source.checked_utc)}. 저장된 공지이며 실시간 상태 조회가 아닙니다.</p><p>${escape(p.source_report)}</p><ul>${p.notes.map(note=>`<li>${escape(note)}</li>`).join('')}</ul><p>저장 GP epoch와 조회 UTC는 기하 계산 영역의 시간입니다. 이 공지를 적용해도 궤도 자료가 갱신되거나 실제 수신이 확인되지 않습니다.</p><details><summary>프로파일 버전 및 무결성</summary><p>${escape(p.profile_id)} / schema ${escape(p.schema_version)} / SHA256 ${escape(p.profile_sha256)}</p></details>`;
}
