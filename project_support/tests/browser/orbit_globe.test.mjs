import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OrbitGlobe} from '../../../digital_twin/visualization/orbit_globe.js';

function fixture(){
  const viewers=[];
  class Viewer {
    constructor(container,options){this.options=options;this.items=[];this.clock={};this.scene={globe:{},requestRender(){}};this.camera={viewBoundingSphere(){},lookAtTransform(){}};this.entities={add:value=>(this.items.push(value),value),removeAll:()=>this.items.splice(0)};viewers.push(this);}
    destroy(){this.destroyed=true;}
  }
  class Cartesian3 {constructor(x,y,z){Object.assign(this,{x,y,z});}}
  const C={Viewer,Cartesian3,Color:{CYAN:'cyan',WHITE:'white',fromCssColorString:v=>v},JulianDate:{fromIso8601:v=>v},ConstantPositionProperty:class{constructor(value,frame){this.value=value;this.frame=frame;}},ReferenceFrame:{FIXED:'fixed'},BoundingSphere:class{},HeadingPitchRange:class{},Matrix4:{IDENTITY:{}},EllipsoidTerrainProvider:class{}};
  const globe=new OrbitGlobe(C,{});
  const sample={frame:'ITRF',utc:'2020-07-12T21:16:01.000416000Z',position_m:[6202527.7,-2633530.38,881293.8],input_id:'tle',input_hash:'hash',revision:3};
  return {globe,viewers,sample};
}
test('ITRF metres are fixed-frame coordinates and clock uses the exact injected UTC',()=>{
  const {globe,viewers,sample}=fixture();globe.update(sample);
  const viewer=viewers[0];assert.deepEqual({...viewer.items[0].position.value},{x:sample.position_m[0],y:sample.position_m[1],z:sample.position_m[2]});
  assert.equal(viewer.items[0].position.frame,'fixed');assert.equal(viewer.clock.currentTime,sample.utc);assert.equal(viewer.clock.shouldAnimate,false);
  sample.position_m[0]=0;assert.equal(viewer.items[0].position.value.x,6202527.7);
});

test('shared node palette is a copy of source colors for both themes',async()=>{
 const {globe}=fixture(),source=JSON.parse(await readFile(new URL('../fixtures/original_node_markers.json',import.meta.url),'utf8'));
 for(const theme of ['dark','light']){const copy=globe.palette(theme);for(const key of ['LEO','MEO','GEO','HEO','fallback','selected','hover','pathOutline'])assert.equal(copy[key],source.palettes[theme][key]);copy.LEO='changed';assert.equal(globe.palette(theme).LEO,source.palettes[theme].LEO);}
 globe.destroy();assert.deepEqual(globe.palette('dark'),{});
});

test('camera UI routes through the existing owner and queued scene morph rejects all commands',()=>{
 const {globe,viewers}=fixture(),calls=[];
 globe.cameraMotion.zoomState=()=>({zoom:44});globe.cameraMotion.zoomBy=value=>{calls.push(['wheel',value]);return true;};globe.cameraMotion.setZoom=value=>{calls.push(['slider',value]);return true;};globe.cameraMotion.home=()=>{calls.push(['home']);return true;};
 assert.deepEqual(globe.cameraState(),{ready:true,zoom:44});assert.equal(globe.zoomBy(120),true);assert.equal(globe.setZoom(50),true);assert.equal(globe.home(),true);assert.equal(viewers.length,1);
 globe.viewControls.cancelMorph=()=>{};assert.deepEqual(globe.cameraState(),{ready:false,zoom:null});assert.equal(globe.zoomBy(120),false);assert.equal(globe.setZoom(50),false);assert.equal(globe.home(),false);assert.equal(calls.length,3);
 globe.destroy();assert.equal(globe.home(),false);
});
test('catalog marker labels describe the current model rather than implying epoch time during playback',()=>{
 const {globe,sample}=fixture();globe.update({...sample,name:'ISS (ZARYA)',epoch_utc:sample.utc,utc:'2020-07-12T21:17:01.000416000Z'});
 assert.equal(globe.entity.label.text,'ISS (ZARYA) · GP 모델');assert.equal(globe.entity.name,'ISS (ZARYA) · SGP4 모델');
});
test('updates reuse one Viewer and unavailable or malformed data clears the previous marker',()=>{
  const {globe,viewers,sample}=fixture();globe.update(sample);globe.update({...sample,revision:4});assert.equal(viewers.length,1);assert.equal(viewers[0].items.length,1);
  for(const bad of [null,{...sample,frame:'TEME'},{...sample,position_m:[NaN,2,3]},{...sample,utc:'invalid'}]){globe.update(bad);assert.equal(viewers[0].items.length,0);assert.equal(globe.focus(),false);}
  globe.update(sample);assert.equal(globe.focus(),true);globe.destroy();globe.destroy();assert.equal(viewers[0].destroyed,true);assert.throws(()=>globe.update(sample),/destroyed/);
});

test('virtual WGS84 point reuses Viewer and survives missing satellite rows',()=>{const {globe,viewers,sample}=fixture();globe.C.Cartesian3.fromDegrees=(lon,lat,height)=>({lon,lat,height});viewers[0].entities.remove=entity=>{const index=viewers[0].items.indexOf(entity);if(index>=0)viewers[0].items.splice(index,1);};const ground={latitude_deg:33.5,longitude_deg:126.5,ellipsoid_height_m:100,virtual:true,ellipsoid:'WGS84'};globe.setGroundPoint(ground);globe.update(sample);globe.update(null);assert.equal(viewers.length,1);assert.equal(viewers[0].items.length,1);assert.equal(viewers[0].items[0].id,'virtual-ground-point');assert.deepEqual(viewers[0].items[0].position.value,{lon:126.5,lat:33.5,height:100});globe.setGroundPoint({...ground,ellipsoid_height_m:500});assert.equal(viewers[0].items.length,1);assert.equal(viewers[0].items[0].position.value.height,500);});

test('unchanged ground coordinates retain one position property during orbit playback',()=>{const {globe,viewers,sample}=fixture();globe.C.Cartesian3.fromDegrees=(lon,lat,height)=>({lon,lat,height});const ground={latitude_deg:33.5,longitude_deg:126.5,ellipsoid_height_m:0,virtual:true,ellipsoid:'WGS84'};globe.setGroundPoint(ground);const property=globe.groundEntity.position;for(let i=0;i<20;i++){globe.update(sample);globe.setGroundPoint({...ground});}assert.equal(globe.groundEntity.position,property);assert.equal(viewers.length,1);globe.setGroundPoint({...ground,ellipsoid_height_m:100});assert.notEqual(globe.groundEntity.position,property);});
