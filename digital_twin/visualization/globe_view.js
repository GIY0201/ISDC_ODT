/** Original display policy, injected single Viewer. No clock, propagation or runtime state. */
export class GlobeView {
  constructor(C,viewer,createProvider,onStatus=()=>{}){
    this.C=C;this.viewer=viewer;this.createProvider=createProvider;this.onStatus=onStatus;
    this.theme='dark';this.emphasis=true;this.mode='3d';this.displayedImagery=null;
    this.imageryGeneration=0;this.modeGeneration=0;this.destroyed=false;
  }
  async setMode(mode){
    if(!['2d','3d'].includes(mode))throw Error('Invalid globe mode');
    if(this.destroyed)return false;
    ++this.modeGeneration;
    this.cancelMorph?.();
    return new Promise((resolve,reject)=>{
      const request={mode,resolve,reject};this.modeRequest=request;
      this.cancelMorph=()=>{
        if(this.modeRequest!==request)return;
        this.modeRequest=null;this.cancelMorph=null;resolve(false);
      };
      this._advanceMode();
    });
  }
  _advanceMode(){
    const request=this.modeRequest;
    if(this.destroyed||!request)return;
    const {scene,camera}=this.viewer,C=this.C;
    const target=request.mode==='2d'?C.SceneMode.SCENE2D:C.SceneMode.SCENE3D;
    // User-input morph completion is deliberately disabled by our camera owner.
    // Keep the physical transition listener when a caller is superseded; Cesium
    // ignores another morph request until the current transition has finished.
    if(scene.mode===C.SceneMode.MORPHING||scene.mode!==target){
      if(this.removeMorph)return;
      this.removeMorph=scene.morphComplete.addEventListener(()=>{
        this.removeMorph?.();this.removeMorph=null;this._advanceMode();
      });
      if(scene.mode===C.SceneMode.MORPHING)return;
      camera.cancelFlight();camera.lookAtTransform(C.Matrix4.IDENTITY);
      try{if(request.mode==='2d')scene.morphTo2D(1.5);else scene.morphTo3D(1.5);}
      catch(error){
        this.removeMorph?.();this.removeMorph=null;
        if(this.modeRequest===request){this.modeRequest=null;this.cancelMorph=null;request.reject(error);}
      }
      return;
    }
    camera.cancelFlight();camera.lookAtTransform(C.Matrix4.IDENTITY);
    const is2D=request.mode==='2d',controller=scene.screenSpaceCameraController;
    controller.enableRotate=!is2D;controller.enableTilt=!is2D;controller.minimumZoomDistance=is2D?1000:100000;
    if(is2D){camera.direction=new C.Cartesian3(0,0,-1);camera.up=new C.Cartesian3(0,1,0);camera.right=new C.Cartesian3(1,0,0);}
    this.mode=request.mode;this.modeRequest=null;this.cancelMorph=null;
    scene.requestRender();request.resolve(true);
  }
  async setImagery(mode){
    if(!['blue_marble','satellite','osm','natural'].includes(mode))throw Error('Invalid globe imagery');
    if(this.destroyed)return false;
    const generation=++this.imageryGeneration;
    this._status(mode,'pending',null);
    return this._load(mode,mode,generation,null);
  }
  _status(requestedImagery,phase,error){
    this.onStatus({requestedImagery,displayedImagery:this.displayedImagery,phase,error});
  }
  async _load(mode,requested,generation,fallbackError){
    try{
      const provider=await this.createProvider(mode);
      if(this.destroyed||generation!==this.imageryGeneration)return false;
      const layer=this.viewer.imageryLayers.addImageryProvider(provider),previous=this.layer;
      this.removeTileError?.();this.removeTileError=null;
      this.layer=layer;this.displayedImagery=mode;
      if(previous)this.viewer.imageryLayers.remove(previous,true);
      this.removeTileError=provider.errorEvent?.addEventListener(error=>{
        if(this.destroyed||generation!==this.imageryGeneration||this.layer!==layer)return;
        // Remove before requesting fallback: many failing tiles must not spawn many requests.
        this.removeTileError?.();this.removeTileError=null;
        const reason=String(error?.message||'지도 타일을 불러올 수 없습니다.');
        if(mode==='natural'){this._status(requested,'error',reason);return;}
        this._status(requested,'pending',reason);
        void this._load('natural',requested,generation,reason);
      })??null;
      this.applyStyle();this._status(requested,fallbackError?'fallback':'ready',fallbackError);
      return true;
    }catch(error){
      if(this.destroyed||generation!==this.imageryGeneration)return false;
      const reason=String(error?.message||error);
      if(mode!=='natural')return this._load('natural',requested,generation,reason);
      this._status(requested,'error',fallbackError?`${fallbackError}; Natural Earth: ${reason}`:reason);
      return false;
    }
  }
  setStyle(theme,emphasis){
    if(!['dark','light'].includes(theme)||typeof emphasis!=='boolean')throw Error('Invalid globe style');
    if(this.destroyed)return false;
    this.theme=theme;this.emphasis=emphasis;this.applyStyle();return true;
  }
  applyStyle(){
    const satellite=['satellite','blue_marble'].includes(this.displayedImagery),light=this.theme==='light';
    let values,base;
    if(light){values=[satellite?1.18:1.08,1.04,1.05,1];base='#c9d6e3';}
    else if(this.emphasis){values=[satellite?.56:.66,satellite?1.28:1.18,satellite?.5:.58,.88];base='#07111d';}
    else{values=[satellite?1.05:1,satellite?1.08:1,satellite?1.08:1,1];base='#173955';}
    if(this.layer)[this.layer.brightness,this.layer.contrast,this.layer.saturation,this.layer.gamma]=values;
    this.viewer.scene.globe.baseColor=this.C.Color.fromCssColorString(base);
    this.viewer.scene.requestRender();
  }
  destroy(){
    if(this.destroyed)return;this.destroyed=true;++this.imageryGeneration;++this.modeGeneration;
    this.cancelMorph?.();this.cancelMorph=null;this.removeMorph?.();this.removeMorph=null;this.removeTileError?.();this.removeTileError=null;
    if(this.layer)this.viewer.imageryLayers.remove(this.layer,true);this.layer=null;
  }
}
