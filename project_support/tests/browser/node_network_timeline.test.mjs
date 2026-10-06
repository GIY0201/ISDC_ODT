import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createNodeNetworkTimeline} from '../../../user_application/web/scripts/nodes/network_timeline.js';
import {createNodeOpticalTimeline} from '../../../user_application/web/scripts/nodes/optical_timeline.js';
import {createNodeLinkResolver} from '../../../user_application/web/scripts/nodes/links.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as stationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import {createGroundLinkModel} from '../../../digital_twin/simulation/browser/ground_links.js';
import {createNetworkSnapshotModel} from '../../../digital_twin/simulation/browser/network_snapshot.js';
import {NODE_COMMUNICATION_METADATA} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const fixture=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/original_node_link_resolution.json.gz',import.meta.url))));
const scenario=fixture.cases.find(c=>c.id==='dense-two-plane:0'),codec=createUtcCodec(LEAP_SHA256);
function setup(action,observer){
 let nodes=structuredClone(scenario.rows[0].input.nodes),utc=codec.advance(new Date(fixture.epoch).toISOString(),0),stations=[stationModel.createStation({preset:'daejeon'})],faults=[];
 const calls=[],events=[],library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>{throw Error('no equipment creation');}});
 const request=async(stamp,options)=>{
  calls.push({utc:stamp,signal:options.signal});
  const source=new Map(scenario.rows.find(r=>r.input.date===Date.parse(stamp))?.input.states??scenario.rows.at(-1).input.states);
  const value={utc:stamp,node_definitions:structuredClone(nodes),states:nodes.map(node=>[node.id,{...NODE_COMMUNICATION_METADATA,...structuredClone(source.get(node.id)??source.get(scenario.rows[0].input.nodes.find(n=>n.catalog_number===node.catalog_number)?.id)),node_id:node.id,node_definition:structuredClone(node),definition_hash:'a'.repeat(64),utc:stamp,interpolated:false}])};
  return action?action(value,options,calls):value;
 };
 const optical=createNodeOpticalTimeline({resolver:createNodeLinkResolver({library,oisl}),requestCommunicationStates:request,readNodes:()=>nodes,readDisplay:()=>({utc}),advanceUtc:codec.advance});
 const model=createNetworkSnapshotModel({library,groundLinks:createGroundLinkModel({library,stationModel}),oisl});
 const network=createNodeNetworkTimeline({model,optical,requestCommunicationStates:request,readNodes:()=>nodes,readDisplay:()=>({utc}),readStations:()=>stations,readFaults:()=>faults,validateNode:library.validateNode,validateStation:stationModel.validateStation,advanceUtc:codec.advance,onChange:value=>{events.push(value);observer?.(value);}});
 return {network,optical,calls,events,model,get nodes(){return structuredClone(nodes);},set nodes(v){nodes=structuredClone(v);},get utc(){return utc;},set utc(v){utc=v;},get stations(){return structuredClone(stations);},set stations(v){stations=structuredClone(v);},get faults(){return structuredClone(faults);},set faults(v){faults=structuredClone(v);}};
}
test('actual optical producer and source model join exact native input copies without another history',async()=>{
 const s=setup();assert.equal(s.calls.length,0);assert.equal(s.network.snapshot().status,'unavailable');
 const value=await s.network.update();assert.equal(value.status,'valid');assert.equal(s.network.verifySnapshot(value),true);
 assert.equal(value.network.nodes.length,s.nodes.length+s.stations.length);
 assert.equal(value.network.links.filter(l=>l.kind==='ground').length,s.nodes.length*s.stations.length);
 assert.deepEqual(s.calls.map(c=>Date.parse(c.utc)),[-120,-60,0,0].map(v=>fixture.epoch+v*1000));
 const history=s.optical.historyEntries();await s.network.update();assert.equal(s.calls.length,4);assert.deepEqual(s.optical.historyEntries(),history);
 value.network.links[0].state='foreign';assert.equal(s.network.verifySnapshot(value),false);assert.equal(s.network.snapshot().status,'valid');
 s.optical.resetHistories();assert.equal(s.network.snapshot().status,'unavailable');s.network.destroy();s.optical.destroy();
});
test('all current context edits invalidate the accepted envelope, including station and fault edits',async()=>{
 for(const edit of [s=>{s.utc=codec.advance(s.utc,1);},s=>{const n=s.nodes;n[0].name+=' edited';s.nodes=n;},s=>{const v=s.stations;v[0].dish_m=11;s.stations=v;},s=>{s.faults=[{kind:'link_loss',target:s.nodes[0].id,active:true}];}]){
  const s=setup(),value=await s.network.update();edit(s);assert.equal(s.network.verifySnapshot(value),false);assert.notEqual(s.network.snapshot().status,'valid');s.network.destroy();s.optical.destroy();
 }
});
for(const [name,mutate]of Object.entries({missing:v=>v.states.pop(),duplicate:v=>v.states.push(v.states[0]),hash:v=>v.states[0][1].definition_hash='b'.repeat(64),utc:v=>v.states[0][1].utc=codec.advance(v.utc,1),frame:v=>v.states[0][1].frame='ITRF',axes:v=>v.states[0][1].basis.x=[0,0,0],geodetic:v=>v.states[0][1].geodetic.latitude=91}))test(`entire network fails closed on current native ${name}`,async()=>{
 const s=setup((value,o,calls)=>{if(calls.length===4)mutate(value);return value;});
 const result=await s.network.update();assert.equal(result.status,'error');assert.equal(result.network,null);assert.equal(s.network.verifySnapshot(result),false);s.network.destroy();s.optical.destroy();
});
test('pending work deduplicates and a station edit fences an ignored abort response',async()=>{
 let release;const s=setup(async(value,o,calls)=>{if(calls.length===4)await new Promise(resolve=>release=resolve);return value;});
 const p=s.network.update(),again=s.network.update();assert.equal(p,again);
 for(let i=0;i<100&&!release;i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(release);
 const sites=s.stations;sites[0].min_elevation_deg=20;s.stations=sites;assert.equal(s.network.snapshot().status,'unavailable');release();assert.equal(await p,null);assert.equal(s.network.snapshot().network,null);s.network.destroy();s.optical.destroy();
});
test('clear/dispose revokes proof while retaining the shared optical owner and histories',async()=>{
 const s=setup(),value=await s.network.update(),history=s.optical.historyEntries();s.network.clear();assert.equal(s.network.verifySnapshot(value),false);assert.deepEqual(s.optical.historyEntries(),history);
 await s.network.update();s.network.destroy();assert.equal(s.network.snapshot().status,'unavailable');assert.equal(await s.network.update(),null);assert.equal(s.optical.snapshot().status,'valid');s.optical.destroy();
});
test('invalid roster/height/UTC fails before any native request instead of source defaults',async()=>{
 for(const edit of [s=>s.stations=[{...s.stations[0],id:s.nodes[0].id}],s=>s.stations=[{...s.stations[0],dish_m:0}],s=>s.nodes=[...s.nodes,s.nodes[0]],s=>s.utc='2026-09-08',s=>s.stations=[{...s.stations[0],altitude_km:NaN}]]){
  const s=setup();edit(s);assert.equal((await s.network.update()).status,'error');assert.equal(s.calls.length,0);s.network.destroy();s.optical.destroy();
 }
});
test('empty satellite scope retains ground mesh with no native request and preserves ID dictionary keys',async()=>{
 const empty=setup();empty.nodes=[];empty.stations=stationModel.DEFAULT_STATION_KEYS.map(preset=>stationModel.createStation({preset}));
 const ground=await empty.network.update();assert.equal(ground.status,'valid');assert.equal(ground.network.nodes.length,3);assert.equal(ground.network.links.length,3);assert.equal(empty.calls.length,0);empty.network.destroy();empty.optical.destroy();
 const s=setup(),nodes=s.nodes;nodes[0].id='__proto__';s.nodes=nodes;const result=await s.network.update();assert.equal(result.status,'valid');
 assert.equal(Object.hasOwn(result.definition_hashes,'__proto__'),true);assert.equal(result.definition_hashes.__proto__,'a'.repeat(64));assert.equal(s.network.verifySnapshot(result),true);s.network.destroy();s.optical.destroy();
});
test('scope limits and unsupported leap analysis fail before geometry or partial network publication',async()=>{
 for(const edit of [s=>s.nodes=Array.from({length:241},()=>s.nodes[0]),s=>s.stations=Array.from({length:25},()=>s.stations[0]),s=>s.utc='2016-12-31T23:59:60.000Z']){
  const s=setup();edit(s);assert.equal((await s.network.update()).status,'error');assert.equal(s.calls.length,0);s.network.destroy();s.optical.destroy();
 }
});
test('raw station null or numeric text cannot pass source coercion and masquerade as complete geometry',async()=>{
 for(const [field,value]of [['latitude',null],['longitude','127.3567'],['altitude_km',null],['dish_m','13'],['min_elevation_deg',null],['name',{text:'station'}]]){
  const s=setup(),sites=s.stations;sites[0][field]=value;s.stations=sites;
  assert.equal((await s.network.update()).status,'error',field);assert.equal(s.calls.length,0);s.network.destroy();s.optical.destroy();
 }
});
test('dispose fences a pending native reply and observer exceptions cannot mutate accepted results',async()=>{
 let release;const pending=setup(async(v,o,calls)=>{if(calls.length===4)await new Promise(resolve=>release=resolve);return v;});const task=pending.network.update();
 for(let i=0;i<100&&!release;i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(release);pending.network.destroy();assert.equal(pending.calls.at(-1).signal.aborted,true);release();assert.equal(await task,null);assert.equal(pending.network.snapshot().network,null);pending.optical.destroy();
 const s=setup(null,value=>{value.network=null;throw Error('observer failed');}),result=await s.network.update();assert.equal(result.status,'valid');assert.ok(result.network);assert.equal(s.network.verifySnapshot(result),true);assert.equal(s.network.observerError,'observer failed');s.network.destroy();s.optical.destroy();
});
