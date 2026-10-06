import {createBrowserId} from './browser_identity.js';
// Server snapshots only: never advance UTC or calculate positions in this client.
export function createOrbitSelection(api, notify, requestId=()=>createBrowserId(),now=()=>performance.now()) {
  let inputs=[], state=null, result=null, status='loading', error='',disposed=false;
  let generation=0, chain=Promise.resolve(), queryAbort=null,queryGeneration=0,fetching=false,receivedAtMs=0;
  const snapshot=()=>structuredClone({inputs,state,result,status,error,fetching,receivedAtMs});
  const emit=()=>{if(!disposed)notify(snapshot());};
  const adopt=current=>{if(!disposed){state=current;receivedAtMs=now();}};
  const fail=exc=>{if(disposed)return;if(exc.status===409&&exc.state)adopt(exc.state);status='error';error=exc.message;result=null;fetching=false;emit();};
  async function load(){if(disposed)return;try{const [catalog,current]=await Promise.all([api.orbitInputs(),api.orbitState()]);if(disposed)return;inputs=catalog.inputs;adopt(current);status=inputs.length?'ready':'empty';emit();}catch(exc){fail(exc);}}
  function select(inputId, utc,options={}){
    if(disposed)return Promise.resolve();
    const ticket=++generation;queryAbort?.abort();result=null;fetching=false;status='pending';error='';emit();
    const run=async()=>{if(disposed)return;try{
      const record=inputs.find(item=>item.input_id===inputId);if(!record||!state)throw new Error('저장 입력이 준비되지 않았습니다.');
      if(options.preserveUtc){
        const fresh=await api.orbitState();if(disposed)return;
        if(fresh.revision!==state.revision)throw Object.assign(new Error('서버 선택이 변경되었습니다.'),{status:409,state:fresh});
        adopt(fresh);
      }
      adopt(await api.selectOrbit({client_request_id:requestId(),expected_revision:state.revision,input_id:inputId,ground_point:options.groundPoint??state.ground_point,minimum_elevation_deg:options.minimumElevation??state.minimum_elevation_deg,anchor_utc:utc||(options.preserveUtc?state.current_utc:record.epoch_utc),playing:options.playing??false,play_rate:options.playRate??state.play_rate}));
      if(ticket===generation){status='ready';emit();}
    }catch(exc){if(ticket===generation){fail(exc);if(exc.status===409)await refresh({force:true});}else if(exc.status===409&&exc.state)adopt(exc.state);}};
    chain=chain.then(run,run);return chain;
  }
  async function samples({startUtc,stepSeconds=60,count=3,background=false}={}){
    if(disposed||!state?.input_id)return;
    const ticket=background?generation:++generation,queryTicket=++queryGeneration;const selected=structuredClone(state), id=requestId();
    queryAbort?.abort();queryAbort=new AbortController();const abort=queryAbort;
    fetching=true;if(!background){status='pending';result=null;}error='';emit();
    try{
      const response=await api.orbitSamples({client_request_id:id,selection_revision:selected.revision,input_id:selected.input_id,start_utc:startUtc||selected.current_utc,step_seconds:stepSeconds,count},{signal:abort.signal});
      if(ticket!==generation||queryTicket!==queryGeneration)return;
      fetching=false;
      const changedProvenance=['eop_sha256','leap_sha256','frame','profile'].some(key=>selected[key]!=null&&response[key]!==selected[key]);
      if(response.stale||changedProvenance||response.client_request_id!==id||response.revision!==selected.revision||response.input_id!==selected.input_id||response.input_hash!==selected.input_hash){status='stale';result=null;error='선택과 일치하지 않는 응답을 폐기했습니다.';}
      else {result=response;status=response.status==='error'?'error':'ready';}
      emit();
    }catch(exc){
      if(ticket!==generation||queryTicket!==queryGeneration||disposed)return;
      if(exc.name==='AbortError'){fetching=false;status='ready';error='계산 요청이 취소되었습니다.';result=null;emit();}
      else fail(exc);
    }
  }
  const seek=utc=>state?.input_id?select(state.input_id,utc):Promise.resolve();
  function control(action,rate){
    if(!state?.input_id)return Promise.resolve();
    if(!['play','pause','speed'].includes(action))return Promise.reject(new Error('invalid orbit control'));
    return select(state.input_id,undefined,{preserveUtc:true,playing:action==='speed'?state.playing:action==='play',playRate:rate??state.play_rate});
  }
  async function refresh({force=false}={}){
    if(disposed||(!force&&status!=='ready')||status==='pending'||fetching)return;
    const ticket=generation;
    try{
      const current=await api.orbitState();if(ticket!==generation||current.revision<state.revision)return;
      if(current.revision!==state.revision){generation++;queryAbort?.abort();result=null;}
      adopt(current);emit();
    }catch(exc){if(ticket===generation)fail(exc);}
  }
  const setGround=(groundPoint,minimumElevation)=>select(state?.input_id,undefined,{preserveUtc:true,groundPoint,minimumElevation,playing:false});
  function destroy(){
    if(disposed)return;disposed=true;generation++;queryGeneration++;queryAbort?.abort();queryAbort=null;
    result=null;fetching=false;status='disposed';error='';
  }
  return {load,select,samples,snapshot,control,seek,refresh,setGround,destroy};
}
