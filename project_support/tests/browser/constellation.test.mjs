import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createConstellationStore,DRAFT_KEY,DEPLOYED_KEY} from '../../../user_application/web/scripts/nodes/constellation.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
const epoch=1791151272000;
function library(){let sequence=0;return createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${epoch.toString(36)}-${++sequence}`});}
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function store(options={}){const lib=library();return createConstellationStore({library:lib,now:()=>epoch,storage:storage(),...options});}
function view(s){return {drafts:s.drafts,deployed:s.deployed,deployedAt:s.deployedAt,selectedId:s.selectedId,dirty:s.isDirty()};}

test('restore readiness stays false on damaged storage and becomes true only after successful load',()=>{
 const memory=storage();memory.setItem(DRAFT_KEY,'broken');const s=store({storage:memory});
 assert.equal(s.loaded,false);assert.throws(()=>s.load(),/손상/);assert.equal(s.loaded,false);assert.equal(memory.getItem(DRAFT_KEY),'broken');
 memory.setItem(DRAFT_KEY,JSON.stringify({schema:1,nodes:[],sequence:0,selectedId:null,revision:0}));s.load();assert.equal(s.loaded,true);
});

test('original source store transitions are preserved with verified-receipt injection',async()=>{
 const fixture=JSON.parse(await readFile(new URL('../fixtures/original_constellation.json',import.meta.url),'utf8'));
 const s=store({verifyAcceptance:()=>true});
 for(const step of fixture.steps){
  const {operation,args}=step;
  if(operation==='update')s.update(args[0],{...s.find(args[0]),notes:args[1]});
  else if(operation==='deploy')s.deploy(s.drafts,{id:'test-receipt'});
  else if(operation==='recall')s.recall({id:'test-receipt'});
  else s[operation](...args);
  assert.deepEqual(view(s),step.expected,operation);
 }
});

test('every boundary returns a copy, and dirty ignores only updated_at',()=>{
 const s=store({verifyAcceptance:()=>true});s.load();const n=s.add({bus:'flat_panel'});s.deploy(s.drafts,{});
 n.power.generation_w=0;s.drafts[0].equipment[0].role='auto';s.find(n.id).orbit.altitude_km=800;
 assert.equal(s.drafts[0].power.generation_w,4500);assert.equal(s.drafts[0].orbit.altitude_km,550);assert.equal(s.isDirty(),false);
 const same=s.find(n.id);same.updated_at='2026-10-04T22:01:13Z';assert.deepEqual(s.update(n.id,same),[]);assert.equal(s.isDirty(),false);
 const change=s.find(n.id);change.notes='changed';assert.deepEqual(s.update(n.id,change),[]);assert.equal(s.isDirty(),true);
 s.deployed[0].notes='changed';assert.equal(s.deployed[0].notes,'');
});

test('source add/duplicate/bulk cap and ID recovery include deployed records',()=>{
 const s=store();s.load();const lib=library();const nodes=Array.from({length:240},(_,i)=>lib.createNode({}, {epoch,id:`NODE-${String(i+1).padStart(4,'0')}`,catalogNumber:900001+i}));
 s.addMany(nodes);assert.throws(()=>s.add({}),/240/);assert.throws(()=>s.duplicate(nodes[0].id),/240/);assert.equal(s.drafts.length,240);
 s.clear();assert.equal(s.add({}).catalog_number,900241);
});

test('duplicate IDs/catalogs and invalid bulk definitions roll back whole operation',()=>{
 const s=store();s.load();s.add({});const before=view(s);
 assert.throws(()=>s.addMany([s.drafts[0]]));assert.deepEqual(view(s),before);
 const lib=library();const bad=lib.createNode({}, {epoch,id:'N-2',catalogNumber:900002});bad.orbit.eccentricity=.95;
 assert.throws(()=>s.addMany([bad]));assert.deepEqual(view(s),before);
 const sameCatalog=lib.createNode({}, {epoch,id:'N-2',catalogNumber:900001});assert.throws(()=>s.addMany([sameCatalog]));assert.deepEqual(view(s),before);
});

test('formation replacement preserves order/selection/detached members and atomic cap',()=>{
 const s=store();s.load();const outside=s.add({name:'outside'});const lib=library();
 let i=1;const make=(count)=>Array.from({length:count},(_,index)=>lib.createNode({formation:{id:'F-1',index}}, {epoch,id:`N-${++i}`,catalogNumber:900000+i}));
 const members=make(3);s.addMany(members);s.select(members[1].id);const saved=s.find(members[0].id);assert.deepEqual(s.update(saved.id,saved),[]);assert.equal(s.find(saved.id).formation,null);
 const revised=structuredClone(members.slice(1));revised[0].name='replacement';s.replaceFormation('F-1',revised);
 assert.equal(s.selectedId,members[1].id);assert.deepEqual(s.drafts.map(n=>n.id),[outside.id,saved.id,...revised.map(n=>n.id)]);
 const before=view(s);assert.throws(()=>s.replaceFormation('F-1',make(239)));assert.deepEqual(view(s),before);
 assert.deepEqual(s.removeFormation('F-1'),revised.map(n=>n.id));assert.ok(s.find(saved.id));
});

test('storage failures preserve last valid memory and do not consume IDs',()=>{
 const backing=storage();const s=store({storage:backing});s.load();const original=backing.setItem;
 backing.setItem=()=>{throw new Error('denied');};assert.throws(()=>s.add({}),/저장/);assert.equal(s.drafts.length,0);assert.equal(s.error.code,'storage_unavailable');
 backing.setItem=original;assert.equal(s.add({}).id,'NODE-0001');
 const before=view(s);backing.getItem=()=>{throw new Error('denied');};assert.throws(()=>s.load());assert.deepEqual(view(s),before);
});

test('cross-window revision conflicts require explicit readonly reload',()=>{
 const backing=storage();const a=store({storage:backing}),b=store({storage:backing});a.load();b.load();a.add({name:'a'});
 assert.throws(()=>b.add({name:'b'}),/충돌/);assert.equal(b.drafts.length,0);assert.equal(b.error.code,'storage_conflict');
 b.load({discardLocal:true});assert.equal(b.drafts[0].name,'a');b.add({name:'b'});
 assert.equal(a.receiveExternalDraft(backing.getItem(DRAFT_KEY)),false);assert.equal(a.drafts.length,1);assert.equal(a.error.code,'storage_conflict');
 assert.throws(()=>a.load(),/충돌/);a.load({discardLocal:true});assert.equal(a.drafts.length,2);
});

test('restore validates both records atomically and never confirms deployment',()=>{
 const backing=storage(),s=store({storage:backing,verifyAcceptance:()=>true});s.load();s.add({});s.deploy(s.drafts,{});
 const restored=store({storage:backing});restored.load();assert.equal(restored.deploymentConfirmed,false);assert.equal(restored.deployed.length,1);
 assert.equal(restored.add({}).catalog_number,900002);const before=view(restored);
 backing.setItem(DEPLOYED_KEY,'{');assert.throws(()=>restored.load({discardLocal:true}));assert.deepEqual(view(restored),before);
});

for(const kind of ['schema','duplicate','capacity','revision','orbit'])test(`corrupt restored ${kind} retains memory without truncation`,()=>{
 const backing=storage(),s=store({storage:backing});s.load();s.add({});const before=view(s);const record=JSON.parse(backing.getItem(DRAFT_KEY));
 if(kind==='schema')record.schema=2;
 if(kind==='duplicate')record.nodes.push(record.nodes[0]);
 if(kind==='capacity')record.nodes=Array(241).fill(record.nodes[0]);
 if(kind==='revision')record.revision=-1;
 if(kind==='orbit')record.nodes[0].orbit.altitude_km=100;
 backing.setItem(DRAFT_KEY,JSON.stringify(record));assert.throws(()=>s.load({discardLocal:true}));assert.deepEqual(view(s),before);
});

test('deployment has no unconditional local acceptance and memory-only is visible',()=>{
 const s=store({storage:null});s.load();s.add({});assert.equal(s.persistence,'memory_only');assert.throws(()=>s.deploy(s.drafts,{}),/수락/);assert.equal(s.deployed.length,0);
 const guarded=store({verifyAcceptance:()=>false});guarded.load();guarded.add({});assert.throws(()=>guarded.deploy(guarded.drafts,{}));assert.equal(guarded.deployed.length,0);
});

test('listener copies and unsubscribe do not expose internal state',()=>{
 const s=store();s.load();let calls=0;const remove=s.subscribe((event,snapshot)=>{calls++;snapshot.drafts[0].name='external';});s.add({name:'original'});
 assert.equal(s.drafts[0].name,'original');remove();s.clear();assert.equal(calls,1);
});

test('memory-only revisions advance and restored explicit deselection is retained',()=>{
 const memory=store({storage:null});memory.load();memory.add({});assert.equal(memory.revision,1);memory.select(null);assert.equal(memory.revision,2);
 const backing=storage(),s=store({storage:backing});s.load();s.add({});s.select(null);const restored=store({storage:backing});restored.load();assert.equal(restored.selectedId,null);
});

test('changed deployed record fences draft ID allocation and failed deploy preserves both sets',()=>{
 const backing=storage(),a=store({storage:backing,verifyAcceptance:()=>true});a.load();a.add({});
 const b=store({storage:backing,verifyAcceptance:()=>true});b.load();a.deploy(a.drafts,{});
 assert.throws(()=>b.add({}),/충돌/);assert.equal(b.drafts.length,1);b.load({discardLocal:true});const before=view(b);
 const original=backing.setItem;backing.setItem=()=>{throw new Error('denied');};assert.throws(()=>b.recall({}));assert.deepEqual(view(b),before);backing.setItem=original;
});

test('invalid explicit time is rejected even for an empty restore',()=>{
 for(const value of [null,true,undefined,'yesterday']){const s=store({now:()=>value});assert.throws(()=>s.load(),/시각/);}
});

test('prospective formation IDs do not consume state on rejected generation',()=>{
 const s=store();s.load();const ids=s.idFactory();const first=ids();ids();assert.equal(s.drafts.length,0);
 const node=library().createNode({}, {epoch,...first});node.orbit.altitude_km=100;assert.throws(()=>s.addMany([node]));assert.equal(s.add({}).id,first.id);
});

test('a valid40-codepoint name remains duplicable repeatedly until the existing240 cap',()=>{
 const s=store();s.load();const source=s.add({name:'🛰'.repeat(40)}),original=s.find(source.id);let current=source;
 for(let i=1;i<240;i++){current=s.duplicate(current.id);assert.equal([...current.name].length<=40,true);assert.equal(current.name.endsWith(' 사본'),true);assert.equal(current.formation,null);}
 assert.deepEqual(s.find(source.id),original);assert.equal(new Set(s.drafts.map(n=>n.id)).size,240);assert.equal(new Set(s.drafts.map(n=>n.catalog_number)).size,240);const before=view(s);assert.throws(()=>s.duplicate(current.id),/240/);assert.deepEqual(view(s),before);
});


test('private full rendering roster is immutable and stable while all original action queries remain fresh copies',()=>{
 const backing=storage();let now=epoch;const s=store({storage:backing,now:()=>now,verifyAcceptance:()=>true});s.load();const a=s.add({name:'first'}),b=s.add({name:'second'});s.deploy(s.drafts,{proof:'source'});
 const first=s.presentationRoster();assert.deepEqual(first.drafts,s.drafts);assert.deepEqual(first.deployed,s.deployed);assert.deepEqual(first.selected,s.selected);assert.equal(first.drafts.length,2);assert.equal(Object.isFrozen(first.drafts[0].equipment[0]),true);assert.throws(()=>{first.drafts[0].name='changed';},TypeError);assert.equal(s.presentationRoster().drafts,first.drafts);
 const publicDraft=s.drafts;publicDraft[0].name='outside';const selected=s.selected;selected.name='outside';assert.notEqual(s.find(a.id).name,'outside');assert.notEqual(s.selected.name,'outside');assert.notEqual(publicDraft,s.drafts);
 s.select(b.id);const selection=s.presentationRoster();assert.equal(selection.selected.id,b.id);assert.notEqual(selection.drafts,first.drafts);assert.deepEqual(selection.drafts,s.drafts);
 now+=1000;s.update(b.id,s.find(b.id));assert.equal(s.presentationMetadata().dirty,false,'original dirty ignores timestamp only');assert.notEqual(s.presentationRoster().drafts,selection.drafts);assert.notEqual(s.presentationRoster().selected.updated_at,selection.selected.updated_at);
 const edited=s.find(b.id);edited.equipment[0].enabled=!edited.equipment[0].enabled;s.update(b.id,edited);assert.equal(s.presentationMetadata().dirty,true);assert.deepEqual(s.presentationRoster().selected,s.find(b.id));
 const persisted=backing.getItem(DRAFT_KEY),beforeReload=s.presentationRoster();s.load({discardLocal:true});assert.notEqual(s.presentationRoster().drafts,beforeReload.drafts,'same persisted revision reload is a new owner scope');assert.equal(s.presentationRoster().deployment_confirmed,false);assert.equal(backing.getItem(DRAFT_KEY),persisted);
 assert.equal(s.receiveExternalDraft(JSON.stringify({...JSON.parse(persisted),revision:999})),false);assert.match(s.presentationMetadata().error,/충돌/);assert.match(s.presentationRoster().error,/충돌/);assert.equal(s.presentationMetadata().revision,s.revision);
});

test('240-node private metadata and repeated rendering roster reads do not serialize unchanged full definitions',()=>{
 const s=store({verifyAcceptance:()=>true});s.load();const lib=library();s.addMany(Array.from({length:240},(_,i)=>lib.createNode({}, {epoch,id:'N-'+i,catalogNumber:900001+i})));s.deploy(s.drafts,{proof:'source'});
 const roster=s.presentationRoster(),stringify=JSON.stringify;let serializations=0;JSON.stringify=function(value,...args){if(Array.isArray(value)&&value.length===240&&value.every(n=>n?.schema===1))serializations++;return stringify.call(this,value,...args);};
 try{for(let i=0;i<20;i++){const next=s.presentationRoster(),meta=s.presentationMetadata();assert.equal(next.drafts,roster.drafts);assert.equal(meta.draft_count,240);assert.equal(meta.deployed_count,240);assert.equal(meta.dirty,false);assert.equal(meta.drafts,undefined);assert.equal(meta.deployed,undefined);}}finally{JSON.stringify=stringify;}
 assert.equal(serializations,0);assert.deepEqual(s.presentationRoster().drafts,s.drafts);
});
