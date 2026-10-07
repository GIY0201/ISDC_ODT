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
  constructor({viewer,cesium,timeSource,advanceUtc,geometryFor,pathFor,pathRevisionFor,displayGeometry=null,sampledLinks=null,routeEmphasis=null,analyticalRouteEmphasis=null,palette=()=>({}),tracksVisible=()=>true,isTransitioning=()=>false,onStatus=()=>{},verifyLinkSnapshot,animationNow=()=>0}={}){
    if(typeof advanceUtc!=='function'||typeof geometryFor!=='function'||typeof pathFor!=='function')throw new TypeError('node scene native display dependencies required');
    if(displayGeometry!==null&&['revision','viewFor','isCurrent','sampleAt','verifySample'].some(key=>typeof displayGeometry?.[key]!=='function'))throw new TypeError('registered readonly native display geometry port required');
    if(sampledLinks!==null&&['read','verify'].some(key=>typeof sampledLinks?.[key]!=='function'))throw new TypeError('registered sampled links read/verify port required');
    if(routeEmphasis!==null&&['read','verify'].some(key=>typeof routeEmphasis?.[key]!=='function'))throw new TypeError('registered route emphasis read/verify port required');
    if(analyticalRouteEmphasis!==null&&['read','verify'].some(key=>typeof analyticalRouteEmphasis?.[key]!=='function'))throw new TypeError('registered analytical route read/verify port required');
    Object.assign(this,{viewerProvider:viewer,cesiumProvider:cesium,timeSource,advanceUtc,geometryFor,pathFor,pathRevisionFor,displayGeometry,sampledLinks,palette,tracksVisible,isTransitioning,onStatus,verifyLinkSnapshot,animationNow});
    this.links=new Map();this.linkPolylines=null;this.linkOwner=null;this.linkReceipt=null;this.definitionScope='[]';this.linksVisible=true;this.models=new Map();this.descriptions=new Map();this.paths=new Map();this.points=new Map();this.labels=new Map();this.selectedId=null;this.hoveredId=null;this.visibleIds=null;this.sdcMode=false;this.theme='dark';this.loadToken=0;this.modelsVisible=true;this.disposed=false;this.dataSource=null;this.dataSourceOwner=null;this.markerOwner=null;this.pointCollection=null;this.labelCollection=null;
    this.frameMemo=null;
    this.routeEmphasis=routeEmphasis;this.routeGeneration=0;this.routeStyled=new Map();
    this.analyticalRouteEmphasis=analyticalRouteEmphasis;this.analyticalRouteGeneration=0;this.analyticalRouteStyled=new Map();this.analyticalRouteReceipt=null;this.analyticalRouteCandidate=null;this.analyticalRouteLastView=null;this.revokedAnalyticalRoutes=new WeakSet();this.analyticalFrozen=new WeakSet();
    this.sampledLinkReceipt=null;this.sampledFlowGuard=null;this.linkGeneration=0;this.sampledFrozen=new WeakSet();this.sampledScopes=new WeakMap();this.sampledPairValidation=null;
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
  frameCurrent(frame,verifyNative=true){
    try{return (!verifyNative||!frame.displayGeometry||frame.displayGeometry.revision()===frame.nativeRevision)&&!this.disposed&&this.frameMemo===frame&&!frame.invalid&&this.displayGeometry===frame.displayGeometry&&this.advanceUtc===frame.advanceUtc&&this.viewer===frame.viewer&&this.cesium===frame.cesium&&this.descriptions===frame.descriptions&&this.definitionScope===frame.scope&&this.timeSource?.()===frame.utc&&this.isTransitioning()===frame.transition&&this.viewer?.scene?.mode===frame.mode&&(!verifyNative||!frame.displayGeometry||frame.displayGeometry.revision()===frame.nativeRevision);}catch{return false;}
  }
  frameCall(frame,callback){
    if(frame&&!this.frameCurrent(frame)){frame.invalid=true;return null;}
    const value=callback();
    if(frame&&!this.frameCurrent(frame)){frame.invalid=true;return null;}
    return value;
  }
  advanceFrameUtc(utc,seconds){
    const frame=this.frameMemo,known=frame?.utcAdvances.get(utc);if(known?.has(seconds))return known.get(seconds);
    const value=this.frameCall(frame,()=>this.advanceUtc(utc,seconds));
    if(frame&&!frame.invalid){const values=known??new Map();values.set(seconds,value);frame.utcAdvances.set(utc,values);}return value;
  }
  displayGeometryAt(entry,id,utc,frame){
    const port=this.displayGeometry,revision=frame?frame.nativeRevision:port.revision();if(!revision)return null;
    const call=callback=>{const value=this.frameCall(frame,callback);return port.revision()===revision?value:null;};
    if(this.advanceFrameUtc(utc,0)!==utc)return null;
    let binding=entry.displayBinding;
    if(!binding||binding.revision!==revision){
      const view=call(()=>port.viewFor(structuredClone(entry.definition)));
      if(!view||call(()=>port.isCurrent(view))!==true||!Object.isFrozen(view)||!Object.isFrozen(view.node_definition)||!Object.isFrozen(view.receipt_revision)||view.definition_key!==entry.signature||!this.matches(view,id))return null;
      binding={revision,view,packets:new WeakMap()};entry.displayBinding=binding;
    }
    const value=call(()=>port.sampleAt(binding.view,utc));if(!value||typeof value!=='object')return null;
    if(binding.packets.get(value)!==utc){
      if(call(()=>port.verifySample(binding.view,value,utc))!==true||!Object.isFrozen(value)||!Object.isFrozen(value.row)||value.node_definition!==binding.view.node_definition||value.node_id!==id||value.definition_hash!==binding.view.definition_hash||Object.entries(metadata).some(([key,expected])=>value[key]!==expected)||value.row?.utc!==utc)return null;
      binding.packets.set(value,utc);
    }
    return value.row.status==='valid'&&value.row.error_code===null&&vector(value.row.position_m)?value:null;
  }
  geometryAt(id,utc){
    const entry=this.descriptions.get(id);if(!entry||typeof utc!=='string')return null;
    const frame=this.frameMemo;
    if(frame?.invalid)return null;
    const cached=frame?.geometry.get(id);if(cached?.has(utc))return cached.get(utc);
    // A cached hit performs no external callback. Its exact frame was checked
    // around the native read, and syncFrame checks the whole binding again
    // before returning. New reads retain both external-context guards.
    let result=null;
    try{
      if(this.displayGeometry)result=this.displayGeometryAt(entry,id,utc,frame);
      else{if(frame&&!this.frameCurrent(frame)){frame.invalid=true;return null;}if(this.advanceUtc(utc,0)!==utc)return null;const g=this.geometryFor(structuredClone(entry.definition),{utc});result=this.matches(g,id)&&g.row?.utc===utc&&g.row.status==='valid'&&g.row.error_code===null&&vector(g.row.position_m)?g:null;}
    }catch{/* Invalid native projection remains hidden. */}
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
    let ahead;try{ahead=this.cartesianAt(id,this.displayGeometry?this.advanceFrameUtc(utc,1):this.advanceUtc(utc,1),hash);}catch{ahead=null;}
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
        // The accepted native path is fixed until its opaque revision changes.
        // A nonconstant CallbackProperty forces Cesium to copy/rebuild every
        // polyline each frame even while these 121 positions remain unchanged.
        // Assigning the array lets Cesium own a constant property and update it
        // only when the same guarded receipt accepts a replacement (or failure).
        if(!entry){entry={positions:points,revision,entity:null};entry.entity=entities.add({id:`node-path-${id}`,show:false,polyline:{positions:points,width:1.3,material:this.pathColor(C,id),arcType:C.ArcType?.NONE}});this.paths.set(id,entry);}
        else{entry.positions=points;entry.revision=revision;entry.entity.polyline.positions=points;}
      }
      entry.entity.show=entry.positions.length>1&&id!==this.selectedId&&this.tracksVisible()!==false;
    }
  }

  removePath(id){const entry=this.paths.get(id);if(!entry)return;try{this.dataSource?.entities.remove(entry.entity);}catch{/* Owned entity already gone. */}this.paths.delete(id);}

  // The renderer consumes a T077 verified snapshot; it never calculates terminal success.
  setLinks(snapshot){
    this.restoreAnalyticalRouteEmphasis();
    this.restoreRouteEmphasis();
    if(this.disposed)return false;
    if(['OPTICAL_SAMPLED_UI_V1','MIXED_ROUTE_ANALYTICAL_UI_V1'].includes(snapshot?.presentation_kind)){this.clearLinks();return false;}
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
        entry.a=link.a;entry.b=link.b;entry.material=entry.line.material;delete entry.presentation_kind;delete entry.analysis_utc;
      }
      for(const key of [...this.links.keys()])if(!keep.has(key))this.removeLink(key);
      this.sampledLinkReceipt=null;this.sampledFlowGuard=null;this.linkGeneration++;this.linkReceipt={utc:captured.utc,scope:signature(captured.node_definitions)};this.placeLinks(this.timeSource?.());this.applyRouteEmphasis(captured.utc);return true;
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
  sampledReadonly(value){
    if(!value||typeof value!=='object')return true;
    if(this.sampledFrozen.has(value))return true;
    if(!Object.isFrozen(value)||!Object.values(value).every(child=>this.sampledReadonly(child)))return false;
    this.sampledFrozen.add(value);return true;
  }
  // Separate visual authority: receipt.utc stays at the captured analysis time.
  // Exact setLinks/placeLinks never receive or approve a retained sample.
  placeSampledLinks(utc){
    const port=this.sampledLinks,frame=this.frameMemo;
    if(!port||this.disposed)return false;
    const hide=()=>this.hideSampledLinks();
    try{
      const generation=this.linkGeneration,descriptions=this.descriptions,scope=this.definitionScope,viewerProvider=this.viewerProvider,cesiumProvider=this.cesiumProvider,viewer=this.viewer,C=this.cesium,mode=viewer?.scene?.mode,visible=this.linksVisible,transition=this.isTransitioning(),read=port.read,verify=port.verify;
      const bound=()=>!this.disposed&&this.sampledLinks===port&&port.read===read&&port.verify===verify&&this.linkGeneration===generation&&this.descriptions===descriptions&&this.definitionScope===scope&&this.viewerProvider===viewerProvider&&this.cesiumProvider===cesiumProvider&&this.linksVisible===visible&&viewer?.scene?.mode===mode;
      // External getters may synchronously clear/switch the renderer. Check the
      // internal generation again after them, including direct non-frame calls.
      const current=()=>bound()&&this.viewer===viewer&&this.cesium===C&&this.timeSource?.()===utc&&this.isTransitioning()===transition&&(!frame||this.frameCurrent(frame))&&bound();
      if(!current())throw Error('sampled visual context changed');
      const view=port.read({utc});
      if(!current())throw Error('sampled visual context changed during read');
      if(!view||view.presentation_kind!=='OPTICAL_SAMPLED_UI_V1'||view.status!=='valid'){
        if(this.sampledLinkReceipt)hide();return false;
      }
      if(!this.sampledReadonly(view)||!['sampled','pending'].includes(view.availability)||view.error!==null||view.display_utc!==utc||view.utc!==view.analysis_utc||typeof view.analysis_utc!=='string'||!Number.isFinite(view.age_seconds)||view.current_analysis!==(view.analysis_utc===utc)||Object.entries(metadata).some(([key,value])=>view[key]!==value)||!Array.isArray(view.node_definitions)||!Array.isArray(view.terminals)||!Array.isArray(view.pairs)||!view.definition_hashes||typeof view.definition_hashes!=='object'||Array.isArray(view.definition_hashes))throw Error('invalid sampled visual receipt');
      if(this.advanceUtc(utc,0)!==utc||this.advanceUtc(view.analysis_utc,0)!==view.analysis_utc||!current())throw Error('invalid sampled visual UTC');
      let receiptScope=this.sampledScopes.get(view.node_definitions);
      if(receiptScope===undefined){receiptScope=signature(view.node_definitions);this.sampledScopes.set(view.node_definitions,receiptScope);}
      if(receiptScope!==scope||Object.keys(view.definition_hashes).length!==descriptions.size||[...descriptions.keys()].some(id=>!Object.hasOwn(view.definition_hashes,id)||typeof view.definition_hashes[id]!=='string'||!/^[a-f0-9]{64}$/.test(view.definition_hashes[id])))throw Error('invalid sampled visual definitions');
      if(this.sampledPairValidation?.pairs!==view.pairs||this.sampledPairValidation.scope!==scope){
        if(view.pairs.length>descriptions.size*(descriptions.size-1)/2)throw Error('invalid sampled visual pair count');
        const keys=new Set(),pairs=new Set();
        for(const pair of view.pairs){
          if(typeof pair?.key!=='string'||!pair.key.trim()||keys.has(pair.key)||typeof pair.a!=='string'||typeof pair.b!=='string'||pair.a===pair.b||!descriptions.has(pair.a)||!descriptions.has(pair.b)||!Object.hasOwn(LINK_COLORS,pair.state))throw Error('invalid sampled visual pair');
          const key=JSON.stringify([pair.a,pair.b].sort());if(pairs.has(key))throw Error('duplicate sampled visual endpoints');keys.add(pair.key);pairs.add(key);
        }
        this.sampledPairValidation={pairs:view.pairs,scope};
      }
      if(port.verify(view,{utc})!==true||!current())throw Error('unregistered sampled visual receipt');
      // Morph/visibility suppress endpoint work and flow without changing analysis.
      if(!visible||transition||C?.SceneMode&&mode===C.SceneMode.MORPHING){hide();return true;}
      const positions=new Map(),endpoints=new Map();
      const endpoint=id=>{if(!endpoints.has(id))endpoints.set(id,this.cartesianAt(id,utc,view.definition_hashes[id]));return endpoints.get(id);};
      for(const pair of view.pairs){
        const a=!['blocked','idle','none'].includes(pair.state)?endpoint(pair.a):null,b=a?endpoint(pair.b):null;
        positions.set(pair.key,a&&b?[a,b]:null);
      }
      if(port.verify(view,{utc})!==true||!current())throw Error('sampled authority changed during endpoints');
      const lines=this.linkCollection();if(!C?.Color||!C?.Material?.fromType||!lines||this.linkOwner!==viewer||!current())throw Error('sampled renderer unavailable');
      const keep=new Set();
      for(const pair of view.pairs){
        keep.add(pair.key);let entry=this.links.get(pair.key);
        if(!entry){entry={a:pair.a,b:pair.b,state:pair.state,positions:[],line:lines.add({id:`node-link-${pair.key}`,positions:[],show:false,width:2,material:this.linkMaterial(C,pair.state)})};this.links.set(pair.key,entry);}
        else if(entry.state!==pair.state){entry.line.material=this.linkMaterial(C,pair.state);entry.state=pair.state;}
        entry.a=pair.a;entry.b=pair.b;entry.material=entry.line.material;entry.presentation_kind=view.presentation_kind;entry.analysis_utc=view.analysis_utc;
        const value=positions.get(pair.key);if(value){entry.positions=value;entry.line.positions=value;}entry.line.show=!!value;
      }
      for(const key of [...this.links.keys()])if(!keep.has(key))this.removeLink(key);
      if(port.verify(view,{utc})!==true||!current())throw Error('sampled authority changed during publication');
      // The final context getters can revoke the analytical lease without a
      // renderer generation change. Owner proof must follow those callbacks;
      // only internal binding checks may follow the final owner verification.
      if(port.verify(view,{utc})!==true||!bound())throw Error('sampled lease changed after publication callbacks');
      this.linkReceipt=null;this.sampledLinkReceipt={presentation_kind:view.presentation_kind,analysis_utc:view.analysis_utc,display_utc:utc,age_seconds:view.age_seconds,scope,view};
      this.sampledFlowGuard=()=>{try{return current()&&port.verify(view,{utc})===true&&current()&&port.verify(view,{utc})===true&&bound();}catch{return false;}};return true;
    }catch{hide();return true;}
  }
  hideSampledLinks(){this.restoreAnalyticalRouteEmphasis(true);for(const entry of this.links.values())entry.line.show=false;this.sampledLinkReceipt=null;this.sampledFlowGuard=null;}
  restoreAnalyticalRouteEmphasis(revoke=false){
    if(revoke){this.analyticalRouteGeneration++;for(const value of [this.analyticalRouteLastView,this.analyticalRouteReceipt?.view,this.analyticalRouteCandidate])if(value&&typeof value==='object')this.revokedAnalyticalRoutes.add(value);this.analyticalRouteCandidate=null;this.analyticalRouteLastView=null;}
    for(const [entry,base]of this.analyticalRouteStyled){entry.line.width=base.width;entry.line.material=base.material;if(base.uniforms)base.uniforms.color=base.color;}
    this.analyticalRouteStyled.clear();this.analyticalRouteReceipt=null;
  }
  analyticalReadonly(value){
    const seen=new Set(),visit=v=>{if(!v||typeof v!=='object'||seen.has(v)||this.analyticalFrozen.has(v))return true;seen.add(v);return Object.isFrozen(v)&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d&&visit(d.value));};
    const valid=visit(value);if(valid)for(const v of seen)this.analyticalFrozen.add(v);return valid;
  }
  applyAnalyticalRouteEmphasis(utc){
    const ticket=++this.analyticalRouteGeneration;this.restoreAnalyticalRouteEmphasis();const port=this.analyticalRouteEmphasis;if(!port||this.disposed||!this.linksVisible)return false;
    const read=port.read,verify=port.verify,viewerProvider=this.viewerProvider,cesiumProvider=this.cesiumProvider,timeSource=this.timeSource,transition=this.isTransitioning,geometryFor=this.geometryFor,descriptions=this.descriptions,scope=this.definitionScope,links=this.links,generation=this.linkGeneration,baseReceipt=this.linkReceipt,sampledReceipt=this.sampledLinkReceipt;
    let viewer,C,view;const bound=()=>!this.disposed&&ticket===this.analyticalRouteGeneration&&this.analyticalRouteEmphasis===port&&port.read===read&&port.verify===verify&&viewerProvider===this.viewerProvider&&cesiumProvider===this.cesiumProvider&&timeSource===this.timeSource&&transition===this.isTransitioning&&geometryFor===this.geometryFor&&this.descriptions===descriptions&&this.definitionScope===scope&&this.links===links&&this.linkGeneration===generation&&this.linkReceipt===baseReceipt&&this.sampledLinkReceipt===sampledReceipt&&this.linksVisible&&this.linkOwner===viewer;
    const frame=()=>{const stamp=timeSource?.(),moving=transition(),v=this.viewer,c=this.cesium,mode=v?.scene?.mode;return stamp===utc&&!moving&&v===viewer&&c===C&&(!C?.SceneMode||mode!==C.SceneMode.MORPHING)&&bound();};
    const nodes=[...descriptions.values()].map(e=>e.definition),flowGuard=this.sampledFlowGuard;
    const baseProof=()=>baseReceipt?baseReceipt.utc===utc&&baseReceipt.scope===scope:sampledReceipt?.display_utc===utc&&sampledReceipt.scope===scope&&this.sampledFlowGuard===flowGuard&&typeof flowGuard==='function'&&flowGuard()===true;
    const proof=()=>baseProof()&&verify(view,{utc,nodes})===true&&bound();
    const fail=()=>{if(ticket===this.analyticalRouteGeneration){for(const value of [view,this.analyticalRouteLastView])if(value&&typeof value==='object')this.revokedAnalyticalRoutes.add(value);this.restoreAnalyticalRouteEmphasis();this.analyticalRouteCandidate=null;this.analyticalRouteLastView=null;}return false;};
    try{
      viewer=this.viewer;C=this.cesium;if(!frame()||(!baseReceipt&&!sampledReceipt))return fail();view=read({utc});if(!bound())return fail();this.analyticalRouteCandidate=view;
      if(!bound()||!view||this.revokedAnalyticalRoutes.has(view)||view.presentation_kind!=='MIXED_ROUTE_ANALYTICAL_UI_V1'||!this.analyticalReadonly(view)||view.display_utc!==utc||view.source!=='captured_native_analysis'||view.availability!=='accepted'||typeof view.analysis_utc!=='string'||!Number.isFinite(view.age_seconds)||view.current_analysis!==(view.analysis_utc===utc)||!view.fabric_view||!Object.entries(metadata).every(([k,v])=>view.native_snapshot?.[k]===v)||signature(view.node_definitions)!==scope||signature(view.native_snapshot.node_definitions)!==scope||signature(view.native_snapshot.definition_hashes)!==signature(view.definition_hashes)||!Array.isArray(view.oisl_links)||!Array.isArray(view.routed_ids)||!frame()||!proof())return fail();
      if(!view.definition_hashes||Object.keys(view.definition_hashes).length!==nodes.length)return fail();
      for(const n of nodes){const hash=view.definition_hashes[n.id];if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)||this.geometryAt(n.id,utc)?.definition_hash!==hash||!bound())return fail();}
      const routed=new Set(view.routed_ids),prepared=[],nativeLinks=new Map();
      for(const link of view.oisl_links){if(typeof link?.id!=='string'||nativeLinks.has(link.id))return fail();nativeLinks.set(link.id,link);}
      for(const [id,entry]of links){const native=nativeLinks.get(id);if(!native||!(native.a===entry.a&&native.b===entry.b||native.a===entry.b&&native.b===entry.a)||!entry.line.show||!routed.has(id)&&view.selected_id!==id)continue;
        const material=entry.line.material,uniforms=material?.uniforms&&'time'in material.uniforms?material.uniforms:null,color=routed.has(id)?C.Color.fromCssColorString('#a78bfa').withAlpha(uniforms?.55:.95):null;
        const override=routed.has(id)&&!uniforms?C.Material.fromType('Color',{color}):material;prepared.push({entry,base:{width:entry.line.width,material,uniforms,color:uniforms?.color},width:routed.has(id)?4.5:4,color,override});
      }
      if(!frame()||!proof())return fail();for(const item of prepared){this.analyticalRouteStyled.set(item.entry,item.base);item.entry.line.width=item.width;item.entry.line.material=item.override;if(item.color&&item.base.uniforms)item.base.uniforms.color=item.color;}
      // The terminal owner verifier is observational; only private binding checks follow it.
      if(!frame()||!proof()||!frame()||!proof())return fail();this.analyticalRouteReceipt={presentation_kind:view.presentation_kind,analysis_utc:view.analysis_utc,display_utc:utc,age_seconds:view.age_seconds,current_analysis:view.current_analysis,view};this.analyticalRouteLastView=view;this.analyticalRouteCandidate=null;return true;
    }catch{return fail();}
  }
  restoreRouteEmphasis(){
    for(const [entry,base]of this.routeStyled){entry.line.width=base.width;entry.line.material=base.material;if(base.uniforms)base.uniforms.color=base.color;}
    this.routeStyled.clear();
  }
  applyRouteEmphasis(utc){
    const ticket=++this.routeGeneration;this.restoreRouteEmphasis();if(this.disposed||!this.routeEmphasis||!this.linksVisible)return false;
    const port=this.routeEmphasis,viewerProvider=this.viewerProvider,cesiumProvider=this.cesiumProvider,descriptions=this.descriptions,scope=this.definitionScope,links=this.links,generation=this.linkGeneration;
    let viewer,C,view;
    const bound=()=>!this.disposed&&ticket===this.routeGeneration&&this.routeEmphasis===port&&this.viewerProvider===viewerProvider&&this.cesiumProvider===cesiumProvider&&this.descriptions===descriptions&&this.definitionScope===scope&&this.links===links&&this.linkGeneration===generation&&this.linksVisible&&this.linkOwner===viewer;
    const frame=()=>{const time=this.timeSource?.(),transition=this.isTransitioning(),v=this.viewer,c=this.cesium;return time===utc&&!transition&&v===viewer&&c===C&&(!c?.SceneMode||v?.scene?.mode!==c.SceneMode.MORPHING)&&bound();};
    try{
      const time=this.timeSource?.(),transition=this.isTransitioning();viewer=this.viewer;C=this.cesium;if(time!==utc||transition||C?.SceneMode&&viewer?.scene?.mode===C.SceneMode.MORPHING||!bound())return false;
      view=port.read({utc});if(!view||view.presentation_kind!=='MIXED_ROUTE_EMPHASIS_UI_V1'||!Object.isFrozen(view)||view.analysis_utc!==utc||signature(view.node_definitions)!==scope||!Array.isArray(view.oisl_links)||!Array.isArray(view.routed_ids)||!frame()||port.verify(view,{utc,nodes:[...descriptions.values()].map(e=>e.definition)})!==true||!bound())return false;
      if(!view.definition_hashes||Object.keys(view.definition_hashes).length!==descriptions.size||[...descriptions.keys()].some(id=>typeof view.definition_hashes[id]!=='string'||!/^[a-f0-9]{64}$/.test(view.definition_hashes[id])))return false;
      const routed=new Set(view.routed_ids),selected=view.selected_id,prepared=[];
      for(const [key,entry]of links){const native=view.oisl_links.find(l=>l.id===key&&(l.a===entry.a&&l.b===entry.b||l.b===entry.a&&l.a===entry.b));if(!native||!entry.line.show||!routed.has(key)&&selected!==key)continue;
        if(this.geometryAt(entry.a,utc)?.definition_hash!==view.definition_hashes[entry.a]||this.geometryAt(entry.b,utc)?.definition_hash!==view.definition_hashes[entry.b])throw Error('route native endpoint hash changed');
        const material=entry.line.material,uniforms=material?.uniforms&&'time'in material.uniforms?material.uniforms:null;
        const color=routed.has(key)?C.Color.fromCssColorString('#a78bfa').withAlpha(uniforms?.55:.95):null;
        const override=routed.has(key)&&!uniforms?C.Material.fromType('Color',{color}):material;
        prepared.push({entry,base:{width:entry.line.width,material,uniforms,color:uniforms?.color},width:routed.has(key)?4.5:4,color,override});
      }
      if(!frame()||port.verify(view,{utc,nodes:[...descriptions.values()].map(e=>e.definition)})!==true||!bound())return false;
      for(const item of prepared){this.routeStyled.set(item.entry,item.base);item.entry.line.width=item.width;item.entry.line.material=item.override;if(item.color&&item.base.uniforms)item.base.uniforms.color=item.color;}
      if(!frame()||port.verify(view,{utc,nodes:[...descriptions.values()].map(e=>e.definition)})!==true||!frame()||port.verify(view,{utc,nodes:[...descriptions.values()].map(e=>e.definition)})!==true||!bound()){if(ticket===this.routeGeneration)this.restoreRouteEmphasis();return false;}return true;
    }catch{if(ticket===this.routeGeneration)this.restoreRouteEmphasis();return false;}
  }
  placeDisplayLinks(utc){this.restoreAnalyticalRouteEmphasis();this.restoreRouteEmphasis();if(!this.placeSampledLinks(utc))this.placeLinks(utc);if(!this.frameMemo){this.applyRouteEmphasis(utc);this.applyAnalyticalRouteEmphasis(utc);}}
  animateLinkFlow(nowMs,utc=this.timeSource?.()){
    if(this.disposed)return;
    // Always recheck scope and endpoints; direct animation calls cannot revive stale results.
    this.placeDisplayLinks(utc);
    const sampledGuard=this.sampledFlowGuard;
    if(nowMs===undefined)try{nowMs=this.animationNow();}catch{this.restoreAnalyticalRouteEmphasis(true);this.restoreRouteEmphasis();if(sampledGuard)this.hideSampledLinks();return;}
    if(sampledGuard&&!sampledGuard()){this.hideSampledLinks();return;}
    if(!Number.isFinite(nowMs)){if(!this.frameMemo){this.restoreAnalyticalRouteEmphasis();this.applyRouteEmphasis(utc);this.applyAnalyticalRouteEmphasis(utc);}return;}
    const previous=sampledGuard?[]:null;
    for(const entry of this.links.values()){const uniforms=entry.line.material?.uniforms;if(entry.line.show&&entry.state==='locked'&&uniforms&&'time'in uniforms){previous?.push([uniforms,uniforms.time]);uniforms.time=nowMs/1000*OISL_FLOW_RATE;}}
    if(sampledGuard&&!sampledGuard()){for(const [uniforms,time]of previous)uniforms.time=time;this.hideSampledLinks();}
    if(!this.frameMemo){this.restoreAnalyticalRouteEmphasis();this.applyRouteEmphasis(utc);this.applyAnalyticalRouteEmphasis(utc);}
  }
  setLinksVisible(visible){if(this.disposed)return false;if(visible===false)this.restoreAnalyticalRouteEmphasis(true);this.linksVisible=visible!==false;this.placeDisplayLinks(this.timeSource?.());return this.linksVisible;}
  removeLink(key){const entry=this.links.get(key);if(!entry)return;entry.line.show=false;try{this.linkPolylines?.remove(entry.line);}catch{/* Owned primitive already gone. */}this.links.delete(key);}
  clearLinks(){this.restoreAnalyticalRouteEmphasis(true);this.routeGeneration++;this.restoreRouteEmphasis();this.linkGeneration++;for(const key of [...this.links.keys()])this.removeLink(key);this.linkReceipt=null;this.sampledLinkReceipt=null;this.sampledFlowGuard=null;this.sampledPairValidation=null;}

  select(id){if(this.disposed)return;this.selectedId=id==null?null:String(id);this.refreshMarkerStyles();this.placePoints(this.timeSource?.());this.placeModels(this.timeSource?.());for(const [key,p]of this.paths)p.entity.show=p.positions.length>1&&key!==this.selectedId&&this.tracksVisible()!==false;}
  setModelsVisible(visible){this.modelsVisible=visible!==false;this.placeModels(this.timeSource?.());return this.modelsVisible;}
  setTheme(theme){this.theme=theme==='light'?'light':'dark';this.refreshMarkerStyles();const C=this.cesium;if(C?.Color)for(const [id,p]of this.paths)p.entity.polyline.material=this.pathColor(C,id);}
  update(utc=this.timeSource?.()){if(this.disposed)return;this.placePoints(utc);this.placeModels(utc);this.placeDisplayLinks(utc);this.rebuildPaths();}
  syncFrame(utc,nowMs){
    if(this.disposed)return;
    const frame={utc,viewer:this.viewer,cesium:this.cesium,descriptions:this.descriptions,scope:this.definitionScope,transition:this.isTransitioning(),mode:this.viewer?.scene?.mode,geometry:new Map(),utcAdvances:new Map(),displayGeometry:this.displayGeometry,nativeRevision:null,advanceUtc:this.advanceUtc,invalid:false};
    this.frameMemo=frame;
    if(frame.displayGeometry){
      // Capture the owner token inside the already bound frame, so a revision
      // callback changing UTC, mode, Viewer or definitions cannot adopt a mixed
      // initial context. Only this first read has no prior token to compare.
      try{if(!this.frameCurrent(frame,false))frame.invalid=true;else frame.nativeRevision=frame.displayGeometry.revision();if(!this.frameCurrent(frame))frame.invalid=true;}catch{frame.invalid=true;}
    }
    // animateLinkFlow performs the guarded endpoint placement even when phase
    // is unavailable; do not write every OISL positions array twice per frame.
    try{this.placePoints(utc);this.placeModels(utc);this.animateLinkFlow(nowMs,utc);}
    finally{
      // A callback may replace a selection, Viewer or UTC within this frame.
      // Suppress every owned primitive rather than publish a mixture of scopes.
      if(!this.frameCurrent(frame)){this.restoreAnalyticalRouteEmphasis(true);this.restoreRouteEmphasis();for(const p of this.points.values())p.show=false;for(const label of this.labels.values())label.show=false;for(const m of this.models.values())m.model.show=false;for(const link of this.links.values())link.line.show=false;}else{this.applyRouteEmphasis(utc);this.applyAnalyticalRouteEmphasis(utc);}
      if(this.frameMemo===frame)this.frameMemo=null;
    }
  }
  clear(){this.loadToken++;this.clearLinks();if(this.linkPolylines)this.linkOwner?.scene?.primitives?.remove(this.linkPolylines);this.linkPolylines=null;this.linkOwner=null;for(const id of [...this.models.keys()])this.removeModel(id);for(const id of [...this.paths.keys()])this.removePath(id);for(const id of [...this.points.keys()])this.removeMarker(id);if(this.markerOwner){if(this.pointCollection)this.markerOwner.scene.primitives.remove(this.pointCollection);if(this.labelCollection)this.markerOwner.scene.primitives.remove(this.labelCollection);}this.pointCollection=null;this.labelCollection=null;this.markerOwner=null;this.descriptions.clear();this.definitionScope='[]';this.selectedId=null;this.hoveredId=null;}
  destroy(){if(this.disposed)return;this.clear();this.disposed=true;if(this.dataSource){this.dataSourceOwner?.dataSources?.remove?.(this.dataSource,true);this.dataSource=null;this.dataSourceOwner=null;}}
}
