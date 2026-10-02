import {projectUtc,createSampleBuffer} from './orbit_playback.js';
import {createUtcCodec} from './orbit_utc.js';

/** Document display lifecycle. HTTP only on buffer transitions and a 5s state timer. */
export function createWorkspacePlayback(client,showFrame,{
  now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),
  setTimer=fn=>setInterval(fn,5000),clearTimer=id=>clearInterval(id),
}={}){
  let current=null,codec=null,codecHash=null,buffer=null,bufferId=null,frame=null,disposed=false,lastAttempt=null;
  function draw(){
    if(disposed||!current)return;
    let utc=null,row=null,error='';
    try{
      if(current.state?.current_utc){
        if(codecHash!==current.state.leap_sha256){codec=createUtcCodec(current.state.leap_sha256);codecHash=current.state.leap_sha256;}
        utc=projectUtc(current.state,current.receivedAtMs,now(),codec.advance);
        if(current.status==='ready')row=buffer?.sampleAt(utc)||null;
      }
    }catch(exc){error=exc.message;}
    showFrame(current,row,utc,error);
    if(error||!utc||!current.state?.playing||current.status!=='ready'||current.fetching)return;
    const end=current.result?.rows?.at(-1)?.utc;
    const remaining=end?codec.difference(end,utc):-Infinity;
    const key=`${current.state.revision}:${current.result?.client_request_id||'empty'}`;
    if((!row||remaining<=300)&&key!==lastAttempt){
      lastAttempt=key;
      client.samples({background:true,startUtc:codec.advance(utc,-1),stepSeconds:1,count:601});
    }
  }
  function tick(){frame=null;draw();if(!disposed&&current?.state?.playing&&frame===null)frame=requestFrame(tick);}
  const timer=setTimer(()=>{if(!disposed&&current?.state?.playing)client.refresh();});
  return {
    update(snapshot){
      if(disposed)return;
      current=snapshot;
      const id=snapshot.result?.client_request_id||null;
      if(id!==bufferId||!snapshot.result){
        buffer=null;bufferId=id;
        if(snapshot.result&&snapshot.state?.leap_sha256){
          try{const time=createUtcCodec(snapshot.state.leap_sha256);buffer=createSampleBuffer(snapshot.result.rows,time.difference);}catch{buffer=null;}
        }
      }
      if(!snapshot.state?.playing&&frame!==null){cancelFrame(frame);frame=null;}
      draw();
      if(snapshot.state?.playing&&frame===null)frame=requestFrame(tick);
    },
    destroy(){if(disposed)return;disposed=true;if(frame!==null)cancelFrame(frame);clearTimer(timer);current=null;buffer=null;},
  };
}
