import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {NodeScene} from '../../../digital_twin/visualization/node_scene.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
let serial=0;
function event(){const listeners=new Set();return {listeners,addEventListener(fn){listeners.add(fn);return()=>listeners.delete(fn);},raise(...args){for(const fn of [...listeners])fn(...args);}};}
async function fixture({boot=true,displayUtc='2020-07-12T21:16:01Z'}={}){
 const instances=[],frames=event(),errors=event(),loads=[];let now=1234;
 globalThis.NodeBoundGlobe=class{
  constructor(){this.viewer={scene:{preRender:frames,renderError:errors}};instances.push(this);}
  update(value){this.row=value;return Boolean(value);}focus(){return true;}setGroundPoint(){}setViewStyle(){}setViewImagery(){}setCatalogScene(){}setCatalogTrack(){}
  setNodeInteraction(value){this.interaction=value;}
  destroy(){this.destroyed=true;}
 };
 const source=await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8');
 const code=source.replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href)).replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.NodeBoundGlobe;')+`\n// fixture ${++serial}`;
 const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 const host={...(boot?{Cesium:{}}:{}),performance:{now:()=>now},setTimeout:()=>1,clearTimeout(){},addEventListener:(name,fn)=>{if(name==='load')loads.push(fn);},removeEventListener(){}};
 const ui=createWorkspaceGlobe({dataset:{}},{},{addEventListener(){},removeEventListener(){}},host);
 const utc=createUtcCodec(LEAP_SHA256).advance(displayUtc,0),hash='a'.repeat(64),row={utc,position_m:[1,2,3],status:'valid'},state={input_id:'ISS',input_hash:hash,revision:1,current_utc:utc};
 const display=()=>ui.update({status:'ready',state,result:{...state,frame:'ITRF',leap_sha256:hash,rows:[row]}});
 return {ui,host,frames,errors,instances,loads,display,utc,set now(value){now=value;}};
}

test('node interaction binds preboot to the shared globe and fences replaced or disposed callbacks',async()=>{
 const f=await fixture({boot:false}),selected=[];
 const remove=f.ui.bindNodeInteraction({owns:()=>true,onSelect:id=>selected.push(id),onHover:()=>{}});
 f.host.Cesium={};f.loads[0]();const old=f.instances[0].interaction;assert.equal(old.owns('N',{}),true);old.onSelect('N');
 f.ui.bindNodeInteraction({owns:()=>false,onSelect:id=>selected.push('new:'+id)});assert.equal(old.owns('N',{}),false);old.onSelect('old');remove();
 assert.ok(f.instances[0].interaction);assert.deepEqual(selected,['N']);f.ui.destroy();old.onSelect('disposed');assert.deepEqual(selected,['N']);
});

