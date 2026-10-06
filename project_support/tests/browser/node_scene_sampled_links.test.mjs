import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeScene} from '../../../digital_twin/visualization/node_scene.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {NODE_COMMUNICATION_METADATA as metadata} from '../../../user_application/web/scripts/nodes/node_timeline.js';
const codec=createUtcCodec(LEAP_SHA256),analysisUtc=codec.advance('2026-10-04T00:00:00Z',0),hash='a'.repeat(64);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
class Collection{items=[];add(value){this.items.push(value);return value;}remove(value){const i=this.items.indexOf(value);if(i<0)return false;this.items.splice(i,1);return true;}}
class Cartesian3{constructor(x,y,z){Object.assign(this,{x,y,z});}}
class Color{constructor(css,alpha=1){Object.assign(this,{css,alpha});}static fromCssColorString(css){return new Color(css);}withAlpha(alpha){return new Color(this.css,alpha);}}
class Material{constructor(options){this.uniforms=options.fabric.uniforms;}static fromType(type,uniforms){return {type,uniforms};}}
function fixture(count=2){
 const nodes=Array.from({length:count},(_,i)=>({schema:1,id:String(i+1),name:`node ${i+1}`,updated_at:analysisUtc})),definitions=freeze(structuredClone(nodes));
 const hashes=freeze(Object.fromEntries(nodes.map(n=>[n.id,hash]))),pairs=freeze(nodes.slice(1).map(n=>({key:`1-${n.id}`,a:'1',b:n.id,state:'locked'})));
 let utc=analysisUtc,lease={},valid=true,morph=false,reads=0,checks=0,geometryReads=[],readHook=null,verifyHook=null,geometryHook=null,mutate=value=>value;
 const registered=new WeakMap(),primitives=new Collection(),viewer={scene:{mode:3,primitives}};
 const port={read(){reads++;readHook?.();const view=freeze(mutate({...metadata,schema_version:1,presentation_kind:'OPTICAL_SAMPLED_UI_V1',status:valid?'valid':'unavailable',error:null,availability:valid?'sampled':'unavailable',reason:utc===analysisUtc?'exact_analysis_available':'current_analysis_unavailable',utc:analysisUtc,analysis_utc:analysisUtc,display_utc:utc,age_seconds:codec.difference(utc,analysisUtc),current_analysis:utc===analysisUtc,node_definitions:definitions,definition_hashes:hashes,terminals:[],pairs}));registered.set(view,lease);return view;},verify(view,{utc:stamp}){checks++;verifyHook?.();return valid&&registered.get(view)===lease&&stamp===utc&&view.display_utc===utc;}};
 const scene=new NodeScene({viewer,cesium:{Cartesian3,Color,Material,PolylineCollection:Collection,SceneMode:{MORPHING:0}},timeSource:()=>utc,advanceUtc:codec.advance,isTransitioning:()=>morph,pathFor:()=>null,animationNow:()=>0,verifyLinkSnapshot:()=>false,sampledLinks:port,geometryFor:(node,{utc:stamp})=>{geometryReads.push([node.id,stamp]);geometryHook?.(node);return {...metadata,node_id:node.id,node_definition:node,definition_hash:hash,row:{utc:stamp,status:'valid',error_code:null,position_m:[Number(node.id)+codec.difference(stamp,analysisUtc)*10,0,1]}};}});
 return {scene,nodes,port,viewer,async mount(){await scene.setNodes(nodes.map(definition=>({id:definition.id,definition})));},advance(seconds){utc=codec.advance(analysisUtc,seconds);},revoke(){valid=false;lease={};},recover(){valid=true;lease={};},get utc(){return utc;},get reads(){return reads;},get checks(){return checks;},get geometryReads(){return geometryReads;},resetCounts(){reads=0;checks=0;geometryReads=[];},set morph(value){morph=value;},set readHook(value){readHook=value;},set verifyHook(value){verifyHook=value;},set geometryHook(value){geometryHook=value;},set mutate(value){mutate=value;}};
}
const shown=f=>[...f.scene.links.values()].filter(entry=>entry.line.show);

