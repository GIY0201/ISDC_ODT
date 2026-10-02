/** Opt-in validation recorder; no runtime state or calculation ownership. */
const targets={frames:16.7,feedback:50,utcResult:100,dayResult:1000};
export function summarizeMeasurements(raw){
  const report={gates:{}};
  for(const name of [...Object.keys(targets),'hiddenFrames']){
    const values=(raw[name]||[]).filter(Number.isFinite).sort((a,b)=>a-b);
    const rank=p=>values.length?values[Math.max(0,Math.ceil(values.length*p)-1)]:null;
    report[name]={count:values.length,p95:rank(.95),p99:rank(.99),max:values.at(-1)??null};
    if(name in targets)report.gates[name]=values.length?report[name].p95<=targets[name]:null;
  }
  return report;
}
export function installOrbitUiMeasurement(host=window){
  const doc=host.document,raw={frames:[],hiddenFrames:[],feedback:[],utcResult:[],dayResult:[],events:[]};
  const box=doc.createElement('aside');box.id='orbit-ui-measurement';box.style.cssText='position:fixed;top:0;right:0;z-index:10000;background:#fff;color:#111;max-width:420px;max-height:200px;overflow:auto;font:12px monospace;padding:5px';
  box.innerHTML='<button id="measure-start">30초 프레임 측정</button><button id="measure-report">결과 기록</button><pre id="measure-output"></pre>';doc.body.append(box);
  let frame=null,last=null,until=0,query=null,utcQuery=null,disposed=false;
  function output(){
    const canvas=doc.querySelector('#stored-orbit-globe canvas');let renderer='unavailable';try{const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');const debug=gl?.getExtension('WEBGL_debug_renderer_info');if(debug)renderer=gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);}catch{}
    const context={renderer,feedbackMethod:'two requestAnimationFrame callbacks: conservative presentation proxy, not Event Timing',frameMethod:'foreground RAF scheduling; GPU rendered frames not inferred',userAgent:host.navigator.userAgent,viewport:[host.innerWidth,host.innerHeight],devicePixelRatio:host.devicePixelRatio,visibility:doc.visibilityState,focused:doc.hasFocus(),date:new Date().toISOString(),hardwareConcurrency:host.navigator.hardwareConcurrency};
    box.querySelector('#measure-output').textContent=JSON.stringify({context,summary:summarizeMeasurements(raw),raw});
  }
  function tick(now){
    if(disposed)return;
    if(last!==null)raw[doc.visibilityState==='visible'?'frames':'hiddenFrames'].push(now-last);
    last=now;
    if(now<until)frame=host.requestAnimationFrame(tick);else{frame=null;raw.events.push({id:'frame-trial-complete',end:now});output();}
  }
  box.querySelector('#measure-start').addEventListener('click',()=>{if(frame!==null)host.cancelAnimationFrame(frame);raw.events.push({id:'frame-trial',start:host.performance.now(),viewport:[host.innerWidth,host.innerHeight],visible:doc.visibilityState,focused:doc.hasFocus()});last=null;until=host.performance.now()+30000;frame=host.requestAnimationFrame(tick);});
  box.querySelector('#measure-report').addEventListener('click',output);
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
  host.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;if(frame!==null)host.cancelAnimationFrame(frame);observer.disconnect();doc.removeEventListener('click',click,true);});
  output();return {raw,report:output};
}
