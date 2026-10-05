import test from 'node:test';import assert from 'node:assert/strict';
import {OrbitGlobe} from '../../../digital_twin/visualization/orbit_globe.js';
function fixture(){const collections=[],handlers=[],viewers=[],allocations={colors:0,scales:0};
 class Collection{constructor(){this.items=[];collections.push(this);}add(v){this.items.push(v);return v;}removeAll(){this.items=[];}}
 class Handler{constructor(){handlers.push(this);}setInputAction(fn){this.pick=fn;}destroy(){this.dead=true;}}
 class Viewer{constructor(){this.clock={};this.items=[];this.entities={add:v=>(this.items.push(v),v),remove:v=>this.items.splice(this.items.indexOf(v),1)};this.scene={canvas:{},globe:{},pick:()=>this.picked,requestRender(){},primitives:{add:v=>v,remove:v=>{v.removed=true;}}};this.camera={};viewers.push(this);}destroy(){this.dead=true;}}
 class Color{constructor(css,alpha=1){allocations.colors++;Object.assign(this,{css,alpha});}withAlpha(alpha){return new Color(this.css,alpha);}static fromCssColorString(css){return new Color(css);}}
 const C={Viewer,Color,Cartesian3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}},Cartesian2:class{},ConstantPositionProperty:class{constructor(value){this.value=value;}},ReferenceFrame:{FIXED:'fixed'},JulianDate:{fromIso8601:v=>v},EllipsoidTerrainProvider:class{},PointPrimitiveCollection:Collection,LabelCollection:Collection,NearFarScalar:class{constructor(){allocations.scales++;}},LabelStyle:{FILL_AND_OUTLINE:1},ScreenSpaceEventHandler:Handler,ScreenSpaceEventType:{LEFT_CLICK:1}};
 Color.WHITE=new Color('white');Color.CYAN=new Color('cyan');Color.TRANSPARENT=new Color('transparent');return{globe:new OrbitGlobe(C,{}),collections,handlers,viewers,allocations};
}
const utc='2020-07-12T21:16:01.000416000Z';
const scene=(n=16633)=>({frame:'ITRF',utc,scene_sha256:'a'.repeat(64),count:n,valid_count:n,error_count:0,rows:Array.from({length:n},(_,i)=>({catalog_number:i+1,name:'sat'+i,status:'valid',normalized_gp_sha256:'b'.repeat(64),epoch_utc:utc,orbit_regime:['LEO','MEO','GEO','HEO'][i%4],position_m:[7000000,i+1,0]}))});
test('whole16633 point primitives use original colors/size/occlusion and one Viewer/pick handler',()=>{
 const {globe,collections,viewers,handlers}=fixture(),picked=[];const data=scene();globe.setCatalogScene(data,n=>picked.push(n));
 assert.equal(globe.catalogPoints.size,16633);assert.equal(viewers.length,1);assert.equal(handlers.length,1);
 const point=globe.catalogPoints.get(16633);assert.equal(point.pixelSize,2.4);assert.equal(point.disableDepthTestDistance,0);assert.equal(point.color.css,'#ff9f43');
 assert.equal(globe.catalogPoints.get(2).color.css,'#e6ed55');assert.equal(globe.catalogPoints.get(3).color.css,'#5ee277');assert.equal(globe.catalogPoints.get(4).color.css,'#53c8ff');
 globe.viewer.picked={id:point.id};handlers[0].pick({position:{}});assert.deepEqual(picked,[16633]);
 data.rows[0].position_m[0]=0;assert.equal(globe.catalogPoints.get(1).position.x,7000000);
 globe.setCatalogScene(scene());assert.equal(globe.catalogPoints.get(16633),point);assert.equal(collections.length,2);
 for(let i=0;i<20;i++)globe.update({frame:'ITRF',utc,position_m:[1,2,3]});assert.equal(collections.length,2);globe.destroy();assert.equal(handlers[0].dead,true);
});
test('failed rows get no point, small labels and selected marker use own UTC without duplicate selected point',()=>{
 const {globe}=fixture(),data=scene(3);data.rows[1]={...data.rows[1],status:'error',position_m:null,error_code:'decayed'};data.valid_count=2;data.error_count=1;
 globe.setCatalogScene(data);assert.equal(globe.catalogPoints.size,2);assert.equal(globe.catalogLabels.size,2);
 globe.update({...data.rows[0],frame:'ITRF',utc:'2020-07-12T21:17:01.000416000Z'});assert.equal(globe.catalogPoints.get(1).show,false);assert.equal(globe.viewer.clock.currentTime,'2020-07-12T21:17:01.000416000Z');
 globe.update(null);assert.equal(globe.catalogPoints.get(1).show,true);globe.setCatalogScene(null);assert.equal(globe.catalogPoints.size,0);assert.equal(globe.catalogLabels.size,0);globe.destroy();
});
test('a previously valid selected point stays hidden when the new snapshot fails and selected display is cleared',()=>{
 const {globe}=fixture(),data=scene(1);globe.setCatalogScene(data);globe.update({...data.rows[0],frame:'ITRF',utc});
 const failed={...data,valid_count:0,error_count:1,rows:[{...data.rows[0],status:'error',error_code:'decayed',position_m:null}]};globe.setCatalogScene(failed);globe.update(null);assert.equal(globe.catalogPoints.get(1).show,false);globe.destroy();
});

test('full scene style allocation scales with visual classes and epoch aging refreshes retained points',()=>{
 const {globe,allocations}=fixture(),before={...allocations},data=scene();globe.setCatalogScene(data);
 assert.ok(allocations.colors-before.colors<=8,'four orbit classes should share colors');assert.ok(allocations.scales-before.scales<=2,'distance scales should be shared');
 const point=globe.catalogPoints.get(1);assert.equal(point.color.alpha,.9);
 globe.setCatalogScene({...data,utc:'2020-07-16T21:16:01.000416000Z'});assert.equal(globe.catalogPoints.get(1),point);assert.equal(point.color.alpha,.56);
 globe.setCatalogScene(data);assert.equal(point.color.alpha,.9);globe.destroy();
});

test('unchanged GP epoch parsing is reused across UTC refreshes but replaced epoch is reparsed',()=>{
 const {globe}=fixture(),data=scene();globe.setCatalogScene(data);const parse=Date.parse;let calls=0;
 Date.parse=value=>{calls++;return parse(value);};
 try{globe.setCatalogScene({...data,utc:'2020-07-16T21:16:01.000416000Z'});assert.equal(calls,1);assert.equal(globe.catalogPoints.get(1).color.alpha,.56);
  const changed=scene(1);changed.scene_sha256='d'.repeat(64);changed.rows[0].epoch_utc='2020-07-16T21:16:01.000416000Z';changed.utc=changed.rows[0].epoch_utc;globe.setCatalogScene(changed);assert.equal(calls,3);assert.equal(globe.catalogPoints.get(1).color.alpha,.98);
 }finally{Date.parse=parse;globe.destroy();}
});
