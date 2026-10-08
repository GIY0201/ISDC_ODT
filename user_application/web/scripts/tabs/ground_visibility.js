import {createBrowserId} from '../browser_identity.js';
import {createUtcCodec} from '../orbit_utc.js';
const escape=value=>String(value??'미확인').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pointEqual=(a,b)=>a&&b&&['latitude_deg','longitude_deg','ellipsoid_height_m','virtual','ellipsoid'].every(key=>a[key]===b[key]);
const context=state=>JSON.stringify(state&&[state.revision,state.input_id,state.input_hash,state.eop_sha256,state.leap_sha256,state.frame,state.profile,state.ground_point,state.minimum_elevation_deg]);

// Independent query result copy; selection and time remain owned by the server.
export function createGroundVisibility(client,api,notify,requestId=()=>createBrowserId()){
  let result=null,status='idle',error='',generation=0,abort=null,key=context(client.snapshot().state);
  const snapshot=()=>structuredClone({result,status,error});
  function cancel(){generation++;abort?.abort();abort=null;result=null;status='idle';error='';}
  function update(){const next=context(client.snapshot().state);if(next!==key){key=next;cancel();}}
  async function query(start,end){
    update();cancel();const selected=client.snapshot().state;
    if(!selected?.input_id){status='error';error='저장 궤도 입력을 먼저 선택하세요.';notify();return;}
    const ticket=generation,id=requestId();abort=new AbortController();status='pending';notify();
    try{
      const response=await api.orbitVisibility({client_request_id:id,selection_revision:selected.revision,input_id:selected.input_id,ground_point:selected.ground_point,minimum_elevation_deg:selected.minimum_elevation_deg,start_utc:start,end_utc:end},{signal:abort.signal});
      if(ticket!==generation)return;
      if(context(client.snapshot().state)!==key){update();notify();return;}
      const mismatch=['input_id','input_hash','eop_sha256','leap_sha256','frame','profile','minimum_elevation_deg'].some(field=>response[field]!==selected[field]);
      if(response.stale||mismatch||response.revision!==selected.revision||response.client_request_id!==id||!pointEqual(response.ground_point,selected.ground_point)||response.query_start_utc!==start||response.query_end_utc!==end||response.communication_status!=='unknown'){
        status='stale';error='선택·자료·조회 범위와 일치하지 않는 응답을 폐기했습니다.';
      }else {result=response;status='ready';}
    }catch(exc){if(ticket!==generation)return;if(exc.name==='AbortError')status='idle';else {status='error';error=exc.message;}}
    if(ticket===generation){abort=null;notify();}
  }
  return {snapshot,query,update,cancel};
}

export function visibilityMarkup(result){
  if(!result)return '';
  const labels={complete:'계산 완료',none:'가시 구간 없음',partial:'부분 결과 · 실패 시각에서는 가시 여부 미확인',error:'계산 실패 · 가시 여부 미확인'};
  return `<p><strong>${escape(labels[result.status]||result.status)}</strong> · 실제 통신 미확인</p><p>조회 UTC ${escape(result.query_start_utc)} → ${escape(result.query_end_utc)}<br>최소 고도각 ${escape(result.minimum_elevation_deg)}° · revision ${escape(result.revision)}</p>
    ${(result.intervals||[]).length?`<div class="visibility-table"><table><caption>기하학적 가시 구간 · UTC</caption><thead><tr><th>시작</th><th>종료</th><th>최대 시각 / 고도각</th><th>조회 경계</th><th>구간 분석</th></tr></thead><tbody>${result.intervals.map((row,index)=>`<tr><td>${escape(row.start_utc)}</td><td>${escape(row.end_utc)}</td><td>${escape(row.peak_utc)}<br>${Number(row.max_elevation_deg).toFixed(4)}°</td><td>${row.start_clipped?'시작 잘림 ':''}${row.end_clipped?'종료 잘림':''}${!row.start_clipped&&!row.end_clipped?'양쪽 경계 확인':''}</td><td><button type="button" id="visibility-series-${index}">이 구간 선택</button></td></tr>`).join('')}</tbody></table></div>`:''}
    <p>구간 ${(result.intervals||[]).length}개 / 접점 ${(result.contacts||[]).length}개</p>
    ${(result.contacts||[]).map(row=>`<p>접점 ${escape(row.utc)} / ${escape(row.elevation_deg)}° / 지속 0초 · 통신 시간으로 해석하지 않습니다.</p>`).join('')}
    ${(result.errors||[]).length?`<ul>${result.errors.map(row=>`<li>실패 UTC ${escape(row.utc)} / ${escape(row.error_code)}</li>`).join('')}</ul>`:''}
    <details><summary>입력 및 계산 자료 SHA256</summary><dl>${['input_hash','eop_sha256','leap_sha256','frame','profile'].map(field=>`<dt>${field}</dt><dd>${escape(result[field])}</dd>`).join('')}</dl></details>`;
}

