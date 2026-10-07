import {describeMatch} from '../orbit/satellite_model_description.js';
// Senior node-panel presentation and formation editing; no global scene or time owner.
export function createSatelliteNodePanelTools({library}={}) {
  if(!library)throw new TypeError('node_panel_library_required');
  const {BUS_PRESETS,FORMATION_CONTROLS,FORMATION_DEFAULTS,FORMATION_PRESETS,LINK_POLICIES,NODE_MODES,OISL_ROLES}=library;
  const esc=value=>String(value??'—').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function displayNumber(value,digits=1){if((typeof value!=='number'&&typeof value!=='string')||(typeof value==='string'&&!value.trim()))return '—';const number=Number(value);return Number.isFinite(number)?number.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';}
  function controlEnabled(control,params){return !control.presets||control.presets.includes(params.preset);}
  function formationControlsMarkup(params){const formationParams=library.normalizeFormationParams(params);
return FORMATION_CONTROLS.map(control => {
    const enabled = controlEnabled(control,formationParams);
    return `<label class="ns-slider" data-control="${esc(control.key)}" aria-disabled="${!enabled}" data-tip="${esc(control.help || control.label)}${enabled ? "" : " 현재 프리셋에서는 사용하지 않습니다."}">
    <span>${esc(control.label)}</span>
    <input type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${esc(formationParams[control.key])}" aria-label="${esc(control.label)}" ${enabled ? "" : "disabled"}>
    <input type="number" min="${control.min}" max="${control.inputMax ?? control.max}" step="${control.step}" value="${esc(formationParams[control.key])}" aria-label="${esc(control.label)} 입력" ${enabled ? "" : "disabled"}>
    <em>${esc(control.unit)}</em></label>`;
  }).join("");
  }
function formationSummaryText(formationParams) {
  const summary = library.formationSummary(formationParams);
  const parts = [`${FORMATION_PRESETS[summary.preset]?.label || summary.preset} · 총 ${summary.total}기`];
  if (summary.planes > 1) parts.push(`${summary.planes}면 × ${summary.perPlane}기 · 면 간 승교점 ${displayNumber(summary.raanStep, 1)}°`);
  if (summary.anomalyStep) parts.push(`위성 간 위상 ${displayNumber(summary.anomalyStep, 1)}° (직선 거리 ${displayNumber(summary.intraPlaneRangeKm, 0)} km)`);
  if (summary.phaseOffset) parts.push(`면 간 위상차 ${displayNumber(summary.phaseOffset, 1)}°`);
  parts.push(summary.valid ? `${summary.regime} · 주기 ${displayNumber(summary.periodMinutes, 1)} min` : "궤도 범위 밖");
  return parts.join(" · ");
}


function createFormationPanel({root=null,store,now,createFormationId,timers,onError=()=>{},onChange=()=>{},initialParams=FORMATION_DEFAULTS}={}) {
  if(!store||typeof now!=='function'||typeof createFormationId!=='function'||typeof timers?.set!=='function'||typeof timers?.clear!=='function')throw new TypeError('formation_dependencies_required');
  let params=library.normalizeFormationParams(initialParams),activeFormationId=null,live=false,destroyed=false,timer=null,version=0;
  const owned=[],fields=[],invalidInputs=new Set(),pendingInputs=new Map();
  const snapshot=()=>structuredClone({params,activeFormationId,live});
  const requireOpen=()=>{if(destroyed)throw new Error('formation_panel_disposed');};
  const report=error=>{onError(error instanceof Error?error.message:String(error));return false;};
  function invalid(key,message){cancel();if(FORMATION_CONTROLS.some(control=>control.key===key)||['bus','link_policy','prefix'].includes(key))invalidInputs.add(key);return report(message);}
  const get=selector=>root?.querySelector(selector)??null;
  function cancel(){version++;if(timer!==null)timers.clear(timer);timer=null;}
  function bind(element,event,handler,collection=owned){if(!element)return;const guarded=e=>{if(!destroyed)handler(e);};element.addEventListener(event,guarded);collection.push(()=>element.removeEventListener(event,guarded));}
  function hints(){
    const generate=get('#formation-generate');if(generate)generate.dataset.tip=`이 설정으로 새 편대를 작업 세트에 추가합니다. ${formationSummaryText(params)}`;
    const bus=BUS_PRESETS[params.bus],policy=LINK_POLICIES[params.link_policy];
    const busField=get('#formation-bus');if(busField)busField.dataset.tip=`${bus.label}: 3D 모델 ${bus.model_key}, 발전 ${bus.generation_w} W, 질량 ${bus.mass_kg} kg, 기본 장비 ${bus.equipment.length}종이 함께 정해집니다.`;
    const links=get('#formation-links');if(links)links.dataset.tip=policy.help;
    const remove=get('#formation-remove'),hasFormation=!!activeFormationId&&store.drafts.some(node=>node.formation?.id===activeFormationId);
    if(remove){remove.disabled=!hasFormation;remove.dataset.tip=hasFormation?`현재 편대 ${activeFormationId}의 위성만 작업 세트에서 지웁니다. 개별 수정으로 분리된 위성은 남습니다.`:'목록에서 편대 소속 위성을 고르거나 편대를 생성하면 그 편대를 지울 수 있습니다.';}
  }
  function syncFields(){
    const host=get('#formation-controls');host?.querySelectorAll('.ns-slider').forEach(label=>{
      const [range,number]=label.querySelectorAll('input');if(!range||!number)return;
      if(label.dataset.control==='phasing')range.max=String(Math.max(0,params.planes-1));
      if(!invalidInputs.has(label.dataset.control)&&!pendingInputs.has(label.dataset.control)){range.value=String(Math.min(Number(range.max),params[label.dataset.control]));number.value=String(params[label.dataset.control]);}
    });
    for(const [id,key]of [['formation-prefix','prefix'],['formation-bus','bus'],['formation-links','link_policy']]){const field=get(`#${id}`);if(field&&!invalidInputs.has(key)&&!pendingInputs.has(key))field.value=params[key];}
    root?.querySelectorAll('[data-formation-preset]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.formationPreset===params.preset));button.dataset.tip=FORMATION_PRESETS[button.dataset.formationPreset]?.note||'';});
    const checkbox=get('#formation-live');if(checkbox)checkbox.checked=live;hints();
  }
  function publish(){syncFields();onChange(snapshot());}
  function render(){
    for(const remove of fields.splice(0))remove();
    const host=get('#formation-controls');if(host){host.innerHTML=formationControlsMarkup(params);host.querySelectorAll('.ns-slider').forEach(label=>{
      const key=label.dataset.control,[range,number]=label.querySelectorAll('input');
      bind(range,'input',()=>change(key,range.value),fields);bind(number,'input',()=>stage(key,number.value),fields);bind(number,'change',()=>change(key,number.value),fields);
    });}publish();
  }
  function schedule(){
    cancel();if(invalidInputs.size||pendingInputs.size||!live||!activeFormationId||!store.drafts.some(node=>node.formation?.id===activeFormationId))return;
    const current=version,id=activeFormationId;
    timer=timers.set(()=>{if(destroyed||current!==version||!live||activeFormationId!==id)return;timer=null;generate(id);},120);
  }
  function stage(key,value){cancel();pendingInputs.set(key,value);}
  function commitInputs(){let valid=true;for(const [key,value]of [...pendingInputs])if(!change(key,value))valid=false;cancel();return valid;}
  function change(key,value){
    requireOpen();pendingInputs.delete(key);const control=FORMATION_CONTROLS.find(control=>control.key===key);
    if(control){if(!controlEnabled(control,params)||(typeof value!=='number'&&typeof value!=='string')||(typeof value==='string'&&!value.trim())||!Number.isFinite(Number(value)))return invalid(key,'유효한 편대 숫자를 입력하세요.');value=Number(value);}
    else if(key==='preset'){if(!Object.hasOwn(FORMATION_PRESETS,value))return invalid(key,'편대 프리셋을 확인하세요.');}
    else if(key==='bus'){if(!Object.hasOwn(BUS_PRESETS,value))return invalid(key,'버스 프리셋을 확인하세요.');}
    else if(key==='link_policy'){if(!Object.hasOwn(LINK_POLICIES,value))return invalid(key,'링크 정책을 확인하세요.');}
    else if(key==='prefix'){if(typeof value!=='string')return invalid(key,'편대 이름을 확인하세요.');}
    else return invalid(key,'알 수 없는 편대 입력입니다.');
    invalidInputs.delete(key);if(key==='preset'){invalidInputs.clear();pendingInputs.clear();}
    params=library.normalizeFormationParams({...params,[key]:value,...(key==='preset'&&value==='walker_star'?{raan_spread:180}:{})});
    if(key==='preset')render();else publish();schedule();return true;
  }
  function generate(formationId=null){
    requireOpen();cancel();
    if(!commitInputs())return [];
    try{
      if(invalidInputs.size)throw new Error('잘못된 편대 입력을 수정한 뒤 생성하세요.');
      const epoch=now();if(typeof epoch!=='number'||!Number.isFinite(epoch)||!Number.isFinite(new Date(epoch).getTime()))throw new Error('편대 정의 UTC 시각을 확인하세요.');
      const id=formationId??createFormationId();if(typeof id!=='string'||!id.trim()||id.length>80)throw new Error('편대 ID를 확인하세요.');
      const existing=store.drafts.filter(node=>node.formation?.id===id).sort((a,b)=>(a.formation.plane-b.formation.plane)||(a.formation.index-b.formation.index));
      if(formationId===null&&existing.length)throw new Error('편대 ID가 이미 존재합니다.');
      if(formationId!==null&&!existing.length)throw new Error('교체할 편대가 없습니다.');
      const pool=existing.map(node=>({id:node.id,catalogNumber:node.catalog_number})),newId=store.idFactory();
      const nodes=library.generateFormation(params,{epoch,idFactory:()=>pool.shift()??newId(),formationId:id});
      if(formationId===null)store.addMany(nodes);else store.replaceFormation(id,nodes);
      activeFormationId=id;publish();return structuredClone(nodes);
    }catch(error){report(error);return [];}
  }
  function setLive(value){requireOpen();if(typeof value!=='boolean')throw new TypeError('formation_live_boolean_required');live=value;if(!live)cancel();publish();}
  function adopt(node){
    requireOpen();const id=node?.formation?.id??null;
    if(id===activeFormationId)return;
    cancel();invalidInputs.clear();pendingInputs.clear();activeFormationId=id;
    if(node?.formation?.params)params=library.normalizeFormationParams(node.formation.params);render();
  }
  function remove(){
    requireOpen();cancel();if(!activeFormationId)return [];
    try{const removed=store.removeFormation(activeFormationId);activeFormationId=null;publish();return removed;}catch(error){report(error);return [];}
  }
  function destroy(){if(destroyed)return;cancel();for(const remove of [...fields.splice(0),...owned.splice(0)])remove();destroyed=true;}
  if(root){
    const bus=get('#formation-bus'),links=get('#formation-links');
    if(bus)bus.innerHTML=Object.entries(BUS_PRESETS).map(([key,spec])=>`<option value="${key}">${esc(spec.label)}</option>`).join('');
    if(links)links.innerHTML=Object.entries(LINK_POLICIES).map(([key,policy])=>`<option value="${key}">${esc(policy.label)}</option>`).join('');
    root.querySelectorAll('[data-formation-preset]').forEach(button=>bind(button,'click',()=>change('preset',button.dataset.formationPreset)));
    for(const [id,key]of [['formation-prefix','prefix'],['formation-bus','bus'],['formation-links','link_policy']]){const field=get(`#${id}`);if(key==='prefix')bind(field,'input',()=>stage(key,field.value));bind(field,'change',()=>change(key,field.value));}
    const checkbox=get('#formation-live');bind(checkbox,'change',()=>setLive(checkbox.checked));
    bind(get('#formation-generate'),'click',()=>generate());bind(get('#formation-remove'),'click',()=>remove());render();
  }
  function parametersForCreate(){requireOpen();if(!commitInputs()||invalidInputs.size)throw new Error('잘못된 편대 입력을 수정한 뒤 생성하세요.');return structuredClone(params);}
  return Object.freeze({change,generate,setLive,adopt,remove,destroy,snapshot,parametersForCreate});
}
function utcLabel(value,seconds=true){
  const time=typeof value==='number'?value:typeof value==='string'&&value.trim()?Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())?value:`${value}Z`):NaN;
  const date=new Date(time);return Number.isFinite(date.getTime())?date.toISOString().slice(0,seconds?19:16).replace('T',' '):'—';
}
const sourceCommit='1a1e00297a0301637455b0ef2cf48b2e74576b07';
const nativeMetadata={model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:sourceCommit,quality:'engineering_assumption'};
const sameDefinition=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;}};
function validGeometry(node,geometry,utc){
  if(!geometry||typeof utc!=='string'||!utc||geometry.node_id!==node.id||!sameDefinition(geometry.node_definition,node)||typeof geometry.definition_hash!=='string'||!geometry.definition_hash)return false;
  if(Object.entries(nativeMetadata).some(([key,value])=>geometry[key]!==value))return false;
  const row=geometry.row;
  if(!row||row.utc!==utc||row.status!=='valid'||row.error_code!==null||typeof row.sunlit!=='boolean')return false;
  if(['raan_deg','argp_deg','mean_anomaly_deg','latitude_deg','longitude_deg','height_km'].some(key=>typeof row[key]!=='number'||!Number.isFinite(row[key])))return false;
  return ['position_m','inertial_velocity_km_s'].every(key=>Array.isArray(row[key])&&row[key].length===3&&row[key].every(v=>typeof v==='number'&&Number.isFinite(v)));
}
function validLinks(links,nodes,utc,verifyLinkSnapshot){
  if(!links||links.status!=='valid'||links.utc!==utc||links.source_commit!==sourceCommit||links.quality!=='engineering_assumption'||!Array.isArray(links.terminals)||!Array.isArray(links.pairs)||!sameDefinition(links.node_definitions,nodes)||typeof verifyLinkSnapshot!=='function')return false;
  try{return verifyLinkSnapshot(structuredClone(links),{nodes:structuredClone(nodes),utc})===true;}catch{return false;}
}
const readonlyDefinitionKeys=new WeakMap();
function presentationDefinitionKey(nodes){
  if(!Array.isArray(nodes))return null;
  if(readonlyDefinitionKeys.has(nodes))return readonlyDefinitionKeys.get(nodes);
  const readonly=value=>!value||typeof value!=='object'||Object.isFrozen(value)&&Object.values(value).every(readonly);
  const key=JSON.stringify(nodes);if(readonly(nodes))readonlyDefinitionKeys.set(nodes,key);return key;
}
function validLinkPresentation(links,nodes,utc,verify){
  if(!links||links.presentation_kind!=='OPTICAL_UI_V1'||links.status!=='valid'||links.utc!==utc||links.source_commit!==sourceCommit||links.quality!=='engineering_assumption'||!Array.isArray(links.terminals)||!Array.isArray(links.pairs)||!Array.isArray(links.node_definitions)||!Array.isArray(nodes)||typeof verify!=='function')return false;
  try{return presentationDefinitionKey(links.node_definitions)===presentationDefinitionKey(nodes)&&verify(links,{utc})===true;}catch{return false;}
}
function statusPresentation(node,{utc,geometry=null,links=null,nodes=[node],verifyLinkSnapshot,verifyLinkPresentation,oislPresentation=null}={}){
  const hasGeometry=validGeometry(node,geometry,utc),row=hasGeometry?geometry.row:null;
  let hasLinks=typeof verifyLinkPresentation==='function'?validLinkPresentation(links,nodes,utc,verifyLinkPresentation):validLinks(links,nodes,utc,verifyLinkSnapshot);
  let terminals=hasLinks?links.terminals.filter(terminal=>terminal.nodeId===node.id):[];
  if(terminals.length&&['acquisitionProgress','blockedLabel','phaseLabel'].some(key=>typeof oislPresentation?.[key]!=='function')){hasLinks=false;terminals=[];}
  const activeTerminals=new Set(terminals.filter(terminal=>terminal.targetId).map(terminal=>terminal.equipmentId));
  const needsLinks=node.equipment.some(item=>library.equipmentActive(node,item)&&library.equipmentSpec(item)?.kind==='oisl');
  const consumptionKnown=hasLinks||!needsLinks;
  const power=library.powerBudget(node,{sunlit:row?.sunlit===true,activeTerminals});
  const generationKnown=!!row,marginKnown=generationKnown&&consumptionKnown;
  const allEnabled=needsLinks&&!hasLinks?library.powerBudget(node,{sunlit:row?.sunlit===true,activeTerminals:null}):null;
  const powerAssumption=allEnabled?{consumption_w:allEnabled.consumption_w,margin_w:row?allEnabled.margin_w:null,quality:'engineering_assumption'}:null;
  const texts={raan:`${displayNumber(row?.raan_deg,2)}°`,argp:`${displayNumber(row?.argp_deg,2)}°`,anomaly:`${displayNumber(row?.mean_anomaly_deg,2)}°`,
    latlon:`${displayNumber(row?.latitude_deg,3)}° / ${displayNumber(row?.longitude_deg,3)}°`,altitude:`${displayNumber(row?.height_km,1)} km`,speed:`${displayNumber(row?Math.hypot(...row.inertial_velocity_km_s):null,3)} km/s`,
    sun:row?(row.sunlit?'일조':'지구 그림자 (식)'):'위치 계산 미확인',
    generation:generationKnown?`${displayNumber(power.generation_w,0)} W`:'미확인',consumption:consumptionKnown?`${displayNumber(power.consumption_w,0)} W`:'미확인',margin:marginKnown?`${displayNumber(power.margin_w,0)} W`:'미확인',
    'equipment-summary':consumptionKnown?`${power.items.filter(entry=>entry.active).length} / ${power.items.length} 사용 중 · 총 질량 ${displayNumber(library.nodeMass(node),0)} kg`:`전력 소비 미확인 · 총 질량 ${displayNumber(library.nodeMass(node),0)} kg`,
    'power-assumption':powerAssumption?`전체 활성 단말 운용 가정: 소비 ${displayNumber(powerAssumption.consumption_w,0)} W${powerAssumption.margin_w===null?'':` · 여유 ${displayNumber(powerAssumption.margin_w,0)} W`} · 통신 연결은 미확인`:'',
    'terminal-summary':hasLinks?`${terminals.length}기 · 짐벌 지향과 포착 순서는 기하 모델`:needsLinks?'통신 결과 미확인':'활성 OISL 단말 없음 (운용 모드/장비 정의)'};
  const equipmentMarkup=consumptionKnown?power.items.map(entry=>`<span class="${entry.active?'on':'off'}"><b>${esc(entry.label)}</b><small>${entry.active?`${esc(entry.power_w)} W`:'꺼짐'}</small></span>`).join('')||'장비 없음':node.equipment.map(item=>{
    const spec=library.equipmentSpec(item),active=library.equipmentActive(node,item);if(!spec)return '';
    const unknown=active&&spec.kind==='oisl';return `<span class="${unknown?'unknown':active?'on':'off'}"><b>${esc(spec.label)}</b><small>${unknown?'통신 결과 미확인':active?`${esc(spec.power_w)} W`:'꺼짐'}</small></span>`;
  }).join('')||'장비 없음';
  let terminalMarkup;
  try { terminalMarkup=hasLinks?terminals.map(terminal=>terminalRow(terminal,new Date(utc),{...oislPresentation,findNode:id=>nodes.find(node=>node.id===id)})).join('')||`<div class="ns-empty">활성 OISL 단말이 없습니다. 운용 모드와 장비를 확인하세요.</div>`:`<div class="ns-empty">${needsLinks?'OISL 계산 결과가 아직 확인되지 않았습니다.':'현재 운용 모드와 장비 정의에는 활성 OISL 단말이 없습니다.'}</div>`;
  } catch {
    const fallback=statusPresentation(node,{utc,geometry,nodes});fallback.linksStatus='error';fallback.texts['terminal-summary']='OISL 결과 형식 오류';fallback.terminalMarkup='<div class="ns-empty">통신 결과 형식을 확인할 수 없습니다.</div>';return fallback;
  }
  const width=marginKnown?`${Math.max(0,Math.min(100,power.generation_w?power.consumption_w/power.generation_w*100:100))}%`:'0%';
  return {texts,equipmentMarkup,terminalMarkup,powerAssumption,canLocate:hasGeometry,geometryStatus:hasGeometry?'valid':geometry?.row?.status==='error'?'error':geometry?'unavailable':'unknown',linksStatus:hasLinks?'valid':links?.status==='error'?'error':'unknown',
    sunClass:row?(row.sunlit?'sunlit':'eclipse'):'',marginClass:marginKnown?(power.margin_w>=0?'ok':'bad'):'unknown',powerBar:{width,className:marginKnown?(power.margin_w>=0?'':'bad'):'unknown'}};
}
const sampledReadonlyValues=new WeakSet();
function sampledReadonly(value){
  if(!value||typeof value!=='object')return true;if(sampledReadonlyValues.has(value))return true;
  if(!Object.isFrozen(value)||!Object.values(value).every(sampledReadonly))return false;sampledReadonlyValues.add(value);return true;
}
function validSampledLinkPresentation(view,nodes,utc,verify){
  try{
    if(view?.presentation_kind!=='OPTICAL_SAMPLED_UI_V1'||view.status!=='valid'||!sampledReadonly(view)||view.error!==null||!['sampled','pending'].includes(view.availability)||view.display_utc!==utc||view.utc!==view.analysis_utc||typeof view.analysis_utc!=='string'||!Number.isFinite(Date.parse(view.analysis_utc))||!Number.isFinite(view.age_seconds)||view.current_analysis!==(view.analysis_utc===utc)||Object.entries(nativeMetadata).some(([key,value])=>view[key]!==value)||!Array.isArray(nodes)||!Array.isArray(view.node_definitions)||!Array.isArray(view.terminals)||!Array.isArray(view.pairs)||presentationDefinitionKey(view.node_definitions)!==presentationDefinitionKey(nodes)||typeof verify!=='function')return false;
    if(!view.definition_hashes||Array.isArray(view.definition_hashes)||Object.keys(view.definition_hashes).length!==nodes.length||nodes.some(node=>!Object.hasOwn(view.definition_hashes,node.id)||!/^[a-f0-9]{64}$/.test(view.definition_hashes[node.id])))return false;
    const ids=new Set(nodes.map(node=>node.id)),keys=new Set(),pairs=new Set();
    for(const pair of view.pairs){const key=JSON.stringify([pair?.a,pair?.b].sort());if(typeof pair?.key!=='string'||!pair.key.trim()||keys.has(pair.key)||pairs.has(key)||pair.a===pair.b||!ids.has(pair.a)||!ids.has(pair.b)||!['locked','one_way','acquiring','slewing','blocked','idle','none'].includes(pair.state))return false;keys.add(pair.key);pairs.add(key);}
    return verify(view,{utc})===true;
  }catch{return false;}
}
function sampledAnalysisText(view,utc){
  if(!view)return `표시 UTC ${utc||'미확인'} · 현재 시각 통신 분석 미확인`;
  return `OISL 분석 시각 ${view.analysis_utc} · 표시 UTC ${utc} · 분석 나이 ${displayNumber(view.age_seconds,3)} s · 원본 Kepler+J2 기하 모델 (engineering_assumption) · ${view.current_analysis?'현재 UTC 기하 분석 (표시 전용)':'현재 시각 통신 분석 미확인'}${view.availability==='pending'?' · 다음 분석 대기':''}`;
}
function sampledStatusPresentation(node,input){
  const {utc,geometry,nodes,sampled,verifySampledLinkPresentation,oislPresentation}=input;
  const value=statusPresentation(node,{utc,geometry,nodes});
  if(!validSampledLinkPresentation(sampled,nodes,utc,verifySampledLinkPresentation))return value;
  try{
    const terminals=sampled.terminals.filter(terminal=>terminal.nodeId===node.id);
    if(terminals.length&&['acquisitionProgress','blockedLabel','phaseLabel'].some(key=>typeof oislPresentation?.[key]!=='function'))return value;
    const activeTerminals=new Set(terminals.filter(terminal=>terminal.targetId).map(terminal=>terminal.equipmentId)),power=library.powerBudget(node,{sunlit:geometry?.row?.sunlit===true,activeTerminals});
    value.terminalMarkup=terminals.map(terminal=>terminalRow(terminal,new Date(sampled.analysis_utc),{...oislPresentation,findNode:id=>nodes.find(next=>next.id===id)})).join('')||'<div class="ns-empty">분석 시각에 활성 OISL 단말이 없습니다.</div>';
    value.texts.consumption=`${displayNumber(power.consumption_w,0)} W (분석 시각)`;value.texts.margin='미확인';value.marginClass='unknown';value.powerBar={width:'0%',className:'unknown'};
    value.texts['equipment-summary']=`${power.items.filter(entry=>entry.active).length} / ${power.items.length} 사용 중 (분석 시각) · 총 질량 ${displayNumber(library.nodeMass(node),0)} kg`;
    value.equipmentMarkup=power.items.map(entry=>`<span class="${entry.active?'on':'off'}"><b>${esc(entry.label)}</b><small>${entry.active?`${esc(entry.power_w)} W`:'꺼짐'} (분석 시각)</small></span>`).join('')||'장비 없음';
    value.texts['terminal-summary']=`${terminals.length}기 · 분석 시각의 짐벌 지향과 포착 상태`;value.texts['power-assumption']='';value.powerAssumption=null;
    if(!validSampledLinkPresentation(sampled,nodes,utc,verifySampledLinkPresentation))return statusPresentation(node,{utc,geometry,nodes});
    value.linksStatus='sampled';return value;
  }catch{return statusPresentation(node,{utc,geometry,nodes});}
}
function createNodeStatusPanel({host,store,readPresentation=null,readDisplay,geometryFor=()=>null,linksFor=()=>null,linksPresentationFor=null,sampledLinksPresentationFor=null,verifySampledLinkPresentation,verifyLinkSnapshot,verifyLinkPresentation,oislPresentation,modelFor=()=>null,modelReadinessFor=()=>null,editor,onEdit,onFocus,onError=()=>{}}={}){
  if(!host||!store||typeof readDisplay!=='function')throw new TypeError('node_status_dependencies_required');
  if(readPresentation!==null&&typeof readPresentation!=='function')throw new TypeError('node_status_presentation_reader_required');
  if(linksPresentationFor!==null&&typeof linksPresentationFor!=='function')throw new TypeError('node_status_link_presentation_reader_required');
  if(sampledLinksPresentationFor!==null&&(typeof sampledLinksPresentationFor!=='function'||typeof verifySampledLinkPresentation!=='function'))throw new TypeError('node_status_sampled_link_presentation_dependencies_required');
  let destroyed=false,key=null,generation=0,lastError=null,refreshSerial=0;const owned=[];
  const requireOpen=()=>{if(destroyed)throw new Error('node_status_disposed');};
  const report=error=>{const message=error instanceof Error?error.message:String(error);if(message!==lastError){lastError=message;onError(message);}};
  function unbind(){generation++;for(const remove of owned.splice(0))remove();}
  function geometryContext(node){
    let display=null,geometry=null;
    try{display=readDisplay();if(display?.utc)geometry=geometryFor(structuredClone(node),structuredClone(display));}catch(error){report(error);}
    return {utc:display?.utc,geometry,display};
  }
  function context(node,presentation){
    const input=geometryContext(node),nodes=readPresentation?presentation?.drafts??[]:store.drafts;let links=null,sampled=null;
    try{if(input.utc){if(sampledLinksPresentationFor)sampled=sampledLinksPresentationFor({utc:input.utc});if(!sampled||sampled.status!=='valid')links=linksPresentationFor?linksPresentationFor({utc:input.utc}):linksFor({nodes:structuredClone(nodes),utc:input.utc});}}catch(error){report(error);}
    return {...input,links,sampled,nodes,verifySampledLinkPresentation,verifyLinkSnapshot:linksPresentationFor?undefined:verifyLinkSnapshot,verifyLinkPresentation:linksPresentationFor?verifyLinkPresentation:undefined,oislPresentation};
  }
  function bind(selector,node,action){
    const element=host.querySelector(selector);if(!element)return;
    const version=generation,definition=JSON.stringify(node);
    const handler=async()=>{
      if(destroyed||host.hidden||version!==generation||store.selectedId!==node.id||JSON.stringify(store.find(node.id))!==definition)return;
      try{await action(structuredClone(node));if(!destroyed)refresh();}catch(error){report(error);if(!destroyed)refresh();}
    };
    element.addEventListener('click',handler);owned.push(()=>element.removeEventListener('click',handler));
  }
  function renderFrame(node,match,readiness){
    unbind();const shape=describeMatch(match);
    const credit=shape.credit||'출처 미확인';const url=typeof shape.creditUrl==='string'&&/^https?:\/\//i.test(shape.creditUrl)?shape.creditUrl:null;
    const creditMarkup=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(credit)}</a>`:esc(credit);
    host.innerHTML=statusFrame(node,{match})+`<p class="ns-note">샌드박스 가상 번호 ${esc(node.catalog_number)} · 실제 NORAD 등록 번호가 아닙니다.</p><p class="ns-note" data-live="model-status">${esc(shape.note)} 출처: ${creditMarkup} · 렌더링 ${esc(readiness?.status||'미확인')}</p><p class="ns-note" data-live="native-status"></p><p class="ns-note" data-live="power-assumption"></p>${sampledLinksPresentationFor?'<p class="ns-note" data-live="sampled-analysis"></p>':''}`;
    bind('#node-edit',node,next=>typeof onEdit==='function'?onEdit(next):editor?.open(next));
    const edit=host.querySelector('#node-edit');if(edit)edit.disabled=typeof onEdit!=='function'&&typeof editor?.open!=='function';
    bind('#node-duplicate',node,next=>store.duplicate(next.id));
    bind('#node-remove',node,next=>store.remove(next.id));
    bind('#node-locate',node,next=>{
      const input=geometryContext(next);if(!validGeometry(next,input.geometry,input.utc)||typeof onFocus!=='function')return;
      return onFocus(next,structuredClone(input.geometry),{userInitiated:true,focus:true});
    });
  }
  function refresh(){
    requireOpen();const serial=++refreshSerial;if(editor?.isOpen()){host.hidden=true;unbind();key=null;return;}
    host.hidden=false;let presentation,node;
    try{presentation=readPresentation?.();node=readPresentation?presentation?.selected??null:store.selected;}
    catch(error){if(!sampledLinksPresentationFor)throw error;host.hidden=true;unbind();key=null;report(error);return;}
    if(!node){if(key!=='empty'){unbind();host.innerHTML='<div class="ns-empty tall">위성을 선택하면 궤도, 전력, 장비와 OISL 단말 상태를 표시합니다.</div>';key='empty';}return;}
    let match=null,readiness=null;try{match=modelFor(structuredClone(node));readiness=modelReadinessFor(structuredClone(node));}catch(error){report(error);}
    const nextKey=JSON.stringify([node,match,readiness]);if(nextKey!==key){key=nextKey;renderFrame(node,match,readiness);}
    const input=context(node,presentation),version=generation;
    const bound=()=>!destroyed&&serial===refreshSerial&&generation===version;
    const scopeCurrent=()=>{try{if(!bound())return false;const current=readPresentation?.(),selected=readPresentation?current?.selected:store.selected,nodes=readPresentation?current?.drafts??[]:store.drafts;return sameDefinition(selected,node)&&presentationDefinitionKey(nodes)===presentationDefinitionKey(input.nodes)&&sameDefinition(readDisplay(),input.display)&&bound();}catch{return false;}};
    const sampledCurrent=()=>{try{return scopeCurrent()&&validSampledLinkPresentation(input.sampled,input.nodes,input.utc,verifySampledLinkPresentation)&&scopeCurrent()&&verifySampledLinkPresentation(input.sampled,{utc:input.utc})===true&&bound();}catch{return false;}};
    let value=sampledLinksPresentationFor&&input.sampled?.status==='valid'?sampledStatusPresentation(node,input):statusPresentation(node,input);
    if(sampledLinksPresentationFor){if(!bound())return;if(!scopeCurrent()){host.hidden=true;unbind();key=null;return;}if(value.linksStatus==='sampled'&&(!sampledCurrent()||validGeometry(node,input.geometry,input.utc)&&input.geometry.definition_hash!==input.sampled.definition_hashes[node.id]))value=statusPresentation(node,{utc:input.utc,geometry:input.geometry,nodes:input.nodes});}
    function paint(value){
    for(const [name,text]of Object.entries(value.texts)){const el=host.querySelector(`[data-live="${name}"]`);if(el)el.textContent=text;}
    const update=(name,action)=>{const el=host.querySelector(`[data-live="${name}"]`);if(el)action(el);};
    update('power-assumption',el=>el.hidden=!value.powerAssumption);
    update('sun',el=>el.className=value.sunClass);update('margin-cell',el=>el.className=value.marginClass);
    update('power-bar',el=>{el.style.width=value.powerBar.width;el.className=value.powerBar.className;});
    update('equipment',el=>el.innerHTML=value.equipmentMarkup);update('terminals',el=>el.innerHTML=value.terminalMarkup);
    update('native-status',el=>el.textContent=value.geometryStatus==='valid'?`Kepler+J2 모의 위치 · GMST 근사 좌표 · ${input.utc}`:value.geometryStatus==='error'?'위치 계산 오류 · 수치와 뷰 정렬을 사용할 수 없습니다.':'현재 시각의 위치 계산 미확인');
    const locate=host.querySelector('#node-locate');if(locate)locate.disabled=!value.canLocate||typeof onFocus!=='function';
    update('sampled-analysis',el=>{el.textContent=sampledAnalysisText(value.linksStatus==='sampled'?input.sampled:null,input.utc);el.hidden=value.linksStatus==='valid';});
    }
    paint(value);
    if(sampledLinksPresentationFor){if(!bound())return;if(!scopeCurrent()){host.hidden=true;unbind();key=null;return;}if(value.linksStatus==='sampled'&&!sampledCurrent()){value=statusPresentation(node,{utc:input.utc,geometry:input.geometry,nodes:input.nodes});paint(value);}}
    return structuredClone(value);
  }
  function destroy(){if(destroyed)return;if(sampledLinksPresentationFor)host.hidden=true;unbind();destroyed=true;}
  function canFocus(){if(destroyed||editor?.isOpen()||typeof onFocus!=='function')return false;const node=store.selected;if(!node)return false;const input=geometryContext(node);return validGeometry(node,input.geometry,input.utc);}
  async function focusSelected(){
    if(destroyed||editor?.isOpen()||typeof onFocus!=='function')return false;
    const node=store.selected;if(!node)return false;const input=geometryContext(node);if(!validGeometry(node,input.geometry,input.utc))return false;
    try{await onFocus(structuredClone(node),structuredClone(input.geometry),{userInitiated:true,focus:true});return true;}catch(error){report(error);return false;}
  }
  return Object.freeze({refresh,destroy,canFocus,focusSelected});
}
function statusFrame(node,{match=null}={}) {
  const item = library.nodeCatalogItem(node);
  const shape = describeMatch(match);
  return `
    <header class="ns-status-head">
      <span class="ns-kicker">${esc(BUS_PRESETS[node.bus]?.label || node.bus)} · ${esc(node.id)} · 참조 ${esc(node.catalog_number)}</span>
      <h3>${esc(node.name)}</h3>
      <div class="ns-status-tags"><span class="ns-tag ${esc(node.mode)}">${esc(NODE_MODES[node.mode]?.label || node.mode)}</span><span class="ns-tag">${esc(item.ORBIT_REGIME || "—")}</span>${node.formation ? `<span class="ns-tag">${esc(FORMATION_PRESETS[node.formation.preset]?.label || node.formation.preset)} ${esc(node.formation.id)}</span>` : `<span class="ns-tag">개별 배치</span>`}</div>
      <div class="ns-status-actions"><button id="node-edit">편집</button><button id="node-duplicate">복제</button><button id="node-locate">뷰 정렬</button><button id="node-remove" class="danger">삭제</button></div>
    </header>
    <section class="ns-section ns-shape"><figure>${match ? `<img src="${esc(match.thumbnail)}" alt="${esc(shape.alt)}" decoding="async">` : ""}<figcaption><b>${esc(shape.label)}</b><small>${esc(shape.state)}${match?.sizeMeters ? ` · 대표 치수 ${esc(displayNumber(match.sizeMeters, 1))} m` : ""}</small></figcaption></figure></section>
    <section class="ns-section"><h4>궤도 <small>Kepler + J2 · 정의 ${esc(utcLabel(node.orbit.epoch, false))} UTC</small></h4>
      <dl class="ns-values">
        <div><dt>평균 고도</dt><dd>${esc(displayNumber(node.orbit.altitude_km, 1))} km</dd></div><div><dt>이심률 / 경사각</dt><dd>${esc(displayNumber(node.orbit.eccentricity, 4))} / ${esc(displayNumber(node.orbit.inclination, 2))}°</dd></div>
        <div><dt>승교점 적경 (현재)</dt><dd data-live="raan">—</dd></div><div><dt>근지점 편각 (현재)</dt><dd data-live="argp">—</dd></div>
        <div><dt>평균 근점 이각 (현재)</dt><dd data-live="anomaly">—</dd></div><div><dt>주기</dt><dd>${esc(displayNumber(item.PERIOD_MINUTES, 2))} min</dd></div>
        <div><dt>승교점 이동률</dt><dd>${esc(displayNumber(item.RAAN_DRIFT_DEG_PER_DAY, 3))}°/일</dd></div><div><dt>근지점 / 원지점</dt><dd>${esc(displayNumber(item.PERIGEE_KM, 0))} / ${esc(displayNumber(item.APOGEE_KM, 0))} km</dd></div>
      </dl>
      <dl class="ns-values ns-live">
        <div><dt>위도 / 경도</dt><dd data-live="latlon">—</dd></div><div><dt>타원체 고도</dt><dd data-live="altitude">—</dd></div>
        <div><dt>속력 (관성계)</dt><dd data-live="speed">—</dd></div><div><dt>태양 조건</dt><dd data-live="sun">—</dd></div>
      </dl></section>
    <section class="ns-section"><h4>전력 <small>순간 수지 · 배터리 적분 아님</small></h4>
      <div class="ns-power"><span>발전 <b data-live="generation">—</b></span><span>소비 <b data-live="consumption">—</b></span><span data-live="margin-cell">여유 <b data-live="margin">—</b></span><span>배터리 <b>${esc(displayNumber(node.power?.battery_wh, 0))} Wh</b></span></div>
      <i class="ns-power-bar"><b data-live="power-bar" style="width:0%"></b></i></section>
    <section class="ns-section"><h4>임무 장비 <small data-live="equipment-summary">—</small></h4>
      <div class="ns-eq-status" data-live="equipment"></div></section>
    <section class="ns-section"><h4>OISL 단말 <small data-live="terminal-summary">—</small></h4>
      <div data-live="terminals"></div></section>
    <p class="ns-note">위치와 링크 상태는 Kepler+J2 모의 계산과 기하학적 가시선 판정입니다. 실측 텔레메트리나 링크 예산이 아닙니다.</p>`;
}

function fleetMarkup(nodes){
return nodes.map(node => {
      const item = library.nodeCatalogItem(node);
      return `<button class="ns-fleet-row" role="option" aria-selected="false" data-node-id="${esc(node.id)}"><span class="status-dot neutral"></span><span class="ns-fleet-body"><b>${esc(node.name)}</b><small>${esc(item.ORBIT_REGIME || "—")} · ${esc(displayNumber(node.orbit.altitude_km, 0))} km · i ${esc(displayNumber(node.orbit.inclination, 1))}°${node.formation ? ` · ${esc(node.formation.id)}` : ""}</small></span><span class="ns-fleet-mode ${esc(node.mode)}">${esc(NODE_MODES[node.mode]?.label || node.mode)}</span></button>`;
    }).join("") || `<div class="ns-empty">위성이 없습니다. 아래 편대 배치에서 생성하거나 <b>＋ 위성 추가</b>를 누르세요.</div>`;
}
function terminalRow(terminal, date, {findNode,acquisitionProgress,blockedLabel,phaseLabel}) {
  const { spec, state, geometry, margin } = terminal;
  const target = terminal.targetId ? findNode(terminal.targetId)?.name || terminal.targetId : "—";
  const progress = acquisitionProgress(state, spec, date);
  const detail = state.phase === "blocked" ? blockedLabel(state.blockedBy)
    : state.phase === "idle" ? "가시 상대 없음"
      : `거리 ${displayNumber(geometry?.range_km, 0)} km · 여유 ${displayNumber(margin.margin_db, 1)} dB${terminal.dataRateMbps ? ` · ${displayNumber(terminal.dataRateMbps / 1000, 1)} Gbps` : ""}`;
  return `<div class="ns-terminal" data-phase="${esc(state.phase)}">
    <div class="ns-terminal-head"><b>${esc(spec.label)}</b><span class="ns-tag ${esc(state.phase)}">${esc(phaseLabel(state.phase))}</span></div>
    <div class="ns-terminal-grid"><span>방향 <b>${esc(OISL_ROLES[terminal.role] || terminal.role)}</b></span><span>상대 <b>${esc(target)}</b></span><span>짐벌 Az/El <b>${esc(displayNumber(state.azimuth, 1))}° / ${esc(displayNumber(state.elevation, 1))}°</b></span><span>지향 오차 <b>${state.pointingError == null ? "—" : esc(displayNumber(state.pointingError, 3))}°</b></span></div>
    <small>${esc(detail)}</small>${progress !== null ? `<i class="ns-progress"><b style="width:${Math.round(progress * 100)}%"></b></i>` : ""}
  </div>`;
}

function linkStateOf(nodeId,links) {
  const mine = links.pairs.filter(pair => pair.a === nodeId || pair.b === nodeId);
  if (!mine.length) return links.terminals.some(terminal => terminal.nodeId === nodeId && terminal.state.phase === "blocked") ? "danger" : "neutral";
  if (mine.some(pair => pair.state === "locked")) return "ok";
  if (mine.some(pair => pair.state === "acquiring" || pair.state === "slewing" || pair.state === "one_way")) return "warning";
  return "danger";
}

function createNodeFleetPanel({host,count=null,analysisHost=null,store,readPresentation=null,readDisplay,linksFor=()=>null,linksPresentationFor=null,sampledLinksPresentationFor=null,verifySampledLinkPresentation,verifyLinkSnapshot,verifyLinkPresentation,onSelected=()=>{},onError=()=>{}}={}){
  if(!host||!store||typeof readDisplay!=='function')throw new TypeError('node_fleet_dependencies_required');
  if(readPresentation!==null&&typeof readPresentation!=='function')throw new TypeError('node_fleet_presentation_reader_required');
  if(linksPresentationFor!==null&&typeof linksPresentationFor!=='function')throw new TypeError('node_fleet_link_presentation_reader_required');
  if(sampledLinksPresentationFor!==null&&(typeof sampledLinksPresentationFor!=='function'||typeof verifySampledLinkPresentation!=='function'))throw new TypeError('node_fleet_sampled_link_presentation_dependencies_required');
  let destroyed=false,key=null,generation=0,refreshSerial=0;const owned=[];
  const requireOpen=()=>{if(destroyed)throw new Error('node_fleet_disposed');};
  function unbind(){generation++;for(const remove of owned.splice(0))remove();}
  function neutralize(){
    host.querySelectorAll('[data-node-id]').forEach(row=>{const dot=row.querySelector('.status-dot');if(dot){dot.className='status-dot neutral';dot.title='현재 시각 통신 분석 미확인';dot.setAttribute('aria-label',dot.title);}});
    if(analysisHost){analysisHost.hidden=false;analysisHost.textContent=sampledAnalysisText(null,null);}
  }
  function refresh(){
    requireOpen();const serial=++refreshSerial;let presentation,nodes;
    try{presentation=readPresentation?.();nodes=readPresentation?presentation?.drafts??[]:store.drafts;}
    catch(error){if(!sampledLinksPresentationFor)throw error;neutralize();onError(error instanceof Error?error.message:String(error));return;}
    const nextKey=JSON.stringify(nodes.map(node=>[node.id,node.updated_at,node.name,node.mode,node.orbit,node.formation]));
    if(count)count.textContent=String(nodes.length);
    if(nextKey!==key){
      key=nextKey;unbind();host.innerHTML=fleetMarkup(nodes);const version=generation;
      host.querySelectorAll('[data-node-id]').forEach(row=>{
        const id=row.dataset.nodeId;
        const handler=async()=>{
          if(destroyed||version!==generation||!store.find(id))return;
          try{store.select(id);await onSelected(store.selected);if(!destroyed)refresh();}catch(error){onError(error instanceof Error?error.message:String(error));if(!destroyed)refresh();}
        };
        row.addEventListener('click',handler);owned.push(()=>row.removeEventListener('click',handler));
      });
    }
    const version=generation;let links=null,sampled=null,utc=null,display=null;try{display=readDisplay();utc=display?.utc;if(utc){if(sampledLinksPresentationFor)sampled=sampledLinksPresentationFor({utc});if(!sampled||sampled.status!=='valid')links=linksPresentationFor?linksPresentationFor({utc}):linksFor({nodes:structuredClone(nodes),utc});}}catch(error){onError(error instanceof Error?error.message:String(error));}
    const bound=()=>!destroyed&&serial===refreshSerial&&version===generation;
    const scopeCurrent=()=>{try{if(!bound())return false;const currentNodes=readPresentation?readPresentation()?.drafts??[]:store.drafts;return presentationDefinitionKey(nodes)===presentationDefinitionKey(currentNodes)&&sameDefinition(display,readDisplay())&&bound();}catch{return false;}};
    const sampledCurrent=()=>{try{return scopeCurrent()&&validSampledLinkPresentation(sampled,nodes,utc,verifySampledLinkPresentation)&&scopeCurrent()&&verifySampledLinkPresentation(sampled,{utc})===true&&bound();}catch{return false;}};
    let sampledVerified=sampledLinksPresentationFor&&sampled?.status==='valid'&&sampledCurrent();
    const verified=!sampledVerified&&(linksPresentationFor?validLinkPresentation(links,nodes,utc,verifyLinkPresentation):validLinks(links,nodes,utc,verifyLinkSnapshot));
    if(sampledLinksPresentationFor&&!bound())return;
    function paint(sampledVerified,verified){
    const selection=sampledLinksPresentationFor?(readPresentation?readPresentation()?.selected_id:store.selectedId):(readPresentation?presentation?.selected_id:store.selectedId);
    // Selection is another owner callback: it may dispose this panel or run a
    // newer refresh. Obsolete publication must leave that newer result intact.
    if(sampledLinksPresentationFor&&!bound())return false;
    host.querySelectorAll('[data-node-id]').forEach(row=>{
      row.setAttribute('aria-selected',String(row.dataset.nodeId===selection));const dot=row.querySelector('.status-dot');
      if(dot){dot.className=`status-dot ${sampledVerified?linkStateOf(row.dataset.nodeId,sampled):verified?linkStateOf(row.dataset.nodeId,links):'neutral'}`;dot.title=sampledVerified?`분석 시각의 통신 상태 · ${sampledAnalysisText(sampled,utc)}`:verified?'원본 기하 모델의 통신 상태':'통신 결과 미확인';if(sampledLinksPresentationFor)dot.setAttribute('aria-label',dot.title);}
    });
    if(analysisHost){analysisHost.hidden=!sampledLinksPresentationFor||verified;analysisHost.textContent=sampledAnalysisText(sampledVerified?sampled:null,utc);}
    return true;
    }
    try{if(paint(sampledVerified,verified)===false)return;}catch(error){if(sampledLinksPresentationFor){if(bound()){neutralize();onError(error instanceof Error?error.message:String(error));}return;}sampledVerified=false;paint(false,false);}
    if(sampledLinksPresentationFor&&bound()&&(!scopeCurrent()||sampledVerified&&!sampledCurrent()))paint(false,false);
  }
  function destroy(){if(destroyed)return;if(sampledLinksPresentationFor)neutralize();unbind();destroyed=true;}
  return Object.freeze({refresh,destroy});
}
function bindNodeTooltips({root,tip,timers,viewport,contains,scrollTarget=null}={}){
  if(!root||!tip||typeof timers?.set!=='function'||typeof timers?.clear!=='function'||typeof viewport!=='function')throw new TypeError('node_tooltip_dependencies_required');
  const isContained=contains??(target=>root.contains(target));
  let timer=null,current=null,destroyed=false;const owned=[];
  tip.hidden=true;tip.setAttribute('role','tooltip');
  const clear=()=>{if(timer!==null)timers.clear(timer);timer=null;};
  const place=target=>{
    const rect=target.getBoundingClientRect(),bounds=viewport(),width=tip.offsetWidth,height=tip.offsetHeight;
    if(![rect.left,rect.width,rect.top,rect.bottom,bounds.width,bounds.height,width,height].every(Number.isFinite))throw new Error('tooltip_bounds_unavailable');
    const left=Math.max(8,Math.min(bounds.width-width-8,rect.left+rect.width/2-width/2));
    const above=rect.top-height-8,top=Math.max(8,Math.min(bounds.height-height-8,above>=8?above:rect.bottom+8));
    tip.style.left=`${left}px`;tip.style.top=`${top}px`;tip.dataset.placement=above>=8?'above':'below';
  };
  const hide=()=>{clear();current=null;tip.hidden=true;};
  const show=target=>{
    if(destroyed||!target?.dataset.tip||!isContained(target))return;
    current=target;clear();tip.hidden=true;
    timer=timers.set(()=>{
      timer=null;if(destroyed||current!==target||!isContained(target)||!target.dataset.tip){hide();return;}
      tip.textContent=target.dataset.tip;
      try{place(target);tip.hidden=false;}catch{hide();}
    },220);
  };
  const bind=(element,event,handler,options)=>{if(!element)return;element.addEventListener(event,handler,options);owned.push(()=>element.removeEventListener(event,handler,options));};
  bind(root,'mouseover',event=>{const target=event.target.closest('[data-tip]');if(target&&target!==current)show(target);});
  bind(root,'mouseout',event=>{const target=event.target.closest('[data-tip]');if(target&&!target.contains(event.relatedTarget))hide();});
  bind(root,'focusin',event=>{const target=event.target.closest('[data-tip]');if(target)show(target);});
  bind(root,'focusout',hide);bind(root,'mousedown',hide);bind(scrollTarget,'scroll',hide,true);
  return ()=>{if(destroyed)return;destroyed=true;hide();for(const remove of owned.splice(0))remove();};
}
// Source add/save/select/clear orchestration. Owners supply display, history and scene callbacks;
// this controller neither loads storage nor creates a Viewer, clock, transport or deployment.
function createNodeDraftPanel({root,store,editorTools,now,timers,createFormationId,models,otherNodes,
  onModelChange,confirmClear,onRefresh=()=>{},onDefinitionsChanged=()=>{},onResetTerminals=()=>{},
  onSelected=()=>{},onError=()=>{},initialParams=FORMATION_DEFAULTS}={}){
  const form=root?.querySelector('#node-editor');
  if(!root||!form||!store||typeof editorTools?.createNodeEditor!=='function'||typeof now!=='function')throw new TypeError('node_draft_panel_dependencies_required');
  let disposed=false,clearVersion=0;const owned=[];
  const requireOpen=()=>{if(disposed)throw new Error('node_draft_panel_disposed');};
  const report=error=>{try{onError(error instanceof Error?error.message:String(error));}catch{/* Reporting cannot undo a persisted transaction. */}};
  const call=(fn,...args)=>{try{const result=fn(...args);if(result?.then)result.catch(report);return result;}catch(error){report(error);}};
  const refresh=()=>{if(!disposed)call(onRefresh);};
  const formation=createFormationPanel({root,store,now,timers,createFormationId,initialParams,onError:report,onChange:refresh});
  function save(draft,{signal}={}){
    if(disposed||signal?.aborted)return ['위성 편집이 취소되었습니다.'];
    const original=store.find(draft.id);if(!original)return ['노드를 찾을 수 없습니다.'];
    const errors=store.update(draft.id,{...structuredClone(draft),formation:null});
    if(!errors.length)call(onResetTerminals,[draft.id]);
    return errors;
  }
  let editor;
  try{editor=editorTools.createNodeEditor({form,models,otherNodes:otherNodes??(()=>store.drafts),onModelChange,onSave:save,onCancel:refresh,onClose:refresh});}
  catch(error){disposed=true;formation.destroy();throw error;}
  function openEditor(id,{focus=true}={}){
    requireOpen();const node=store.find(id);if(!node)return false;
    try{editor.open(node,{focus});refresh();return true;}catch(error){report(error);return false;}
  }
  function add(){
    requireOpen();let node;
    try{
      const params=formation.parametersForCreate(),epoch=now();
      if(typeof epoch!=='number'||!Number.isFinite(epoch)||!Number.isFinite(new Date(epoch).getTime()))throw new Error('위성 정의 UTC 시각을 확인하세요.');
      node=store.add({bus:params.bus,orbit:library.defaultOrbit(epoch,{altitude_km:params.altitude_km,inclination:params.inclination,raan:params.raan_start,mean_anomaly:params.anomaly_start})},{linkPolicy:params.link_policy});
    }catch(error){report(error);return null;}
    openEditor(node.id);return structuredClone(node);
  }
  function select(id){
    requireOpen();if(!store.find(id))return false;
    try{store.select(id);}catch(error){report(error);return false;}
    editor.close();refresh();call(onSelected,store.selected,{userInitiated:true,focus:false});return true;
  }
  async function clear(){
    requireOpen();if(!store.drafts.length||typeof confirmClear!=='function')return false;
    const version=++clearVersion,revision=store.revision,nodes=store.drafts;
    try{
      const approved=await confirmClear(structuredClone(nodes));
      if(disposed||version!==clearVersion)return false;
      if(approved!==true)return false;
      if(store.revision!==revision){report('위성 작업 세트가 변경되었습니다. 내용을 확인하고 다시 비우세요.');return false;}
      store.clear();call(onResetTerminals,nodes.map(node=>node.id));return true;
    }catch(error){report(error);return false;}
  }
  function onStoreChange(event){
    if(disposed)return;
    // Preserve unrelated editors/listeners and never turn a passive selection into a camera command.
    if(editor.isOpen()&&(!store.find(editor.draft?.id)||(event==='select'&&editor.draft?.id!==store.selectedId)))call(()=>editor.close());
    call(()=>formation.adopt(store.selected));refresh();
    if(['add','update','remove'].includes(event))call(onDefinitionsChanged,store.drafts,event);
  }
  const unsubscribe=store.subscribe(onStoreChange);
  const bind=(selector,handler)=>{const el=root.querySelector(selector);if(!el)return;const guarded=()=>{if(!disposed)return handler();};el.addEventListener('click',guarded);owned.push(()=>el.removeEventListener('click',guarded));};
  bind('#node-add',add);bind('#nodes-clear',clear);
  const clearButton=root.querySelector('#nodes-clear');if(clearButton)clearButton.disabled=typeof confirmClear!=='function';
  formation.adopt(store.selected);refresh();
  function destroy(){if(disposed)return;disposed=true;clearVersion++;unsubscribe();for(const remove of owned.splice(0))remove();formation.destroy();editor.destroy();}
  return Object.freeze({formation,editor,add,select,clear,openEditor,refresh,destroy});
}

function createNodeSceneControls({root,readScene=()=>null,readDisplay,actions={},canFocus=()=>false,onFocus,onError=()=>{}}={}){
  if(!root||typeof readScene!=='function'||typeof readDisplay!=='function'||!actions||typeof actions!=='object')throw new TypeError('node_scene_controls_dependencies_required');
  let disposed=false;const owned=[];
  const report=error=>{if(!disposed)onError(error instanceof Error?error.message:String(error));};
  const get=selector=>root.querySelector(selector);
  const read=()=>{let scene=null,display=null;try{scene=readScene();display=readDisplay();}catch(error){report(error);}return {scene,display};};
  const has=name=>typeof actions[name]==='function';
  const speedsOf=display=>Array.isArray(display?.speeds)&&display.speeds.length>0&&display.speeds.length<=16&&display.speeds.every(value=>Number.isFinite(value)&&value>0)?[...new Set(display.speeds)]:null;
  function enabled(mode,scene,display){
    if(mode==='focus')return scene?.ready===true&&typeof onFocus==='function'&&canFocus();
    if(mode==='home')return scene?.ready===true&&scene.cameraReady!==false&&has('home')&&has('untrack');
    if(mode==='untrack')return scene?.ready===true&&has('untrack');
    if(mode==='tracks')return scene?.ready===true&&typeof scene.tracks==='boolean'&&has('toggleTracks');
    if(mode==='links'||mode==='models'||mode==='lighting')return scene?.ready===true&&typeof scene[mode]==='boolean'&&has({links:'setLinksVisible',models:'setModelsVisible',lighting:'setLighting'}[mode]);
    if(mode==='zoomBy'||mode==='setZoom')return scene?.ready===true&&Number.isFinite(scene.zoom)&&has(mode);
    if(mode==='pause')return typeof display?.running==='boolean'&&has(display.running?'pause':'play');
    if(mode==='speed')return Number.isFinite(display?.speed)&&display.speed>0&&speedsOf(display)?.includes(display.speed)&&has('setSpeed');
    return typeof display?.utc==='string'&&has(mode);
  }
  function refresh(){
    if(disposed)return;const {scene,display}=read();
    root.querySelectorAll('[data-node-scene]').forEach(button=>{const mode=button.dataset.nodeScene;button.disabled=!enabled(mode,scene,display);if(['tracks','links','models'].includes(mode)){if(typeof scene?.[mode]==='boolean')button.setAttribute('aria-pressed',String(scene[mode]));else button.removeAttribute('aria-pressed');}});
    for(const [id,mode]of [['node-lighting','lighting'],['node-zoom','setZoom'],['node-zoom-in','zoomBy'],['node-zoom-out','zoomBy'],['node-clock-pause','pause'],['node-clock-back','step'],['node-clock-forward','step'],['node-clock-now','live'],['node-clock-speed','speed']]){const el=get(`#${id}`);if(el)el.disabled=!enabled(mode,scene,display);}
    const lighting=get('#node-lighting');if(lighting){if(typeof scene?.lighting==='boolean')lighting.setAttribute('aria-pressed',String(scene.lighting));else lighting.removeAttribute('aria-pressed');}
    const zoom=get('#node-zoom');if(zoom&&Number.isFinite(scene?.zoom)){zoom.value=String(Math.max(0,Math.min(100,scene.zoom)));zoom.setAttribute('aria-valuetext',`확대 수준 ${Math.round(Number(zoom.value))}%`);}
    const clock=get('#node-clock');if(clock)clock.textContent=display?.utc||'—';
    const mode=get('#node-clock-mode');if(mode){
      const known=['카탈로그','저장 궤도','SIM','SIM 따라가기'].includes(display?.mode);
      mode.textContent=display?.mode==='live'?'현재 시각':display?.mode==='paused'?'분석 시각 · 정지':known&&typeof display.running==='boolean'?`${display.mode} 분석 시각 · ${display.running?'재생':'정지'}`:display?.mode==='카탈로그'&&!Object.hasOwn(display,'running')?'카탈로그 분석 시각 · 재생 샘플 미계산':display?.running===true?'분석 시각 · 재생':'표시 시각 미확인';
    }
    const pause=get('#node-clock-pause');if(pause){pause.textContent=display?.running===true?'Ⅱ':'▶';pause.setAttribute('aria-label',display?.running===true?'분석 시계 일시정지':display?.running===false?'분석 시계 재생':'분석 시계 재생 상태 미확인');}
    const speed=get('#node-clock-speed');if(speed){
      const supported=speedsOf(display)??[],choices=[...new Set([...supported,1,10,60,600])].sort((a,b)=>a-b),key=JSON.stringify([choices,supported]);
      if(speed.dataset.speedOptions!==key){speed.innerHTML=choices.map(value=>`<option value="${value}" ${supported.includes(value)?'':'disabled'}>×${value}</option>`).join('');speed.dataset.speedOptions=key;}
      if(Number.isFinite(display?.speed))speed.value=String(display.speed);
    }
  }
  async function perform(mode,fn){
    if(disposed)return;const {scene,display}=read();if(!enabled(mode,scene,display))return;
    try{await fn(scene,display);}catch(error){report(error);}if(!disposed)refresh();
  }
  const bind=(el,event,fn)=>{if(!el)return;const guarded=event=>{if(!disposed)return fn(event);};el.addEventListener(event,guarded);owned.push(()=>el.removeEventListener(event,guarded));};
  root.querySelectorAll('[data-node-scene]').forEach(button=>{const mode=button.dataset.nodeScene;bind(button,'click',()=>perform(mode,async scene=>{
    if(mode==='home'){await actions.untrack();if(!disposed)await actions.home();}
    if(mode==='focus')await onFocus();
    if(mode==='tracks')await actions.toggleTracks();
    if(mode==='links')await actions.setLinksVisible(!scene.links);
    if(mode==='models')await actions.setModelsVisible(!scene.models);
  }));});
  bind(get('#node-lighting'),'click',()=>perform('lighting',scene=>actions.setLighting(!scene.lighting)));
  bind(get('#node-zoom-in'),'click',()=>perform('zoomBy',()=>actions.zoomBy(120)));
  bind(get('#node-zoom-out'),'click',()=>perform('zoomBy',()=>actions.zoomBy(-120)));
  bind(get('#node-zoom'),'input',()=>perform('setZoom',()=>{const raw=get('#node-zoom').value,value=Number(raw);if(!String(raw).trim()||!Number.isFinite(value))throw new Error('확대 수준을 확인하세요.');return actions.setZoom(Math.max(0,Math.min(100,value)));}));
  bind(get('#node-clock-pause'),'click',()=>perform('pause',(_,display)=>actions[display.running?'pause':'play']()));
  bind(get('#node-clock-back'),'click',()=>perform('step',()=>actions.step(-60)));
  bind(get('#node-clock-forward'),'click',()=>perform('step',()=>actions.step(60)));
  bind(get('#node-clock-now'),'click',()=>perform('live',()=>actions.live()));
  bind(root,'keydown',event=>{if(event.key==='Escape')return perform('untrack',()=>actions.untrack({aimAtEarth:true}));});
  bind(get('#node-clock-speed'),'change',()=>perform('speed',(_,display)=>{const raw=get('#node-clock-speed').value,value=Number(raw);if(!String(raw).trim()||!Number.isFinite(value)||!speedsOf(display)?.includes(value))throw new Error('연결된 분석 시계가 지원하는 배속을 선택하세요.');return actions.setSpeed(value);}));
  refresh();return Object.freeze({refresh,destroy(){if(disposed)return;disposed=true;for(const remove of owned.splice(0))remove();}});
}

