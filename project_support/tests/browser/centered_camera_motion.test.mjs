import test from 'node:test';
import assert from 'node:assert/strict';
import {CenteredCameraMotion} from '../../../digital_twin/visualization/centered_camera_motion.js';
function event(){const f=new Set();return {addEventListener(fn){f.add(fn);return()=>f.delete(fn);},raise(){for(const fn of [...f])fn();},f};}
class Vector {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  static magnitude(v){return Math.hypot(v.x,v.y,v.z);}
  static multiplyByScalar(v,s,r){Object.assign(r,{x:v.x*s,y:v.y*s,z:v.z*s});return r;}
}
function fixture(){
  let time=0,override=false;const inputs=new Map(),canvas=new EventTarget(),doc=new EventTarget();canvas.clientWidth=1000;canvas.clientHeight=700;canvas.ownerDocument=doc;
  const oldWheel=()=>{},oldTypes=[2,7],oldController={zoomEventTypes:oldTypes,inertiaZoom:.9,inertiaSpin:.9,inertiaTranslate:.9,maximumMovementRatio:.1,minimumZoomDistance:1,maximumZoomDistance:9e9};inputs.set(2,oldWheel);
  const camera={positionWC:new Vector(0,0,30000000),directionWC:new Vector(.1,0,-1),upWC:new Vector(0,1,0),frustum:{left:-1000000,right:1000000,top:500000,bottom:-500000},cancelFlight(){},setView({destination,orientation}){this.positionWC=destination;this.directionWC=orientation.direction;this.upWC=orientation.up;},zoomIn(n){this.frustum.left+=n/2;this.frustum.right-=n/2;},zoomOut(n){this.zoomIn(-n);}};
  const scene={mode:3,canvas,screenSpaceCameraController:{...oldController},completeMorphOnUserInput:true,preUpdate:event(),morphStart:event(),requestRender(){}};
  const viewer={scene,camera,screenSpaceEventHandler:{getInputAction:t=>inputs.get(t),setInputAction:(fn,t)=>inputs.set(t,fn),removeInputAction:t=>inputs.delete(t)}};
  const model={interruptions:0,releases:0,zoomBy:()=>override,interruptCamera(){this.interruptions++;},untrack(){this.releases++;}};
  const C={Cartesian3:Vector,SceneMode:{MORPHING:0,SCENE2D:2,SCENE3D:3},CameraEventType:{PINCH:7},ScreenSpaceEventType:{WHEEL:2}};
  const motion=new CenteredCameraMotion(C,viewer,{model:()=>model,now:()=>time});
  return {motion,viewer,scene,camera,canvas,doc,model,inputs,oldWheel,oldController,setOverride:v=>override=v,wheel:n=>inputs.get(2)(n),advance(ms){for(let done=0;done<ms;){const dt=Math.min(16,ms-done);done+=dt;time+=dt;scene.preUpdate.raise();}}};
}
test('Earth zoom eases from original range and uses only custom wheel with pinch retained',()=>{
  const f=fixture();assert.deepEqual(f.scene.screenSpaceCameraController.zoomEventTypes,[7]);f.wheel(120);assert.equal(Vector.magnitude(f.camera.positionWC),30000000);f.advance(16);assert.ok(Vector.magnitude(f.camera.positionWC)>29000000);f.advance(3000);assert.ok(Math.abs(Vector.magnitude(f.camera.positionWC)-25058106.342338)<1);f.motion.dispose();
});
test('model wheel takeover cancels old Earth target; drag and Escape release correct owners',()=>{
  const f=fixture();f.wheel(240);f.advance(16);f.setOverride(true);f.wheel(120);const stopped=Vector.magnitude(f.camera.positionWC);f.advance(1000);assert.equal(Vector.magnitude(f.camera.positionWC),stopped);
  f.canvas.dispatchEvent(new Event('pointerdown'));assert.equal(f.model.interruptions,1);
  const esc=new Event('keydown');Object.defineProperty(esc,'key',{value:'Escape'});f.doc.dispatchEvent(esc);assert.equal(f.model.releases,1);f.motion.dispose();
});
test('map width uses original limits without changing orientation; hidden/morph cancels goals',()=>{
  const f=fixture();f.scene.mode=2;f.wheel(120);f.advance(3000);assert.ok(Math.abs(f.camera.frustum.right-f.camera.frustum.left-1670540.4228)<1);assert.equal(f.camera.directionWC.x,.1);
  f.wheel(240);f.canvas.clientWidth=0;f.advance(16);const stopped=f.camera.frustum.right-f.camera.frustum.left;f.canvas.clientWidth=1000;f.advance(1000);assert.equal(f.camera.frustum.right-f.camera.frustum.left,stopped);
  f.scene.mode=0;assert.equal(f.motion.zoomBy(120),false);f.scene.morphStart.raise();assert.equal(f.model.releases,1);f.motion.dispose();
});
test('dispose restores existing controller/wheel/morph policy and removes every owned listener',()=>{
  const f=fixture();f.motion.dispose();f.motion.dispose();assert.equal(f.inputs.get(2),f.oldWheel);assert.deepEqual(f.scene.screenSpaceCameraController,f.oldController);assert.equal(f.scene.completeMorphOnUserInput,true);assert.equal(f.scene.preUpdate.f.size,0);assert.equal(f.scene.morphStart.f.size,0);
  f.canvas.dispatchEvent(new Event('pointerdown'));assert.equal(f.model.interruptions,0);const esc=new Event('keydown');Object.defineProperty(esc,'key',{value:'Escape'});f.doc.dispatchEvent(esc);assert.equal(f.model.releases,0);
});
test('newer handler/controller changes survive teardown',()=>{const f=fixture(),newWheel=()=>{};f.inputs.set(2,newWheel);f.scene.screenSpaceCameraController.inertiaZoom=.4;f.motion.dispose();assert.equal(f.inputs.get(2),newWheel);assert.equal(f.scene.screenSpaceCameraController.inertiaZoom,.4);});
test('an incomplete Viewer boundary installs nothing and remains safe to dispose',()=>{
  const motion=new CenteredCameraMotion({}, {scene:{canvas:{}},camera:{}});
  assert.doesNotThrow(()=>motion.dispose());assert.doesNotThrow(()=>motion.dispose());
});

