// Assembly adapter only: the existing workspace owners retain node, SIM, mission and fabric state.
import {pairKey} from '../nodes/links.js';
import {createScenarioRunner} from './runner.js';
import {createScenarioClock} from './clock.js';
import {NODE_COMMUNICATION_METADATA} from '../nodes/node_timeline.js';
const requireValue=(value,message)=>{if(!value)throw Error(message);};
export function createWorkspaceScenario({api,nodeWorkspace,ground,missionServices,fabric,simController,nodeLibrary,missionTypes,stationModel,assemblyFactory,kpi,storage=null,onChange=()=>{},switchTab=()=>{},clockOwners={},affectedTasks=null,onControl=null}={}){
 requireValue(api&&nodeWorkspace&&ground&&missionServices&&fabric&&simController&&missionTypes&&stationModel&&typeof assemblyFactory==='function'&&kpi,'existing scenario workspace owners required');
 const ports=typeof nodeWorkspace.scenarioPorts==='function'?nodeWorkspace.scenarioPorts():null;
 const library=nodeLibrary??ports?.nodeLibrary;
 requireValue(library,'existing scenario node model required');
 const assembly=assemblyFactory({nodeLibrary:library,stationModel,missionTypes});
 const readRuntime=()=>simController.snapshot().runtime;
 let dead=false,prepared=false,lastNativeHashes=null,resumeCounter=0;
 const controlReleases=new Set();
 function controlled(work){if(onControl==null)return work();return (async()=>{requireValue(!dead,'scenario workspace disposed');const cleanup=onControl?.();let released=false;const release=()=>{if(released)return;released=true;controlReleases.delete(release);try{cleanup?.();}catch{/* Cleanup cannot replace command results. */}};controlReleases.add(release);try{requireValue(!dead,'scenario workspace disposed');return await work();}finally{release();}})();}
 const clock=createScenarioClock({runtime:readRuntime,...clockOwners,control:{pause:()=>runner.pause(),play:()=>runner.play(),setSpeed:n=>runner.setSpeed(n),advance:n=>runner.advance(n),refuse:message=>{throw Error(message);}}});
 async function refreshRuntime(status){await simController.load();const actual=readRuntime();requireValue(actual?.run_id===status.run_id&&actual.running===status.running,'SIM owner did not accept current runtime response');return actual;}
 async function preflight(definition){
  requireValue(!dead,'scenario workspace disposed');prepared=false;
  requireValue(typeof ports?.prepareSimUtc==='function'&&typeof ports?.verifySimUtc==='function'&&typeof ports?.preflightSimScenario==='function','native 입력을 실제 SIM UTC에서 검증하는 연결이 아직 없습니다. 현재 실행과 초안을 보존했습니다.');
  requireValue(ports.store&&typeof ports.deployment?.deploy==='function'&&typeof simController.load==='function','existing node deployment/SIM owners unavailable');
  requireValue(typeof missionServices.execution?.plan==='function'&&typeof missionServices.execution?.commit==='function'&&typeof missionServices.execution?.abort==='function'&&typeof missionServices.execution?.inspection==='function','accepted native mission execution owner unavailable');

  requireValue(['dataManagementDashboard','dataManagementRequest','securityDashboard','runtimeControl','runtimeSpeed','selectScenario','scenarioAdvance','injectFault'].every(k=>typeof api[k]==='function'),'source scenario active module ports unavailable');
  const captured={run_id:readRuntime()?.run_id,scenario_id:readRuntime()?.scenario_id,nodes:JSON.stringify(ports.store.snapshot()),stations:JSON.stringify(ground.stations),missions:JSON.stringify(missionServices.store.missions)};
  const proposed=assembly.assembleConstellation(definition,{epoch:clock.now(),idFactory:ports.store.idFactory(),formationId:'FRM-'+definition.id});
  const verification=await ports.preflightSimScenario({definition:structuredClone(definition),nodes:proposed.nodes});
  requireValue(verification===true,'native SIM UTC preparation and active module prerequisites are not verified');
  const [mission,fabricStatus,data,security]=await Promise.all([missionServices.queryModule(),fabric.refresh(),api.dataManagementDashboard({limit:1}),api.securityDashboard()]);
  requireValue(mission?.reachable===true&&mission.exchange_contract==='guarded-v1'&&Object.keys(mission.committed??{}).length===0,'현재 확정 임무를 보존하려면 먼저 확인·취소하세요.');
  requireValue(fabricStatus?.reachable===true&&data?.module?.reachable===true&&security?.module?.reachable===true,'원본 PoC의 통신·데이터·보안 모듈을 모두 확인하세요.');
  requireValue(readRuntime()?.run_id===captured.run_id&&readRuntime()?.scenario_id===captured.scenario_id&&JSON.stringify(ports.store.snapshot())===captured.nodes&&JSON.stringify(ground.stations)===captured.stations&&JSON.stringify(missionServices.store.missions)===captured.missions,'시나리오 검토 중 현재 실행 또는 사용자 구성이 바뀌었습니다.');
  if(storage)storage.setItem('isdc-scenario-previous-workspace-v1',JSON.stringify({kind:'readonly_before_explicit_scenario_setup',runtime:readRuntime(),nodes:ports.store.snapshot(),stations:ground.stations,missions:missionServices.store.missions}));
  prepared=true;
 }
 function commandReady(){requireValue(!dead&&prepared,'native SIM UTC 시나리오 전체 세팅 검토를 먼저 완료하세요.');if(runner.state.phase!=='preparing')requireValue(!simController.snapshot().error&&readRuntime()?.run_id===runner.state.runId&&readRuntime()?.scenario_id===runner.state.scenarioId,'현재 실제 SIM 실행이 시나리오 재개 검증 범위와 다릅니다.');}
 const hashesOf=receipt=>Object.fromEntries(receipt.states.map(([id,state])=>[id,state.definition_hash]));
 async function prepare(){commandReady();const utc=ports.simUtc();const receipt=await ports.prepareSimUtc(utc);requireValue(await ports.verifySimUtc(receipt,utc)===true,'native input receipt does not match actual SIM UTC');lastNativeHashes=hashesOf(receipt);await missionServices.queryModule();const context=missionServices.context();requireValue(context.utc===utc,'accepted mission UTC differs from scenario SIM UTC');if(clockOwners.followedSource?.()===clock){requireValue(typeof clockOwners.align==='function','기존 분석 시계 정렬 연결이 필요합니다.');await clockOwners.align();commandReady();requireValue(readRuntime()?.running===false&&ports.simUtc()===utc&&ports.verifySimUtc(receipt,utc)===true,'분석 정렬 도중 실제 SIM UTC 또는 native 입력이 바뀌었습니다.');}return context;}
  function sourceAffectedTasks(mission, nowMs) {
    if (mission?.status !== "committed" || !mission.plan?.tasks) return { satellites: [], links: [], tasks: [] };
    const nodes = ports.store.deployed;
    const deployed = new Map(nodes.map(node => [node.id, node]));
    const targets = new Set((readRuntime()?.active_faults||[]).filter(fault=>fault.kind==="link_loss"&&fault.active!==false).map(fault=>String(fault.target)));
    const satellitesOut = new Set(); const linksOut = new Set(); const tasks = [];
    for (const task of mission.plan.tasks) {
      if (missionTypes.taskStatusAt(task, nowMs) === "done") continue;
      const node = deployed.get(task.satellite);
      let hit = false;
      if (!node || node.mode !== "nominal") { satellitesOut.add(task.satellite); hit = true; }
      if (task.kind === "crosslink" && task.counterpart && targets.size) {
        const other = deployed.get(task.counterpart);
        const key = pairKey(task.satellite, task.counterpart);
        const names = [key, task.satellite, task.counterpart, node?.name, other?.name].filter(value => value != null).map(String);
        if (names.some(name => targets.has(name))) { linksOut.add(key); hit = true; }
      }
      if (hit) tasks.push(task.id);
    }
    return { satellites: [...satellitesOut], links: [...linksOut], tasks };
  }
 const planner={invalidateWindows(){},affectedTasks:(...args)=>(affectedTasks??sourceAffectedTasks)(...args),async plan(mission,options={}){await prepare();if(missionServices.store.find(mission.id)?.status==='committed')await missionServices.execution.abort(mission.id);const result=await missionServices.execution.plan(mission.id,options);requireValue(result?.current===true,'source mission accepted stale context');const inspection=missionServices.execution.inspection(mission.id);requireValue(inspection?.request,'accepted native mission request evidence unavailable');return {request:inspection.request,answer:result.answer};},async commit(mission,decision){await prepare();const result=await missionServices.execution[decision==='abort'?'abort':'commit'](mission.id);requireValue(result?.current===true&&result.answer?.accepted===true,'source mission decision was not accepted');return result.answer;}};
 // Source runner calls setPlan/status after the execution owner already installed the receipt.
 // Verify those duplicate writes rather than dropping the guarded proof through a second setPlan.
 const missionStore={get missions(){return missionServices.store.missions;},find:id=>missionServices.store.find(id),add:(...args)=>missionServices.store.add(...args),remove:(...args)=>missionServices.store.remove(...args),setPlan(id,plan){const actual=missionServices.store.find(id);requireValue(actual?.plan?.plan_sequence===plan.plan_sequence&&actual.plan.context_hash===plan.context_hash,'scenario plan differs from accepted mission proof');return actual;},setStatus(id,status){const actual=missionServices.store.find(id);requireValue(actual?.status===status,'scenario status differs from accepted mission decision');return actual;}};
 const readFabric=()=>typeof fabric.snapshot==='function'?fabric.snapshot():{status:'unavailable',error:'기존 통신 모듈 owner가 연결되지 않았습니다.',receipt:null};
 let pendingNetwork=null;
 const networkTwin={resetHistories:()=>{nodeWorkspace.clearNetwork?.();fabric.invalidate?.();},tick(){pendingNetwork=prepare().then(()=>nodeWorkspace.updateNetwork());return pendingNetwork;},async exchange(){await pendingNetwork;const answer=await fabric.send();requireValue(answer&&readFabric().status==='accepted','current native network was not accepted');return answer;},route:(...args)=>fabric.route(...args),reachable:()=>readFabric().status==='accepted',get report(){return readFabric().receipt;},get fabricState(){const value=readFabric();return {reachable:value.status==='accepted',error:value.error,sequence:value.receipt?.sequence};},get last(){return nodeWorkspace.networkSnapshot?.()??null;}};
 function beginTick(){return controlled(async()=>{commandReady();const state=readRuntime();requireValue(state?.mode==='SIM','actual SIM owner unavailable');const lease={running:state.running,run_id:state.run_id};if(state.running)await refreshRuntime(await api.runtimeControl('pause'));return lease;});}
 function endTick(lease,succeeded,phase){if(dead)return Promise.resolve();return controlled(async()=>{if(!dead&&succeeded&&phase==='finished'&&prepared){try{requireValue(readRuntime()?.running===false&&readRuntime()?.run_id===lease?.run_id,'완료 checkpoint의 실제 SIM 실행을 확인하세요.');await checkpoint();}finally{prepared=false;}return;}if(!dead&&succeeded&&phase==='playing'&&lease?.running&&readRuntime()?.run_id===lease.run_id){await refreshRuntime(await api.runtimeControl('start'));}});}
 const sourceApi={...api};for(const name of ['runtimeControl','runtimeSpeed','selectScenario','scenarioAdvance'])sourceApi[name]=(...args)=>controlled(async()=>{commandReady();return refreshRuntime(await api[name](...args));});
 sourceApi.injectFault=(...args)=>controlled(async()=>{commandReady();const result=await api.injectFault(...args);await simController.load();return result;});
 sourceApi.dataManagementRequest=(...args)=>controlled(async()=>{commandReady();return api.dataManagementRequest(...args);});
 const unavailable={};
 const runner=createScenarioRunner({assembly,missionTypes,kpi,pairKey,api:sourceApi,constellation:ports?.store??unavailable,groundSegment:ground,missionStore,dataDeployment:ports?.deployment?{async deploy(){await ports.deployment.refresh();return ports.deployment.deploy();}}:unavailable,planner,networkTwin,clock,storage,runtime:readRuntime,now:()=>clock.now(),applyRuntime:()=>{},switchTab,emit:()=>onChange(),preflight,beginTick,endTick,wait:async()=>{}});
 const originalStop=runner.stop;runner.stop=(...args)=>{const result=originalStop(...args);ports?.releaseDisplay?.();prepared=false;return result;};
 const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 const same=(a,b)=>canonical(a)===canonical(b);
 // Diagnostics expose contract field names only. Exact canonical equality below
 // remains the authorization condition; no value or historical proof is rewritten.
 const mismatchFields=(current,saved)=>[...new Set([...Object.keys(current??{}),...Object.keys(saved??{})])].sort().flatMap(key=>{if(same(current?.[key],saved?.[key]))return [];if(key==='module'){const fields=['instance_id','committed','accepted_plans'].filter(part=>!same(current?.module?.[part],saved?.module?.[part])).map(part=>'module.'+part);return fields.length?fields:['module'];}return [key];});
 const missionRoster=()=>missionServices.store.missions.map(m=>Object.fromEntries(['id','kind','params','notes','version','status','plan'].map(k=>[k,m[k]])));
 function sourceModule(status){const ids=Object.values(runner.state.missions);requireValue(status?.reachable===true&&status.exchange_contract==='guarded-v1'&&typeof status.instance_id==='string','현재 군집 운용 모듈을 확인하세요.');requireValue(Object.keys(status.committed??{}).every(id=>ids.includes(id)),'다른 실행의 확정 임무가 있어 시나리오 재개를 허용할 수 없습니다.');return {instance_id:status.instance_id,committed:status.committed??{},accepted_plans:Object.fromEntries(ids.map(id=>[id,status.accepted_plans?.[id]??null]))};}
 function currentEvidence(status){const runtime=readRuntime(),state=ports.deployment.state;requireValue(!simController.snapshot().error&&ports.store.deploymentConfirmed&&!ports.store.isDirty()&&!state.syncRequired&&!state.busy&&state.server?.run_id===runtime?.run_id,'시나리오의 현재 수락 배치와 초안을 확인하세요.');return {schema_version:1,contract:'source-scenario-resume-v1',source_commit:NODE_COMMUNICATION_METADATA.source_commit,run_id:runtime.run_id,started_at:runtime.started_at,definition:runner.definition,nodes:ports.store.deployed,deployment:state.server,stations:ground.stations,missions:missionRoster(),module:sourceModule(status),faults:runtime.active_faults,native_definition_hashes:lastNativeHashes};}
 async function checkpoint(){if(!prepared||!['ready','paused','playing','finished'].includes(runner.state.phase))return;const phase=runner.state.phase,run=runner.state.runId,runtime=structuredClone(readRuntime());const status=await missionServices.queryModule();requireValue(!dead&&prepared&&runner.state.phase===phase&&runner.state.runId===run&&same(readRuntime(),runtime),'checkpoint 검증 도중 실제 실행 또는 재생 기록이 바뀌었습니다.');const evidence=currentEvidence(status);requireValue(evidence.run_id===runner.state.runId&&evidence.native_definition_hashes,'현재 시나리오 검증 기록이 없습니다.');runner.checkpointWorkspace(evidence);}
 // A current-input review is a new native analysis proof, never an adoption of
 // the historical result. Mutable final plans must match the actual module.
 function validateCurrentReview(current,saved,status){
  for(const field of ['schema_version','contract','source_commit','run_id','started_at','definition','nodes','deployment','stations','native_definition_hashes'])requireValue(same(current[field],saved[field]),'완료 실행의 원본 입력이 바뀌었습니다: '+field);
  requireValue(current.module.instance_id===saved.module.instance_id&&Number.isSafeInteger(status.sequence)&&status.sequence>=0,'완료 실행의 모듈 인스턴스·sequence가 바뀌었습니다.');
  const templates=rows=>rows.map(m=>Object.fromEntries(['id','kind','params','notes','version'].map(k=>[k,m[k]])));
  requireValue(same(templates(current.missions),templates(saved.missions)),'완료 실행의 원본 임무 정의가 바뀌었습니다.');
  const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  requireValue(status.accepted_decisions&&Object.getPrototypeOf(status.accepted_decisions)===Object.prototype,'현재 모듈의 guarded 확정·취소 수락 증명을 확인하세요.');
  for(const m of current.missions){
   const p=current.module.accepted_plans[m.id],held=current.module.committed[m.id];
   if(!p){requireValue(!m.plan&&!held&&m.status!=='committed','현재 모듈에 수락된 임무 계획이 없습니다: '+m.id);continue;}
   requireValue(p.exchange_contract==='guarded-v1'&&p.instance_id===status.instance_id&&p.mission_id===m.id&&typeof p.request_id==='string'&&p.request_id.length>0&&hash(p.context_hash)&&Number.isSafeInteger(p.mission_version)&&p.mission_version>=1&&Number.isSafeInteger(p.plan_sequence)&&p.plan_sequence>=1&&p.sequence===p.plan_sequence&&p.sequence<=status.sequence&&typeof p.feasible==='boolean'&&Array.isArray(p.tasks)&&p.tasks.length<=2000&&typeof p.time==='string'&&Number.isFinite(Date.parse(p.time)),'현재 모듈 계획의 guarded 증명이 잘못되었습니다: '+m.id);
   requireValue(m.plan?.version===p.mission_version&&same(Object.fromEntries(Object.keys(p).filter(k=>k!=='version').map(k=>[k,m.plan?.[k]])),Object.fromEntries(Object.entries(p).filter(([k])=>k!=='version'))),'저장된 임무 계획과 현재 모듈 수락이 다릅니다. 먼저 임무의 최신 버전 새 계획 또는 명시적 취소를 검토하세요: '+m.id);
   requireValue(Boolean(held)===(m.status==='committed'),'확정 임무 상태와 현재 모듈이 다릅니다: '+m.id);
   if(held){
    // Source status publishes only {version, tasks: COUNT}. Its guarded commit
    // validates full plan tasks/time before acceptance; the decision receipt
    // links that accepted plan to this held summary. Receipt.time is wallstamp.
    const d=status.accepted_decisions[m.id];
    requireValue(p.feasible&&held.version===p.mission_version&&Number.isSafeInteger(held.tasks)&&held.tasks===p.tasks.length&&d?.exchange_contract==='guarded-v1'&&d.instance_id===status.instance_id&&d.mission_id===m.id&&typeof d.request_id==='string'&&d.request_id.length>0&&d.context_hash===p.context_hash&&d.mission_version===p.mission_version&&d.version===p.mission_version&&d.plan_sequence===p.plan_sequence&&d.decision==='commit'&&d.accepted===true&&d.held_tasks===held.tasks&&Number.isSafeInteger(d.sequence)&&d.sequence>p.plan_sequence&&d.sequence<=status.sequence&&typeof d.time==='string'&&Number.isFinite(Date.parse(d.time)),'현재 모듈의 확정 작업 증명이 다릅니다: '+m.id);
   }
  }
 }
 async function resumePreflight(){return validateInputs(false);}
 async function reviewFinishedInputs(){return validateInputs(true);}
 async function validateInputs(currentReview=false){
  requireValue(!dead,'scenario workspace disposed');prepared=false;
  const phase=runner.state.phase,finishedInputsOnly=phase==='finished',runnerBefore=structuredClone(runner.state);requireValue(!currentReview||finishedInputsOnly,'현재 입력 새 검토는 완료 기록에서만 가능합니다.');
  const saved=runner.state.workspaceEvidence;
  requireValue(saved?.schema_version===1&&saved.contract==='source-scenario-resume-v1'&&saved.source_commit===NODE_COMMUNICATION_METADATA.source_commit,'과거 실행에 재개 검증 기록이 없습니다. 새 세팅을 명시적으로 검토하세요.');
  requireValue(['ready','paused','finished'].includes(phase)&&typeof ports?.prepareSimUtc==='function'&&typeof ports?.verifySimUtc==='function'&&typeof api.nodeMissionContext==='function','현재 정지 시나리오의 입력 검증 연결을 확인하세요.');
  const runtime=readRuntime();requireValue(runtime?.running===false&&runtime.run_id===saved.run_id&&runtime.run_id===runner.state.runId&&runtime.scenario_id===runner.state.scenarioId,'같은 시나리오 실행의 실제 SIM을 정지한 뒤 재개를 검증하세요.');
  const runtimeIdentity=value=>Object.fromEntries(['mode','run_id','scenario_id','started_at','elapsed_seconds','running','speed','active_faults'].map(k=>[k,value?.[k]]));
  const runtimeBefore=structuredClone(runtimeIdentity(runtime));
  lastNativeHashes=structuredClone(saved.native_definition_hashes);
  requireValue(typeof ports.deployment.reacceptCachedDeployment==='function','저장 배치의 실제 서버 재확인 연결이 필요합니다.');
  await ports.deployment.reacceptCachedDeployment(saved.deployment,saved.nodes);let status=await missionServices.queryModule();
  const current=currentEvidence(status);
  if(currentReview){validateCurrentReview(current,saved,status);}else requireValue(same(current,saved),`저장된 실행과 현재 증명이 달라 입력을 확인할 수 없습니다. 불일치: ${mismatchFields(current,saved).join(', ')}`);
  const expected=currentReview?structuredClone(current):saved;
  const decisions=currentReview?structuredClone(status.accepted_decisions):null;
  const utc=ports.simUtc(),receipt=await ports.prepareSimUtc(utc);
  requireValue(ports.verifySimUtc(receipt,utc)===true&&same(hashesOf(receipt),saved.native_definition_hashes),'현재 실제 SIM UTC의 전체 native 노드 정의 증명이 일치하지 않습니다.');
  const context=missionServices.context();requireValue(context.utc===utc&&same(context.nodes,saved.nodes)&&same(context.stations,ground.enabled)&&same(context.faults,expected.faults)&&same(context.deployment,saved.deployment)&&context.module.instance===saved.module.instance_id,'현재 native 임무 입력 범위가 저장 실행과 다릅니다.');
  const accepted=await api.nodeMissionContext({request_id:'scenario-resume:'+ (++resumeCounter),nodes:context.nodes,run_id:context.deployment.run_id,deployment_revision:context.deployment.revision,utc,stations:context.stations,faults:context.faults,module_instance:context.module.instance,module_sequence:context.module.sequence,external:context.external});
  requireValue(accepted?.schema_version===1&&accepted.status==='verified_analysis_inputs'&&accepted.communication_status==='unknown'&&/^[a-f0-9]{64}$/.test(accepted.context_hash??'')&&accepted.utc===utc&&same(accepted.nodes,saved.nodes)&&same(accepted.stations,context.stations)&&same(accepted.faults,expected.faults)&&same(accepted.deployment,saved.deployment)&&same(accepted.definition_hashes,saved.native_definition_hashes)&&same(accepted.external,context.external)&&accepted.module_instance===context.module.instance&&accepted.module_sequence===context.module.sequence,'native 재개 입력 수락 증명이 일치하지 않습니다.');
  status=await missionServices.queryModule();
  requireValue(readRuntime()?.running===false&&ports.simUtc()===utc&&ports.verifySimUtc(receipt,utc)===true&&same(currentEvidence(status),expected)&&(!currentReview||same(status.accepted_decisions,decisions))&&same(missionServices.context(),context)&&status.sequence===accepted.module_sequence,'재개 검증 도중 실제 UTC·배치·임무 또는 모듈 상태가 바뀌었습니다.');
  requireValue(!dead&&same(runner.state,runnerBefore)&&same(runtimeIdentity(readRuntime()),runtimeBefore),'입력 검증 도중 완료 기록 또는 실제 실행 상태가 바뀌었습니다.');
  // Finished inputs can be reaccepted for readonly/current mission tools. They
  // never grant the source runner permission to advance or restart its stages.
  prepared=!finishedInputsOnly;return {run_id:saved.run_id,utc,node_count:saved.nodes.length,context_hash:accepted.context_hash,communication_status:'unknown',validation_kind:currentReview?'finished_current_inputs_review':finishedInputsOnly?'finished_workspace_inputs':'resume_workspace_inputs',playback_authorized:!finishedInputsOnly,...(currentReview?{changed_fields:mismatchFields(current,saved)}:{})};
 }
 async function followAnalysis(){commandReady();requireValue(readRuntime()?.running===false&&typeof clockOwners.followAll==='function','실제 SIM 정지와 기존 분석 시계 연결이 필요합니다.');const run=readRuntime().run_id,utc=ports.simUtc();const result=await clockOwners.followAll(clock);commandReady();requireValue(readRuntime()?.running===false&&readRuntime().run_id===run&&ports.simUtc()===utc&&clockOwners.followedSource?.()===clock,'분석 따라가기 검증 도중 실제 실행이 바뀌었습니다.');return result;}
 async function releaseAnalysis(){requireValue(!dead,'scenario workspace disposed');if(clockOwners.followedSource?.()!==clock)return false;requireValue(typeof clockOwners.releaseAll==='function','기존 분석 시계 해제 연결이 필요합니다.');return clockOwners.releaseAll(clock);}
 async function stopReviewed(options){await releaseAnalysis();runner.stop(options);}
 for(const key of ['setup','pause','advance','skipToNextStep']){const original=runner[key];runner[key]=async(...args)=>{if(key==='setup')await releaseAnalysis();const result=await original(...args);await checkpoint();return result;};}
 const off=runner.subscribe(onChange);
 return Object.freeze({runner,clock,assembly,kpi,preflight,resumePreflight,reviewFinishedInputs,followAnalysis,releaseAnalysis,stopReviewed,destroy(){if(dead)return;dead=true;for(const release of [...controlReleases])release();runner.suspend();off();}});
}
