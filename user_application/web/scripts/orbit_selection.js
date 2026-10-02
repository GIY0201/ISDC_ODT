// Server snapshots only: never advance UTC or calculate positions in this client.
export function createOrbitSelection(api, notify, requestId=()=>crypto.randomUUID()) {
  let inputs=[], state=null, result=null, status='loading', error='';
  let generation=0, chain=Promise.resolve(), queryAbort=null;
  const snapshot=()=>structuredClone({inputs,state,result,status,error});
  const emit=()=>notify(snapshot());
  const fail=exc=>{if(exc.status===409&&exc.state)state=exc.state;status='error';error=exc.message;result=null;emit();};
  async function load(){try{const [catalog,current]=await Promise.all([api.orbitInputs(),api.orbitState()]);inputs=catalog.inputs;state=current;status=inputs.length?'ready':'empty';emit();}catch(exc){fail(exc);}}
  function select(inputId, utc){
    const ticket=++generation;queryAbort?.abort();result=null;status='pending';error='';emit();
    const run=async()=>{try{
      const record=inputs.find(item=>item.input_id===inputId);if(!record||!state)throw new Error('저장 입력이 준비되지 않았습니다.');
      state=await api.selectOrbit({client_request_id:requestId(),expected_revision:state.revision,input_id:inputId,ground_point:state.ground_point,minimum_elevation_deg:state.minimum_elevation_deg,anchor_utc:utc||record.epoch_utc,playing:false,play_rate:state.play_rate});
      if(ticket===generation){status='ready';emit();}
    }catch(exc){if(ticket===generation)fail(exc);else if(exc.status===409&&exc.state)state=exc.state;}};
    chain=chain.then(run,run);return chain;
  }
  async function samples(){
    if(!state?.input_id)return;
    const ticket=++generation;const selected=structuredClone(state), id=requestId();
    queryAbort?.abort();queryAbort=new AbortController();const abort=queryAbort;
    status='pending';result=null;error='';emit();
    try{
      const response=await api.orbitSamples({client_request_id:id,selection_revision:selected.revision,input_id:selected.input_id,start_utc:selected.current_utc,step_seconds:60,count:3},{signal:abort.signal});
      if(ticket!==generation)return;
      if(response.stale||response.client_request_id!==id||response.revision!==selected.revision||response.input_id!==selected.input_id||response.input_hash!==selected.input_hash){status='stale';error='선택과 일치하지 않는 응답을 폐기했습니다.';}
      else {result=response;status=response.status==='error'?'error':'ready';}
      emit();
    }catch(exc){if(ticket===generation&&exc.name!=='AbortError')fail(exc);}
  }
  return {load,select,samples,snapshot};
}
