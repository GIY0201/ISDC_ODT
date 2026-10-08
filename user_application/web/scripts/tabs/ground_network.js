import {koreaCoordinate,koreaPoint,stationMapMarkup,stationMapBaseMarkup,stationStatusMarkup} from './ground_station_map.js?v=u025';
import {createGroundStationEditorTools} from './ground_station_editor.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=['latitude','longitude','altitude_km','dish_m','min_elevation_deg'];
// Reuses original ground store and station editor; no native/clock/Viewer/transport owner.
export function createGroundNetworkPanel({store,model,network,fabric=null,diagram=null,networkScene=null,contactWindows=null,futurePasses=null,document,host,refreshRuntime,drawSparkline=null,onRfLinkDraft=null}={}) {
 let root=null,view=null,dead=false,editorId=null,externalPending=false,message='',busy=false,page=0;
 const editor=createGroundStationEditorTools({model,escape}),removers=[];
 let mapDraft=null,mapAdding=false,mapOutsideSelected=null,mapMarkersHtml=null,mapListHtml=null;
 const routeChoice={source:'',target:'',objective:'balanced'};
 let routeDraftGeneration=0;
 function adoptRouteDraft(input){
  const generation=++routeDraftGeneration,ticket=paintGeneration,mounted=root,visible=view;
  const bound=()=>!dead&&routeDraftGeneration===generation&&paintGeneration===ticket&&root===mounted&&view===visible;
  const ready=()=>store.ready===true&&!store.error&&!externalPending&&bound();
  try{
   const draft={source:input?.source,target:input?.target,objective:input?.objective};
   if(!ready()||typeof draft.source!=='string'||typeof draft.target!=='string'||draft.source===draft.target||!['balanced','latency','reliability'].includes(draft.objective))return false;
   const stations=stationInputs();if(!bound())return false;
   const read=()=>{const exact=network.networkSnapshot();if(!bound())return null;if(exact?.status==='valid'&&network.verifyNetworkSnapshot(exact)===true&&bound())return{value:exact,sampled:false};if(hasSampled){const value=network.networkSampledPresentation();if(!bound())return null;if(value?.presentation_kind==='NETWORK_SAMPLED_UI_V1'&&value.status==='valid'&&network.verifySampledNetworkPresentation(value,{utc:value.display_utc})===true&&bound())return{value,sampled:true};}return null;};
   const first=read(),snapshot=first?.value;if(!snapshot||!ready()||!Array.isArray(snapshot.node_definitions)||!snapshot.node_definitions.length||snapshot.node_definitions.length>240||!Array.isArray(snapshot.stations)||!Array.isArray(snapshot.network?.nodes))return false;
   const nodes=snapshot.node_definitions.map(n=>n.id),ground=snapshot.stations.filter(n=>n.enabled).map(n=>n.id),members=[...nodes,...ground];
   if(new Set(members).size!==members.length||!members.includes(draft.source)||!members.includes(draft.target)||JSON.stringify(snapshot.stations)!==JSON.stringify(store.stations)||JSON.stringify(snapshot.network.nodes.map(n=>n.id).sort())!==JSON.stringify([...members].sort())||!ready())return false;
   const scope=JSON.stringify(snapshot),fields=visible==='ground'?['source','target','objective'].map(name=>get('fabric-'+name)):null;if(!bound())return false;
   const fresh=read();if(!fresh||fresh.sampled!==first.sampled||JSON.stringify(fresh.value)!==scope||stationInputs()!==stations||!ready())return false;
   const proof=first.sampled?network.verifySampledNetworkPresentation(fresh.value,{utc:fresh.value.display_utc}):network.verifyNetworkSnapshot(fresh.value);
   if(proof!==true||!ready()||stationInputs()!==stations||!bound())return false;
   // Readiness/station getters may revoke native authority. Its registered
   // observational verifier is the final external callback before publication.
   const terminal=first.sampled?network.verifySampledNetworkPresentation(fresh.value,{utc:fresh.value.display_utc}):network.verifyNetworkSnapshot(fresh.value);
   if(terminal!==true||!bound())return false;
   Object.assign(routeChoice,draft);if(fields)for(const [i,name]of ['source','target','objective'].entries())if(fields[i])fields[i].value=draft[name];
   return true;
  }catch{return false;}
 }
 let routeDetail=null,linkDetail=null,stationDetail=null,analyticalDiagram=null,rfDetail=null;
 let passReceipt=null,passAbort=null,passGeneration=0,passBusy=false,passError='',passStation='',passPage=0;
 let selection=null,groundLinksVisible=true,coverageVisible=true,paintGeneration=0,viewGeneration=0;
 const hasSampled=typeof network.networkSampledPresentation==='function'&&typeof network.verifySampledNetworkPresentation==='function';
 const hasObservation=typeof fabric?.pollStatus==='function'&&typeof fabric?.cancelStatusPoll==='function'&&typeof fabric?.moduleStatus==='function';
 let statusTimer=null,statusActive=false,statusGeneration=0,statusCompletedAt='',statusError='';
 const get=id=>root?.querySelector('#ground-node-'+id);
 let stationInputSignature=null;
 const stationInputs=()=>JSON.stringify({stations:store.stations,ready:store.ready,error:store.error,externalPending});
 try{stationInputSignature=stationInputs();}catch{/* Failed configuration remains unavailable. */}
 function clearObservations(){const label=get('module-status'),quality=get('quality-status'),canvas=get('quality-history');if(label)label.textContent='';if(quality)quality.textContent='';if(canvas)canvas.hidden=true;}
 function stopStatusPolling(){if(!statusActive)return;statusActive=false;statusGeneration++;if(statusTimer!==null){host.clearTimeout(statusTimer.id);statusTimer=null;}fabric.cancelStatusPoll();clearObservations();}
 function installStatusTimer(){
  if(!statusActive||dead||statusTimer!==null)return;
  const owned={id:null,generation:statusGeneration};statusTimer=owned;
  owned.id=host.setTimeout(()=>{if(statusTimer!==owned||!statusActive||dead||view!=='ground'||owned.generation!==statusGeneration)return;statusTimer=null;installStatusTimer();void pollStatus();},30000);
 }
 async function pollStatus(){
  if(!statusActive||dead||view!=='ground')return;const generation=statusGeneration;
  try{const result=await fabric.pollStatus();if(dead||!statusActive||view!=='ground'||statusGeneration!==generation)return;if(result!==null)statusCompletedAt=new Date().toISOString();statusError='';}
  catch(error){if(dead||!statusActive||statusGeneration!==generation)return;statusError=String(error?.message??error);}
  if(!dead&&statusActive&&view==='ground'&&statusGeneration===generation)update();
 }
 function startStatusPolling(){if(!hasObservation||statusActive||dead||view!=='ground')return;statusActive=true;statusGeneration++;statusCompletedAt='';statusError='';installStatusTimer();void pollStatus();}
 function renderObservations(visual,valid,current){
  if(!current())return false;
  let moduleSignature=null;
  if(hasObservation){try{const state=fabric.moduleStatus();if(!current())return false;moduleSignature=JSON.stringify(state);get('module-status').textContent=state.status==='valid'?`모듈 상태 조회 · ${statusCompletedAt||'조회 중'} · 실행 ${state.value?.instance_id??'미확인'} · 응답 번호 ${state.value?.sequence??'미확인'} · 통신망 수락과 별개`:state.status==='pending'?'모듈 상태 조회 중 · 통신망 수락과 별개':`모듈 상태 조회 미확인 · ${statusError||state.error||'자료 없음'}`;}catch{if(current())get('module-status').textContent='모듈 상태 조회 미확인';}}
  const label=get('quality-status'),canvas=get('quality-history');if(!label||!canvas)return current();canvas.hidden=true;
  if(!valid){label.textContent='과거 모의 링크 품질 미확인 · 검증된 통신망 결과 없음';return current();}
  if(selection?.type!=='link'){label.textContent='과거 모의 링크 품질 미확인 · 링크를 선택하세요';return current();}
  if(!visual?.network?.links?.some(link=>link.id===selection.id)){label.textContent='과거 모의 링크 품질 미확인 · 현재 통신망에 선택한 링크 없음';return current();}
  try{
   const history=fabric?.qualityHistory?.(selection.id)??[];if(!current())return false;
   if(!Array.isArray(history)||history.length>48||history.some(p=>!Number.isFinite(p.quality)||p.quality<0||p.quality>100||typeof p.utc!=='string'||!Number.isFinite(Date.parse(p.utc))))throw Error('history unavailable');
   if(!history.length){label.textContent='과거 모의 링크 품질 미확인 · 선택 링크의 수락된 모의 품질 이력 없음';return current();}
   if(typeof drawSparkline!=='function'){label.textContent='과거 모의 링크 품질 이력 미확인 · 그래프 표시 기능 없음';return current();}
   const captured=JSON.stringify(history);canvas.hidden=false;drawSparkline(canvas,history.map(p=>p.quality));if(!current())return false;
   if(moduleSignature!==null){const status=fabric.moduleStatus();if(!current())return false;if(JSON.stringify(status)!==moduleSignature)get('module-status').textContent='모듈 상태 조회 미확인 · 표시 중 상태 변경';}
   const fresh=fabric.qualityHistory(selection.id);if(!current())return false;
   if(JSON.stringify(fresh)!==captured)throw Error('history scope changed');
   const last=history.at(-1);label.textContent=`과거 모의 링크 품질 · ${history.length}개 · 마지막 분석 UTC ${last.utc} · 실행 ${last.instance_id} · 응답 ${last.sequence} · 현재 품질·실제 RF 미확인`;
  }catch{if(current()){canvas.hidden=true;label.textContent='과거 모의 링크 품질 이력 미확인';}}
  return current();
 }
 function clearSampledUi(){
  if(!root)return;
  for(const id of ['diagram','diagram-detail','results','fabric-results','fabric-custody','fabric-hops']){const item=get(id);if(item){item.textContent='';item.innerHTML='';}}
  if(get('overview'))get('overview').innerHTML='';
  for(const id of ['summary','diagram-status']){const item=get(id);if(item)item.textContent='현재 UTC·입력의 검증된 노드 통신망 결과 없음';}
  for(const id of ['prev','next','scene-links','scene-coverage','fabric-send','fabric-route','focus']){const item=get(id);if(item)item.disabled=true;}
  const path=get('fabric-path'),dtn=get('fabric-dtn');if(path)path.textContent='현재 통신망의 경로 결과 미확인';if(dtn)dtn.textContent='현재 통신망의 DTN 결과 미확인';
  const quality=get('quality-status'),canvas=get('quality-history');if(canvas)canvas.hidden=true;
  if(quality&&view==='ground'&&!dead)quality.textContent='과거 모의 링크 품질 미확인 · 현재 UTC·입력의 검증된 통신망 결과 없음';
 }
 function listen(element,event,handler){element.addEventListener(event,handler);removers.push(()=>element.removeEventListener(event,handler));}
 function attempt(action){if(dead)return;try{message='';action();}catch(error){message=String(error.message);}update();}
 function pendingEditor(){
  if(!editorId||!get('name'))return null;
  return {id:editorId,values:Object.fromEntries(['name',...numeric].map(field=>[field,get(field).value])),
   enabled:get('enabled').checked,bands:Object.fromEntries(model.BANDS.map(band=>[band,get('band-'+band).checked]))};
 }
 function restoreEditor(draft){
  if(!draft)return;open(draft.id);if(editorId!==draft.id)return;
  for(const [field,value] of Object.entries(draft.values))get(field).value=value;
  get('enabled').checked=draft.enabled;for(const band of model.BANDS)get('band-'+band).checked=draft.bands[band];
 }
 function close(){editorId=null;const form=get('editor');if(form){form.hidden=true;form.innerHTML='';}}
 function open(id){
  const station=store.find(id);if(!station)return;editorId=id;
  const form=get('editor');form.innerHTML=editor.markup(station);form.hidden=false;
  get('management').open=true;form.scrollIntoView?.({block:'nearest'});
  // Editor handlers are owned by the form and discarded with its fields.
  get('cancel').addEventListener('click',()=>{close();update();});
  get('remove').addEventListener('click',()=>attempt(()=>{
   if(externalPending)throw Error('다른 창의 변경을 먼저 확인하세요.');
   if(!host.confirm(`${station.name} 지상국을 삭제할까요?`))return;
   store.remove(id);close();message='지상국 삭제';
  }));
 }
 function save(event){
  event.preventDefault();attempt(()=>{
   if(externalPending)throw Error('다른 창의 변경과 충돌했습니다. 편집 내용을 보존했습니다.');
   const next={name:get('name').value,bands:model.BANDS.filter(band=>get('band-'+band).checked),enabled:get('enabled').checked};
   for(const field of numeric){const text=get(field).value.trim();next[field]=text===''?NaN:Number(text);}
   const errors=store.update(editorId,next);if(errors.length){message=errors.join(' ');return;}
   close();message='지상국 설정 저장';
  });
 }
 function reload(){attempt(()=>{
  if(editorId&&!host.confirm('편집 내용을 버리고 저장된 지상국을 다시 불러올까요?'))return;
  if(store.load()){externalPending=false;close();message='지상국 설정 다시 불러옴';network.clearNetwork();}
 });}
 async function calculate(){
  if(dead||busy)return;busy=true;message='SIM 상태 조회 및 네트워크 계산 중';update();
  try{
   if(externalPending||!store.ready)throw Error('지상국 설정을 확인하고 다시 불러오세요.');
   await refreshRuntime();if(dead)return;
   const result=await network.updateNetwork();if(dead)return;
   message=result?.status==='valid'?'모의 네트워크 계산 완료':result?.error||'UTC 또는 입력 변경으로 결과 미확인';page=0;
  }catch(error){if(!dead)message='노드 통신망 계산 오류: '+String(error.message);}
  finally{if(!dead){busy=false;update();}}
 }
 async function fabricAction(kind){
  if(dead||busy||!fabric)return;
  try{
   if(kind==='send'){
    const value=network.networkSnapshot();
    if(!store.ready||externalPending||value?.status!=='valid'||!network.verifyNetworkSnapshot(value))throw Error('현재 통신망을 먼저 계산하세요.');
    await fabric.send();
   }else if(kind==='refresh')await fabric.refresh();
   else await fabric.route(routeChoice.source,routeChoice.target,routeChoice.objective);
  }catch(error){message=String(error.message);}
  if(!dead)update();
 }
 async function rfLinkDraft(event){
  const button=event.target?.closest?.('button'),held=rfDetail;
  const current=()=>held&&rfDetail===held&&held.current()&&selection?.type==='link'&&selection.id===held.id&&button===get('detail-rf-draft')&&button.disabled!==true;
  if(button?.id!=='ground-node-detail-rf-draft'||typeof onRfLinkDraft!=='function'||!current())return;
  let revoked=false;
  const isCurrent=()=>{
   if(revoked)return false;
   try{
    if(!current()||!store.ready||externalPending)throw Error('RF draft view unavailable');
    const snapshot=held.sampled?network.networkSampledPresentation():network.networkSnapshot();
    if(!current()||snapshot?.status!=='valid'||JSON.stringify(snapshot)!==held.scope)throw Error('RF geometry changed');
    const verified=held.sampled?network.verifySampledNetworkPresentation(snapshot,{utc:snapshot.display_utc})===true:network.verifyNetworkSnapshot(snapshot)===true;
    if(!verified||!current()||!store.ready||externalPending)throw Error('RF geometry proof revoked');
    const link=snapshot.network.links.find(link=>link.id===held.id);if(!link||link.kind!=='ground'||JSON.stringify(link)!==held.link)throw Error('RF selected native link changed');
    return true;
   }catch{revoked=true;return false;}
  };
  try{
   if(!isCurrent())return;
   const link=structuredClone(held.nativeLink),context={analysis_utc:held.analysisUtc,display_utc:held.displayUtc,source:'native_geometry',isCurrent};
   if(!isCurrent())return;await onRfLinkDraft(link,context);isCurrent();
  }catch(error){if(current()){message=String(error?.message??error);update();}}
 }
 async function stationShortcut(event){
  const button=event.target?.closest?.('button'),action=button?.id==='ground-node-detail-focus'?'focus':button?.id==='ground-node-detail-edit'?'edit':null,held=stationDetail;
  const current=()=>held&&stationDetail===held&&held.current()&&selection?.type==='node'&&selection.id===held.id&&button===get('detail-'+action)&&button.disabled!==true;
  if(!action||!current())return;
  try{
   if(!store.ready||externalPending||!current())return;
   const snapshot=held.sampled?network.networkSampledPresentation():network.networkSnapshot();
   const verified=()=>held.sampled?network.verifySampledNetworkPresentation(snapshot,{utc:snapshot?.display_utc})===true:network.verifyNetworkSnapshot(snapshot)===true;
   if(!current()||snapshot?.status!=='valid'||JSON.stringify(snapshot)!==held.scope||!verified()||!current())return;
   const node=snapshot.network.nodes.find(item=>item.id===held.id);if(!node||node.kind!==held.kind)return;
   if(held.kind==='satellite'){
    if(action!=='focus'||typeof network.focusSourceNetworkNode!=='function'||network.canFocusSourceNetworkNode?.(held.id)!==true||!current()||!verified()||!current()||!store.ready||externalPending)return;
    await network.focusSourceNetworkNode(held.id);return;
   }
   const station=store.find(held.id);if(!station||!current()||JSON.stringify(station)!==JSON.stringify(snapshot.stations.find(item=>item.id===held.id)))return;
   if(action==='focus'&&network.canFocusGroundNetworkStation?.(held.id)!==true)return;
   if(!verified()||!current()||!store.ready||externalPending)return;
   if(action==='focus'){network.focusGroundNetworkStation?.(held.id);return;}
   // An already open editor is a user draft; detail navigation cannot replace it.
   if(editorId){message='현재 지상국 편집값을 먼저 저장하거나 취소하세요.';update();return;}
   open(held.id);update();
  }catch{/* Station editing/camera action requires the actual current displayed owner. */}
 }
 function linkEndpoint(event){
  const button=event.target?.closest?.('button'),side=button?.id==='ground-node-detail-select-a'?'a':button?.id==='ground-node-detail-select-b'?'b':null,held=linkDetail;
  const current=()=>held&&linkDetail===held&&held.current()&&selection?.type==='link'&&selection.id===held.id&&button===get('detail-select-'+side)&&button.disabled!==true;
  if(!side||!current())return;
  try{
   if(!store.ready||externalPending||!current())return;
   const snapshot=held.sampled?network.networkSampledPresentation():network.networkSnapshot();
   const verified=()=>held.sampled?network.verifySampledNetworkPresentation(snapshot,{utc:snapshot?.display_utc})===true:network.verifyNetworkSnapshot(snapshot)===true;
   if(!current()||snapshot?.status!=='valid'||JSON.stringify(snapshot)!==held.scope||!verified()||!current())return;
   const link=snapshot.network.links.find(link=>link.id===held.id),id=link?.[side];
   if(id!==held[side]||!snapshot.network.nodes.some(node=>node.id===id)||!verified()||!current())return;
   selection={type:'node',id};update();
  }catch{/* Read-only selection is unavailable when its displayed owner proof changed. */}
 }
 function routeShortcut(event){
  const button=event.target?.closest?.('button'),field=button?.id==='ground-node-detail-route-source'?'source':button?.id==='ground-node-detail-route-target'?'target':null;
  const held=routeDetail;
  const current=()=>held&&routeDetail===held&&held.current()&&!busy&&selection?.type==='node'&&selection.id===held.id&&button===get('detail-route-'+field)&&button.disabled!==true;
  if(!field||!current())return;
  try{
   const ready=()=>store.ready&&!externalPending;
   const accepted=value=>value?.status==='accepted'&&value.pending===false&&!value.error&&!value.refresh_required&&JSON.stringify(value.receipt)===held.receipt;
   if(!ready()||!current())return;
   const first=network.networkSnapshot();if(!current()||first?.status!=='valid'||JSON.stringify(first)!==held.scope||network.verifyNetworkSnapshot(first)!==true||!current())return;
   const state=fabric?.snapshot();if(!current()||!accepted(state))return;
   const fresh=network.networkSnapshot();if(!current()||JSON.stringify(fresh)!==held.scope||network.verifyNetworkSnapshot(fresh)!==true||!current())return;
   const latest=fabric.snapshot();if(!current()||!accepted(latest)||!ready()||!current())return;
   const node=fresh.network.nodes.find(node=>node.id===held.id);
   if(!node||field==='source'&&node.kind!=='satellite')return;
   const next={...routeChoice,[field]:held.id},ids=new Set(fresh.network.nodes.map(node=>node.id));
   if(network.verifyNetworkSnapshot(fresh)!==true||!current())return;
   routeChoice[field]=held.id;get('fabric-'+field).value=held.id;get('fabric-disclosure').open=true;
   if(ids.has(next.source)&&ids.has(next.target)&&next.source!==next.target)return fabricAction('route');
   update();
  }catch{/* Read/proof failure cannot turn historical details into a command. */}
 }
 function mount(){
  root=document.createElement('section');root.id='ground-node-network';root.className='panel';
  root.innerHTML='<header><h2>지상국과 통신망</h2></header><div class="body"><section class="gs-map-workspace"><div class="gs-map-column">'+stationMapBaseMarkup()+'<p id="ground-node-map-load" role="status"></p></div><aside class="gs-map-sidebar"><h3>한반도 지도 내 지상국</h3><div id="ground-node-map-list" class="gs-map-list"></div><div id="ground-node-map-selected"></div><div id="ground-node-map-actions" class="gs-map-actions"><button type="button" id="ground-node-map-edit">선택 지상국 설정</button><button type="button" id="ground-node-map-toggle">통신망 사용 변경</button></div><section class="gs-map-build"><h3>새 가상 지상국</h3><button type="button" id="ground-node-map-mode" aria-pressed="false">지도에서 위치 지정</button><div class="gs-map-coordinate"><label>위도 ° <input id="ground-node-map-lat" type="number" step="0.0001" min="-90" max="90" value="36.5"></label><label>경도 ° <input id="ground-node-map-lon" type="number" step="0.0001" min="-180" max="180" value="127.5"></label></div><button type="button" id="ground-node-map-locate">좌표로 후보 위치 확인</button><p id="ground-node-map-draft" role="status">후보 위치를 지정하세요.</p><button type="button" id="ground-node-map-add">선택 위치에 가상 지상국 추가</button></section></aside></section><details class="gs-map-catalog"><summary>공개 지상국 목록에서 선택</summary><div id="ground-node-station-browser"></div></details><details id="ground-node-management" class="gs-network-detail"><summary>지상국 목록 및 저장 관리</summary><p>기존 시험 지점을 추가하거나 저장한 지상국 설정을 관리합니다.</p><label>추가 지상국 <select id="ground-node-preset"></select></label><button type="button" id="ground-node-add">지상국 추가</button><label>편집 지상국 <select id="ground-node-select"></select></label><button type="button" id="ground-node-edit">선택 지상국 편집</button><button type="button" id="ground-node-reload">저장 설정 다시 불러오기</button><button type="button" id="ground-node-reset">기본 지상국으로 초기화</button><form id="ground-node-editor" class="form"></form></details><p id="ground-node-status" role="status"></p><details id="ground-node-analysis" class="gs-network-detail"><summary>배치 위성 통신 분석</summary><p>시험에 배치한 위성과 사용 지상국의 연결을 계산합니다. 안테나와 대역은 등록 설정을 사용하며 실제 교신 상태를 나타내지 않습니다.</p><button type="button" id="ground-node-calculate">현재 배치의 통신망 계산</button><div id="ground-node-overview"></div><p id="ground-node-summary" hidden></p><div id="ground-node-pass-tools"></div><details id="ground-node-contact-plan" class="gs-network-detail"><summary>정지 시각의 접촉 일정 상세 조회</summary><p>시험 재생을 정지한 시각부터 3시간의 전체 배치 통과 구간을 조회합니다. 자동 갱신 통과 예측과 달리 조회한 조건을 고정해 비교할 때 사용합니다.</p><label>표시 지상국 <select id="ground-node-pass-station"></select></label><button type="button" id="ground-node-pass-query">정지 시각부터 3시간 조회</button><button type="button" id="ground-node-pass-cancel">조회 취소</button><p id="ground-node-pass-status" role="status"></p><div id="ground-node-pass-results"></div><button type="button" id="ground-node-pass-prev">이전 통과</button><button type="button" id="ground-node-pass-next">다음 통과</button></details><div class="ground-scene-actions"><button type="button" id="ground-node-scene-links" aria-pressed="true">지상 링크 3D</button><button type="button" id="ground-node-scene-coverage" aria-pressed="true">지상국 가시 범위 3D</button></div><details class="gs-network-detail"><summary>시험 통신망 연결 계산 상세</summary><p id="ground-node-diagram-status"></p><div id="ground-node-diagram" style="max-height:420px;overflow:auto"></div><div id="ground-node-diagram-detail"></div><div id="ground-node-results"></div><button type="button" id="ground-node-prev">이전 링크</button><button type="button" id="ground-node-next">다음 링크</button></details></details></div>';
  document.getElementById('screen').prepend(root);close();
  if(futurePasses){
   const future=document.createElement('details');future.id='ground-node-future-pass-disclosure';future.className='gs-network-detail';future.innerHTML='<summary>자동 갱신 통과 예측</summary><p>표시 시각부터 3시간 동안 각 위성의 첫 3구간을 계산하고 빠른 12구간을 보여줍니다. 표시 시각과 선택 지상국에 따라 갱신합니다.</p><label>통과 지상국 <select id="ground-node-future-pass-station"></select></label><button type="button" id="ground-node-future-pass-refresh">통과 새로고침</button><p id="ground-node-future-pass-status" role="status"></p><div id="ground-node-future-pass-results" style="overflow:auto"></div>';
   get('pass-tools').append(future);
   listen(get('future-pass-station'),'change',()=>{futurePasses.selectStation(get('future-pass-station').value);update();});
   listen(get('future-pass-refresh'),'click',()=>{void futurePasses.refresh();update();});
  }
  const focusControls=document.createElement('section');focusControls.innerHTML='<button type="button" id="ground-node-focus" disabled>선택 지상국 초점</button>';get('map-actions').append(focusControls);const focusButton=get('focus');
  listen(focusButton,'click',()=>attempt(()=>{if(dead||view!=='ground'||focusButton.disabled||externalPending||!store.ready)return;if(network.focusGroundNetworkStation?.(store.selectedId)!==true)message='현재 표시된 지상국을 확인한 뒤 초점을 이동하세요.';}));
  const observation=document.createElement('details');observation.id='ground-node-diagnostics';observation.className='module-diagnostics';observation.innerHTML='<summary>통신 모듈 상태와 링크 품질 이력</summary><p id="ground-node-module-status" role="status"></p><p id="ground-node-quality-status" role="status"></p><canvas id="ground-node-quality-history" width="320" height="80" aria-label="선택 링크의 과거 모의 품질" hidden></canvas>';
  const controls=document.createElement('section');controls.id='ground-node-fabric';
  const fabricDisclosure=document.createElement('details');fabricDisclosure.id='ground-node-fabric-disclosure';fabricDisclosure.className='gs-network-detail';fabricDisclosure.innerHTML='<summary>통신 경로와 저장 후 전달 시험</summary>';fabricDisclosure.append(controls);
  controls.innerHTML='<p>계산된 통신망을 모의 통신 모듈에 전송해 경로를 비교합니다. 연결이 끊긴 동안 데이터를 저장했다가 전달하는 DTN 동작도 시험할 수 있습니다.</p><button type="button" id="ground-node-fabric-send">계산된 통신망 전송</button><button type="button" id="ground-node-fabric-refresh">모듈 상태 조회</button><p id="ground-node-fabric-status" role="status"></p><label>출발 노드 <select id="ground-node-fabric-source"></select></label><label>목적 노드 <select id="ground-node-fabric-target"></select></label><label>경로 목적 <select id="ground-node-fabric-objective"><option value="balanced">균형</option><option value="latency">지연 최소</option><option value="reliability">신뢰도</option></select></label><button type="button" id="ground-node-fabric-route">경로 조회</button><p id="ground-node-fabric-dtn"></p><div id="ground-node-fabric-results"></div><div id="ground-node-fabric-custody"></div><p id="ground-node-fabric-path"></p><div id="ground-node-fabric-hops"></div>';
  get('analysis').append(fabricDisclosure);get('analysis').append(observation);
  listen(get('scene-links'),'click',()=>{groundLinksVisible=!groundLinksVisible;networkScene?.setGroundLinksVisible(groundLinksVisible);get('scene-links').setAttribute('aria-pressed',String(groundLinksVisible));});
  listen(get('scene-coverage'),'click',()=>{coverageVisible=!coverageVisible;networkScene?.setCoverageVisible(coverageVisible);get('scene-coverage').setAttribute('aria-pressed',String(coverageVisible));});
  for(const event of ['click','keydown'])listen(get('diagram'),event,value=>{
   if(event==='keydown'&&!['Enter',' '].includes(value.key))return;
   const target=value.target?.closest?.('[data-diagram-node],[data-diagram-link]');if(!target)return;
   const node=target.getAttribute('data-diagram-node'),link=target.getAttribute('data-diagram-link');
   if(!node&&!link)return;value.preventDefault?.();selection={type:node?'node':'link',id:node||link};update();
  });
  listen(get('diagram-detail'),'click',event=>{const id=event.target?.closest?.('button')?.id;if(id==='ground-node-detail-rf-draft')return rfLinkDraft(event);if(['ground-node-detail-focus','ground-node-detail-edit'].includes(id))return stationShortcut(event);linkEndpoint(event);return routeShortcut(event);});
  const analytical=document.createElement('details');analytical.id='ground-node-fabric-analytical';analytical.innerHTML='<summary>이전 통신 계산 결과</summary><p id="ground-node-fabric-analytical-status"></p><div id="ground-node-fabric-analytical-results" style="max-height:22rem;overflow:auto"></div>';controls.append(analytical);
  for(const kind of ['send','refresh','route'])listen(get('fabric-'+kind),'click',()=>fabricAction(kind));
  for(const field of ['source','target','objective'])listen(get('fabric-'+field),'change',()=>{routeChoice[field]=get('fabric-'+field).value;update();});
  const selectMapStation=id=>attempt(()=>{if(externalPending||!store.ready)throw Error('지상국 설정을 먼저 확인하세요.');if(editorId&&editorId!==id)throw Error('현재 지상국 편집을 저장하거나 닫은 뒤 선택하세요.');mapOutsideSelected=id;store.select(id);});
  for(const area of ['map-markers','map-list'])listen(get(area),'click',event=>{const button=event.target?.closest?.('[data-map-station]');if(button)selectMapStation(button.getAttribute('data-map-station'));});
  listen(get('map-mode'),'click',()=>{mapAdding=!mapAdding;update();});
  if(mapDraft){get('map-lat').value=mapDraft.latitude.toFixed(4);get('map-lon').value=mapDraft.longitude.toFixed(4);}
  for(const field of ['map-lat','map-lon'])listen(get(field),'input',()=>{mapDraft=null;update();});
  listen(get('map'),'click',event=>{if(!mapAdding||event.target?.closest?.('button,a'))return;const rect=get('map').getBoundingClientRect();const point=koreaCoordinate((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);if(!point)return;mapDraft=point;get('map-lat').value=point.latitude.toFixed(4);get('map-lon').value=point.longitude.toFixed(4);update();});
  listen(get('map-locate'),'click',()=>{const lat=get('map-lat').value.trim(),lon=get('map-lon').value.trim();const point={latitude:lat===''?NaN:Number(lat),longitude:lon===''?NaN:Number(lon)};mapDraft=koreaPoint(point)?point:null;update();if(!mapDraft)get('map-draft').textContent='한반도 지도 범위 안의 위도와 경도를 입력하세요.';});
  listen(get('map-add'),'click',()=>attempt(()=>{if(!mapDraft||!koreaPoint(mapDraft))throw Error('후보 위치를 먼저 지정하세요.');if(externalPending||!store.ready)throw Error('다른 창의 변경을 먼저 확인하세요.');if(editorId)throw Error('현재 편집을 저장하거나 닫은 뒤 추가하세요.');const station=store.add({name:'',...mapDraft,enabled:true});mapDraft=null;mapAdding=false;open(station.id);message='가상 지상국 추가됨. 안테나와 통신 조건을 설정하세요.';}));
  listen(get('map-edit'),'click',()=>attempt(()=>{if(externalPending||!store.ready)throw Error('지상국 설정을 먼저 확인하세요.');if(editorId&&editorId!==store.selectedId)throw Error('현재 편집을 먼저 닫으세요.');open(store.selectedId);}));
  listen(get('map-toggle'),'click',()=>attempt(()=>{if(externalPending||!store.ready||editorId)throw Error('현재 편집이나 다른 창의 변경을 먼저 확인하세요.');const station=store.selected;if(station)store.setEnabled(station.id,!station.enabled);}));
  const tileStates=new Array(6).fill('pending');
  for(let i=0;i<6;i++)for(const event of ['load','error'])listen(get('map-tile-'+i),event,()=>{tileStates[i]=event;get('map-load').textContent=tileStates.includes('error')?'지도 배경을 불러오지 못했습니다. 좌표 입력과 지상국 목록은 사용할 수 있습니다.':tileStates.includes('pending')?'지도 불러오는 중':'';});
  listen(get('add'),'click',()=>attempt(()=>{if(externalPending)throw Error('다른 창의 변경을 먼저 확인하세요.');const preset=get('preset').value;const station=store.add(preset==='custom'?{name:'',latitude:37.5,longitude:127}:{preset});open(station.id);}));
  listen(get('select'),'change',()=>attempt(()=>{if(externalPending)throw Error('다른 창의 변경을 먼저 확인하세요.');store.select(get('select').value);if(!editorId)update();}));
  listen(get('edit'),'click',()=>attempt(()=>{if(externalPending)throw Error('다른 창의 변경을 먼저 확인하세요.');open(store.selectedId);}));
  listen(get('editor'),'submit',save);listen(get('reload'),'click',reload);
  listen(get('reset'),'click',()=>attempt(()=>{if(!host.confirm('현재 지상국 설정과 편집을 기본 세 지점으로 바꿀까요?'))return;store.reset();externalPending=false;close();message='기본 지상국 설정 저장';}));
  listen(get('pass-query'),'click',queryContacts);listen(get('pass-cancel'),'click',()=>{cancelContacts('통과 조회 취소 · 결과 미확인');update();});listen(get('pass-station'),'change',()=>{passStation=get('pass-station').value;passPage=0;update();});
  listen(get('pass-prev'),'click',()=>{passPage=Math.max(0,passPage-1);update();});listen(get('pass-next'),'click',()=>{passPage++;update();});
  listen(get('calculate'),'click',calculate);listen(get('prev'),'click',()=>{page=Math.max(0,page-1);update();});listen(get('next'),'click',()=>{page++;update();});
 }
 function update(){
  if(dead||view!=='ground')return;
  if(!root||document.getElementById(root.id)!==root){
   const replacing=root!==null,draft=pendingEditor(),ticket=paintGeneration;for(const remove of removers.splice(0))remove();root=null;editorId=null;
   if(replacing)futurePasses?.cancel();
   if(dead||view!=='ground')return;
   if(root!==null||paintGeneration!==ticket){restoreEditor(draft);return;}
   mapMarkersHtml=null;mapListHtml=null;mount();restoreEditor(draft);
  }
  const paintRoot=root,ticket=++paintGeneration,current=()=>!dead&&view==='ground'&&root===paintRoot&&paintGeneration===ticket;
  try{
  get('focus').disabled=true;
  const presets=store.availablePresets(),value=get('preset').value;
  const options=presets.map(p=>`<option value="${escape(p.key)}">${escape(p.name)} · ${escape(p.region)}</option>`).join('')+'<option value="custom">직접 입력 (위도·경도)</option>';
  if(get('preset').innerHTML!==options)get('preset').innerHTML=options;
  get('preset').value=presets.some(p=>p.key===value)||value==='custom'?value:presets[0]?.key??'custom';
  get('select').innerHTML='<option value="">지상국 선택</option>'+store.stations.map(s=>`<option value="${escape(s.id)}">${escape(s.name)} · ${s.enabled?'사용':'비활성'} · ${s.latitude}°/${s.longitude}° · ${s.min_elevation_deg}°</option>`).join('');get('select').value=store.selectedId??'';
  get('add').disabled=!store.ready||externalPending||store.stations.length>=24;get('edit').disabled=!store.ready||externalPending||!store.selectedId;
  get('calculate').disabled=busy||!store.ready||externalPending;
  if(externalPending)get('management').open=true;
  get('status').textContent=externalPending?'다른 창의 지상국 변경이 있습니다. 편집 내용을 보존했습니다. 확인 후 다시 불러오세요.':store.error||message||`지상국 ${store.stations.length}개 · ${store.persistence==='memory_only'?'메모리만 사용 · 영구 저장 없음':'저장 구성'}`;
  const configured=store.stations,storedSelected=store.selected,selected=storedSelected&&(koreaPoint(storedSelected)||mapOutsideSelected===storedSelected.id)?storedSelected:null;
  const markerHtml=stationMapMarkup(configured,store.selectedId,mapDraft),listHtml=configured.map(s=>({station:s,html:'<button type="button" data-map-station="'+escape(s.id)+'" aria-pressed="'+(s.id===store.selectedId)+'"><b>'+escape(s.name)+'</b><span>'+(!koreaPoint(s)?'지도 범위 밖 / ':'')+(s.enabled?'사용':'사용 안 함')+'</span></button>'})).reduce((result,item)=>{result[koreaPoint(item.station)?'domestic':'foreign']+=item.html;return result;},{domestic:'',foreign:''});
  const siteListHtml=listHtml.domestic+(listHtml.foreign?'<details class="gs-map-foreign"><summary>해외 지상국</summary>'+listHtml.foreign+'</details>':'');
  if(mapMarkersHtml!==markerHtml){mapMarkersHtml=markerHtml;get('map-markers').innerHTML=markerHtml;}if(mapListHtml!==siteListHtml){mapListHtml=siteListHtml;get('map-list').innerHTML=siteListHtml;}
  get('map-selected').innerHTML=stationStatusMarkup(selected);
  get('map-mode').setAttribute('aria-pressed',String(mapAdding));get('map-mode').textContent=mapAdding?'위치 지정 중 / 지도 클릭':'지도에서 위치 지정';get('map').classList[mapAdding?'add':'remove']('placing');
  get('map-draft').textContent=mapDraft?'후보 '+mapDraft.latitude.toFixed(4)+'° / '+mapDraft.longitude.toFixed(4)+'°':'후보 위치를 지정하세요.';
  get('map-add').disabled=!mapDraft||!store.ready||externalPending||configured.length>=24||!!editorId;
  get('map-edit').disabled=!selected||!store.ready||externalPending;get('map-toggle').disabled=!selected||!store.ready||externalPending||!!editorId;get('map-toggle').textContent=selected?.enabled?'이 지상국 사용 안 함':'이 지상국 통신망에 사용';
  const snapshot=network.networkSnapshot(),valid=store.ready&&!externalPending&&snapshot?.status==='valid'&&network.verifyNetworkSnapshot(snapshot);
  if(!current())return;
  let sampled=null;
  if(!valid&&hasSampled&&store.ready&&!externalPending){try{const value=network.networkSampledPresentation();if(!current())return;if(value?.presentation_kind==='NETWORK_SAMPLED_UI_V1'&&value.status==='valid'&&network.verifySampledNetworkPresentation(value,{utc:value.display_utc})===true)sampled=value;}catch{/* Unavailable authority is not a current network result. */}}
  if(!current())return;
  const visual=valid?snapshot:sampled,visualValid=valid||sampled!==null;
  const visualCurrent=()=>{try{return current()&&(sampled?network.verifySampledNetworkPresentation(sampled,{utc:sampled.display_utc})===true:!valid||network.verifyNetworkSnapshot(snapshot)===true)&&current();}catch{return false;}};
  try{
  if(!renderFabric(snapshot,valid,visual,visualValid,sampled!==null,visualCurrent)){if(current())clearSampledUi();return;}
  let focusReady=false;
  try{focusReady=store.ready&&!externalPending&&typeof store.selectedId==='string'&&network.canFocusGroundNetworkStation?.(store.selectedId)===true;}catch{/* Unverified station has no camera permission. */}
  if(!visualCurrent()){if(current())clearSampledUi();return;}get('focus').disabled=!focusReady;
  if(!visualCurrent()){if(current())clearSampledUi();return;}renderContacts();if(!visualCurrent()){if(current())clearSampledUi();return;}
  if(!renderObservations(visual,visualValid,visualCurrent)){if(current()){clearObservations();clearSampledUi();}return;}
  get('results').textContent='';get('results').innerHTML='';
  if(!visualValid){get('overview').innerHTML='<p role="status">'+escape(snapshot?.error||'현재 시각의 통신망 계산 결과 없음')+'</p>'; get('summary').textContent=snapshot?.error||'현재 UTC·입력의 검증된 노드 통신망 결과 없음';get('prev').disabled=true;get('next').disabled=true;return;}
  const links=visual.network.links;page=Math.min(page,Math.max(0,Math.ceil(links.length/50)-1));
  const rows=links.slice(page*50,(page+1)*50);
  get('summary').textContent=sampled?`분석 UTC ${sampled.analysis_utc} · 표시 UTC ${sampled.display_utc} · 분석 경과 ${Number(sampled.age_seconds).toFixed(3)} s · 현재 분석 ${sampled.current_analysis?'같은 시각':'미확인'}${sampled.availability==='pending'?' · 갱신 중':''} · 노드 ${visual.network.nodes.length}개 · 링크 ${links.length}개 · ${page+1}/${Math.max(1,Math.ceil(links.length/50))}페이지 · GMST/UTC 근사 · 공학 가정 · 현재 통신 품질·실제 RF 연결 미확인`:`표시 UTC ${snapshot.utc} · 노드 ${snapshot.network.nodes.length}개 · 링크 ${links.length}개 · ${page+1}/${Math.max(1,Math.ceil(links.length/50))}페이지 · GMST/UTC 근사 · 공학 가정 · 실제 RF 연결 미확인 · 모의 통신 결과는 아래에서 별도 조회`;
  get('overview').innerHTML=groundNetworkSummaryMarkup(visual,sampled,page);
  get('results').innerHTML='<table><thead><tr><th>링크</th><th>종류</th><th>모의 계산 기록</th></tr></thead><tbody>'+rows.map(link=>`<tr><td>${escape(link.id)}</td><td>${escape(link.kind)}</td><td><details><summary>단위·기하·상태 확인</summary><pre style="max-width:28rem;white-space:pre-wrap">${escape(JSON.stringify(link,null,2))}</pre></details></td></tr>`).join('')+'</tbody></table>';
  get('prev').disabled=page===0;get('next').disabled=(page+1)*50>=links.length;
  if(!visualCurrent()&&current())clearSampledUi();
  }catch(error){if(!sampled)throw error;if(current())clearSampledUi();}
  }finally{if(current())renderFuturePasses(current);if(current())renderAnalyticalFabric(current);if(current()&&analyticalDiagram){const proof=analyticalDiagram;if(!proof.verify()&&current()&&analyticalDiagram===proof)proof.fallback();}}
 }
 function clearAnalyticalFabric(){const rows=get('fabric-analytical-results'),label=get('fabric-analytical-status');if(rows)rows.innerHTML='';if(label)label.textContent='주기 통신 결과 미확인';}
 function renderAnalyticalFabric(current){
  clearAnalyticalFabric();if(!current()||view!=='ground'||!store.ready||externalPending||typeof fabric?.analyticalPresentation!=='function'||typeof fabric?.verifyAnalyticalPresentation!=='function')return;
  try{
   const value=fabric.analyticalPresentation();if(!current()||!value||value.presentation_kind!=='FABRIC_ANALYTICAL_UI_V1'||fabric.verifyAnalyticalPresentation(value)!==true||!current())return;
   const snapshot=network.networkSnapshot();if(!current())return;const receipt=value.receipt,summary=receipt?.summary,route=value.route;
   const label=`과거 분석 UTC ${value.analysis_utc} · 표시 UTC ${snapshot?.utc??'미확인'} · 모듈 ${receipt.instance_id} · 응답 ${receipt.sequence}${value.availability==='pending'?' · 갱신 중':''} · 현재 UTC 통신 승인·실제 RF 미확인`;
   const format=v=>Number.isFinite(v)?String(v):'미확인';
   const table=(heads,rows)=>'<table><thead><tr>'+heads.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+escape(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
   const html='<p>모의 DTN 저장 '+escape(format(summary?.stored_mb))+' MB · 누적 전달 '+escape(format(summary?.delivered_mb))+' MB · 누적 폐기 '+escape(format(summary?.dropped_mb))+' MB</p>'+
    table(['노드','모의 보관 상태','저장 MB','용량 MB','생성 Mbps','다음 홉'],(receipt.nodes??[]).map(n=>[n.id,diagram?.CUSTODY_LABELS?.[n.custody]??n.custody??'미확인',format(n.stored_mb),format(n.capacity_mb),format(n.generation_mbps),n.next_hop??'—']))+
    table(['링크','모의 품질 %','모의 사용 가능'],(receipt.links??[]).map(l=>[l.id,format(l.quality),l.usable===true?'가능':l.usable===false?'불가':'미확인']))+
    '<p>'+escape(route?.status==='available'?'모의 경로 '+(route.path??[]).join(' → ')+' · 지연 '+format(route.total_delay_ms)+' ms · 병목 '+format(route.bottleneck_mbps)+' Mbps · 신뢰도 '+format(route.reliability):'모의 경로 미확인')+'</p>'+
    table(['구간','링크','종류','지연 ms','용량 Mbps','모의 품질 %'],(route?.hop_list??[]).map(h=>[h.from+' → '+h.to,h.link_id,diagram?.LINK_KIND_LABELS?.[h.kind]??h.kind,format(h.delay_ms),format(h.capacity_mbps),format(h.quality)]));
   if(fabric.verifyAnalyticalPresentation(value)!==true||!current())return;get('fabric-analytical-status').textContent=label;get('fabric-analytical-results').innerHTML=html;
   if(fabric.verifyAnalyticalPresentation(value)!==true&&current())clearAnalyticalFabric();
  }catch{if(current())clearAnalyticalFabric();}
 }
 function clearFuturePasses(){
  const rows=get('future-pass-results'),status=get('future-pass-status');if(rows)rows.innerHTML='';if(status)status.textContent='배치·지상국·표시 UTC의 통과 결과 미확인 · 실제 RF 미확인';
 }
 function renderFuturePasses(current){
  if(!futurePasses||!current())return;
  const stations=store.enabled,select=get('future-pass-station'),refresh=get('future-pass-refresh');if(!select||!refresh)return;
  const available=store.ready&&!externalPending;
  select.innerHTML=stations.map(s=>'<option value="'+escape(s.id)+'">'+escape(s.name)+'</option>').join('');select.disabled=!available||!stations.length;refresh.disabled=!available||!stations.length;
  clearFuturePasses();
  try{
   const diagnostic=futurePasses.snapshot();if(!current())return;
   select.value=stations.some(s=>s.id===diagnostic?.station_id)?diagnostic.station_id:stations[0]?.id??'';
   const value=futurePasses.presentation();if(!current())return;
   if(!available||value?.presentation_kind!=='FUTURE_PASSES_UI_V1'||value.status!=='valid'||futurePasses.verifyPresentation(value)!==true||!current()){
    if(current()&&available)get('future-pass-status').textContent=diagnostic?.status==='pending'?'전체 배치의 native 통과 조회 중 · 실제 RF 미확인':'통과 결과 미확인 · 실제 RF 미확인';return;
   }
   select.value=value.station.id;
   get('future-pass-status').textContent=`분석 UTC ${value.analysis_utc} → ${value.end_utc} · 표시 UTC ${value.display_utc} · 분석 경과 ${Number(value.age_seconds).toFixed(3)} s${value.availability==='pending'?' · 갱신 중':''} · 전체 배치 ${value.satellite_count}기 · ${value.station.name} · 고각 마스크 ${value.station.min_elevation_deg}° · ${value.coverage.resolution_seconds}초 탐색 · 짧은 구간 누락 가능 · 모의 기하 · 실제 RF 미확인`;
   get('future-pass-results').innerHTML=value.rows.length?'<table><thead><tr><th>위성</th><th>AOS UTC</th><th>LOS UTC</th><th>최대 고각 °</th><th>지속 s</th><th>구간 상태</th></tr></thead><tbody>'+value.rows.map(row=>'<tr>'+[row.name||row.satellite,row.start,row.end,row.max_elevation_deg,row.duration_seconds,[row.live?'현재 통과':'',row.truncated?'조회 범위에서 잘림':''].filter(Boolean).join(' · ')||'예측 통과'].map(cell=>'<td>'+escape(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p>조회 범위에서 고각 마스크 위 통과 없음 · RF 연결 상태는 미확인입니다.</p>';
   const verified=futurePasses.verifyPresentation(value)===true;if(!current())return;if(!verified)clearFuturePasses();
  }catch{if(current())clearFuturePasses();}
 }
 function renderFabric(snapshot,valid,visual=snapshot,visualValid=valid,sampled=false,current=()=>true){
  const state=fabric?.snapshot();if(!current())return false;
  const pending=state?.pending===true,receipt=valid?state?.receipt:null;
  get('fabric-send').disabled=!fabric||!valid||busy||pending||state.refresh_required;
  get('fabric-send').textContent=state?.retry_available?'동일 요청 재시도':'계산된 통신망 전송';
  get('fabric-refresh').disabled=!fabric||pending||busy;
  const nodes=visualValid?visual.network.nodes:[],options='<option value="">노드 선택</option>'+nodes.map(node=>`<option value="${escape(node.id)}">${escape(node.name||node.id)}</option>`).join('');
  get('fabric-route').disabled=!receipt||pending||busy||!nodes.some(node=>node.id===routeChoice.source)||!nodes.some(node=>node.id===routeChoice.target);
  for(const field of ['source','target']){const select=get('fabric-'+field);if(select.innerHTML!==options)select.innerHTML=options;select.value=nodes.some(node=>node.id===routeChoice[field])?routeChoice[field]:'';}
  get('fabric-objective').value=routeChoice.objective;
  get('fabric-status').textContent=pending?'통신 모듈 요청 중':state?.error|| (receipt?`모의 통신망 수락 · UTC ${snapshot.utc} · 응답 번호 ${receipt.sequence}`:'현재 통신망 미전송 · 통신 결과 미확인');
  const format=value=>Number.isFinite(value)?String(value):'미확인',summary=receipt?.summary;
  get('fabric-dtn').textContent=summary?`모의 DTN 저장 ${format(summary.stored_mb)} MB · 누적 전달 ${format(summary.delivered_mb)} MB · 누적 폐기 ${format(summary.dropped_mb)} MB · 계산 간격 ${format(receipt.elapsed_s)} s`:'현재 통신망의 DTN 결과 미확인';
  const links=receipt?.links??[];
  get('fabric-results').innerHTML=receipt?'<table><thead><tr><th>링크</th><th>모의 품질 (%)</th><th>모의 사용 가능</th></tr></thead><tbody>'+links.slice(page*50,(page+1)*50).map(link=>`<tr><td>${escape(link.id)}</td><td>${escape(format(link.quality))}</td><td>${link.usable===true?'가능':link.usable===false?'불가':'미확인'}</td></tr>`).join('')+'</tbody></table>':'';
  const route=receipt?state.route:null;
  const name=id=>nodes.find(node=>node.id===id)?.name||id||'미확인';
  // Accepted custody and route rows are bounded by their owners, independently of contact paging.
  const table=(heads,rows)=>'<div style="max-height:22rem;overflow:auto"><table><thead><tr>'+heads.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+escape(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  get('fabric-custody').innerHTML=receipt?table(['노드','모의 보관 상태','보관 MB','용량 MB','생성 Mbps','다음 홉'],(receipt.nodes??[]).map(node=>[name(node.id),diagram?.CUSTODY_LABELS?.[node.custody]||node.custody||'미확인',format(node.stored_mb),format(node.capacity_mb),format(node.generation_mbps),node.next_hop?name(node.next_hop):'—'])):'';
  get('fabric-hops').innerHTML=route?.status==='available'?table(['#','구간','종류','지연 ms','용량 Gbps','품질 %'],(route.hop_list??[]).map((hop,index)=>[index+1,name(hop.from)+' → '+name(hop.to),diagram?.LINK_KIND_LABELS?.[hop.kind]||hop.kind,format(hop.delay_ms),Number.isFinite(hop.capacity_mbps)?format(hop.capacity_mbps/1000):'미확인',format(hop.quality)])):'';
  if(!renderDiagram(visual,visualValid,receipt,route,sampled,current,state)||!current())return false;
  get('scene-links').disabled=!networkScene||!visualValid;get('scene-links').setAttribute('aria-pressed',String(groundLinksVisible));
  get('scene-coverage').disabled=!networkScene||!visualValid;get('scene-coverage').setAttribute('aria-pressed',String(coverageVisible));
  if(visualValid&&networkScene){networkScene.setGroundLinksVisible(groundLinksVisible);if(!current())return false;networkScene.setCoverageVisible(coverageVisible);if(!current())return false;if(valid){networkScene.setSnapshot({snapshot,receipt,route,selectedLinkId:selection?.type==='link'?selection.id:null});if(!current())return false;}}else if(!hasSampled){networkScene?.clear();if(!current())return false;}
  get('fabric-path').textContent=route?route.status==='available'?`모의 경로 ${(route.path??[]).join(' → ')} · 지연 ${format(route.total_delay_ms)} ms · 병목 ${format(route.bottleneck_mbps)} Mbps · 신뢰도 ${format(route.reliability)}`:'현재 통신망에서 사용 가능한 모의 경로 없음':'현재 통신망의 경로 결과 미확인';
  return current();
 }
 function cancelContacts(error=''){
  passGeneration++;passAbort?.abort();passAbort=null;passBusy=false;passReceipt=null;passError=error;
 }
 async function queryContacts(){
  if(dead||passBusy||!contactWindows)return;
  cancelContacts();const generation=passGeneration,abort=new AbortController();passAbort=abort;passBusy=true;update();
  try{
   if(externalPending||!store.ready)throw Error('지상국 설정을 먼저 확인하세요.');
   await refreshRuntime();if(dead||generation!==passGeneration||abort.signal.aborted)return;
   const result=await contactWindows.query({hours:3,signal:abort.signal});
   if(dead||view!=='ground'||generation!==passGeneration||abort.signal.aborted)return;
   if(!contactWindows.verify(result))throw Error('native 통과 입력이 변경되었습니다. 배치와 UTC를 확인하세요.');
   passReceipt=structuredClone(result);passPage=0;
  }catch(error){if(!dead&&generation===passGeneration){passReceipt=null;passError=String(error.message);}}
  finally{if(!dead&&generation===passGeneration){passBusy=false;passAbort=null;update();}}
 }
 function renderContacts(){
  const stations=store.enabled,options=stations.map(s=>'<option value="'+escape(s.id)+'">'+escape(s.name)+'</option>').join('');
  if(!stations.some(s=>s.id===passStation))passStation=stations[0]?.id??'';
  get('pass-station').innerHTML=options;get('pass-station').value=passStation;
  get('pass-query').disabled=!contactWindows||passBusy||!store.ready||externalPending||!stations.length;get('pass-cancel').disabled=!passBusy;
  if(passReceipt){try{if(!contactWindows?.verify(passReceipt)){passReceipt=null;passError='배치·지상국·UTC 또는 승인 조건 변경 · 통과 결과 미확인';}}catch{passReceipt=null;passError='native 승인 상태 미확인';}}
  get('pass-results').innerHTML='';get('pass-prev').disabled=true;get('pass-next').disabled=true;
  if(!passReceipt){get('pass-status').textContent=passBusy?'원본 native 통과 조회 중 · 이전 결과 미확인':passError||'명시적 조회 전 통과 결과 미확인';return;}
  const report=passReceipt.contact_reports.find(r=>r.station_id===passStation),rows=[...(report?.geometry.passes??[])].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||String(a.satellite).localeCompare(String(b.satellite))),names=new Map(passReceipt.node_definitions.map(n=>[n.id,n.name||n.id]));
  passPage=Math.min(passPage,Math.max(0,Math.ceil(rows.length/50)-1));get('pass-prev').disabled=passPage===0;get('pass-next').disabled=(passPage+1)*50>=rows.length;
  get('pass-status').textContent=`모의 기하 · 승인 UTC ${passReceipt.accepted_context.utc} → ${passReceipt.conditions.end_utc} · 전체 수락 배치 ${passReceipt.node_definitions.length}기 · 선택 지상국 ${rows.length}구간 · ${passPage+1}/${Math.max(1,Math.ceil(rows.length/50))}페이지 · 원본 ${report?.geometry.coverage.resolution_seconds??'미확인'}초 탐색 · 짧은 구간 누락 가능 · 실제 RF 미확인`;
  get('pass-results').innerHTML=rows.length?'<table><thead><tr><th>위성</th><th>AOS UTC</th><th>LOS UTC</th><th>최대 고각 °</th><th>지속 s</th><th>구간 상태</th></tr></thead><tbody>'+rows.slice(passPage*50,(passPage+1)*50).map(row=>'<tr>'+[names.get(row.satellite)||row.satellite,row.start,row.end,row.max_elevation_deg,Number.isFinite(row.duration_seconds)?row.duration_seconds:(Date.parse(row.end)-Date.parse(row.start))/1000,[row.in_progress?'이미 진행 중':'',row.truncated?'조회 범위에서 잘림':''].filter(Boolean).join(' · ')||'구간 완료'].map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p>조회한 범위에서 마스크 위 통과 없음 · RF 연결 상태를 뜻하지 않습니다.</p>';
 }
 function renderDiagram(snapshot,valid,receipt,route,sampled=false,current=()=>true,fabricState=null,allowHistorical=true){
  if(!current())return false;
  routeDetail=null;linkDetail=null;stationDetail=null;analyticalDiagram=null;rfDetail=null;
  get('diagram').innerHTML='';get('diagram-detail').innerHTML='';
  get('diagram-status').textContent=!valid?'현재 UTC·입력의 연결도 미확인':!diagram?'연결도 표시 모듈 미확인':sampled?`분석 UTC ${snapshot.analysis_utc} · 표시 UTC ${snapshot.display_utc} · 통신 품질·보관 상태·현재 경로 미확인 · 공학 가정`:receipt?'모의 연결 구조 · 지리적 위치 아님 · 움직이는 선은 실측 패킷이 아님':'검증된 native 기하 · 통신 품질·보관 상태·현재 경로 미확인 · 현재 통신 승인·실제 RF 미확인';
  if(!valid||!diagram)return current();
  const nodes=snapshot.network.nodes,ids=new Set(nodes.map(node=>node.id));
  const layout=diagram.layoutNetwork({compactGround:true,satellites:(snapshot.node_definitions??[]).filter(node=>ids.has(node.id)).map(node=>({id:node.id,name:node.name,raan:node.orbit?.raan,meanAnomaly:node.orbit?.mean_anomaly,formation:node.formation})),stations:(snapshot.stations??[]).filter(station=>station.enabled&&ids.has(station.id))});
  if(!current())return false;
  let historical=null;
  const nativeInputs=value=>JSON.stringify(Object.fromEntries(Object.entries(value??{}).filter(([key])=>!['utc','network','presentation_kind','analysis_utc','display_utc','age_seconds','availability','current_analysis','reason'].includes(key))));
  const fullHistoricalScope=value=>sampled||nativeInputs(value?.native_snapshot)===nativeInputs(snapshot);
  const utc=sampled?snapshot.display_utc:snapshot.utc;
  const historicalCurrent=()=>{
   try{return current()&&historical!==null&&fullHistoricalScope(historical)&&historical.fabric_view===fabric.analyticalPresentation()&&current()&&fabric.verifyAnalyticalPresentation(historical.fabric_view)===true&&current()&&network.verifyAnalyticalRoute(historical,{utc,nodes:snapshot.node_definitions})===true&&current();}catch{return false;}
  };
  if(allowHistorical&&typeof network.readAnalyticalRoute==='function'&&typeof network.verifyAnalyticalRoute==='function'&&typeof fabric?.analyticalPresentation==='function'&&typeof fabric?.verifyAnalyticalPresentation==='function'){
   try{const value=network.readAnalyticalRoute({utc});if(current()&&value?.presentation_kind==='MIXED_ROUTE_ANALYTICAL_UI_V1'&&value.display_utc===utc&&value.source==='captured_native_analysis'&&JSON.stringify(value.node_definitions)===JSON.stringify(snapshot.node_definitions)&&fullHistoricalScope(value)){historical=value;if(!historicalCurrent())historical=null;}}catch{historical=null;}
   if(!current())return false;
  }
  const visualReceipt=historical?historical.fabric_view.receipt:receipt;
  const reports=new Map((visualReceipt?.links??[]).map(link=>[link.id,link]));
  const captured=new Map((historical?.native_snapshot?.network?.links??[]).map(link=>[link.id,link]));
  const sameLink=(link,other)=>other&&link.kind===other.kind&&link.a===other.a&&link.b===other.b;
  // Historical module verdicts are only shown on existing, identically scoped native links.
  const nativeLinks=snapshot.network.links.filter(link=>link.kind!=='ground'||link.state!=='no_radio');
  const links=historical?nativeLinks.filter(link=>reports.has(link.id)&&sameLink(link,captured.get(link.id))).map(link=>({...link,...reports.get(link.id),id:link.id,a:link.a,b:link.b,kind:link.kind})):receipt?nativeLinks.filter(link=>reports.has(link.id)).map(link=>({...link,...reports.get(link.id)})):nativeLinks;
  const states=new Map((visualReceipt?.nodes??[]).filter(node=>ids.has(node.id)).map(node=>[node.id,{tone:node.kind==='ground'?(node.serving?.length?'ok':'neutral'):node.ground_path?'ok':node.custody==='full'?'danger':node.custody?'warning':'neutral',title:diagram.CUSTODY_LABELS?.[node.custody]||node.custody||'미확인',badge:Number.isFinite(node.stored_mb)&&node.stored_mb>0?node.stored_mb+' MB':''}]));
  const routeLinkIds=new Set(historical?(historical.routed_ids??[]).filter(id=>links.some(link=>link.id===id)):route?.status==='available'?(route.hop_list??[]).map(hop=>hop.link_id):[]);
  const fallback=()=>renderDiagram(snapshot,valid,receipt,route,sampled,current,fabricState,false);
  if(historical&&!historicalCurrent())return current()?fallback():false;
  const selected=selection&&((selection.type==='link'&&links.some(link=>link.id===selection.id))||(selection.type==='node'&&ids.has(selection.id)))?selection:null;
  const markup=diagram.diagramMarkup(layout,links,{selected,routeLinkIds,nodeStates:states,showLabels:true,flowTimeSeconds:Number.isFinite(visualReceipt?.elapsed_s)?visualReceipt.elapsed_s:0,...!historical&&!receipt?{unverifiedAnalysis:true}:{}});
  if(!current())return false;if(historical&&!historicalCurrent())return current()?fallback():false;get('diagram').innerHTML=markup;
  if(historical){get('diagram-status').textContent=`과거 분석 UTC ${historical.analysis_utc} · 표시 UTC ${historical.display_utc} · 분석 경과 ${Number(historical.age_seconds).toFixed(3)} s${historical.fabric_view.availability==='pending'?' · 갱신 중':''} · 현재 기하와 일치하는 과거 모의 품질·보관·경로 · 현재 통신 승인·실제 RF 미확인`;analyticalDiagram={verify:historicalCurrent,fallback};}
  if(selected){
   const record=selected.type==='link'?{...links.find(link=>link.id===selected.id)}:{definition:(snapshot.node_definitions??[]).find(node=>node.id===selected.id)||(snapshot.stations??[]).find(node=>node.id===selected.id),fabric:(visualReceipt?.nodes??[]).find(node=>node.id===selected.id)??null};
   if(historical&&selected.type==='link'){record.current_geometry=snapshot.network.links.find(link=>link.id===selected.id);record.captured_module=reports.get(selected.id)??null;}
   if(historical)record.historical_analysis={source:historical.source,analysis_utc:historical.analysis_utc,display_utc:historical.display_utc,age_seconds:historical.age_seconds,current_communication_approval:false};
   get('diagram-detail').innerHTML='<h4>선택한 모의 '+(selected.type==='link'?'링크':'노드')+'</h4><details><summary>선택 항목의 계산 자료</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+escape(JSON.stringify(record,null,2))+'</pre></details>';
   if(selected.type==='link'){
    const endpoints=['a','b'].filter(side=>typeof record?.[side]==='string'&&ids.has(record[side]));
    get('diagram-detail').innerHTML+='<div>'+endpoints.map(side=>'<button type="button" id="ground-node-detail-select-'+side+'">'+escape(side.toUpperCase()+' 노드 선택 · '+record[side])+'</button>').join('')+'</div>';
    if(!current())return false;
    linkDetail={id:selected.id,a:record.a,b:record.b,current,sampled,scope:JSON.stringify(snapshot)};
    const nativeLink=snapshot.network.links.find(link=>link.id===selected.id);
    if(nativeLink?.kind==='ground'&&typeof onRfLinkDraft==='function'){
     const analysisUtc=sampled?snapshot.analysis_utc:snapshot.utc,displayUtc=sampled?snapshot.display_utc:snapshot.utc;
     get('diagram-detail').innerHTML+='<div><button type="button" id="ground-node-detail-rf-draft">이 지상 링크의 native 조건을 RF 초안에 적용</button><small>입력 계산 UTC '+escape(analysisUtc)+' · 표시 UTC '+escape(displayUtc)+' · 대표 장비 가정 · 적용 후 직접 계산 · 실제 RF 미확인</small></div>';
     if(!current())return false;
     get('detail-rf-draft').disabled=!store.ready||externalPending;
     rfDetail={id:selected.id,current,sampled,scope:JSON.stringify(snapshot),link:JSON.stringify(nativeLink),nativeLink:structuredClone(nativeLink),analysisUtc,displayUtc};
    }

   }
   if(selected.type==='node'){
    const node=nodes.find(node=>node.id===selected.id),fields=node?.kind==='satellite'?['source','target']:node?.kind==='ground'?['target']:[];
    const ready=!sampled&&receipt&&fabricState?.status==='accepted'&&fabricState.pending===false&&!fabricState.error&&!fabricState.refresh_required&&!busy&&store.ready&&!externalPending;
    if(!current())return false;
    get('diagram-detail').innerHTML+='<div>'+fields.map(field=>'<button type="button" id="ground-node-detail-route-'+field+'">'+(field==='source'?'여기서 출발':'여기로 도착')+'</button>').join('')+'</div>';
    for(const field of fields)get('detail-route-'+field).disabled=!ready;
    if(ready)routeDetail={id:selected.id,current,scope:JSON.stringify(snapshot),receipt:JSON.stringify(receipt)};
    if(node?.kind==='satellite'&&typeof network.canFocusSourceNetworkNode==='function'&&typeof network.focusSourceNetworkNode==='function'){
     let focusReady=false;try{focusReady=store.ready&&!externalPending&&network.canFocusSourceNetworkNode(selected.id)===true;}catch{}
     if(!current())return false;
     get('diagram-detail').innerHTML+='<div><button type="button" id="ground-node-detail-focus">뷰 정렬</button></div>';
     get('detail-focus').disabled=!focusReady;
     stationDetail={id:selected.id,kind:node.kind,current,sampled,scope:JSON.stringify(snapshot)};
    }
    if(node?.kind==='ground'){
     let focusReady=false;try{focusReady=store.ready&&!externalPending&&network.canFocusGroundNetworkStation?.(selected.id)===true;}catch{}
     if(!current())return false;
     get('diagram-detail').innerHTML+='<div><button type="button" id="ground-node-detail-focus">뷰 정렬</button><button type="button" id="ground-node-detail-edit">편집</button></div>';
     get('detail-focus').disabled=!focusReady;get('detail-edit').disabled=!store.ready||externalPending;
     stationDetail={id:selected.id,kind:node.kind,current,sampled,scope:JSON.stringify(snapshot)};
    }
    // Appending detail controls reparses markup, so restore action gating on final DOM nodes.
    for(const field of fields)get('detail-route-'+field).disabled=!ready;

   }
  }
  if(historical&&!historicalCurrent())return current()?fallback():false;
  return current();
 }
 const unsubscribe=store.subscribe(()=>{routeDraftGeneration++;let next=null;try{next=stationInputs();}catch{/* Failed config revokes old geometry. */}const changed=next===null||next!==stationInputSignature;stationInputSignature=next;if(changed){cancelContacts();network.clearNetwork();void futurePasses?.observe?.();}update();});
 const external=event=>{
  if(dead||event.key!=='spacetwin-ground-stations-v1')return;cancelContacts();
  if(editorId||mapDraft){externalPending=true;network.clearNetwork();void futurePasses?.observe?.();update();}
  else{store.load();network.clearNetwork();void futurePasses?.observe?.();update();}
 };
 host.addEventListener('storage',external);
 function show(next){
  if(dead)return;paintGeneration++;const ticket=++viewGeneration;view=next;
  const current=()=>!dead&&view===next&&viewGeneration===ticket;
  if(next!=='ground'){
   futurePasses?.setActive(false);if(!current())return;clearFuturePasses();clearAnalyticalFabric();stopStatusPolling();if(!current())return;
   clearObservations();cancelContacts();if(!current())return;
   networkScene?.setActive?.(false);if(!current())return;networkScene?.clear();if(!current())return;clearSampledUi();
  }else{
   networkScene?.setActive?.(true);if(!current())return;futurePasses?.setActive(true);if(!current())return;
  }
  update();if(current()&&next==='ground')startStatusPolling();
 }
 return Object.freeze({show,update,adoptRouteDraft,routeRequest:()=>Object.freeze({...routeChoice}),selectedLinkId:()=>!dead&&selection?.type==='link'?selection.id:null,hasExternalChange:()=>externalPending,
  destroy(){if(dead)return;paintGeneration++;dead=true;futurePasses?.setActive(false);clearFuturePasses();clearAnalyticalFabric();stopStatusPolling();clearObservations();clearSampledUi();cancelContacts();networkScene?.setActive?.(false);networkScene?.clear();unsubscribe();host.removeEventListener('storage',external);for(const remove of removers.splice(0))remove();root?.remove();root=null;}});
}

export function groundNetworkSummaryMarkup(visual,sampled=null,page=0){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const nodes=visual.network.nodes,links=visual.network.links,stations=nodes.filter(n=>n.kind==='ground').length;
 const card=(label,value)=>`<div class="overview-metric"><span>${label}</span><strong>${value}</strong></div>`;
 const time=(label,utc)=>`<div class="ground-analysis-time"><span>${label}</span><time datetime="${esc(utc)}" title="${esc(utc)}">${esc(String(utc??'미확인').replace('T',' ').slice(0,19))} UTC</time></div>`;
 return `<div class="ground-network-overview"><div class="overview-heading"><span class="overview-badge">시험용 통신망</span><span>모든 활성 지상국 간 연결 가정</span><span>실제 RF 미확인</span><details class="ground-network-info"><summary aria-label="통신망 계산 설명">i</summary><p>위성 수와 지상국 수는 현재 표시 자료의 구성입니다. 지상국 사이는 모든 쌍을 연결하고 10 Gbps를 가정합니다. 실제 회선 계약이나 접속 상태를 조회한 결과가 아닙니다. 위성 연결은 위치, 최소 고각과 지원 대역으로 계산하며 실제 교신 성공 수가 아닙니다. GMST/UTC 근사와 대표 장비 가정을 사용합니다. 품질과 전송 결과는 통신 모듈 조회에서 확인합니다.</p></details></div><div class="overview-metrics">${card('표시 위성',nodes.length-stations)}${card('지상국',stations)}${card('계산 연결',links.length)}</div>${time('표시 시각',sampled?.display_utc??visual.utc)}${sampled?time('분석 기준',sampled.analysis_utc)+`<div>분석 경과 ${Number(sampled.age_seconds).toFixed(3)} s / ${sampled.current_analysis?'현재 시각과 일치':'이전 분석'}${sampled.availability==='pending'?' / 갱신 중':''}</div>`:''}<small>연결 목록 ${page+1} / ${Math.max(1,Math.ceil(links.length/50))} 페이지</small></div>`;
}
