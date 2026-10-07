// Readonly presentation of existing owners. No clock, state store or I/O.
const modeLabels=new Map([['standalone','단독 운용'],['em','EM 연동'],['integration','통합 시험']]);
const text=v=>typeof v==='string'&&v.trim()?v:null;
const utc=v=>text(v)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(v)?v:null;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=(a,b)=>{const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;return JSON.stringify(sort(a))===JSON.stringify(sort(b));};
const physical=v=>{if(!v)return null;const c=structuredClone(v);delete c.missions;if(c.module)c.module={instance:c.module.instance};return c;};
const ids=nodes=>Array.isArray(nodes)?nodes.map(n=>n.id):null;
export function projectWorkspaceContext({display=null,catalog=null,stored=null,nodes=null,sim=null,mission=null,fabric=null,data=null,selection=null,network=null,configuredMode=null}={}){
 const runtime=!sim?.error&&sim?.runtime?.mode==='SIM'&&text(sim.runtime.run_id)&&Number.isFinite(sim.runtime.elapsed_seconds)&&sim.runtime.elapsed_seconds>=0&&typeof sim.runtime.running==='boolean'?sim.runtime:null;
 const run={status:runtime?'source_sim':'unavailable',id:runtime?.run_id??null,scenario_id:runtime?.scenario_id??null,elapsed_seconds:runtime?.elapsed_seconds??null,running:runtime?.running??null};
 const compact=nodes?.contract==='node-workspace-presentation-v1'&&['matchesDeployed','matchesServer','matchesServerNodes','nodeForSelection'].every(key=>typeof nodes[key]==='function');
 const accepted=runtime&&nodes?.loaded===true&&nodes.deployment_confirmed===true&&!nodes.error&&nodes.server?.run_id===runtime.run_id&&Number.isSafeInteger(nodes.server.revision)&&(compact?nodes.server_ids_match===true&&nodes.drafts_equal_deployed===true:same(ids(nodes.deployed),ids(nodes.server.nodes))&&same(nodes.drafts,nodes.deployed));
 const deployment={status:accepted?'accepted':'unavailable',count:accepted?(compact?nodes.deployed_count:nodes.deployed.length):0,run_id:accepted?nodes.server.run_id:null,revision:accepted?nodes.server.revision:null,scope_id:accepted?nodes.server.scope_id:null};
 let identity={domain:'unavailable',id:null,name:null,status:'unavailable',source:null},time=null;
 const displayUtc=utc(display?.utc),key=text(display?.key);
 if(displayUtc&&key){
  if(key==='sim:'+runtime?.run_id){identity={domain:'source_sim',id:runtime.run_id,name:runtime.scenario_id,status:'analysis',source:'SIM'};time=displayUtc;}
  const gp=catalog?.display,selected=catalog?.selected;
  if(!catalog?.error&&gp?.status==='valid'&&gp.frame==='ITRF'&&hash(gp.normalized_gp_sha256)&&gp.normalized_gp_sha256===selected?.normalized_gp_sha256&&gp.catalog_number===selected?.catalog_number&&gp.utc===displayUtc&&key===`catalog:${gp.catalog_number}:${gp.normalized_gp_sha256}`){identity={domain:'catalog_gp',id:String(gp.catalog_number),name:text(gp.name??gp.object_name),status:'native_analysis',source:text(gp.source)??'GP'};time=displayUtc;}
  const state=stored?.state,record=stored?.inputs?.find(r=>r.input_id===state?.input_id);
  if(!stored?.error&&record&&key===`stored:${record.input_id}:${record.raw_sha256}`){identity={domain:'stored_orbit',id:record.input_id,name:record.satellite_id,status:'saved_analysis',source:text(record.source)};time=displayUtc;}
  if(key.startsWith('scene:')&&hash(key.slice(6))){identity={domain:'catalog_scene',id:key.slice(6),name:null,status:'native_analysis',source:'카탈로그 전체 장면'};time=displayUtc;}
 }
 if(selection?.domain==='source_node'){
  const node=compact?nodes.nodeForSelection(selection.id):nodes?.drafts?.find(n=>n.id===selection.id);
  if(node){identity={domain:'source_node',id:node.id,name:node.name,status:accepted&&time?'accepted_analysis':'draft',source:'노드 모델'};if(identity.status==='draft')time=null;}
 }
 const chosen=mission?.ready?mission.selected:null,plan=chosen&&mission?.module?.accepted_plans?.[chosen.id],context=mission?.context,inspection=mission?.inspection;
 const planCurrent=chosen&&accepted&&time&&context?.utc===time&&(compact?nodes.matchesServer(context.deployment)&&nodes.matchesDeployed(context.nodes):same(context.deployment,nodes.server)&&same(context.nodes,nodes.deployed))&&same(physical(context),physical(inspection?.context))&&mission.module?.reachable===true&&mission.module.exchange_contract==='guarded-v1'&&plan?.instance_id===mission.module.instance_id&&plan.mission_id===chosen.id&&plan.mission_version===chosen.version&&hash(plan.context_hash)&&plan.context_hash===inspection?.evidence?.accepted_context?.context_hash;
 const missionView={id:chosen?.id??null,status:planCurrent?(mission.module.committed?.[chosen.id]?'module_committed':'module_accepted_plan'):chosen?'draft_or_previous_plan':'unavailable',feasible:planCurrent?plan.feasible:null};
 // The fabric owner reconciles receipt scope; the native network verifier also
 // proves it still belongs to this displayed UTC/input, not another SIM run.
 const canonicalTime=v=>utc(v)?.replace(/(?:\.0+|\.(\d*?[1-9])0+)Z$/,(_,digits)=>digits?'.'+digits+'Z':'Z');
 const proof=network?.proof;
 const networkCurrent=time&&network?.verified===true&&proof?.status==='valid'&&proof.utc===time&&utc(proof.network?.time)&&canonicalTime(proof.network.time)===canonicalTime(fabric?.receipt?.time);
 const receipt=networkCurrent&&!fabric?.error&&!fabric?.pending&&!fabric?.refresh_required&&['accepted','routed'].includes(fabric?.status)&&hash(fabric?.receipt?.network_hash)?fabric.receipt:null;
 const communication={status:receipt?'last_verified_query':'unavailable',utc:receipt?proof.utc:null,module_utc:receipt?.time??null,module_instance:receipt?.instance_id??null,sequence:receipt?.sequence??null,actual_rf:'unknown'};
 const report=!data?.error&&!data?.busy?data?.report:null;
 const dataCurrent=accepted&&report?.runtime?.run_id===runtime.run_id&&report.deployment?.run_id===runtime.run_id&&report.deployment?.scope_id===nodes.server.scope_id&&report.deployment?.revision===nodes.server.revision&&(compact?nodes.matchesServerNodes(report.deployment.nodes):same(report.deployment.nodes,nodes.server.nodes))&&report.module?.reachable===true&&report.module.scope_contract==='isolated-v1'&&report.module.scope_id===nodes.server.scope_id;
 const dataView={status:dataCurrent?'last_verified_query':'unavailable',scope_id:dataCurrent?report.deployment.scope_id:null,elapsed_seconds:dataCurrent?report.runtime.elapsed_seconds:null,objects:dataCurrent?report.module.objects:null,implementation:dataCurrent?report.module.implementation:null,selected_id:dataCurrent?data.selected_id??null:null};
 const domainLabel={source_sim:'SIM',source_node:'SIM 노드',catalog_gp:'GP 위성',catalog_scene:'GP 장면',stored_orbit:'보존 궤도',unavailable:'현재 대상 미확인'}[identity.domain];
 const handoff=`${domainLabel} ${identity.name??identity.id??'미선택'} → 임무 ${missionView.id??'미선택'} (${missionView.status}) → 통신 ${communication.status} → 데이터 ${dataView.status} · 실제 RF·수신·장비 보안·시설 상태 미확인`;
 return {identity,utc:{value:time,frame:time&&['catalog_gp','stored_orbit','catalog_scene'].includes(identity.domain)?'ITRF':null,kind:'analysis_display'},run,deployment,mission:missionView,communication,data:dataView,handoff,text:{mode:modeLabels.get(configuredMode)??'운용 모드 미확인',satellite:identity.domain==='catalog_scene'?'전체 위성 · GP 장면':`${identity.name??identity.id??'미선택'} · ${domainLabel}`,clock:time??'분석 UTC 미확인',contextId:identity.domain==='catalog_scene'?'전체 위성':identity.id??'현재 대상 미선택',contextRelated:`${domainLabel} / ${identity.source??'자료 미확인'} / ${accepted?`${deployment.count}개 수락 노드`:'배치 미확인'} / ${run.id??'SIM 실행 미확인'}`,status:`${identity.status} · 실제 원격측정·RF 미확인`,next:'검증된 접촉 구간은 지상국·통신 창에서 확인',event:'실제 경보 미연동',alert:handoff}};
}