test('registered sampled analysis moves current native endpoints without becoming an exact receipt',async()=>{
 const f=fixture();await f.mount();f.advance(.25);f.resetCounts();f.scene.syncFrame(f.utc,1000);
 assert.equal(shown(f).length,1);assert.equal(f.reads,1);assert.deepEqual(f.geometryReads,[['1',f.utc],['2',f.utc]]);
 const entry=f.scene.links.get('1-2'),line=entry.line,material=line.material;assert.equal(line.positions[0].x,3.5);assert.equal(f.scene.linkReceipt,null);
 assert.equal(f.scene.sampledLinkReceipt.presentation_kind,'OPTICAL_SAMPLED_UI_V1');assert.equal(f.scene.sampledLinkReceipt.analysis_utc,analysisUtc);assert.equal(f.scene.sampledLinkReceipt.display_utc,f.utc);
 f.advance(.5);f.scene.syncFrame(f.utc,2000);assert.equal(entry.line,line);assert.equal(line.material,material);assert.equal(line.positions[0].x,6);assert.equal(material.uniforms.time,2.8);assert.equal(f.scene.sampledLinkReceipt.analysis_utc,analysisUtc);
 const sample=f.port.read();assert.equal(f.scene.setLinks(sample),false);assert.equal(f.scene.links.size,0);f.scene.destroy();
});

test('full240 sampled roster retains every pair and reads each current endpoint once per frame',async()=>{
 const f=fixture(240);await f.mount();f.advance(1);f.resetCounts();f.scene.syncFrame(f.utc,1000);
 assert.equal(shown(f).length,239);assert.equal(f.scene.descriptions.size,240);assert.equal(f.reads,1);assert.equal(f.geometryReads.length,240);assert.equal(new Set(f.geometryReads.map(([id])=>id)).size,240);f.scene.destroy();
});

test('unavailable lease, morph and hidden links suppress sampled lines and freeze flow; recovery requires new owner proof',async()=>{
 const f=fixture();await f.mount();f.scene.syncFrame(f.utc,1000);const line=f.scene.links.get('1-2').line,material=line.material;
 for(const operation of ['hide','morph','revoke']){if(operation==='hide')f.scene.setLinksVisible(false);if(operation==='morph')f.morph=true;if(operation==='revoke')f.revoke();f.scene.animateLinkFlow(9000,f.utc);assert.equal(line.show,false);assert.equal(material.uniforms.time,1.4);if(operation==='hide')f.scene.setLinksVisible(true);if(operation==='morph')f.morph=false;}
 f.recover();f.advance(.5);f.scene.syncFrame(f.utc,2000);assert.equal(line.show,true);assert.equal(material.uniforms.time,2.8);f.scene.destroy();
});

for(const bad of ['copy','mutable','metadata','scope','order','hash','duplicate','self','foreign','state','utc','analysis','age'])test(`sampled renderer rejects ${bad} view despite a permissive component verifier`,async()=>{
 const f=fixture();await f.mount();const read=f.port.read;
 if(bad==='copy')f.port.read=()=>structuredClone(read());
 else if(bad==='mutable')f.port.read=()=>({...read()});
 else f.mutate=v=>bad==='metadata'?{...v,frame:'foreign'}:bad==='scope'?{...v,node_definitions:[{...v.node_definitions[0],name:'changed'},v.node_definitions[1]]}:bad==='order'?{...v,node_definitions:[...v.node_definitions].reverse()}:bad==='hash'?{...v,definition_hashes:{'1':'b'.repeat(64),'2':hash}}:bad==='duplicate'?{...v,pairs:[...v.pairs,...v.pairs]}:bad==='self'?{...v,pairs:[{key:'x',a:'1',b:'1',state:'locked'}]}:bad==='foreign'?{...v,pairs:[{key:'x',a:'1',b:'missing',state:'locked'}]}:bad==='state'?{...v,pairs:[{key:'x',a:'1',b:'2',state:'invented'}]}:bad==='utc'?{...v,display_utc:codec.advance(v.display_utc,1)}:bad==='analysis'?{...v,analysis_utc:codec.advance(v.utc,1)}:{...v,age_seconds:NaN};
 if(!['copy','mutable'].includes(bad))f.port.verify=()=>true;
 f.scene.syncFrame(f.utc,1000);assert.equal(shown(f).length,0);f.scene.destroy();
});

