// NodeScene display port from ISDC-ODT 1a1e002. Shared Viewer and native buffers are injected.
// Orientation follows a one-second fixed-position difference: display approximation, not attitude.
const MAX_MODELS=64,AMBIENT_IRRADIANCE=.62;
export const LINK_COLORS=Object.freeze({locked:'#3ddc84',one_way:'#4ac4ee',acquiring:'#ffc357',slewing:'#ffa040',blocked:'#ff6b6b',idle:'#8ea4b8',none:'#8ea4b8'});
const PATH_ALPHA={dark:.28,light:.45};
const metadata={model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption'};
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
function signature(value){const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;return JSON.stringify(ordered(value));}

export class NodeScene{
  constructor({viewer,cesium,timeSource,advanceUtc,geometryFor,pathFor,palette=()=>({}),tracksVisible=()=>true,isTransitioning=()=>false,onStatus=()=>{}}={}){
    if(typeof advanceUtc!=='function'||typeof geometryFor!=='function'||typeof pathFor!=='function')throw new TypeError('node scene native display dependencies required');
    Object.assign(this,{viewerProvider:viewer,cesiumProvider:cesium,timeSource,advanceUtc,geometryFor,pathFor,palette,tracksVisible,isTransitioning,onStatus});
    this.models=new Map();this.descriptions=new Map();this.paths=new Map();this.selectedId=null;this.theme='dark';this.loadToken=0;this.modelsVisible=true;this.disposed=false;this.dataSource=null;this.dataSourceOwner=null;
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
  geometryAt(id,utc){
    const entry=this.descriptions.get(id);if(!entry||typeof utc!=='string')return null;
    try{if(this.advanceUtc(utc,0)!==utc)return null;const g=this.geometryFor(structuredClone(entry.definition),{utc});return this.matches(g,id)&&g.row?.utc===utc&&g.row.status==='valid'&&g.row.error_code===null&&vector(g.row.position_m)?g:null;}catch{return null;}
  }
  cartesianAt(id,utc,expectedHash){const C=this.cesium,g=this.geometryAt(id,utc);return C?.Cartesian3&&g&&(!expectedHash||g.definition_hash===expectedHash)?new C.Cartesian3(...g.row.position_m):null;}
  async setNodes(entries){
    if(this.disposed)return;if(!Array.isArray(entries)||entries.length>240)throw new Error('node scene limit0..240');
    const next=new Map();for(const value of entries){if(typeof value?.id!=='string'||!value.id.trim()||next.has(value.id)||value.definition?.id!==value.id||value.definition.schema!==1)throw new Error('node scene definitions required');const entry=structuredClone(value);entry.signature=signature(entry.definition);next.set(entry.id,entry);}
    for(const [id,entry]of this.descriptions)if(next.get(id)?.signature!==entry.signature){this.removePath(id);const model=this.models.get(id);if(model)model.model.show=false;}
    this.descriptions=next;
    for(const id of [...this.models.keys()])if(!next.has(id))this.removeModel(id);
    for(const id of [...this.paths.keys()])if(!next.has(id))this.removePath(id);
    if(this.selectedId&&!next.has(this.selectedId))this.selectedId=null;
    const loading=this.loadModels(),token=this.loadToken;await loading;if(!this.disposed&&token===this.loadToken)this.update(this.timeSource?.());
  }
  modelKey(id){const d=this.descriptions.get(id)?.model;return d?.url?`${d.url}|${Number(d.scale)>0?d.scale:1}`:null;}
  async loadModels(){
    const C=this.cesium,viewer=this.viewer,token=++this.loadToken;if(!C?.Model?.fromGltfAsync||!viewer?.scene?.primitives)return;
    let count=this.models.size;
    for(const [id,entry]of this.descriptions){
      if(this.disposed||token!==this.loadToken)return;
      const d=entry.model,key=this.modelKey(id),existing=this.models.get(id);if(existing?.key===key)continue;if(existing){this.removeModel(id);count--;}
      if(!key||count>=MAX_MODELS)continue;count++;let model;
      try{model=await C.Model.fromGltfAsync({url:d.url,id:{satelliteId:id},scale:Number(d.scale)>0?Number(d.scale):1,minimumPixelSize:Number(d.minimumPixelSize)||12,allowPicking:true,show:false,imageBasedLighting:this.ambientLighting(C)});}catch(e){this.status(id,'model_unavailable',String(e.message||e));continue;}
      if(this.disposed||token!==this.loadToken||viewer!==this.viewer||!this.descriptions.has(id)||this.modelKey(id)!==key){model.destroy?.();continue;}
      this.models.set(id,{model:viewer.scene.primitives.add(model),owner:viewer,key,orientation:structuredClone(d.orientation||{})});this.status(id,'model_loaded');
    }
  }
  removeModel(id){const entry=this.models.get(id);if(!entry)return;try{entry.owner.scene.primitives.remove(entry.model);}catch{/* Owner already removed. */}this.models.delete(id);}
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
    for(const [id,entry]of this.models){const g=!morph&&id!==this.selectedId&&this.modelsVisible?this.geometryAt(id,utc):null;if(!g){entry.model.show=false;continue;}const here=new C.Cartesian3(...g.row.position_m);entry.model.modelMatrix=this.bodyMatrix(C,id,here,utc,entry.orientation,g.definition_hash);entry.model.show=true;}
  }
  pathColor(C,id){const palette=this.palette(this.theme)||{},regime=this.descriptions.get(id)?.orbit_regime;return C.Color.fromCssColorString(palette[String(regime||'').toUpperCase()]||palette.fallback||'#ff9f43').withAlpha(PATH_ALPHA[this.theme]);}
  rebuildPaths(){
    if(!this.descriptions.size)return;const C=this.cesium,entities=this.entityCollection();if(!C?.Cartesian3||!entities)return;
    for(const [id,description]of this.descriptions){
      let receipt;try{receipt=this.pathFor(structuredClone(description.definition));}catch{receipt=null;}
      const valid=this.matches(receipt,id)&&receipt.visible===true&&Array.isArray(receipt.positions_m)&&receipt.positions_m.length===121&&receipt.positions_m.every(vector);
      const points=valid?receipt.positions_m.map(v=>new C.Cartesian3(...v)):[];
      let entry=this.paths.get(id);if(!entry){entry={positions:points,entity:null};entry.entity=entities.add({id:`node-path-${id}`,show:false,polyline:{positions:C.CallbackProperty?new C.CallbackProperty(()=>entry.positions,false):points,width:1.3,material:this.pathColor(C,id),arcType:C.ArcType?.NONE}});this.paths.set(id,entry);}else{entry.positions=points;if(!C.CallbackProperty)entry.entity.polyline.positions=points;}
      entry.entity.show=points.length>1&&id!==this.selectedId&&this.tracksVisible()!==false;
    }
  }
  removePath(id){const entry=this.paths.get(id);if(!entry)return;try{this.dataSource?.entities.remove(entry.entity);}catch{/* Owned entity already gone. */}this.paths.delete(id);}
  select(id){if(this.disposed)return;this.selectedId=id==null?null:String(id);this.placeModels(this.timeSource?.());for(const [key,p]of this.paths)p.entity.show=p.positions.length>1&&key!==this.selectedId&&this.tracksVisible()!==false;}
  setModelsVisible(visible){this.modelsVisible=visible!==false;this.placeModels(this.timeSource?.());return this.modelsVisible;}
  setTheme(theme){this.theme=theme==='light'?'light':'dark';const C=this.cesium;if(C?.Color)for(const [id,p]of this.paths)p.entity.polyline.material=this.pathColor(C,id);}
  update(utc=this.timeSource?.()){if(this.disposed)return;this.placeModels(utc);this.rebuildPaths();}
  syncFrame(utc){if(!this.disposed)this.placeModels(utc);}
  clear(){this.loadToken++;for(const id of [...this.models.keys()])this.removeModel(id);for(const id of [...this.paths.keys()])this.removePath(id);this.descriptions.clear();this.selectedId=null;}
  destroy(){if(this.disposed)return;this.clear();this.disposed=true;if(this.dataSource){this.dataSourceOwner?.dataSources?.remove?.(this.dataSource,true);this.dataSource=null;this.dataSourceOwner=null;}}
}
