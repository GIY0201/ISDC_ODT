// Assembly adapter only: the existing workspace owners retain node, SIM, mission and fabric state.
import {pairKey} from '../nodes/links.js';
import {createScenarioRunner} from './runner.js';
import {createScenarioClock} from './clock.js';
import {NODE_COMMUNICATION_METADATA} from '../nodes/node_timeline.js';
const requireValue=(value,message)=>{if(!value)throw Error(message);};
export function createWorkspaceScenario({api,nodeWorkspace,ground,missionServices,fabric,simController,nodeLibrary,missionTypes,stationModel,assemblyFactory,kpi,storage=null,onChange=()=>{},switchTab=()=>{},clockOwners={},affectedTasks=null}={}){
 requireValue(api&&nodeWorkspace&&ground&&missionServices&&fabric&&simController&&missionTypes&&stationModel&&typeof assemblyFactory==='function'&&kpi,'existing scenario workspace owners required');
 const ports=typeof nodeWorkspace.scenarioPorts==='function'?nodeWorkspace.scenarioPorts():null;
 const library=nodeLibrary??ports?.nodeLibrary;
 requireValue(library,'existing scenario node model required');
 const assembly=assemblyFactory({nodeLibrary:library,stationModel,missionTypes});
 const readRuntime=()=>simController.snapshot().runtime;
 let dead=false,prepared=false,lastNativeHashes=null,resumeCounter=0;
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
 async function beginTick(){commandReady();const state=readRuntime();requireValue(state?.mode==='SIM','actual SIM owner unavailable');const lease={running:state.running,run_id:state.run_id};if(state.running)await refreshRuntime(await api.runtimeControl('pause'));return lease;}
 async function endTick(lease,succeeded,phase){if(!dead&&succeeded&&phase==='playing'&&lease?.running&&readRuntime()?.run_id===lease.run_id){await refreshRuntime(await api.runtimeControl('start'));}}
 const sourceApi={...api};for(const name of ['runtimeControl','runtimeSpeed','selectScenario','scenarioAdvance'])sourceApi[name]=async(...args)=>{commandReady();return refreshRuntime(await api[name](...args));};
 sourceApi.injectFault=async(...args)=>{commandReady();const result=await api.injectFault(...args);await simController.load();return result;};
 sourceApi.dataManagementRequest=async(...args)=>{commandReady();return api.dataManagementRequest(...args);};
 const unavailable={};
 const runner=createScenarioRunner({assembly,missionTypes,kpi,pairKey,api:sourceApi,constellation:ports?.store??unavailable,groundSegment:ground,missionStore,dataDeployment:ports?.deployment?{async deploy(){await ports.deployment.refresh();return ports.deployment.deploy();}}:unavailable,planner,networkTwin,clock,storage,runtime:readRuntime,now:()=>clock.now(),applyRuntime:()=>{},switchTab,emit:()=>onChange(),preflight,beginTick,endTick,wait:async()=>{}});
 const originalStop=runner.stop;runner.stop=(...args)=>{const result=originalStop(...args);ports?.releaseDisplay?.();prepared=false;return result;};
 const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 const same=(a,b)=>canonical(a)===canonical(b);
 const missionRoster=()=>missionServices.store.missions.map(m=>Object.fromEntries(['id','kind','params','notes','version','status','plan'].map(k=>[k,m[k]])));
 function sourceModule(status){const ids=Object.values(runner.state.missions);requireValue(status?.reachable===true&&status.exchange_contract==='guarded-v1'&&typeof status.instance_id==='string','현재 군집 운용 모듈을 확인하세요.');requireValue(Object.keys(status.committed??{}).every(id=>ids.includes(id)),'다른 실행의 확정 임무가 있어 시나리오 재개를 허용할 수 없습니다.');return {instance_id:status.instance_id,committed:status.committed??{},accepted_plans:Object.fromEntries(ids.map(id=>[id,status.accepted_plans?.[id]??null]))};}
 function currentEvidence(status){const runtime=readRuntime(),state=ports.deployment.state;requireValue(!simController.snapshot().error&&ports.store.deploymentConfirmed&&!ports.store.isDirty()&&!state.syncRequired&&!state.busy&&state.server?.run_id===runtime?.run_id,'시나리오의 현재 수락 배치와 초안을 확인하세요.');return {schema_version:1,contract:'source-scenario-resume-v1',source_commit:NODE_COMMUNICATION_METADATA.source_commit,run_id:runtime.run_id,started_at:runtime.started_at,definition:runner.definition,nodes:ports.store.deployed,deployment:state.server,stations:ground.stations,missions:missionRoster(),module:sourceModule(status),faults:runtime.active_faults,native_definition_hashes:lastNativeHashes};}
 async function checkpoint(){if(!prepared||!['ready','paused','playing','finished'].includes(runner.state.phase))return;const status=await missionServices.queryModule();const evidence=currentEvidence(status);requireValue(evidence.run_id===runner.state.runId&&evidence.native_definition_hashes,'현재 시나리오 검증 기록이 없습니다.');runner.checkpointWorkspace(evidence);}
 async function resumePreflight(){
  requireValue(!dead,'scenario workspace disposed');prepared=false;
  const saved=runner.state.workspaceEvidence;
  requireValue(saved?.schema_version===1&&saved.contract==='source-scenario-resume-v1'&&saved.source_commit===NODE_COMMUNICATION_METADATA.source_commit,'과거 실행에 재개 검증 기록이 없습니다. 새 세팅을 명시적으로 검토하세요.');
  requireValue(['ready','paused'].includes(runner.state.phase)&&typeof ports?.prepareSimUtc==='function'&&typeof ports?.verifySimUtc==='function'&&typeof api.nodeMissionContext==='function','재개 가능한 정지 시나리오와 native 검증 연결을 확인하세요.');
  const runtime=readRuntime();requireValue(runtime?.running===false&&runtime.run_id===saved.run_id&&runtime.run_id===runner.state.runId&&runtime.scenario_id===runner.state.scenarioId,'같은 시나리오 실행의 실제 SIM을 정지한 뒤 재개를 검증하세요.');
  lastNativeHashes=structuredClone(saved.native_definition_hashes);
  requireValue(typeof ports.deployment.reacceptCachedDeployment==='function','저장 배치의 실제 서버 재확인 연결이 필요합니다.');
  await ports.deployment.reacceptCachedDeployment(saved.deployment,saved.nodes);let status=await missionServices.queryModule();
  requireValue(same(currentEvidence(status),saved),'저장된 실행과 현재 배치·지상국·임무·장애 또는 모듈 증명이 달라 재개할 수 없습니다.');
  const utc=ports.simUtc(),receipt=await ports.prepareSimUtc(utc);
  requireValue(ports.verifySimUtc(receipt,utc)===true&&same(hashesOf(receipt),saved.native_definition_hashes),'현재 실제 SIM UTC의 전체 native 노드 정의 증명이 일치하지 않습니다.');
  const context=missionServices.context();requireValue(context.utc===utc&&same(context.nodes,saved.nodes)&&same(context.stations,ground.enabled)&&same(context.faults,saved.faults)&&same(context.deployment,saved.deployment)&&context.module.instance===saved.module.instance_id,'현재 native 임무 입력 범위가 저장 실행과 다릅니다.');
  const accepted=await api.nodeMissionContext({request_id:'scenario-resume:'+ (++resumeCounter),nodes:context.nodes,run_id:context.deployment.run_id,deployment_revision:context.deployment.revision,utc,stations:context.stations,faults:context.faults,module_instance:context.module.instance,module_sequence:context.module.sequence,external:context.external});
  requireValue(accepted?.schema_version===1&&accepted.status==='verified_analysis_inputs'&&accepted.communication_status==='unknown'&&/^[a-f0-9]{64}$/.test(accepted.context_hash??'')&&accepted.utc===utc&&same(accepted.nodes,saved.nodes)&&same(accepted.stations,context.stations)&&same(accepted.faults,saved.faults)&&same(accepted.deployment,saved.deployment)&&same(accepted.definition_hashes,saved.native_definition_hashes)&&same(accepted.external,context.external)&&accepted.module_instance===context.module.instance&&accepted.module_sequence===context.module.sequence,'native 재개 입력 수락 증명이 일치하지 않습니다.');
  status=await missionServices.queryModule();
  requireValue(readRuntime()?.running===false&&ports.simUtc()===utc&&ports.verifySimUtc(receipt,utc)===true&&same(currentEvidence(status),saved)&&status.sequence===accepted.module_sequence,'재개 검증 도중 실제 UTC·배치·임무 또는 모듈 상태가 바뀌었습니다.');
  prepared=true;return {run_id:saved.run_id,utc,node_count:saved.nodes.length,context_hash:accepted.context_hash,communication_status:'unknown'};
 }
 async function followAnalysis(){commandReady();requireValue(readRuntime()?.running===false&&typeof clockOwners.followAll==='function','실제 SIM 정지와 기존 분석 시계 연결이 필요합니다.');const run=readRuntime().run_id,utc=ports.simUtc();const result=await clockOwners.followAll(clock);commandReady();requireValue(readRuntime()?.running===false&&readRuntime().run_id===run&&ports.simUtc()===utc&&clockOwners.followedSource?.()===clock,'분석 따라가기 검증 도중 실제 실행이 바뀌었습니다.');return result;}
 async function releaseAnalysis(){requireValue(!dead,'scenario workspace disposed');if(clockOwners.followedSource?.()!==clock)return false;requireValue(typeof clockOwners.releaseAll==='function','기존 분석 시계 해제 연결이 필요합니다.');return clockOwners.releaseAll(clock);}
 async function stopReviewed(options){await releaseAnalysis();runner.stop(options);}
 for(const key of ['setup','pause','advance','skipToNextStep']){const original=runner[key];runner[key]=async(...args)=>{if(key==='setup')await releaseAnalysis();const result=await original(...args);await checkpoint();return result;};}
 const off=runner.subscribe(onChange);
 return Object.freeze({runner,clock,assembly,kpi,preflight,resumePreflight,followAnalysis,releaseAnalysis,stopReviewed,destroy(){if(dead)return;dead=true;runner.suspend();off();}});
}
