import test from 'node:test';
import assert from 'node:assert/strict';
import {GlobeView} from '../../../digital_twin/visualization/globe_view.js';

function event(){const listeners=new Set();return{listeners,addEventListener(fn){listeners.add(fn);return()=>listeners.delete(fn);},raise(...args){for(const fn of [...listeners])fn(...args);}};}
function fixture(factory=async()=>({errorEvent:event()})){
  const layers=[],states=[],morph=event(),calls=[];
  const C={SceneMode:{SCENE2D:2,SCENE3D:3,MORPHING:0},Matrix4:{IDENTITY:'identity'},Cartesian3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}},Color:{fromCssColorString:x=>x}};
  const viewer={scene:{mode:3,globe:{},morphComplete:morph,screenSpaceCameraController:{},requestRender(){},completeMorph(){calls.push('complete');morph.raise();},morphTo2D(seconds){calls.push(['2d',seconds]);this.mode=0;},morphTo3D(seconds){calls.push(['3d',seconds]);this.mode=0;}},camera:{cancelFlight(){calls.push('cancel');},lookAtTransform(x){calls.push(x);}},imageryLayers:{addImageryProvider(provider){const layer={provider};layers.push(layer);return layer;},remove(layer){layers.splice(layers.indexOf(layer),1);}}};
  const view=new GlobeView(C,viewer,factory,state=>states.push(state));
  return{view,viewer,layers,states,morph,calls};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};

