import test from 'node:test';
import assert from 'node:assert/strict';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import {createMissionStore,MISSIONS_KEY} from '../../../user_application/web/scripts/missions/mission_store.js';
const model=createMissionTypes(createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=> 'equipment'}));
function fixture(){let raw=null,fail=false;const storage={getItem:()=>raw,setItem:(_,value)=>{if(fail)throw Error('quota');raw=value;}};const store=createMissionStore({model,storage,now:()=>Date.UTC(2026,8,8)});return {store,raw:()=>raw,set:value=>raw=value,fail:()=>fail=true};}
test('mission storage failure retains accepted request/plan/log/sequence and caller copies cannot mutate it',()=>{
 const f=fixture();assert.equal(f.store.load(),true);const result=f.store.add({kind:'compute'});const before=f.store.missions,log=f.store.log,bytes=f.raw();result.mission.params.input_mb=999;f.store.missions[0].params.input_mb=999;assert.deepEqual(f.store.missions,before);
 f.fail();assert.throws(()=>f.store.update(before[0].id,{name:'not saved'}),/저장|quota/);assert.deepEqual(f.store.missions,before);assert.deepEqual(f.store.log,log);assert.equal(f.raw(),bytes);assert.match(f.store.error,/저장|quota/);
});
test('malformed stored missions cannot silently turn into an empty ready set',()=>{
 for(const raw of ['{broken','null','[]',JSON.stringify({schema:1,sequence:0,missions:'wrong',log:[]})]){const f=fixture();f.set(raw);assert.equal(f.store.load(),false);assert.equal(f.store.ready,false);assert.match(f.store.error,/저장|형식/);assert.throws(()=>f.store.add({kind:'compute'}),/불러|설정/);}
});
test('missed cross-window update prevents overwriting another mission set',()=>{
 const f=fixture();f.store.load();f.store.add({kind:'compute'});const before=f.store.missions;const other=JSON.parse(f.raw());other.missions[0].name='other window';f.set(JSON.stringify(other));
 assert.throws(()=>f.store.update(before[0].id,{name:'local overwrite'}),/다른 창/);assert.equal(JSON.parse(f.raw()).missions[0].name,'other window');assert.deepEqual(f.store.missions,before);assert.equal(f.store.load(),true);assert.equal(f.store.missions[0].name,'other window');
});
test('observers cannot roll back accepted mission writes and disposal blocks later changes',()=>{
 const f=fixture();f.store.load();f.store.subscribe(()=>{throw Error('observer');});assert.equal(f.store.add({kind:'compute'}).errors.length,0);assert.equal(JSON.parse(f.raw()).missions.length,1);f.store.destroy();assert.throws(()=>f.store.add({kind:'compute'}),/종료/);
});

test('invalid status and non-finite plan do not mutate accepted requests or storage',()=>{
 const f=fixture();f.store.load();const id=f.store.add({kind:'compute'}).mission.id,bytes=f.raw(),before=f.store.missions;
 assert.throws(()=>f.store.setStatus(id,'__proto__'),/형식/);assert.throws(()=>f.store.setPlan(id,{feasible:true,summary:{stored_mb:Infinity}}),/유한/);
 assert.deepEqual(f.store.missions,before);assert.equal(f.raw(),bytes);
});
