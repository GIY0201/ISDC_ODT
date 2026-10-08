import test from 'node:test';
import assert from 'node:assert/strict';
import {SolarDisplay} from '../../../digital_twin/visualization/solar_display.js';

const utc='2020-07-12T21:16:01.000416000Z';
const xyz=v=>({x:v.x||0,y:v.y||0,z:v.z||0});
const value=(overrides={})=>({status:'valid',frame:'ITRF',utc,direction_to_sun:[1,0,0],eop_sha256:'a'.repeat(64),leap_sha256:'b'.repeat(64),solar_model:'ERFA_builtin',frame_transform:'IAU2006_2000A',observed_cip_offsets:false,eop_quality:{ut1:'final_b',polar_motion:'final_b'},...overrides});
function event(){const listeners=new Set();return{listeners,addEventListener(fn){listeners.add(fn);return()=>listeners.delete(fn);},raise(){for(const fn of [...listeners])fn();}};}
function fixture(){
 let now=0,screen={x:20,y:30},projectCount=0,lightCount=0,requests=0;const projected=[],states=[];
 class V {constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}static dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}static add(a,b,out){return Object.assign(out,{x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});}static multiplyByScalar(a,s,out){return Object.assign(out,{x:a.x*s,y:a.y*s,z:a.z*s});}static negate(a,out){return V.multiplyByScalar(a,-1,out);}}
 const C={Cartesian3:V,Cartesian2:class{},Ray:class{constructor(origin,direction){Object.assign(this,{origin,direction});}},SceneMode:{SCENE3D:3,SCENE2D:2,MORPHING:0},Color:{clone:v=>({...v})},DirectionalLight:class{constructor(options){Object.assign(this,options);lightCount++;}},JulianDate:{fromIso8601(v){if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v))throw Error('UTC');return v;}},SceneTransforms:{worldToWindowCoordinates(scene,p){projectCount++;projected.push({...p});return screen;}},IntersectionTests:{rayEllipsoid(ray){const o=ray.origin,d=ray.direction,b=V.dot(o,d),c=V.dot(o,o)-1,disc=b*b-c;if(disc<0)return;const low=-b-Math.sqrt(disc),high=-b+Math.sqrt(disc);if(high<0)return;return{start:Math.max(0,low),stop:high};}}};
 const originalLight={color:{red:1,green:.9,blue:.8,alpha:1},intensity:2};
 const viewer={scene:{mode:3,light:originalLight,sun:{show:true},globe:{enableLighting:true,dynamicAtmosphereLighting:true,dynamicAtmosphereLightingFromSun:true,ellipsoid:{}},camera:{positionWC:new V(10,0,0),directionWC:new V(1,0,0)},canvas:{clientWidth:400,clientHeight:240},postRender:event(),requestRender(){requests++;}},clock:{currentTime:'untouched'}};
 const overlay={hidden:false,dataset:{},style:{}};
 const display=new SolarDisplay(C,viewer,overlay,{now:()=>now,onStatus:s=>states.push(s)});
 return{display,C,viewer,overlay,originalLight,states,projected,setNow:x=>now=x,setScreen:x=>screen=x,counts:()=>({projectCount,lightCount,requests})};
}

test('native direction lights from opposite sign, copies input and preserves original light intensity',()=>{
 const f=fixture(),sample=value();assert.equal(f.viewer.scene.globe.enableLighting,false);assert.equal(f.viewer.scene.sun.show,false);
 assert.equal(f.display.update(sample),true);const light=f.viewer.scene.light;
 assert.deepEqual(xyz(light.direction),{x:-1,y:0,z:0});assert.equal(light.intensity,2);assert.deepEqual(light.color,f.originalLight.color);assert.notEqual(light.color,f.originalLight.color);
 assert.equal(f.viewer.scene.globe.dynamicAtmosphereLightingFromSun,false);assert.equal(f.overlay.hidden,false);assert.equal(f.overlay.dataset.state,'visible');assert.equal(f.overlay.style.left,'20px');assert.equal(f.overlay.dataset.utc,utc);
 assert.deepEqual(f.projected[0],{x:80000010,y:0,z:0});assert.equal(f.viewer.clock.currentTime,'untouched');assert.equal(f.C.Cartesian3.dot(new f.C.Cartesian3(1,0,0),light.direction),-1);
 sample.direction_to_sun[0]=999;f.states.at(-1).utc='mutated';assert.equal(f.display.status().utc,utc);
 f.display.setStyle('light',true);assert.equal(f.viewer.scene.globe.enableLighting,true);assert.equal(f.overlay.hidden,false);
 f.display.setStyle('dark',false);assert.equal(f.viewer.scene.globe.dynamicAtmosphereLighting,false);
 f.display.setStyle('dark',true);assert.equal(f.viewer.scene.globe.enableLighting,true);f.display.destroy();
});

test('original behind-camera/earth/tangent/2D hides and camera-inside edge never invents a visible Sun',()=>{
 const f=fixture();f.display.update(value());f.display.update(value({direction_to_sun:[-1,0,0]}));assert.equal(f.overlay.dataset.state,'behind-camera');
 f.viewer.scene.camera.directionWC=new f.C.Cartesian3(-1,0,0);f.display.project(true);assert.equal(f.overlay.dataset.state,'earth-occluded');
 f.viewer.scene.camera.positionWC=new f.C.Cartesian3(10,1,0);f.display.project(true);assert.equal(f.overlay.dataset.state,'earth-occluded');
 f.viewer.scene.camera.positionWC=new f.C.Cartesian3(0,0,0);f.viewer.scene.camera.directionWC=new f.C.Cartesian3(1,0,0);f.display.update(value());f.display.project(true);assert.equal(f.overlay.dataset.state,'earth-occluded');
 f.viewer.scene.camera.positionWC=new f.C.Cartesian3(1,0,0);f.display.project(true);assert.equal(f.overlay.hidden,false);
 f.viewer.scene.mode=2;f.viewer.scene.postRender.raise();assert.equal(f.overlay.hidden,true);assert.equal(f.overlay.dataset.state,'2d');
 f.viewer.scene.mode=0;f.viewer.scene.postRender.raise();assert.equal(f.overlay.hidden,true);
 f.viewer.scene.mode=3;f.setNow(100);f.viewer.scene.postRender.raise();assert.equal(f.overlay.hidden,false);f.display.destroy();
});

