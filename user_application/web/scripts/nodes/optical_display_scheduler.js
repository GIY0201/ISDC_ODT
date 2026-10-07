// Lifecycle scheduling only. The existing display and analytical owners retain
// UTC, histories, full native proofs and the serial transport lane.
export const OPTICAL_ANALYSIS_INTERVAL_MS=1000;
export function createOpticalDisplayScheduler({readDisplay,readContinuity=null,verifyContinuity=null,requestSampled,requestExact,cancelSampled,onAnalysisTick=null,onError=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,queueMicrotask=globalThis.queueMicrotask}={}){
  if([readDisplay,requestSampled,requestExact,cancelSampled,onError,setTimer,clearTimer,queueMicrotask].some(fn=>typeof fn!=='function'))throw new TypeError('optical display scheduler owner ports required');
  if(onAnalysisTick!==null&&typeof onAnalysisTick!=='function')throw new TypeError('analytical completion callback required');
  if((readContinuity!==null||verifyContinuity!==null)&&[readContinuity,verifyContinuity].some(fn=>typeof fn!=='function'))throw new TypeError('complete display continuity bridge required');
  let started=false,enabled=true,disposed=false,timer=null,generation=0,queued=null,active=null,pending=false,controlPending=false,lastLease=null;
  const running=()=>started&&enabled&&!disposed;
  const report=error=>{if(!disposed){try{onError(error instanceof Error?error:new Error(String(error)));}catch{/* Error reporting owns no scheduler state. */}}};
  function cancel(){try{cancelSampled();}catch(error){report(error);}}
  function invalidate(){generation++;queued=null;lastLease=null;cancel();}
  function capture(){
    const initial=readDisplay();if(!initial?.utc)return {display:null,lease:null};
    if(!readContinuity)return {display:initial,lease:null};
    const lease=readContinuity();
    if(!lease||verifyContinuity(lease)!==true)return {display:initial,lease:null};
    const display=readDisplay();
    return display?.utc&&verifyContinuity(lease)===true?{display,lease}:{display:null,lease:null};
  }
  function analyticalTick(ticket=generation){if(!running()||controlPending||ticket!==generation||!onAnalysisTick)return;try{Promise.resolve(onAnalysisTick()).catch(report);}catch(error){report(error);}}
  function exact(display){
    const ticket=generation;
    try{Promise.resolve(requestExact(display)).then(()=>analyticalTick(ticket)).catch(error=>{if(running()&&ticket===generation)report(error);});}catch(error){if(ticket===generation)report(error);}
  }
  function dispatch(){
    if(!running()||controlPending)return;
    if(active){pending=true;return;}
    pending=false;
    const ticket=generation;
    let context;try{context=capture();}catch(error){invalidate();report(error);return;}
    if(!running()||controlPending||ticket!==generation)return;
    const {display,lease}=context;
    if(!display)return;
    lastLease=lease;
    if(!lease){exact(display);return;}
    const task={generation};active=task;
    let result;
    try{result=requestSampled(display,lease);}catch(error){result=Promise.reject(error);}
    Promise.resolve(result).then(()=>{task.success=true;}).catch(error=>{if(running()&&task.generation===generation){cancel();report(error);}}).finally(()=>{
      if(active!==task)return;active=null;if(task.success&&running()&&task.generation===generation)analyticalTick(task.generation);
      if(running()&&pending&&!controlPending)defer();
    });
  }
  function defer(){
    if(!running()||controlPending||queued)return;
    const token={generation};queued=token;
    queueMicrotask(()=>{if(queued!==token)return;queued=null;if(running()&&!controlPending&&token.generation===generation)dispatch();});
  }
  function force(){if(!running())return;pending=true;defer();}
  function observe(){
    if(!running()||controlPending||queued)return;
    const ticket=generation;
    let context;try{context=capture();}catch(error){invalidate();report(error);return;}
    if(!running()||controlPending||queued||ticket!==generation)return;
    if(!context.display){if(lastLease)invalidate();return;}
    if(context.lease){
      if(context.lease===lastLease)return;
      if(lastLease)invalidate();lastLease=context.lease;force();return;
    }
    if(lastLease)invalidate();
    if(active){pending=true;defer();return;}
    exact(context.display);
  }
  function continuityEvent(event){
    if(!running()||!event||!['invalidated','settled','availability'].includes(event.phase))return;
    if(event.phase==='invalidated'){controlPending=true;pending=true;invalidate();return;}
    if(event.phase==='settled'){controlPending=false;force();return;}
    // Source availability notifications precede the viewport observer. Wait for
    // the synchronous display update; they cannot end a control transaction.
    if(!controlPending)invalidate();pending=true;defer();
  }
  function install(){
    if(!running()||timer!==null)return;
    const owned={id:null};timer=owned;
    owned.id=setTimer(()=>{if(timer!==owned)return;timer=null;if(!running())return;install();if(!controlPending){if(lastLease)force();else analyticalTick();}},OPTICAL_ANALYSIS_INTERVAL_MS);
  }
  function removeTimer(){if(timer===null)return;const owned=timer;timer=null;clearTimer(owned.id);}
  return Object.freeze({
    start(){if(disposed||started)return;started=true;install();force();},observe,force,continuityEvent,
    setActive(value){if(disposed||enabled===(value===true))return;enabled=value===true;if(!enabled){removeTimer();pending=false;controlPending=false;invalidate();}else if(started){install();force();}},
    destroy(){if(disposed)return;disposed=true;removeTimer();generation++;queued=null;pending=false;controlPending=false;lastLease=null;cancel();},
  });
}
