import test from 'node:test';
import assert from 'node:assert/strict';
import {createSatelliteNodePanelTools} from '../../../user_application/web/scripts/tabs/satellite_nodes.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import {createConstellationStore} from '../../../user_application/web/scripts/nodes/constellation.js';
import {NODE_COMMUNICATION_METADATA as metadata} from '../../../user_application/web/scripts/nodes/node_timeline.js';
const epoch=1791151272000,analysisUtc='2026-10-04T22:01:12.000000000Z',hash='a'.repeat(64);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
class Element{listeners=new Map();dataset={};attributes=new Map();hidden=false;style={};textContent='';addEventListener(event,fn){const list=this.listeners.get(event)??new Set();list.add(fn);this.listeners.set(event,list);}removeEventListener(event,fn){this.listeners.get(event)?.delete(fn);}setAttribute(name,value){this.attributes.set(name,value);}async dispatch(event){for(const fn of [...this.listeners.get(event)??[]])await fn({target:this});}}
class StatusHost extends Element{cells=new Map();ids=new Map();set innerHTML(value){this.html=value;if(!this.cells)return;this.cells.clear();this.ids.clear();for(const m of value.matchAll(/data-live="([^"]+)"/g))this.cells.set(m[1],new Element());for(const m of value.matchAll(/id="([^"]+)"/g))this.ids.set(m[1],new Element());}get innerHTML(){return this.html;}querySelector(selector){return selector.startsWith('#')?this.ids.get(selector.slice(1)):this.cells.get(/data-live="([^"]+)"/.exec(selector)?.[1]);}}
class FleetHost extends Element{rows=[];set innerHTML(value){this.html=value;if(!this.rows)return;this.rows=[...value.matchAll(/data-node-id="([^"]+)"/g)].map(m=>{const row=new Element();row.dataset.nodeId=m[1];row.dot=new Element();row.querySelector=()=>row.dot;return row;});}get innerHTML(){return this.html;}querySelectorAll(){return this.rows;}}
function setup(count=2){
 let sequence=0,utc='2026-10-04T22:01:12.250000000Z',source='catalog:source',valid=true,reads=0,checks=0,lease={},hook=null,verifyHook=null,helperHook=null,displayHook=null,rosterHook=null,mutate=view=>view;
 const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++sequence}`}),store=createConstellationStore({library,storage:null,now:()=>epoch});store.load();const node=store.add({bus:'flat_panel'});
 store.addMany(Array.from({length:count-1},(_,i)=>({...node,id:`FULL-${i}`,catalog_number:900002+i,name:`Full node ${i}`,equipment:node.equipment.map(item=>({...item,id:`${item.id}-${i}`}))})));store.select(node.id);
 const tools=createSatelliteNodePanelTools({library}),host=new StatusHost(),fleet=new FleetHost(),note=new Element(),countHost=new Element(),progressDates=[],registered=new WeakMap();
 const reader=()=>{reads++;hook?.();const nodes=store.presentationRoster().drafts,equipment=nodes[0].equipment.find(item=>library.equipmentSpec(item)?.kind==='oisl');const view=freeze(mutate({...metadata,schema_version:1,presentation_kind:'OPTICAL_SAMPLED_UI_V1',status:valid?'valid':'unavailable',error:null,availability:valid?'sampled':'unavailable',reason:'current_analysis_unavailable',utc:analysisUtc,analysis_utc:analysisUtc,display_utc:utc,age_seconds:(Date.parse(utc)-epoch)/1000,current_analysis:utc===analysisUtc,node_definitions:nodes,definition_hashes:Object.fromEntries(nodes.map(n=>[n.id,hash])),terminals:[{nodeId:node.id,equipmentId:equipment.id,targetId:nodes[1]?.id,spec:{label:'OISL terminal'},state:{phase:'acquiring',azimuth:1,elevation:2,pointingError:.03},geometry:{range_km:123},margin:{margin_db:4},role:'fore'}],pairs:nodes.slice(1).map(n=>({key:n.id,a:node.id,b:n.id,state:'locked'}))}));registered.set(view,lease);return view;};
 const verifier=(view,{utc:stamp})=>{checks++;verifyHook?.();return valid&&registered.get(view)===lease&&view.display_utc===utc&&stamp===utc;};
 const geometryFor=next=>({...metadata,node_id:next.id,node_definition:structuredClone(next),definition_hash:hash,row:{utc,status:'valid',error_code:null,position_m:[7000000,0,0],inertial_velocity_km_s:[3,4,0],raan_deg:12.25,argp_deg:34.5,mean_anomaly_deg:56.75,latitude_deg:1.2,longitude_deg:-2.3,height_km:621,sunlit:true}});
 const options={store,readPresentation:()=>{rosterHook?.();return store.presentationRoster();},readDisplay:()=>{displayHook?.();return {utc,key:source};},geometryFor,linksFor:()=>null,sampledLinksPresentationFor:reader,verifySampledLinkPresentation:verifier,oislPresentation:{acquisitionProgress:(_,__,date)=>{progressDates.push(date.toISOString());helperHook?.();return .5;},phaseLabel:()=>'<acquiring>',blockedLabel:()=>''}};
 const panel=tools.createNodeStatusPanel({...options,host}),list=tools.createNodeFleetPanel({...options,host:fleet,count:countHost,analysisHost:note});
 return {tools,store,node,host,fleet,note,countHost,panel,list,options,reader,progressDates,get utc(){return utc;},get reads(){return reads;},get checks(){return checks;},resetReads(){reads=0;checks=0;},advance(){utc='2026-10-04T22:01:12.500000000Z';},sourceChange(){source='catalog:foreign';},revoke(){valid=false;lease={};},recover(){valid=true;lease={};},set hook(value){hook=value;},set verifyHook(value){verifyHook=value;},set helperHook(value){helperHook=value;},set displayHook(value){displayHook=value;},set rosterHook(value){rosterHook=value;},set mutate(value){mutate=value;},destroy(){panel.destroy();list.destroy();}};
}

test('selected sampled status preserves current native values and freezes analysis-time acquisition and consumption',()=>{
 const f=setup();try{f.resetReads();const value=f.panel.refresh();assert.equal(f.reads,1);assert.equal(value.linksStatus,'sampled');assert.deepEqual(f.progressDates,['2026-10-04T22:01:12.000Z']);assert.equal(value.texts.generation,'4,500 W');assert.match(value.texts.consumption,/분석 시각/);assert.equal(value.texts.margin,'미확인');assert.equal(value.marginClass,'unknown');assert.match(value.equipmentMarkup,/분석 시각/);assert.match(value.terminalMarkup,/width:50%/);
  const note=f.host.cells.get('sampled-analysis').textContent;for(const term of [analysisUtc,f.utc,'0.250','engineering_assumption','현재 시각 통신 분석 미확인'])assert.ok(note.includes(term),term);
  f.advance();f.panel.refresh();assert.deepEqual(f.progressDates,['2026-10-04T22:01:12.000Z','2026-10-04T22:01:12.000Z']);assert.match(f.host.cells.get('sampled-analysis').textContent,/0\.500/);assert.equal(f.panel.canFocus(),false,'absence of focus owner stays disabled');
 }finally{f.destroy();}
});

test('full240 fleet preserves order, mode and owner selection with a visible sampled qualifier for every dot',async()=>{
 const f=setup(240);try{f.resetReads();f.list.refresh();assert.equal(f.reads,1);assert.equal(f.fleet.rows.length,240);assert.equal(f.countHost.textContent,'240');assert.ok(f.fleet.innerHTML.includes('Full node 238'));assert.ok(f.fleet.innerHTML.includes('ns-fleet-mode'));
  for(const row of f.fleet.rows){assert.equal(row.dot.className,'status-dot ok');assert.match(row.dot.title,/과거 분석|분석 시각/);assert.match(row.dot.attributes.get('aria-label'),/현재 시각 통신 분석 미확인/);}
  assert.equal(f.note.hidden,false);assert.match(f.note.textContent,/engineering_assumption/);await f.fleet.rows[239].dispatch('click');assert.equal(f.store.selectedId,'FULL-238');assert.equal(f.fleet.rows[239].attributes.get('aria-selected'),'true');
 }finally{f.destroy();}
});

for(const bad of ['copy','frozen-copy','scope','order','metadata','utc','analysis','hash','availability','age'])test(`sampled UI rejects ${bad} without manufacturing current power or fleet success`,()=>{
 const f=setup();try{if(bad==='copy'||bad==='frozen-copy'){const read=f.options.sampledLinksPresentationFor;f.options.sampledLinksPresentationFor=()=>bad==='copy'?structuredClone(read()):freeze(structuredClone(read()));f.panel.destroy();f.list.destroy();f.panel=f.tools.createNodeStatusPanel({...f.options,host:f.host});f.list=f.tools.createNodeFleetPanel({...f.options,host:f.fleet,analysisHost:f.note});}
  else f.mutate=v=>bad==='scope'?{...v,node_definitions:[{...v.node_definitions[0],notes:'foreign'},v.node_definitions[1]]}:bad==='order'?{...v,node_definitions:[...v.node_definitions].reverse()}:bad==='metadata'?{...v,frame:'foreign'}:bad==='utc'?{...v,display_utc:analysisUtc}:bad==='analysis'?{...v,analysis_utc:f.utc}:bad==='hash'?{...v,definition_hashes:{}}:bad==='availability'?{...v,availability:'error'}:{...v,age_seconds:NaN};
  const value=f.panel.refresh();assert.notEqual(value.linksStatus,'sampled');assert.equal(value.texts.consumption,'미확인');assert.equal(value.texts.margin,'미확인');f.list.refresh();assert.ok(f.fleet.rows.every(row=>row.dot.className==='status-dot neutral'));
 }finally{f.panel.destroy();f.list.destroy();}
});

for(const callback of ['reader','verify','helper'])for(const change of ['time','source','scope','select','revoke','destroy'])test(`${callback} ${change} during sampled status cannot publish old verified presentation`,()=>{
 const f=setup();try{let armed=true;const hook=()=>{if(!armed)return;armed=false;if(change==='time')f.advance();else if(change==='source')f.sourceChange();else if(change==='scope')f.store.update(f.node.id,{...f.store.find(f.node.id),notes:'new full scope'});else if(change==='select')f.store.select('FULL-0');else if(change==='revoke')f.revoke();else f.panel.destroy();};f[callback==='reader'?'hook':callback==='verify'?'verifyHook':'helperHook']=hook;
  const value=f.panel.refresh();assert.ok(f.host.hidden||!value||value.linksStatus!=='sampled');assert.ok(f.host.hidden||!value||value.texts.consumption==='미확인');
 }finally{f.destroy();}
});

test('revoked sample resets stale terminals and dots; exact generic status semantics remain unchanged',()=>{
 const f=setup();try{f.panel.refresh();f.list.refresh();f.revoke();const value=f.panel.refresh();assert.equal(value.texts.consumption,'미확인');assert.ok(!value.terminalMarkup.includes('width:50%'));f.list.refresh();assert.ok(f.fleet.rows.every(row=>row.dot.className==='status-dot neutral'));assert.match(f.note.textContent,/미확인/);
  const exact={...metadata,status:'valid',utc:f.utc,node_definitions:f.store.drafts,terminals:[],pairs:[]};const generic=f.tools.statusPresentation(f.node,{utc:f.utc,geometry:f.options.geometryFor(f.node),nodes:f.store.drafts,links:exact,verifyLinkSnapshot:()=>true});assert.equal(generic.linksStatus,'valid');assert.ok(!generic.texts.consumption.includes('분석 시각'));assert.notEqual(generic.texts.margin,'미확인');
 }finally{f.destroy();}
});

test('sampled work panel markup contains a separate visible-note host outside the fleet listbox',()=>{
 const f=setup();try{assert.match(f.tools.workPanelMarkup({sampledLinks:true}),/id="node-fleet-analysis"/);assert.ok(!f.tools.workPanelMarkup().includes('node-fleet-analysis'));}finally{f.destroy();}
});

test('selected final display getter sameUTC lease revocation cannot retain sampled power or terminals',()=>{
 const f=setup();try{let revoked=false;f.displayHook=()=>{if(!revoked&&f.checks>=4){revoked=true;f.revoke();}};const value=f.panel.refresh();assert.equal(revoked,true);assert.notEqual(value?.linksStatus,'sampled');assert.equal(value?.texts.consumption,'미확인');assert.ok(!f.host.cells.get('terminals').innerHTML.includes('width:50%'));}finally{f.destroy();}
});
test('fleet final display getter sameUTC lease revocation cannot retain sampled success dots',()=>{
 const f=setup();try{let revoked=false;f.displayHook=()=>{if(!revoked&&f.checks>=2){revoked=true;f.revoke();}};f.list.refresh();assert.equal(revoked,true);assert.ok(f.fleet.rows.every(row=>row.dot.className==='status-dot neutral'));assert.match(f.note.textContent,/미확인/);}finally{f.destroy();}
});
test('roster reader exception clears previously sampled selected and fleet claims without changing the store',()=>{
 const f=setup();try{f.panel.refresh();f.list.refresh();const original=f.store.drafts;f.rosterHook=()=>{throw Error('roster unavailable');};assert.doesNotThrow(()=>f.panel.refresh());assert.equal(f.host.hidden,true);assert.doesNotThrow(()=>f.list.refresh());assert.ok(f.fleet.rows.every(row=>row.dot.className==='status-dot neutral'));assert.match(f.note.textContent,/미확인/);assert.deepEqual(f.store.drafts,original);}finally{f.destroy();}
});
test('disposing a mounted sampled presentation suppresses retained visual status',()=>{
 const f=setup();f.panel.refresh();f.list.refresh();f.destroy();assert.equal(f.host.hidden,true);assert.ok(f.fleet.rows.every(row=>row.dot.className==='status-dot neutral'));assert.match(f.note.textContent,/미확인/);
});
test('fleet selected roster getter disposal cannot repaint sampled dots after destroy',()=>{
 const f=setup();try{let reads=0;f.rosterHook=()=>{if(++reads===4)f.list.destroy();};f.list.refresh();assert.equal(reads,4);assert.ok(f.fleet.rows.every(row=>row.dot.className==='status-dot neutral'));assert.match(f.note.textContent,/미확인/);assert.ok(!f.note.textContent.includes('분석 시각'));}finally{f.destroy();}
});
for(const state of ['revoked','fresh'])test(`fleet selected roster getter nested ${state} refresh cannot be overwritten by the outer paint`,()=>{
 const f=setup();try{let reads=0,reentered=false;f.rosterHook=()=>{if(++reads===4&&!reentered){reentered=true;f.rosterHook=null;if(state==='revoked')f.revoke();else{f.advance();f.store.select('FULL-0');}f.list.refresh();}};f.list.refresh();assert.equal(reentered,true);
  if(state==='revoked'){assert.ok(f.fleet.rows.every(row=>row.dot.className==='status-dot neutral'));assert.ok(!f.note.textContent.includes('분석 시각'));}
  else{assert.ok(f.fleet.rows.every(row=>row.dot.className==='status-dot ok'));assert.ok(f.note.textContent.includes(f.utc));assert.match(f.note.textContent,/0\.500/);assert.equal(f.fleet.rows[1].attributes.get('aria-selected'),'true');}
 }finally{f.destroy();}
});
test('fleet late selected-roster exception fails closed without repeating the failed reader',()=>{
 const f=setup();try{let reads=0;f.rosterHook=()=>{if(++reads>=4)throw Error('late roster unavailable');};assert.doesNotThrow(()=>f.list.refresh());assert.equal(reads,4);assert.ok(f.fleet.rows.every(row=>row.dot.className==='status-dot neutral'));assert.match(f.note.textContent,/미확인/);}finally{f.destroy();}
});
