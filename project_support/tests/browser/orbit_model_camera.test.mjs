import test from 'node:test';import assert from 'node:assert/strict';
import {OrbitGlobe} from '../../../digital_twin/visualization/orbit_globe.js';
function event(){const f=new Set();return{f,addEventListener(fn){f.add(fn);return()=>f.delete(fn);},raise(){for(const fn of [...f])fn();}};}
function fixture(){
  const calls=[],inputs=new Map(),canvas=new EventTarget();canvas.clientWidth=800;canvas.clientHeight=600;
  const oldWheel=()=>{};inputs.set(2,oldWheel);
  class Vector{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}static fromDegrees(x,y,z){return {x,y,z};}}
  class Viewer{constructor(){this.entities={remove(){},add:x=>x};this.clock={};this.imageryLayers={};this.camera={cancelFlight(){},flyTo:()=>calls.push('flight'),viewBoundingSphere:()=>calls.push('point_focus'),lookAtTransform(){}};this.scene={mode:3,canvas,globe:{},screenSpaceCameraController:{zoomEventTypes:[2]},preUpdate:event(),morphStart:event(),requestRender(){}};this.screenSpaceEventHandler={getInputAction:t=>inputs.get(t),setInputAction:(f,t)=>inputs.set(t,f),removeInputAction:t=>inputs.delete(t)};}destroy(){calls.push('viewer_destroy');}}
  const C={Viewer,Cartesian3:Vector,Color:{fromCssColorString:x=>x},EllipsoidTerrainProvider:class{},SceneMode:{MORPHING:0,SCENE2D:2,SCENE3D:3},ScreenSpaceEventType:{WHEEL:2},CameraEventType:{PINCH:7},Matrix4:{IDENTITY:'identity'},BoundingSphere:class{},HeadingPitchRange:class{}};
  const model={show(d,s,t){calls.push(['show',d,s,t]);return Promise.resolve('primitive');},setTimeSource(f){this.timeSource=f;},focus(t,o){calls.push(['focus',t,o]);return true;},retry(){calls.push('retry');return Promise.resolve('retry');},untrack(){calls.push('release');},clear(){calls.push('clear');},dispose(){calls.push('model_destroy');},zoomBy(){return true;},interruptCamera(){calls.push('drag');}};
  const globe=new OrbitGlobe(C,canvas,{modelLayer:model});return{globe,model,calls,inputs,oldWheel};
}
test('one Viewer receives model source callbacks; explicit focus/retry/clear delegate without propagation',async()=>{
  const f=fixture(),source={sampleAt:()=>null,timeSource:()=> '2026-10-05T00:00:00Z',advanceUtc:()=>null,onStatus:()=>{}};
  assert.equal(await f.globe.setSatelliteModel({satelliteId:25544},source),'primitive');assert.equal(f.model.timeSource,source.timeSource);assert.equal(f.model.advanceUtc,source.advanceUtc);assert.equal(f.model.onStatus,source.onStatus);
  assert.equal(f.globe.focusSatelliteModel({keepRange:true}),true);assert.equal(await f.globe.retrySatelliteModel(),'retry');f.globe.clearSatelliteModel();
  assert.deepEqual(f.calls.map(v=>Array.isArray(v)?v[0]:v),['show','focus','retry','clear']);assert.equal(f.globe.viewer.scene.preUpdate.f.size,1);f.globe.destroy();
});
test('mode change, station/point focus and destroy release model ownership; input restored',async()=>{
  const f=fixture();f.globe.viewControls.setMode=async()=>{f.calls.push('morph');return true;};await f.globe.setViewMode('2d');assert.deepEqual(f.calls,['release','morph']);
  f.globe.stationSites.set('SITE',{longitude:127,latitude:36});assert.equal(f.globe.focusStation('SITE'),true);assert.deepEqual(f.calls.slice(-2),['release','flight']);
  f.globe.position={};f.globe.focus();assert.deepEqual(f.calls.slice(-2),['release','point_focus']);
  f.globe.destroy();f.globe.destroy();assert.equal(f.inputs.get(2),f.oldWheel);assert.equal(f.calls.filter(v=>v==='model_destroy').length,1);assert.equal(f.calls.filter(v=>v==='viewer_destroy').length,1);assert.equal(f.globe.viewer.scene.preUpdate.f.size,0);
});
