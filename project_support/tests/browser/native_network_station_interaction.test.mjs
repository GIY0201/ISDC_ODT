import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeNetworkScene} from '../../../digital_twin/visualization/native_network_scene.js';
class Collection{constructor(){this.items=[];}add(v){this.items.push(v);return v;}remove(v){this.items=this.items.filter(x=>x!==v);return true;}}
class Color{static WHITE=new Color();static fromCssColorString(){return new Color();}withAlpha(){return this;}}
class Cartesian3{constructor(...values){this.values=values;}static fromDegrees(...degrees){return {degrees};}}
class Material{constructor(o){this.uniforms=o.fabric.uniforms;}static fromType(type,uniforms){return {type,uniforms};}}
const C={Color,Cartesian3,Material,PolylineCollection:Collection,CustomDataSource:class{constructor(){this.entities=new Collection();}},Cartesian2:class{},LabelStyle:{},SceneMode:{MORPHING:0,SCENE3D:3}};
const meta={frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',model_profile:'SOURCE_KEPLER_J2_V1',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption'};
const utc='2026-10-07T00:00:00.000000000Z',hash='a'.repeat(64);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function fixture(sampled=false){
 let valid=true,stamp=sampled?'2026-10-07T00:00:00.500000000Z':utc,lease=0;
 const viewer={scene:{mode:3,primitives:new Collection()},dataSources:new Collection()};
 const proof={schema_version:1,...meta,status:'valid',error:null,utc,node_definitions:[{id:'A',name:'Satellite'}],definition_hashes:{A:hash},stations:[{id:'G',name:'Ground',enabled:true,longitude:127,latitude:37,altitude_km:.1,min_elevation_deg:10}],faults:[],network:{time:new Date(Date.parse(utc)).toISOString(),nodes:[{id:'A',kind:'satellite'},{id:'G',kind:'ground'}],links:[{id:'AG',a:'G',b:'A',kind:'ground',state:'visible'}]}};
 const registered=new WeakMap();const read=()=>{const view=freeze({...structuredClone(proof),presentation_kind:'NETWORK_SAMPLED_UI_V1',analysis_utc:utc,display_utc:stamp,age_seconds:(Date.parse(stamp)-Date.parse(utc))/1000,current_analysis:stamp===utc,availability:'sampled'});registered.set(view,lease);return view;};
 const scene=new NativeNetworkScene({viewer,cesium:C,timeSource:()=>stamp,verifyNetworkSnapshot:()=>valid,coverageRadiusKm:()=>100,sampledNetwork:{read,verify:(v,{utc:requested}={})=>valid&&registered.has(v)&&registered.get(v)===lease&&requested===stamp&&v.display_utc===stamp},geometryFor:(n,{utc:time})=>({...meta,node_id:n.id,node_definition:n,definition_hash:hash,row:{utc:time,status:'valid',error_code:null,position_m:[1,2,3]}})});
 const render=()=>sampled?(scene.setSampledActive(true),scene.syncFrame(stamp)):scene.setSnapshot({snapshot:proof});render();
 return {scene,viewer,proof,render,get stamp(){return stamp;},set stamp(v){stamp=v;},set valid(v){valid=v;},revoke(){lease++;},entity:()=>scene.stations.get('G')?.entity,coverage:()=>scene.stations.get('G')?.coverage};
}
for(const sampled of [false,true])test(`owned entity and coverage pick yield registered deeply frozen station token (${sampled?'sampled':'exact'})`,()=>{
 const f=fixture(sampled);for(const entity of [f.entity(),f.coverage()]){const token=f.scene.stationPick({id:entity});assert.equal(token.id,'G');assert.deepEqual(token.station,f.proof.stations[0]);assert.ok(Object.isFrozen(token));assert.ok(Object.isFrozen(token.station));assert.equal(f.scene.verifyStationPick(token),true);assert.equal(f.scene.verifyStationPick(freeze(structuredClone(token))),false);}
 const token=f.scene.captureStationPick('G');assert.equal(f.scene.verifyStationPick(token),true);assert.equal(f.scene.stationPick({id:{properties:{stationId:'G'},show:true}}),null);assert.equal(f.scene.captureStationPick('unknown'),null);
});
test('stationAt verifies actual picked entity instead of trusting foreign stationId',()=>{
 const f=fixture();f.viewer.scene.pick=()=>({id:{properties:{stationId:'G'}}});assert.equal(f.scene.stationAt({x:1,y:2}),null);f.viewer.scene.pick=()=>({id:f.entity()});assert.equal(f.scene.stationAt({x:1,y:2}),'G');
});
for(const sampled of [false,true])test(`same unchanged valid redraw preserves token but hidden→reshown never revives (${sampled?'sampled':'exact'})`,()=>{
 const f=fixture(sampled),token=f.scene.captureStationPick('G');f.scene.syncFrame(f.stamp);assert.equal(f.scene.verifyStationPick(token),true);
 f.viewer.scene.mode=0;f.scene.syncFrame(f.stamp);assert.equal(f.scene.verifyStationPick(token),false);f.viewer.scene.mode=3;f.scene.syncFrame(f.stamp);assert.equal(f.scene.verifyStationPick(token),false);assert.equal(f.scene.verifyStationPick(f.scene.captureStationPick('G')),true);
});
for(const change of ['invalid','clear','destroy','viewer','definition','disabled','removed'])test(`${change} revokes old station token`,()=>{
 const f=fixture(),token=f.scene.captureStationPick('G');
 if(change==='invalid')f.valid=false;if(change==='clear'||change==='destroy')f.scene[change]();if(change==='viewer')f.scene.viewerProvider={scene:{mode:3,primitives:new Collection()},dataSources:new Collection()};
 if(change==='definition'){f.proof.stations[0].latitude++;f.render();}if(change==='disabled'){f.proof.stations[0].enabled=false;f.render();}if(change==='removed')f.scene.removeStation('G');
 assert.equal(f.scene.verifyStationPick(token),false);
});
test('hidden coverage cannot be picked while still-visible station entity remains selectable',()=>{
 const f=fixture();f.scene.setCoverageVisible(false);assert.equal(f.scene.stationPick({id:f.coverage()}),null);assert.equal(f.scene.verifyStationPick(f.scene.stationPick({id:f.entity()})),true);
});
test('sampled same-UTC owner lease revocation rejects station token without requiring next frame',()=>{
 const f=fixture(true),token=f.scene.captureStationPick('G');f.revoke();assert.equal(f.scene.verifyStationPick(token),false);assert.equal(f.scene.stationPick({id:f.entity()}),null);
});
test('pick callback clearing ownership cannot return a station from its late result',()=>{
 const f=fixture(),entity=f.entity();f.viewer.scene.pick=()=>{f.scene.clear();return {id:entity};};assert.equal(f.scene.stationAt({x:1,y:2}),null);
});
test('current display getter replacing actual Viewer cannot validate old station',()=>{
 const f=fixture(),token=f.scene.captureStationPick('G');let current=f.viewer;f.scene.viewerProvider=()=>current;f.scene.timeSource=()=>{current={scene:{mode:3,primitives:new Collection()},dataSources:new Collection()};return f.stamp;};assert.equal(f.scene.verifyStationPick(token),false);
});
test('final transition getter replacing Viewer behind stable provider rejects station token',()=>{
 const f=fixture(),token=f.scene.captureStationPick('G');let current=f.viewer,calls=0;f.scene.viewerProvider=()=>current;f.scene.isTransitioning=()=>{if(++calls===2)current={scene:{mode:3,primitives:new Collection()},dataSources:new Collection()};return false;};assert.equal(f.scene.verifyStationPick(token),false);
});
test('invalid caller station ID does not revoke an unrelated current station token',()=>{
 const f=fixture(),token=f.scene.captureStationPick('G');assert.equal(f.scene.captureStationPick('unknown'),null);assert.equal(f.scene.verifyStationPick(token),true);
});
for(const port of [null,{read:()=>null,verify:()=>false}])test(`active ground consumer retains verified exact stations and picks without sampled continuity (${port?'unavailable':'missing'})`,()=>{
 const f=fixture(),token=f.scene.captureStationPick('G');f.scene.sampledNetwork=port;f.scene.setSampledActive(true);f.scene.syncFrame(f.stamp);
 assert.equal(f.entity().show,true);assert.equal(f.scene.groundLinks.get('AG').line.show,true);assert.equal(f.scene.verifyStationPick(token),true);assert.equal(f.scene.verifyStationPick(f.scene.captureStationPick('G')),true);
 f.scene.setCoverageVisible(false);assert.equal(f.entity().show,true);assert.equal(f.coverage().show,false);f.scene.setCoverageVisible(true);assert.equal(f.coverage().show,true);
 f.scene.setGroundLinksVisible(false);assert.equal(f.scene.groundLinks.get('AG').line.show,false);assert.equal(f.entity().show,true);f.scene.setGroundLinksVisible(true);assert.equal(f.scene.groundLinks.get('AG').line.show,true);
 f.stamp='2026-10-07T00:00:00.500000000Z';f.scene.syncFrame(f.stamp);assert.equal(f.entity().show,false);assert.equal(f.scene.verifyStationPick(token),false);
});
test('coverage hidden and reshown revokes old coverage token without requiring an intervening verification',()=>{
 const f=fixture(),token=f.scene.stationPick({id:f.coverage()});f.scene.setCoverageVisible(false);f.scene.setCoverageVisible(true);assert.equal(f.scene.verifyStationPick(token),false);assert.equal(f.scene.verifyStationPick(f.scene.stationPick({id:f.coverage()})),true);
});
test('late exact frame proof failure revokes tokens irreversibly before visible recovery',()=>{
 const f=fixture(),token=f.scene.captureStationPick('G');let reads=0;f.scene.verifyNetworkSnapshot=()=>++reads!==3;f.scene.syncFrame(f.stamp);assert.equal(f.entity().show,false);f.scene.verifyNetworkSnapshot=()=>true;f.scene.syncFrame(f.stamp);assert.equal(f.entity().show,true);assert.equal(f.scene.verifyStationPick(token),false);
});
