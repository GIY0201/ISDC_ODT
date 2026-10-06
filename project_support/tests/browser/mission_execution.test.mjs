import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionExecution} from '../../../user_application/web/scripts/missions/mission_execution.js';
import {createMissionStore} from '../../../user_application/web/scripts/missions/mission_store.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
const types=createMissionTypes(createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=> 'EQ'})),utc='2020-07-12T21:16:01.000416000Z',hash='a'.repeat(64);
function setup({storage=null}={}){
 const store=createMissionStore({model:types,storage,now:()=>Date.parse(utc)});assert.equal(store.load(),true);
 const mission=store.add({name:'compute',kind:'compute',params:{input_mb:10,output_ratio:0.1}}).mission;
 const status={exchange_contract:'guarded-v1',instance_id:'module',reachable:true,sequence:0,accepted_plans:{},accepted_decisions:{},committed:{}};
 const task={id:'T-1',kind:'compute',satellite:'N-1',start:utc,end:'2020-07-12T21:17:01.000416000Z',input_mb:10,output_mb:1,power_w:17,custom:{required:'keep all fields'}};
 let counter=0,current=true,fail=false,changeDuring=false,loseAfter=false,conflict=false;
 const calls=[];const client={endpoint:()=>({base:'',source:'server',placement:'server'}),status:async()=>structuredClone(status),guardedPlan:async(body,guard)=>{
  calls.push({operation:'plan',body:structuredClone(body),guard:structuredClone(guard)});
  const answer={exchange_contract:'guarded-v1',instance_id:'module',sequence:++status.sequence,request_id:guard.request_id,context_hash:guard.context_hash,mission_id:mission.id,mission_version:guard.mission_version,plan_sequence:status.sequence,time:body.time,feasible:true,tasks:[structuredClone(task)],summary:{satellites:['N-1']}};status.accepted_plans[mission.id]=answer;return structuredClone(answer);
 },guardedCommit:async(body,guard)=>{
  calls.push({operation:body.decision,body:structuredClone(body),guard:structuredClone(guard)});
  if(conflict)throw Object.assign(new Error('sequence conflict'),{conflict:true,status:409});
  if(fail){fail=false;throw Object.assign(new Error('response lost'),{unavailable:true});}
  const answer={exchange_contract:'guarded-v1',instance_id:'module',sequence:++status.sequence,request_id:guard.request_id,context_hash:guard.context_hash,mission_id:mission.id,mission_version:body.version,plan_sequence:guard.plan_sequence,accepted:true,decision:body.decision,held_tasks:body.decision==='commit'?body.tasks.length:0};
  if(body.decision==='commit')status.committed[mission.id]={version:body.version,tasks:body.tasks.length};else{delete status.committed[mission.id];delete status.accepted_plans[mission.id];}
  status.accepted_decisions[mission.id]=structuredClone(answer);if(changeDuring)current=false;if(loseAfter){loseAfter=false;throw Object.assign(new Error('accepted response lost'),{unavailable:true});}return answer;
 }};
 const builder={build:async m=>({request:{time:utc,mission:{id:m.id}},context:{utc,scope:'all'},evidence:{sampled:true}})};
 const execution=createMissionExecution({store,builder,client,verifyContext:()=>current,hashContext:async()=>hash,nextRequestId:()=>`window:${++counter}`});
 return {execution,store,mission,status,task,calls,client,builder,setCurrent:v=>current=v,loseReply:()=>fail=true,changeDuring:()=>changeDuring=true,loseAfterAck:()=>loseAfter=true,conflict:()=>conflict=true};
}
test('exact accepted full tasks and analysis UTC reach source commit, then source status is updated',async()=>{
 const s=setup();await s.execution.plan(s.mission.id);assert.equal(s.store.find(s.mission.id).status,'planned');
 const r=await s.execution.commit(s.mission.id);assert.equal(r.answer.accepted,true);assert.deepEqual(s.calls[1].body.tasks,[s.task]);assert.equal(s.calls[1].body.time,utc);assert.equal(s.store.find(s.mission.id).status,'committed');
});
test('fresh commit rejects changed physical context, module instance, plan receipt or source request',async()=>{
 for(const kind of ['context','instance','plan','mission']){
  const s=setup();await s.execution.plan(s.mission.id);
  if(kind==='context')s.setCurrent(false);if(kind==='instance')s.status.instance_id='new';if(kind==='plan')s.status.accepted_plans[s.mission.id].tasks[0].custom.required='altered';if(kind==='mission')s.store.update(s.mission.id,{params:{input_mb:20}});
  await assert.rejects(s.execution.commit(s.mission.id));assert.equal(s.calls.length,1);
 }
});
test('abort uses authoritative retained receipt even when physical context is no longer current',async()=>{
 const s=setup();await s.execution.plan(s.mission.id);await s.execution.commit(s.mission.id);s.setCurrent(false);
 const r=await s.execution.abort(s.mission.id);assert.equal(r.answer.accepted,true);assert.deepEqual(s.calls[2].body.tasks,[]);assert.equal(s.calls[2].body.time,utc);assert.equal(s.store.find(s.mission.id).status,'aborted');assert.deepEqual(s.status.committed,{});
});
test('ambiguous commit blocks new commands and exact retry retains original request and guard',async()=>{
 const s=setup();await s.execution.plan(s.mission.id);s.loseReply();await assert.rejects(s.execution.commit(s.mission.id),/response lost/);
 assert.equal(s.execution.snapshot().status,'uncertain');await assert.rejects(s.execution.plan(s.mission.id),/pending/);
 await s.execution.retry();assert.deepEqual(s.calls[1],s.calls[2]);assert.equal(s.store.find(s.mission.id).status,'committed');
});
test('accepted command after context drift is reported accepted and stale, not silently discarded',async()=>{
 const s=setup();await s.execution.plan(s.mission.id);s.changeDuring();const r=await s.execution.commit(s.mission.id);assert.equal(r.answer.accepted,true);assert.equal(r.current,false);assert.equal(s.store.find(s.mission.id).status,'committed');
});
test('disposed controller rejects new commands; copied snapshots cannot rewrite pending commands',async()=>{
 const s=setup();await s.execution.plan(s.mission.id);s.loseReply();await assert.rejects(s.execution.commit(s.mission.id));const snapshot=s.execution.snapshot();snapshot.pending.body.tasks=[];
 await s.execution.retry();assert.deepEqual(s.calls.at(-1).body.tasks,[s.task]);s.execution.destroy();await assert.rejects(s.execution.plan(s.mission.id),/disposed/);
});

