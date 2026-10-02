import test from 'node:test';
import assert from 'node:assert/strict';
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
test('updates reuse one Viewer and unavailable or malformed data clears the previous marker',()=>{
  const {globe,viewers,sample}=fixture();globe.update(sample);globe.update({...sample,revision:4});assert.equal(viewers.length,1);assert.equal(viewers[0].items.length,1);
  for(const bad of [null,{...sample,frame:'TEME'},{...sample,position_m:[NaN,2,3]},{...sample,utc:'invalid'}]){globe.update(bad);assert.equal(viewers[0].items.length,0);assert.equal(globe.focus(),false);}
  globe.update(sample);assert.equal(globe.focus(),true);globe.destroy();globe.destroy();assert.equal(viewers[0].destroyed,true);assert.throws(()=>globe.update(sample),/destroyed/);
});

test('virtual WGS84 point reuses Viewer and survives missing satellite rows',()=>{const {globe,viewers,sample}=fixture();globe.C.Cartesian3.fromDegrees=(lon,lat,height)=>({lon,lat,height});viewers[0].entities.remove=entity=>{const index=viewers[0].items.indexOf(entity);if(index>=0)viewers[0].items.splice(index,1);};const ground={latitude_deg:33.5,longitude_deg:126.5,ellipsoid_height_m:100,virtual:true,ellipsoid:'WGS84'};globe.setGroundPoint(ground);globe.update(sample);globe.update(null);assert.equal(viewers.length,1);assert.equal(viewers[0].items.length,1);assert.equal(viewers[0].items[0].id,'virtual-ground-point');assert.deepEqual(viewers[0].items[0].position.value,{lon:126.5,lat:33.5,height:100});globe.setGroundPoint({...ground,ellipsoid_height_m:500});assert.equal(viewers[0].items.length,1);assert.equal(viewers[0].items[0].position.value.height,500);});
