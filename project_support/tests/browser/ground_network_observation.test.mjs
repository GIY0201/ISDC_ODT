import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
import * as diagram from '../../../digital_twin/visualization/network_diagram.js';
function setup(width=1280,height=720){
 const f=fixture(width,height,{hash:'#ground'});f.evaluate('groundNetworkPanel.destroy()');
 let next=0,calls=0,canceled=0,drawHook=null,pollHook=null,statusHook=null;const timers=new Map(),draws=[];
 const stations=[{...model.createStation({preset:'daejeon'}),id:'G'}],nodes=[{id:'A',name:'Native A',orbit:{raan:0},formation:null}];
 const networkValue={status:'valid',utc:'2026-10-07T00:00:00Z',node_definitions:nodes,stations,faults:[],network:{nodes:[{id:'A',kind:'satellite'},{id:'G',kind:'ground'}],links:[{id:'L',a:'A',b:'G',kind:'ground',state:'visible'}]}};
 const history=[{quality:20,utc:networkValue.utc,instance_id:'one',sequence:1,network_hash:'a'.repeat(64),request_id:'q1',link_id:'L'},{quality:0,utc:'2026-10-07T00:00:01Z',instance_id:'one',sequence:2,network_hash:'b'.repeat(64),request_id:'q2',link_id:'L'}];
 const store={ready:true,stations,selectedId:'G',persistence:'memory_only',error:'',availablePresets:()=>[],find:id=>stations.find(s=>s.id===id),subscribe:()=>()=>{},get enabled(){return stations;}};
 const network={networkSnapshot:()=>structuredClone(networkValue),verifyNetworkSnapshot:()=>true,clearNetwork(){}};
 const fabric={snapshot:()=>({status:'unavailable',receipt:null,route:null,pending:false,refresh_required:true}),pollStatus(){calls++;return pollHook?.()??Promise.resolve(null);},cancelStatusPoll(){canceled++;},moduleStatus:()=>{statusHook?.();return{status:'valid',value:{reachable:true,instance_id:'one',sequence:2},error:''};},qualityHistory:id=>id==='L'?structuredClone(history):[],send:async()=>{throw Error('must not send');},refresh:async()=>{throw Error('must not review');}};
 const host={innerWidth:width,innerHeight:height,setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),addEventListener:f.win.addEventListener.bind(f.win),removeEventListener:f.win.removeEventListener.bind(f.win)};
 const panel=createGroundNetworkPanel({store,model,network,fabric,diagram,document:f.doc,host,refreshRuntime:async()=>{},drawSparkline:(canvas,values)=>{draws.push({canvas,values});drawHook?.();}});
 return{f,panel,timers,draws,history,networkValue,get calls(){return calls;},get canceled(){return canceled;},poll(fn){pollHook=fn;},draw(fn){drawHook=fn;},status(fn){statusHook=fn;},select:()=>f.get('ground-node-diagram').dispatch('click',{target:{closest:()=>({getAttribute:k=>k==='data-diagram-link'?'L':null})}})};
}
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
for(const reason of ['network','selection','history','removed-link'])test(`quality unavailable explicitly explains ${reason} without drawing or approving fabric`,async()=>{
 const s=setup();try{
  s.panel.show('ground');
  if(reason!=='selection')await s.select();
  const draws=s.draws.length;
  if(reason==='network')s.networkValue.status='unavailable';
  if(reason==='history')s.history.splice(0);
  if(reason==='removed-link')s.networkValue.network.links=[];
  s.panel.update();
  const text=s.f.get('ground-node-quality-status').textContent;
  assert.match(text,/미확인/);
  assert.match(text,reason==='network'?/검증된.*통신망.*없음/:reason==='selection'?/링크.*선택/:reason==='history'?/수락.*이력.*없음/:/선택.*링크.*없음/);
  assert.equal(s.f.get('ground-node-quality-history').hidden,true);
  assert.equal(s.draws.length,draws);
  assert.equal(s.f.get('ground-node-fabric-send').disabled,true);
  assert.equal(s.f.get('ground-node-fabric-route').disabled,true);
 }finally{s.panel.destroy();s.f.dispose();}
});
for(const [width,height]of [[1280,720],[1920,1080]])test(`ground status polls only while active and never clears explicit review ${width}x${height}`,async()=>{
 const s=setup(width,height);try{
  s.panel.show('ground');await settle();assert.equal(s.calls,1);assert.equal(s.timers.size,1);assert.equal([...s.timers.values()][0].ms,30000);
  assert.match(s.f.get('ground-node-module-status').textContent,/모듈.*조회/);assert.equal(s.f.get('ground-node-fabric-send').disabled,true);
  s.panel.show('ground');assert.equal(s.calls,1);const [id,job]=s.timers.entries().next().value;s.timers.delete(id);job.fn();await settle();assert.equal(s.calls,2);assert.equal(s.timers.size,1);
  s.panel.show('satellite');assert.equal(s.timers.size,0);assert.equal(s.canceled,1);job.fn();await settle();assert.equal(s.calls,2);
  s.panel.show('ground');await settle();assert.equal(s.calls,3);assert.equal(s.timers.size,1);s.panel.destroy();assert.equal(s.timers.size,0);assert.equal(s.canceled,2);
 }finally{s.panel.destroy();s.f.dispose();}
});
test('ground historical chart uses past provenance without current fabric approval',async()=>{
 const s=setup();try{s.panel.show('ground');await s.select();assert.deepEqual(s.draws.at(-1).values,[20,0]);assert.match(s.f.get('ground-node-quality-status').textContent,/과거.*2/);assert.match(s.f.get('ground-node-quality-status').textContent,/2026-10-07T00:00:01Z/);assert.equal(s.f.get('ground-node-fabric-send').disabled,true);assert.equal(s.f.get('ground-node-fabric-route').disabled,true);assert.equal(s.history.length,2);s.panel.update();assert.equal(s.history.length,2);}finally{s.panel.destroy();s.f.dispose();}
});
test('late poll and chart callback cannot revive a hidden ground panel',async()=>{
 const s=setup();let release;try{s.poll(()=>new Promise(r=>release=r));s.panel.show('ground');s.panel.show('satellite');release(null);await settle();assert.equal(s.timers.size,0);assert.equal(s.f.get('ground-node-module-status').textContent,'');s.panel.show('ground');s.draw(()=>s.panel.show('satellite'));await s.select();assert.equal(s.f.get('ground-node-quality-status').textContent,'');assert.equal(s.timers.size,0);}finally{s.panel.destroy();s.f.dispose();}
});
test('chart callback failure removes stale history claim without breaking ground controls',async()=>{
 const s=setup();try{s.panel.show('ground');await s.select();s.draw(()=>{throw Error('canvas unavailable');});assert.doesNotThrow(()=>s.panel.update());assert.match(s.f.get('ground-node-quality-status').textContent,/미확인/);}finally{s.panel.destroy();s.f.dispose();}
});
test('leaving from module status getter during initial mount cannot install a hidden timer',()=>{
 const s=setup();try{s.status(()=>{s.status(null);s.panel.show('satellite');});s.panel.show('ground');assert.equal(s.timers.size,0);assert.equal(s.calls,0);}finally{s.panel.destroy();s.f.dispose();}
});
test('history scope revoked inside chart callback cannot publish old historical points',async()=>{
 const s=setup();try{s.panel.show('ground');await s.select();s.draw(()=>s.history.splice(0));s.panel.update();assert.equal(s.f.get('ground-node-quality-history').hidden,true);assert.match(s.f.get('ground-node-quality-status').textContent,/미확인/);}finally{s.panel.destroy();s.f.dispose();}
});
test('last module getter scope revocation cannot publish history captured before it',async()=>{
 const s=setup();let drawn=false;try{s.panel.show('ground');await s.select();s.draw(()=>{drawn=true;});s.status(()=>{if(drawn)s.history.splice(0);});s.panel.update();assert.equal(s.f.get('ground-node-quality-history').hidden,true);assert.match(s.f.get('ground-node-quality-status').textContent,/미확인/);}finally{s.panel.destroy();s.f.dispose();}
});
for(const [width,height]of [[1280,720],[1920,1080]])test(`actual mounted fabric status uses GET only and releases its one timer ${width}x${height}`,async()=>{
 const timers=new Map(),requests=[];let id=0;
 const f=fixture(width,height,{hash:'#ground',setTimeout:(fn,ms)=>{const next=++id;timers.set(next,{fn,ms});return next;},clearTimeout:key=>timers.delete(key),fetch:async(url,options)=>{requests.push({url,method:options.method??'GET'});return{ok:true,json:async()=>url.endsWith('/api/data-fabric/status')?{exchange_contract:'guarded-v1',reachable:true,instance_id:'real-fixture-module',sequence:12,network_hash:null}:{revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]}};}});
 try{
  const before=f.snapshot();await settle();f.flush();assert.match(f.get('ground-node-module-status').textContent,/real-fixture-module.*12/);assert.equal(requests.filter(r=>r.url.endsWith('/api/data-fabric/status')).length,1);assert.equal([...timers.values()].filter(t=>t.ms===30000).length,1);
  f.evaluate("showWorkspaceOrbit('ground')");await settle();assert.equal([...timers.values()].filter(t=>t.ms===30000).length,1);assert.deepEqual(f.snapshot(),before);
  f.evaluate("showWorkspaceOrbit('satellite')");assert.equal([...timers.values()].filter(t=>t.ms===30000).length,0);assert.equal(requests.some(r=>r.method!=='GET'),false);
  await f.win.dispatch('pagehide',{persisted:false});assert.equal([...timers.values()].filter(t=>t.ms===30000).length,0);
 }finally{f.dispose();}
});