test('response lost after actual acceptance is reconciled by authoritative receipt without another command',async()=>{
 const s=setup();await s.execution.plan(s.mission.id);s.loseAfterAck();await assert.rejects(s.execution.commit(s.mission.id),/accepted response lost/);
 const count=s.calls.length;const r=await s.execution.reconcile();assert.equal(r.answer.accepted,true);assert.equal(s.calls.length,count);assert.equal(s.store.find(s.mission.id).status,'committed');
});
test('missing acceptance proof remains uncertain rather than inventing rejection',async()=>{
 const s=setup();await s.execution.plan(s.mission.id);s.loseReply();await assert.rejects(s.execution.commit(s.mission.id));await assert.rejects(s.execution.reconcile(),/not proven/);assert.equal(s.execution.snapshot().status,'uncertain');
});
test('definitive fresh conflict releases pending command without claiming acceptance',async()=>{
 const s=setup();await s.execution.plan(s.mission.id);s.conflict();await assert.rejects(s.execution.commit(s.mission.id),/sequence conflict/);assert.equal(s.execution.snapshot().status,'conflict');assert.equal(s.execution.snapshot().pending,null);
});

const root=new URL('../../../',import.meta.url),fabricUrl=new URL('communication/browser/data_fabric.js',root).href;
const clientSource=(await readFile(new URL('communication/browser/orchestration.js',root),'utf8')).replace('/static/communication/data_fabric.js',fabricUrl);
const {createOrchestrationClient}=await import(`data:text/javascript;base64,${Buffer.from(clientSource).toString('base64')}`);
const httpFixture=JSON.parse(await readFile(new URL('../fixtures/mission_execution_http.json',import.meta.url),'utf8'));
test('real source store and unchanged ICD-03 client follow captured actual router plan/commit/abort receipts',async()=>{
 const fixture=structuredClone(httpFixture),store=createMissionStore({model:types,now:()=>Date.parse(fixture.request.time)});assert.equal(store.load(),true);
 const mission=store.add({name:'source observation',...fixture.request.mission}).mission;assert.equal(mission.id,fixture.request.mission.id);
 let phase=0,counter=0;const sent=[];
 const client=createOrchestrationClient({storage:null,fetchImpl:async(url,options)=>{
  if(url.endsWith('/status'))return Response.json(fixture.status[phase]);
  const body=JSON.parse(options.body);sent.push(body);
  const receipt=phase===0?fixture.plan:phase===1?fixture.commit:fixture.abort;
  assert.equal(options.headers['X-ISDC-Orchestration-Sequence'],String(phase));assert.equal(options.headers['X-ISDC-Orchestration-Instance'],fixture.status[0].instance_id);
  assert.equal(options.headers['X-ISDC-Orchestration-Request-Id'],`fixture:${phase+1}`);
  assert.deepEqual(body,phase===0?fixture.request:phase===1?fixture.commit_request:fixture.abort_request);phase++;return Response.json(receipt);
 }});
 const execution=createMissionExecution({store,client,builder:{build:async()=>({request:fixture.request,context:{captured:true},evidence:{transport:fixture.transport}})},verifyContext:()=>true,hashContext:async()=>fixture.plan.context_hash,nextRequestId:()=>`fixture:${++counter}`});
 await execution.plan(mission.id);const committed=await execution.commit(mission.id);assert.equal(committed.answer.held_tasks,4);assert.deepEqual(sent[1].tasks,fixture.plan.tasks);
 const aborted=await execution.abort(mission.id);assert.equal(aborted.answer.held_tasks,0);assert.equal(store.find(mission.id).status,'aborted');assert.equal(phase,3);execution.destroy();store.destroy();
});

