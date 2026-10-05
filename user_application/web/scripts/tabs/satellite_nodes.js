// Senior node-panel presentation and formation editing; no global scene or time owner.
export function createSatelliteNodePanelTools({library}={}) {
  if(!library)throw new TypeError('node_panel_library_required');
  const {BUS_PRESETS,FORMATION_CONTROLS,FORMATION_DEFAULTS,FORMATION_PRESETS,LINK_POLICIES}=library;
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
  const owned=[],fields=[],invalidInputs=new Set();
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
      if(!invalidInputs.has(label.dataset.control)){range.value=String(Math.min(Number(range.max),params[label.dataset.control]));number.value=String(params[label.dataset.control]);}
    });
    for(const [id,key]of [['formation-prefix','prefix'],['formation-bus','bus'],['formation-links','link_policy']]){const field=get(`#${id}`);if(field&&!invalidInputs.has(key))field.value=params[key];}
    root?.querySelectorAll('[data-formation-preset]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.formationPreset===params.preset));button.dataset.tip=FORMATION_PRESETS[button.dataset.formationPreset]?.note||'';});
    const checkbox=get('#formation-live');if(checkbox)checkbox.checked=live;hints();
  }
  function publish(){syncFields();onChange(snapshot());}
  function render(){
    for(const remove of fields.splice(0))remove();
    const host=get('#formation-controls');if(host){host.innerHTML=formationControlsMarkup(params);host.querySelectorAll('.ns-slider').forEach(label=>{
      const key=label.dataset.control,[range,number]=label.querySelectorAll('input');
      bind(range,'input',()=>change(key,range.value),fields);bind(number,'change',()=>change(key,number.value),fields);
    });}publish();
  }
  function schedule(){
    cancel();if(invalidInputs.size||!live||!activeFormationId||!store.drafts.some(node=>node.formation?.id===activeFormationId))return;
    const current=version,id=activeFormationId;
    timer=timers.set(()=>{if(destroyed||current!==version||!live||activeFormationId!==id)return;timer=null;generate(id);},120);
  }
  function change(key,value){
    requireOpen();const control=FORMATION_CONTROLS.find(control=>control.key===key);
    if(control){if(!controlEnabled(control,params)||(typeof value!=='number'&&typeof value!=='string')||(typeof value==='string'&&!value.trim())||!Number.isFinite(Number(value)))return invalid(key,'유효한 편대 숫자를 입력하세요.');value=Number(value);}
    else if(key==='preset'){if(!Object.hasOwn(FORMATION_PRESETS,value))return invalid(key,'편대 프리셋을 확인하세요.');}
    else if(key==='bus'){if(!Object.hasOwn(BUS_PRESETS,value))return invalid(key,'버스 프리셋을 확인하세요.');}
    else if(key==='link_policy'){if(!Object.hasOwn(LINK_POLICIES,value))return invalid(key,'링크 정책을 확인하세요.');}
    else if(key==='prefix'){if(typeof value!=='string')return invalid(key,'편대 이름을 확인하세요.');}
    else return invalid(key,'알 수 없는 편대 입력입니다.');
    invalidInputs.delete(key);if(key==='preset')invalidInputs.clear();
    params=library.normalizeFormationParams({...params,[key]:value,...(key==='preset'&&value==='walker_star'?{raan_spread:180}:{})});
    if(key==='preset')render();else publish();schedule();return true;
  }
  function generate(formationId=null){
    requireOpen();cancel();
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
    cancel();invalidInputs.clear();activeFormationId=id;
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
    for(const [id,key]of [['formation-prefix','prefix'],['formation-bus','bus'],['formation-links','link_policy']]){const field=get(`#${id}`);bind(field,'change',()=>change(key,field.value));}
    const checkbox=get('#formation-live');bind(checkbox,'change',()=>setLive(checkbox.checked));
    bind(get('#formation-generate'),'click',()=>generate());bind(get('#formation-remove'),'click',()=>remove());render();
  }
  return Object.freeze({change,generate,setLive,adopt,remove,destroy,snapshot});
}
return Object.freeze({formationControlsMarkup,formationSummaryText,createFormationPanel});
}
