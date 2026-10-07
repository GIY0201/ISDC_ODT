import test from 'node:test';import assert from 'node:assert/strict';import{fixture}from'./workspace_fixture.mjs';import{createGlobeViewPanel}from'../../../user_application/web/scripts/tabs/globe_view.js';
test('solar panel exposes source UTC/error/retry and removes owned solar control handlers',async()=>{
 const f=fixture();try{
 f.get('screen').innerHTML='';const observers=new Set(),calls=[];
 const globe={viewState:()=>({choice:{mode:'3d',imagery:'blue_marble',theme:'dark',emphasis:true},imagery:{phase:'ready'},mode:{phase:'ready'},available:true}),observeView:()=>()=>{},changeView(){}};
 const solar={state:()=>({enabled:true,context:{key:'stored:ISS',utc:'2020-07-12T21:16:01Z'},timeline:{status:'error',error:'EOP unavailable',eop_sha256:'a'.repeat(64)},renderer:{indicator:'unavailable'}}),observe(fn){observers.add(fn);return()=>observers.delete(fn);},setEnabled:v=>calls.push(v),retry:()=>calls.push('retry')};
 const panel=createGlobeViewPanel(globe,solar);panel.show('settings');assert.match(f.get('globe-solar-status').textContent,/EOP unavailable/);assert.match(f.get('globe-solar-status').textContent,/2020-07-12/);const checkbox=f.get('globe-lighting'),button=f.get('globe-solar-retry');checkbox.checked=false;await checkbox.dispatch('change');await button.dispatch('click');assert.deepEqual(calls,[false,'retry']);panel.destroy();assert.equal(checkbox.listeners.get('change').size,0);assert.equal(button.listeners.get('click').size,0);assert.equal(observers.size,0);
 }finally{f.dispose();}
});
test('panel teardown removes detached and connected field handlers; remount binds one new owner',async()=>{
 const f=fixture();try{
 f.get('screen').innerHTML='';const observers=new Set(),calls=[];
 const globe={viewState:()=>({choice:{mode:'3d',imagery:'blue_marble',theme:'dark',emphasis:true},imagery:{phase:'ready',displayedImagery:'blue_marble'},mode:{phase:'ready'},available:true}),observeView:fn=>{observers.add(fn);return()=>observers.delete(fn);},changeView:patch=>(calls.push(patch),true)};
 const first=createGlobeViewPanel(globe);first.show('settings');const old=f.get('globe-mode');assert.equal(old.listeners.get('change').size,1);first.destroy();assert.equal(old.listeners.get('change').size,0);assert.equal(observers.size,0);
 const second=createGlobeViewPanel(globe);second.show('settings');old.value='2d';await old.dispatch('change');assert.deepEqual(calls,[{mode:'2d'}]);
 f.get('screen').innerHTML='';second.show('settings');assert.equal(old.listeners.get('change').size,0);const latest=f.get('globe-mode');assert.notEqual(latest,old);assert.equal(latest.listeners.get('change').size,1);second.destroy();assert.equal(latest.listeners.get('change').size,0);
 }finally{f.dispose();}
});
