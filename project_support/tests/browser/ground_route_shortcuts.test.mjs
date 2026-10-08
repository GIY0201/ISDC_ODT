import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
import * as diagram from '../../../digital_twin/visualization/network_diagram.js';

function setup(){
 const f=fixture(1920,1080,{hash:'#ground'}),store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');
 const state={valid:true,status:'accepted',pending:false,error:'',refresh_required:false,readHook:null,verifyHook:null,fabricHook:null};
 const station=store.enabled[0],nodes=[{id:'A',name:'A',kind:'satellite'},{id:'B',name:'B',kind:'satellite'},{id:station.id,name:station.name,kind:'ground'}];
 const proof={status:'valid',utc:'2026-10-07T00:00:00.000000000Z',node_definitions:nodes.slice(0,2),stations:[station],network:{nodes,links:[]}};
 const receipt={instance_id:'M',sequence:1,network_hash:'a'.repeat(64),nodes:nodes.map(n=>({...n,custody:'storing',stored_mb:1})),links:[],summary:{stored_mb:3}};
 const calls=[],network={networkSnapshot:()=>{state.readHook?.();return structuredClone(proof);},verifyNetworkSnapshot:()=>{state.verifyHook?.();return state.valid;},clearNetwork(){state.valid=false;}};
 const fabric={snapshot:()=>{state.fabricHook?.();return {...state,receipt:structuredClone(receipt),route:null};},route:async(...args)=>{calls.push(args);},refresh:async()=>{},send:async()=>{throw Error('shortcut must not send');}};
 const stamp=seconds=>new Date(Date.parse(proof.utc)+seconds*1000).toISOString();
 const contacts={accepted_context:{utc:proof.utc},node_definitions:proof.node_definitions,conditions:{end_utc:stamp(10800)},contact_reports:[{station_id:station.id,geometry:{minimum_elevation_deg:station.min_elevation_deg,coverage:{resolution_seconds:30},passes:Array.from({length:51},(_,i)=>({satellite:'A',start:stamp(i*60),end:stamp(i*60+1),duration_seconds:1,max_elevation_deg:45,in_progress:false,truncated:false}))}}]};
 const panel=createGroundNetworkPanel({store,model,network,fabric,diagram,contactWindows:{query:async()=>structuredClone(contacts),verify:()=>state.valid},document:f.doc,host:f.win,refreshRuntime:async()=>{}});panel.show('ground');
 const choose=async(field,id)=>{const el=f.get('ground-node-fabric-'+field);el.value=id;await el.dispatch('change');};
 const select=async id=>f.get('ground-node-diagram').dispatch('click',{target:{closest:()=>({getAttribute:key=>key==='data-diagram-node'?id:null})}});
 const click=async field=>{const button=f.doc.getElementById('ground-node-detail-route-'+field);assert.ok(button,'selected detail shortcut exists');await f.get('ground-node-diagram-detail').dispatch('click',{target:button});};
 return {f,store,state,proof,receipt,calls,network,panel,choose,select,click,station,dispose(){panel.destroy();f.dispose();}};
}

test('selected satellite endpoint uses existing route once and preserves other endpoint/editor/custody',async()=>{
 const s=setup();try{
  await s.choose('target',s.station.id);await s.select('A');
  s.store.select(s.station.id);await s.f.get('ground-node-edit').dispatch('click');s.f.get('ground-node-name').value='unsaved station';
  await s.f.get('ground-node-pass-query').dispatch('click');await s.f.get('ground-node-pass-next').dispatch('click');const contactPage=s.f.get('ground-node-pass-results').innerHTML;
  const custody=s.f.get('ground-node-fabric-custody').innerHTML;
  await s.click('source');assert.deepEqual(s.calls,[['A',s.station.id,'balanced']]);assert.equal(s.f.get('ground-node-fabric-disclosure').open,true);
  assert.equal(s.f.get('ground-node-fabric-target').value,s.station.id);assert.equal(s.f.get('ground-node-name').value,'unsaved station');assert.equal(s.f.get('ground-node-fabric-custody').innerHTML,custody);
  assert.equal(s.f.get('ground-node-pass-results').innerHTML,contactPage);
  await s.choose('source','B');await s.select('A');await s.click('target');assert.deepEqual(s.calls.at(-1),['B','A','balanced']);
  assert.equal(s.f.counts().commands,0);
 }finally{s.dispose();}
});

