// Display copies of the preserved scenario APIs; no runtime commands.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const provenance='scenario-contact-plan-v1';
const objectives=['balanced','latency','reliability'];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const check=(ok)=>{if(!ok)throw new Error('시나리오 응답 계약과 일치하지 않는 자료를 폐기했습니다.');};
function validateNetwork(graph){
  check(graph&&Array.isArray(graph.nodes)&&Array.isArray(graph.links));
  const nodes=new Set(),links=new Set();
  for(const node of graph.nodes){check(typeof node.id==='string'&&node.id.length>0&&node.id.length<=40&&!nodes.has(node.id));nodes.add(node.id);}
  for(const link of graph.links){check(typeof link.id==='string'&&link.id.length>0&&!links.has(link.id)&&nodes.has(link.source)&&nodes.has(link.target)&&finite(link.quality)&&link.quality>=0&&link.quality<=100);links.add(link.id);}
}
function validateRoute(result,input,network){
  check(result&&result.source===input.source&&result.target===input.target&&result.objective===input.objective&&['available','unavailable'].includes(result.status)&&Array.isArray(result.path)&&Array.isArray(result.link_ids)&&Array.isArray(result.active_fault_targets)&&result.active_fault_targets.every(x=>typeof x==='string'));
  if(result.status==='unavailable'){check(result.path.length===0&&result.link_ids.length===0&&result.hops===0&&result.cost===null);return;}
  check(result.path[0]===input.source&&result.path.at(-1)===input.target&&result.hops===result.path.length-1&&result.link_ids.length===result.hops&&finite(result.cost)&&result.cost>=0&&result.path.every(id=>network.nodes.some(node=>node.id===id)));
  for(let i=0;i<result.link_ids.length;i++){const link=network.links.find(x=>x.id===result.link_ids[i]);check(link&&((link.source===result.path[i]&&link.target===result.path[i+1])||(link.target===result.path[i]&&link.source===result.path[i+1])));}
}
function validateContacts(result,hours,network){
  check(result&&result.hours===hours&&result.provenance===provenance&&Array.isArray(result.items)&&result.count===result.items.length);
  const ids=new Set();
  for(const item of result.items){
    const link=network.links.find(x=>x.id===item.link_id),start=Date.parse(item.start),end=Date.parse(item.end);
    check(typeof item.id==='string'&&!ids.has(item.id)&&link&&link.source===item.source&&link.target===item.target&&item.provenance===provenance&&typeof item.start==='string'&&typeof item.end==='string'&&/(Z|\+00:00)$/.test(item.start)&&/(Z|\+00:00)$/.test(item.end)&&Number.isFinite(start)&&Number.isFinite(end)&&end>start&&finite(item.duration_minutes)&&Math.abs((end-start)/60000-item.duration_minutes)<1e-6&&finite(item.quality)&&item.quality>=0&&item.quality<=100&&finite(item.capacity_mb)&&item.capacity_mb>=0);ids.add(item.id);
  }
}
export function createCommunicationPlanning(api,notify=()=>{}){
  let destroyed=false,network=null,networkStatus='idle',networkError='',draft={source:'',target:'',objective:'balanced',hours:'12'};
  const queries={network:{generation:0,abort:null},route:{generation:0,abort:null},contacts:{generation:0,abort:null}};
  const empty=()=>({status:'idle',result:null,error:'',queriedUtc:null});let route=empty(),contacts=empty();
  const snapshot=()=>structuredClone({network,networkStatus,networkError,draft,route,contacts});
  function invalidate(kind){const q=queries[kind];q.generation++;q.abort?.abort();q.abort=null;if(kind==='route')route=empty();if(kind==='contacts')contacts=empty();}
  function setDraft(values){if(destroyed)return;for(const key of ['source','target','objective','hours'])if(typeof values[key]==='string'&&values[key]!==draft[key]){invalidate(key==='hours'?'contacts':'route');draft[key]=values[key];}notify();}
  async function load(){
    if(destroyed)return;for(const kind of Object.keys(queries))invalidate(kind);network=null;networkStatus='pending';networkError='';
    const q=queries.network,ticket=q.generation;q.abort=new AbortController();notify();
    try{const response=await api.bootstrap({signal:q.abort.signal});if(destroyed||ticket!==q.generation)return;validateNetwork(response?.communication);network=structuredClone(response.communication);networkStatus='ready';for(const key of ['source','target'])if(!network.nodes.some(x=>x.id===draft[key]))draft[key]='';}
    catch(error){if(destroyed||ticket!==q.generation)return;networkStatus=error.name==='AbortError'?'idle':'error';networkError=networkStatus==='error'?error.message:'';}
    if(!destroyed&&ticket===q.generation){q.abort=null;notify();}
  }
  async function query(kind){
    if(destroyed)return;invalidate(kind);const q=queries[kind],ticket=q.generation,input={...draft};let state=empty();
    const assign=()=>{if(kind==='route')route=state;else contacts=state;};
    try{
      if(networkStatus!=='ready')throw new Error('시나리오 통신망을 먼저 불러오세요.');
      if(kind==='route'){if(![input.source,input.target].every(id=>network.nodes.some(x=>x.id===id))||!objectives.includes(input.objective))throw new Error('통신망에 있는 출발·도착 노드와 목적을 선택하세요.');}
      else if(!input.hours.trim()||!Number.isInteger(Number(input.hours))||Number(input.hours)<1||Number(input.hours)>72)throw new Error('생성 시간은 정수 1~72를 입력하세요.');
      q.abort=new AbortController();state.status='pending';assign();notify();
      const response=kind==='route'?await api.route(input.source,input.target,input.objective,{signal:q.abort.signal}):await api.contacts(Number(input.hours),{signal:q.abort.signal});
      if(destroyed||ticket!==q.generation)return;
      if(kind==='route')validateRoute(response,input,network);else validateContacts(response,Number(input.hours),network);
      state={status:'ready',result:structuredClone(response),error:'',queriedUtc:new Date().toISOString()};
    }catch(error){if(destroyed||ticket!==q.generation)return;state={...empty(),status:error.name==='AbortError'?'idle':'error',error:error.name==='AbortError'?'':error.message};}
    if(!destroyed&&ticket===q.generation){q.abort=null;assign();notify();}
  }
  return {snapshot,setDraft,load,route:()=>query('route'),contacts:()=>query('contacts'),cancel(kind){if(destroyed||!queries[kind])return;invalidate(kind);if(kind==='network'){networkStatus='idle';networkError='';}notify();},destroy(){for(const kind of Object.keys(queries))invalidate(kind);destroyed=true;}};
}
export function routeMarkup(state){
  const r=state.result;if(!r)return '';
  return `<p><strong>${r.status==='available'?'시나리오 경로 있음':'시나리오 경로 없음'}</strong> · 실제 ISS 수신 미확인</p><p>${escape(r.source)} → ${escape(r.target)} / ${escape(r.objective)}</p>${r.status==='available'?`<p>${r.path.map(escape).join(' → ')} / ${r.hops} hop / 링크 ${r.link_ids.map(escape).join(', ')||'없음'}</p><p>기존 목적함수 비용 ${escape(r.cost)} (실측 지연·확률 아님)</p>`:''}<p>조회 시점 SIM 장애 대상: ${r.active_fault_targets.map(escape).join(', ')||'없음'}</p><small>조회 브라우저 UTC ${escape(state.queriedUtc)}</small>`;
}
export function contactsMarkup(state){
  const r=state.result;if(!r)return '';
  return `<p>${r.count?'시나리오 일정 '+r.count+'개':'시나리오 일정 없음'} · 생성 시간 입력 ${r.hours} h</p><small>조회 브라우저 UTC ${escape(state.queriedUtc)} / ${provenance}</small>${r.count?`<div class="cp-table"><table><thead><tr><th>UTC 시작</th><th>UTC 종료</th><th>노드·링크</th><th>분</th><th>예시 품질</th><th>예시 용량 MB</th></tr></thead><tbody>${r.items.map(x=>`<tr><td>${escape(x.start)}</td><td>${escape(x.end)}</td><td>${escape(x.source)} → ${escape(x.target)}<br>${escape(x.link_id)}</td><td>${escape(x.duration_minutes)}</td><td>${escape(x.quality)}</td><td>${escape(x.capacity_mb)}</td></tr>`).join('')}</tbody></table></div>`:''}`;
}
export function createCommunicationPlanningPanel(api){
  let active=false,panel=null;
  const controller=createCommunicationPlanning(api,render),fields=['source','target','objective','hours'];
  const get=id=>panel?.querySelector('#cp-'+id);
  function writeFields(){const {draft}=controller.snapshot();for(const key of fields){const field=get(key);if(field&&field.value!==draft[key])field.value=draft[key];}}
  function html(id,value){const el=get(id);if(el.innerHTML!==value)el.innerHTML=value;}
  function render(){
    if(!active)return;
    if(!panel?.isConnected){
      panel=document.createElement('section');panel.id='communication-planning';panel.className='panel';document.getElementById('screen').prepend(panel);
      panel.innerHTML=`<header><h2>통신 경로·접촉 계획</h2><small>시나리오 통신 계획</small></header><div class="body"><p>예시 통신망·품질로 계산합니다. 실제 ISS 경로·접촉·수신은 미확인입니다.</p><button type="button" id="cp-network-load">시나리오 통신망 불러오기</button><button type="button" id="cp-network-cancel">망 조회 취소</button><p id="cp-network-status" role="status" aria-live="polite"></p><p id="cp-network-summary"></p><div class="rf-fields"><label>출발 노드<select id="cp-source"></select></label><label>도착 노드<select id="cp-target"></select></label><label>경로 목적<select id="cp-objective"><option value="balanced">균형</option><option value="latency">예시 지연</option><option value="reliability">예시 신뢰도</option></select></label><label>일정 생성 시간 h<input type="number" min="1" max="72" step="1" id="cp-hours"></label></div><div class="rf-actions"><button type="button" id="cp-route-query">시나리오 경로 조회</button><button type="button" id="cp-route-cancel">경로 조회 취소</button></div><p id="cp-route-status" role="status" aria-live="polite"></p><div id="cp-route-result"></div><div class="rf-actions"><button type="button" id="cp-contacts-query">접촉 일정 조회</button><button type="button" id="cp-contacts-cancel">일정 조회 취소</button></div><p>이 일정은 현재 서버 시각에서 생성하는 예시입니다. GP 가시 구간·표시 UTC와 연결되지 않으며, 생성 시간은 종료 시각을 엄밀히 제한하지 않습니다. 전체 행을 표시합니다.</p><p id="cp-contacts-status" role="status" aria-live="polite"></p><div id="cp-contacts-result"></div></div>`;
      for(const key of fields)get(key).addEventListener(key==='hours'?'input':'change',event=>controller.setDraft({[key]:event.target.value}));
      get('network-load').addEventListener('click',()=>controller.load());get('network-cancel').addEventListener('click',()=>controller.cancel('network'));
      for(const kind of ['route','contacts']){get(kind+'-query').addEventListener('click',()=>controller[kind]());get(kind+'-cancel').addEventListener('click',()=>controller.cancel(kind));}
    }
    const s=controller.snapshot(),choices='<option value="">노드 선택</option>'+(s.network?.nodes||[]).map(x=>`<option value="${escape(x.id)}">${escape(x.id)} · ${escape(x.type)}</option>`).join('');
    html('source',choices);html('target',choices);writeFields();
    get('network-status').textContent=`${{idle:'망 조회 대기',pending:'망 조회 중',ready:'망 조회 완료',error:'망 조회 실패'}[s.networkStatus]} ${s.networkError}`;
    get('network-summary').textContent=s.network?`${s.network.nodes.length}개 노드 / ${s.network.links.length}개 예시 링크`:'';
    for(const kind of ['route','contacts'])get(kind+'-status').textContent=`${{idle:'입력 후 조회하세요. 변경 시 다시 조회합니다.',pending:'조회 중',ready:'조회 완료',error:'조회 실패'}[s[kind].status]} ${s[kind].error}`;
    html('route-result',routeMarkup(s.route));html('contacts-result',contactsMarkup(s.contacts));
  }
  return {show(view){active=view==='ground';render();},update:render,applyDraft(items,remote=false){const values={};for(const item of items){const key=fields.find(x=>item.id==='cp-'+x);if(key&&typeof item.value==='string'){if(remote)controller.cancel(key==='hours'?'contacts':'route');values[key]=item.value;}}controller.setDraft(values);writeFields();},destroy:()=>controller.destroy()};
}