test('explicit fresh replan after reload never adopts the stored accepted plan',async()=>{const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},s=setup({storage});await s.execution.plan(s.mission.id);s.execution.destroy();s.store.destroy();const store=createMissionStore({model:types,storage,now:()=>Date.parse(utc)});assert.equal(store.load(),true);const execution=createMissionExecution({store,builder:s.builder,client:s.client,verifyContext:()=>true,hashContext:async()=>hash,nextRequestId:()=>`reload:${s.calls.length}`});await assert.rejects(execution.commit(s.mission.id),/context changed/);assert.equal(s.calls.length,1);await execution.replanLatest(s.mission.id);assert.equal(s.calls.length,2);assert.equal(s.calls[1].guard.mission_version,2);assert.equal(store.find(s.mission.id).plan.version,2);assert.deepEqual(store.find(s.mission.id).plan.tasks,[s.task]);await execution.commit(s.mission.id);assert.deepEqual(s.calls[2].body.tasks,[s.task]);assert.equal(s.calls[2].body.version,2);execution.destroy();store.destroy();});
test('explicit replan reconciles an ahead module version only through fresh accepted native planning',async()=>{const s=setup();await s.execution.plan(s.mission.id);s.status.accepted_plans[s.mission.id].mission_version=4;s.status.sequence=9;await assert.rejects(s.execution.plan(s.mission.id),/reconciled/);assert.equal(s.calls.length,1);await s.execution.replanLatest(s.mission.id);assert.equal(s.calls[1].guard.mission_version,5);assert.equal(s.store.find(s.mission.id).plan.version,5);assert.equal(s.execution.snapshot().status,'planned');await s.execution.commit(s.mission.id);assert.equal(s.calls[2].body.version,5);assert.deepEqual(s.calls[2].body.tasks,[s.task]);});
test('recovery rejects malformed prior acceptance and changed native input without automatic abort',async()=>{for(const kind of ['version','instance','context','held']){const s=setup();await s.execution.plan(s.mission.id);if(kind==='version')s.status.accepted_plans[s.mission.id].mission_version='4';if(kind==='instance')s.status.accepted_plans[s.mission.id].instance_id='foreign';if(kind==='context')s.setCurrent(false);if(kind==='held')s.status.committed[s.mission.id]={version:1,tasks:1};await assert.rejects(s.execution.replanLatest(s.mission.id));assert.equal(s.calls.length,1);assert.equal(s.store.find(s.mission.id).plan.version,1);}});
test('cancelled latest-version status or native preparation sends no recovery command',async()=>{for(const stage of ['status','native']){const s=setup(),controller=new AbortController();if(stage==='status'){const original=s.client.status;s.client.status=async()=>{const value=await original();controller.abort();return value;};}else{const original=s.builder.build;s.builder.build=async(...a)=>{const value=await original(...a);controller.abort();return value;};}await assert.rejects(s.execution.replanLatest(s.mission.id,{signal:controller.signal}),{name:'AbortError'});assert.equal(s.calls.length,0);assert.equal(s.store.find(s.mission.id).plan,null);}});

test('module advancing during recovery is an explicit conflict with old local plan retained',async()=>{const s=setup();await s.execution.plan(s.mission.id);const before=s.store.missions,original=s.builder.build;s.builder.build=async(...args)=>{const result=await original(...args);s.status.sequence++;return result;};const post=s.client.guardedPlan;s.client.guardedPlan=async(body,guard)=>{if(guard.expected_sequence!==s.status.sequence)throw Object.assign(Error('other window sequence conflict'),{conflict:true});return post(body,guard);};await assert.rejects(s.execution.replanLatest(s.mission.id),/other window/);assert.equal(s.execution.snapshot().status,'conflict');assert.equal(s.execution.snapshot().pending,null);assert.deepEqual(s.store.missions,before);assert.equal(s.calls.length,1);});
test('recovery cannot erase an uncertain command or accept a receipt ahead of module sequence',async()=>{const s=setup();await s.execution.plan(s.mission.id);s.loseReply();await assert.rejects(s.execution.commit(s.mission.id));await assert.rejects(s.execution.replanLatest(s.mission.id),/pending/);assert.equal(s.execution.snapshot().status,'uncertain');assert.equal(s.calls.length,2);const other=setup();await other.execution.plan(other.mission.id);other.status.accepted_plans[other.mission.id].plan_sequence=999;other.status.accepted_plans[other.mission.id].sequence=999;await assert.rejects(other.execution.replanLatest(other.mission.id),/sequence exceeds/);assert.equal(other.calls.length,1);});

test('recovery fences changed source request and module endpoint during native preparation',async()=>{for(const kind of ['mission','endpoint']){const s=setup();await s.execution.plan(s.mission.id);const original=s.builder.build;s.builder.build=async(...args)=>{const value=await original(...args);if(kind==='mission')s.store.update(s.mission.id,{params:{input_mb:99}});else s.client.endpoint=()=>({base:'other',source:'explicit',placement:'remote'});return value;};await assert.rejects(s.execution.replanLatest(s.mission.id),/context changed/);assert.equal(s.calls.length,1);assert.equal(s.execution.snapshot().pending,null);}});