for(const callback of ['read','verify','geometry'])for(const change of ['time','scope','viewer','clear','destroy','revoke','morph'])test(`sampled ${callback} callback ${change} cannot publish or animate mixed authority`,async()=>{
 const f=fixture();await f.mount();f.scene.syncFrame(f.utc,1000);const line=f.scene.links.get('1-2').line,phase=line.material.uniforms.time;
 let armed=true;const hook=()=>{if(!armed)return;armed=false;if(change==='time')f.advance(1);else if(change==='scope')void f.scene.setNodes([{id:'1',definition:{...f.nodes[0],name:'changed'}}]);else if(change==='viewer')f.scene.viewerProvider={scene:{mode:3,primitives:new Collection()}};else if(change==='clear')f.scene.clear();else if(change==='destroy')f.scene.destroy();else if(change==='revoke')f.revoke();else f.morph=true;};
 f[`${callback}Hook`]=hook;f.scene.syncFrame(f.utc,9000);assert.equal(line.show,false);assert.equal(line.material.uniforms.time,phase);assert.equal(shown(f).length,0);f.scene.destroy();
});

test('clear and disposal remove only sampled owned primitives and late view reads cannot recreate them',async()=>{
 const f=fixture(),foreign={};f.viewer.scene.primitives.add(foreign);await f.mount();f.scene.syncFrame(f.utc,1000);assert.equal(shown(f).length,1);f.scene.clear();assert.equal(f.scene.links.size,0);f.scene.syncFrame(f.utc,2000);assert.equal(shown(f).length,0);f.scene.destroy();f.scene.animateLinkFlow(3000);assert.deepEqual(f.viewer.scene.primitives.items,[foreign]);
});

test('optional sampled port requires both explicit functions and generic exact renderer remains inert',async()=>{
 const f=fixture();f.scene.sampledLinks=null;await f.mount();f.scene.syncFrame(f.utc,1000);assert.equal(f.reads,0);assert.equal(f.scene.links.size,0);f.scene.destroy();
 for(const sampledLinks of [{}, {read:()=>null},{verify:()=>true}])assert.throws(()=>new NodeScene({advanceUtc:codec.advance,geometryFor:()=>null,pathFor:()=>null,sampledLinks}),/sampled/);
});

test('phase clock callback revocation hides sampled lines before phase advance',async()=>{
 const f=fixture();await f.mount();f.scene.syncFrame(f.utc,1000);const line=f.scene.links.get('1-2').line,phase=line.material.uniforms.time;
 f.scene.animationNow=()=>{f.revoke();return 9000;};f.scene.animateLinkFlow(undefined,f.utc);assert.equal(line.show,false);assert.equal(line.material.uniforms.time,phase);f.scene.destroy();
});
test('phase clock exception after revocation cannot retain a shown sample',async()=>{
 const f=fixture();await f.mount();f.scene.syncFrame(f.utc,1000);const line=f.scene.links.get('1-2').line,phase=line.material.uniforms.time;
 f.scene.animationNow=()=>{f.revoke();throw Error('clock unavailable');};f.scene.animateLinkFlow(undefined,f.utc);assert.equal(line.show,false);assert.equal(line.material.uniforms.time,phase);f.scene.destroy();
});
test('sampled marker cannot enter exact setLinks even at analysis UTC with an injected permissive verifier',async()=>{
 const f=fixture();await f.mount();f.scene.verifyLinkSnapshot=()=>true;assert.equal(f.scene.setLinks(f.port.read()),false);assert.equal(f.scene.links.size,0);f.scene.destroy();
});
test('direct sampled publication cannot resurrect a receipt when its final transition getter clears links',async()=>{
 const f=fixture();await f.mount();f.resetCounts();let cleared=false;
 f.scene.isTransitioning=()=>{if(!cleared&&f.checks>=3){cleared=true;f.scene.clearLinks();}return false;};
 f.scene.placeSampledLinks(f.utc);assert.equal(cleared,true);assert.equal(shown(f).length,0);assert.equal(f.scene.sampledLinkReceipt,null);f.scene.destroy();
});
test('direct final transition callback sameUTC lease revocation cannot publish retained analysis',async()=>{
 const f=fixture();await f.mount();f.resetCounts();let revoked=false;
 f.scene.isTransitioning=()=>{if(!revoked&&f.checks>=3){revoked=true;f.revoke();}return false;};
 f.scene.placeSampledLinks(f.utc);assert.equal(revoked,true);assert.equal(shown(f).length,0);assert.equal(f.scene.sampledLinkReceipt,null);f.scene.destroy();
});
test('flow guard rejects sameUTC lease revoked by its final transition callback',async()=>{
 const f=fixture();await f.mount();f.resetCounts();f.scene.placeSampledLinks(f.utc);const guard=f.scene.sampledFlowGuard,initial=f.checks;let revoked=false;
 f.scene.isTransitioning=()=>{if(!revoked&&f.checks>initial){revoked=true;f.revoke();}return false;};assert.equal(guard(),false);assert.equal(revoked,true);f.scene.destroy();
});
test('Viewer replacement between frames hides old owned sampled lines and preserves both foreign collections',async()=>{
 const f=fixture(),foreignOld={};f.viewer.scene.primitives.add(foreignOld);await f.mount();f.scene.syncFrame(f.utc,1000);const line=f.scene.links.get('1-2').line,phase=line.material.uniforms.time,newPrimitives=new Collection(),foreignNew={};newPrimitives.add(foreignNew);
 f.scene.viewerProvider={scene:{mode:3,primitives:newPrimitives}};f.scene.syncFrame(f.utc,9000);assert.equal(line.show,false);assert.equal(line.material.uniforms.time,phase);assert.equal(f.scene.sampledLinkReceipt,null);assert.deepEqual(newPrimitives.items,[foreignNew]);f.scene.destroy();assert.deepEqual(f.viewer.scene.primitives.items,[foreignOld]);assert.deepEqual(newPrimitives.items,[foreignNew]);
});

