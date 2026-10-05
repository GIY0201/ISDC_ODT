// Ported from the pinned senior editor; dependencies and lifecycle are owned by assembly.
export function createNodeEditorTools({library,catalogElements,now}={}) {
  if (!library || typeof catalogElements !== 'function' || typeof now !== 'function') throw new TypeError('editor_dependencies_required');
  const {BUS_PRESETS,EQUIPMENT_CATALOG,EQUIPMENT_KINDS,NODE_MODES,OISL_ROLES,createEquipment,equipmentSpec,validateNode}=library;
  const esc=value=>String(value ?? '—').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function displayNumber(value,digits=1) {
    if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return '—';
    const number=Number(value);return Number.isFinite(number)?number.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';
  }
const ORBIT_FIELDS = [
  ["altitude_km", "평균 고도", "km", 0.1, 150, 60000], ["eccentricity", "이심률", "", 0.0001, 0, 0.95], ["inclination", "경사각", "°", 0.01, 0, 180],
  ["raan", "승교점 적경", "°", 0.01, 0, 360], ["argp", "근지점 편각", "°", 0.01, 0, 360], ["mean_anomaly", "평균 근점 이각", "°", 0.01, 0, 360],
];
const POWER_FIELDS = [["generation_w", "발전 전력", "W"], ["bus_w", "버스 소비", "W"], ["battery_wh", "배터리 용량", "Wh"]];

function localDateTime(epoch) {
  const time = typeof epoch === "number" ? epoch : Date.parse(epoch);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 19) : "";
}

function modelOptionsMarkup(models, selectedKey) {
  const groups = new Map();
  for (const model of models || []) {
    const group = model.provider === "spacetwin" ? "SpaceTwin 자체 제작 대표 형상" : model.provider === "noaa_goesr" ? "NOAA/NASA GOES-R" : "NASA 3D Resources (실제 기체)";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(model);
  }
  const unavailable = selectedKey && !(models || []).some(model => model.key === selectedKey)
    ? `<option value="${esc(selectedKey)}" selected>미확인 모델 · ${esc(selectedKey)}</option>` : '';
  return unavailable + [...groups].map(([group, list]) => `<optgroup label="${esc(group)}">${list.map(model =>
    `<option value="${esc(model.key)}" ${model.key === selectedKey ? "selected" : ""}>${esc(model.label || model.title)} · ${esc(displayNumber(model.size_m, 1))} m</option>`).join("")}</optgroup>`).join("");
}

function orbitSummaryText(orbit) {
  const summary = catalogElements(orbit);
  if (!summary) return "궤도 정의가 허용 범위를 벗어났습니다.";
  return `${summary.ORBIT_REGIME} · 주기 ${displayNumber(summary.PERIOD_MINUTES, 2)} min · 근지점 ${displayNumber(summary.PERIGEE_KM, 0)} km · 원지점 ${displayNumber(summary.APOGEE_KM, 0)} km · 승교점 이동 ${displayNumber(summary.RAAN_DRIFT_DEG_PER_DAY, 3)}°/일`;
}

