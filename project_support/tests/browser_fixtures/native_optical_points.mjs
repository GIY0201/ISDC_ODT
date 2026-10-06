// Actual clean-venv Rust bytes have passed through the production adapter/query before this IPC.
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {createNodeDisplayTimeline} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createNodeLinkResolver,linkSummary} from '../../../user_application/web/scripts/nodes/links.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
const wire=JSON.parse(await readFile(process.argv[2],'utf8'));
const original=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/original_node_link_resolution.json.gz',import.meta.url))));
const steps=original.cases.find(c=>c.id==='dense-two-plane:0').rows;
let calls=0,maxNumericError=0,maxTimeErrorMs=0;
const timeline=createNodeDisplayTimeline({api:{nodeSamples:async payload=>{
  const row=wire[calls++];assert.ok(row);assert.deepEqual({...payload,request_id:row.request.request_id},row.request);
  return {...structuredClone(row.response),request_id:payload.request_id};
},nodeTrack:()=>{throw Error('communication points cannot query display tracks');}},periodFor:()=>95,requestId:()=> 'native-optical',yieldControl:async()=>{}});
const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>{throw Error('no equipment creation');}});
const {resolveLinks}=createNodeLinkResolver({library,oisl});
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
timeline.setDefinitions(wire[0].request.nodes);let histories=new Map();
for(let i=0;i<wire.length;i++){
 const value=await timeline.requestCommunicationStates(wire[i].request.start_utc);
 const result=resolveLinks(value.node_definitions,new Map(value.states),histories,steps[i].input.date);histories=result.histories;
 compare({terminals:result.terminals,pairs:result.pairs,histories:[...histories],summary:linkSummary(result.pairs)},steps[i].expected);
}
assert.equal(calls,3);assert.equal(timeline.snapshot().utc,null);timeline.destroy();
process.stdout.write(JSON.stringify({native_rows:60,prime_steps_seconds:[-120,-60,0],maxNumericError,maxTimeErrorMs,source_semantics_equal:true})+'\n');
