import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './workspace_fixture.mjs';
test('model information belongs to selected card, passes to ground, whole switch to common display',async()=>{
 const f=fixture(1280,720,{hash:'#settings'});try{await new Promise(r=>setImmediate(r));
 assert.equal(f.get('satellite-model-panel').parentElement.id,'desktop-model-info');
 assert.equal(f.get('catalog-scene').parentElement.id,'globe-display-controls');
 assert.equal(f.doc.getElementById('catalog-passes')?.isConnected===true,false);
 assert.ok(f.get('scene-toggle'));assert.match(f.get('catalog-scene').innerHTML,/id="scene-advanced" hidden/);
 f.evaluate("showWorkspaceOrbit('ground')");assert.equal(f.get('catalog-passes').parentElement.id,'screen');

 assert.ok(f.get('desktop-track-toggle'));assert.equal(f.counts().commands,0);
 }finally{f.dispose();}
});

test('whole ON ignores list filters; OFF fences a pending native query',async()=>{
 let resolve;const f=fixture(1280,720,{hash:'#settings',catalogScene:()=>new Promise(r=>resolve=r)});
 try{f.evaluate("catalogScene.configure({group:'active',query:'one',orbit:'LEO'});");f.get('scene-toggle').checked=true;const pending=f.get('scene-toggle').dispatch('change');await new Promise(r=>setImmediate(r));
 assert.equal(f.evaluate('catalogScene.snapshot().context.query'),'');assert.equal(f.evaluate('catalogScene.snapshot().context.orbit'),'all');
 f.get('scene-toggle').checked=false;await f.get('scene-toggle').dispatch('change');resolve({});await pending;assert.equal(f.evaluate('catalogScene.snapshot().enabled'),false);assert.equal(f.evaluate('catalogScene.snapshot().result'),null);assert.equal(f.get('scene-toggle').checked,false);assert.equal(f.counts().commands,0);
 }finally{f.dispose();}
});
