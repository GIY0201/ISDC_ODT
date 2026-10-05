import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createSatelliteModelPanel} from '../../../user_application/web/scripts/tabs/satellite_model.js';

test('mapping quality and render readiness remain separate; only explicit buttons move camera or retry',async()=>{
 const f=fixture(),observers=new Set(),calls=[];
 let state={selected:{catalog_number:25544},match:{quality:'exact',title:'ISS',label:'국제우주정거장',credit:'NASA',creditUrl:'https://example.test/iss',thumbnail:'/static/satellite_display/iss.jpg',sizeMeters:109},status:{phase:'loading'},tracking:false};
 const globe={modelState:()=>structuredClone(state),observeModel:fn=>(observers.add(fn),()=>observers.delete(fn)),focusSatelliteModel:o=>(calls.push(['focus',o]),true),releaseSatelliteModel:()=>calls.push(['release']),retrySatelliteModel:()=>calls.push(['retry'])};
 try{
 f.get('screen').innerHTML='';const panel=createSatelliteModelPanel(globe);panel.show('satellite');
 assert.match(f.get('satellite-model-quality').textContent,/해당 기체/);assert.match(f.get('satellite-model-status').textContent,/준비 중/);assert.deepEqual(calls,[]);
 state.status={phase:'ready'};for(const fn of observers)fn();assert.match(f.get('satellite-model-status').textContent,/준비 완료/);
 await f.get('satellite-model-focus').dispatch('click');await f.get('satellite-model-follow').dispatch('click');state.tracking=true;for(const fn of observers)fn();await f.get('satellite-model-release').dispatch('click');
 assert.deepEqual(calls,[['focus',{keepRange:false}],['focus',{keepRange:true}],['release']]);
 state.status={phase:'error',errorKind:'render',error:'<bad GPU>'};for(const fn of observers)fn();assert.match(f.get('satellite-model-status').textContent,/<bad GPU>/);await f.get('satellite-model-retry').dispatch('click');assert.deepEqual(calls.at(-1),['retry']);
 const old=f.get('satellite-model-focus');f.get('screen').innerHTML='';panel.show('satellite');assert.equal(old.listeners.get('click').size,0);assert.equal(f.get('satellite-model-focus').listeners.get('click').size,1);
 const count=calls.length;panel.applyDraft([{id:'satellite-model-focus',value:'true'}]);assert.equal(calls.length,count);
 panel.destroy();panel.destroy();assert.equal(observers.size,0);assert.equal(f.get('satellite-model-focus').listeners.get('click').size,0);
 }finally{f.dispose();}
});

test('no model clears thumbnail/credit, no selection and missing geometry disable focus; unsafe credit URL stays inert',()=>{
 const f=fixture();let state={selected:null,match:null,status:{phase:'unassigned'},tracking:false};
 const globe={modelState:()=>state,observeModel:()=>()=>{}};
 try{f.get('screen').innerHTML='';const panel=createSatelliteModelPanel(globe);panel.show('satellite');
 assert.equal(f.get('satellite-model-image').hidden,true);assert.equal(f.get('satellite-model-credit').hidden,true);assert.equal(f.get('satellite-model-focus').disabled,true);
 state={selected:{catalog_number:1},match:{title:'x',label:'x',quality:'series',credit:'literal',creditUrl:'javascript:attack()',thumbnail:'/x.jpg'},status:{phase:'hidden_no_geometry'},tracking:false};panel.update();
 assert.equal(f.get('satellite-model-focus').disabled,true);assert.equal(f.get('satellite-model-credit').attributes.href,undefined);assert.equal(f.get('satellite-model-retry').disabled,true);
 panel.destroy();}finally{f.dispose();}
});
