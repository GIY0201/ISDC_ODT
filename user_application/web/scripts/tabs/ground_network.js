import {createGroundStationEditorTools} from './ground_station_editor.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=['latitude','longitude','altitude_km','dish_m','min_elevation_deg'];
// Reuses original ground store and station editor; no native/clock/Viewer/transport owner.
export function createGroundNetworkPanel({store,model,network,fabric=null,document,host,refreshRuntime}={}) {
 let root=null,view=null,dead=false,editorId=null,externalPending=false,message='',busy=false,page=0;
 const editor=createGroundStationEditorTools({model,escape}),removers=[];
 const routeChoice={source:'',target:'',objective:'balanced'};
 const get=id=>root?.querySelector('#ground-node-'+id);
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
 function mount(){
  root=document.createElement('section');root.id='ground-node-network';root.className='panel';
  root.innerHTML='<header><h2>노드 통신망과 지상국 편집</h2></header><div class="body"><p>선배 프로토타입의 지상국 설정과 Kepler+J2 통신 기하입니다. 안테나·대역은 대표 설정이며 실제 수신 미확인입니다. 저장 궤도 RF/접촉 계획과 별개입니다. 계산 전 표시 시계를 정지하면 같은 UTC의 결과를 확인할 수 있습니다.</p><label>추가 지상국 <select id="ground-node-preset"></select></label><button type="button" id="ground-node-add">지상국 추가</button><label>편집 지상국 <select id="ground-node-select"></select></label><button type="button" id="ground-node-edit">선택 지상국 편집</button><button type="button" id="ground-node-reload">저장 설정 다시 불러오기</button><button type="button" id="ground-node-reset">기본 지상국으로 초기화</button><form id="ground-node-editor" class="form"></form><p id="ground-node-status" role="status"></p><button type="button" id="ground-node-calculate">SIM 상태 조회 후 노드 통신망 계산</button><p id="ground-node-summary"></p><div id="ground-node-results"></div><button type="button" id="ground-node-prev">이전 링크</button><button type="button" id="ground-node-next">다음 링크</button></div>';
  document.getElementById('screen').prepend(root);close();
  const controls=document.createElement('section');controls.id='ground-node-fabric';
  controls.innerHTML='<h3>모의 통신 경로와 DTN</h3><p>선배 프로토타입의 통신 모듈에 계산된 통신망을 명시적으로 전송합니다. DTN은 연결이 없을 때 데이터를 저장했다가 전달하는 모의 계산이며 실제 패킷·장비 전송은 미확인입니다.</p><button type="button" id="ground-node-fabric-send">계산된 통신망 전송</button><button type="button" id="ground-node-fabric-refresh">모듈 상태 조회</button><p id="ground-node-fabric-status" role="status"></p><label>출발 노드 <select id="ground-node-fabric-source"></select></label><label>목적 노드 <select id="ground-node-fabric-target"></select></label><label>경로 목적 <select id="ground-node-fabric-objective"><option value="balanced">균형</option><option value="latency">지연 최소</option><option value="reliability">신뢰도</option></select></label><button type="button" id="ground-node-fabric-route">경로 조회</button><p id="ground-node-fabric-dtn"></p><div id="ground-node-fabric-results"></div><p id="ground-node-fabric-path"></p>';
  (root.querySelector('.body')||root).append(controls);
  for(const kind of ['send','refresh','route'])listen(get('fabric-'+kind),'click',()=>fabricAction(kind));
  for(const field of ['source','target','objective'])listen(get('fabric-'+field),'change',()=>{routeChoice[field]=get('fabric-'+field).value;update();});
  listen(get('add'),'click',()=>attempt(()=>{if(externalPending)throw Error('다른 창의 변경을 먼저 확인하세요.');const preset=get('preset').value;const station=store.add(preset==='custom'?{name:'',latitude:37.5,longitude:127}:{preset});open(station.id);}));
  listen(get('select'),'change',()=>attempt(()=>{if(externalPending)throw Error('다른 창의 변경을 먼저 확인하세요.');store.select(get('select').value);if(!editorId)update();}));
  listen(get('edit'),'click',()=>attempt(()=>{if(externalPending)throw Error('다른 창의 변경을 먼저 확인하세요.');open(store.selectedId);}));
  listen(get('editor'),'submit',save);listen(get('reload'),'click',reload);
  listen(get('reset'),'click',()=>attempt(()=>{if(!host.confirm('현재 지상국 설정과 편집을 기본 세 지점으로 바꿀까요?'))return;store.reset();externalPending=false;close();message='기본 지상국 설정 저장';}));
  listen(get('calculate'),'click',calculate);listen(get('prev'),'click',()=>{page=Math.max(0,page-1);update();});listen(get('next'),'click',()=>{page++;update();});
 }
 function update(){
  if(dead||view!=='ground')return;
  if(!root||document.getElementById(root.id)!==root){const draft=pendingEditor();for(const remove of removers.splice(0))remove();root=null;editorId=null;mount();restoreEditor(draft);}
  const presets=store.availablePresets(),value=get('preset').value;
  const options=presets.map(p=>`<option value="${escape(p.key)}">${escape(p.name)} · ${escape(p.region)}</option>`).join('')+'<option value="custom">직접 입력 (위도·경도)</option>';
  if(get('preset').innerHTML!==options)get('preset').innerHTML=options;
  get('preset').value=presets.some(p=>p.key===value)||value==='custom'?value:presets[0]?.key??'custom';
  get('select').innerHTML='<option value="">지상국 선택</option>'+store.stations.map(s=>`<option value="${escape(s.id)}">${escape(s.name)} · ${s.enabled?'사용':'비활성'} · ${s.latitude}°/${s.longitude}° · ${s.min_elevation_deg}°</option>`).join('');get('select').value=store.selectedId??'';
  get('add').disabled=!store.ready||externalPending||store.stations.length>=24;get('edit').disabled=!store.ready||externalPending||!store.selectedId;
  get('calculate').disabled=busy||!store.ready||externalPending;
  get('status').textContent=externalPending?'다른 창의 지상국 변경이 있습니다. 편집 내용을 보존했습니다. 확인 후 다시 불러오세요.':store.error||message||`지상국 ${store.stations.length}개 · ${store.persistence==='memory_only'?'메모리만 사용 · 영구 저장 없음':'브라우저 설정'}`;
  const snapshot=network.networkSnapshot(),valid=store.ready&&!externalPending&&snapshot?.status==='valid'&&network.verifyNetworkSnapshot(snapshot);
  renderFabric(snapshot,valid);
  get('results').textContent='';get('results').innerHTML='';
  if(!valid){get('summary').textContent=snapshot?.error||'현재 UTC·입력의 검증된 노드 통신망 결과 없음';get('prev').disabled=true;get('next').disabled=true;return;}
  const links=snapshot.network.links;page=Math.min(page,Math.max(0,Math.ceil(links.length/50)-1));
  const rows=links.slice(page*50,(page+1)*50);
  get('summary').textContent=`표시 UTC ${snapshot.utc} · 노드 ${snapshot.network.nodes.length}개 · 링크 ${links.length}개 · ${page+1}/${Math.max(1,Math.ceil(links.length/50))}페이지 · GMST/UTC 근사 · 공학 가정 · 실제 RF 연결 미확인 · 모의 통신 결과는 아래에서 별도 조회`;
  get('results').innerHTML='<table><thead><tr><th>링크</th><th>종류</th><th>모의 계산 기록</th></tr></thead><tbody>'+rows.map(link=>`<tr><td>${escape(link.id)}</td><td>${escape(link.kind)}</td><td><details><summary>단위·기하·상태 확인</summary><pre style="max-width:28rem;white-space:pre-wrap">${escape(JSON.stringify(link,null,2))}</pre></details></td></tr>`).join('')+'</tbody></table>';
  get('prev').disabled=page===0;get('next').disabled=(page+1)*50>=links.length;
 }
 function renderFabric(snapshot,valid){
  const state=fabric?.snapshot(),pending=state?.pending===true,receipt=valid?state?.receipt:null;
  get('fabric-send').disabled=!fabric||!valid||busy||pending||state.refresh_required;
  get('fabric-send').textContent=state?.retry_available?'동일 요청 재시도':'계산된 통신망 전송';
  get('fabric-refresh').disabled=!fabric||pending||busy;
  const nodes=valid?snapshot.network.nodes:[],options='<option value="">노드 선택</option>'+nodes.map(node=>`<option value="${escape(node.id)}">${escape(node.name||node.id)}</option>`).join('');
  get('fabric-route').disabled=!receipt||pending||busy||!nodes.some(node=>node.id===routeChoice.source)||!nodes.some(node=>node.id===routeChoice.target);
  for(const field of ['source','target']){const select=get('fabric-'+field);if(select.innerHTML!==options)select.innerHTML=options;select.value=nodes.some(node=>node.id===routeChoice[field])?routeChoice[field]:'';}
  get('fabric-objective').value=routeChoice.objective;
  get('fabric-status').textContent=pending?'통신 모듈 요청 중':state?.error|| (receipt?`모의 통신망 수락 · UTC ${snapshot.utc} · 응답 번호 ${receipt.sequence}`:'현재 통신망 미전송 · 통신 결과 미확인');
  const format=value=>Number.isFinite(value)?String(value):'미확인',summary=receipt?.summary;
  get('fabric-dtn').textContent=summary?`모의 DTN 저장 ${format(summary.stored_mb)} MB · 누적 전달 ${format(summary.delivered_mb)} MB · 누적 폐기 ${format(summary.dropped_mb)} MB · 계산 간격 ${format(receipt.elapsed_s)} s`:'현재 통신망의 DTN 결과 미확인';
  const links=receipt?.links??[];
  get('fabric-results').innerHTML=receipt?'<table><thead><tr><th>링크</th><th>모의 품질 (%)</th><th>모의 사용 가능</th></tr></thead><tbody>'+links.slice(page*50,(page+1)*50).map(link=>`<tr><td>${escape(link.id)}</td><td>${escape(format(link.quality))}</td><td>${link.usable===true?'가능':link.usable===false?'불가':'미확인'}</td></tr>`).join('')+'</tbody></table>':'';
  const route=receipt?state.route:null;
  get('fabric-path').textContent=route?route.status==='available'?`모의 경로 ${(route.path??[]).join(' → ')} · 지연 ${format(route.total_delay_ms)} ms · 병목 ${format(route.bottleneck_mbps)} Mbps · 신뢰도 ${format(route.reliability)}`:'현재 통신망에서 사용 가능한 모의 경로 없음':'현재 통신망의 경로 결과 미확인';
 }
 const unsubscribe=store.subscribe(()=>{network.clearNetwork();update();});
 const external=event=>{
  if(dead||event.key!=='spacetwin-ground-stations-v1')return;
  if(editorId){externalPending=true;network.clearNetwork();update();}
  else{store.load();network.clearNetwork();update();}
 };
 host.addEventListener('storage',external);
 return Object.freeze({show(next){view=next;update();},update,hasExternalChange:()=>externalPending,
  destroy(){if(dead)return;dead=true;unsubscribe();host.removeEventListener('storage',external);for(const remove of removers.splice(0))remove();root?.remove();root=null;}});
}
