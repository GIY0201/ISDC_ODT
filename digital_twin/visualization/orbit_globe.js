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
    const coordinates=sample?.position_m;
    if(sample?.frame!=='ITRF'||!Array.isArray(coordinates)||coordinates.length!==3||!coordinates.every(Number.isFinite)||!sample.utc?.endsWith('Z')){
      this.clearSatellite();viewer.scene.requestRender();return false;
    }
    let utc;
    try{utc=C.JulianDate.fromIso8601(sample.utc);}catch{this.clearSatellite();viewer.scene.requestRender();return false;}
    this.position=new C.Cartesian3(...coordinates);
    viewer.clock.currentTime=utc;
    if(this.entity)this.entity.position=new C.ConstantPositionProperty(this.position,C.ReferenceFrame.FIXED);
    else this.entity=viewer.entities.add({id:'stored-orbit-satellite',name:'ISS · SGP4 모델',
      position:new C.ConstantPositionProperty(this.position,C.ReferenceFrame.FIXED),
      point:{pixelSize:11,color:C.Color.CYAN,outlineColor:C.Color.WHITE,outlineWidth:2},
      label:{text:'ISS · GP 예측',font:'13px sans-serif',fillColor:C.Color.WHITE},
    });
    viewer.scene.requestRender();return true;
  }
  clearSatellite(){
    if(this.entity){if(this.viewer.entities.remove)this.viewer.entities.remove(this.entity);else this.viewer.entities.removeAll();}
    this.entity=null;this.position=null;
  }
  setGroundPoint(point){
    if(this.destroyed)return;
    const {C,viewer}=this;
    const valid=point?.virtual===true&&point.ellipsoid==='WGS84'&&[point.latitude_deg,point.longitude_deg,point.ellipsoid_height_m].every(Number.isFinite)&&Math.abs(point.latitude_deg)<=90&&Math.abs(point.longitude_deg)<=180;
    if(!valid){if(this.groundEntity)viewer.entities.remove(this.groundEntity);this.groundEntity=null;viewer.scene.requestRender();return false;}
    const position=C.Cartesian3.fromDegrees(point.longitude_deg,point.latitude_deg,point.ellipsoid_height_m);
    const property=new C.ConstantPositionProperty(position,C.ReferenceFrame.FIXED);
    if(this.groundEntity)this.groundEntity.position=property;
    else this.groundEntity=viewer.entities.add({id:'virtual-ground-point',name:'가상 지점 · WGS84 타원체 높이',position:property,point:{pixelSize:10,color:C.Color.fromCssColorString('#ffbd66'),outlineColor:C.Color.WHITE,outlineWidth:2},label:{text:'가상 지점 · 통신 미확인',font:'13px sans-serif',fillColor:C.Color.WHITE}});
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
