import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './workspace_fixture.mjs';
import {createConstellationStore,DRAFT_KEY} from '../../../user_application/web/scripts/nodes/constellation.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import {projectWorkspaceContext} from '../../../user_application/web/scripts/workspace_context.js';
const original=JSON.parse(readFileSync(new URL('../fixtures/workspace_context_poc.json',import.meta.url)));
const clone=structuredClone;
async function workspace(){const values=new Map();let server={revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]};const f=fixture(1280,720,{hash:'#satellite',storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},fetch:async(_,options)=>{if(options.method==='POST'){const p=JSON.parse(options.body);server={revision:server.revision+1,run_id:'fixture',scope_id:'fixture:deployment:'+p.deployment_id,deployment_id:p.deployment_id,nodes:p.nodes};}return{ok:true,json:async()=>clone(server)};}});for(let n=0;n<50&&!f.evaluate('nodeWorkspace.scenarioPorts().store.loaded');n++)await new Promise(r=>setImmediate(r));f.evaluate("nodeWorkspace.scenarioPorts().store.addMany(Array.from({length:240},(_,i)=>nodeLibrary.createNode({}, {epoch:1791151272000,id:'N-'+i,catalogNumber:900001+i})))");await f.evaluate('nodeWorkspace.scenarioPorts().deployment.deploy()');return f;}
function input(f){const nodes=f.evaluate('nodeWorkspace.sceneSnapshot()'),c=clone(original.context),d=clone(original.data),utc=c.utc;c.nodes=clone(nodes.deployed);c.deployment=clone(nodes.server);c.module={instance:'module',sequence:4};c.settings={host:'local'};c.external=null;c.faults=[];c.missions=[];d.runtime={mode:'SIM',run_id:'fixture',scenario_id:'poc',elapsed_seconds:44,running:false};d.deployment=clone(nodes.server);d.module={...d.module,reachable:true,scope_id:nodes.server.scope_id,scope_contract:'isolated-v1'};return{nodes,display:{key:'sim:fixture',utc},sim:{runtime:d.runtime,error:''},data:{report:d,error:'',busy:false},selection:{domain:'source_node',id:nodes.drafts[0].id},mission:{ready:true,selected:{id:'M1',version:1},context:c,inspection:{context:clone(c),evidence:{accepted_context:{context_hash:'a'.repeat(64)}}},module:{reachable:true,exchange_contract:'guarded-v1',instance_id:'module',accepted_plans:{M1:{instance_id:'module',mission_id:'M1',mission_version:1,context_hash:'a'.repeat(64),feasible:true}},committed:{}}}};}
function compact(f,x){return {...x,nodes:f.evaluate('nodeWorkspace.contextPresentation()')};}
test('240-node owner presentation matches full legacy context across scope/status gates without returning node arrays',async()=>{const f=await workspace();try{for(const mutate of [()=>{},x=>x.selection=null,x=>x.sim.error='offline',x=>x.sim.runtime.run_id='foreign',x=>x.mission.module.instance_id='foreign',x=>x.mission.context.nodes[0].equipment[0].enabled=false,x=>x.mission.context.deployment.revision++,x=>x.mission.context.faults=[{kind:'link_loss'}],x=>x.data.report.deployment.nodes[0].equipment[0].enabled=false,x=>x.data.report.deployment.revision++,x=>x.data.busy=true,x=>x.data.error='failed',x=>x.display=null,x=>{x.selection=null;x.catalog={selected:{catalog_number:25994,normalized_gp_sha256:'b'.repeat(64)},display:{status:'valid',frame:'ITRF',normalized_gp_sha256:'b'.repeat(64),catalog_number:25994,name:'TERRA',utc:x.display.utc}};x.display.key='catalog:25994:'+ 'b'.repeat(64);},x=>{x.selection=null;x.stored={inputs:[{input_id:'stored-1',raw_sha256:'c'.repeat(64),satellite_id:'ISS',source:'saved'}],state:{input_id:'stored-1'}};x.display.key='stored:stored-1:'+ 'c'.repeat(64);},x=>{x.selection={domain:'source_node',id:'missing'};x.display=null;x.mission=null;x.data=null;},x=>{x.selection=null;x.sim=null;x.nodes=null;x.mission=null;x.data=null;}]){const x=input(f);mutate(x);const before=JSON.stringify(x);assert.deepEqual(projectWorkspaceContext(compact(f,x)),projectWorkspaceContext(x));assert.equal(JSON.stringify(x),before);}const p=f.evaluate('nodeWorkspace.contextPresentation()');assert.equal(p.deployed_count,240);assert.equal(p.drafts,undefined);assert.equal(p.deployed,undefined);assert.equal(p.calculation,undefined);assert.equal(p.server.nodes,undefined);p.selected_node.name='mutated copy';p.server.run_id='mutated copy';assert.notEqual(f.evaluate('nodeWorkspace.contextPresentation().server.run_id'),'mutated copy');}finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}});
test('context tick uses private projection and never calls public full sceneSnapshot getter',async()=>{const f=await workspace();try{f.evaluate("nodeWorkspace={...nodeWorkspace,sceneSnapshot(){throw Error('full sceneSnapshot must not be read by context tick')}}");const result=f.evaluate('readWorkspaceContext()');assert.ok(result.text.contextRelated);for(let n=0;n<20;n++)f.evaluate('readWorkspaceContext()');}finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}});


