import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as stationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
import {createGroundLinkModel} from '../../../digital_twin/simulation/browser/ground_links.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import {NODE_COMMUNICATION_METADATA} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createMissionWindowRecords} from '../../../user_application/web/scripts/missions/window_records.js';
const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=> 'EQ-1'});
const model=createMissionWindowRecords({groundLinkModel:createGroundLinkModel({library,stationModel}),missionTypes:createMissionTypes(library)});
const hash='a'.repeat(64),start='2026-10-04T22:01:12.000Z',end='2026-10-04T22:11:12.000Z';
const node={id:'N-1',orbit:{altitude_km:550},equipment:[{id:'RF-S',catalog:'s_band_ttc',enabled:true}]};
const station={id:'GS-1',latitude:36.35,longitude:127.38,altitude_km:0.07,min_elevation_deg:10,bands:['S','X','Ka']};
function report(){return {...NODE_COMMUNICATION_METADATA,schema_version:1,status:'sampled',definition_hashes:{'N-1':hash},site:{latitude_deg:36.35,longitude_deg:127.38,ellipsoid_height_m:70},minimum_elevation_deg:10,coverage:{start_utc:start,end_utc:end,resolution_seconds:30,peak_bracket_seconds:0.1,boundary_bracket_seconds:1,short_intervals_may_be_missed:true},passes:[{id:'pass|N-1|'+start,satellite:'N-1',start,end,peak:'2026-10-04T22:06:12.000000000Z',max_elevation_deg:23.46,in_progress:true,truncated:true,duration_seconds:600}]};}
test('native contact records use original active radio selection and source record shape',()=>{
 const source=report();const before=structuredClone(source);
 const records=model.contacts({node,station,geometry:source,definitionHash:hash});
 assert.equal(records.length,1);assert.deepEqual(records[0],{id:`GS-1|N-1|${start}`,satellite:'N-1',station:'GS-1',band:'S',rate_mbps:2,uplink_mbps:0.5,start,end,peak:'2026-10-04T22:06:12.000Z',max_elevation:23.5,in_progress:true});
 assert.deepEqual(source,before);
});
test('no active common source band produces no RF contact',()=>{
 assert.deepEqual(model.contacts({node,station:{...station,bands:['Ka']},geometry:report(),definitionHash:hash}),[]);
 assert.deepEqual(model.contacts({node:{...node,equipment:[]},station,geometry:report(),definitionHash:hash}),[]);
});
test('source Ka priority and representative uplink rates are reused',()=>{
 const upgraded={...node,equipment:[...node.equipment,{id:'RF-K',catalog:'ka_user_link',enabled:true}]};
 const records=model.contacts({node:upgraded,station,geometry:report(),definitionHash:hash});
 assert.equal(records[0].band,'Ka');assert.equal(records[0].uplink_mbps,100);
});
test('different native context and invalid row never become empty source windows',()=>{
 for(const mutate of [r=>r.frame='ITRF',r=>r.definition_hashes['N-1']='b'.repeat(64),r=>r.site.ellipsoid_height_m=0,r=>r.minimum_elevation_deg=5,r=>r.status='error',r=>r.passes[0].satellite='OTHER',r=>r.passes[0].end='2026-10-05T22:11:12Z',r=>r.passes[0].max_elevation_deg=NaN,r=>r.passes[0].in_progress=1]){
  const r=report();mutate(r);assert.throws(()=>model.contacts({node,station,geometry:r,definitionHash:hash}));
 }
});
test('access maps source fields and rejects a changed camera cone',()=>{
 const r=report();const mask=Math.acos((6378.137+550)/6378.137*Math.sin(Math.PI/4))*180/Math.PI;
 r.off_nadir_degrees=45;r.minimum_elevation_deg=null;r.passes[0].minimum_elevation_deg=mask;r.passes[0].max_elevation_deg=75;
 const target={latitude:station.latitude,longitude:station.longitude,altitude_km:0.07};
 const args={node,target,offNadirDegrees:45,geometry:r,definitionHash:hash};
 assert.deepEqual(model.access(args),[{id:`access|N-1|${start}`,satellite:'N-1',start,end,peak:'2026-10-04T22:06:12.000Z',max_elevation:75,min_elevation:Math.round(mask*10)/10}]);
 assert.throws(()=>model.access({...args,offNadirDegrees:30}));
});

const golden=JSON.parse(await readFile(new URL('../fixtures/original_mission_window_records.json',import.meta.url),'utf8'));
test('installed native 12h records match captured unchanged source contact/access functions',()=>{
 assert.equal(golden.source_commit,NODE_COMMUNICATION_METADATA.source_commit);
 const args={node:golden.node,definitionHash:golden.geometry.definition_hashes[golden.node.id]};
 for(const [actual,expected] of [[model.contacts({...args,station:golden.station,geometry:golden.geometry}),golden.expected_contacts],[model.access({...args,target:golden.station,geometry:golden.access_geometry,offNadirDegrees:45}),golden.expected_access]]){
  assert.equal(actual.length,expected.length);
  actual.forEach((record,index)=>{for(const key of Object.keys(expected[index])){
   if(['start','end','peak'].includes(key))assert.ok(Math.abs(Date.parse(record[key])-Date.parse(expected[index][key]))<=1000);
   else assert.deepEqual(record[key],expected[index][key]);
  }});
 }
});
test('projection retains more than original eight contacts without an implicit cap',()=>{
 const r=report();r.passes=Array.from({length:9},(_,index)=>({...r.passes[0],id:'pass-'+index,start:new Date(Date.parse(start)+index*60000).toISOString(),end:new Date(Date.parse(start)+index*60000+20000).toISOString(),peak:new Date(Date.parse(start)+index*60000+10000).toISOString(),in_progress:index===0,truncated:false}));
 assert.equal(model.contacts({node,station,geometry:r,definitionHash:hash}).length,9);
});
test('malformed source equipment rate rejects instead of producing a plausible zero',()=>{
 const bad={...node,equipment:[{...node.equipment[0],data_rate_mbps:NaN}]};
 assert.throws(()=>model.contacts({node:bad,station,geometry:report(),definitionHash:hash}));
});
