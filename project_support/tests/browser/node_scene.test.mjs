import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NodeScene,LINK_COLORS} from '../../../digital_twin/visualization/node_scene.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const golden=JSON.parse(await readFile(new URL('../fixtures/original_node_scene.json',import.meta.url),'utf8'));
const codec=createUtcCodec(LEAP_SHA256),utc=codec.advance('2026-10-04T00:00:00Z',0),hash='a'.repeat(64);
class Cartesian3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}static subtract(a,b,r){Object.assign(r,{x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});return r;}static magnitude(v){return Math.hypot(v.x,v.y,v.z);}static normalize(v,r){const m=this.magnitude(v);Object.assign(r,{x:v.x/m,y:v.y/m,z:v.z/m});return r;}}
class Color{constructor(css,alpha=1){Object.assign(this,{css,alpha});}static fromCssColorString(css){return new Color(css);}withAlpha(alpha){return new Color(this.css,alpha);}}
class Collection{constructor(){this.items=[];}add(v){this.items.push(v);return v;}remove(v){const i=this.items.indexOf(v);if(i<0)return false;this.items.splice(i,1);v.destroy?.();return true;}}
const plain=v=>JSON.parse(JSON.stringify(v));
const definition=id=>({schema:1,id,catalog_number:900000+Number(id),orbit:{epoch:1791062400000,altitude_km:550,inclination:53}});
const description=id=>({url:'/models/'+id+'.glb',scale:2,minimumPixelSize:12,orientation:{heading:90}});
function fixture({load,geometry,path}={}){
 const loads=[],statuses=[],primitives=new Collection(),sources=new Collection();let display=utc,morph=false,tracks=true;
 const C={Cartesian3,Color,CustomDataSource:class{constructor(){this.entities=new Collection();}},CallbackProperty:class{constructor(getter){this.getter=getter;}},ArcType:{NONE:'none'},SceneMode:{MORPHING:0,SCENE3D:3},Matrix3:class{static fromHeadingPitchRoll(hpr){return {hpr};}static multiply(a,b){a.trim=b;return a;}},Matrix4:class{static fromRotationTranslation(rotation,translation){return {rotation,translation};}},HeadingPitchRoll:class{constructor(h,p,r){Object.assign(this,{h,p,r});}},Math:{toRadians:v=>v*Math.PI/180},Ellipsoid:{WGS84:{}},Transforms:{rotationMatrixFromPositionVelocity:(position,velocity)=>({position,velocity}),eastNorthUpToFixedFrame:position=>({enu:position})},ImageBasedLighting:class{constructor(options){this.options=options;}},Model:{async fromGltfAsync(options){loads.push(options);return load?load(options):{options,show:false,destroyed:false,destroy(){this.destroyed=true;}};}}};
 const viewer={scene:{primitives,mode:3},entities:new Collection(),dataSources:sources};
 const meta={model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:golden.source_commit,quality:'engineering_assumption'};
 const geometryFor=(node,{utc:stamp})=>{const row={utc:stamp,status:'valid',error_code:null,position_m:[Number(node.id)+codec.difference(stamp,utc)*10,10,550000]};const value={...meta,node_id:node.id,node_definition:structuredClone(node),definition_hash:hash,row};return geometry?geometry(value):value;};
 const pathFor=node=>{const value={...meta,node_id:node.id,node_definition:structuredClone(node),definition_hash:hash,center_utc:utc,visible:true,positions_m:golden.paths['1'].positions.map(p=>[p.x+Number(node.id)-1,p.y,p.z])};return path?path(value):value;};
 const scene=new NodeScene({viewer,cesium:C,timeSource:()=>display,advanceUtc:codec.advance,geometryFor,pathFor,palette:()=>({LEO:'#ff9f43',fallback:'#ff9f43'}),tracksVisible:()=>tracks,isTransitioning:()=>morph,onStatus:v=>statuses.push(v)});
 return {scene,loads,statuses,viewer,set display(v){display=v;},set morph(v){morph=v;},set tracks(v){tracks=v;}};
}
const entries=(count=2)=>Array.from({length:count},(_,i)=>({id:String(i+1),definition:definition(String(i+1)),model:description(String(i+1)),orbit_regime:'LEO'}));
test('source model options, native forward-difference display orientation and selected suppression match original',async()=>{
 const f=fixture();await f.scene.setNodes(entries());assert.deepEqual(LINK_COLORS,golden.colors);assert.deepEqual(plain(f.loads),golden.loads);
 assert.deepEqual(plain(f.scene.models.get('1').model.modelMatrix),golden.models['1']);assert.equal(f.scene.models.get('1').model.show,true);
 f.scene.select('1');assert.equal(f.scene.models.get('1').model.show,golden.selected.model);f.scene.setModelsVisible(false);assert.equal(f.scene.models.get('2').model.show,false);f.scene.destroy();
});
test('native121point paths preserve source widths colors and selected suppression in owned data source',async()=>{
 const f=fixture();await f.scene.setNodes(entries());assert.equal(f.viewer.dataSources.items.length,1);assert.equal(f.viewer.entities.items.length,0);
 const p=f.scene.paths.get('1');assert.deepEqual(plain(p.positions),golden.paths['1'].positions);assert.equal(p.entity.polyline.width,golden.paths['1'].width);assert.equal(p.entity.polyline.arcType,golden.paths['1'].arcType);assert.deepEqual(plain(p.entity.polyline.material),golden.paths['1'].material);
 f.scene.select('1');assert.equal(p.entity.show,golden.selected.path);f.scene.setTheme('light');assert.equal(p.entity.polyline.material.alpha,golden.lightAlpha);f.scene.destroy();assert.equal(f.viewer.dataSources.items.length,0);
});
test('all nodes retain paths while source64model cap is preserved and removed resources are scoped',async()=>{
 const f=fixture();const foreign={};f.viewer.scene.primitives.add(foreign);await f.scene.setNodes(entries(240));assert.equal(f.loads.length,golden.modelCap);assert.equal(f.scene.models.size,64);assert.equal(f.scene.paths.size,240);
 await f.scene.setNodes(entries(1));assert.equal(f.scene.models.size,1);assert.equal(f.scene.paths.size,1);f.scene.destroy();assert.deepEqual(f.viewer.scene.primitives.items,[foreign]);
});
test('failed foreign or nonfinite native geometry and incomplete paths never render as numeric success',async()=>{
 for(const mutate of [g=>null,g=>({...g,frame:'ITRF'}),g=>({...g,node_id:'foreign'}),g=>({...g,node_definition:{...g.node_definition,name:'changed'}}),g=>({...g,row:{...g.row,position_m:[NaN,0,0]}}),g=>({...g,row:{...g.row,status:'error',error_code:'native_error',position_m:null}})]){
  const f=fixture({geometry:mutate,path:p=>({...p,visible:false,positions_m:[]})});await f.scene.setNodes(entries(1));assert.equal(f.scene.models.get('1').model.show,false);assert.equal(f.scene.paths.get('1').entity.show,false);f.scene.destroy();
 }
});
test('morph hides models and missing second native sample uses source ENU fallback',async()=>{
 const f=fixture({geometry:g=>g.row.utc===utc?g:null});await f.scene.setNodes(entries(1));assert.deepEqual(plain(f.scene.models.get('1').model.modelMatrix),{enu:{x:1,y:10,z:550000}});
 f.morph=true;f.scene.syncFrame(utc);assert.equal(f.scene.models.get('1').model.show,false);f.morph=false;f.scene.syncFrame(utc);assert.equal(f.scene.models.get('1').model.show,true);f.scene.destroy();
});
test('late model load after clear is destroyed and cannot resurrect node resources',async()=>{
 let release;const model={destroyed:false,destroy(){this.destroyed=true;}};const f=fixture({load:()=>new Promise(resolve=>{release=()=>resolve(model);})});const work=f.scene.setNodes(entries(1));assert.ok(release);f.scene.clear();release();await work;assert.equal(model.destroyed,true);assert.equal(f.scene.models.size,0);assert.equal(f.scene.paths.size,0);assert.equal(f.viewer.dataSources.items.length,0);f.scene.destroy();
});
test('same-ID edited definition removes the old path before waiting for a replacement model',async()=>{
 let release;const f=fixture({load:options=>options.url==='/models/new.glb'?new Promise(resolve=>{release=()=>resolve({show:false,destroy(){}});}):{show:false,destroy(){}}});await f.scene.setNodes(entries(1));const changed=entries(1);changed[0].definition.orbit.altitude_km=600;changed[0].model.url='/models/new.glb';
 const work=f.scene.setNodes(changed);assert.ok(release);assert.equal(f.scene.paths.has('1'),false);release();await work;f.scene.destroy();
});
test('nonfinite foreign or short paths cannot reach the renderer; absent Cesium remains inert',async()=>{
 for(const mutate of [p=>({...p,frame:'ITRF'}),p=>({...p,node_id:'foreign'}),p=>({...p,positions_m:p.positions_m.slice(1)}),p=>({...p,positions_m:p.positions_m.map((v,i)=>i?[...v]:[NaN,0,0])})]){const f=fixture({path:mutate});await f.scene.setNodes(entries(1));assert.equal(f.scene.paths.get('1').entity.show,false);f.scene.destroy();}
 const scene=new NodeScene({viewer:null,cesium:null,advanceUtc:codec.advance,geometryFor:()=>null,pathFor:()=>null});await scene.setNodes(entries(1));scene.update(utc);assert.equal(scene.models.size,0);assert.equal(scene.paths.size,0);scene.destroy();
});
test('model load rejection retains valid native paths and reports availability without deleting foreign resources',async()=>{
 const f=fixture({load:()=>Promise.reject(Error('asset unavailable'))});await f.scene.setNodes(entries(1));assert.equal(f.scene.models.size,0);assert.equal(f.scene.paths.get('1').entity.show,true);assert.equal(f.statuses[0].status,'model_unavailable');f.scene.destroy();
});
test('caller input copies, selection and shared track visibility preserve source scope',async()=>{
 const f=fixture(),nodes=entries(1);await f.scene.setNodes(nodes);nodes[0].definition.orbit.altitude_km=1000;nodes[0].model.url='/bad.glb';assert.equal(f.scene.descriptions.get('1').definition.orbit.altitude_km,550);assert.equal(f.loads.length,1);
 f.tracks=false;f.scene.select(null);assert.equal(f.scene.paths.get('1').entity.show,false);f.tracks=true;f.scene.select(null);assert.equal(f.scene.paths.get('1').entity.show,true);f.scene.destroy();
});