test('ordered full-node presentation comparison rejects timestamp-only, reordered and equipment edits even when source dirty ignores them',()=>{
 const values=new Map(),memory={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};let now=1791151272000,equipment=0;
 const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++equipment}`});
 const store=createConstellationStore({library,storage:memory,now:()=>now,verifyAcceptance:()=>true});store.load();store.add({name:'first'});store.add({name:'second'});store.deploy(store.drafts,{source:'test'});
 const accepted=store.deployed,ids=accepted.map(n=>n.id),before=store.snapshot();
 assert.equal(store.contextPresentation(ids).drafts_equal_deployed,true);
 now+=1000;assert.deepEqual(store.update(ids[0],store.find(ids[0])),[]);assert.equal(store.isDirty(),false);
 assert.equal(store.contextPresentation(ids).drafts_equal_deployed,false,'updated_at is significant to context even if source isDirty ignores it');
 assert.equal(store.matchesDeployed(accepted),true);const timestamp=structuredClone(accepted);timestamp[0].updated_at=store.find(ids[0]).updated_at;assert.equal(store.matchesDeployed(timestamp),false);
 // Source reload/reaccept allows order-insensitive dirty equivalence. Context keeps its stricter ordered equality.
 const persisted=JSON.parse(memory.getItem(DRAFT_KEY));persisted.nodes=structuredClone(accepted).reverse();memory.setItem(DRAFT_KEY,JSON.stringify(persisted));store.load({discardLocal:true});store.deploy(accepted,before.receipt,{restore:true});
 assert.equal(store.deploymentConfirmed,true);assert.equal(store.isDirty(),false);assert.equal(store.contextPresentation(ids).drafts_equal_deployed,false);assert.equal(store.matchesDeployed([...accepted].reverse()),false);
 const changed=store.find(ids[0]);changed.equipment[0].enabled=!changed.equipment[0].enabled;assert.deepEqual(store.update(ids[0],changed),[]);assert.equal(store.isDirty(),true);assert.equal(store.contextPresentation(ids).drafts_equal_deployed,false);
 store.deploy(store.drafts,{source:'new'});assert.equal(store.contextPresentation(store.deployed.map(n=>n.id)).drafts_equal_deployed,true);
 assert.equal(store.contextPresentation([...ids].reverse()).server_ids_match,true);assert.equal(store.contextPresentation(ids).server_ids_match,false);
 const node=store.nodeForPresentation(ids[0]);node.name='outside';assert.notEqual(store.nodeForPresentation(ids[0]).name,'outside');
});

test('actual deployment owner predicates reject full foreign receipt/roster and stop after disposal while public snapshots remain copies',async()=>{
 const f=await workspace();try{
  const x=input(f),p=f.evaluate('nodeWorkspace.contextPresentation()'),server=x.nodes.server;
  assert.equal(p.matchesServer(server),true);assert.equal(p.matchesServerNodes(server.nodes),true);
  for(const mutate of [s=>s.run_id='foreign',s=>s.scope_id='foreign',s=>s.revision++,s=>s.nodes.reverse(),s=>s.nodes[0].equipment[0].enabled=!s.nodes[0].equipment[0].enabled,s=>s.nodes[0].updated_at='2026-10-07T00:00:00Z']){
   const changed=structuredClone(server);mutate(changed);assert.equal(p.matchesServer(changed),false);assert.equal(p.matchesServerNodes(changed.nodes),JSON.stringify(changed.nodes)===JSON.stringify(server.nodes));
  }
  const publicCopy=f.evaluate('nodeWorkspace.sceneSnapshot()');publicCopy.server.nodes[0].name='outside';publicCopy.drafts[0].name='outside';assert.notEqual(f.evaluate('nodeWorkspace.sceneSnapshot().drafts[0].name'),'outside');assert.notEqual(f.evaluate('nodeWorkspace.sceneSnapshot().server.nodes[0].name'),'outside');
  f.evaluate('nodeWorkspace.destroy()');assert.equal(f.evaluate('nodeWorkspace.contextPresentation()'),null);assert.equal(p.matchesServer(server),false);assert.equal(p.matchesServerNodes(server.nodes),false);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});


test('V6 context tick uses private network presentation and retains verified full-owner fallback',async()=>{
 const f=await workspace();try{
  f.evaluate("nodeWorkspace={...nodeWorkspace,networkSnapshot(){throw Error('full networkSnapshot must not be read by context tick')}}");
  assert.doesNotThrow(()=>f.evaluate('readWorkspaceContext()'));
  // Old injected owners remain supported; absent summary does not imply verified.
  f.evaluate("nodeWorkspace={...nodeWorkspace,networkPresentation:undefined,networkSnapshot:()=>null,verifyNetworkSnapshot:()=>{throw Error('no proof cannot be verified')}}");
  assert.equal(f.evaluate('readWorkspaceContext().communication.status'),'unavailable');
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