export function createGroundPanel(client,api,{onInterval=()=>{},onInvalidate=()=>{}}={}){
  let active=false,panel=null,draft=null,rangeInput=null,working=false,message='',dirty=false,pointKey=null,dead=false;
  const controller=createGroundVisibility(client,api,render);
  function cancelVisibility(){controller.cancel();onInvalidate();}
  function render(){
    controller.update();if(!active)return;
    const {inputs,state,status:selectionStatus,error:selectionError}=client.snapshot();
    const screen=document.getElementById('screen');
    if(!panel?.isConnected){
      panel=document.createElement('section');panel.id='ground-visibility';panel.className='panel';screen.prepend(panel);
      panel.innerHTML=`<header><h2>가상 지점 · 가시 구간</h2><small>SGP4 기하학적 예측 / 실제 통신 미확인</small></header><div class="body"><p>위성 창과 같은 저장 입력·지점·고도각을 사용합니다. 지점은 가상 위치이며 시설·안테나·RF 측정은 연결되지 않았습니다.</p><label>저장 입력 <select id="ground-input"></select></label><div class="ground-fields"><label>위도 ° <input id="ground-lat" type="number" min="-90" max="90" step="any"></label><label>경도 ° <input id="ground-lon" type="number" min="-180" max="180" step="any"></label><label>WGS84 타원체 높이 m <input id="ground-height" type="number" step="any"></label><label>최소 고도각 ° <input id="ground-angle" type="number" min="0" max="90" step="any"></label><label>조회 시작 UTC <input id="visibility-start" type="text"></label><label>조회 종료 UTC <input id="visibility-end" type="text"></label></div><p>높이는 평균 해수면 고도가 아닙니다. UTC는 Z로 끝나며 조회 길이는 최대 24시간입니다.</p><div class="ground-actions"><button id="ground-apply" type="button">지점 적용·정지</button><button id="visibility-day" type="button">저장 자료 시각부터 24시간</button><button id="visibility-query" type="button">설정 적용 후 구간 계산</button><button id="visibility-cancel" type="button">조회 취소</button></div><p id="visibility-status" role="status" aria-live="polite"></p><div id="visibility-result"></div></div>`;
      panel.querySelector('#ground-input').addEventListener('change',async event=>{if(!event.target.value){event.target.value=client.snapshot().state?.input_id||'';return;}cancelVisibility();message='';await client.select(event.target.value);rangeInput=null;draft=null;dirty=false;pointKey=null;render();});
      for(const id of ['ground-lat','ground-lon','ground-height','ground-angle','visibility-start','visibility-end'])panel.querySelector('#'+id).addEventListener('input',()=>{dirty=true;draft=readFields();cancelVisibility();message='설정 변경됨 · 계산을 눌러 적용하세요.';render();});
      panel.querySelector('#ground-apply').addEventListener('click',()=>run(false));
      panel.querySelector('#visibility-query').addEventListener('click',()=>run(true));
      panel.querySelector('#visibility-cancel').addEventListener('click',()=>{cancelVisibility();message='조회 취소됨 · 실행 중 계산의 즉시 중단은 보장하지 않습니다.';render();});
      panel.querySelector('#visibility-day').addEventListener('click',()=>{try{setRange(client.snapshot().state);draft=readFields();cancelVisibility();message='입력 epoch 기준 24시간 · 계산을 눌러 조회하세요.';}catch(exc){message=exc.message;}render();});
      writeFields(draft||{lat:state?.ground_point?.latitude_deg??33.4996,lon:state?.ground_point?.longitude_deg??126.5312,height:state?.ground_point?.ellipsoid_height_m??0,angle:state?.minimum_elevation_deg??10,start:'',end:''});
    }
    const nextPoint=JSON.stringify([state?.ground_point,state?.minimum_elevation_deg]);
    if(state&&!dirty&&nextPoint!==pointKey){writeFields({...readFields(),lat:state.ground_point.latitude_deg,lon:state.ground_point.longitude_deg,height:state.ground_point.ellipsoid_height_m,angle:state.minimum_elevation_deg});draft=readFields();pointKey=nextPoint;}
    const select=panel.querySelector('#ground-input');select.innerHTML='<option value="">입력 선택</option>'+inputs.map(item=>`<option value="${escape(item.input_id)}" ${item.input_id===state?.input_id?'selected':''}>${escape(item.satellite_id)} / ${escape(item.format)}</option>`).join('');
    if(state?.input_id&&rangeInput!==state.input_id&&!dirty){try{setRange(state);rangeInput=state.input_id;draft=readFields();}catch(exc){message=exc.message;}}
    const query=controller.snapshot();
    panel.querySelector('#visibility-status').textContent=working?'설정 적용 중…':query.status==='pending'?'가시 구간 계산 중… 지구와 작업창을 계속 사용할 수 있습니다.':query.error||message||selectionError||'계산할 설정과 UTC 범위를 확인하세요.';
    const markup=visibilityMarkup(query.result);
    const output=panel.querySelector('#visibility-result');if(output._visibilityMarkup!==markup){output.innerHTML=markup;output._visibilityMarkup=markup;for(const [index] of (query.result?.intervals||[]).entries())panel.querySelector('#visibility-series-'+index)?.addEventListener('click',()=>onInterval(structuredClone(query.result),index));}
    for(const id of ['ground-apply','visibility-query','ground-input'])panel.querySelector('#'+id).disabled=working||selectionStatus==='pending'||(id!=='ground-input'&&!state?.input_id);
    for(const id of ['ground-lat','ground-lon','ground-height','ground-angle','visibility-start','visibility-end','visibility-day'])panel.querySelector('#'+id).disabled=working||selectionStatus==='pending';
    panel.querySelector('#visibility-cancel').disabled=query.status!=='pending';
  }
  function readFields(){return Object.fromEntries(['lat','lon','height','angle','start','end'].map((key,index)=>[key,panel.querySelector('#'+['ground-lat','ground-lon','ground-height','ground-angle','visibility-start','visibility-end'][index]).value]));}
  function writeFields(values){for(const [index,key] of ['lat','lon','height','angle','start','end'].entries())panel.querySelector('#'+['ground-lat','ground-lon','ground-height','ground-angle','visibility-start','visibility-end'][index]).value=values[key];}
  function setRange(state){const record=client.snapshot().inputs.find(row=>row.input_id===state?.input_id);if(!record)return;const codec=createUtcCodec(state.leap_sha256);panel.querySelector('#visibility-start').value=record.epoch_utc;panel.querySelector('#visibility-end').value=codec.advance(record.epoch_utc,86400);}
  async function run(query){
    if(working)return;cancelVisibility();working=true;message='';draft=readFields();render();
    try{
      const state=client.snapshot().state,codec=createUtcCodec(state.leap_sha256);
      const values=['lat','lon','height','angle'].map(key=>draft[key].trim()===''?NaN:Number(draft[key]));
      if(!values.every(Number.isFinite)||Math.abs(values[0])>90||Math.abs(values[1])>180||values[3]<0||values[3]>90)throw new Error('위도·경도·높이·최소 고도각 범위를 확인하세요.');
      // Canonical nanosecond UTC matches the server and handles leap seconds.
      const start=query?codec.advance(draft.start.trim(),0):null,end=query?codec.advance(draft.end.trim(),0):null,seconds=query?codec.difference(end,start):null;
      if(query&&(!(seconds>0)||seconds>86400))throw new Error('조회 종료는 시작 이후이며 최대 24시간이어야 합니다.');
      const ground={latitude_deg:values[0],longitude_deg:values[1],ellipsoid_height_m:values[2],virtual:true,ellipsoid:'WGS84'};
      if(!pointEqual(ground,state.ground_point)||values[3]!==state.minimum_elevation_deg||state.playing){await client.setGround(ground,values[3]);if(client.snapshot().status!=='ready')throw new Error(client.snapshot().error||'설정 적용 실패');await client.samples({stepSeconds:1,count:3});}
      dirty=false;pointKey=null;message='지점 적용됨 · 실제 통신 미확인';working=false;render();
      if(query)await controller.query(start,end);
    }catch(exc){message=exc.message;working=false;render();}
  }
  function applyDraft(items){
    if(!panel||!active)return;
    const ids=['ground-lat','ground-lon','ground-height','ground-angle','visibility-start','visibility-end'];
    let changed=false;
    for(const item of items){if(!ids.includes(item.id)||typeof item.value!=='string')continue;const field=panel.querySelector('#'+item.id);if(field&&field.value!==item.value){field.value=item.value;changed=true;}}
    if(changed){dirty=true;draft=readFields();cancelVisibility();message='별도 창에서 전달된 편집값 · 적용 전입니다.';render();}
  }
  function stageStation(site){
    if(dead||working||client.snapshot().status==='pending')return false;
    if(!client.snapshot().state?.input_id){message='저장 궤도 입력을 먼저 선택한 뒤 지상국 좌표를 가져오세요.';render();return false;}
    if(!site||typeof site.key!=='string'||![site.latitude,site.longitude,site.minElevationDeg].every(Number.isFinite)||Math.abs(site.latitude)>90||Math.abs(site.longitude)>180||site.minElevationDeg<0||site.minElevationDeg>90)return false;
    const state=client.snapshot().state;
    const values=panel?.isConnected?readFields():draft||{height:String(state?.ground_point?.ellipsoid_height_m??0),start:'',end:''};
    if(!values.start&&!values.end){const record=client.snapshot().inputs.find(row=>row.input_id===state?.input_id);if(record){values.start=record.epoch_utc;values.end=createUtcCodec(state.leap_sha256).advance(record.epoch_utc,86400);}}
    draft={...values,lat:String(site.latitude),lon:String(site.longitude),angle:String(site.minElevationDeg)};
    dirty=true;cancelVisibility();if(panel?.isConnected)writeFields(draft);
    message=`${site.name} (${site.key}) 대표 좌표·최소각을 초안에 가져왔습니다. 높이는 기준면 미확인으로 복사하지 않았습니다. 현재 타원체 높이를 확인하고 적용하세요. 저장 궤도 입력으로 계산하며 카탈로그 표시 위성과는 별개입니다. 실제 통신 미확인.`;
    render();return true;
  }
  return {stageStation,applyDraft,show(view){active=view==='ground';render();},update:render,destroy(){dead=true;cancelVisibility();}};
}
