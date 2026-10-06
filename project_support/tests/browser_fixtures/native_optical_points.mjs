// Actual clean-venv Rust bytes have passed through the production adapter/query before this IPC.
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createNodeDisplayTimeline,createNodeSampleBuffer} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {SatelliteModelLayer} from '../../../digital_twin/visualization/satellite_model.js';
import {createNodeOpticalTimeline} from '../../../user_application/web/scripts/nodes/optical_timeline.js';
import {createNodeLinkResolver,linkSummary} from '../../../user_application/web/scripts/nodes/links.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const wire=JSON.parse(await readFile(process.argv[2],'utf8'));
const original=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/original_node_link_resolution.json.gz',import.meta.url))));
const steps=original.cases.find(c=>c.id==='dense-two-plane:0').rows;
let calls=0,maxNumericError=0,maxTimeErrorMs=0;
const timeline=createNodeDisplayTimeline({api:{nodeSamples:async payload=>{
  const row=wire[calls++];assert.ok(row);assert.deepEqual({...payload,request_id:row.request.request_id},row.request);
  return {...structuredClone(row.response),request_id:payload.request_id};
},nodeTrack:()=>{throw Error('communication points cannot query display tracks');}},periodFor:()=>95,requestId:()=> 'native-optical',yieldControl:async()=>{}});
const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>{throw Error('no equipment creation');}});
const resolver=createNodeLinkResolver({library,oisl});
function compare(actual,expected,path='result'){
 if(typeof expected==='number'){
  assert.equal(typeof actual,'number');assert.ok(Number.isFinite(actual));
  // Azimuth is periodic: -180 and +180 describe the same source pointing direction.
  const delta=path.endsWith('.azimuth')?Math.abs(((actual-expected+180)%360+360)%360-180):Math.abs(actual-expected),time=Math.abs(expected)>1e12;
  if(time)maxTimeErrorMs=Math.max(maxTimeErrorMs,delta);else maxNumericError=Math.max(maxNumericError,delta);
  assert.ok(delta<=(time?1e-3:1e-6),`${path}: native/source difference ${delta} (${actual}, ${expected})`);return;
 }
 if(expected&&typeof expected==='object'){
  assert.equal(Array.isArray(actual),Array.isArray(expected));assert.deepEqual(Object.keys(actual),Object.keys(expected));
  for(const key of Object.keys(expected))compare(actual[key],expected[key],`${path}.${key}`);return;
 }
 assert.deepEqual(actual,expected);
}
const nodes=wire[0].request.nodes,utc=wire.at(-1).request.start_utc;timeline.setDefinitions(nodes);
const optical=createNodeOpticalTimeline({resolver,requestCommunicationStates:timeline.requestCommunicationStates,readNodes:()=>nodes,readDisplay:()=>({utc}),advanceUtc:createUtcCodec(LEAP_SHA256).advance});
const value=await optical.update();assert.equal(value.status,'valid');
compare({terminals:value.terminals,pairs:value.pairs,histories:optical.historyEntries(),summary:linkSummary(value.pairs)},steps.at(-1).expected);
assert.equal(optical.verifyLinkSnapshot(value,{nodes,utc}),true);
const altered=structuredClone(value);altered.pairs[0].state='idle';assert.equal(optical.verifyLinkSnapshot(altered,{nodes,utc}),false);
assert.equal(calls,3);assert.equal(timeline.snapshot().utc,null);optical.destroy();timeline.destroy();
let selectedNodePoses=0;
const poseLayer=new SatelliteModelLayer({advanceUtc:createUtcCodec(LEAP_SHA256).advance});
for(const receipt of wire){
 const buffer=createNodeSampleBuffer(receipt.request,receipt.response),at=receipt.request.start_utc;
 for(const node of receipt.request.nodes){
  await poseLayer.show({pose_source:{kind:'source_node',node_definition:node,definition_hash:buffer.definitionHashes()[node.id]}},time=>buffer.geometryFor(node,{utc:time}),at);
  const pose=poseLayer.nativeAt(at),sample=buffer.geometryFor(node,{utc:at});assert.ok(pose);
  assert.equal(pose.node_id,node.id);assert.equal(pose.frame,'EARTH_FIXED_GMST_UTC_APPROX');assert.equal(pose.quality,'engineering_assumption');assert.deepEqual(pose.position_m,sample.row.position_m);
  pose.position_m[0]=0;assert.deepEqual(poseLayer.nativeAt(at).position_m,sample.row.position_m);selectedNodePoses++;
 }
}
poseLayer.dispose();assert.equal(selectedNodePoses,60);
process.stdout.write(JSON.stringify({native_rows:60,prime_steps_seconds:[-120,-60,0],maxNumericError,maxTimeErrorMs,source_semantics_equal:true,verified_snapshot:true,selected_node_poses:selectedNodePoses})+'\n');
