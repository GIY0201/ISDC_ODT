import test from 'node:test';
import assert from 'node:assert/strict';
import { SatelliteModelLayer } from '../../../digital_twin/visualization/satellite_model.js';

function event() {
  const listeners = new Set();
  return { listeners, addEventListener(fn) { listeners.add(fn); return () => listeners.delete(fn); }, raise(...args) { for (const fn of [...listeners]) fn(...args); } };
}
class Cartesian3 {
  constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); }
  static subtract(a,b,r) { Object.assign(r,{x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}); return r; }
  static magnitude(a) { return Math.hypot(a.x,a.y,a.z); }
  static normalize(a,r) { const m=this.magnitude(a); Object.assign(r,{x:a.x/m,y:a.y/m,z:a.z/m}); return r; }
}
const utc='2026-10-05T00:00:00.000000000Z';
const next='2026-10-05T00:00:01.000000000Z';
const description={satelliteId:25544,normalized_gp_sha256:'a'.repeat(64),url:'/static/satellite_display/iss.glb',scale:2.39,sizeMeters:109};
const nodeDefinition={schema:1,id:'node-1',catalog_number:900001,orbit:{epoch:1791158400000,altitude_km:550,inclination:53}};
const nodeDescription={url:'/node.glb',pose_source:{kind:'source_node',node_definition:nodeDefinition,definition_hash:'b'.repeat(64)}};
const nodeMetadata={model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption'};
const nodeSample=time=>({...nodeMetadata,node_id:nodeDefinition.id,node_definition:structuredClone(nodeDefinition),definition_hash:nodeDescription.pose_source.definition_hash,row:{utc:time,status:'valid',error_code:null,position_m:[7000000+(time===next?10:0),2,3]}});
function fixture() {
  const loads=[],items=[],statuses=[],pending=[];
  const C={Cartesian3,Matrix3:class{},Matrix4:class { static fromRotationTranslation(rotation,translation) { return {rotation,translation}; } },
    Transforms:{eastNorthUpToFixedFrame:position=>({enu:position}),rotationMatrixFromPositionVelocity:(position,velocity)=>({position,velocity})},Ellipsoid:{WGS84:{}},
    Model:{fromGltfAsync(options) { loads.push(options); return new Promise((resolve,reject)=>pending.push({resolve,reject})); }}};
  const viewer={scene:{canvas:{clientWidth:800,clientHeight:600},preUpdate:event(),primitives:{add(m){items.push(m);return m;},remove(m){const i=items.indexOf(m);if(i<0)return false;items.splice(i,1);m.destroy();return true;}},requestRender(){}}};
  let currentUtc=utc,x=7000000,missing=false;
  const sampleAt=time=>missing?null:{catalog_number:25544,normalized_gp_sha256:description.normalized_gp_sha256,frame:'ITRF',utc:time,position_m:[x+(time===next?10:0),2,3]};
  const layer=new SatelliteModelLayer({viewer,cesium:C,timeSource:()=>currentUtc,advanceUtc:(time,seconds)=>{if(seconds===0)return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/.test(time)?time:null;assert.equal(seconds,1);return next;},onStatus:s=>statuses.push(s)});
  const model=()=>({ready:false,readyEvent:event(),errorEvent:event(),show:false,destroyCount:0,destroy(){this.destroyCount++;},isDestroyed(){return this.destroyCount>0;}});
  return {layer,viewer,loads,items,statuses,pending,sampleAt,model,setX:v=>x=v,setMissing:v=>missing=v,setUtc:v=>currentUtc=v};
}
test('native ITRF metre position, latest geometry and readiness are separate from transport',async()=>{
  const f=fixture(),p=f.layer.show(description,f.sampleAt,utc); f.setX(7100000);
  const m=f.model();f.pending[0].resolve(m);await p;
  assert.equal(f.items.length,1);assert.equal(m.modelMatrix.translation.x,7100000);assert.equal(m.modelMatrix.rotation.velocity.x,1);
  assert.equal(f.statuses.at(-1).phase,'loading');m.ready=true;m.readyEvent.raise();assert.equal(f.statuses.at(-1).phase,'ready');
  await f.layer.show(description,f.sampleAt,utc);assert.equal(f.loads.length,1);f.layer.clear();assert.equal(m.destroyCount,1);assert.equal(f.viewer.scene.preUpdate.listeners.size,0);
});
test('late load is destroyed after selection or clear; older failure cannot overwrite current state',async()=>{
  const f=fixture(),p=f.layer.show(description,f.sampleAt,utc);f.layer.clear();const m=f.model();f.pending[0].resolve(m);assert.equal(await p,null);assert.equal(m.destroyCount,1);assert.equal(f.items.length,0);
  const first=f.layer.show(description,f.sampleAt,utc),second=f.layer.show({...description,url:'/new.glb'},f.sampleAt,utc);
  f.pending[1].reject(new Error('old'));await first;assert.equal(f.statuses.at(-1).phase,'loading');f.layer.clear();f.pending[2].resolve(f.model());await second;
});
test('failed load stays failed until explicit retry and render errors remain distinct',async()=>{
  const f=fixture(),p=f.layer.show(description,f.sampleAt,utc);f.pending[0].reject(new Error('transport unavailable'));await p;
  assert.equal(f.statuses.at(-1).phase,'error');assert.equal(f.statuses.at(-1).errorKind,'load');
  await f.layer.show(description,f.sampleAt,utc);assert.equal(f.loads.length,1);
  const retry=f.layer.retry();const m=f.model();f.pending[1].resolve(m);await retry;m.errorEvent.raise(new Error('GPU'));
  assert.equal(f.statuses.at(-1).errorKind,'render');assert.equal(m.show,false);f.layer.clear();
});
test('missing, nonfinite or mismatched native geometry hides model and never invents coordinates',async()=>{
  const f=fixture(),p=f.layer.show(description,f.sampleAt,utc);const m=f.model();f.pending[0].resolve(m);await p;m.ready=true;m.readyEvent.raise();f.setMissing(true);f.layer.update(utc);
  assert.equal(m.show,false);assert.equal(f.statuses.at(-1).phase,'hidden_no_geometry');
  f.setMissing(false);f.layer.update(utc);assert.equal(m.show,true);assert.equal(f.statuses.at(-1).phase,'ready');
  f.layer.sampleAt=()=>({...f.sampleAt(utc),position_m:[NaN,0,0]});f.layer.update(utc);assert.equal(m.show,false);
  f.layer.sampleAt=()=>({...f.sampleAt(utc),catalog_number:999});assert.equal(f.layer.cartesianAt(utc),null);f.layer.clear();
});
test('no model remains unassigned; dispose fences pending primitive and readiness listeners',async()=>{
  const f=fixture();await f.layer.show(null,f.sampleAt,utc);assert.equal(f.statuses.at(-1).phase,'unassigned');
  const p=f.layer.show(description,f.sampleAt,utc),m=f.model();f.layer.dispose();f.pending[0].resolve(m);await p;assert.equal(m.destroyCount,1);assert.equal(f.items.length,0);
  assert.equal(await f.layer.show(description,f.sampleAt,utc),null);assert.equal(f.loads.length,1);
});
test('repeated selection while loading does not restart transport and clear removes owned events',async()=>{
  const f=fixture(),p=f.layer.show(description,f.sampleAt,utc);
  await f.layer.show(description,f.sampleAt,utc);assert.equal(f.loads.length,1);
  const m=f.model();f.pending[0].resolve(m);await p;assert.equal(m.readyEvent.listeners.size,1);assert.equal(m.errorEvent.listeners.size,1);
  f.layer.clear();assert.equal(m.readyEvent.listeners.size,0);assert.equal(m.errorEvent.listeners.size,0);
  m.readyEvent.raise();assert.equal(f.statuses.at(-1).phase,'unassigned');
});
test('GP change fences loading even when satellite and URL are unchanged; absent ahead uses ENU',async()=>{
  const f=fixture(),p=f.layer.show(description,f.sampleAt,utc);
  const changed={...description,normalized_gp_sha256:'b'.repeat(64)};
  const sampler=time=>({...f.sampleAt(time),normalized_gp_sha256:changed.normalized_gp_sha256});
  const q=f.layer.show(changed,sampler,utc),old=f.model(),m=f.model();f.pending[0].resolve(old);await p;assert.equal(old.destroyCount,1);
  f.pending[1].resolve(m);await q;f.layer.sampleAt=time=>time===utc?sampler(time):null;f.layer.update(utc);
  assert.equal(m.modelMatrix.enu.x,7000000);assert.equal(f.items.length,1);f.layer.clear();
});
test('input orientation is owned and absent geometry cancels queued focus before readiness',async()=>{
  const f=fixture(),d={...description,orientation:{heading:0}},p=f.layer.show(d,f.sampleAt,utc);d.orientation.heading=90;
  assert.equal(f.layer.current.orientation.heading,0);
  assert.equal(f.layer.focus(utc),false);assert.equal(f.layer.pendingFocus,true);f.setMissing(true);
  const m=f.model();f.pending[0].resolve(m);await p;m.ready=true;m.readyEvent.raise();assert.equal(f.layer.pendingFocus,false);
  assert.equal(f.layer.tracking,false);assert.equal(m.show,false);f.layer.clear();
});

test('selected source node uses its declared approximate frame and copies native metre pose',async()=>{
  const f=fixture(),sample=nodeSample(utc),p=f.layer.show(nodeDescription,time=>time===utc?sample:nodeSample(time),utc);
  const m=f.model();f.pending[0].resolve(m);await p;
  assert.equal(m.show,true);assert.equal(m.modelMatrix.translation.x,7000000);
  const pose=f.layer.nativeAt(utc);assert.equal(pose.frame,nodeMetadata.frame);assert.equal(pose.node_id,nodeDefinition.id);
  pose.position_m[0]=0;assert.equal(sample.row.position_m[0],7000000);
  assert.equal(f.loads[0].id.node_id,nodeDefinition.id);assert.equal(f.statuses.at(-1).node_id,nodeDefinition.id);
  f.layer.clear();
});

test('selected node rejects every stale definition, native metadata, UTC, hash and failed pose',async()=>{
  const f=fixture();await f.layer.show({...nodeDescription,url:null},nodeSample,utc);
  for(const mutate of [v=>v.node_id='other',v=>v.definition_hash='c'.repeat(64),v=>v.node_definition.orbit.altitude_km++,v=>v.row.utc=next,v=>v.row.status='error',v=>v.row.error_code='failed',v=>v.row.position_m[0]=NaN,...Object.keys(nodeMetadata).map(key=>v=>v[key]='wrong')]){
    const sample=nodeSample(utc);mutate(sample);f.layer.sampleAt=()=>sample;assert.equal(f.layer.nativeAt(utc),null);
  }
  f.layer.sampleAt=nodeSample;assert.equal(f.layer.nativeAt('2026-10-05T00:00:00Z'),null);
  await f.layer.show({...description,url:null},nodeSample,utc);assert.equal(f.layer.nativeAt(utc),null);
  f.layer.clear();
});

test('same node ID and model URL with edited definition fences pending load and queued focus',async()=>{
  const f=fixture(),p=f.layer.show(nodeDescription,nodeSample,utc);f.layer.pendingFocus=true;
  const changed=structuredClone(nodeDescription);changed.pose_source.node_definition.orbit.altitude_km++;
  const q=f.layer.show(changed,nodeSample,utc);assert.equal(f.layer.pendingFocus,false);assert.equal(f.loads.length,2);
  const old=f.model();f.pending[0].resolve(old);await p;assert.equal(old.destroyCount,1);
  f.pending[1].resolve(f.model());await q;assert.equal(f.layer.model.show,false);f.layer.clear();
});
