/** Original solar indicator geometry, with injected precise native-frame samples.
 * No ephemeris, transport, wall-clock UTC, Viewer or animation timer ownership.
 */
export class SolarDisplay {
  constructor(C,viewer,overlay,{now=()=>performance.now(),onStatus=()=>{}}={}){
    this.C=C;this.viewer=viewer;this.overlay=overlay;this.now=now;this.onStatus=onStatus;
    this.destroyed=false;this.sample=null;this.direction=null;this.light=null;
    this.theme='dark';this.enabled=true;this.lastProjection=-Infinity;this.owned=[];
    this.originalLight=viewer.scene.light;this.phase='unavailable';this.reason='no_solar_geometry';
    this.indicator='unavailable';this.statusKey=null;
    this._own(viewer.scene.sun,'show',false);
    this._own(viewer.scene.globe,'dynamicAtmosphereLightingFromSun',false);
    this._lighting();this._hide('unavailable');
    this.removePostRender=viewer.scene.postRender.addEventListener(()=>this.project());
    this._publish();
  }
  _own(object,key,value){
    if(!object)return;
    let record=this.owned.find(item=>item.object===object&&item.key===key);
    if(!record){record={object,key,original:object[key],last:value};this.owned.push(record);}
    record.last=value;object[key]=value;
  }
  _lighting(){
    const shaded=Boolean(this.sample)&&this.enabled;
    this._own(this.viewer.scene.globe,'enableLighting',shaded);
    this._own(this.viewer.scene.globe,'dynamicAtmosphereLighting',shaded);
    this._own(this.viewer.scene.globe,'dynamicAtmosphereLightingFromSun',false);
  }
  _hide(state){this.indicator=state;this.overlay.hidden=true;this.overlay.dataset.state=state;}
  status(){return{phase:this.phase,reason:this.reason,utc:this.sample?.utc??null,indicator:this.indicator,lighting:Boolean(this.viewer.scene.globe.enableLighting)};}
  _publish(){
    const status=this.status(),key=JSON.stringify(status);
    if(key!==this.statusKey){this.statusKey=key;this.onStatus({...status});}
  }
  setStyle(theme,enabled){
    if(this.destroyed)return false;
    if(!['dark','light'].includes(theme)||typeof enabled!=='boolean')throw Error('Invalid solar style');
    this.theme=theme;this.enabled=enabled;this._lighting();this._publish();this.viewer.scene.requestRender();return true;
  }
  update(value){
    if(this.destroyed)return false;
    const vector=value?.direction_to_sun;
    const quality=value?.eop_quality,labels=['final_b','observed_a','predicted_a'];
    let valid=value?.frame==='ITRF'&&value?.status==='valid'&&Array.isArray(vector)&&vector.length===3&&vector.every(Number.isFinite)
      &&Math.abs(Math.hypot(...vector)-1)<=1e-8&&typeof value.utc==='string'
      &&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value.utc)
      &&/^[a-f0-9]{64}$/.test(value.eop_sha256)&&/^[a-f0-9]{64}$/.test(value.leap_sha256)
      &&value.solar_model==='ERFA_builtin'&&value.frame_transform==='IAU2006_2000A'&&value.observed_cip_offsets===false
      &&labels.includes(quality?.ut1)&&labels.includes(quality?.polar_motion);
    if(valid)try{this.C.JulianDate.fromIso8601(value.utc);}catch{valid=false;}
    if(!valid){this.clear(value?'invalid_solar_geometry':'no_solar_geometry');return false;}
    this.sample={utc:value.utc,direction_to_sun:[...vector],eop_sha256:value.eop_sha256,leap_sha256:value.leap_sha256,
      eop_quality:{...quality},interpolated:Boolean(value.interpolated)};
    this.direction=new this.C.Cartesian3(...vector);
    if(!this.light){
      const options={direction:this.C.Cartesian3.negate(this.direction,new this.C.Cartesian3())};
      if(this.originalLight?.color)options.color=this.C.Color.clone(this.originalLight.color);
      if(Number.isFinite(this.originalLight?.intensity))options.intensity=this.originalLight.intensity;
      this.light=new this.C.DirectionalLight(options);
    }else this.C.Cartesian3.negate(this.direction,this.light.direction);
    this._own(this.viewer.scene,'light',this.light);
    this.phase='ready';this.reason=null;this.overlay.dataset.utc=value.utc;this._lighting();
    this.project();this._publish();this.viewer.scene.requestRender();return Boolean(this.sample);
  }
  clear(reason='no_solar_geometry'){
    if(this.destroyed)return;
    this.sample=null;this.direction=null;this.phase='unavailable';this.reason=reason;
    this.lastProjection=-Infinity;
    delete this.overlay.dataset.utc;delete this.overlay.dataset.x;delete this.overlay.dataset.y;
    this._own(this.viewer.scene,'light',this.originalLight);this._lighting();this._hide('unavailable');this._publish();this.viewer.scene.requestRender();
  }
  project(force=false){
    if(this.destroyed||!this.direction)return false;
    const C=this.C,scene=this.viewer.scene,camera=scene.camera;
    // Morph hiding cannot wait for the projection throttle.
    if(scene.mode!==C.SceneMode.SCENE3D){this._hide('2d');this._publish();return false;}
    if(C.Cartesian3.dot(camera.directionWC,this.direction)<=0){this._hide('behind-camera');this._publish();return false;}
    const now=this.now();
    if(!force&&now-this.lastProjection<50)return false;
    this.lastProjection=now;
    try{
      const blocked=C.IntersectionTests.rayEllipsoid(new C.Ray(camera.positionWC,this.direction),scene.globe.ellipsoid);
      // Positive start preserves the original rule; positive exit also hides an
      // inside/on-surface camera looking through Earth, missed by start>0 alone.
      if(blocked&&(blocked.start>0||blocked.stop>0)){this._hide('earth-occluded');this._publish();return false;}
      const point=C.Cartesian3.add(camera.positionWC,C.Cartesian3.multiplyByScalar(this.direction,80000000,new C.Cartesian3()),new C.Cartesian3());
      const project=C.SceneTransforms.worldToWindowCoordinates||C.SceneTransforms.wgs84ToWindowCoordinates;
      const screen=project?.(scene,point,new C.Cartesian2()),width=scene.canvas.clientWidth,height=scene.canvas.clientHeight;
      if(!screen||!Number.isFinite(screen.x)||!Number.isFinite(screen.y)||width<=0||height<=0
        ||screen.x< -45||screen.y< -45||screen.x>width+45||screen.y>height+45){this._hide('offscreen');this._publish();return false;}
      this.overlay.dataset.x=screen.x.toFixed(1);this.overlay.dataset.y=screen.y.toFixed(1);
      this.overlay.style.left=`${screen.x}px`;this.overlay.style.top=`${screen.y}px`;
      this.indicator='visible';this.overlay.dataset.state='visible';this.overlay.hidden=false;this._publish();return true;
    }catch{
      this.clear('projection_failed');return false;
    }
  }
  destroy(){
    if(this.destroyed)return;
    this.destroyed=true;this.removePostRender?.();this.removePostRender=null;
    this.sample=null;this.direction=null;delete this.overlay.dataset.utc;this._hide('destroyed');
    for(const {object,key,original,last} of this.owned)if(object[key]===last)object[key]=original;
    this.owned=[];this.light=null;this.phase='destroyed';this.reason=null;
    this.viewer.scene.requestRender();
  }
}