test('exact to sampled to exact reuses resources while removing previous authority labels',async()=>{
 const f=fixture();await f.mount();f.scene.verifyLinkSnapshot=value=>!value.presentation_kind;
 const exact={...metadata,status:'valid',utc:analysisUtc,node_definitions:f.nodes,terminals:[],pairs:[{key:'1-2',a:'1',b:'2',state:'locked'}]};
 assert.equal(f.scene.setLinks(exact),true);const line=f.scene.links.get('1-2').line;
 f.advance(.25);f.scene.syncFrame(f.utc,1000);assert.equal(line.show,true);assert.equal(f.scene.linkReceipt,null);
 f.revoke();exact.utc=f.utc;assert.equal(f.scene.setLinks(exact),true);f.scene.syncFrame(f.utc,2000);assert.equal(line.show,true);assert.equal(f.scene.sampledLinkReceipt,null);assert.equal(f.scene.links.get('1-2').presentation_kind,undefined);assert.equal(f.scene.links.get('1-2').analysis_utc,undefined);f.scene.destroy();
});

for(const availability of ['error','unavailable'])test(`a frozen sampled receipt with ${availability} availability never renders even with a permissive verifier`,async()=>{
 const f=fixture();await f.mount();f.mutate=view=>({...view,availability});f.port.verify=()=>true;f.scene.syncFrame(f.utc,1000);assert.equal(shown(f).length,0);f.scene.destroy();
});

test('copied deeply frozen sample cannot substitute for private owner registration',async()=>{
 const f=fixture();await f.mount();const read=f.port.read;f.port.read=()=>freeze(structuredClone(read()));f.scene.syncFrame(f.utc,1000);assert.equal(shown(f).length,0);f.scene.destroy();
});

for(const invalid of ['missing','nonfinite','error','hash','throw'])test(`current native ${invalid} endpoint suppresses sampled flow without claiming a stale position`,async()=>{
 const f=fixture();await f.mount();f.scene.syncFrame(f.utc,1000);const line=f.scene.links.get('1-2').line,phase=line.material.uniforms.time,geometry=f.scene.geometryFor;
 f.scene.geometryFor=(node,input)=>{if(node.id!=='2')return geometry(node,input);if(invalid==='missing')return null;if(invalid==='throw')throw Error('native gap');const value=geometry(node,input);if(invalid==='nonfinite')value.row.position_m[0]=NaN;if(invalid==='error'){value.row.status='error';value.row.error_code='native failure';}if(invalid==='hash')value.definition_hash='b'.repeat(64);return value;};
 f.scene.syncFrame(f.utc,9000);assert.equal(line.show,false);assert.equal(line.material.uniforms.time,phase);f.scene.destroy();
});