test('source logarithmic slider preserves Earth/map limits and uses existing eased owner',()=>{
 const f=fixture();const state=f.motion.zoomState();
 assert.equal(state.minimum,6498137);assert.equal(state.maximum,1006378137);
 assert.equal(state.zoom,100*Math.log(state.maximum/30000000)/Math.log(state.maximum/state.minimum));
 assert.equal(f.motion.setZoom(100),true);assert.equal(Vector.magnitude(f.camera.positionWC),30000000);
 f.advance(3000);assert.ok(Math.abs(Vector.magnitude(f.camera.positionWC)-6498137)<1);
 f.scene.mode=2;assert.equal(f.motion.setZoom(0),true);f.advance(3000);assert.ok(Math.abs(f.camera.frustum.right-f.camera.frustum.left-40000000)<1);
 f.scene.mode=0;assert.equal(f.motion.zoomState(),null);assert.equal(f.motion.setZoom(50),false);
 f.motion.dispose();assert.equal(f.motion.setZoom(50),false);assert.equal(f.motion.zoomState(),null);
});

test('source slider delegates tracking to existing model and cancels pending Earth motion',()=>{
 const f=fixture(),calls=[];f.wheel(120);f.model.tracking=true;f.model.current={sizeMeters:10};f.model.zoomDistance=()=>100;
 f.model.setZoomDistance=value=>{calls.push(value);return true;};
 assert.equal(f.motion.zoomState().minimum,6);assert.equal(f.motion.setZoom(100),true);assert.deepEqual(calls,[6]);assert.equal(f.motion.range.active,false);
 assert.equal(f.motion.setZoom(NaN),false);f.motion.dispose();
});

test('source home keeps viewport fit and releases the same tracking owner without a new clock',()=>{
 const f=fixture(),calls=[];f.camera.flyTo=value=>calls.push(value);f.camera.flyHome=value=>calls.push(value);
 f.motion.C.Cartesian3.fromDegrees=(lon,lat,height)=>({lon,lat,height});f.motion.C.Math={toRadians:degrees=>degrees*Math.PI/180};
 assert.equal(f.motion.home(),true);assert.equal(f.model.releases,1);assert.equal(calls[0].destination.lon,126.9);assert.equal(calls[0].destination.lat,20);
 const halfFov=Math.atan(Math.tan(Math.PI/6)/(1000/700));assert.equal(calls[0].destination.height,8000000/Math.sin(halfFov)*1.06-6378137);assert.equal(calls[0].duration,1.4);
 f.scene.mode=2;assert.equal(f.motion.home(),true);assert.equal(calls[1],1.4);
 f.scene.mode=0;assert.equal(f.motion.home(),false);assert.equal(calls.length,2);f.motion.dispose();assert.equal(f.motion.home(),false);
});
