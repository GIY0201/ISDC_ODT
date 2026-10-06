import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NodeScene,LINK_COLORS} from '../../../digital_twin/visualization/node_scene.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {createNodeSampleBuffer} from '../../../user_application/web/scripts/nodes/node_timeline.js';
const golden=JSON.parse(await readFile(new URL('../fixtures/original_node_scene.json',import.meta.url),'utf8'));
const markers=JSON.parse(await readFile(new URL('../fixtures/original_node_markers.json',import.meta.url),'utf8'));
const codec=createUtcCodec(LEAP_SHA256),utc=codec.advance('2026-10-04T00:00:00Z',0),hash='a'.repeat(64);
class Cartesian3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}static subtract(a,b,r){Object.assign(r,{x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});return r;}static magnitude(v){return Math.hypot(v.x,v.y,v.z);}static normalize(v,r){const m=this.magnitude(v);Object.assign(r,{x:v.x/m,y:v.y/m,z:v.z/m});return r;}}
class Color{constructor(css,alpha=1){Object.assign(this,{css,alpha});}static fromCssColorString(css){return new Color(css);}withAlpha(alpha){return new Color(this.css,alpha);}}
Color.WHITE=new Color('white');Color.TRANSPARENT=new Color('transparent',0);
class Collection{constructor(){this.items=[];}add(v){this.items.push(v);return v;}remove(v){const i=this.items.indexOf(v);if(i<0)return false;this.items.splice(i,1);v.destroy?.();return true;}}
const plain=v=>JSON.parse(JSON.stringify(v));
const definition=id=>({schema:1,id,catalog_number:900000+Number(id),orbit:{epoch:1791062400000,altitude_km:550,inclination:53}});
const description=id=>({url:'/models/'+id+'.glb',scale:2,minimumPixelSize:12,orientation:{heading:90}});
function fixture({load,geometry,path,palette,verifyLinkSnapshot,pathRevisionFor,displayGeometry=null,animationNow=()=>2000}={}){
 const loads=[],statuses=[],primitives=new Collection(),sources=new Collection();let display=utc,morph=false,tracks=true;
 const C={Cartesian3,Color,CustomDataSource:class{constructor(){this.entities=new Collection();}},CallbackProperty:class{constructor(getter){this.getter=getter;}},ArcType:{NONE:'none'},SceneMode:{MORPHING:0,SCENE3D:3},Matrix3:class{static fromHeadingPitchRoll(hpr){return {hpr};}static multiply(a,b){a.trim=b;return a;}},Matrix4:class{static fromRotationTranslation(rotation,translation){return {rotation,translation};}},HeadingPitchRoll:class{constructor(h,p,r){Object.assign(this,{h,p,r});}},Math:{toRadians:v=>v*Math.PI/180},Ellipsoid:{WGS84:{}},Transforms:{rotationMatrixFromPositionVelocity:(position,velocity)=>({position,velocity}),eastNorthUpToFixedFrame:position=>({enu:position})},ImageBasedLighting:class{constructor(options){this.options=options;}},Model:{async fromGltfAsync(options){loads.push(options);return load?load(options):{options,show:false,destroyed:false,destroy(){this.destroyed=true;}};}}};
 Object.assign(C,{PointPrimitiveCollection:Collection,LabelCollection:Collection,Cartesian2:class{constructor(x,y){Object.assign(this,{x,y});}},NearFarScalar:class{constructor(near,nearValue,far,farValue){Object.assign(this,{near,nearValue,far,farValue});}},LabelStyle:{FILL_AND_OUTLINE:'fill_outline'}});
 class Material{constructor(options){this.options=options;this.uniforms=options.fabric.uniforms;}static fromType(type,uniforms){return {type,uniforms};}}
 Object.assign(C,{Material,PolylineCollection:Collection});
 const viewer={scene:{primitives,mode:3},entities:new Collection(),dataSources:sources};
 const meta={model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:golden.source_commit,quality:'engineering_assumption'};
 const geometryFor=(node,{utc:stamp})=>{const row={utc:stamp,status:'valid',error_code:null,position_m:[Number(node.id)+codec.difference(stamp,utc)*10,10,550000]};const value={...meta,node_id:node.id,node_definition:structuredClone(node),definition_hash:hash,row};return geometry?geometry(value):value;};
 const pathFor=node=>{const value={...meta,node_id:node.id,node_definition:structuredClone(node),definition_hash:hash,center_utc:utc,visible:true,positions_m:golden.paths['1'].positions.map(p=>[p.x+Number(node.id)-1,p.y,p.z])};return path?path(value):value;};
 const scene=new NodeScene({viewer,cesium:C,verifyLinkSnapshot,pathRevisionFor,displayGeometry,animationNow,timeSource:()=>display,advanceUtc:codec.advance,geometryFor,pathFor,palette:palette??(()=>markers.palettes.dark),tracksVisible:()=>tracks,isTransitioning:()=>morph,onStatus:v=>statuses.push(v)});
 return {scene,loads,statuses,viewer,set display(v){display=v;},set morph(v){morph=v;},set tracks(v){tracks=v;}};
}
const entries=(count=2)=>Array.from({length:count},(_,i)=>({id:String(i+1),definition:definition(String(i+1)),model:description(String(i+1)),orbit_regime:'LEO'}));
test('fleet model picking adds explicit node identity while retaining original satellite identity',async()=>{
 const f=fixture();await f.scene.setNodes(entries(1));assert.equal(f.loads[0].id.nodeId,'1');assert.equal(f.loads[0].id.satelliteId,'1');f.scene.destroy();
});
test('source model options, native forward-difference display orientation and selected suppression match original',async()=>{
 const f=fixture();await f.scene.setNodes(entries());assert.deepEqual(LINK_COLORS,golden.colors);const sourceLoads=plain(f.loads);for(const load of sourceLoads)delete load.id.nodeId;assert.deepEqual(sourceLoads,golden.loads);
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
test('32 original marker style cases preserve density sizes colors alpha and distance scaling',async()=>{
 for(const c of markers.cases){const f=fixture({palette:theme=>markers.palettes[theme]}),nodes=entries(c.count).map(e=>({...e,definition:{...e.definition,name:'node '+e.id},model:null}));await f.scene.setNodes(nodes);f.scene.setTheme(c.theme);f.scene.setSdcMode(c.sdcMode);f.scene.select(c.selected);
  for(const [id,expected]of Object.entries(c.points)){const point={...plain(f.scene.points.get(id))};delete point.position;delete point.show;delete point.id;assert.deepEqual(point,expected.point,JSON.stringify(c));
   const label=plain(f.scene.labels.get(id));for(const key of ['text','font','outlineColor','outlineWidth','style','pixelOffset','scaleByDistance','disableDepthTestDistance'])assert.deepEqual(label[key],expected.label[key]);assert.equal(label.show,expected.labelWithPosition);
  }f.scene.destroy();
 }
});
test('source hover and filtered-selection exception apply only to owned native points',async()=>{
 const f=fixture();await f.scene.setNodes(entries(2));f.scene.setHovered('1');const p=f.scene.points.get('1');assert.equal(p.pixelSize,markers.hover.pixelSize);assert.deepEqual(plain(p.color),markers.hover.color);
 f.scene.setVisibleNodes([]);assert.equal(f.scene.labels.get('1').show,markers.filtered);f.scene.select('1');assert.equal(f.scene.labels.get('1').show,markers.selectedFilterException);assert.equal(f.scene.points.get('2').show,false);f.scene.destroy();
});
test('native points and labels appear before model loading finishes and survive asset rejection',async()=>{
 let reject;const f=fixture({load:()=>new Promise((_,fail)=>{reject=fail;})});const work=f.scene.setNodes(entries(1));assert.ok(reject);assert.equal(f.scene.points.get('1').show,true);assert.equal(f.scene.labels.get('1').show,true);assert.deepEqual(plain(f.scene.points.get('1').position),{x:1,y:10,z:550000});reject(Error('asset unavailable'));await work;assert.equal(f.scene.models.size,0);assert.equal(f.scene.points.get('1').show,true);f.scene.destroy();
});
test('failed or stale native rows hide points and labels and marker cleanup preserves foreign primitives',async()=>{
 let valid=true;const f=fixture({geometry:g=>valid?g:null});const foreign={};f.viewer.scene.primitives.add(foreign);await f.scene.setNodes(entries(1));valid=false;f.scene.syncFrame(utc);assert.equal(f.scene.points.get('1').show,false);assert.equal(f.scene.labels.get('1').show,false);f.scene.destroy();assert.deepEqual(f.viewer.scene.primitives.items,[foreign]);
});
function event(){const listeners=new Set();return {listeners,addEventListener(fn){listeners.add(fn);return ()=>listeners.delete(fn);},raise(value){for(const fn of [...listeners])fn(value);}};}
test('late glTF render failure keeps the native point and cannot re-show the failed model on later frames',async()=>{
 const ready=event(),error=event(),model={show:false,readyEvent:ready,errorEvent:error,destroy(){}};const f=fixture({load:()=>model});await f.scene.setNodes(entries(1));assert.equal(error.listeners.size,1);
 error.raise(Error('GPU asset error'));assert.equal(model.show,false);assert.equal(f.scene.points.get('1').show,true);assert.equal(f.statuses.at(-1).status,'model_unavailable');ready.raise();f.scene.setModelsVisible(true);f.scene.syncFrame(utc);assert.equal(model.show,false);f.scene.destroy();assert.equal(ready.listeners.size,0);assert.equal(error.listeners.size,0);
});
test('owned ready/error listeners are removed on disposal and captured late callbacks become inert',async()=>{
 const ready=event(),error=event(),model={show:false,readyEvent:ready,errorEvent:error,destroy(){}};const f=fixture({load:()=>model});await f.scene.setNodes(entries(1));assert.equal(ready.listeners.size,1);ready.raise();assert.equal(f.statuses.at(-1).status,'model_ready');const old=[...error.listeners][0];f.scene.destroy();const count=f.statuses.length;old(Error('late'));assert.equal(f.statuses.length,count);assert.equal(error.listeners.size,0);
});

const linksGolden=JSON.parse(await readFile(new URL('../fixtures/original_node_links.json',import.meta.url),'utf8'));
const linkSnapshot=(nodes=entries(),state='locked')=>({status:'valid',utc,source_commit:golden.source_commit,quality:'engineering_assumption',node_definitions:nodes.map(n=>structuredClone(n.definition)),terminals:[],pairs:[{key:'pair',a:'1',b:'2',state}]});
test('original OISL material state styles and phase match executed source; explicit verifier is component-only',async()=>{
 const f=fixture({verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries());
 for(const state of Object.keys(LINK_COLORS)){
  assert.equal(f.scene.setLinks(linkSnapshot(entries(),state)),true);const e=f.scene.links.get('pair'),g=linksGolden.states[state];
  assert.equal(e.line.width,g.width);assert.equal(e.line.show,g.show);assert.deepEqual(plain(e.line.material),g.material);
  if(e.line.show)assert.deepEqual(plain(e.line.positions),[{x:1,y:10,z:550000},{x:2,y:10,z:550000}]);
 }
 f.scene.setLinks(linkSnapshot());const material=f.scene.links.get('pair').line.material;f.scene.animateLinkFlow(5000);assert.equal(material.uniforms.time,linksGolden.phase);
 const next=linkSnapshot();next.pairs[0].a='2';next.pairs[0].b='1';f.scene.setLinks(next);assert.equal(f.scene.links.get('pair').line.material,material);
 f.scene.setLinksVisible(false);f.scene.animateLinkFlow(7000);assert.equal(material.uniforms.time,linksGolden.hiddenPhase);f.scene.destroy();
});
test('link receipts fail closed for absent verifier, wrong UTC roster source quality or malformed pairs',async()=>{
 const bad=[s=>({...s,status:'unknown'}),s=>({...s,utc:codec.advance(utc,1)}),s=>({...s,source_commit:'foreign'}),s=>({...s,quality:'measured'}),s=>({...s,node_definitions:s.node_definitions.slice(1)}),s=>({...s,terminals:null}),s=>({...s,pairs:[...s.pairs,...s.pairs]}),s=>({...s,pairs:[{key:'x',a:'1',b:'1',state:'locked'}]}),s=>({...s,pairs:[{key:'x',a:'1',b:'foreign',state:'locked'}]}),s=>({...s,pairs:[{key:'x',a:'1',b:'2',state:'invented'}]})];
 for(const verifier of [undefined,()=>false,()=>{throw Error('unavailable');}]){const f=fixture({verifyLinkSnapshot:verifier});await f.scene.setNodes(entries());assert.equal(f.scene.setLinks(linkSnapshot()),false);assert.equal(f.scene.links.size,0);f.scene.destroy();}
 for(const mutate of bad){const f=fixture({verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries());assert.equal(f.scene.setLinks(linkSnapshot()),true);assert.equal(f.scene.setLinks(mutate(linkSnapshot())),false);assert.equal(f.scene.links.size,0);f.scene.destroy();}
});
test('stale links hide and freeze flow; new matching snapshot reuses material; morph resumes current links',async()=>{
 const f=fixture({verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());const line=f.scene.links.get('pair').line,material=line.material;
 f.display=codec.advance(utc,1);f.scene.syncFrame(f.scene.timeSource());f.scene.animateLinkFlow(5000);assert.equal(line.show,false);assert.equal(material.uniforms.time,2.8);
 const fresh=linkSnapshot();fresh.utc=f.scene.timeSource();f.scene.setLinks(fresh);assert.equal(line.show,true);assert.equal(line.material,material);
 f.morph=true;f.scene.syncFrame(f.scene.timeSource(),6000);assert.equal(line.show,false);f.morph=false;f.scene.syncFrame(f.scene.timeSource(),7000);assert.equal(line.show,true);assert.equal(material.uniforms.time,7000/1000*1.4);f.scene.destroy();
});
test('each syncFrame reuses only its exact native poses for points, models and repeated link endpoints',async()=>{
 const calls=[];const f=fixture({geometry:g=>{calls.push([g.node_id,g.row.utc]);return g;},verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());calls.length=0;
 f.scene.syncFrame(utc,3000);assert.equal(calls.length,4,'two nodes/current plus forward native orientation sample');assert.equal(new Set(calls.map(c=>JSON.stringify(c))).size,4);const positions=plain(f.scene.links.get('pair').line.positions);
 calls.length=0;f.scene.syncFrame(utc,3016);assert.equal(calls.length,4,'next frame verifies fresh native poses');assert.deepEqual(plain(f.scene.links.get('pair').line.positions),positions);
 f.display=codec.advance(utc,1);calls.length=0;f.scene.syncFrame(f.scene.timeSource(),3032);assert.equal(calls.length,4);assert.equal(calls[0][1],f.scene.timeSource());assert.equal(f.scene.links.get('pair').line.show,false);f.scene.destroy();
});

test('frame-local cache hits do not reread external context and each OISL line is assigned once per frame',async()=>{
 let calls=0,checks=0;const f=fixture({geometry:g=>{calls++;return g;},verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());
 f.scene.isTransitioning=()=>{checks++;return false;};const line=f.scene.links.get('pair').line;let positions=line.positions,writes=0;
 Object.defineProperty(line,'positions',{get:()=>positions,set:value=>{writes++;positions=value;},configurable:true});calls=0;checks=0;
 f.scene.syncFrame(utc,3000);assert.equal(calls,4);assert.equal(writes,1,'one guarded endpoint placement before packet phase update');assert.ok(checks<=calls*2+4,`cache hits must not call the external transition reader again: ${checks}`);
 assert.equal(line.show,true);assert.equal(line.material.uniforms.time,3000/1000*1.4);assert.equal(f.scene.frameMemo,null);f.scene.destroy();
});

test('a later native buffer replacement at the same UTC is freshly validated and cannot reuse the prior frame',async()=>{
 let generation=0,bad=false;const f=fixture({geometry:g=>({...g,definition_hash:bad?'invalid hash':hash,row:{...g.row,position_m:[g.row.position_m[0]+generation*1000,...g.row.position_m.slice(1)]}}),verifyLinkSnapshot:()=>true});
 await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());f.scene.syncFrame(utc,3000);const original=plain(f.scene.points.get('1').position);
 generation++;f.scene.syncFrame(utc,3016);assert.equal(f.scene.points.get('1').position.x,original.x+1000);assert.equal(f.scene.links.get('pair').line.positions[0].x,original.x+1000);assert.equal(f.scene.frameMemo,null);
 bad=true;f.scene.syncFrame(utc,3032);assert.ok([...f.scene.points.values()].every(p=>!p.show));assert.ok([...f.scene.models.values()].every(m=>!m.model.show));assert.equal(f.scene.links.get('pair').line.show,false);assert.equal(f.scene.links.get('pair').line.material.uniforms.time,3016/1000*1.4);f.scene.destroy();
});

function nativeDisplayPort(offset=0){
 const nodes=entries(),request={request_id:'display-view',nodes:nodes.map(n=>n.definition),start_utc:utc,count:3,step_seconds:1};
 const response={schema_version:1,request_id:request.request_id,status:'valid',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:golden.source_commit,quality:'engineering_assumption',nodes:request.nodes.map(n=>({node_id:n.id,definition_hash:hash,rows:Array.from({length:3},(_,i)=>({utc:codec.advance(utc,i),status:'valid',error_code:null,position_m:[Number(n.id)+i*10+offset,10,550000],inertial_velocity_km_s:[0,7.5,0],raan_deg:0,argp_deg:0,mean_anomaly_deg:0,sunlit:true,longitude_deg:0,latitude_deg:0,height_km:550}))}))};
 return createNodeSampleBuffer(request,response).displayGeometry;
}

test('registered native display views preserve renderer poses and reject forged views or packets without using the public copy callback',async()=>{
 const owner=nativeDisplayPort();assert.ok(owner);let fallback=0;const f=fixture({displayGeometry:owner,geometry:()=>{fallback++;throw Error('public copy callback should not run');},verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());f.scene.syncFrame(utc,3000);
 assert.equal(fallback,0);assert.equal(f.scene.points.get('1').show,true);assert.deepEqual(plain(f.scene.models.get('1').model.modelMatrix),golden.models['1']);assert.equal(f.scene.links.get('pair').line.show,true);f.scene.destroy();
 for(const forged of ['view','packet']){const port={...owner,...(forged==='view'?{viewFor:node=>Object.freeze({...owner.viewFor(node)})}:{sampleAt:(view,at)=>structuredClone(owner.sampleAt(view,at))})};const g=fixture({displayGeometry:port,geometry:()=>{throw Error('no fallback');}});await g.scene.setNodes(entries());g.scene.syncFrame(utc,3000);assert.ok([...g.scene.points.values()].every(p=>!p.show));assert.ok([...g.scene.models.values()].every(m=>!m.model.show));g.scene.destroy();}
});

test('same-UTC native cohort replacement during an owner callback hides the entire cached frame and the next frame adopts fresh views',async()=>{
 let owner=nativeDisplayPort(),armed=false;assert.ok(owner);const newer=nativeDisplayPort(1000);
 const port={revision:()=>owner.revision(),viewFor:node=>owner.viewFor(node),isCurrent:view=>owner.isCurrent(view),verifySample:(...args)=>owner.verifySample(...args),sampleAt(view,at){const value=owner.sampleAt(view,at);if(armed&&view.node_id==='2'){armed=false;owner=newer;}return value;}};
 const f=fixture({displayGeometry:port,geometry:()=>{throw Error('no fallback');},verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());armed=true;f.scene.syncFrame(utc,3000);
 assert.ok([...f.scene.points.values()].every(p=>!p.show));assert.ok([...f.scene.models.values()].every(m=>!m.model.show));assert.ok([...f.scene.links.values()].every(l=>!l.line.show));assert.equal(f.scene.frameMemo,null);
 f.scene.syncFrame(utc,3016);assert.equal(f.scene.points.get('1').position.x,1001);assert.equal(f.scene.points.get('1').show,true);assert.equal(f.scene.links.get('pair').line.positions[0].x,1001);f.scene.destroy();
});

test('readonly projection owner callbacks remain fenced against UTC morph scope viewer disposal and thrown revocation',async()=>{
 for(const operation of ['viewFor','isCurrent','sampleAt','verifySample','revision'])for(const change of ['time','morph','scope','viewer','dispose','throw']){
  let owner=nativeDisplayPort(),armed=false,f;const port=Object.fromEntries(['revision','viewFor','isCurrent','sampleAt','verifySample'].map(name=>[name,(...args)=>{
   const value=owner[name](...args);if(armed&&name===operation){armed=false;if(change==='time')f.display=codec.advance(utc,1);else if(change==='morph')f.morph=true;else if(change==='scope')void f.scene.setNodes([{...entries(1)[0],definition:{...definition('1'),name:'edited'}}]);else if(change==='viewer')f.scene.viewerProvider={scene:{primitives:new Collection(),mode:3}};else if(change==='dispose')f.scene.destroy();else{owner=nativeDisplayPort(2000);throw Error('revoked during callback');}}return value;
  }]));
  f=fixture({displayGeometry:port,geometry:()=>{throw Error('no public fallback');},verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());owner=nativeDisplayPort(1000);armed=true;f.scene.syncFrame(utc,3000);
  assert.equal(armed,false,operation+' must be exercised');assert.ok([...f.scene.points.values()].every(p=>!p.show),operation+'/'+change+' points');assert.ok([...f.scene.models.values()].every(m=>!m.model.show),operation+'/'+change+' models');assert.ok([...f.scene.links.values()].every(l=>!l.line.show),operation+'/'+change+' links');assert.equal(f.scene.frameMemo,null);f.scene.destroy();
 }
});
test('time, definition scope, morph, viewer or destruction change in a geometry callback cannot publish a mixed frame',async()=>{
 for(const change of ['time','scope','morph','viewer','destroy']){
  let armed=false,count=0;const f=fixture({geometry:g=>{if(armed&&++count===2){if(change==='time')f.display=codec.advance(utc,1);else if(change==='scope')void f.scene.setNodes([{...entries(1)[0],definition:{...definition('1'),name:'changed'}}]);else if(change==='morph')f.morph=true;else if(change==='viewer')f.scene.viewerProvider={scene:{primitives:new Collection(),mode:3}};else f.scene.destroy();}return g;},verifyLinkSnapshot:()=>true});
  await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());armed=true;f.scene.syncFrame(utc,3000);
  assert.ok([...f.scene.points.values()].every(p=>p.show===false),change+' markers');assert.ok([...f.scene.models.values()].every(m=>m.model.show===false),change+' models');assert.ok([...f.scene.links.values()].every(l=>l.line.show===false),change+' links');assert.equal(f.scene.frameMemo,null);f.scene.destroy();
 }
});
test('copied verified receipts cannot be mutated by caller or verifier; edited scope invalidates immediately',async()=>{
 const f=fixture({verifyLinkSnapshot:(candidate,context)=>{candidate.pairs[0].state='blocked';context.nodes[0].orbit.altitude_km=999;return true;}});await f.scene.setNodes(entries());const receipt=linkSnapshot();assert.equal(f.scene.setLinks(receipt),true);receipt.pairs[0].state='blocked';f.scene.syncFrame(utc);assert.equal(f.scene.links.get('pair').line.show,true);
 const changed=entries();changed[0].definition.orbit.altitude_km=600;await f.scene.setNodes(changed);assert.equal(f.scene.links.size,0);f.scene.destroy();
});
test('missing native endpoint hides link without phase advance and scoped cleanup preserves foreign primitives',async()=>{
 let missing=false;const f=fixture({verifyLinkSnapshot:()=>true,geometry:g=>missing&&g.node_id==='2'?null:g});const foreign={};f.viewer.scene.primitives.add(foreign);await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());const line=f.scene.links.get('pair').line;missing=true;f.scene.syncFrame(utc,5000);assert.equal(line.show,false);assert.equal(line.material.uniforms.time,2.8);
 f.scene.destroy();assert.deepEqual(f.viewer.scene.primitives.items,[foreign]);assert.equal(f.scene.setLinks(linkSnapshot()),false);
});

test('same endpoint duplicate keys are rejected and removed pairs release only their owned line',async()=>{
 const f=fixture({verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries(3));const snapshot=linkSnapshot(entries(3));snapshot.pairs.push({key:'second',a:'2',b:'3',state:'one_way'});assert.equal(f.scene.setLinks(snapshot),true);
 const line=f.scene.links.get('second').line,single=linkSnapshot(entries(3));assert.equal(f.scene.setLinks(single),true);assert.equal(f.scene.linkPolylines.items.includes(line),false);
 single.pairs.push({key:'reverse',a:'2',b:'1',state:'locked'});assert.equal(f.scene.setLinks(single),false);assert.equal(f.scene.links.size,0);f.scene.destroy();
});
test('nonfinite render phase and wrong frame UTC never animate or draw current links',async()=>{
 const f=fixture({verifyLinkSnapshot:()=>true});await f.scene.setNodes(entries());f.scene.setLinks(linkSnapshot());const line=f.scene.links.get('pair').line;
 f.scene.syncFrame(codec.advance(utc,1),5000);assert.equal(line.show,false);assert.equal(line.material.uniforms.time,2.8);
 f.scene.syncFrame(utc,NaN);assert.equal(line.show,true);assert.equal(line.material.uniforms.time,2.8);f.scene.destroy();
});
test('verifier that changes live UTC cannot accept a captured old snapshot',async()=>{
 let f;f=fixture({verifyLinkSnapshot:()=>{f.display=codec.advance(utc,1);return true;}});await f.scene.setNodes(entries());assert.equal(f.scene.setLinks(linkSnapshot()),false);assert.equal(f.scene.links.size,0);f.scene.destroy();
});
test('render shader is preserved byte-for-byte from the pinned original source',async()=>{
 const {createHash}=await import('node:crypto');const bytes=await readFile(new URL('../../../digital_twin/visualization/link_flow.js',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),linksGolden.source_hashes['digital_twin/visualization/link_flow.js']);
});

test('all240 paths reuse native vectors across unchanged revisions and rebuild only on atomic acceptance',async()=>{
 let reads=0,token=Object.freeze({});const f=fixture({pathRevisionFor:()=>token,path:p=>{reads++;return p;}});const nodes=entries(240).map(n=>({...n,model:null}));await f.scene.setNodes(nodes);assert.equal(reads,240);const positions=f.scene.paths.get('1').positions;
 for(let i=0;i<20;i++)f.scene.update(utc);assert.equal(reads,240);assert.equal(f.scene.paths.get('1').positions,positions);
 f.tracks=false;f.scene.update(utc);assert.equal(f.scene.paths.get('1').entity.show,false);f.tracks=true;f.scene.update(utc);assert.equal(f.scene.paths.get('1').entity.show,true);assert.equal(reads,240);
 token=Object.freeze({});f.scene.update(utc);assert.equal(reads,480);assert.notEqual(f.scene.paths.get('1').positions,positions);f.scene.destroy();
});

test('all240 accepted paths use static Cesium positions and replace them only with a new native revision',async()=>{
 let token=Object.freeze({}),failed=false,reads=0;const f=fixture({pathRevisionFor:()=>token,path:p=>{reads++;return failed?{...p,visible:false,positions_m:[]}:p;}});
 await f.scene.setNodes(entries(240).map(n=>({...n,model:null})));assert.equal(reads,240);
 const original=new Map([...f.scene.paths].map(([id,p])=>[id,p.entity.polyline.positions]));
 for(const [id,p]of f.scene.paths){assert.ok(Array.isArray(p.entity.polyline.positions),`path ${id} must not use a nonconstant CallbackProperty`);assert.equal(p.entity.polyline.positions,p.positions);assert.equal(p.positions.length,121);}
 for(let i=0;i<3;i++)f.scene.update(utc);
 assert.equal(reads,240);for(const [id,p]of f.scene.paths)assert.equal(p.entity.polyline.positions,original.get(id));
 f.scene.select('1');assert.equal(f.scene.paths.get('1').entity.show,false);assert.equal(f.scene.paths.get('2').entity.show,true);
 f.morph=true;f.scene.syncFrame(utc,1000);f.morph=false;f.scene.syncFrame(utc,1016);
 for(const [id,p]of f.scene.paths)assert.equal(p.entity.polyline.positions,original.get(id));
 f.scene.setTheme('light');assert.equal(f.scene.paths.get('2').entity.polyline.material.alpha,golden.lightAlpha);
 token=Object.freeze({});f.scene.update(utc);assert.equal(reads,480);
 for(const [id,p]of f.scene.paths){assert.notEqual(p.entity.polyline.positions,original.get(id));assert.equal(p.entity.polyline.positions,p.positions);assert.equal(p.positions.length,121);}
 failed=true;token=Object.freeze({});f.scene.update(utc);
 for(const p of f.scene.paths.values()){assert.deepEqual(p.entity.polyline.positions,[]);assert.equal(p.entity.show,false);}
 failed=false;token=Object.freeze({});f.scene.update(utc);assert.equal(f.scene.paths.get('1').entity.show,false);assert.equal(f.scene.paths.get('2').entity.show,true);
 token=null;f.scene.update(utc);for(const p of f.scene.paths.values()){assert.deepEqual(p.entity.polyline.positions,[]);assert.equal(p.entity.show,false);}
 f.scene.destroy();
});
test('missing failed or changed path revisions cannot keep an old successful line',async()=>{
 let token=Object.freeze({}),failed=false;const f=fixture({pathRevisionFor:()=>token,path:p=>failed?{...p,visible:false,positions_m:[]}:p});await f.scene.setNodes(entries());assert.equal(f.scene.paths.get('1').entity.show,true);
 token=null;f.scene.update(utc);assert.equal(f.scene.paths.get('1').entity.show,false);assert.deepEqual(f.scene.paths.get('1').positions,[]);
 token=Object.freeze({});failed=true;f.scene.update(utc);assert.equal(f.scene.paths.get('1').entity.show,false);failed=false;token=Object.freeze({});f.scene.update(utc);assert.equal(f.scene.paths.get('1').entity.show,true);
 const changed=entries();changed[0].definition.orbit.altitude_km++;await f.scene.setNodes(changed);assert.equal(f.scene.paths.get('1').entity.show,true);f.scene.destroy();
});
test('revision changed while copying a path rejects the mixed receipt',async()=>{
 let token=Object.freeze({}),mutate=false;const f=fixture({pathRevisionFor:()=>token,path:p=>{if(mutate)token=Object.freeze({});return p;}});await f.scene.setNodes(entries(1));mutate=true;token=Object.freeze({});f.scene.update(utc);assert.equal(f.scene.paths.get('1').entity.show,false);assert.deepEqual(f.scene.paths.get('1').positions,[]);f.scene.destroy();
});

test('actual native track decoder revisions drive renderer reuse and whole-path failure replacement',async()=>{
 const {createNodeTrackBuffer}=await import('../../../user_application/web/scripts/nodes/node_timeline.js');const nodes=entries(),period=95.651;let buffer,reads=0;
 const build=(failed=false)=>{const request={request_id:'render-track',nodes:nodes.map(n=>n.definition),center_utc:utc};const response={schema_version:1,request_id:request.request_id,status:failed?'error':'valid',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:golden.source_commit,quality:'engineering_assumption',nodes:request.nodes.map(n=>({node_id:n.id,definition_hash:hash,period_minutes:period,path_visible:!failed,rows:Array.from({length:121},(_,i)=>({utc:codec.advance(new Date(Math.trunc(Date.parse(utc)+(i-60)*period*60000/120)).toISOString(),0),status:failed?'error':'valid',error_code:failed?'native_failure':null,position_m:failed?null:[i,Number(n.id),3],inertial_velocity_km_s:failed?null:[1,2,3],raan_deg:failed?null:1,argp_deg:failed?null:2,mean_anomaly_deg:failed?null:3,sunlit:failed?null:true,longitude_deg:failed?null:4,latitude_deg:failed?null:5,height_km:failed?null:550}))}))};return createNodeTrackBuffer(request,response,{periodFor:()=>period});};
 buffer=build();const f=fixture({pathRevisionFor:n=>buffer?.pathRevisionFor(n)??null,path:p=>{reads++;return buffer?.pathFor(p.node_definition)??null;}});await f.scene.setNodes(nodes);const positions=f.scene.paths.get('1').positions;assert.equal(reads,2);
 for(let i=0;i<30;i++)f.scene.update(utc);assert.equal(reads,2);assert.equal(f.scene.paths.get('1').positions,positions);assert.deepEqual(plain(positions[120]),{x:120,y:1,z:3});
 buffer=build(true);f.scene.update(utc);assert.equal(reads,4);assert.equal(f.scene.paths.get('1').entity.show,false);assert.deepEqual(f.scene.paths.get('1').positions,[]);buffer=null;f.scene.update(utc);assert.equal(reads,4);f.scene.destroy();
});
