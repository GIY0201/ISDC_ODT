// Isolated rendering CPU adapter, not a live Viewer or optical acceptance test.
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {NodeScene} from '../../digital_twin/visualization/node_scene.js';
import {createNodeSampleBuffer} from '../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../user_application/web/scripts/orbit_utc.js';
const input=JSON.parse(await readFile(process.argv[2]??'data/workspace/validation/native_scene_40_input.json','utf8'));
const codec=createUtcCodec(LEAP_SHA256),utc=input.request.start_utc,buffer=createNodeSampleBuffer(input.request,input.response);
if(codec.difference(codec.advance(input.network_time,0),utc)!==0)throw Error('Captured network and native sample UTC differ');
class Collection{constructor(){this.items=[];}add(v){this.items.push(v);return v;}remove(v){const i=this.items.indexOf(v);if(i<0)return false;this.items.splice(i,1);return true;}}
class Cartesian3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}static subtract(a,b,r){Object.assign(r,{x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});return r;}static magnitude(v){return Math.hypot(v.x,v.y,v.z);}static normalize(v,r){const m=this.magnitude(v);Object.assign(r,{x:v.x/m,y:v.y/m,z:v.z/m});return r;}}
class Color{constructor(css,alpha=1){Object.assign(this,{css,alpha});}static fromCssColorString(css){return new Color(css);}withAlpha(a){return new Color(this.css,a);}}
class Material{constructor(o){this.uniforms=o.fabric.uniforms;}static fromType(type,uniforms){return {type,uniforms};}}
const C={Cartesian3,Color,Material,PolylineCollection:Collection,PointPrimitiveCollection:Collection,LabelCollection:Collection,Cartesian2:class{},NearFarScalar:class{},LabelStyle:{FILL_AND_OUTLINE:1},SceneMode:{MORPHING:0,SCENE3D:3},CustomDataSource:class{constructor(){this.entities=new Collection();}},Math:{toRadians:v=>v*Math.PI/180},Ellipsoid:{WGS84:{}},Matrix3:class{},Matrix4:class{static fromRotationTranslation(r,t){return {r,t};}},Transforms:{rotationMatrixFromPositionVelocity:(r,v)=>({r,v}),eastNorthUpToFixedFrame:p=>({p})},Model:{async fromGltfAsync(){return {show:false,destroy(){}};}}};
const viewer={scene:{primitives:new Collection(),mode:3},entities:new Collection(),dataSources:new Collection()};
let geometryCalls=0;
const scene=new NodeScene({viewer,cesium:C,timeSource:()=>utc,advanceUtc:codec.advance,geometryFor:(node,display)=>{geometryCalls++;return buffer.geometryFor(node,display);},pathFor:()=>null,verifyLinkSnapshot:()=>true});
// Reproduce the preceding native renderer's two methods in memory only; no
// source checkout, Viewer, server or runtime mutation is needed for comparison.
const uncached=process.argv.includes('--uncached');
if(uncached){
 scene.geometryAt=function(id,stamp){const entry=this.descriptions.get(id);if(!entry||typeof stamp!=='string')return null;try{if(this.advanceUtc(stamp,0)!==stamp)return null;const g=this.geometryFor(structuredClone(entry.definition),{utc:stamp});return this.matches(g,id)&&g.row?.utc===stamp&&g.row.status==='valid'&&g.row.error_code===null&&Array.isArray(g.row.position_m)&&g.row.position_m.length===3&&g.row.position_m.every(Number.isFinite)?g:null;}catch{return null;}};
 scene.syncFrame=function(stamp,now){if(!this.disposed){this.placePoints(stamp);this.placeModels(stamp);this.placeLinks(stamp);this.animateLinkFlow(now,stamp);}};
}
await scene.setNodes(input.request.nodes.map(n=>({id:n.id,definition:n,model:{url:'/profile-adapter.glb'},orbit_regime:'LEO'})));
const meta={source_commit:input.response.source_commit,quality:input.response.quality};
if(!scene.setLinks({...meta,status:'valid',utc,node_definitions:input.request.nodes,terminals:[],pairs:input.links.map(l=>({...l,key:l.id}))}))throw Error('Display adapter rejected captured edge scope');
const samples=[];geometryCalls=0;
for(let i=0;i<30;i++){const t=performance.now();scene.syncFrame(utc,i*16);samples.push(performance.now()-t);}
const sorted=[...samples].sort((a,b)=>a-b);
console.log(JSON.stringify({provenance:input.provenance,mode:uncached?'preceding_uncached_methods':'current_frame_memo',nodes:input.request.nodes.length,edges:input.links.length,frames:samples.length,geometry_calls:geometryCalls,geometry_calls_per_frame:geometryCalls/samples.length,median_ms:sorted[15],p95_ms:sorted[28],min_ms:sorted[0],max_ms:sorted.at(-1),cpu_samples_ms:samples}));scene.destroy();
