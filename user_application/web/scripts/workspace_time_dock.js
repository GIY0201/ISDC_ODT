// Analysis controls use the existing owner. The system-time ticker only paints current UTC/KST.
export function createWorkspaceTimeDock({document,root,read,observe,actions,now=()=>Date.now(),setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimer=id=>globalThis.clearTimeout(id)}={}){
 if(!document||!root||typeof read!=='function'||typeof observe!=='function'||!actions)throw TypeError('explicit workspace time ports required');
 const icon=path=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
 root.classList?.add('workspace-time-dock');
 root.innerHTML=`<div class="time-dock-heading"><button type="button" class="time-dock-title" data-time-display-toggle aria-haspopup="true" aria-expanded="false" aria-controls="workspace-time-display-menu">현재 시각</button><div id="workspace-time-display-menu" class="time-dock-display-menu" data-time-display-menu hidden><button type="button" data-time-display-current>현재 시각</button><button type="button" data-time-display-analysis>궤도 분석 시각</button><button type="button" data-time-display-both>둘 다</button></div></div><div class="time-dock-clocks"><div class="time-dock-current" data-time-current-group><b>현재 시각</b><div class="time-dock-zones"><div><b>UTC</b><time data-time-current-utc></time><span data-time-current-date></span></div><div><b>KST</b><time data-time-current-kst></time><span data-time-current-kst-date></span></div></div></div><div class="time-dock-source time-dock-analysis" data-time-analysis-group><b>궤도 분석 시각</b><div class="time-dock-zones"><div><b>UTC</b><time data-time-utc></time><span data-time-date></span></div><div><b>KST</b><time data-time-kst></time><span data-time-kst-date></span></div></div><span data-time-mode></span></div></div><div class="time-dock-controls" data-time-controls><button type="button" data-time-back aria-label="분석 시각 60초 뒤로">${icon('M11 5v14l-9-7zM22 5v14l-9-7z')}</button><button type="button" data-time-toggle aria-label="분석 시계 재생"></button><button type="button" data-time-forward aria-label="분석 시각 60초 앞으로">${icon('M2 5v14l9-7zM13 5v14l9-7z')}</button><label>배속 <select data-time-speed aria-label="분석 시계 배속"></select></label><button type="button" data-time-live>분석을 현재로 맞춤</button></div><p data-time-error role="status" aria-live="polite"></p>`;
 const get=name=>root.querySelector(`[data-time-${name}]`),els=Object.fromEntries(['display-toggle','display-menu','display-current','display-analysis','display-both','current-group','analysis-group','controls','current-utc','current-date','current-kst','current-kst-date','mode','utc','date','kst','kst-date','back','toggle','forward','speed','live','error'].map(k=>[k,get(k)]));
 let dead=false,busy=false,error='',generation=0,currentTimer=null,currentEpoch=0,displayMode='current';const cleanups=[];
 function paintCurrent(){const ticket=currentEpoch;let utc=null;try{const value=now();if(Number.isFinite(value))utc=new Date(value).toISOString();}catch{}if(dead||ticket!==currentEpoch)return;for(const [zone,offset] of [['utc',0],['kst',32400000]]){let value=null;try{if(utc)value=new Date(Date.parse(utc)+offset).toISOString();}catch{}els['current-'+zone].textContent=value?.slice(11,19)||'--:--:--';els[zone==='utc'?'current-date':'current-kst-date'].textContent=value?.slice(0,10)||'시스템 시각 미확인';els['current-'+zone].setAttribute('datetime',utc||'');}}
 function stopCurrent(){currentEpoch++;if(currentTimer){clearTimer(currentTimer.id);currentTimer=null;}}
 function startCurrent(){if(dead||document.hidden||currentTimer)return;const owned={id:null,epoch:currentEpoch};currentTimer=owned;owned.id=setTimer(()=>{if(dead||document.hidden||currentTimer!==owned||owned.epoch!==currentEpoch)return;currentTimer=null;paintCurrent();startCurrent();},1000);owned.id?.unref?.();}
 const visibility=()=>{stopCurrent();if(!dead&&!document.hidden){paintCurrent();startCurrent();}};
 document.addEventListener?.('visibilitychange',visibility);cleanups.push(()=>document.removeEventListener?.('visibilitychange',visibility));
 function snapshot(){try{return read()??{};}catch(e){error=e instanceof Error?e.message:String(e);return{};}}
 const rates=s=>Array.isArray(s.speeds)&&s.speeds.length<=16&&s.speeds.every(n=>Number.isFinite(n)&&n>0)?[...new Set(s.speeds)]:[];
 function allowed(kind,s){
  if(dead||busy||displayMode==='current'||typeof s.utc!=='string'||!s.utc||typeof s.mode!=='string'||!s.mode)return false;
  if(kind==='toggle'){const name=s.running===true?'pause':'play';return typeof s.running==='boolean'&&s.capabilities?.[name]!==false&&typeof actions[name]==='function';}
  if(kind==='speed')return s.capabilities?.speed!==false&&Number.isFinite(s.speed)&&rates(s).includes(s.speed)&&typeof actions.setSpeed==='function';
  if(kind==='live')return s.capabilities?.live!==false&&(s.mode!=='SIM'||s.capabilities?.live===true)&&typeof actions.live==='function';
  return s.capabilities?.step!==false&&typeof actions.step==='function';
 }
 function refresh(){
  if(dead)return;const s=snapshot();if(dead)return;
  const stamp=typeof s.utc==='string'?s.utc.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/):null;els.utc.textContent=stamp?.[2]||'--:--:--';els.date.textContent=stamp?.[1]||'표시 시각 없음';const hour=stamp?Number(stamp[2].slice(0,2))+9:null;els.kst.textContent=stamp?String(hour%24).padStart(2,'0')+stamp[2].slice(2):'--:--:--';els['kst-date'].textContent=stamp?new Date(Date.parse(stamp[1]+'T00:00:00Z')+Math.floor(hour/24)*86400000).toISOString().slice(0,10):'표시 시각 없음';els.utc.setAttribute('datetime',stamp?s.utc:'');els.utc.setAttribute('title',stamp?s.utc:'표시 시각 없음');els.mode.textContent=s.mode?`${s.mode}${typeof s.running==='boolean'?s.running?' · 재생':' · 정지':' · 재생 상태 미확인'}`:'시간 원천 미연결';
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
 function closeDisplayMenu(){els['display-menu'].hidden=true;els['display-toggle'].setAttribute('aria-expanded','false');}
 function chooseDisplayMode(mode){if(dead||!['current','analysis','both'].includes(mode))return;displayMode=mode;root.dataset.displayMode=mode;els['current-group'].hidden=mode==='analysis';els['analysis-group'].hidden=mode==='current';els.controls.hidden=mode==='current';els['display-toggle'].textContent=mode==='current'?'현재 시각':mode==='analysis'?'궤도 분석 시각':'현재 시각 · 궤도 분석 시각';for(const option of ['current','analysis','both'])els['display-'+option].setAttribute('aria-pressed',String(option===mode));closeDisplayMenu();refresh();}
 const bind=(el,event,fn)=>{el.addEventListener(event,fn);cleanups.push(()=>el.removeEventListener(event,fn));};
 bind(els['display-toggle'],'click',()=>{if(dead)return;els['display-menu'].hidden=!els['display-menu'].hidden;els['display-toggle'].setAttribute('aria-expanded',String(!els['display-menu'].hidden));if(!els['display-menu'].hidden)els['display-'+displayMode].focus?.();});
 for(const mode of ['current','analysis','both'])bind(els['display-'+mode],'click',()=>chooseDisplayMode(mode));
 const closeOnEscape=event=>{if(dead)return;if(event.key==='Escape'){closeDisplayMenu();els['display-toggle'].focus?.();}};for(const name of ['display-toggle','display-current','display-analysis','display-both'])bind(els[name],'keydown',closeOnEscape);
 chooseDisplayMode('current');
 bind(els.toggle,'click',()=>perform('toggle'));bind(els.back,'click',()=>perform('back',-60));bind(els.forward,'click',()=>perform('forward',60));bind(els.live,'click',()=>perform('live'));bind(els.speed,'change',()=>perform('speed',Number(els.speed.value)));
 const remove=observe(refresh);if(typeof remove==='function')cleanups.push(remove);refresh();paintCurrent();startCurrent();
 return Object.freeze({refresh,destroy(){if(dead)return;dead=true;generation++;stopCurrent();for(const remove of cleanups)remove();}});
}
