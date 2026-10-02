/** Static GP display only. Caller supplies ITRF metres and UTC; no propagation or transport. */
export class OrbitGlobe {
  constructor(Cesium,container){
    this.C=Cesium;this.position=null;this.destroyed=false;
    this.viewer=new Cesium.Viewer(container,{
      baseLayer:false,terrainProvider:new Cesium.EllipsoidTerrainProvider(),
      animation:false,timeline:false,geocoder:false,homeButton:false,
      sceneModePicker:false,baseLayerPicker:false,navigationHelpButton:false,
      fullscreenButton:false,infoBox:false,selectionIndicator:false,
      requestRenderMode:true,maximumRenderTimeChange:Infinity,shouldAnimate:false,
    });
    this.viewer.scene.globe.baseColor=Cesium.Color.fromCssColorString('#225c77');
    this.viewer.clock.shouldAnimate=false;
  }
  update(sample){
    if(this.destroyed)throw new Error('OrbitGlobe destroyed');
    const {C,viewer}=this;
    viewer.entities.removeAll();this.position=null;
    const coordinates=sample?.position_m;
    if(sample?.frame!=='ITRF'||!Array.isArray(coordinates)||coordinates.length!==3||!coordinates.every(Number.isFinite)||!sample.utc?.endsWith('Z')){
      viewer.scene.requestRender();return false;
    }
    let utc;
    try{utc=C.JulianDate.fromIso8601(sample.utc);}catch{viewer.scene.requestRender();return false;}
    this.position=new C.Cartesian3(...coordinates);
    viewer.clock.currentTime=utc;
    viewer.entities.add({id:'stored-orbit-satellite',name:'ISS · SGP4 모델',
      position:new C.ConstantPositionProperty(this.position,C.ReferenceFrame.FIXED),
      point:{pixelSize:11,color:C.Color.CYAN,outlineColor:C.Color.WHITE,outlineWidth:2},
      label:{text:'ISS · GP 예측',font:'13px sans-serif',fillColor:C.Color.WHITE},
    });
    viewer.scene.requestRender();return true;
  }
  focus(){
    if(!this.position||this.destroyed)return false;
    const {C,viewer}=this;
    viewer.camera.viewBoundingSphere(new C.BoundingSphere(this.position,800000),new C.HeadingPitchRange(0,-Math.PI/2,12000000));
    viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);viewer.scene.requestRender();return true;
  }
  setImagery(provider){
    if(this.destroyed)return;
    this.viewer.imageryLayers.addImageryProvider(provider);this.viewer.scene.requestRender();
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;this.position=null;this.viewer.destroy();}
}
