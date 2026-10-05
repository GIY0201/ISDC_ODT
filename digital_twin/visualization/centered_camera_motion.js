import {CameraRangeMotion, cameraNow, cameraDirection, cameraBasis} from './camera_motion.js';

/** Original Earth-centred wheel policy, one injected Viewer and reversible input ownership. */
export class CenteredCameraMotion {
  constructor(C, viewer, {model = () => null, now = cameraNow} = {}) {
    this.C = C; this.viewer = viewer; this.model = model; this.now = now;
    this.range = new CameraRangeMotion({now}); this.removers = []; this.disposed = false;
    const {scene, screenSpaceEventHandler: handler} = viewer;
    const controller = scene.screenSpaceCameraController;
    if (!controller || !handler?.getInputAction || !handler?.setInputAction || !handler?.removeInputAction || !C.CameraEventType || !C.ScreenSpaceEventType) return;
    this.handler = handler; this.wheelType = C.ScreenSpaceEventType.WHEEL;
    this.previousWheel = handler.getInputAction(this.wheelType);
    this.previous = {}; this.applied = {zoomEventTypes: [C.CameraEventType.PINCH], inertiaZoom:.75,
      inertiaSpin:.86, inertiaTranslate:.82, maximumMovementRatio:.08,
      minimumZoomDistance:100000, maximumZoomDistance:1200000000};
    for (const [key,value] of Object.entries(this.applied)) {this.previous[key] = {exists:key in controller,value:controller[key]};controller[key] = value;}
    this.previousMorph = {exists:'completeMorphOnUserInput' in scene,value:scene.completeMorphOnUserInput};
    scene.completeMorphOnUserInput = false;
    this.wheel = delta => this.zoomBy(delta); handler.setInputAction(this.wheel,this.wheelType);
    const frame = scene.preUpdate?.addEventListener(() => this.advance()); if(frame)this.removers.push(frame);
    const morph = scene.morphStart?.addEventListener(() => this.release()); if(morph)this.removers.push(morph);
    this.pointer = () => {if(this.transitioning())return;this.cancel();viewer.camera.cancelFlight?.();this.model()?.interruptCamera();};
    scene.canvas?.addEventListener?.('pointerdown',this.pointer,{capture:true});
    this.document = scene.canvas?.ownerDocument;
    this.escape = event => {if(event.key==='Escape'&&!event.defaultPrevented)this.release({aimAtEarth:true});};
    this.document?.addEventListener('keydown',this.escape);
  }
  transitioning(){return this.viewer.scene.mode===this.C.SceneMode.MORPHING;}
  cancel(){this.range.cancel();}
  release(options){this.cancel();this.model()?.untrack(options);}
  distance(){const {scene,camera}=this.viewer;return scene.mode===this.C.SceneMode.SCENE2D?camera.frustum.right-camera.frustum.left:this.C.Cartesian3.magnitude(camera.positionWC);}
  zoomBy(delta){
    delta=Number(delta);if(this.disposed||!Number.isFinite(delta)||!delta||this.transitioning())return false;
    const {scene,camera}=this.viewer;
    if(this.model()?.zoomBy(delta)){this.cancel();scene.requestRender();return true;}
    camera.cancelFlight?.();const map=scene.mode===this.C.SceneMode.SCENE2D;
    const ok=this.range.wheel(this.distance(),delta,{minimum:map?1000:6498137,maximum:map?40000000:1006378137});
    this.mode=scene.mode;this.stamp=this.now();scene.requestRender();return ok;
  }
  advance(){
    if(this.disposed||!this.range.active)return;
    const {scene,camera}=this.viewer,C=this.C,canvas=scene.canvas;
    if(this.transitioning()||scene.mode!==this.mode||(canvas&&(!canvas.clientWidth||!canvas.clientHeight))){this.cancel();return;}
    const current=this.distance(),distance=this.range.advance(current),now=this.now(),dt=Math.max(0,Math.min(50,now-this.stamp));this.stamp=now;
    if(!(current>0)||!Number.isFinite(distance)){this.cancel();return;}
    if(scene.mode===C.SceneMode.SCENE2D){const amount=current-distance;if(amount>0)camera.zoomIn(amount);else if(amount<0)camera.zoomOut(-amount);}
    else{
      const destination=C.Cartesian3.multiplyByScalar(camera.positionWC,distance/current,new C.Cartesian3());
      const direction=cameraDirection(camera.directionWC,{x:-destination.x,y:-destination.y,z:-destination.z},-Math.expm1(-dt/150));
      const basis=cameraBasis(direction,camera.upWC);
      camera.setView({destination,orientation:{direction:new C.Cartesian3(basis.direction.x,basis.direction.y,basis.direction.z),up:new C.Cartesian3(basis.up.x,basis.up.y,basis.up.z)}});
    }
    scene.requestRender();
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.cancel();
    for(const remove of this.removers.splice(0))remove();
    const {scene}=this.viewer;
    scene.canvas?.removeEventListener?.('pointerdown',this.pointer,{capture:true});this.document?.removeEventListener('keydown',this.escape);
    if(this.handler&&this.handler.getInputAction(this.wheelType)===this.wheel){if(this.previousWheel)this.handler.setInputAction(this.previousWheel,this.wheelType);else this.handler.removeInputAction(this.wheelType);}
    for(const [key,value]of Object.entries(this.applied??{}))if(scene.screenSpaceCameraController[key]===value){const old=this.previous[key];if(old.exists)scene.screenSpaceCameraController[key]=old.value;else delete scene.screenSpaceCameraController[key];}
    if(this.previousMorph&&scene.completeMorphOnUserInput===false){if(this.previousMorph.exists)scene.completeMorphOnUserInput=this.previousMorph.value;else delete scene.completeMorphOnUserInput;}
  }
}
