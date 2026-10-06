import {LINK_FLOW_SOURCE} from './link_flow.js';
// NodeScene display port from ISDC-ODT 1a1e002. Shared Viewer and native buffers are injected.
// Orientation follows a one-second fixed-position difference: display approximation, not attitude.
const MAX_MODELS=64,AMBIENT_IRRADIANCE=.62,OISL_FLOW_RATE=1.4;
export const LINK_COLORS=Object.freeze({locked:'#3ddc84',one_way:'#4ac4ee',acquiring:'#ffc357',slewing:'#ffa040',blocked:'#ff6b6b',idle:'#8ea4b8',none:'#8ea4b8'});
const PATH_ALPHA={dark:.28,light:.45};
const metadata={model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption'};
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
function signature(value){const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;return JSON.stringify(ordered(value));}

export class NodeScene{
  constructor({viewer,cesium,timeSource,advanceUtc,geometryFor,pathFor,pathRevisionFor,palette=()=>({}),tracksVisible=()=>true,isTransitioning=()=>false,onStatus=()=>{},verifyLinkSnapshot,animationNow=()=>0}={}){
    if(typeof advanceUtc!=='function'||typeof geometryFor!=='function'||typeof pathFor!=='function')throw new TypeError('node scene native display dependencies required');
    Object.assign(this,{viewerProvider:viewer,cesiumProvider:cesium,timeSource,advanceUtc,geometryFor,pathFor,pathRevisionFor,palette,tracksVisible,isTransitioning,onStatus,verifyLinkSnapshot,animationNow});
    this.links=new Map();this.linkPolylines=null;this.linkOwner=null;this.linkReceipt=null;this.definitionScope='[]';this.linksVisible=true;this.models=new Map();this.descriptions=new Map();this.paths=new Map();this.points=new Map();this.labels=new Map();this.selectedId=null;this.hoveredId=null;this.visibleIds=null;this.sdcMode=false;this.theme='dark';this.loadToken=0;this.modelsVisible=true;this.disposed=false;this.dataSource=null;this.dataSourceOwner=null;this.markerOwner=null;this.pointCollection=null;this.labelCollection=null;
    this.frameMemo=null;
  }
  get viewer(){return typeof this.viewerProvider==='function'?this.viewerProvider():this.viewerProvider;}
  get cesium(){return typeof this.cesiumProvider==='function'?this.cesiumProvider():this.cesiumProvider;}
  status(id,status,error=''){if(this.disposed)return;try{this.onStatus({node_id:id,status,error});}catch{/* Observer cannot change source geometry. */}}
  entityCollection(){
    const C=this.cesium,viewer=this.viewer;if(!viewer||this.disposed)return null;
    if(this.dataSource)return this.dataSource.entities;
    if(!C?.CustomDataSource||!viewer.dataSources?.add)return null;
    const source=new C.CustomDataSource('node-scene');this.dataSource=source;this.dataSourceOwner=viewer;
    const added=viewer.dataSources.add(source);if(added?.then)added.then(()=>{if(this.disposed||this.dataSource!==source)viewer.dataSources.remove?.(source,true);}).catch(e=>this.status(null,'error',String(e.message||e)));
    return source.entities;
  }
  ambientLighting(C){try{if(!C.ImageBasedLighting||!C.Cartesian3)return undefined;return new C.ImageBasedLighting({sphericalHarmonicCoefficients:Array.from({length:9},(_,i)=>i===0?new C.Cartesian3(AMBIENT_IRRADIANCE,AMBIENT_IRRADIANCE,AMBIENT_IRRADIANCE*1.05):new C.Cartesian3())});}catch{return undefined;}}
  matches(value,id){const entry=this.descriptions.get(id);return !!entry&&value?.node_id===id&&Object.entries(metadata).every(([k,v])=>value[k]===v)&&typeof value.definition_hash==='string'&&/^[a-f0-9]{64}$/.test(value.definition_hash)&&signature(value.node_definition)===entry.signature;}
  frameCurrent(frame){
    try{return !this.disposed&&this.frameMemo===frame&&!frame.invalid&&this.viewer===frame.viewer&&this.cesium===frame.cesium&&this.descriptions===frame.descriptions&&this.definitionScope===frame.scope&&this.timeSource?.()===frame.utc&&this.isTransitioning()===frame.transition&&this.viewer?.scene?.mode===frame.mode;}catch{return false;}
  }
  geometryAt(id,utc){
    const entry=this.descriptions.get(id);if(!entry||typeof utc!=='string')return null;
    const frame=this.frameMemo;
    if(frame&&!this.frameCurrent(frame)){frame.invalid=true;return null;}
    const cached=frame?.geometry.get(id);if(cached?.has(utc))return cached.get(utc);
    let result=null;
    try{if(this.advanceUtc(utc,0)!==utc)return null;const g=this.geometryFor(structuredClone(entry.definition),{utc});result=this.matches(g,id)&&g.row?.utc===utc&&g.row.status==='valid'&&g.row.error_code===null&&vector(g.row.position_m)?g:null;}catch{/* Invalid native projection remains hidden. */}
    if(frame){
      if(!this.frameCurrent(frame)){frame.invalid=true;return null;}
      const values=cached??new Map();values.set(utc,result);frame.geometry.set(id,values);
    }
    return result;
  }
  cartesianAt(id,utc,expectedHash){const C=this.cesium,g=this.geometryAt(id,utc);return C?.Cartesian3&&g&&(!expectedHash||g.definition_hash===expectedHash)?new C.Cartesian3(...g.row.position_m):null;}
  async setNodes(entries){
    if(this.disposed)return;if(!Array.isArray(entries)||entries.length>240)throw new Error('node scene limit0..240');
    const next=new Map();for(const value of entries){if(typeof value?.id!=='string'||!value.id.trim()||next.has(value.id)||value.definition?.id!==value.id||value.definition.schema!==1)throw new Error('node scene definitions required');const entry=structuredClone(value);entry.signature=signature(entry.definition);next.set(entry.id,entry);}
    for(const [id,entry]of this.descriptions)if(next.get(id)?.signature!==entry.signature){this.removePath(id);const model=this.models.get(id);if(model)model.model.show=false;}
    const scope=signature([...next.values()].map(e=>e.definition));if(scope!==this.definitionScope)this.clearLinks();
    this.descriptions=next;this.definitionScope=scope;
    for(const id of [...this.models.keys()])if(!next.has(id))this.removeModel(id);
    for(const id of [...this.paths.keys()])if(!next.has(id))this.removePath(id);
    if(this.selectedId&&!next.has(this.selectedId))this.selectedId=null;
    if(this.hoveredId&&!next.has(this.hoveredId))this.hoveredId=null;
    this.reconcileMarkers();this.placePoints(this.timeSource?.());
    const loading=this.loadModels(),token=this.loadToken;await loading;if(!this.disposed&&token===this.loadToken)this.update(this.timeSource?.());
  }
  reconcileMarkers(){
    const C=this.cesium,viewer=this.viewer;if(!C?.PointPrimitiveCollection||!C.LabelCollection||!viewer?.scene?.primitives)return;
    if(!this.pointCollection){this.markerOwner=viewer;this.pointCollection=viewer.scene.primitives.add(new C.PointPrimitiveCollection());this.labelCollection=viewer.scene.primitives.add(new C.LabelCollection());}
    for(const id of [...this.points.keys()])if(!this.descriptions.has(id))this.removeMarker(id);
    for(const [id,entry]of this.descriptions){
      let point=this.points.get(id);if(!point){point=this.pointCollection.add({show:false,position:new C.Cartesian3(),pixelSize:this.basePointSize(),color:C.Color.fromCssColorString('#ff9f43'),outlineColor:C.Color.TRANSPARENT,outlineWidth:0,scaleByDistance:new C.NearFarScalar(1e6,1.35,5e8,.58),disableDepthTestDistance:0,id:{satelliteId:id,nodeId:id}});this.points.set(id,point);}
      let label=this.labels.get(id);if(!label){label=this.labelCollection.add({position:point.position,text:'',font:'600 12px Segoe UI',fillColor:C.Color.WHITE,outlineColor:C.Color.fromCssColorString('#061528'),outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-18),scaleByDistance:new C.NearFarScalar(1e6,1,8e7,.38),disableDepthTestDistance:0,show:false,id:{satelliteId:id,nodeId:id}});this.labels.set(id,label);}
      label.text=String(entry.display_name??entry.definition.name??id);
    }
    this.refreshMarkerStyles();
  }
  basePointSize(){return this.descriptions.size>200?4.5:6.5;}
  refreshMarkerStyles(){
    const C=this.cesium;if(!C?.Color)return;const palette=this.palette(this.theme)||{};
    for(const [id,point]of this.points){const entry=this.descriptions.get(id);if(!entry)continue;const selected=id===this.selectedId,hovered=id===this.hoveredId,base=this.basePointSize();
      point.pixelSize=selected?Math.max(8,base*2.6):hovered?Math.max(7,base*2.2):base;
      const css=selected?(palette.selected||(this.theme==='light'?'#d35400':'#efff62')):hovered?(palette.hover||(this.theme==='light'?'#1c2833':'#ffffff')):palette[String(entry.orbit_regime||'').toUpperCase()]||palette.fallback||(this.theme==='light'?'#c9651a':'#ff9f43');
      const age=Number(entry.epoch_age_hours),baseAlpha=Number.isFinite(age)&&age>72 ? .68 : .98;
      const alpha=this.sdcMode?1:baseAlpha*(this.selectedId&&this.selectedId!==id ? .65 : 1);
      point.color=C.Color.fromCssColorString(css).withAlpha(selected||hovered?1:alpha);point.outlineWidth=0;
      const label=this.labels.get(id);if(label)label.fillColor=selected?C.Color.fromCssColorString(palette.selected||(this.theme==='light'?'#d35400':'#efff62')):C.Color.WHITE;
    }
  }
  placePoints(utc){
    const C=this.cesium;if(!C?.Cartesian3)return;
    for(const [id,point]of this.points){const label=this.labels.get(id),g=this.geometryAt(id,utc),visible=!!g&&(this.visibleIds===null||this.visibleIds.has(id)||id===this.selectedId);point.show=visible;if(label)label.show=visible;if(!g)continue;
      const position=new C.Cartesian3(...g.row.position_m);point.position=position;if(label)label.position=position;
    }
  }
  removeMarker(id){const point=this.points.get(id),label=this.labels.get(id);if(point)this.pointCollection?.remove(point);if(label)this.labelCollection?.remove(label);this.points.delete(id);this.labels.delete(id);}
  setSdcMode(enabled){if(this.disposed)return;this.sdcMode=Boolean(enabled);this.refreshMarkerStyles();}
  setHovered(id){if(this.disposed)return;this.hoveredId=id!=null&&this.descriptions.has(String(id))?String(id):null;this.refreshMarkerStyles();}
  setVisibleNodes(ids=null){if(this.disposed)return;if(ids!==null&&!Array.isArray(ids))throw new TypeError('node visibility IDs must be an array or null');this.visibleIds=ids===null?null:new Set(ids.map(String));this.placePoints(this.timeSource?.());}
  modelKey(id){const d=this.descriptions.get(id)?.model;return d?.url?`${d.url}|${Number(d.scale)>0?d.scale:1}`:null;}
  async loadModels(){
    const C=this.cesium,viewer=this.viewer,token=++this.loadToken;if(!C?.Model?.fromGltfAsync||!viewer?.scene?.primitives)return;
    let count=this.models.size;
    for(const [id,entry]of this.descriptions){
      if(this.disposed||token!==this.loadToken)return;
      const d=entry.model,key=this.modelKey(id),existing=this.models.get(id);if(existing?.key===key&&!existing.failed)continue;if(existing){this.removeModel(id);count--;}
      if(!key||count>=MAX_MODELS)continue;count++;let model;
      try{model=await C.Model.fromGltfAsync({url:d.url,id:{satelliteId:id,nodeId:id},scale:Number(d.scale)>0?Number(d.scale):1,minimumPixelSize:Number(d.minimumPixelSize)||12,allowPicking:true,show:false,imageBasedLighting:this.ambientLighting(C)});}catch(e){this.status(id,'model_unavailable',String(e.message||e));continue;}
      if(this.disposed||token!==this.loadToken||viewer!==this.viewer||!this.descriptions.has(id)||this.modelKey(id)!==key){model.destroy?.();continue;}
      const installed={model:viewer.scene.primitives.add(model),owner:viewer,key,orientation:structuredClone(d.orientation||{}),failed:false,removers:[]};this.models.set(id,installed);
      const current=()=>!this.disposed&&this.models.get(id)===installed&&this.viewer===viewer;
      const listen=(event,callback)=>{if(typeof event?.addEventListener!=='function')return;const remove=event.addEventListener(callback);if(typeof remove==='function')installed.removers.push(remove);else if(typeof event.removeEventListener==='function')installed.removers.push(()=>event.removeEventListener(callback));};
      listen(model.readyEvent,()=>{if(current()&&!installed.failed)this.status(id,'model_ready');});
      listen(model.errorEvent,error=>{if(!current())return;installed.failed=true;model.show=false;this.status(id,'model_unavailable',String(error?.message||error));});
      this.status(id,'model_loaded');
    }
  }
  removeModel(id){const entry=this.models.get(id);if(!entry)return;this.models.delete(id);for(const remove of entry.removers||[])try{remove();}catch{/* A disposed event cannot retain ownership. */}try{entry.owner.scene.primitives.remove(entry.model);}catch{/* Owner already removed. */}}
  bodyMatrix(C,id,here,utc,orientation,hash){
    let ahead;try{ahead=this.cartesianAt(id,this.advanceUtc(utc,1),hash);}catch{ahead=null;}
    let rotation=null;if(ahead){const velocity=C.Cartesian3.subtract(ahead,here,new C.Cartesian3());if(C.Cartesian3.magnitude(velocity)>1){C.Cartesian3.normalize(velocity,velocity);rotation=C.Transforms.rotationMatrixFromPositionVelocity(here,velocity,C.Ellipsoid.WGS84,new C.Matrix3());}}
    if(!rotation)return C.Transforms.eastNorthUpToFixedFrame(here);
    const {heading=0,pitch=0,roll=0}=orientation||{};
    if((heading||pitch||roll)&&C.Matrix3.fromHeadingPitchRoll&&C.HeadingPitchRoll){const trim=C.Matrix3.fromHeadingPitchRoll(new C.HeadingPitchRoll(C.Math.toRadians(heading),C.Math.toRadians(pitch),C.Math.toRadians(roll)),new C.Matrix3());C.Matrix3.multiply(rotation,trim,rotation);}
    return C.Matrix4.fromRotationTranslation(rotation,here,new C.Matrix4());
  }
  placeModels(utc){
    const C=this.cesium;if(!C)return;const morph=this.isTransitioning()||C.SceneMode&&this.viewer?.scene?.mode===C.SceneMode.MORPHING;
    for(const [id,entry]of this.models){const g=!entry.failed&&!morph&&id!==this.selectedId&&this.modelsVisible?this.geometryAt(id,utc):null;if(!g){entry.model.show=false;continue;}const here=new C.Cartesian3(...g.row.position_m);entry.model.modelMatrix=this.bodyMatrix(C,id,here,utc,entry.orientation,g.definition_hash);entry.model.show=true;}
  }
  pathColor(C,id){const palette=this.palette(this.theme)||{},regime=this.descriptions.get(id)?.orbit_regime;return C.Color.fromCssColorString(palette[String(regime||'').toUpperCase()]||palette.fallback||'#ff9f43').withAlpha(PATH_ALPHA[this.theme]);}
  rebuildPaths(){
    if(!this.descriptions.size)return;const C=this.cesium,entities=this.entityCollection();if(!C?.Cartesian3||!entities)return;
    for(const [id,description]of this.descriptions){
      let entry=this.paths.get(id),revision=null;
      const versioned=typeof this.pathRevisionFor==='function';
      const readRevision=()=>{try{const token=this.pathRevisionFor(structuredClone(description.definition));return token&&typeof token==='object'&&!Array.isArray(token)&&Object.isFrozen(token)?token:null;}catch{return null;}};
      if(versioned)revision=readRevision();
      if(!entry||!versioned||entry.revision!==revision){
        let receipt;try{receipt=!versioned||revision?this.pathFor(structuredClone(description.definition)):null;}catch{receipt=null;}
        const valid=(!versioned||revision&&readRevision()===revision)&&this.matches(receipt,id)&&receipt.visible===true&&Array.isArray(receipt.positions_m)&&receipt.positions_m.length===121&&receipt.positions_m.every(vector);
        const points=valid?receipt.positions_m.map(v=>new C.Cartesian3(...v)):[];
        if(!entry){entry={positions:points,revision,entity:null};entry.entity=entities.add({id:`node-path-${id}`,show:false,polyline:{positions:C.CallbackProperty?new C.CallbackProperty(()=>entry.positions,false):points,width:1.3,material:this.pathColor(C,id),arcType:C.ArcType?.NONE}});this.paths.set(id,entry);}
        else{entry.positions=points;entry.revision=revision;if(!C.CallbackProperty)entry.entity.polyline.positions=points;}
      }
      entry.entity.show=entry.positions.length>1&&id!==this.selectedId&&this.tracksVisible()!==false;
    }
  }

  removePath(id){const entry=this.paths.get(id);if(!entry)return;try{this.dataSource?.entities.remove(entry.entity);}catch{/* Owned entity already gone. */}this.paths.delete(id);}

  // The renderer consumes a T077 verified snapshot; it never calculates terminal success.
  setLinks(snapshot){
    if(this.disposed)return false;
    let captured;
    try{
      captured=structuredClone(snapshot);
      const nodes=[...this.descriptions.values()].map(e=>e.definition),utc=this.timeSource?.();
      if(typeof this.verifyLinkSnapshot!=='function'||captured?.status!=='valid'||captured.utc!==utc||this.advanceUtc(utc,0)!==utc||captured.source_commit!==metadata.source_commit||captured.quality!==metadata.quality||signature(captured.node_definitions)!==signature(nodes)||!Array.isArray(captured.terminals)||!Array.isArray(captured.pairs)||captured.pairs.length>nodes.length*(nodes.length-1)/2)throw Error('unverified link scope');
      const keys=new Set(),pairs=new Set();
      for(const p of captured.pairs){
        if(typeof p?.key!=='string'||!p.key.trim()||keys.has(p.key)||typeof p.a!=='string'||typeof p.b!=='string'||p.a===p.b||!this.descriptions.has(p.a)||!this.descriptions.has(p.b)||!Object.hasOwn(LINK_COLORS,p.state))throw Error('invalid link pair');
        const pair=JSON.stringify([p.a,p.b].sort());if(pairs.has(pair))throw Error('duplicate link endpoints');keys.add(p.key);pairs.add(pair);
      }
      if(this.verifyLinkSnapshot(structuredClone(captured),{nodes:structuredClone(nodes),utc})!==true||this.disposed||this.timeSource?.()!==utc||signature(captured.node_definitions)!==this.definitionScope)throw Error('unverified link calculation');
    }catch{this.clearLinks();return false;}
    const C=this.cesium,lines=this.linkCollection();
    if(!C?.Color||!C?.Material?.fromType||!lines){this.clearLinks();return false;}
    const keep=new Set();
    try{
      for(const link of captured.pairs){
        keep.add(link.key);let entry=this.links.get(link.key);
        if(!entry){entry={a:link.a,b:link.b,state:link.state,positions:[],line:lines.add({id:`node-link-${link.key}`,positions:[],show:false,width:2,material:this.linkMaterial(C,link.state)})};this.links.set(link.key,entry);}
        else if(entry.state!==link.state){entry.line.material=this.linkMaterial(C,link.state);entry.state=link.state;}
        entry.a=link.a;entry.b=link.b;entry.material=entry.line.material;
      }
      for(const key of [...this.links.keys()])if(!keep.has(key))this.removeLink(key);
      this.linkReceipt={utc:captured.utc,scope:signature(captured.node_definitions)};this.placeLinks(this.timeSource?.());return true;
    }catch{this.clearLinks();return false;}
  }
  linkMaterial(C,state){
    const color=C.Color.fromCssColorString(LINK_COLORS[state]||LINK_COLORS.none);
    if(state==='locked'&&typeof C.Material==='function'){
      let now=0;try{const value=this.animationNow();if(Number.isFinite(value))now=value;}catch{/* Optional presentation phase is not data time. */}
      return new C.Material({translucent:true,fabric:{type:'SpaceTwinLinkFlow',source:LINK_FLOW_SOURCE,uniforms:{color:color.withAlpha(.55),downColor:C.Color.fromCssColorString('#e5fff2'),upColor:C.Color.fromCssColorString('#8beaff'),spacing:96,time:now/1000*OISL_FLOW_RATE}}});
    }
    if(state==='acquiring'||state==='slewing')return C.Material.fromType('PolylineDash',{color:color.withAlpha(.9),dashLength:12});
    return C.Material.fromType('Color',{color:color.withAlpha(state==='locked'?.95:.75)});
  }
  linkCollection(){const C=this.cesium,viewer=this.viewer;if(!this.linkPolylines&&C?.PolylineCollection&&viewer?.scene?.primitives){this.linkOwner=viewer;this.linkPolylines=viewer.scene.primitives.add(new C.PolylineCollection());}return this.linkPolylines;}
  placeLinks(utc){
    const current=!!this.linkReceipt&&this.linkReceipt.utc===utc&&utc===this.timeSource?.()&&this.linkReceipt.scope===this.definitionScope&&this.linkOwner===this.viewer;
    const morph=this.isTransitioning()||this.cesium?.SceneMode&&this.viewer?.scene?.mode===this.cesium.SceneMode.MORPHING;
    for(const entry of this.links.values()){
      const a=current&&!morph&&this.linksVisible?this.cartesianAt(entry.a,utc):null,b=a?this.cartesianAt(entry.b,utc):null;
      const drawable=!!a&&!!b&&!['blocked','idle','none'].includes(entry.state);
      if(drawable){entry.positions=[a,b];entry.line.positions=entry.positions;}entry.line.show=drawable;
    }
  }
  animateLinkFlow(nowMs,utc=this.timeSource?.()){
    if(this.disposed)return;
    // Always recheck scope and endpoints; direct animation calls cannot revive stale results.
    this.placeLinks(utc);
    if(nowMs===undefined)try{nowMs=this.animationNow();}catch{return;}
    if(!Number.isFinite(nowMs))return;
    for(const entry of this.links.values()){const uniforms=entry.line.material?.uniforms;if(entry.line.show&&entry.state==='locked'&&uniforms&&'time'in uniforms)uniforms.time=nowMs/1000*OISL_FLOW_RATE;}
  }
  setLinksVisible(visible){if(this.disposed)return false;this.linksVisible=visible!==false;this.placeLinks(this.timeSource?.());return this.linksVisible;}
  removeLink(key){const entry=this.links.get(key);if(!entry)return;try{this.linkPolylines?.remove(entry.line);}catch{/* Owned primitive already gone. */}this.links.delete(key);}
  clearLinks(){for(const key of [...this.links.keys()])this.removeLink(key);this.linkReceipt=null;}

  select(id){if(this.disposed)return;this.selectedId=id==null?null:String(id);this.refreshMarkerStyles();this.placePoints(this.timeSource?.());this.placeModels(this.timeSource?.());for(const [key,p]of this.paths)p.entity.show=p.positions.length>1&&key!==this.selectedId&&this.tracksVisible()!==false;}
  setModelsVisible(visible){this.modelsVisible=visible!==false;this.placeModels(this.timeSource?.());return this.modelsVisible;}
  setTheme(theme){this.theme=theme==='light'?'light':'dark';this.refreshMarkerStyles();const C=this.cesium;if(C?.Color)for(const [id,p]of this.paths)p.entity.polyline.material=this.pathColor(C,id);}
  update(utc=this.timeSource?.()){if(this.disposed)return;this.placePoints(utc);this.placeModels(utc);this.placeLinks(utc);this.rebuildPaths();}
  syncFrame(utc,nowMs){
    if(this.disposed)return;
    const frame={utc,viewer:this.viewer,cesium:this.cesium,descriptions:this.descriptions,scope:this.definitionScope,transition:this.isTransitioning(),mode:this.viewer?.scene?.mode,geometry:new Map(),invalid:false};
    this.frameMemo=frame;
    try{this.placePoints(utc);this.placeModels(utc);this.placeLinks(utc);this.animateLinkFlow(nowMs,utc);}
    finally{
      // A callback may replace a selection, Viewer or UTC within this frame.
      // Suppress every owned primitive rather than publish a mixture of scopes.
      if(!this.frameCurrent(frame)){for(const p of this.points.values())p.show=false;for(const label of this.labels.values())label.show=false;for(const m of this.models.values())m.model.show=false;for(const link of this.links.values())link.line.show=false;}
      if(this.frameMemo===frame)this.frameMemo=null;
    }
  }
  clear(){this.loadToken++;this.clearLinks();if(this.linkPolylines)this.linkOwner?.scene?.primitives?.remove(this.linkPolylines);this.linkPolylines=null;this.linkOwner=null;for(const id of [...this.models.keys()])this.removeModel(id);for(const id of [...this.paths.keys()])this.removePath(id);for(const id of [...this.points.keys()])this.removeMarker(id);if(this.markerOwner){if(this.pointCollection)this.markerOwner.scene.primitives.remove(this.pointCollection);if(this.labelCollection)this.markerOwner.scene.primitives.remove(this.labelCollection);}this.pointCollection=null;this.labelCollection=null;this.markerOwner=null;this.descriptions.clear();this.definitionScope='[]';this.selectedId=null;this.hoveredId=null;}
  destroy(){if(this.disposed)return;this.clear();this.disposed=true;if(this.dataSource){this.dataSourceOwner?.dataSources?.remove?.(this.dataSource,true);this.dataSource=null;this.dataSourceOwner=null;}}
}
