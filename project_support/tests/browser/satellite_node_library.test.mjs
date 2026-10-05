import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';

const fixture=JSON.parse(await readFile(new URL('../fixtures/original_satellite_nodes.json',import.meta.url),'utf8'));
const epoch=fixture.evidence.epoch;
function library(){let sequence=0;return createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${epoch.toString(36)}-${++sequence}`});}
const json=value=>JSON.parse(JSON.stringify(value));

test('every original bus, mode, power, mass, catalog and preset-policy formation result is reused',()=>{
 const node=library();let checked=0;
 for(const c of fixture.cases){
  let actual;
  if(c.id.startsWith('bus:'))actual=node.createNode(c.input.partial,c.input.options);
  else if(c.id.startsWith('power:'))actual=node.powerBudget(c.input.node,c.input.options);
  else if(c.id.startsWith('mass:'))actual=node.nodeMass(c.input.node);
  else if(c.id.startsWith('catalog:'))actual=node.nodeCatalogItem(c.input.node);
  else if(c.id.startsWith('terminal-power:'))actual=node.powerBudget(c.input.node,{...c.input.options,activeTerminals:new Set(c.input.options.activeTerminals)});
  else if(c.id.startsWith('formation:')){
   let sequence=c.input.startSequence;
   actual={normalized:node.normalizeFormationParams(c.input.params),summary:node.formationSummary(c.input.params),nodes:node.generateFormation(c.input.params,{...c.input.options,idFactory:()=>({id:`NODE-${String(++sequence).padStart(4,'0')}`,catalogNumber:900000+sequence})})};
  } else continue;
  checked++;assert.deepEqual(json(actual),c.expected,c.id);
 }
 assert.equal(checked,62);
 for(const [name,expected] of Object.entries(fixture.definitions))assert.deepEqual(json(node[name]),expected,name);
});
test('definitions, factory inputs and equipment nested results cannot mutate another node',()=>{
 const lib=library(),node=lib.createNode({bus:'flat_panel'},{epoch,id:'N-1',catalogNumber:900001});
 const first=lib.equipmentSpec(node.equipment[0]);first.field_of_regard.elevation[0]=999;
 assert.notEqual(lib.equipmentSpec(node.equipment[0]).field_of_regard.elevation[0],999);
 const partial={...node,formation:{id:'F-1',params:{planes:3}}};
 const copy=lib.createNode(partial,{epoch,id:'N-2',catalogNumber:900002});
 copy.formation.params.planes=9;copy.equipment[0].role='auto';
 assert.equal(partial.formation.params.planes,3);assert.equal(partial.equipment[0].role,'fore');
 const cloned=lib.cloneNode(node,{epoch,id:'N-3',catalogNumber:900003});
 assert.equal(cloned.formation,null);assert.notEqual(cloned.equipment[0].id,node.equipment[0].id);
 cloned.power.generation_w=0;assert.equal(node.power.generation_w,4500);
});
test('finite and explicit-input improvements reject source Infinity gap and prevent implicit wall clocks',()=>{
 const lib=library(),node=lib.createNode({}, {epoch,id:'N-1',catalogNumber:900001});
 assert.deepEqual(lib.validateNode(node),[]);
 for(const key of ['generation_w','bus_w','battery_wh'])for(const invalid of [Infinity,NaN,-1]){
  const bad=structuredClone(node);bad.power[key]=invalid;assert.ok(lib.validateNode(bad).length>0,key);
 }
 assert.throws(()=>lib.createNode({}, {id:'N-2',catalogNumber:900002}), /epoch/);
 assert.throws(()=>lib.defaultOrbit(), /epoch/);
 assert.throws(()=>createNodeLibrary({orbitElements,catalogElements}), /EquipmentId|equipment.*id/i);
});
test('source mode/role/domain validation and immutable formation inputs stay explicit',()=>{
 const lib=library(),node=lib.createNode({}, {epoch,id:'N-1',catalogNumber:900001});
 for(const [key,value] of [['bus','missing'],['mode','missing'],['model_key','']]){
  const bad=structuredClone(node);bad[key]=value;assert.ok(lib.validateNode(bad).length>0,key);
 }
 const bad=structuredClone(node);bad.equipment[0].role='missing';assert.ok(lib.validateNode(bad).length>0);
 const params={preset:'walker_star',planes:3,per_plane:4,phasing:2,raan_start:350,anomaly_start:355};
 const saved=JSON.stringify(params);lib.generateFormation(params,{epoch,formationId:'F-1',idFactory:(()=>{let id=0;return()=>({id:`N-${++id}`,catalogNumber:900000+id});})()});
 assert.equal(JSON.stringify(params),saved);
});
test('node identity, equipment identity and schema repairs do not admit ambiguous definitions',()=>{
 const lib=library(),node=lib.createNode({}, {epoch,id:'N-1',catalogNumber:900001});
 for(const [key,value] of [['schema',2],['id',''],['catalog_number',900001.5],['catalog_number',12],['mass_kg',Infinity]]){
  const bad=structuredClone(node);bad[key]=value;assert.ok(lib.validateNode(bad).length>0,key);
 }
 const bad=structuredClone(node);bad.equipment[1].id=bad.equipment[0].id;assert.ok(lib.validateNode(bad).length>0);
 assert.throws(()=>lib.createNode({}, {epoch,catalogNumber:900001}), /id/i);
});
