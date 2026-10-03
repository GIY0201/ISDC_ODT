/** Read-only analysis of full Chrome ReturnAsStream tracing, with app trial marks. */
export function summarizePresentationTrace(trace){
  const events=trace.traceEvents||[];
  const starts=events.filter(e=>/^orbit-frame-trial-\d+-start$/.test(e.name));
  const pids=new Set(starts.map(e=>e.pid));
  if(pids.size>1)throw new Error('ambiguous trial renderer provenance');
  const rendererPid=starts[0]?.pid??null;
  const trials=starts.map(start=>{
    const end=events.find(e=>e.pid===rendererPid&&e.name===start.name.replace(/start$/,'end')&&e.ts>=start.ts);
    return {name:start.name,startUs:start.ts,endUs:end?.ts??null,completed:!!end&&end.ts-start.ts>=30000000};
  });
  const values=[];
  for(const trial of trials.filter(t=>t.completed)){
    const times=[...new Set(events.filter(e=>e.pid===rendererPid&&e.name==='AnimationFrame::Presentation'&&e.ts>=trial.startUs&&e.ts<=trial.endUs).map(e=>e.ts))].sort((a,b)=>a-b);
    for(let i=1;i<times.length;i++)values.push((times[i]-times[i-1])/1000);
  }
  values.sort((a,b)=>a-b);const rank=p=>values.length?values[Math.ceil(values.length*p)-1]:null;
  const completedTrials=trials.filter(t=>t.completed).length;
  return {method:'page renderer AnimationFrame::Presentation in completed >=30s marked trials; GPU Display/Present events retained separately, physical monitor scanout not certified',rendererPid,trials,completedTrials,incompleteTrials:trials.length-completedTrials,
    presentation:{count:values.length,p95:rank(.95),p99:rank(.99),max:values.at(-1)??null},
    gpuEvidence:{displayed:events.filter(e=>e.name==='Display::FrameDisplayed').length,present:events.filter(e=>e.name==='DCompPresenter::Present').length},
    gates:{presentation:values.length?rank(.95)<=16.7:null,protocol:completedTrials>=3&&trials.every(t=>t.completed)}};
}