test('selected ground station exposes only destination and needs valid distinct endpoints',async()=>{
 const s=setup();try{await s.choose('source','B');await s.select(s.station.id);assert.equal(s.f.doc.getElementById('ground-node-detail-route-source'),null);await s.click('target');assert.deepEqual(s.calls,[['B',s.station.id,'balanced']]);await s.select('B');await s.click('target');assert.equal(s.calls.length,1);}finally{s.dispose();}
});

for(const kind of ['revoked','leave','dispose','pending','review','error','receipt-replaced','read-reentry','verify-reentry','fabric-reentry'])test('detail endpoint cannot command after '+kind,async()=>{
 const s=setup();try{
  await s.choose('target',s.station.id);await s.select('A');const button=s.f.doc.getElementById('ground-node-detail-route-source'),detail=s.f.get('ground-node-diagram-detail');assert.ok(button);
  if(kind==='revoked')s.state.valid=false;if(kind==='leave')s.panel.show('satellite');if(kind==='dispose')s.panel.destroy();if(kind==='pending')s.state.pending=true;if(kind==='review')s.state.refresh_required=true;
  if(kind==='error')s.state.error='unavailable';if(kind==='receipt-replaced')s.receipt.sequence++;
  if(kind==='read-reentry')s.state.readHook=()=>{s.state.readHook=null;s.panel.show('satellite');};
  if(kind==='verify-reentry')s.state.verifyHook=()=>{s.state.verifyHook=null;s.panel.update();};
  if(kind==='fabric-reentry')s.state.fabricHook=()=>{s.state.fabricHook=null;s.panel.update();};
  await detail.dispatch('click',{target:button});assert.deepEqual(s.calls,[]);
 }finally{s.dispose();}
});

test('old detail button from an earlier paint cannot operate fresh selection',async()=>{
 const s=setup();try{await s.choose('target',s.station.id);await s.select('A');const old=s.f.doc.getElementById('ground-node-detail-route-source');assert.ok(old);await s.select('B');await s.f.get('ground-node-diagram-detail').dispatch('click',{target:old});assert.deepEqual(s.calls,[]);await s.click('source');assert.deepEqual(s.calls,[['B',s.station.id,'balanced']]);}finally{s.dispose();}
});

test('sampled readonly detail never grants endpoint action',async()=>{
 const s=setup();try{
  const sampled=Object.freeze({...s.proof,presentation_kind:'NETWORK_SAMPLED_UI_V1',analysis_utc:s.proof.utc,display_utc:s.proof.utc,age_seconds:0,current_analysis:true,availability:'sampled'});
  s.state.valid=false;s.network.networkSampledPresentation=()=>sampled;s.network.verifySampledNetworkPresentation=v=>v===sampled;
  // Optional sampled ports are selected when the panel is constructed.
  s.panel.destroy();const p=createGroundNetworkPanel({store:s.store,model,network:s.network,fabric:{snapshot:()=>({status:'accepted',receipt:s.receipt,pending:false}),route:async()=>s.calls.push('route')},diagram,document:s.f.doc,host:s.f.win,refreshRuntime:async()=>{}});
  try{p.show('ground');await s.select('A');const button=s.f.doc.getElementById('ground-node-detail-route-source');assert.ok(button);assert.equal(button.disabled,true);await s.f.get('ground-node-diagram-detail').dispatch('click',{target:button});assert.deepEqual(s.calls,[]);}finally{p.destroy();}
 }finally{s.dispose();}
});
