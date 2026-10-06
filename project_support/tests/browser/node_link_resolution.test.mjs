import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createNodeLinkResolver,terminalKey,pairKey,planeOf,preferredCandidates,linkSummary} from '../../../user_application/web/scripts/nodes/links.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
const fixture=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/original_node_link_resolution.json.gz',import.meta.url))));
const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>{throw Error('resolution cannot create equipment');}});
const {resolveLinks}=createNodeLinkResolver({library,oisl});
const json=value=>JSON.parse(JSON.stringify(value));

for(const scenario of fixture.cases)test(`original resolver full trace: ${scenario.id}`,()=>{
  let carried=new Map();
  for(const row of scenario.rows){
    const {nodes,states,date,histories}=structuredClone(row.input),before=structuredClone(row.input);
    assert.deepEqual(json([...carried]),histories,'product history continues across original trace');
    const result=resolveLinks(nodes,new Map(states),carried,date);
    assert.deepEqual(json({terminals:result.terminals,pairs:result.pairs,histories:[...result.histories],summary:linkSummary(result.pairs)}),row.expected);
    assert.deepEqual({nodes,states,date,histories},before,'caller inputs/history unchanged');
    assert.deepEqual(json([...carried]),histories,'previous history remains unchanged');
    carried=result.histories;
  }
});

test('original same-plane acquisition, target continuity and reverse seek states remain explicit',()=>{
  const rows=fixture.cases.find(c=>c.id==='same-plane-acquire-retarget-rewind').rows;
  const outputs=rows.map(row=>resolveLinks(row.input.nodes,new Map(row.input.states),new Map(row.input.histories),row.input.date));
  assert.equal(outputs[0].pairs[0].state,'slewing');
  assert.equal(outputs[3].pairs[0].state,'locked');
  const fore=result=>result.terminals.find(t=>t.nodeId===rows[0].input.nodes[0].id&&t.role==='fore');
  assert.equal(fore(outputs[4]).targetId,fore(outputs[3]).targetId,'closer newcomer does not replace feasible previous target');
  assert.notEqual(outputs[5].pairs[0].state,'locked','reverse seek restarts source acquisition');
});

test('original helpers keep mounting-plane filters, canonical keys and source counts',()=>{
  const candidates=[{id:'a',plane:'F:0'},{id:'b',plane:'F:1'},{id:'c',plane:null}];
  assert.deepEqual(preferredCandidates(candidates,'fore','F:0').map(n=>n.id),['a']);
  assert.deepEqual(preferredCandidates(candidates,'right','F:0').map(n=>n.id),['b']);
  assert.equal(preferredCandidates(candidates,'auto','F:0'),candidates);
  assert.equal(preferredCandidates(candidates,'fore',null),candidates);
  assert.equal(planeOf({formation:{id:'F',plane:0}}),'F:0');
  assert.equal(planeOf({}),null);assert.equal(pairKey('B','A'),'A|B');assert.equal(terminalKey('A','EQ'),'A/EQ');
  assert.deepEqual(linkSummary([]),{locked:0,one_way:0,acquiring:0,slewing:0,blocked:0,idle:0,total:0});
});

test('resolver construction requires actual library/optical calculation ports',()=>{
  for(const options of [{},{library},{oisl},{library:{},oisl},{library,oisl:{}}])assert.throws(()=>createNodeLinkResolver(options),TypeError);
});
