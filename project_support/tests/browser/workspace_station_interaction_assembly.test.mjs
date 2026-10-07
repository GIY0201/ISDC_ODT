import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
// Real workspace, stores, native network owner, both renderer/globe owners and
// callbacks; only HTTP, DOM and Cesium adapters. This is not live GPU evidence.
for(const [width,height]of [[1920,1080],[2560,1440]])test(`actual operator station click and explicit camera focus preserve source inputs ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#ground',planningBootstrap:async()=>({runtime:{mode:'SIM',running:false,speed:1,elapsed_seconds:0,sequence:0,run_id:'fixture',scenario_id:'fixture',active_faults:[]},scenarios:[{id:'fixture',name:'fixture'}],events:[],missions:[]})});
 const sources=[];
 f.win.Cesium.CustomDataSource=class{constructor(){const values=[];this.entities={values,add:value=>{const result={show:true,...value};values.push(result);return result;},remove(value){const i=values.indexOf(value);if(i<0)return false;values.splice(i,1);return true;},contains:value=>values.includes(value),removeAll(){values.length=0;}};}};
 const settle=async()=>{for(let i=0;i<30;i++){await new Promise(resolve=>setImmediate(resolve));f.flush();}};
 try{await settle();assert.equal(f.viewers.length,1);const viewer=f.viewers[0];viewer.dataSources={add:value=>{sources.push(value);return value;},remove(value){const i=sources.indexOf(value);if(i<0)return false;sources.splice(i,1);return true;},contains:value=>sources.includes(value)};
  await f.evaluate('simPanel.controller.load()');await settle();await f.get('ground-node-calculate').dispatch('click');await settle();assert.equal(f.evaluate('nodeWorkspace.networkSnapshot().status'),'valid');viewer.scene.preRender.raise();await settle();
  const entity=sources.flatMap(s=>s.entities.values).find(e=>e.id==='station-GS-DAEJEON');assert.ok(entity,JSON.stringify({sources:sources.map(s=>s.entities.values.map(e=>e.id)),network:f.evaluate('nodeWorkspace.networkSnapshot()')?.status,renderer:f.evaluate('globe.nodeRendererState()'),summary:f.get('ground-node-summary').textContent}));assert.equal(entity.show,true);
  const before=f.snapshot(),clock=f.evaluate('globe.displayContext()'),nodeSelection=f.evaluate('nodeWorkspace.sceneSnapshot().selected_id');
  viewer.scene.pick=()=>({id:entity});f.pickHandlers[0].click({position:{x:100,y:100}});f.flush();
  assert.equal(f.evaluate('sourceGround.selectedId'),'GS-DAEJEON');assert.equal(f.get('ground-node-select').value,'GS-DAEJEON');assert.equal(viewer.flight,undefined);
  assert.equal(f.get('ground-node-focus').disabled,false);await f.get('ground-node-focus').dispatch('click');assert.equal(viewer.flight.destination.z,2400000);assert.equal(viewer.flight.duration,1.4);assert.equal(Object.hasOwn(viewer.flight,'orientation'),false);
  assert.deepEqual(f.snapshot(),before);assert.deepEqual(f.evaluate('globe.displayContext()'),clock);assert.equal(f.evaluate('nodeWorkspace.sceneSnapshot().selected_id'),nodeSelection);assert.equal(f.counts().commands,0);
  const selected=f.evaluate('sourceGround.selectedId'),flight=viewer.flight;viewer.scene.pick=()=>({id:{properties:{stationId:'GS-JEJU'}}});f.pickHandlers[0].click({position:{x:100,y:100}});assert.equal(f.evaluate('sourceGround.selectedId'),selected);assert.equal(viewer.flight,flight);
  f.evaluate("showWorkspaceOrbit('satellite')");viewer.scene.pick=()=>({id:entity});f.pickHandlers[0].click({position:{x:100,y:100}});assert.equal(f.evaluate('sourceGround.selectedId'),selected);assert.equal(viewer.flight,flight);
  await f.win.dispatch('pagehide',{persisted:false});assert.equal(viewer.destroyCount,1);assert.equal(f.viewers.length,1);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