test('rapid mode switch settles prior request and north-up2D; destroy cleans morph',async()=>{
  const {view,viewer,morph,calls}=fixture();
  const old=view.setMode('2d');const latest=view.setMode('3d');assert.equal(await old,false);
  viewer.scene.mode=2;morph.raise();
  assert.equal(viewer.scene.mode,0);assert.deepEqual(calls.filter(Array.isArray),[['2d',1.5],['3d',1.5]]);
  viewer.scene.mode=3;morph.raise();assert.equal(await latest,true);assert.equal(morph.listeners.size,0);
  const two=view.setMode('2d');viewer.scene.mode=2;morph.raise();assert.equal(await two,true);
  assert.equal(viewer.scene.screenSpaceCameraController.enableRotate,false);assert.equal(viewer.scene.screenSpaceCameraController.enableTilt,false);assert.equal(viewer.scene.screenSpaceCameraController.minimumZoomDistance,1000);
  assert.deepEqual({...viewer.camera.up},{x:0,y:1,z:0});assert.ok(calls.some(x=>Array.isArray(x)&&x[1]===1.5));
  const pending=view.setMode('3d');view.destroy();assert.equal(await pending,false);assert.equal(morph.listeners.size,0);
  await assert.rejects(()=>view.setMode('invalid'));assert.equal(await view.setMode('2d'),false);
});
test('non-interruptible morph waits for completion and applies only the latest queued mode',async()=>{
  const {view,viewer,morph,calls}=fixture();
  viewer.scene.completeMorphOnUserInput=false;
  viewer.scene.completeMorph=()=>{calls.push('ineffective-complete');};
  const first=view.setMode('2d'),obsolete=view.setMode('3d'),latest=view.setMode('2d');
  assert.equal(await first,false);assert.equal(await obsolete,false);
  assert.deepEqual(calls.filter(Array.isArray),[['2d',1.5]]);
  assert.equal(morph.listeners.size,1);
  viewer.scene.mode=2;morph.raise();assert.equal(await latest,true);
  assert.equal(view.mode,'2d');assert.equal(morph.listeners.size,0);
  assert.equal(viewer.scene.completeMorphOnUserInput,false);
  assert.equal(calls.includes('ineffective-complete'),false);
  const active=view.setMode('3d'),queued=view.setMode('2d');
  assert.equal(await active,false);view.destroy();assert.equal(await queued,false);
  viewer.scene.mode=3;morph.raise();assert.equal(view.mode,'2d');assert.equal(morph.listeners.size,0);
});
test('map load is atomic/latest-only and retains unrelated overlays; stale errors cannot fallback',async()=>{
  const requests=new Map(),{view,layers,states}=fixture(mode=>{const d=deferred();requests.set(mode,d);return d.promise;});
  const overlay={overlay:true};layers.push(overlay);
  const first=view.setImagery('satellite'),next=view.setImagery('osm');requests.get('osm').resolve({errorEvent:event()});assert.equal(await next,true);
  requests.get('satellite').reject(Error('old'));assert.equal(await first,false);assert.equal(layers.length,2);assert.equal(layers[0],overlay);assert.equal(states.at(-1).displayedImagery,'osm');assert.equal(requests.has('natural'),false);
  view.destroy();assert.deepEqual(layers,[overlay]);
});
test('source failure and tile failure explicitly fallback; failed fallback keeps last valid map',async()=>{
  let failNatural=false;const providers={};const {view,layers,states}=fixture(async mode=>{if(mode==='satellite'||mode==='natural'&&failNatural)throw Error(`${mode} failed`);return providers[mode]={errorEvent:event()};});
  await view.setImagery('blue_marble');const previous=layers[0];failNatural=true;
  assert.equal(await view.setImagery('satellite'),false);assert.equal(layers[0],previous);assert.equal(states.at(-1).phase,'error');assert.equal(states.at(-1).displayedImagery,'blue_marble');
  failNatural=false;assert.equal(await view.setImagery('satellite'),true);assert.equal(states.at(-1).phase,'fallback');assert.equal(states.at(-1).requestedImagery,'satellite');assert.equal(states.at(-1).displayedImagery,'natural');
  await view.setImagery('osm');const obsolete=providers.osm.errorEvent;obsolete.raise(Error('tile'));await new Promise(resolve=>setImmediate(resolve));assert.equal(states.at(-1).phase,'fallback');assert.equal(obsolete.listeners.size,0);
  view.destroy();assert.equal(providers.natural.errorEvent.listeners.size,0);
});
test('styles preserve original satellite/light/plain constants without enabling unknown sunlight',async()=>{
  const {view,layers,viewer}=fixture();await view.setImagery('blue_marble');const layer=layers[0];
  assert.deepEqual([layer.brightness,layer.contrast,layer.saturation,layer.gamma],[.56,1.28,.5,.88]);assert.equal(viewer.scene.globe.baseColor,'#07111d');
  view.setStyle('light',true);assert.deepEqual([layer.brightness,layer.contrast,layer.saturation,layer.gamma],[1.18,1.04,1.05,1]);assert.equal(viewer.scene.globe.baseColor,'#c9d6e3');
  view.setStyle('dark',false);assert.deepEqual([layer.brightness,layer.contrast,layer.saturation,layer.gamma],[1.05,1.08,1.08,1]);assert.equal(viewer.scene.globe.baseColor,'#173955');
  assert.equal(viewer.scene.globe.enableLighting,undefined);assert.throws(()=>view.setStyle('unknown',true));assert.throws(()=>view.setStyle('dark','true'));await assert.rejects(()=>view.setImagery('unknown'));
  view.destroy();view.destroy();
});
test('destroy during provider request prevents all late layers/status/listeners',async()=>{
  const d=deferred(),{view,layers,states}=fixture(()=>d.promise);
  const pending=view.setImagery('osm');const count=states.length;view.destroy();
  const provider={errorEvent:event()};d.resolve(provider);assert.equal(await pending,false);
  assert.equal(layers.length,0);assert.equal(states.length,count);assert.equal(provider.errorEvent.listeners.size,0);
  assert.equal(await view.setImagery('natural'),false);
});
test('NaturalEarth first load failure is error without invented displayed map or retry',async()=>{
  let calls=0;const {view,layers,states}=fixture(async()=>{calls++;throw Error('missing tiles');});
  assert.equal(await view.setImagery('natural'),false);assert.equal(calls,1);assert.equal(layers.length,0);
  assert.equal(states.at(-1).phase,'error');assert.equal(states.at(-1).displayedImagery,null);
});
