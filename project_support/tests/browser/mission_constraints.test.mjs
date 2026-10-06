import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createMissionConstraints} from '../../../digital_twin/simulation/browser/mission_constraints.js';
const model=createMissionConstraints({timeOf:value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null});
test('source planning horizon retains minimum, margin and maximum clamp',()=>{
 assert.equal(model.planHorizon(0,0).hours,2);assert.equal(model.planHorizon(0,6*3600000).hours,7);assert.equal(model.planHorizon(0,48*3600000).hours,24);
});
test('source busy intervals include only other committed missions and sort by source time',()=>{
 const tasks=[{id:'L',satellite:'N-1',start:'2026-01-01T01:00:00Z',end:'2026-01-01T02:00:00Z'},{id:'E',satellite:'N-1',start:'2026-01-01T00:00:00Z',end:'2026-01-01T01:00:00Z'},{id:'BAD',satellite:'N-1',start:'bad',end:'bad'}];
 const missions=[{id:'OTHER',status:'committed',plan:{tasks}},{id:'SELF',status:'committed',plan:{tasks}},{id:'DRAFT',status:'draft',plan:{tasks}}];
 assert.deepEqual(model.busyIntervals(missions,{except:'SELF'})['N-1'].map(x=>x.task_id),['E','L']);
});
test('source faults target pair/node/station ids and names while ignoring inactive faults',()=>{
 const nodes=[{id:'A',name:'Alpha'},{id:'B',name:'Beta'},{id:'C',name:'Gamma'}],pairs=[{key:'A|B',a:'A',b:'B'},{key:'B|C',a:'B',b:'C'}];
 assert.deepEqual([...model.faultedPairKeys(pairs,nodes,[{kind:'link_loss',target:'Alpha'}])],['A|B']);
 assert.equal(model.faultedPairKeys(pairs,nodes,[{kind:'link_loss',target:'B',active:false}]).size,0);
 assert.deepEqual([...model.faultedStationIds([{id:'GS',name:'Site'}],[{kind:'link_loss',target:'Site'}])],['GS']);
});

test('constraint equations are byte-exact captured original bodies after export adaptation',async()=>{
 const source=(await readFile(new URL('../../../digital_twin/simulation/browser/mission_constraints.js',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const body=source.split('// BEGIN ORIGINAL CONSTRAINTS\n')[1].split('\n// END ORIGINAL CONSTRAINTS')[0];
 const fixture=JSON.parse(await readFile(new URL('../fixtures/original_mission_constraints.json',import.meta.url),'utf8'));
 assert.equal(fixture.source_commit,'1a1e00297a0301637455b0ef2cf48b2e74576b07');
 assert.equal(createHash('sha256').update(body).digest('hex'),fixture.body_sha256);
});