function createNodeWorkPanel({root,store,readPresentation=null,editorTools,now,timers,createFormationId,readDisplay,viewport,scrollTarget,
  geometryFor,linksFor,linksPresentationFor,sampledLinksPresentationFor,verifySampledLinkPresentation,verifyLinkSnapshot,verifyLinkPresentation,oislPresentation,modelFor,modelReadinessFor,models,onModelChange,
  confirmClear,onDefinitionsChanged,onResetTerminals,onSelected=()=>{},onFocus,readScene,actions,onError=()=>{},initialParams=FORMATION_DEFAULTS}={}){
  if(!root||!store||typeof readDisplay!=='function'||typeof viewport!=='function')throw new TypeError('node_work_panel_dependencies_required');
  const host=root.querySelector('#node-fleet'),statusHost=root.querySelector('#node-status'),tip=root.querySelector('#node-tip');
  if(!host||!statusHost||!tip)throw new TypeError('node_work_panel_hosts_required');
  let disposed=false,initializing=true,draft,fleet,status,controls,removeTooltips;const owned=[];
  function refresh(){if(disposed||initializing)return;fleet.refresh();status.refresh();controls.refresh();}
  function destroy(){if(disposed)return;disposed=true;for(const remove of owned.splice(0))remove();removeTooltips?.();controls?.destroy();fleet?.destroy();status?.destroy();draft?.destroy();}
  try{
    draft=createNodeDraftPanel({root,store,editorTools,now,timers,createFormationId,models,onModelChange,confirmClear,onDefinitionsChanged,onResetTerminals,onError,initialParams,onRefresh:refresh,onSelected});
    status=createNodeStatusPanel({host:statusHost,store,readPresentation,readDisplay,geometryFor,linksFor,linksPresentationFor,sampledLinksPresentationFor,verifySampledLinkPresentation,verifyLinkSnapshot,verifyLinkPresentation,oislPresentation,modelFor,modelReadinessFor,onFocus,onError,editor:draft.editor,onEdit:node=>draft.openEditor(node.id)});
    fleet=createNodeFleetPanel({host,count:root.querySelector('#node-count'),analysisHost:root.querySelector('#node-fleet-analysis'),store,readPresentation,readDisplay,linksFor,linksPresentationFor,sampledLinksPresentationFor,verifySampledLinkPresentation,verifyLinkSnapshot,verifyLinkPresentation,onError,onSelected:node=>{draft.editor.close();refresh();return onSelected(structuredClone(node),{userInitiated:true,focus:false});}});
    controls=createNodeSceneControls({root,readScene,readDisplay,actions,onError,canFocus:()=>status.canFocus(),onFocus:()=>status.focusSelected()});
    const focus=async event=>{if(disposed)return;const row=event.target?.closest?.('[data-node-id]');if(!row||!Array.from(host.querySelectorAll('[data-node-id]')).includes(row)||store.selectedId!==row.dataset.nodeId)return;await status.focusSelected();if(!disposed)refresh();};
    host.addEventListener('dblclick',focus);owned.push(()=>host.removeEventListener('dblclick',focus));
    removeTooltips=bindNodeTooltips({root,tip,timers,viewport,scrollTarget});
    // Source default live slider mode affects future explicit edits only; setLive doesn't generate.
    draft.formation.setLive(true);initializing=false;refresh();
  }catch(error){destroy();throw error;}
  return Object.freeze({refresh,refreshScene:()=>{if(!disposed&&!initializing)controls.refresh();},destroy,draft});
}

