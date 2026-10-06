import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGroundLinkModel} from '../../../digital_twin/simulation/browser/ground_links.js';
import {createNetworkSnapshotModel} from '../../../digital_twin/simulation/browser/network_snapshot.js';
import {lookAnglesAt} from '../../../digital_twin/simulation/browser/ground_look_angles.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import * as stationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
const fixture=JSON.parse(await readFile(new URL('../fixtures/original_network_snapshot.json',import.meta.url),'utf8'));
const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>{throw Error('calculation cannot create equipment');}});
const groundLinks=createGroundLinkModel({library,stationModel});
const network=createNetworkSnapshotModel({library,groundLinks,oisl});
const originalGeometry=(position,station)=>lookAnglesAt(position,{latitude:station.latitude,longitude:station.longitude});
const originalCompatible=createNetworkSnapshotModel({library,groundLinks:createGroundLinkModel({library,stationModel,lookAnglesAt:originalGeometry}),oisl});
test('structural reuse reproduces every unchanged original network result before the explicit height adapter correction',()=>{
 for(const c of fixture.cases)assert.deepEqual(originalCompatible.buildNetworkSnapshot({...c.input,states:new Map(c.input.states)}),c.original);
});
for(const c of fixture.cases)test(`source network snapshot and separate height correction: ${c.id}`,()=>{
 const input=structuredClone(c.input),before=structuredClone(input);
 const actual=network.buildNetworkSnapshot({...input,states:new Map(input.states)});
 assert.deepEqual(actual,c.height_corrected);
 assert.deepEqual(actual.nodes,c.original.nodes,'height correction does not change node/payload/DTN/fault records');
 assert.deepEqual(actual.links.filter(l=>l.kind!=='ground'),c.original.links.filter(l=>l.kind!=='ground'));
 assert.deepEqual(input,before,'all caller inputs remain unchanged');
 actual.nodes.push({id:'foreign'});assert.deepEqual(network.buildNetworkSnapshot({...input,states:new Map(input.states)}),c.height_corrected);
});
test('extracted original WGS84 ENU function matches independently captured geometry',()=>{
 for(const c of fixture.geometry)assert.deepEqual(lookAnglesAt(c.position,c.station),c.expected);
 assert.equal(lookAnglesAt({latitude:0,longitude:0,altitude:0},{latitude:0,longitude:0,altitudeKm:0}),null);
 for(const position of [null,{latitude:91,longitude:0,altitude:550},{latitude:0,longitude:0,altitude:NaN}])assert.equal(lookAnglesAt(position,{latitude:0,longitude:0}),null);
});
test('groundLink uses the validated station ellipsoidal height rather than silent sea level',()=>{
 const c=fixture.cases.find(c=>c.id==='nominal'),station=c.input.stations[0],node=c.input.nodes[0],position=c.input.states[0][1].geodetic;
 const link=groundLinks.groundLink(station,node,position);
 assert.equal(link.range_km,549.9);assert.equal(c.original.links.find(l=>l.id===link.id).range_km,550);
 assert.equal(groundLinks.groundLink({...station,altitude_km:NaN},node,position),null);
 assert.equal(groundLinks.groundLink(station,node,null),null);
 assert.deepEqual(groundLinks.terrestrialLinks([]),[]);
});
test('missing geometry is unavailable and model construction requires the real dependency ports',()=>{
 const c=fixture.cases.find(c=>c.id==='nominal'),args={...c.input,states:new Map()};
 const result=network.buildNetworkSnapshot(args);
 assert.equal(result.links.filter(l=>l.kind==='ground').length,0);
 assert.deepEqual(result.links.filter(l=>l.kind==='oisl'),c.height_corrected.links.filter(l=>l.kind==='oisl'));
 assert.throws(()=>createGroundLinkModel(),TypeError);
 assert.throws(()=>createNetworkSnapshotModel({library,groundLinks}),TypeError);
});
test('station model is injected instead of a filesystem-only cross-layer browser import',()=>{
 const c=fixture.cases[0],site=c.input.stations[0],node=c.input.nodes[0],position=c.input.states[0][1].geodetic;
 const injected=createGroundLinkModel({library,stationModel:{...stationModel,figureOfMeritDbK:()=>777}});
 assert.equal(injected.groundLink(site,node,position).gt_dbk,777);
 assert.throws(()=>createGroundLinkModel({library}),TypeError);
});
