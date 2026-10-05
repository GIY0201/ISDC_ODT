import test from 'node:test';import assert from 'node:assert/strict';import{fixture}from'./workspace_fixture.mjs';import{createGlobeViewPanel}from'../../../user_application/web/scripts/tabs/globe_view.js';
test('panel teardown removes detached and connected field handlers; remount binds one new owner',async()=>{
 const f=fixture();try{
 f.get('screen').innerHTML='';const observers=new Set(),calls=[];
 const globe={viewState:()=>({choice:{mode:'3d',imagery:'blue_marble',theme:'dark',emphasis:true},imagery:{phase:'ready',displayedImagery:'blue_marble'},mode:{phase:'ready'},available:true}),observeView:fn=>{observers.add(fn);return()=>observers.delete(fn);},changeView:patch=>(calls.push(patch),true)};
 const first=createGlobeViewPanel(globe);first.show('satellite');const old=f.get('globe-mode');assert.equal(old.listeners.get('change').size,1);first.destroy();assert.equal(old.listeners.get('change').size,0);assert.equal(observers.size,0);
 const second=createGlobeViewPanel(globe);second.show('ground');old.value='2d';await old.dispatch('change');assert.deepEqual(calls,[{mode:'2d'}]);
 f.get('screen').innerHTML='';second.show('satellite');assert.equal(old.listeners.get('change').size,0);const latest=f.get('globe-mode');assert.notEqual(latest,old);assert.equal(latest.listeners.get('change').size,1);second.destroy();assert.equal(latest.listeners.get('change').size,0);
 }finally{f.dispose();}
});