function workPanelMarkup({sampledLinks=false}={}){return `<div class="satellite-node-work-panel">
<header class="ns-scene-toolbar" aria-label="공용 지구의 내 위성 제어">
<div><button type="button" data-node-scene="home">뷰 초기화</button><button type="button" data-node-scene="focus" disabled>뷰 정렬</button><button type="button" data-node-scene="tracks" aria-pressed="false" disabled>궤적</button><button type="button" data-node-scene="links" aria-pressed="false" disabled>OISL 링크</button><button type="button" data-node-scene="models" aria-pressed="false" disabled>3D 모델</button></div>
<div class="ns-clock"><button type="button" id="node-lighting" aria-pressed="false" disabled>☀</button><span id="node-clock-mode">표시 시각 미확인</span><time id="node-clock">—</time><small>UTC</small><button type="button" id="node-clock-back" disabled>−60s</button><button type="button" id="node-clock-pause" aria-label="분석 시계 재생 상태 미확인" disabled>Ⅱ</button><button type="button" id="node-clock-forward" disabled>+60s</button><select id="node-clock-speed" aria-label="분석 배속" disabled><option value="1">×1</option><option value="10">×10</option><option value="60">×60</option><option value="600">×600</option></select><button type="button" id="node-clock-now" disabled>현재</button></div>
<div class="ns-zoom"><button type="button" id="node-zoom-in" aria-label="공용 지구 확대" disabled>+</button><input id="node-zoom" type="range" min="0" max="100" step="0.1" value="50" aria-label="공용 지구 확대 수준" disabled><button type="button" id="node-zoom-out" aria-label="공용 지구 축소" disabled>−</button></div>
</header><p class="ns-note">공용 지구와 표시 UTC를 사용합니다. Kepler+J2 모의 노드 · 실제 통신 미확인</p>
<section class="ns-formation ns-panel" aria-label="편대 배치 도구">
          <header class="ns-formation-head">
            <h2>편대 배치</h2>
            <div class="ns-preset" role="group" aria-label="배치 프리셋"><button data-formation-preset="single" aria-pressed="false">단일</button><button data-formation-preset="train" aria-pressed="false">열차형</button><button data-formation-preset="walker_delta" aria-pressed="true">Walker Δ</button><button data-formation-preset="walker_star" aria-pressed="false">Walker ★</button></div>
            <label data-tip="생성되는 위성 이름의 접두사입니다. Walker는 접두사-면기호번호(ODT-A1), 열차형은 접두사-번호(ODT-1)로 이름을 붙입니다.">이름 접두사 <input type="text" id="formation-prefix" maxlength="12" value="ODT" autocomplete="off"></label>
            <label>버스 <select id="formation-bus" aria-label="버스 프리셋" data-tip="위성 버스 프리셋"></select></label>
            <label>OISL <select id="formation-links" aria-label="OISL 링크 정책" data-tip="OISL 링크 정책"></select></label>
          </header>
          <div class="ns-sliders" id="formation-controls"></div>
          <footer class="ns-formation-foot">
            <span class="ns-spacer"></span>
            <label class="ns-live" data-tip="켜져 있으면 편대 생성 후 슬라이더를 움직일 때 같은 편대를 그 자리에서 다시 배치합니다."><input type="checkbox" id="formation-live" checked> 슬라이더 즉시 반영</label>
            <button id="formation-generate" class="ns-primary" data-tip="이 설정으로 새 편대를 작업 세트에 추가합니다.">편대 생성</button>
            <button id="formation-remove" disabled>편대 제거</button>
            <button id="nodes-clear" data-tip="작업 세트의 모든 위성을 지웁니다. 대시보드에 반영된 위성은 회수 전까지 유지됩니다.">전체 비우기</button>
            <span id="deploy-state">서버 배치 미확인</span>
            <button id="nodes-deploy" class="ns-deploy" disabled data-tip="서버 수락 경로 연결 후 명시적으로 배치합니다. 현재는 서버 배치 미확인입니다.">배치 완료 → 대시보드</button>
            <button id="nodes-recall" data-tip="서버 수락 경로 연결 후 명시적으로 회수합니다. 작업 세트는 유지됩니다." disabled>회수</button>
          </footer>
        </section>

        <aside class="ns-inspector ns-panel" aria-label="내 위성과 선택 위성">
          <header class="ns-fleet-head"><h2>내 위성 <span id="node-count" class="ns-count">0</span></h2><button id="node-add">＋ 위성 추가</button></header>
          ${sampledLinks?'<p id="node-fleet-analysis" class="ns-note" aria-live="polite" hidden></p>\n          ':''}<div id="node-fleet" class="ns-fleet" role="listbox" aria-label="내 위성 목록"></div>
          <div class="ns-detail">
            <section id="node-status" class="ns-status" aria-live="polite"></section>
            <form id="node-editor" class="ns-editor" hidden novalidate></form>
          </div>
        </aside>
        <div id="node-tip" class="ns-tip" role="tooltip" hidden></div>
</div>`;}
return Object.freeze({formationControlsMarkup,formationSummaryText,createFormationPanel,statusFrame,fleetMarkup,terminalRow,statusPresentation,createNodeStatusPanel,createNodeFleetPanel,bindNodeTooltips,createNodeDraftPanel,workPanelMarkup,createNodeSceneControls,createNodeWorkPanel});
}
