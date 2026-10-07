import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
test('source-less replica initializes geographic imagery and style while refusing satellite proof and retaining local 2D control',async()=>{
 const f=fixture(1280,720,{hash:'#settings'});try{
  f.evaluate("globe.catalog(null);globe.catalogScene(null);globe.update({status:'empty',state:null,result:null});globalThis.mapRequests=0;window.Cesium.SingleTileImageryProvider.fromUrl=async()=>{mapRequests++;return {};};globalThis.blankCaption=document.createElement('p');globalThis.blankReplica=globe.createDisplayReplica(document.createElement('div'),blankCaption);");
  const replica=f.context.blankReplica,wall=f.viewers.at(-1),before=f.snapshot(),counts=f.counts();
  assert.equal(f.evaluate('globe.displayContext()'),null);assert.equal(f.context.mapRequests,1);assert.equal(String(wall.scene.globe.baseColor),'#c9d6e3');
  const proof=replica.readProjection();assert.equal(proof.context,null);assert.equal(replica.verifyProjection(proof),false);assert.match(f.context.blankCaption.textContent,/위성 위치 자료/);
  assert.equal(replica.setMode('2d'),true);await Promise.resolve();assert.equal(wall.scene.mode,2);assert.equal(f.context.mapRequests,1);assert.equal(replica.verifyProjection(proof),false);
  f.evaluate("globe.changeView({theme:'dark'});");replica.sync();assert.equal(String(wall.scene.globe.baseColor),'#07111d');assert.equal(wall.scene.mode,2);assert.equal(f.context.mapRequests,1);assert.equal(replica.verifyProjection(proof),false);
  assert.deepEqual(f.snapshot(),before);assert.deepEqual(f.counts(),counts);replica.destroy();assert.equal(wall.destroyCount,1);assert.equal(f.viewers[0].destroyCount,undefined);
 }finally{f.dispose();}
});
import {readFile} from 'node:fs/promises';
test('primary boot uses the permanent desktop status before any dynamic wall exists',async()=>{
 const source=await readFile(new URL('../../../user_application/web/scripts/workspace_orbit.js',import.meta.url),'utf8');
 const call=source.match(/const globe=createWorkspaceGlobe\([^;]+/)[0];
 assert.match(call,/getElementById\('orbit-globe-status'\)/);assert.doesNotMatch(call,/wall-globe-caption/);
});
test('desktop thumbnail uses only the selected mapped preview and hides clear, missing mapping and failed image',async()=>{
 const f=fixture(1280,720,{hash:'#settings'});try{
  const image=f.get('desktop-sat-thumbnail');assert.equal(image.hidden,true);
  f.evaluate("globe.setSatelliteModel({satelliteId:25544,normalized_gp_sha256:'a'.repeat(64),url:'/source/iss.glb',thumbnail:'/source/iss-preview.webp'},null);");assert.equal(image.hidden,false);assert.equal(image.src,'/source/iss-preview.webp');
  await image.dispatch('error');assert.equal(image.hidden,true);assert.equal(image.hasAttribute('src'),false);
  f.evaluate("globe.setSatelliteModel({satelliteId:25544,url:'/source/iss.glb'},null);");assert.equal(image.hidden,true);assert.equal(image.hasAttribute('src'),false);
  f.evaluate('globe.clearSatelliteModel();');assert.equal(image.hidden,true);assert.equal(image.hasAttribute('src'),false);
 }finally{f.dispose();}
});
for(const [width,height]of [[1280,720],[1920,1080]])test(`main and wall keep separate cameras and the same source without extra queries ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#wall'});try{
  assert.equal(f.get('workspace-globe-surface').parent,f.get('desktop'));assert.equal(f.viewers.length,2);
  const [main,wall]=f.viewers,counts=f.counts(),context=f.evaluate('JSON.stringify(globe.displayContext())');
  f.get('wall-mode').value='2d';await f.get('wall-mode').dispatch('change');assert.equal(wall.scene.mode,2);assert.equal(main.scene.mode,3);assert.equal(f.evaluate('JSON.stringify(globe.displayContext())'),context);assert.deepEqual(f.counts(),counts);
  const mainItems=main.items.length;await f.get('window-minimize').dispatch('click');assert.equal(f.get('workspace-globe-surface').parent,f.get('desktop'));assert.equal(main.destroyCount,undefined);assert.equal(main.items.length,mainItems);
  await f.get('shelf-restore').dispatch('click');f.evaluate("location.hash='#settings'");await f.win.dispatch('hashchange');assert.equal(main.destroyCount,undefined);assert.equal(wall.destroyCount,1);assert.equal(f.get('workspace-globe-surface').parent,f.get('desktop'));
 }finally{f.dispose();}
});

test('advancing actual SIM projection uses a captured frame UTC while full runtime control and run changes revoke it',async()=>{
 const f=fixture(1280,720,{hash:'#settings'});try{
  f.evaluate("globalThis.replicaRuntime={run_id:'replica-sim',running:true,speed:1,elapsed_seconds:0,sequence:1,started_at:'2026-10-07T00:00:00Z'};globalThis.replicaAge=0;globalThis.replicaCodec=createUtcCodec(LEAP_SHA256);globalThis.replicaStart=replicaCodec.advance(replicaRuntime.started_at,0);globe.bindScenarioRuntime(()=>replicaRuntime,()=>replicaStart,{projectDisplay:r=>({run_id:r.run_id,sequence:r.sequence,elapsed_seconds:r.elapsed_seconds,projected:true,age_ms:++replicaAge,utc:replicaCodec.advance(replicaStart,replicaAge/1000*r.speed)})});globe.setScenarioDisplayContext({run_id:replicaRuntime.run_id,utc:replicaStart,leap_sha256:LEAP_SHA256});globalThis.simReplica=globe.createDisplayReplica(document.createElement('div'),document.createElement('p'));");
  const replica=f.context.simReplica,value=replica.readProjection(),utc=value.context.utc;assert.equal(replica.verifyProjection(value),true);assert.equal(replica.sync(),true);assert.equal(value.context.utc,utc);
  f.evaluate('replicaRuntime={...replicaRuntime,speed:2};');assert.equal(replica.verifyProjection(value),false);const fresh=replica.readProjection();assert.equal(replica.verifyProjection(fresh),true);f.evaluate("replicaRuntime={...replicaRuntime,run_id:'replacement'};");assert.equal(replica.verifyProjection(fresh),false);replica.destroy();
 }finally{f.dispose();}
});

test('secondary native failure hides its virtual ground point and cannot damage primary resources',async()=>{
 const f=fixture(1280,720,{hash:'#settings'});try{
  const replica=f.evaluate('globalThis.failReplica=globe.createDisplayReplica(document.createElement("div"),document.createElement("p"));failReplica');const viewer=f.viewers[1];assert.ok(viewer.items.some(item=>item.id==='virtual-ground-point'));let fail=false;
  replica.bindNodes(()=>({syncFrame(){if(fail)throw Error('native render failed');},destroy(){}}));fail=true;assert.equal(replica.sync(),false);assert.equal(viewer.items.some(item=>item.id==='virtual-ground-point'),false);assert.ok(f.viewers[0].items.some(item=>item.id==='virtual-ground-point'));replica.destroy();
 }finally{f.dispose();}
});

test('replica construction failure and primary disposal preserve primary ownership and revoke borrowed proof',async()=>{
 const f=fixture(1280,720,{hash:'#settings'});try{
  f.evaluate("globalThis.savedReplicaViewer=window.Cesium.Viewer;window.Cesium.Viewer=class{constructor(){throw Error('display unavailable');}};");
  assert.equal(f.evaluate("globe.createDisplayReplica(document.createElement('div'),document.createElement('p'))"),null);assert.equal(f.viewers[0].destroyCount,undefined);
  f.evaluate('window.Cesium.Viewer=savedReplicaViewer;globalThis.disposalReplica=globe.createDisplayReplica(document.createElement("div"),document.createElement("p"));');const replica=f.context.disposalReplica,value=replica.readProjection();assert.equal(replica.verifyProjection(value),true);f.evaluate('globe.destroy();');assert.equal(replica.verifyProjection(value),false);assert.equal(f.viewers[1].destroyCount,1);assert.equal(f.viewers[0].destroyCount,1);
 }finally{f.dispose();}
});

test('owner-created replica borrows complete immutable source fields and rejects fake and replaced projections',async()=>{
 const f=fixture(1280,720,{hash:'#settings'});try{
  const replica=f.evaluate("globalThis.extraReplica=globe.createDisplayReplica(document.createElement('div'),document.createElement('p'));extraReplica");
  f.evaluate("removeSceneTime();globe.catalogScene({frame:'ITRF',utc:'2020-07-12T21:16:01.000416000Z',scene_sha256:'a'.repeat(64),eop_sha256:'b'.repeat(64),leap_sha256:LEAP_SHA256,count:240,valid_count:240,error_count:0,source:'celestrak-cache',quality:'retained-source',rows:Array.from({length:240},(_,i)=>({catalog_number:i+1,name:'full-'+i,status:'valid',error_code:null,normalized_gp_sha256:'c'.repeat(64),epoch_utc:'2020-07-12T21:16:01.000416000Z',orbit_regime:'LEO',position_m:[7000000,i+1,0]}))},()=>{});");
  const value=replica.readProjection();assert.equal(value.scene.rows.length,240);assert.equal(value.scene.source,'celestrak-cache');assert.equal(value.scene.quality,'retained-source');assert.ok(Object.isFrozen(value.scene.rows[239].position_m));assert.equal(replica.verifyProjection(value),true);assert.equal(replica.verifyProjection(structuredClone(value)),false);
  const main=f.viewers[0],counts=f.counts();f.viewers[1].scene.preRender.raise();assert.deepEqual(f.counts(),counts);f.evaluate('globe.catalogScene(null,()=>{});');assert.equal(replica.verifyProjection(value),false);assert.equal(replica.readProjection().scene,null);replica.destroy();assert.equal(replica.verifyProjection(replica.readProjection()),false);assert.equal(main.destroyCount,undefined);
 }finally{f.dispose();}
});
