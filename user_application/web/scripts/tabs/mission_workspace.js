import {missionSummary,resourceSummary,conditionSummary} from '../operator_summary.js?v=u016';
const copy=value=>structuredClone(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lanes=['관측','처리','저장','전송','검증'];
const statuses=['planned','running','done','blocked'];
const draft=()=>({task_id:'',name:'',lane:'관측',start:'0',duration:'10',status:'planned',predecessor:'',priority:'5'});
function mission(value){
  if(!value||typeof value.id!=='string'||!value.id||typeof value.name!=='string'||!Array.isArray(value.tasks)||!Number.isFinite(value.progress)||!Number.isInteger(value.plan_version)||!['planned','running','idle','paused','aborted','completed'].includes(value.status))throw Error('임무 응답 형식 오류');
  for(const t of value.tasks)if(!t||typeof t.id!=='string'||typeof t.name!=='string'||!lanes.includes(t.lane)||!Number.isFinite(t.start)||!Number.isFinite(t.duration)||!statuses.includes(t.status))throw Error('작업 응답 형식 오류');
  return copy(value);
}
function validation(value,id){if(!value||value.mission_id!==id||typeof value.valid!=='boolean'||!Number.isInteger(value.plan_version)||!Array.isArray(value.conflicts)||value.conflict_count!==value.conflicts.length)throw Error('임무 검증 응답 오류');return copy(value);}

export function createMissionWorkspace(api,changed=()=>{}){
  let state={missions:[],selected:'',draft:draft(),validation:null,preview:null,busy:false,status:'서버 임무를 불러오세요.',error:''},ended=false;
  const selected=()=>state.missions.find(m=>m.id===state.selected);
  function install(value,id){const next=mission(value);if(next.id!==id)throw Error('다른 임무 응답을 거부했습니다.');state.missions=state.missions.map(m=>m.id===id?next:m);}
  async function run(work,label){
    if(ended||state.busy)return;
    state.busy=true;state.error='';changed();
    try{const update=await work();if(!ended){update();state.status=label;}}
    catch(error){if(!ended){state.preview=null;state.validation=null;state.error=`${error.message} · 명령 적용 여부가 불확실하면 서버 새로고침으로 확인하세요.`;state.status='실패';}}
    finally{if(!ended){state.busy=false;changed();}}
  }
  const controller={
    snapshot:()=>copy(state),
    receiveMissions(values){if(ended||state.busy)return;const list=values.map(mission);if(new Set(list.map(m=>m.id)).size!==list.length)throw Error('중복 임무 ID');if(JSON.stringify(list)===JSON.stringify(state.missions))return;const old=selected();state.missions=list;const current=selected();if(old&&current&&JSON.stringify(old)!==JSON.stringify(current)){state.validation=null;state.preview=null;state.status='서버 임무 갱신 · 검증/미리보기 다시 조회';}if(!current){state.selected=list[0]?.id||'';state.draft=draft();state.validation=null;state.preview=null;changed();}else changed('telemetry');},
    load:()=>run(async()=>{const result=await api.bootstrap();if(!Array.isArray(result?.missions))throw Error('임무 목록 응답 오류');const list=result.missions.map(mission);if(new Set(list.map(m=>m.id)).size!==list.length)throw Error('중복 임무 ID');return()=>{state.missions=list;state.selected=list.some(m=>m.id===state.selected)?state.selected:list[0]?.id||'';state.validation=null;state.preview=null;};},'서버 임무 갱신 완료'),
    select(id){if(ended||state.busy||!state.missions.some(m=>m.id===id))return;state.selected=id;state.draft=draft();state.preview=null;state.validation=null;state.error='';changed();},
    edit(values){if(ended||state.busy)return;for(const key of Object.keys(state.draft))if(key in values)state.draft[key]=String(values[key]??'');state.preview=null;changed('draft');},
    chooseTask(id){if(ended||state.busy)return;const t=selected()?.tasks.find(t=>t.id===id);state.draft=t?{...draft(),...Object.fromEntries(['name','lane','start','duration','status','predecessor','priority'].map(k=>[k,String(t[k]??draft()[k])])),task_id:t.id}:draft();state.preview=null;changed();},
    save(remove=false){return run(async()=>{
      const id=state.selected,d=copy(state.draft);if(!selected())throw Error('임무를 선택하세요.');
      const p={mission_id:id,operation:remove?'delete':d.task_id?'update':'create',task_id:d.task_id||null};
      if(remove){if(!d.task_id)throw Error('삭제할 작업을 선택하세요.');}
      else{for(const key of ['start','duration','priority'])if(!d[key].trim()||!Number.isFinite(Number(d[key])))throw Error(`${key} 숫자를 확인하세요.`);
        const start=Number(d.start),duration=Number(d.duration),priority=Number(d.priority);
        if(start<0||start>100||duration<=0||duration>100||!Number.isInteger(priority)||priority<1||priority>10)throw Error('start 0~100 / duration(기간) 0 초과~100 / priority 1~10을 확인하세요.');
        if(!d.name.trim()||d.name.trim().length>120||!lanes.includes(d.lane)||!statuses.includes(d.status)||d.predecessor.length>80)throw Error('작업 이름·영역·상태·선행 ID를 확인하세요.');
        Object.assign(p,{name:d.name.trim(),lane:d.lane,start,duration,priority,status:d.status,predecessor:d.predecessor.trim()});
      }
      const result=await api.missionTask(p);const v=validation(result.validation,id);const m=mission(result.mission);if(m.id!==id||v.plan_version!==m.plan_version)throw Error('임무 편집 버전 응답 오류');
      return()=>{install(m,id);state.validation=v;state.preview=null;if(remove)state.draft=draft();else if(!d.task_id)state.draft=draft();};
    },remove?'작업 삭제 완료':'작업 저장 완료');},
    validate:()=>run(async()=>{const id=state.selected;if(!selected())throw Error('임무를 선택하세요.');const result=validation(await api.validateMission(id),id);return()=>{state.validation=result;};},'현재 계획 충돌 검사 완료'),
    preview:()=>run(async()=>{const id=state.selected;if(!selected())throw Error('임무를 선택하세요.');const result=await api.replanMission(id,false);const m=mission(result.mission);validation(result.validation,id);if(result.applied!==false||m.id!==id||!Array.isArray(result.diff))throw Error('재계획 미리보기 응답 오류');return()=>{install(m,id);state.validation=copy(result.validation);state.preview=copy(result);};},'시각 변경 제안 조회 완료 · 아직 미적용'),
    apply:()=>run(async()=>{const id=state.selected;if(!selected()||!state.preview||state.preview.mission.id!==id)throw Error('먼저 재계획 미리보기를 조회하세요.');const result=await api.replanMission(id,true);const m=mission(result.mission),v=validation(result.validation,id);if(result.applied!==true||m.id!==id||v.plan_version!==m.plan_version||!Array.isArray(result.diff))throw Error('재계획 적용 응답 오류');return()=>{install(m,id);state.validation=v;state.preview=null;};},'최신 서버 계획에서 재계산·적용 완료'),
    action(action){return run(async()=>{const id=state.selected;if(!selected()||!['start','pause','replan','abort','complete'].includes(action))throw Error('임무와 동작을 확인하세요.');const result=mission(await api.missionAction(id,action));if(result.id!==id)throw Error('다른 임무 응답');return()=>{install(result,id);state.preview=null;state.validation=null;};},`SIM 임무 ${action} 완료`);},
    destroy(){ended=true;}
  };
  return controller;
}

export function createMissionPanel(api){
  const document=globalThis.document;
  let view=null,last='',autoLoaded=false;
  const controller=createMissionWorkspace(api,draw);
  function draw(reason){
    if(view!=='mission')return;
    const screen=document.getElementById('screen');let panel=document.getElementById('mission-workspace');
    if(!panel){screen.innerHTML='';panel=document.createElement('section');panel.id='mission-workspace';panel.className='panel';screen.prepend(panel);last='';}
    const s=controller.snapshot(),m=s.missions.find(m=>m.id===s.selected),d=s.draft,disabled=s.busy||!m;
    const options=(values,current)=>values.map(value=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(value)}</option>`).join('');
    const field=(key,label,type='text')=>`<label>${label}<input id="mw-${key}" type="${type}" ${type==='number'?`step="${key==='priority'?'1':'any'}"`:''} value="${esc(d[key])}" ${disabled?'disabled':''}></label>`;
    const v=s.validation,p=s.preview;
    const html=`<header><h2>임무 관리 · 기존 SIM</h2><small>서버 임무 / 실명령·AI 아님</small></header><div class="body">
      <div class="actions"><label class="form">임무 <select id="mw-mission" ${s.busy?'disabled':''}>${s.missions.length?s.missions.map(item=>`<option value="${esc(item.id)}" ${item.id===s.selected?'selected':''}>${esc(item.id)} · ${esc(item.name)}</option>`).join(''):'<option value="">임무 없음</option>'}</select></label><button class="button" id="mw-refresh" ${s.busy?'disabled':''}>서버 새로고침</button></div>
      <p id="mw-feedback" role="status">${esc(s.status)} ${esc(s.error)}</p>
      ${m?`<div id="mw-summary" class="mission-summary">${missionSummary(m)}</div><div id="mw-resources" class="resource-summary">${resourceSummary(m.resources)}</div><div id="mw-conditions">${conditionSummary(m.success_conditions)}</div>`:''}
      <div class="actions">${['start','pause','replan','abort','complete'].map((action,i)=>`<button class="button" id="mw-action-${action}" ${disabled?'disabled':''}>${['실행','일시정지','재계획 상태 전환','중단','완료'][i]}</button>`).join('')}</div>
      <p>계획 축 0~100 · 원본에 물리 시간 단위가 지정되지 않았습니다.</p>
      <label class="form">작업 편집 <select id="mw-task" ${disabled?'disabled':''}><option value="">새 작업</option>${(m?.tasks||[]).map(t=>`<option value="${esc(t.id)}" ${t.id===d.task_id?'selected':''}>${esc(t.id)} · ${esc(t.name)}</option>`).join('')}</select></label>
      <form id="mw-form" class="form"><div class="pair">${field('name','작업 이름')}<label>영역 <select id="mw-lane" ${disabled?'disabled':''}>${options(lanes,d.lane)}</select></label></div><div class="pair">${field('start','시작 (계획 축)','number')}${field('duration','기간 (계획 축)','number')}</div><div class="pair"><label>상태 <select id="mw-status" ${disabled?'disabled':''}>${options(statuses,d.status)}</select></label>${field('priority','우선순위 1~10','number')}</div>${field('predecessor','선행 작업 ID · 빈 값은 해제')}<div class="actions"><button class="button" id="mw-save" type="submit" ${disabled?'disabled':''}>${d.task_id?'작업 수정':'작업 추가'}</button><button class="button" id="mw-delete" type="button" ${disabled||!d.task_id?'disabled':''}>선택 작업 삭제</button></div></form>
      <div class="cp-table"><table><thead><tr><th>작업</th><th>영역</th><th>시작</th><th>기간</th><th>선행</th><th>상태</th></tr></thead><tbody id="mw-task-rows">${(m?.tasks||[]).map(t=>`<tr><td>${esc(t.id)} · ${esc(t.name)}</td><td>${esc(t.lane)}</td><td>${t.start}</td><td>${t.duration}</td><td>${esc(t.predecessor||'없음')}</td><td>${esc(t.status)}</td></tr>`).join('')}</tbody></table></div>
      <div class="actions"><button class="button" id="mw-validate" ${disabled?'disabled':''}>현재 계획 충돌 검사</button><button class="button" id="mw-preview" ${disabled?'disabled':''}>규칙 기반 재계획 미리보기</button><button class="button" id="mw-apply" ${disabled||!p?'disabled':''}>최신 계획에서 재계산·적용</button></div>
      <div id="mw-validation">${v?`<p>현재 계획 v${v.plan_version} · 충돌 ${v.conflict_count}건 · ${v.valid?'통과':'충돌 있음'}</p><ul>${v.conflicts.map(c=>`<li>${esc(c.type)} · ${esc(c.message)} · ${esc((c.task_ids||[]).join(', '))}</li>`).join('')}</ul>`:'<p>현재 계획 검증 결과 없음</p>'}</div>
      <div id="mw-preview-result">${p?`<p>미적용 시각 변경 제안 ${p.diff.length}개 · 기준 PLAN v${p.mission.plan_version}</p><ul>${p.diff.map(x=>`<li>${esc(x.task_id)}: ${esc(x.before)} → ${esc(x.after)}</li>`).join('')}</ul>`:''}</div>
      <details><summary>계획 미리보기 안내</summary><p class="small muted">미리보기의 충돌 판정은 현재 계획 기준입니다. 미리보기는 계획을 바꾸지 않고 조회 이벤트를 남깁니다. 적용은 최신 서버 계획을 재계산하며, 다른 창의 변경이 있으면 제안과 달라질 수 있습니다. 서버 새로고침으로 최신 상태를 확인하세요.</p></details></div>`;
    if(reason==='telemetry'&&m){
      // A server update must not replace the form nodes or the local task draft.
      const put=(id,text)=>{const node=panel.querySelector('#'+id);if(node)node.textContent=text;};
      const summary=panel.querySelector('#mw-summary');if(summary)summary.innerHTML=missionSummary(m);
      put('mw-feedback',`${s.status} ${s.error}`);
      const resources=panel.querySelector('#mw-resources');if(resources)resources.innerHTML=resourceSummary(m.resources);
      const conditions=panel.querySelector('#mw-conditions');if(conditions)conditions.innerHTML=conditionSummary(m.success_conditions);
      const rows=panel.querySelector('#mw-task-rows');if(rows)rows.innerHTML=(m.tasks||[]).map(t=>`<tr><td>${esc(t.id)} · ${esc(t.name)}</td><td>${esc(t.lane)}</td><td>${t.start}</td><td>${t.duration}</td><td>${esc(t.predecessor||'없음')}</td><td>${esc(t.status)}</td></tr>`).join('');
      const task=panel.querySelector('#mw-task');if(task){task.innerHTML='<option value="">새 작업</option>'+(m.tasks||[]).map(t=>`<option value="${esc(t.id)}">${esc(t.id)} · ${esc(t.name)}</option>`).join('');task.value=m.tasks.some(t=>t.id===d.task_id)?d.task_id:'';}
      if(!v){const validation=panel.querySelector('#mw-validation');if(validation)validation.innerHTML='<p>현재 계획 검증 결과 없음</p>';}
      const output=panel.querySelector('#mw-preview-result');if(!p&&output)output.innerHTML='';
      const apply=panel.querySelector('#mw-apply');if(apply)apply.disabled=disabled||!p;
      last=html;return;
    }
    if(reason==='draft'){
      // Preserve the native input node while typing intermediate decimal values.
      const output=panel.querySelector('#mw-preview-result');if(output)output.innerHTML='';
      const apply=panel.querySelector('#mw-apply');if(apply)apply.disabled=true;
      last=html;return;
    }
    if(last===html)return;
    const active=document.activeElement,focus=active?.id,a=active?.selectionStart,b=active?.selectionEnd,scroll=screen.scrollTop;
    panel.innerHTML=html;last=html;screen.scrollTop=scroll;
    const bind=(id,event,fn)=>panel.querySelector('#'+id)?.addEventListener(event,fn);
    bind('mw-refresh','click',()=>controller.load());bind('mw-mission','change',e=>controller.select(e.target.value));bind('mw-task','change',e=>controller.chooseTask(e.target.value));
    for(const key of Object.keys(d).filter(k=>k!=='task_id'))bind('mw-'+key,['lane','status'].includes(key)?'change':'input',e=>controller.edit({[key]:e.target.value}));
    bind('mw-form','submit',e=>{e.preventDefault();return controller.save();});bind('mw-delete','click',()=>controller.save(true));
    for(const action of ['start','pause','replan','abort','complete'])bind('mw-action-'+action,'click',()=>controller.action(action));
    for(const action of ['validate','preview','apply'])bind('mw-'+action,'click',()=>controller[action]());
    if(focus?.startsWith('mw-')){const restored=panel.querySelector('#'+focus);restored?.focus();if(typeof a==='number'&&restored?.setSelectionRange&&restored.type==='text')restored.setSelectionRange(a,b);}
  }
  return {show(next){view=next;if(view==='mission'){draw();if(!autoLoaded){autoLoaded=true;controller.load();}}},update:draw,destroy:()=>controller.destroy(),applyDraft(items,remote=false){for(const item of items){if(remote){const s=controller.snapshot();if(item.mission_id!==s.selected||item.task_id!==s.draft.task_id)continue;}if(typeof item?.value!=='string'||!item.id?.startsWith('mw-'))continue;const key=item.id.slice(3);if(Object.keys(draft()).includes(key)&&key!=='task_id'){controller.edit({[key]:item.value});const field=document.getElementById(item.id);if(field&&!controller.snapshot().busy)field.value=item.value;}}},controller};
}