function equipmentRowsMarkup(draft, otherNodes) {
  const rows = (draft.equipment || []).map(item => {
    const spec = equipmentSpec(item);
    if (!spec) return "";
    const oisl = spec.kind === "oisl";
    const candidates = otherNodes.filter(node => node.id !== draft.id);
    const missingTarget = item.target && item.target !== 'auto' && !candidates.some(node => node.id === item.target)
      ? [`<option value="${esc(item.target)}" selected>미확인 상대 · ${esc(item.target)}</option>`] : [];
    const targets = [...missingTarget, `<option value="auto" ${item.target === "auto" || !item.target ? "selected" : ""}>자동 선택</option>`,
      ...candidates.map(node => `<option value="${esc(node.id)}" ${item.target === node.id ? "selected" : ""}>${esc(node.name)}</option>`)].join("");
    return `<div class="ns-eq-row ${item.enabled === false ? "off" : ""}" data-eq="${esc(item.id)}">
      <label class="ns-eq-toggle" title="사용 여부"><input type="checkbox" data-eq-enabled ${item.enabled !== false ? "checked" : ""}></label>
      <span class="ns-eq-name"><b>${esc(spec.label)}</b><small>${esc(EQUIPMENT_KINDS[spec.kind] || spec.kind)} · ${esc(spec.power_w)} W · ${esc(spec.mass_kg)} kg${oisl ? ` · ${esc(spec.data_rate_mbps / 1000)} Gbps · ${esc(spec.max_range_km)} km · 짐벌 ${esc(spec.slew_rate_deg_s)}°/s` : ""}</small></span>
      ${oisl ? `<select data-eq-role aria-label="장착 방향">${Object.entries(OISL_ROLES).map(([key, label]) => `<option value="${key}" ${item.role === key ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>
      <select data-eq-target aria-label="상대 위성">${targets}</select>` : "<span></span><span></span>"}
      <button type="button" data-eq-remove aria-label="장비 제거" title="장비 제거">×</button>
    </div>`;
  }).join("");
  return rows || `<div class="ns-empty">장비가 없습니다. 아래에서 추가하세요.</div>`;
}

function editorMarkup(draft, { models = [], otherNodes = [] } = {}) {
  const busOptions = Object.entries(BUS_PRESETS).map(([key, bus]) => `<option value="${key}" ${draft.bus === key ? "selected" : ""}>${esc(bus.label)}</option>`).join("");
  const modeOptions = Object.entries(NODE_MODES).map(([key, mode]) => `<option value="${key}" ${draft.mode === key ? "selected" : ""}>${esc(mode.label)}</option>`).join("");
  const orbitInputs = ORBIT_FIELDS.map(([key, label, unit, step, min, max]) =>
    `<label><span>${esc(label)}${unit ? ` <small>${esc(unit)}</small>` : ""}</span><input type="number" data-path="orbit.${key}" value="${esc(draft.orbit?.[key] ?? "")}" step="${step}" min="${min}" max="${max}" required></label>`).join("");
  const powerInputs = POWER_FIELDS.map(([key, label, unit]) =>
    `<label><span>${esc(label)} <small>${esc(unit)}</small></span><input type="number" data-path="power.${key}" value="${esc(draft.power?.[key] ?? "")}" step="1" min="0" required></label>`).join("");
  const equipmentOptions = Object.entries(EQUIPMENT_CATALOG).map(([key, spec]) => `<option value="${key}">${esc(spec.label)} (${esc(spec.power_w)} W)</option>`).join("");
  return `
    <header class="ns-editor-head"><span class="ns-kicker">위성 편집 · ${esc(draft.id)}</span>${draft.formation ? `<span class="ns-tag warning" title="저장하면 편대 슬라이더의 영향을 받지 않는 개별 위성이 됩니다">편대 ${esc(draft.formation.id)} 소속 · 저장 시 분리</span>` : ""}</header>
    <section class="ns-editor-section">
      <h3>1. 기본 정보</h3>
      <label><span>위성 이름</span><input type="text" data-path="name" value="${esc(draft.name)}" maxlength="40" required autocomplete="off"></label>
      <div class="ns-grid-2">
        <label><span>버스 프리셋</span><select data-path="bus">${busOptions}</select></label>
        <label><span>운용 모드</span><select data-path="mode">${modeOptions}</select></label>
      </div>
      <p class="ns-note" id="node-mode-note">${esc(NODE_MODES[draft.mode]?.note || "")}</p>
    </section>
    <section class="ns-editor-section">
      <h3>2. 3D 모델</h3>
      <label><span>표시 모델</span><select data-path="model_key" id="node-model-select">${modelOptionsMarkup(models, draft.model_key)}</select></label>
      <figure class="ns-model-preview"><img id="node-model-preview" alt="" hidden decoding="async"><figcaption id="node-model-caption">모델을 선택하면 미리보기를 표시합니다.</figcaption></figure>
    </section>
    <section class="ns-editor-section">
      <h3>3. 임무 장비 <small>OISL 단말은 장착 방향과 상대 위성을 지정합니다</small></h3>
      <div class="ns-eq-list" id="node-equipment-list">${equipmentRowsMarkup(draft, otherNodes)}</div>
      <div class="ns-eq-add"><select id="node-equipment-catalog" aria-label="추가할 장비">${equipmentOptions}</select><button type="button" id="node-equipment-add">＋ 장비 추가</button></div>
    </section>
    <section class="ns-editor-section">
      <h3>4. 궤도 <small>Kepler + J2 섭동, 정의 시각 기준</small></h3>
      <div class="ns-grid-3">${orbitInputs}</div>
      <div class="ns-grid-epoch"><label><span>정의 시각 <small>UTC</small></span><input type="datetime-local" data-path="orbit.epoch" step="1" value="${esc(localDateTime(draft.orbit?.epoch))}" required></label><button type="button" id="node-epoch-now">지금</button></div>
      <p class="ns-note" id="node-orbit-summary">${esc(orbitSummaryText(draft.orbit))}</p>
    </section>
    <section class="ns-editor-section">
      <h3>5. 전력과 질량</h3>
      <div class="ns-grid-3">${powerInputs}<label><span>건조 질량 <small>kg</small></span><input type="number" data-path="mass_kg" value="${esc(draft.mass_kg ?? "")}" step="0.1" min="0"></label></div>
      <label><span>메모</span><textarea data-path="notes" rows="2" maxlength="300">${esc(draft.notes || "")}</textarea></label>
    </section>
    <ul class="ns-errors" id="node-editor-errors" hidden></ul>
    <footer class="ns-editor-actions"><button type="button" id="node-editor-cancel">취소</button><button type="submit" class="ns-primary" id="node-editor-save">저장</button></footer>`;
}

const paths=new Set(['name','bus','mode','model_key','mass_kg','notes','orbit.epoch',...ORBIT_FIELDS.map(([key])=>`orbit.${key}`),...POWER_FIELDS.map(([key])=>`power.${key}`)]);
function setPath(target,path,value) {
  if (!paths.has(path)) return false;
  const [first,second]=path.split('.');
  if (second) target[first][second]=value; else target[first]=value;
  return true;
}
function parseField(input) {
  if (input.type==='number') return input.value.trim()===''?NaN:Number(input.value);
  if (input.type==='datetime-local') {
    const value=input.value;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return NaN;
    const canonical=value.length===16?`${value}:00`:value;
    const time=Date.parse(`${canonical}Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0,19)===canonical?time:NaN;
  }
  return input.value;
}
function createNodeEditor({form,models=()=>[],otherNodes=()=>[],onSave,onCancel,onModelChange}) {
  if (!form || typeof form.addEventListener!=='function') throw new TypeError('editor_form_required');
  let draft=null,destroyed=false,generation=0,pending=null;
  const bindings=[];
  const isOpen=()=>draft!==null && !form.hidden && !destroyed;
  function listen(element,event,fn) {
    if (!element) return;
    const version=generation;
    const guarded=e=>{if (isOpen() && version===generation && !pending) return fn(e);};
    element.addEventListener(event,guarded);bindings.push(()=>element.removeEventListener(event,guarded));
  }
  function unbind(){for(const remove of bindings.splice(0))remove();}
  function showErrors(errors) {
    const list=form.querySelector('#node-editor-errors');if (!list)return;
    list.innerHTML=errors.map(error=>`<li>${esc(error)}</li>`).join('');list.hidden=errors.length===0;
  }
  function renderEquipment(){const list=form.querySelector('#node-equipment-list');if(list)list.innerHTML=equipmentRowsMarkup(draft,otherNodes());}
  function renderPreview() {
    const description=onModelChange?.(draft.model_key)??null;
    const image=form.querySelector('#node-model-preview'),caption=form.querySelector('#node-model-caption');
    if (!image || !caption)return;
    if (description?.thumbnail){image.src=description.thumbnail;image.alt=description.alt||'';image.hidden=false;}
    else {image.removeAttribute('src');image.hidden=true;}
    caption.textContent=description?.note||'모델을 선택하면 미리보기를 표시합니다.';
  }
  function updateSummary(){const el=form.querySelector('#node-orbit-summary');if(el)el.textContent=orbitSummaryText(draft.orbit);}
  function applyBus(key) {
    if (!Object.hasOwn(BUS_PRESETS,key))return;
    const bus=BUS_PRESETS[key];draft.bus=key;draft.model_key=bus.model_key;
    draft.power={generation_w:bus.generation_w,bus_w:bus.bus_w,battery_wh:bus.battery_wh};draft.mass_kg=bus.mass_kg;
    draft.equipment=bus.equipment.map(([catalog,role])=>createEquipment(catalog,{role}));render();
  }
  function bind() {
    form.querySelectorAll('[data-path]').forEach(input=>listen(input,input.tagName==='SELECT'?'change':'input',()=>{
      const path=input.dataset.path;
      if(path==='bus'){applyBus(input.value);return;}
      if(!setPath(draft,path,parseField(input)))return;
      if(path==='model_key')renderPreview();
      if(path==='mode'){const el=form.querySelector('#node-mode-note');if(el)el.textContent=NODE_MODES[draft.mode]?.note||'';}
      if(path.startsWith('orbit.'))updateSummary();
    }));
    listen(form.querySelector('#node-epoch-now'),'click',()=>{
      const time=now();if(typeof time!=='number'||!Number.isFinite(time)||!Number.isFinite(new Date(time).getTime())){showErrors(['정의 시각을 확인할 수 없습니다.']);return;}
      draft.orbit.epoch=time;const input=form.querySelector('[data-path="orbit.epoch"]');if(input)input.value=localDateTime(time);updateSummary();
    });
    listen(form.querySelector('#node-equipment-add'),'click',()=>{
      const key=form.querySelector('#node-equipment-catalog')?.value;if(!Object.hasOwn(EQUIPMENT_CATALOG,key))return;
      draft.equipment=[...(draft.equipment||[]),createEquipment(key)];renderEquipment();
    });
    listen(form.querySelector('#node-equipment-list'),'click',event=>{
      const button=event.target.closest('[data-eq-remove]');if(!button)return;
      const id=button.closest('[data-eq]')?.dataset.eq;draft.equipment=(draft.equipment||[]).filter(item=>item.id!==id);renderEquipment();
    });
    listen(form.querySelector('#node-equipment-list'),'change',event=>{
      const row=event.target.closest('[data-eq]'),item=(draft.equipment||[]).find(item=>item.id===row?.dataset.eq);if(!item)return;
      if(event.target.matches('[data-eq-role]')&&Object.hasOwn(OISL_ROLES,event.target.value))item.role=event.target.value;
      if(event.target.matches('[data-eq-target]')&&event.target.value!==draft.id)item.target=event.target.value;
      if(event.target.matches('[data-eq-enabled]')){item.enabled=event.target.checked;row.classList.toggle('off',!item.enabled);}
    });
    listen(form.querySelector('#node-editor-cancel'),'click',()=>{close();onCancel?.();});
  }
  function render(){unbind();form.innerHTML=editorMarkup(draft,{models:models(),otherNodes:otherNodes()});bind();renderPreview();}
  function invalidate(){generation++;pending?.abort();pending=null;unbind();form.removeAttribute('aria-busy');}
  function open(node,{focus=true}={}) {
    if(destroyed)throw new Error('editor_disposed');
    const copy=structuredClone(node),errors=validateNode(copy);if(errors.length)throw new Error(errors.join('; '));
    invalidate();draft=copy;form.hidden=false;render();if(focus)form.querySelector('[data-path="name"]')?.focus();
  }
  function close(){invalidate();draft=null;form.hidden=true;form.innerHTML='';}
  async function submit(event) {
    event.preventDefault();if(!isOpen()||pending)return;
    const errors=validateNode(draft);if(errors.length){showErrors(errors);return;}
    if(typeof onSave!=='function'){showErrors(['저장 담당자가 연결되지 않았습니다.']);return;}
    const version=generation,controller=new AbortController();pending=controller;
    const controls=[...form.querySelectorAll('input,select,textarea,button')],disabled=controls.map(control=>control.disabled);
    controls.forEach(control=>control.disabled=true);form.setAttribute('aria-busy','true');
    try {
      const result=await onSave(structuredClone(draft),{signal:controller.signal});
      if(version!==generation||controller.signal.aborted||destroyed)return;
      if(!Array.isArray(result)||result.some(error=>typeof error!=='string'))showErrors(['저장 완료 응답을 확인할 수 없습니다.']);
      else if(result.length)showErrors(result);else close();
    } catch(error) {
      if(version===generation&&!controller.signal.aborted&&!destroyed)showErrors([error instanceof Error?error.message:'저장에 실패했습니다.']);
    } finally {
      if(version===generation&&!destroyed){pending=null;controls.forEach((control,i)=>control.disabled=disabled[i]);form.removeAttribute('aria-busy');}
    }
  }
  form.addEventListener('submit',submit);
  function destroy(){if(destroyed)return;close();destroyed=true;form.removeEventListener('submit',submit);}
  return {open,close,destroy,isOpen,showErrors,get draft(){return draft===null?null:structuredClone(draft);}};
}
return Object.freeze({modelOptionsMarkup,orbitSummaryText,equipmentRowsMarkup,editorMarkup,createNodeEditor});
}