test('shared camera port is unavailable preboot, observes existing node frame and fences disposal',async()=>{
 const f=await fixture({boot:false}),seen=[],calls=[];f.ui.observeCamera(value=>seen.push(value));
 assert.deepEqual(f.ui.cameraState(),{ready:false,zoom:null});assert.equal(f.ui.zoomBy(120),false);
 f.host.Cesium={};f.loads[0]();const owner=f.instances[0];owner.cameraState=()=>({ready:true,zoom:30});
 owner.zoomBy=value=>{calls.push(['wheel',value]);return true;};owner.setZoom=value=>{calls.push(['zoom',value]);return true;};owner.home=()=>{calls.push(['home']);return true;};
 f.ui.bindNodeRenderer(()=>({syncFrame(){},destroy(){}}));f.frames.raise();assert.deepEqual(seen.at(-1),{ready:true,zoom:30});
 assert.equal(f.ui.zoomBy(120),true);assert.equal(f.ui.setZoom(40),true);assert.equal(f.ui.home(),true);assert.deepEqual(calls,[['wheel',120],['zoom',40],['home']]);
 const count=seen.length;f.frames.raise();assert.equal(seen.length,count);f.ui.destroy();assert.equal(f.ui.home(),false);assert.equal(f.ui.zoomBy(120),false);assert.deepEqual(f.ui.cameraState(),{ready:false,zoom:null});
});
test('reentrant interaction cleanup cannot replace a newer owner or let an older remover clear it',async()=>{
 const f=await fixture(),selected=[];let rebind=false;
 f.ui.bindNodeInteraction({owns:()=>true,onHover:()=>{if(rebind)f.ui.bindNodeInteraction({owns:()=>true,onSelect:()=>selected.push('newest')});}});
 rebind=true;const remove=f.ui.bindNodeInteraction({owns:()=>false,onSelect:()=>selected.push('outer')});
 f.instances[0].interaction.onSelect('N');assert.deepEqual(selected,['newest']);remove();assert.ok(f.instances[0].interaction);f.ui.destroy();
});
test('node renderer uses the existing Viewer and display UTC; source frame callbacks create no clock',async()=>{
 const f=await fixture(),calls=[];let destroyed=0,solarDestroyed=0;
 f.ui.bindSolarRenderer(()=>({destroy(){solarDestroyed++;}}));
 const remove=f.ui.bindNodeRenderer((C,viewer)=>{assert.equal(C,f.host.Cesium);assert.equal(viewer,f.instances[0].viewer);return {syncFrame:(utc,now)=>calls.push([utc,now]),destroy(){destroyed++;}};});
 assert.equal(f.instances.length,1);assert.equal(f.frames.listeners.size,1);assert.equal(f.ui.nodeRendererState().phase,'ready');
 f.display();f.frames.raise();assert.deepEqual(calls.at(-1),[f.utc,1234]);f.now=2000;f.frames.raise();assert.deepEqual(calls.at(-1),[f.utc,2000]);
 f.ui.update({status:'pending',state:{},result:null});f.frames.raise();assert.deepEqual(calls.at(-1),[null,2000],'missing common UTC must hide stale native positions');
 remove();assert.equal(destroyed,1);assert.equal(f.frames.listeners.size,0);assert.equal(solarDestroyed,0);assert.equal(f.instances[0].destroyed,undefined);
 remove();f.ui.destroy();assert.equal(destroyed,1);assert.equal(solarDestroyed,1);assert.equal(f.instances[0].destroyed,true);
});

test('preboot binding attaches once and old removers cannot detach a replacement renderer',async()=>{
 const f=await fixture({boot:false});let attached=0,firstDestroyed=0,secondDestroyed=0;
 const old=f.ui.bindNodeRenderer(()=>{attached++;return {syncFrame(){},destroy(){firstDestroyed++;}};});
 assert.equal(f.ui.nodeRendererState().phase,'pending');assert.equal(attached,0);f.host.Cesium={};f.loads[0]();assert.equal(attached,1);
 const next=f.ui.bindNodeRenderer(()=>({syncFrame(){},destroy(){secondDestroyed++;}}));assert.equal(firstDestroyed,1);old();assert.equal(secondDestroyed,0);assert.equal(f.frames.listeners.size,1);
 next();assert.equal(secondDestroyed,1);assert.equal(f.frames.listeners.size,0);f.ui.destroy();
});

test('renderer errors release only node resources and preserve the GP globe and solar owner',async()=>{
 for(const failure of ['factory','frame']){
  const f=await fixture();let destroyed=0,solarDestroyed=0,frameCalls=0;f.ui.bindSolarRenderer(()=>({destroy(){solarDestroyed++;}}));
  f.ui.bindNodeRenderer(()=>{if(failure==='factory')throw Error('node factory');return {syncFrame(){frameCalls++;throw Error('node frame');},destroy(){destroyed++;}};});
  if(failure==='frame'){const callback=[...f.frames.listeners][0];f.frames.raise();callback();assert.equal(frameCalls,1,'already queued callbacks cannot call a destroyed renderer');}assert.equal(f.ui.nodeRendererState().phase,'error');assert.equal(f.frames.listeners.size,0);assert.equal(solarDestroyed,0);assert.equal(f.instances[0].destroyed,undefined);
  f.display();assert.equal(f.instances[0].row.utc,f.utc);f.ui.destroy();assert.equal(destroyed,failure==='frame'?1:0);assert.equal(solarDestroyed,1);
 }
});

test('global render failure and disposal detach node listeners before destroying the shared Viewer',async()=>{
 const f=await fixture();let destroyed=0;
 f.ui.bindNodeRenderer(()=>({syncFrame(){},destroy(){assert.equal(f.instances[0].destroyed,undefined);assert.equal(f.frames.listeners.size,0);destroyed++;}}));
 f.errors.raise();assert.equal(destroyed,1);assert.equal(f.instances[0].destroyed,true);assert.equal(f.frames.listeners.size,0);assert.notEqual(f.ui.nodeRendererState().phase,'ready');f.ui.destroy();assert.equal(destroyed,1);
 assert.throws(()=>f.ui.bindNodeRenderer(null),TypeError);
});

