/** Static GP display only. Caller supplies ITRF metres and UTC; no propagation or transport. */
export class OrbitGlobe {
  constructor(Cesium,container){
    this.C=Cesium;this.position=null;this.destroyed=false;this.stationEntities=new Map();this.stationSites=new Map();this.stationIds=new Map();this.selectedStation=null;
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
    this.entity.name=sample.name?`${sample.name} · GP epoch 모델`:'ISS · SGP4 모델';
    this.entity.label.text=sample.name?`${sample.name} · epoch 모델`:'ISS · GP 예측';
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
    if(!valid){if(this.groundEntity)viewer.entities.remove(this.groundEntity);this.groundEntity=null;this.groundKey=null;viewer.scene.requestRender();return false;}
    const key=[point.latitude_deg,point.longitude_deg,point.ellipsoid_height_m].join(':');
    if(this.groundEntity&&this.groundKey===key)return true;
    this.groundKey=key;
    const position=C.Cartesian3.fromDegrees(point.longitude_deg,point.latitude_deg,point.ellipsoid_height_m);
    const property=new C.ConstantPositionProperty(position,C.ReferenceFrame.FIXED);
    if(this.groundEntity)this.groundEntity.position=property;
    else this.groundEntity=viewer.entities.add({id:'virtual-ground-point',name:'가상 지점 · WGS84 타원체 높이',position:property,point:{pixelSize:10,color:C.Color.fromCssColorString('#ffbd66'),outlineColor:C.Color.WHITE,outlineWidth:2},label:{text:'가상 지점 · 통신 미확인',font:'13px sans-serif',fillColor:C.Color.WHITE}});
    viewer.scene.requestRender();return true;
  }
  setStations(sites,onSelect=()=>{}){
    if(this.destroyed)return false;
    if(!Array.isArray(sites)||sites.some(site=>!site||typeof site.key!=='string'||!/^[A-Z0-9_]+$/.test(site.key)||typeof site.name!=='string'||![site.longitude,site.latitude,site.altitudeKm].every(Number.isFinite)||Math.abs(site.latitude)>90||Math.abs(site.longitude)>180)||new Set(sites.map(s=>s.key)).size!==sites.length)return false;
    this.onStationSelect=onSelect;
    const signature=JSON.stringify(sites);
    if(signature!==this.stationSignature){
      for(const entity of this.stationEntities.values())this.viewer.entities.remove(entity);
      this.stationEntities.clear();this.stationSites.clear();this.stationIds.clear();
      const {C,viewer}=this;
      for(const raw of sites){const site=structuredClone(raw);const id=`reference-ground-${site.key}`;
        const entity=viewer.entities.add({id,name:`${site.name} · 원본 대표 지상국`,position:new C.ConstantPositionProperty(C.Cartesian3.fromDegrees(site.longitude,site.latitude,site.altitudeKm*1000),C.ReferenceFrame.FIXED),point:{pixelSize:6,color:C.Color.fromCssColorString('#ffbf47'),outlineColor:C.Color.WHITE,outlineWidth:1.5},label:{text:`${site.name} · 대표 설정`,font:'12px sans-serif',fillColor:C.Color.WHITE,pixelOffset:C.Cartesian2?new C.Cartesian2(0,15):undefined}});
        this.stationEntities.set(site.key,entity);this.stationSites.set(site.key,site);this.stationIds.set(id,site.key);
      }
      this.stationSignature=signature;this.selectStation(this.stationSites.has(this.selectedStation)?this.selectedStation:null);
    }
    const {C,viewer}=this;
    if(!this.stationPickHandler&&C.ScreenSpaceEventHandler&&C.ScreenSpaceEventType){
      this.stationPickHandler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);
      this.stationPickHandler.setInputAction(event=>{
        if(this.destroyed)return;
        const picked=viewer.scene.pick(event.position);const id=picked?.id?.id??picked?.id;
        let key=this.stationIds.get(id);
        // A colocated virtual observer must not hide the reference-site selector.
        if(!key&&id==='virtual-ground-point'&&viewer.scene.drillPick)key=viewer.scene.drillPick(event.position,4).map(value=>this.stationIds.get(value?.id?.id??value?.id)).find(Boolean);
        if(key)this.onStationSelect?.(key);
      },C.ScreenSpaceEventType.LEFT_CLICK);
    }
    viewer.scene.requestRender();return true;
  }
  selectStation(key){
    if(this.destroyed||key!==null&&!this.stationEntities.has(key))return false;
    this.selectedStation=key;const {C}=this;
    for(const [name,entity]of this.stationEntities){const selected=name===key;
      entity.point.pixelSize=selected?10:6;entity.point.color=C.Color.fromCssColorString(selected?'#ffd97a':'#ffbf47');entity.point.outlineWidth=selected?2:1.5;
      entity.label.show=selected;
    }
    this.viewer.scene.requestRender();return true;
  }
  focusStation(key){
    const site=this.stationSites.get(key);if(this.destroyed||!site||!this.viewer.camera.flyTo)return false;
    this.viewer.camera.flyTo({destination:this.C.Cartesian3.fromDegrees(site.longitude,site.latitude,2500000),orientation:{heading:0,pitch:-89*Math.PI/180,roll:0},duration:1.2});return true;
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
  destroy(){if(this.destroyed)return;this.destroyed=true;this.position=null;this.stationPickHandler?.destroy();this.stationPickHandler=null;this.stationEntities.clear();this.stationSites.clear();this.stationIds.clear();this.viewer.destroy();}
}
