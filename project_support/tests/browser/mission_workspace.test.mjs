import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionWorkspace} from '../../../user_application/web/scripts/tabs/mission_workspace.js';

const mission=()=>({id:'real-id',name:'SIM mission',status:'planned',progress:0,plan_version:1,tasks:[],resources:{power:30},success_conditions:[]});
function setup(overrides={}){const calls=[],m=mission();const api={bootstrap:async()=>({missions:[m]}),missionTask:async p=>{calls.push(p);return {mission:{...m,plan_version:2,tasks:[{id:'T-01',...p}]},validation:{mission_id:m.id,plan_version:2,valid:true,conflict_count:0,conflicts:[]}};},validateMission:async id=>({mission_id:id,plan_version:1,valid:false,conflict_count:1,conflicts:[{type:'resource',message:'overload',task_ids:[]}]}),replanMission:async(id,apply)=>{calls.push({id,apply});return {mission:{...m,plan_version:apply?2:1},applied:apply,diff:[{task_id:'T-01',before:1,after:2}],validation:{mission_id:id,plan_version:apply?2:1,valid:true,conflict_count:0,conflicts:[]}};},missionAction:async(id,action)=>{calls.push({id,action});return {...m,status:'running'};},...overrides};return {controller:createMissionWorkspace(api),calls,m};}
test('uses server IDs, editable copy, strict fields, preview separated from current validation and apply',async()=>{
 const {controller:c,calls}=setup();await c.load();assert.equal(c.snapshot().selected,'real-id');
 c.edit({name:'Test',lane:'관측',start:'0',duration:'10',priority:'5',status:'planned',predecessor:''});
 await c.save();assert.equal(calls[0].mission_id,'real-id');assert.equal(calls[0].operation,'create');assert.equal(calls[0].predecessor,'');
 const copy=c.snapshot();copy.missions[0].name='fake';assert.equal(c.snapshot().missions[0].name,'SIM mission');
 await c.validate();assert.equal(c.snapshot().validation.valid,false);
 await c.preview();assert.equal(c.snapshot().preview.applied,false);
 await c.apply();assert.equal(calls.at(-1).apply,true);assert.equal(c.snapshot().preview,null);
 await c.action('start');assert.equal(calls.at(-1).id,'real-id');
 c.edit({duration:'0'});const count=calls.length;await c.save();assert.equal(calls.length,count);assert.match(c.snapshot().error,/duration|기간/);
});
test('serializes requests, refuses duplicate command and ignores completion after destroy',async()=>{
 let resolve;const {controller:c,calls}=setup({missionAction:()=>new Promise(r=>resolve=r)});await c.load();
 const pending=c.action('start');await c.action('start');assert.equal(c.snapshot().busy,true);
 c.destroy();resolve({...mission(),status:'running'});await pending;assert.equal(c.snapshot().missions[0].status,'planned');
});
test('explicit errors and empty bootstrap; remote draft invalidates preview without sending commands',async()=>{
 const {controller:c,calls}=setup();await c.load();await c.preview();c.edit({name:'Remote'});assert.equal(c.snapshot().preview,null);assert.equal(calls.length,1);
 const fail=setup({bootstrap:async()=>{throw Error('network');}}).controller;await fail.load();assert.match(fail.snapshot().error,/network/);
 const empty=setup({bootstrap:async()=>({missions:[]})}).controller;await empty.load();assert.equal(empty.snapshot().selected,'');
 const bad=setup({missionAction:async()=>({...mission(),id:'wrong'})}).controller;await bad.load();await bad.action('start');assert.match(bad.snapshot().error,/임무|mission/);
});
