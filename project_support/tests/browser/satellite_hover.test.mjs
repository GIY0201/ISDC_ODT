import test from 'node:test';
import assert from 'node:assert/strict';
import {createSatelliteHover} from '../../../user_application/web/scripts/tabs/satellite_hover.js';
import {NODE_COMMUNICATION_METADATA} from '../../../user_application/web/scripts/nodes/node_timeline.js';

function fixture(width=400,height=240){
 const nodes=[];
 const document={createElement(tag){const n={tag,style:{},hidden:false,textContent:'',children:[],offsetWidth:180,offsetHeight:64,append(...items){this.children.push(...items);},remove(){n.removed=true;}};nodes.push(n);return n;}};
 const listeners=new Map(),container={ownerDocument:document,clientWidth:width,clientHeight:height,append(n){this.card=n;},addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k,fn){if(listeners.get(k)===fn)listeners.delete(k);}};
 const calls=[],cesium={Cartesian3:class{constructor(...args){this.args=args;}},Cartographic:{fromCartesian(p){calls.push(p.args);return{height:123456};}}};
 return{container,cesium,calls,listeners,nodes};
}
const payload=()=>({item:{OBJECT_NAME:'ISS <img onerror=attack()>',ORBIT_REGIME:'LEO'},id:25544,position:{frame:'ITRF',utc:'2026-10-05T00:00:00Z',catalog_number:25544,position_m:[1,2,3],interpolated:true},screen:{x:395,y:230}});
const nodePayload=()=>({kind:'source_node',id:'NODE-1',item:{OBJECT_NAME:'Node <script>literal</script>',ORBIT_REGIME:'MEO'},screen:{x:395,y:230},node_geometry:{...NODE_COMMUNICATION_METADATA,node_id:'NODE-1',node_definition:{schema:1,id:'NODE-1'},definition_hash:'a'.repeat(64),row:{utc:'2026-10-05T00:00:00.000000000Z',status:'valid',error_code:null,position_m:[1,2,3],height_km:550}}});

test('same card displays source native node height and explicit approximate provenance without ITRF conversion',()=>{
 const f=fixture(),hover=createSatelliteHover(f.container,f.cesium),p=nodePayload();hover.show(p);
 assert.equal(f.container.card.hidden,false);assert.equal(f.container.card.children[0].textContent,p.item.OBJECT_NAME);assert.match(f.container.card.children[1].textContent,/NODE-1.*MEO.*550.000 km/);assert.doesNotMatch(f.container.card.children[1].textContent,/NORAD/);
 assert.match(f.container.card.children[2].textContent,/2026-10-05T00:00:00.000000000Z.*근사/);assert.equal(f.calls.length,0);
 hover.clear('gp');assert.equal(f.container.card.hidden,false);hover.clear('source_node');assert.equal(f.container.card.hidden,true);
 hover.show(payload());hover.clear('source_node');assert.equal(f.container.card.hidden,false);hover.clear('gp');assert.equal(f.container.card.hidden,true);hover.destroy();
});

test('native hover rejects wrong provenance/hash/definition/UTC/status/height rather than relabeling source metres',()=>{
 const f=fixture(),hover=createSatelliteHover(f.container,f.cesium);
 for(const edit of [g=>g.frame='ITRF',g=>g.quality='measured',g=>g.source_commit='other',g=>g.definition_hash='bad',g=>g.node_definition.id='other',g=>g.row.utc='bad',g=>g.row.status='error',g=>g.row.error_code='failed',g=>g.row.height_km=NaN]){const p=nodePayload();edit(p.node_geometry);hover.show(p);assert.equal(f.container.card.hidden,true);}
 assert.equal(f.calls.length,0);
});

test('original hover facts use native picked metres and that position UTC; catalog text stays literal',()=>{
 const f=fixture(),hover=createSatelliteHover(f.container,f.cesium);hover.show(payload());
 const card=f.container.card;assert.equal(card.hidden,false);assert.equal(card.children[0].textContent,payload().item.OBJECT_NAME);
 assert.match(card.children[1].textContent,/NORAD 25544 \/ LEO \/ 123.456 km/);
 assert.match(card.children[2].textContent,/2026-10-05T00:00:00Z/);assert.match(card.children[2].textContent,/보간/);assert.match(card.children[2].textContent,/타원체/);
 assert.deepEqual(f.calls,[[1,2,3]]);assert.equal(card.style.left,'212px');assert.equal(card.style.top,'168px');
 assert.ok(f.nodes.every(n=>!Object.hasOwn(n,'innerHTML')));
});

test('invalid frame, geometry, UTC, identity, screen and failed pick hide without coordinate conversion',()=>{
 const changes=[p=>p.position.frame='TEME',p=>p.position.position_m=[1,2],p=>p.position.position_m[0]=Infinity,p=>p.position.utc='',p=>p.position.utc='2026-10-05T00:00:00+00:00',p=>p.position.catalog_number=999,p=>p.screen.x=NaN,p=>p.item=null];
 const f=fixture(),hover=createSatelliteHover(f.container,f.cesium);
 for(const change of changes){const p=payload();change(p);hover.show(p);assert.equal(f.container.card.hidden,true);}
 hover.show(null);assert.equal(f.calls.length,0);
});

test('hover does not mutate caller or retain changing geometry; exactly one conversion per valid pick',()=>{
 const f=fixture(),hover=createSatelliteHover(f.container,f.cesium),p=payload(),before=structuredClone(p);
 hover.show(p);assert.deepEqual(p,before);p.position.utc='2026-10-05T01:00:00Z';p.position.position_m=[4,5,6];hover.show(p);
 assert.deepEqual(f.calls,[[1,2,3],[4,5,6]]);assert.match(f.container.card.children[2].textContent,/01:00:00Z/);
});

test('oversized card in small globe stays inside available origin; names are bounded by code points',()=>{
 const f=fixture(90,50),hover=createSatelliteHover(f.container,f.cesium),p=payload();p.item.OBJECT_NAME='🛰'.repeat(300);hover.show(p);
 assert.equal([...f.container.card.children[0].textContent].length,256);assert.equal(f.container.card.style.left,'0px');assert.equal(f.container.card.style.top,'0px');
});

test('mouseleave, conversion failure and dispose remove only owned card/listener and prevent later updates',()=>{
 const f=fixture(),hover=createSatelliteHover(f.container,f.cesium);hover.show(payload());f.listeners.get('mouseleave')();assert.equal(f.container.card.hidden,true);
 f.cesium.Cartographic.fromCartesian=()=>{throw Error('bad geometry');};hover.show(payload());assert.equal(f.container.card.hidden,true);
 hover.destroy();hover.destroy();assert.equal(f.listeners.size,0);assert.equal(f.container.card.removed,true);hover.show(payload());assert.equal(f.container.card.hidden,true);
});

test('nonfinite ellipsoid height is unavailable; no zero or fabricated height',()=>{
 const f=fixture(),hover=createSatelliteHover(f.container,f.cesium);f.cesium.Cartographic.fromCartesian=()=>({height:NaN});hover.show(payload());assert.equal(f.container.card.hidden,true);
});

test('failed row with residual finite coordinates is hidden rather than displaying stale height',()=>{
 const f=fixture(),hover=createSatelliteHover(f.container,f.cesium),p=payload();p.position.status='error';p.position.error_code='propagation_failed';hover.show(p);assert.equal(f.container.card.hidden,true);assert.equal(f.calls.length,0);
});