test('reentrant factory replacement and readonly observer errors cannot claim a newer binding',async()=>{
 const f=await fixture();let oldDestroyed=0,newDestroyed=0;
 f.ui.observeNodeRenderer(value=>{value.phase='foreign';throw Error('observer');});
 const remove=f.ui.bindNodeRenderer(()=>{
  f.ui.bindNodeRenderer(()=>({syncFrame(){},destroy(){newDestroyed++;}}));
  return {syncFrame(){},destroy(){oldDestroyed++;}};
 });
 assert.equal(oldDestroyed,1);assert.equal(f.ui.nodeRendererState().phase,'ready');assert.equal(f.frames.listeners.size,1);
 remove();assert.equal(newDestroyed,0);f.ui.destroy();assert.equal(newDestroyed,1);assert.equal(f.frames.listeners.size,0);
});

test('invalid renderer or missing frame source fails closed without destroying the shared Viewer',async()=>{
 const f=await fixture();let destroyed=0;
 f.ui.bindNodeRenderer(()=>({destroy(){destroyed++;}}));assert.equal(destroyed,1);assert.equal(f.ui.nodeRendererState().phase,'error');
 delete f.instances[0].viewer.scene.preRender;
 f.ui.bindNodeRenderer(()=>({syncFrame(){},destroy(){destroyed++;}}));assert.equal(destroyed,2);assert.equal(f.ui.nodeRendererState().phase,'error');assert.equal(f.instances[0].destroyed,undefined);f.ui.destroy();
});

test('actual NodeScene consumes the shared pre-render UTC and preserves foreign primitives',async()=>{
 const codec=createUtcCodec(LEAP_SHA256);
 const captured=JSON.parse(gunzipSync(await readFile(new URL('../fixtures/original_node_link_resolution.json.gz',import.meta.url))));
 const f=await fixture({displayUtc:new Date(captured.epoch).toISOString()});
 const row=captured.cases.find(c=>c.id==='dense-two-plane:0').rows.at(-1),node=row.input.nodes[0],state=new Map(row.input.states).get(node.id);
 class Collection{constructor(){this.items=[];}add(value){this.items.push(value);return value;}remove(value){this.items=this.items.filter(v=>v!==value);return true;}}
 class Cartesian3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}}
 class Color{constructor(css,alpha=1){Object.assign(this,{css,alpha});}static fromCssColorString(css){return new Color(css);}withAlpha(alpha){return new Color(this.css,alpha);}}
 Color.WHITE=new Color('white');Color.TRANSPARENT=new Color('transparent',0);
 Object.assign(f.host.Cesium,{Cartesian3,Color,PointPrimitiveCollection:Collection,LabelCollection:Collection,NearFarScalar:class{},Cartesian2:class{},LabelStyle:{FILL_AND_OUTLINE:'outline'}});
 const primitives=new Collection(),foreign={};primitives.add(foreign);f.instances[0].viewer.scene.primitives=primitives;
 let utc=null,scene;const removeContext=f.ui.observeDisplayContext(value=>{utc=value?.utc??null;});
 const meta={model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:captured.source_commit,quality:'engineering_assumption'};
 f.ui.bindNodeRenderer((C,viewer)=>scene=new NodeScene({viewer,cesium:C,timeSource:()=>utc,advanceUtc:codec.advance,pathFor:()=>null,geometryFor:(definition,display)=>({...meta,node_id:node.id,node_definition:structuredClone(definition),definition_hash:'a'.repeat(64),row:{utc:display.utc,status:'valid',error_code:null,position_m:state.fixed.r.map(v=>v*1000)}})}));
 await scene.setNodes([{id:node.id,definition:node,model:null}]);assert.equal(scene.points.get(node.id).show,false);
 f.display();f.frames.raise();const point=scene.points.get(node.id);assert.equal(point.show,true);assert.deepEqual([point.position.x,point.position.y,point.position.z],state.fixed.r.map(v=>v*1000));
 f.ui.update({status:'pending',state:{},result:null});f.frames.raise();assert.equal(point.show,false);
 removeContext();f.ui.destroy();assert.deepEqual(primitives.items,[foreign]);assert.equal(scene.disposed,true);
});
