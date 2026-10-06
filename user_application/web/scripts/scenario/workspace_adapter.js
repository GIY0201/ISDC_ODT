// Assembly adapter only: the existing workspace owners retain node, SIM, mission and fabric state.
import {pairKey} from '../nodes/links.js';
import {createScenarioRunner} from './runner.js';
import {createScenarioClock} from './clock.js';
const requireValue=(value,message)=>{if(!value)throw Error(message);};
export function createWorkspaceScenario({api,nodeWorkspace,ground,missionServices,fabric,simController,nodeLibrary,missionTypes,stationModel,assemblyFactory,kpi,storage=null,onChange=()=>{},switchTab=()=>{},clockOwners={},affectedTasks=null}={}){
 requireValue(api&&nodeWorkspace&&ground&&missionServices&&fabric&&simController&&missionTypes&&stationModel&&typeof assemblyFactory==='function'&&kpi,'existing scenario workspace owners required');
 const ports=typeof nodeWorkspace.scenarioPorts==='function'?nodeWorkspace.scenarioPorts():null;
 const library=nodeLibrary??ports?.nodeLibrary;
 requireValue(library,'existing scenario node model required');
 const assembly=assemblyFactory({nodeLibrary:library,stationModel,missionTypes});
 const readRuntime=()=>simController.snapshot().runtime;
 let dead=false,prepared=false;
 const clock=createScenarioClock({runtime:readRuntime,...clockOwners});
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
 function commandReady(){requireValue(!dead&&prepared,'native SIM UTC 시나리오 전체 세팅 검토를 먼저 완료하세요.');}
 async function prepare(){commandReady();const utc=ports.simUtc();const receipt=await ports.prepareSimUtc(utc);requireValue(await ports.verifySimUtc(receipt,utc)===true,'native input receipt does not match actual SIM UTC');await missionServices.queryModule();const context=missionServices.context();requireValue(context.utc===utc,'accepted mission UTC differs from scenario SIM UTC');return context;}
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
 const off=runner.subscribe(onChange);
 return Object.freeze({runner,clock,assembly,kpi,preflight,destroy(){if(dead)return;dead=true;runner.suspend();off();}});
}
