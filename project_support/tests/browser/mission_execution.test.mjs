import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionExecution} from '../../../user_application/web/scripts/missions/mission_execution.js';
import {createMissionStore} from '../../../user_application/web/scripts/missions/mission_store.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
const types=createMissionTypes(createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=> 'EQ'})),utc='2020-07-12T21:16:01.000416000Z',hash='a'.repeat(64);
function setup(){
 const store=createMissionStore({model:types,now:()=>Date.parse(utc)});assert.equal(store.load(),true);
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
 return {execution,store,mission,status,task,calls,setCurrent:v=>current=v,loseReply:()=>fail=true,changeDuring:()=>changeDuring=true,loseAfterAck:()=>loseAfter=true,conflict:()=>conflict=true};
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
