// Presentation for an injected, existing time owner. No clock, query or timer is created here.
export function createWorkspaceTimeDock({document,root,read,observe,actions}={}){
 if(!document||!root||typeof read!=='function'||typeof observe!=='function'||!actions)throw TypeError('explicit workspace time ports required');
 const icon=path=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
 root.classList?.add('workspace-time-dock');
 root.innerHTML=`<div class="time-dock-source"><span data-time-mode></span><time data-time-utc></time></div><div class="time-dock-controls"><button type="button" data-time-back aria-label="분석 시각 60초 뒤로">${icon('M11 5v14l-9-7zM22 5v14l-9-7z')}</button><button type="button" data-time-toggle aria-label="분석 시계 재생"></button><button type="button" data-time-forward aria-label="분석 시각 60초 앞으로">${icon('M2 5v14l9-7zM13 5v14l9-7z')}</button><label>배속 <select data-time-speed aria-label="분석 시계 배속"></select></label><button type="button" data-time-live>현재 시각</button></div><p data-time-error role="status" aria-live="polite"></p>`;
 const get=name=>root.querySelector(`[data-time-${name}]`),els=Object.fromEntries(['mode','utc','back','toggle','forward','speed','live','error'].map(k=>[k,get(k)]));
 let dead=false,busy=false,error='',generation=0;const cleanups=[];
 function snapshot(){try{return read()??{};}catch(e){error=e instanceof Error?e.message:String(e);return{};}}
 const rates=s=>Array.isArray(s.speeds)&&s.speeds.length<=16&&s.speeds.every(n=>Number.isFinite(n)&&n>0)?[...new Set(s.speeds)]:[];
 function allowed(kind,s){
  if(dead||busy||typeof s.utc!=='string'||!s.utc||typeof s.mode!=='string'||!s.mode)return false;
  if(kind==='toggle'){const name=s.running===true?'pause':'play';return typeof s.running==='boolean'&&s.capabilities?.[name]!==false&&typeof actions[name]==='function';}
  if(kind==='speed')return s.capabilities?.speed!==false&&Number.isFinite(s.speed)&&rates(s).includes(s.speed)&&typeof actions.setSpeed==='function';
  if(kind==='live')return s.capabilities?.live!==false&&(s.mode!=='SIM'||s.capabilities?.live===true)&&typeof actions.live==='function';
  return s.capabilities?.step!==false&&typeof actions.step==='function';
 }
 function refresh(){
  if(dead)return;const s=snapshot();if(dead)return;
  els.utc.textContent=s.utc||'UTC 미확인';els.mode.textContent=s.mode?`${s.mode}${typeof s.running==='boolean'?s.running?' · 재생':' · 정지':' · 재생 상태 미확인'}`:'시간 제어 미연결';
  els.toggle.innerHTML=s.running===true?icon('M6 4h4v16H6zM14 4h4v16h-4z'):icon('M7 4v16l13-8z');els.toggle.setAttribute('aria-label',s.running===true?'분석 시계 일시정지':'분석 시계 재생');
  for(const name of ['toggle','back','forward','speed','live'])els[name].disabled=!allowed(name,s);
  const choices=rates(s),key=JSON.stringify(choices);if(els.speed._timeChoices!==key){els.speed.innerHTML=choices.map(n=>`<option value="${n}">×${n}</option>`).join('');els.speed._timeChoices=key;}els.speed.value=choices.includes(s.speed)?String(s.speed):'';els.error.textContent=error;
 }
 async function perform(kind,value){
  if(dead||busy)return;const ticket=++generation,s=snapshot();if(dead||ticket!==generation||!allowed(kind,s))return;
  if(kind==='speed'&&!rates(s).includes(value))return;
  busy=true;error='';refresh();if(dead||ticket!==generation)return;
  try{if(kind==='toggle')await actions[s.running?'pause':'play']();else if(kind==='speed')await actions.setSpeed(value);else if(kind==='live')await actions.live();else await actions.step(value);}
  catch(e){if(!dead&&ticket===generation)error=e instanceof Error?e.message:String(e);}
  finally{if(!dead&&ticket===generation){busy=false;refresh();}}
 }
 const bind=(el,event,fn)=>{el.addEventListener(event,fn);cleanups.push(()=>el.removeEventListener(event,fn));};
 bind(els.toggle,'click',()=>perform('toggle'));bind(els.back,'click',()=>perform('back',-60));bind(els.forward,'click',()=>perform('forward',60));bind(els.live,'click',()=>perform('live'));bind(els.speed,'change',()=>perform('speed',Number(els.speed.value)));
 const remove=observe(refresh);if(typeof remove==='function')cleanups.push(remove);refresh();
 return Object.freeze({refresh,destroy(){if(dead)return;dead=true;generation++;for(const remove of cleanups)remove();}});
}
