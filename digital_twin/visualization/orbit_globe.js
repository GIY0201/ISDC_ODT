import {GlobeView} from './globe_view.js';
import {SatelliteModelLayer} from './satellite_model.js';
import {CenteredCameraMotion} from './centered_camera_motion.js';
const PALETTES={dark:{LEO:'#ff9f43',MEO:'#e6ed55',GEO:'#5ee277',HEO:'#53c8ff',selected:'#efff62',outline:'#061528'},light:{LEO:'#c9651a',MEO:'#8f8a12',GEO:'#1f8a55',HEO:'#1f7fa8',selected:'#d35400',outline:'#ffffff'}};
/** Native GP display only. Caller supplies ITRF metres and UTC; no propagation or transport. */
export class OrbitGlobe {
  constructor(Cesium,container,options={}){
    this.container=container;this.hoveredCatalog=null;
    this.C=Cesium;this.position=null;this.destroyed=false;this.stationEntities=new Map();this.stationSites=new Map();this.stationIds=new Map();this.selectedStation=null;this.catalogPoints=new Map();this.catalogLabels=new Map();this.catalogHashes=new Map();this.catalogStyles=new Map();this.catalogEpochs=new Map();this.catalogValid=new Set();this.selectedCatalog=null;
    this.viewer=new Cesium.Viewer(container,{
      baseLayer:false,terrainProvider:new Cesium.EllipsoidTerrainProvider(),
      animation:false,timeline:false,geocoder:false,homeButton:false,
      sceneModePicker:false,baseLayerPicker:false,navigationHelpButton:false,
      fullscreenButton:false,infoBox:false,selectionIndicator:false,
      requestRenderMode:true,maximumRenderTimeChange:Infinity,shouldAnimate:false,
    });
    this.viewer.scene.globe.baseColor=Cesium.Color.fromCssColorString('#225c77');
    this.viewer.clock.shouldAnimate=false;
    this.catalogVisuals=new Map();
    this.viewControls=new GlobeView(Cesium,this.viewer,options.createProvider,options.onStatus);
    this.modelLayer=options.modelLayer??null;
    this.cameraMotion=new CenteredCameraMotion(Cesium,this.viewer,{model:()=>this.modelLayer,now:options.motionNow});
  }
  async setSatelliteModel(description,source){
    if(this.destroyed)return null;
    if(!this.modelLayer)this.modelLayer=new SatelliteModelLayer({viewer:this.viewer,cesium:this.C,isTransitioning:()=>Boolean(this.viewControls.cancelMorph),onCameraInput:()=>this.cameraMotion.cancel(),onFrame:()=>{if(this.modelLayer?.tracking)this.viewer.scene.requestRender();}});
    this.modelLayer.setTimeSource(source.timeSource);this.modelLayer.advanceUtc=source.advanceUtc;
    this.modelLayer.onStatus=source.onStatus??(()=>{});
    return this.modelLayer.show(description,source.sampleAt,source.timeSource?.());
  }
  focusSatelliteModel(options={}){if(this.destroyed)return false;this.cameraMotion.cancel();return this.modelLayer?.focus(undefined,options)??false;}
  releaseSatelliteModel(options){if(!this.destroyed)this.cameraMotion.release(options);}
  retrySatelliteModel(){return this.destroyed?Promise.resolve(null):this.modelLayer?.retry()??Promise.resolve(null);}
  clearSatelliteModel(){if(!this.destroyed){this.cameraMotion.cancel();this.modelLayer?.clear();}}
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
    this._selectCatalogMarker(sample.catalog_number,sample.normalized_gp_sha256);
    viewer.clock.currentTime=utc;
    if(this.entity)this.entity.position=new C.ConstantPositionProperty(this.position,C.ReferenceFrame.FIXED);
    else this.entity=viewer.entities.add({id:'stored-orbit-satellite',name:'ISS · SGP4 모델',
      position:new C.ConstantPositionProperty(this.position,C.ReferenceFrame.FIXED),
      point:{pixelSize:11,color:C.Color.CYAN,outlineColor:C.Color.WHITE,outlineWidth:2},
      label:{text:'ISS · GP 예측',font:'13px sans-serif',fillColor:C.Color.WHITE},
    });
    this.entity.name=sample.name?`${sample.name} · SGP4 모델`:'ISS · SGP4 모델';
    this.entity.label.text=sample.name?`${sample.name} · GP 모델`:'ISS · GP 예측';
    this._styleSelected();
    viewer.scene.requestRender();return true;
  }
  clearSatellite(){
    this._selectCatalogMarker(null);
    if(this.entity){if(this.viewer.entities.remove)this.viewer.entities.remove(this.entity);else this.viewer.entities.removeAll();}
    this.entity=null;this.position=null;
  }
  setCatalogTrack(value){
    if(this.destroyed)return false;
    this.trackEntities??=[];
    for(const entity of this.trackEntities)this.viewer.entities.remove(entity);
    this.trackEntities=[];
    if(value){
      if(value.frame!=='ITRF'||!Array.isArray(value.segments)||value.segments.some(segment=>!Array.isArray(segment)||segment.length<2||segment.some(position=>!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))))throw Error('Invalid native track segments');
      for(const [index,segment]of value.segments.entries())this.trackEntities.push(this.viewer.entities.add({id:`catalog-track-${index}`,name:'카탈로그 궤적 · GP 모델',polyline:{positions:segment.map(position=>new this.C.Cartesian3(...position)),width:3,arcType:this.C.ArcType.NONE,material:this._trackMaterial()}}));
    }
    this.viewer.scene.requestRender();return true;
  }
  _selectCatalogMarker(number,gpHash){
    const oldSelection=this.selectedCatalog;
    const previous=this.catalogPoints.get(this.selectedCatalog);if(previous)previous.show=this.catalogValid.has(this.selectedCatalog);
    const previousLabel=this.catalogLabels.get(this.selectedCatalog);if(previousLabel)previousLabel.show=this.catalogValid.has(this.selectedCatalog);
    this.selectedCatalog=this.catalogHashes.get(number)===gpHash&&this.catalogPoints.has(number)?number:null;
    const selected=this.catalogPoints.get(this.selectedCatalog);if(selected)selected.show=false;
    const label=this.catalogLabels.get(this.selectedCatalog);if(label)label.show=false;
    if(oldSelection!==this.selectedCatalog)this._repaintCatalog();
  }
  setCatalogScene(value,onSelect=()=>{}){
    if(this.destroyed)return false;this.onCatalogSelect=onSelect;
    const {C,viewer}=this;
    if(!value){
      this.hoverCatalog(null);
      if(this.catalogCollection)viewer.scene.primitives.remove(this.catalogCollection);
      if(this.catalogLabelCollection)viewer.scene.primitives.remove(this.catalogLabelCollection);
      this.catalogCollection=null;this.catalogLabelCollection=null;this.catalogSignature=null;
      this.catalogPoints.clear();this.catalogLabels.clear();this.catalogHashes.clear();this.catalogStyles.clear();this.catalogEpochs.clear();this.catalogVisuals.clear();this.catalogValid.clear();this.selectedCatalog=null;
      viewer.scene.requestRender();return true;
    }
    if(value.frame!=='ITRF'||!Array.isArray(value.rows)||value.count!==value.rows.length||value.rows.some(row=>row.status==='valid'&&(!Array.isArray(row.position_m)||row.position_m.length!==3||!row.position_m.every(Number.isFinite))))throw Error('Invalid catalog scene positions');
    C.JulianDate.fromIso8601(value.utc);
    if(this.catalogSignature!==value.scene_sha256){
      this.setCatalogScene(null,onSelect);
      this.catalogCollection=viewer.scene.primitives.add(new C.PointPrimitiveCollection());
      this.catalogLabelCollection=viewer.scene.primitives.add(new C.LabelCollection());
      this.catalogSignature=value.scene_sha256;
    }
    const size=value.count>10000?2.4:value.count>2000?3:value.count>200?4.5:6.5;
    const colors=PALETTES[this.viewControls.theme];
    const seen=new Set(),palette=new Map(),utcMilliseconds=Date.parse(value.utc);
    // Cesium copies option values into each primitive. Share immutable styles,
    // while keeping independently owned positions and point identities.
    let pointScale,labelScale,labelOutline;
    const color=(style,css,alpha)=>{if(!palette.has(style))palette.set(style,C.Color.fromCssColorString(css).withAlpha(alpha));return palette.get(style);};
    for(const row of value.rows){
      if(row.status!=='valid')continue;seen.add(row.catalog_number);
      const position=new C.Cartesian3(...row.position_m);
      let epoch=this.catalogEpochs.get(row.catalog_number);
      if(!epoch||epoch.hash!==row.normalized_gp_sha256||epoch.utc!==row.epoch_utc){epoch={hash:row.normalized_gp_sha256,utc:row.epoch_utc,milliseconds:Date.parse(row.epoch_utc)};this.catalogEpochs.set(row.catalog_number,epoch);}
      const age=(utcMilliseconds-epoch.milliseconds)/3600000;
      const baseAlpha=Number.isFinite(age)&&age>72?.56:value.count>1000?.9:.98;
      this.catalogVisuals.set(row.catalog_number,{regime:row.orbit_regime,alpha:baseAlpha,size});
      const alpha=baseAlpha*(this.selectedCatalog!==null&&this.selectedCatalog!==row.catalog_number ? .65 : 1),css=colors[row.orbit_regime]||colors.LEO,style=`${css}:${alpha}`;
      let point=this.catalogPoints.get(row.catalog_number);
      if(!point){
        const id={catalogNumber:row.catalog_number};
        pointScale??=new C.NearFarScalar(1e6,1.35,5e8,.58);
        point=this.catalogCollection.add({position,pixelSize:size,color:color(style,css,alpha),outlineColor:C.Color.TRANSPARENT,outlineWidth:0,scaleByDistance:pointScale,disableDepthTestDistance:0,id,show:true});
        this.catalogPoints.set(row.catalog_number,point);
        if(value.count<=80){labelScale??=new C.NearFarScalar(1e6,1,8e7,.38);labelOutline??=C.Color.fromCssColorString(colors.outline);this.catalogLabels.set(row.catalog_number,this.catalogLabelCollection.add({position,text:row.name,font:'600 12px Segoe UI',fillColor:color('label',this.viewControls.theme==='light'?'#1c2833':'#ffffff',1),outlineColor:labelOutline,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-18),scaleByDistance:labelScale,show:true,id}));}
      }else{point.position=position;point.show=true;if(this.catalogStyles.get(row.catalog_number)!==style)point.color=color(style,css,alpha);}
      this.catalogStyles.set(row.catalog_number,style);
      this.catalogHashes.set(row.catalog_number,row.normalized_gp_sha256);
      const label=this.catalogLabels.get(row.catalog_number);if(label){label.position=position;label.show=true;}
    }
    // The same GP can transition to/from a propagation failure at another UTC.
    for(const [number,point]of this.catalogPoints){if(!seen.has(number)){point.show=false;const label=this.catalogLabels.get(number);if(label)label.show=false;}}
    this.catalogValid=seen;
    if(this.hoveredCatalog!==null&&!seen.has(this.hoveredCatalog))this.hoverCatalog(null);
    const selected=this.selectedCatalog;
    if(selected!==null)this._selectCatalogMarker(selected,this.catalogHashes.get(selected));
    this._paintHovered();this._ensurePickHandler();viewer.scene.requestRender();return true;
  }
  _ensurePickHandler(){
    const {C,viewer}=this;
    if(this.stationPickHandler||!C.ScreenSpaceEventHandler||!C.ScreenSpaceEventType)return;
    this.stationPickHandler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);
    this.stationPickHandler.setInputAction(event=>{
      if(this.destroyed)return;
      const picked=viewer.scene.pick(event.position);const id=picked?.id?.id??picked?.id;
      if(id?.catalogNumber&&this.catalogPoints.get(id.catalogNumber)?.show){this.onCatalogSelect?.(id.catalogNumber);return;}
      if(id==='stored-orbit-satellite'&&this.selectedCatalog!==null){this.onCatalogSelect?.(this.selectedCatalog);return;}
      let key=this.stationIds.get(id);
      if(!key&&id==='virtual-ground-point'&&viewer.scene.drillPick)key=viewer.scene.drillPick(event.position,4).map(value=>this.stationIds.get(value?.id?.id??value?.id)).find(Boolean);
      if(key)this.onStationSelect?.(key);
    },C.ScreenSpaceEventType.LEFT_CLICK);
    if(C.ScreenSpaceEventType.MOUSE_MOVE!==undefined)this.stationPickHandler.setInputAction(event=>{
      if(this.destroyed)return;const picked=viewer.scene.pick(event.endPosition),id=picked?.id?.id??picked?.id;
      this.hoverCatalog(id?.catalogNumber??(id==='stored-orbit-satellite'?this.selectedCatalog:null));
      if(this.hoveredCatalog===null&&this.stationIds.has(id)&&viewer.scene.canvas.style)viewer.scene.canvas.style.cursor='pointer';
    },C.ScreenSpaceEventType.MOUSE_MOVE);
    this.leaveCatalog=()=>this.hoverCatalog(null);this.container.addEventListener?.('mouseleave',this.leaveCatalog);
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
    const {viewer}=this;this._ensurePickHandler();
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
    this.cameraMotion.release();
    this.viewer.camera.flyTo({destination:this.C.Cartesian3.fromDegrees(site.longitude,site.latitude,2500000),orientation:{heading:0,pitch:-89*Math.PI/180,roll:0},duration:1.2});return true;
  }
  focus(){
    if(!this.position||this.destroyed)return false;
    this.cameraMotion.release();
    const {C,viewer}=this;
    viewer.camera.viewBoundingSphere(new C.BoundingSphere(this.position,800000),new C.HeadingPitchRange(0,-Math.PI/2,12000000));
    viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);viewer.scene.requestRender();return true;
  }
  setImagery(provider){
    if(this.destroyed)return;
    this.viewer.imageryLayers.addImageryProvider(provider);this.viewer.scene.requestRender();
  }
  setViewMode(mode){this.cameraMotion.release();return this.viewControls.setMode(mode);}
  hoverCatalog(number){
    if(this.destroyed)return false;
    const next=this.catalogValid.has(number)?number:null;
    if(next!==this.hoveredCatalog){const previous=this.hoveredCatalog;this.hoveredCatalog=next;this._paintCatalogPoint(previous);this._paintHovered();this.viewer.scene.requestRender();}
    const cursor=next===null?'':'pointer';if(this.container.style)this.container.style.cursor=cursor;if(this.viewer.scene.canvas?.style)this.viewer.scene.canvas.style.cursor=cursor;
    return true;
  }
  _paintCatalogPoint(number){
    const point=this.catalogPoints.get(number),visual=this.catalogVisuals.get(number);if(!point||!visual)return;
    const palette=PALETTES[this.viewControls.theme],alpha=visual.alpha*(this.selectedCatalog!==null&&this.selectedCatalog!==number?.65:1);
    point.pixelSize=visual.size;point.color=this.C.Color.fromCssColorString(palette[visual.regime]||palette.LEO).withAlpha(alpha);
  }
  _paintHovered(){
    const number=this.hoveredCatalog,point=this.catalogPoints.get(number),visual=this.catalogVisuals.get(number);
    if(point&&visual&&number!==this.selectedCatalog){point.pixelSize=Math.max(7,visual.size*2.2);point.color=this.C.Color.fromCssColorString(this.viewControls.theme==='light'?'#1c2833':'#ffffff');point.outlineWidth=0;}
  }
  setViewImagery(mode){return this.viewControls.setImagery(mode);}
  setViewStyle(theme,emphasis){if(!this.viewControls.setStyle(theme,emphasis))return false;this._repaintCatalog();this._styleSelected();for(const entity of this.trackEntities??[])entity.polyline.material=this._trackMaterial();return true;}
  _trackMaterial(){const palette=PALETTES[this.viewControls.theme],C=this.C,color=C.Color.fromCssColorString(palette.selected);return C.PolylineOutlineMaterialProperty?new C.PolylineOutlineMaterialProperty({color,outlineColor:C.Color.fromCssColorString(palette.outline),outlineWidth:1.4}):color;}
  _styleSelected(){if(this.entity){const selected=this.selectedCatalog!==null,color=selected?this.C.Color.fromCssColorString(PALETTES[this.viewControls.theme].selected):this.C.Color.CYAN;this.entity.point.color=color;this.entity.label.fillColor=selected?color:this.C.Color.WHITE;}}
  _repaintCatalog(){
    const palette=PALETTES[this.viewControls.theme],colors=new Map(),C=this.C;
    const outline=C.Color.fromCssColorString(palette.outline),labelColor=C.Color.fromCssColorString(this.viewControls.theme==='light'?'#1c2833':'#ffffff');
    for(const [number,point]of this.catalogPoints){const visual=this.catalogVisuals.get(number);if(!visual)continue;const alpha=visual.alpha*(this.selectedCatalog!==null&&this.selectedCatalog!==number ? .65 : 1),css=palette[visual.regime]||palette.LEO,style=`${css}:${alpha}`;if(!colors.has(style))colors.set(style,C.Color.fromCssColorString(css).withAlpha(alpha));point.color=colors.get(style);this.catalogStyles.set(number,style);const label=this.catalogLabels.get(number);if(label){label.fillColor=labelColor;label.outlineColor=outline;}}
    this._paintHovered();this.viewer.scene.requestRender();
  }
  destroy(){if(this.destroyed)return;this.hoverCatalog(null);this.container.removeEventListener?.('mouseleave',this.leaveCatalog);this.modelLayer?.dispose();this.cameraMotion.dispose();this.destroyed=true;this.position=null;this.viewControls.destroy();this.stationPickHandler?.destroy();this.stationPickHandler=null;this.stationEntities.clear();this.stationSites.clear();this.stationIds.clear();this.catalogPoints.clear();this.catalogLabels.clear();this.catalogHashes.clear();this.catalogStyles.clear();this.catalogEpochs.clear();this.catalogVisuals.clear();this.viewer.destroy();}
}
