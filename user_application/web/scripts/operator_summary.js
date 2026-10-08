// Read-only presentation of server values. Colours never infer mission success.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=v=>Number.isFinite(v)?Math.min(100,Math.max(0,v)):null;
export function missionSummary(m){
 const states={planned:'계획됨',running:'수행 중',idle:'대기',paused:'일시정지',aborted:'중단',completed:'완료'};
 const p=percent(m.progress);
 return `<strong class="mission-name">임무: ${esc(m.name)}</strong><span class="status-chip" data-tone="${m.status==='running'?'active':'neutral'}">${esc(states[m.status]??m.status)}</span><span>계획 v${esc(m.plan_version)}</span><label class="mission-progress">진행률 <strong>${p===null?'미확인':esc(m.progress)+'%'}</strong>${p===null?'':`<progress max="100" value="${p}" aria-label="임무 진행률"></progress>`}</label>`;
}
export function resourceSummary(resources){
 const names={power:'전력',link:'통신',compute:'연산',storage:'저장 공간'};
 return Object.entries(resources??{}).map(([key,value])=>{const p=percent(value);return `<div class="resource-card" style="--resource-hue:${p===null?200:200-p*1.8}" title="자원 비율 색상: 낮음에서 높음, 운용 경보 기준 아님"><span>${esc(names[key]??key)}</span><strong>${esc(value)}%</strong>${p===null?'':`<progress max="100" value="${p}" aria-label="${esc(names[key]??key)} 자원"></progress>`}</div>`;}).join('');
}
export function conditionSummary(conditions){
 return `<div class="condition-heading"><strong>임무 성공 기준</strong><button type="button" class="workspace-help-button" popovertarget="mw-condition-help" aria-label="임무 성공 기준 설명">i</button><span class="status-chip" data-tone="neutral">미판정</span></div><div class="condition-targets">${(conditions??[]).map(c=>{const match=String(c).match(/(.*?)\s*[≥>=]+\s*(\d+(?:\.\d+)?)%/);return match?`<div class="condition-target"><span>${esc(match[1])}</span><strong>≥ ${esc(match[2])}%</strong><small>목표 / 미판정</small></div>`:"";}).join('')}</div><div id="mw-condition-help" popover="auto" class="mission-condition-popover workspace-help-content"><strong>계획에 설정된 성공 기준</strong><ul>${(conditions??[]).map(c=>`<li>${esc(c)}</li>`).join('')||'<li>설정 없음</li>'}</ul><p>측정 결과가 없어 충족 여부를 판정하지 않았습니다.</p></div>`;
}
export function connectionSummary(summary,labels={}){
 const names={total:'전체',connected:'연결',disconnected:'단절',pending:'대기',disabled:'사용 안 함',unknown:'미확인'};
 return Object.entries(summary).map(([key,value])=>`<div class="connection-card" data-tone="${['connected','ok','active'].includes(key)?'good':['disconnected','error','down'].includes(key)?'bad':['pending','waiting','standby'].includes(key)?'waiting':'neutral'}"><span>${esc(names[key]??labels[key]?.label??key)}</span><strong>${esc(value)}</strong></div>`).join('');
}

export function runtimeSummary(r){return r?`<div class="overview-metrics">${[['실행 상태',r.running?'실행 중':'정지'],['경과 시간',r.elapsed_seconds+' s'],['재생 배속',r.speed+'배']].map(([k,v])=>`<div class="overview-metric"><span>${k}</span><strong>${esc(v)}</strong></div>`).join('')}</div><details><summary>실행 식별 정보</summary><p>${esc(r.run_id)} / ${esc(r.scenario_id)} / 수신 순번 ${esc(r.sequence)}</p></details>`:'<span class="status-chip">실행 자료 없음</span>';}
export function eventTable(events=[]){return `<div class="sim-event-table"><table><thead><tr><th>모의실험 시각 (s)</th><th>사건</th><th>내용</th></tr></thead><tbody>${events.slice(0,12).map(e=>`<tr><td>${esc(e.simulation_time)}</td><td>${esc(e.type)}</td><td>${esc(e.message)}</td></tr>`).join('')||'<tr><td colspan="3">수신한 사건 없음</td></tr>'}</tbody></table></div>`;}