test('original45px margin, resize, undefined and nonfinite screen points never leave visible stale coordinates',()=>{
 const f=fixture();f.display.update(value());
 for(const screen of [{x:-45,y:-45},{x:445,y:285}]){f.setScreen(screen);f.display.project(true);assert.equal(f.overlay.hidden,false);}
 for(const screen of [{x:-45.1,y:0},{x:445.1,y:0},{x:0,y:285.1},{x:NaN,y:0},{x:0,y:Infinity},undefined]){f.setScreen(screen);f.display.project(true);assert.equal(f.overlay.hidden,true);assert.equal(f.overlay.dataset.state,'offscreen');}
 f.setScreen({x:410,y:200});f.viewer.scene.canvas.clientWidth=420;f.display.project(true);assert.equal(f.overlay.hidden,false);f.viewer.scene.canvas.clientWidth=300;f.display.project(true);assert.equal(f.overlay.hidden,true);f.display.destroy();
});

test('50ms throttle affects projection only and retains one listener/light at30/60/144Hz and background jumps',()=>{
 for(const rate of [30,60,144]){
  const f=fixture();f.viewer.scene.camera.directionWC=new f.C.Cartesian3(Math.SQRT1_2,Math.SQRT1_2,0);f.display.update(value());const first=f.counts().projectCount;
  for(let i=1;i<=rate;i++){f.setNow(i*1000/rate);f.display.update(value({utc:`2020-07-12T21:16:01.${String(i).padStart(9,'0')}Z`,direction_to_sun:[0,1,0]}));f.viewer.scene.postRender.raise();}
  assert.equal(f.counts().lightCount,1);assert.ok(f.counts().projectCount-first<=20);assert.ok(f.counts().projectCount-first>=14);assert.deepEqual(xyz(f.viewer.scene.light.direction),{x:0,y:-1,z:0});assert.equal(f.viewer.scene.postRender.listeners.size,1);
  f.setNow(100000);f.viewer.scene.camera.directionWC=new f.C.Cartesian3(0,1,0);f.viewer.scene.postRender.raise();assert.equal(f.overlay.hidden,false);f.display.destroy();
 }
});

test('missing/invalid/frame/hash/model/UTC data clears solar shading and cannot reuse the last valid result',()=>{
 const f=fixture();
 for(const invalid of [null,value({frame:'TEME'}),value({utc:'local'}),value({direction_to_sun:[0,0,0]}),value({direction_to_sun:[2,0,0]}),value({direction_to_sun:[NaN,0,0]}),value({eop_sha256:'bad'}),value({solar_model:'synthetic'}),value({observed_cip_offsets:true}),value({status:'error'}),value({status:'unknown'}),value({eop_quality:{ut1:'unknown',polar_motion:'final_b'}})]){
  f.display.update(value());assert.equal(f.display.update(invalid),false);assert.equal(f.overlay.hidden,true);assert.equal(f.viewer.scene.globe.enableLighting,false);assert.equal(f.viewer.scene.light,f.originalLight);assert.equal(f.display.status().utc,null);
 }
 f.display.update(value());f.display.clear('out_of_range');assert.equal(f.display.status().reason,'out_of_range');assert.equal(f.overlay.dataset.utc,undefined);f.display.destroy();
});

test('projection failure disables owned shading and explicit fresh input can retry',()=>{
 const f=fixture(),project=f.C.SceneTransforms.worldToWindowCoordinates;
 f.C.SceneTransforms.worldToWindowCoordinates=()=>{throw Error('projection failed');};
 assert.equal(f.display.update(value()),false);assert.equal(f.display.status().reason,'projection_failed');assert.equal(f.viewer.scene.globe.enableLighting,false);assert.equal(f.overlay.hidden,true);
 f.C.SceneTransforms.worldToWindowCoordinates=project;assert.equal(f.display.update(value()),true);assert.equal(f.overlay.hidden,false);
 f.display.clear('out_of_range');assert.equal(f.display.update(value()),true);assert.equal(f.overlay.hidden,false);f.display.destroy();
});

test('destroy restores owned flags, does not destroy Viewer or overwrite an externally replaced light',()=>{
 const f=fixture();f.display.update(value());f.display.destroy();f.display.destroy();
 assert.equal(f.viewer.scene.light,f.originalLight);assert.equal(f.viewer.scene.sun.show,true);assert.equal(f.viewer.scene.globe.enableLighting,true);assert.equal(f.viewer.scene.globe.dynamicAtmosphereLightingFromSun,true);assert.equal(f.viewer.scene.postRender.listeners.size,0);assert.equal(f.overlay.hidden,true);
 const count=f.counts().requests;assert.equal(f.display.update(value()),false);f.viewer.scene.postRender.raise();assert.equal(f.counts().requests,count);
 const g=fixture();g.display.update(value());const other={external:true};g.viewer.scene.light=other;g.display.destroy();assert.equal(g.viewer.scene.light,other);
});
