/** Opt-in validation recorder; no runtime state or calculation ownership. */
const targets={frames:16.7,feedback:50,utcResult:100,dayResult:1000};
export function bindOrbitUiDiagnostics(button,install=()=>installOrbitUiMeasurement()){
  if(!button)return ()=>{};
  let recorder=null;
  const open=()=>{recorder??=install();recorder.show();};
  button.addEventListener('click',open);
  return ()=>button.removeEventListener('click',open);
}
export function summarizeMeasurements(raw){
  const report={gates:{}};
  for(const name of [...Object.keys(targets),'hiddenFrames']){
    const values=(raw[name]||[]).filter(Number.isFinite).sort((a,b)=>a-b);
    const rank=p=>values.length?values[Math.max(0,Math.ceil(values.length*p)-1)]:null;
    report[name]={count:values.length,p95:rank(.95),p99:rank(.99),max:values.at(-1)??null};
    if(name in targets)report.gates[name]=values.length?report[name].p95<=targets[name]:null;
  }
  const interactions=new Map();
  for(const entry of raw.eventTiming||[])if(entry.visible==='visible'&&entry.interactionId>0&&Number.isFinite(entry.duration))interactions.set(entry.interactionId,Math.max(entry.duration,interactions.get(entry.interactionId)??0));
  const durations=[...interactions.values()].sort((a,b)=>a-b);
  const rank=p=>durations.length?durations[Math.ceil(durations.length*p)-1]:null;
  report.eventTiming={count:durations.length,p95:rank(.95),p99:rank(.99),max:durations.at(-1)??null};
  report.gates.eventTiming=durations.length?report.eventTiming.p95<=50:null;
  return report;
}
export function installOrbitUiMeasurement(host=window){
  const doc=host.document,raw={frames:[],hiddenFrames:[],feedback:[],utcResult:[],dayResult:[],events:[],eventTiming:[]};
  const box=doc.createElement('aside');box.id='orbit-ui-measurement';box.className='orbit-ui-diagnostics';box.ariaLabel='브라우저 성능 진단';
  box.innerHTML='<header><strong>브라우저 성능 진단</strong><button type="button" id="measure-close" aria-label="성능 진단 닫기">닫기</button></header><p>화면의 프레임 간격과 조작 반응 시간을 측정합니다.</p><button type="button" id="measure-start">30초 프레임 측정</button><button type="button" id="measure-report">결과 기록</button><button type="button" id="measure-download">원본 기록 내려받기</button><pre id="measure-output"></pre>';doc.body.append(box);
  let frame=null,last=null,until=0,query=null,utcQuery=null,disposed=false,trial=0,eventObserver=null,eventTimingStatus='unsupported';
  const captureTiming=entries=>{for(const entry of entries){const id=entry.target?.closest?.('[id]')?.id;
    if(!id||id.startsWith('measure-'))continue;
    raw.eventTiming.push({id,name:entry.name,start:entry.startTime,duration:entry.duration,processingStart:entry.processingStart,processingEnd:entry.processingEnd,interactionId:entry.interactionId,visible:doc.visibilityState});
  }};
  if(host.PerformanceObserver?.supportedEntryTypes?.includes('event'))try{
    eventObserver=new host.PerformanceObserver(list=>captureTiming(list.getEntries()));
    eventObserver.observe({type:'event',buffered:false,durationThreshold:16});eventTimingStatus='observing';
  }catch(error){eventTimingStatus=`unavailable: ${error.message}`;eventObserver=null;}
  function output(){
    if(eventObserver)captureTiming(eventObserver.takeRecords());
    const canvas=doc.querySelector('#stored-orbit-globe canvas');let renderer='unavailable';try{const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');const debug=gl?.getExtension('WEBGL_debug_renderer_info');if(debug)renderer=gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);}catch{}
    const context={renderer,eventTiming:{status:eventTimingStatus,durationThresholdMs:16,roundingMs:8,method:'Event Timing next-paint duration; sub-threshold entries censored, missing observations never pass'},feedbackMethod:'two requestAnimationFrame callbacks: conservative presentation proxy, not Event Timing',frameMethod:'foreground RAF scheduling; GPU rendered frames not inferred',userAgent:host.navigator.userAgent,viewport:[host.innerWidth,host.innerHeight],devicePixelRatio:host.devicePixelRatio,visibility:doc.visibilityState,focused:doc.hasFocus(),date:new Date().toISOString(),hardwareConcurrency:host.navigator.hardwareConcurrency};
    const record=JSON.stringify({context,summary:summarizeMeasurements(raw),raw});
    box.querySelector('#measure-output').textContent=record;return record;
  }
  function tick(now){
    if(disposed)return;
    if(last!==null)raw[doc.visibilityState==='visible'?'frames':'hiddenFrames'].push(now-last);
    last=now;
    if(now<until)frame=host.requestAnimationFrame(tick);else{frame=null;box.querySelector('#measure-start').disabled=false;host.performance.mark?.(`orbit-frame-trial-${trial}-end`);raw.events.push({id:'frame-trial-complete',trial,end:now});output();}
  }
  box.querySelector('#measure-start').addEventListener('click',()=>{if(frame!==null)return;trial++;box.querySelector('#measure-start').disabled=true;host.performance.mark?.(`orbit-frame-trial-${trial}-start`);raw.events.push({id:'frame-trial',trial,start:host.performance.now(),viewport:[host.innerWidth,host.innerHeight],visible:doc.visibilityState,focused:doc.hasFocus()});last=null;until=host.performance.now()+30000;frame=host.requestAnimationFrame(tick);});
  box.querySelector('#measure-report').addEventListener('click',output);
  box.querySelector('#measure-download').addEventListener('click',()=>{
    const record=output(),url=host.URL.createObjectURL(new host.Blob([record],{type:'application/json'}));
    const link=doc.createElement('a');link.href=url;link.download='isdc_browser_measurements.json';doc.body.append(link);
    try{link.click();}finally{link.remove();host.setTimeout(()=>host.URL.revokeObjectURL(url),1000);}
  });
  const click=event=>{
    const id=event.target.closest('[id]')?.id;if(!id||id.startsWith('measure-'))return;
    const start=host.performance.now();
    raw.events.push({id,start,visible:doc.visibilityState});
    if(doc.visibilityState==='visible')host.requestAnimationFrame(()=>host.requestAnimationFrame(()=>{if(!disposed)raw.feedback.push(host.performance.now()-start);}));
    if(id==='visibility-query')query={start,range:[doc.querySelector('#visibility-start')?.value,doc.querySelector('#visibility-end')?.value]};
    if(['orbit-seek','orbit-epoch','orbit-calculate'].includes(id))utcQuery={start,id};
  };
  const observer=new host.MutationObserver(()=>{
    const now=host.performance.now();
    if(query&&doc.querySelector('#visibility-result')?.textContent.includes('조회 UTC')){
      // Reset result markup on query start; only completion under current query is counted.
      if(doc.querySelector('#visibility-status')?.textContent.includes('계산 중'))return;
      const delta=now-query.start;raw.events.push({id:'visibility-complete',duration:delta,range:query.range});
      if(Date.parse(query.range[1])-Date.parse(query.range[0])===86400000)raw.dayResult.push(delta);
      query=null;
    }
    if(utcQuery&&doc.querySelector('#stored-orbit-globe')?.dataset.orbitVisible==='true'&&doc.querySelector('#stored-orbit li')){
      // Selection pending renders no valid satellite; count new completed result only.
      const status=doc.querySelector('#stored-orbit [role="status"]')?.textContent||'';
      if(status.trim()==='ready'){raw.utcResult.push(now-utcQuery.start);utcQuery=null;}
    }
  });
  doc.addEventListener('click',click,true);observer.observe(doc.body,{subtree:true,childList:true,characterData:true});
  function hide(){
    if(disposed||box.hidden)return;
    const end=host.performance.now();
    if(query)raw.events.push({id:'query-observation-aborted',query_id:'visibility-query',start:query.start,end,range:query.range,reason:'diagnostics_closed'});
    if(utcQuery)raw.events.push({id:'query-observation-aborted',query_id:utcQuery.id,start:utcQuery.start,end,reason:'diagnostics_closed'});
    query=null;utcQuery=null;
    output();box.hidden=true;observer.disconnect();eventObserver?.disconnect();doc.removeEventListener('click',click,true);
  }
  function show(){
    if(disposed||!box.hidden)return;
    box.hidden=false;doc.addEventListener('click',click,true);observer.observe(doc.body,{subtree:true,childList:true,characterData:true});
    eventObserver?.observe({type:'event',buffered:false,durationThreshold:16});
  }
  box.querySelector('#measure-close').addEventListener('click',hide);
  host.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;if(frame!==null){host.cancelAnimationFrame(frame);raw.events.push({id:'frame-trial-aborted',trial,end:host.performance.now()});}observer.disconnect();eventObserver?.disconnect();doc.removeEventListener('click',click,true);});
  output();return {raw,report:output,show,hide};
}
