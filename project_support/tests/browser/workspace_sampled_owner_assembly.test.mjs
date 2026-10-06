import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {orbitElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import {NODE_COMMUNICATION_METADATA as metadata} from '../../../user_application/web/scripts/nodes/node_timeline.js';
// Real application owners and wiring; HTTP/Cesium/DOM remain controlled test
// adapters. These checks are not live native physics or GPU FPS acceptance.
const codec=createUtcCodec(LEAP_SHA256),utc=codec.advance('2026-10-07T00:00:00Z',0),H='a'.repeat(64),quality={ut1:'final_b',polar_motion:'final_b'};
const base={group:'active',catalog_number:25544,name:'ISS',utc,epoch_utc:utc,source:'celestrak-cache',normalized_gp_sha256:H,eop_sha256:H,leap_sha256:LEAP_SHA256,frame:'ITRF',profile:'WGS72_AFSPC',eop_kind:'IERS_A',eop_quality:quality,position_m:[7000000,0,0]};
const row=stamp=>({utc:stamp,status:'valid',error_code:null,position_m:[7000000,2,3],inertial_position_km:[7000,0,0],lvlh_basis:{x:[1,0,0],y:[0,1,0],z:[0,0,1]},inertial_velocity_km_s:[0,7.5,0],raan_deg:0,argp_deg:0,mean_anomaly_deg:0,sunlit:true,longitude_deg:0,latitude_deg:0,height_km:550});
const settle=async (f,timers)=>{for(let i=0;i<80;i++){for(const [id,job]of [...timers])if(job.ms===0){timers.delete(id);job.fn();}await new Promise(resolve=>setImmediate(resolve));f.flush();}};
for(const [width,height]of [[1280,720],[1920,1080]])test(`actual catalog owner and mounted sampled consumer share one UTC and Viewer ${width}x${height}`,async()=>{
 let now=0,next=0;const raf=new Map(),timers=new Map(),requests=[];
 const f=fixture(width,height,{hash:'#satellite',planningBootstrap:async()=>({runtime:{mode:'SIM',running:false,speed:1,elapsed_seconds:0,sequence:0,run_id:'fixture',scenario_id:'fixture',active_faults:[]},scenarios:[{id:'fixture',name:'fixture'}],events:[],missions:[]}),catalogNow:()=>now,catalogRequestFrame:fn=>{const id=++next;raf.set(id,fn);return id;},catalogCancelFrame:id=>raf.delete(id),setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  catalogSamples:async p=>({...base,...p,version:1,status:'valid',communication_status:'unknown',units:{position:'m',range:'m',elevation:'deg',azimuth:'deg',time:'UTC'},rows:Array.from({length:p.count},(_,i)=>({...row(codec.advance(p.start_utc,i)),position_m:[7000000+i,0,0],elevation_deg:10,range_m:1000,azimuth_deg:0,visible:true,eop_quality:quality}))}),
  nodeSamples:async p=>{requests.push(structuredClone(p));return{schema_version:1,...metadata,request_id:p.request_id,status:'valid',nodes:p.nodes.map(node=>({node_id:node.id,definition_hash:H,rows:Array.from({length:p.count},(_,i)=>row(codec.advance(p.start_utc,i)))}))};},
  nodeTrack:async p=>({schema_version:1,...metadata,request_id:p.request_id,status:'valid',nodes:p.nodes.map(node=>({node_id:node.id,definition_hash:H,period_minutes:Math.round(orbitElements(node.orbit).period/60*1000)/1000,path_visible:true,rows:Array.from({length:121},(_,i)=>row(codec.advance(new Date(Math.trunc(Date.parse(p.center_utc)+(i-60)*(Math.round(orbitElements(node.orbit).period/60*1000)/1000)*60000/120)).toISOString(),0)))}))})});
 try{
  await settle(f,timers);
  f.evaluate(`{const store=nodeWorkspace.scenarioPorts().store;const first=store.add({name:'Complete native cohort',bus:'flat_panel'});store.addMany(Array.from({length:239},(_,i)=>({...first,id:'ASSEMBLY-'+i,catalog_number:900002+i,name:'Native node '+i,equipment:first.equipment.map(item=>({...item,id:item.id+'-'+i}))})));store.select(first.id);}`);
  await settle(f,timers);
  f.evaluate(`catalogTimeline.select(${JSON.stringify(base)});catalogTimeline.observer({latitude_deg:0,longitude_deg:0,ellipsoid_height_m:0,virtual:true,ellipsoid:'WGS84'},5)`);
  await f.evaluate('catalogTimeline.calculate()');f.evaluate('catalogTimeline.play()');await settle(f,timers);
  assert.equal(raf.size,1,'fixture must retain the actual owner RAF callback');
  for(let i=0;i<20&&f.evaluate('nodeWorkspace.snapshot().timeline.pending');i++)await settle(f,timers);assert.equal(f.evaluate('nodeWorkspace.snapshot().timeline.pending'),false,'all full240 native preparation chunks must finish');
  const lease=f.evaluate('globe.captureDisplayContinuity()');assert.ok(lease);assert.equal(f.evaluate('globe.verifyDisplayContinuity(globe.captureDisplayContinuity())'),true);
  await f.evaluate('simPanel.controller.load()');f.evaluate("showWorkspaceOrbit('ground')");await settle(f,timers);
  const ground=f.evaluate('nodeWorkspace.networkSampledPresentation()');assert.equal(ground.status,'valid');assert.equal(ground.node_definitions.length,240);assert.equal(f.evaluate('nodeWorkspace.verifySampledNetworkPresentation(nodeWorkspace.networkSampledPresentation(),{utc:globe.displayContext().utc})'),true);assert.equal(f.evaluate('nodeWorkspace.verifyNetworkSnapshot(nodeWorkspace.networkSampledPresentation())'),false);
  const before=f.evaluate('globe.displayContext().utc');now=250;const [id,tick]=raf.entries().next().value;raf.delete(id);tick();await settle(f,timers);
  assert.equal(f.evaluate('globe.displayContext().utc'),codec.advance(before,.25));assert.equal(f.evaluate('catalogTimeline.snapshot().playing'),true);assert.equal(f.viewers.length,1);
  const historical=f.evaluate('nodeWorkspace.networkSampledPresentation()');assert.equal(historical.analysis_utc,before,JSON.stringify(historical));assert.equal(historical.age_seconds,.25);assert.equal(f.evaluate('nodeWorkspace.verifySampledNetworkPresentation(nodeWorkspace.networkSampledPresentation(),{utc:globe.displayContext().utc})'),true);
  const note=f.get('node-fleet-analysis');assert.match(note.textContent,/OISL 분석 시각/);assert.match(note.textContent,new RegExp(before.replaceAll('.','\\.')));assert.match(note.textContent,/0\.250 s/);
  assert.equal(f.evaluate('nodeWorkspace.sceneSnapshot().drafts.length'),240);assert.equal([...f.get('node-fleet').innerHTML.matchAll(/data-node-id=/g)].length,240);
  const prior=requests.filter(p=>p.count===1).length;for(const ms of [500,750]){now=ms;const [id,fn]=raf.entries().next().value;raf.delete(id);fn();await settle(f,timers);assert.match(note.textContent,new RegExp('OISL 분석 시각 '+before.replaceAll('.','\\.')));}assert.equal(requests.filter(p=>p.count===1).length,prior,'natural owner RAF must not issue analytical HTTP per frame');
  now=1000;{const [id,fn]=raf.entries().next().value;raf.delete(id);fn();}await settle(f,timers);
  const analysisTimer=[...timers].find(([,job])=>job.ms===1000);assert.ok(analysisTimer);timers.delete(analysisTimer[0]);analysisTimer[1].fn();await settle(f,timers);
  const current=f.evaluate('globe.displayContext().utc');assert.match(note.textContent,new RegExp(current.replaceAll('.','\\.')));assert.match(note.textContent,/0\.000 s/);assert.equal(f.evaluate('nodeWorkspace.sceneSnapshot().drafts.length'),240);
  assert.equal(f.evaluate('nodeWorkspace.networkSampledPresentation().analysis_utc'),current);
  assert.equal(f.evaluate('globe.verifyDisplayContinuity(globe.captureDisplayContinuity())'),true);f.context.retainedLease=lease;
  f.context.retainedReceipt=await f.evaluate('nodeWorkspace.updateMissionLinks()');assert.equal(f.evaluate('nodeWorkspace.verifyMissionLinks(retainedReceipt,{nodes:nodeWorkspace.sceneSnapshot().drafts,utc:globe.displayContext().utc})'),true,'actual exact action verifies at its captured current UTC');
  const sameUtc=current;f.evaluate('catalogTimeline.pause()');assert.equal(f.evaluate('globe.displayContext().utc'),sameUtc);assert.equal(f.evaluate('globe.verifyDisplayContinuity(retainedLease)'),false);assert.equal(f.evaluate('globe.captureDisplayContinuity()'),null);
  assert.equal(f.evaluate('nodeWorkspace.verifyMissionLinks(retainedReceipt,{nodes:nodeWorkspace.sceneSnapshot().drafts,utc:globe.displayContext().utc})'),false,'sameUTC pause revokes the actual sample-origin exact action receipt without promotion');
  assert.doesNotMatch(note.textContent,/OISL 분석 시각/,'pause revokes sampled presentation synchronously before fresh exact settlement');
  assert.equal(f.evaluate('nodeWorkspace.verifyMissionLinks({presentation_kind:"OPTICAL_SAMPLED_UI_V1",status:"valid"})'),false,'sampled UI metadata is never an action receipt');
  await f.win.dispatch('pagehide',{persisted:false});assert.equal(raf.size,0);assert.equal([...timers.values()].filter(job=>job.ms===1000).length,0);assert.equal(f.viewers[0].destroyCount,1);
  assert.equal(f.evaluate('globe.verifyDisplayContinuity(retainedLease)'),false);assert.equal(f.evaluate('nodeWorkspace.sceneSnapshot()'),null);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
