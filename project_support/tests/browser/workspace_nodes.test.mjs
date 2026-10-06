import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceNodes} from '../../../user_application/web/scripts/workspace_nodes.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as oisl from '../../../digital_twin/simulation/browser/oisl.js';
import {NODE_COMMUNICATION_METADATA} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {fixture as actualWorkspaceFixture} from './workspace_fixture.mjs';

function fixture({native=false}={}){
 let id=0,context=null,displayListener,rendererFactory,panelOptions,interaction,renderer,removeCount=0;const calls=[],sections=new Map();
 const host={innerWidth:1280,innerHeight:720,localStorage:null,crypto:{randomUUID:()=>`test-${++id}`},setTimeout,clearTimeout,addEventListener(){},removeEventListener(){},confirm:()=>true};
 const buttons=new Map(['nodes-deploy','nodes-recall','deploy-state'].map(key=>[key,{disabled:false,textContent:'',addEventListener(k,fn){this.fn=fn;},removeEventListener(){}}]));
 const document={getElementById:id=>id==='screen'?{prepend:root=>sections.set(root.id,root)}:sections.get(id)??null,createElement:()=>({querySelector:selector=>buttons.get(selector.slice(1))??null,remove(){sections.delete(this.id);}})};
 const globe={observeDisplayContext(fn){displayListener=fn;fn(context);return()=>removeCount++;},bindNodeRenderer(fn){rendererFactory=fn;return()=>removeCount++;},nodeRendererState:()=>({phase:'ready'}),observeNodeRenderer:()=>()=>removeCount++,setSatelliteModel:(...v)=>calls.push(['model',...v]),clearSatelliteModel:()=>calls.push(['clear']),focusSatelliteModel:()=>{calls.push(['focus']);return true;},releaseSatelliteModel:()=>calls.push(['release'])};
 globe.bindNodeInteraction=value=>{interaction=value;return()=>removeCount++;};
 const Scene=class{constructor(options){this.options=options;this.points=new Map();this.labels=new Map();this.models=new Map();}async setNodes(entries){calls.push(['nodes',entries]);this.points=new Map(entries.map(entry=>[entry.id,{show:true}]));}setHovered(id){calls.push(['hover',id]);}select(id){calls.push(['select',id]);}setLinks(){}update(){}destroy(){calls.push(['destroy']);}syncFrame(){}setLinksVisible(){}setModelsVisible(){}};
 const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++id}`});
 const tools={workPanelMarkup:()=>'<panel>',createNodeWorkPanel(options){panelOptions=options;return{refresh(){},destroy(){calls.push(['panel-destroy']);}};}};
 const fetchImpl=async(url,options)=>{calls.push(['http',url,options.method]);return{ok:true,json:async()=>({revision:0,run_id:'run',scope_id:'run:unconfigured',deployment_id:null,nodes:[]})};};
 const codec=createUtcCodec(LEAP_SHA256),row=utc=>({utc,status:'valid',error_code:null,position_m:[7000000,2,3],inertial_velocity_km_s:[0,7.5,0],raan_deg:0,argp_deg:0,mean_anomaly_deg:0,sunlit:true,longitude_deg:0,latitude_deg:0,height_km:550});
 const api={nodeSamples:async p=>{calls.push(['samples']);if(!native)throw Error('test unavailable');return{schema_version:1,...NODE_COMMUNICATION_METADATA,request_id:p.request_id,status:'valid',nodes:p.nodes.map(node=>({node_id:node.id,definition_hash:'a'.repeat(64),rows:Array.from({length:p.count},(_,i)=>row(codec.advance(p.start_utc,i)))}))};},nodeTrack:async p=>{if(!native)throw Error('test unavailable');return{schema_version:1,...NODE_COMMUNICATION_METADATA,request_id:p.request_id,status:'valid',nodes:p.nodes.map(node=>{const period=orbitElements(node.orbit).period/60;return{node_id:node.id,definition_hash:'a'.repeat(64),period_minutes:period,path_visible:true,rows:Array.from({length:121},(_,i)=>row(codec.advance(new Date(Math.trunc(Date.parse(p.center_utc)+(i-60)*period*60000/120)).toISOString(),0)))};})};}};
 const workspace=createWorkspaceNodes({api,globe,library,orbitElements,catalogElements,oisl,Scene,tools,document,host,now:()=>1791151272000,resolveModel:()=>({key:'flat',url:'/flat.glb'}),models:()=>[],fetchImpl});
 return{workspace,calls,buttons,sections,context(value){context=value;displayListener(value);},get options(){return panelOptions;},get interaction(){return interaction;},get renderer(){return renderer;},attach(){return renderer=rendererFactory({},{});},get removeCount(){return removeCount;}};
}
test('source node workspace starts with readonly GET, mounts existing panel and never deploys or focuses passively',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);await f.workspace.start();assert.deepEqual(f.calls.filter(c=>c[0]==='http').map(c=>c[2]),['GET']);
 f.workspace.show('satellite');assert.ok(f.sections.has('satellite-nodes'));assert.ok(f.options.store);f.options.store.add({name:'test'});
 f.attach();assert.equal(f.calls.some(c=>c[0]==='focus'),false);assert.equal(f.calls.some(c=>c[0]==='samples'),false);
 f.workspace.show('ground');assert.equal(f.sections.get('satellite-nodes').hidden,true);f.workspace.destroy();assert.equal(f.sections.size,0);assert.equal(f.removeCount,4);
});
test('accepted native buffers drive the mounted source selection and explicit focus through the existing globe',async()=>{
 const f=fixture({native:true});await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'test'});f.attach();
 f.options.onSelected(f.options.store.selected);f.context({utc:'2026-10-04T22:01:12.000000000Z'});
 for(let i=0;i<40&&!f.calls.some(c=>c[0]==='model');i++)await new Promise(resolve=>setTimeout(resolve,5));
 const model=f.calls.find(c=>c[0]==='model');assert.ok(model);assert.equal(model[1].pose_source.kind,'source_node');
 const pose=model[2].sampleAt('2026-10-04T22:01:12.000000000Z');assert.deepEqual(pose.row.position_m,[7000000,2,3]);assert.equal(pose.frame,'EARTH_FIXED_GMST_UTC_APPROX');
 assert.equal(f.calls.some(c=>c[0]==='focus'),false);assert.equal(await f.options.onFocus(),true);assert.equal(f.calls.filter(c=>c[0]==='focus').length,1);
 f.options.store.update(f.options.store.selectedId,{...f.options.store.selected,name:'edited'});assert.equal(model[2].sampleAt('2026-10-04T22:01:12.000000000Z'),null);
 f.context(null);assert.equal(await f.options.onFocus(),false);f.workspace.destroy();assert.equal(f.calls.filter(c=>c[0]==='http').every(c=>c[2]==='GET'),true);
});
test('mounted node picking validates current buffer and actual owned primitive before selection',async()=>{
 const f=fixture({native:true});await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'test'});f.attach();
 const node=f.options.store.selected,point=f.renderer.points.get(node.id);assert.equal(f.interaction.owns(node.id,point),false);
 f.context({utc:'2026-10-04T22:01:12.000000000Z'});for(let i=0;i<40&&!f.interaction.owns(node.id,point);i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(f.interaction.owns(node.id,point),true);assert.equal(f.interaction.owns(node.id,{show:true}),false);
 f.interaction.onSelect(node.id);assert.equal(f.calls.some(c=>c[0]==='focus'),false);f.interaction.onHover(node.id);assert.deepEqual(f.calls.at(-1),['hover',node.id]);
 f.context(null);assert.equal(f.interaction.owns(node.id,point),false);f.workspace.destroy();assert.equal(f.interaction.owns(node.id,point),false);
});
test('missing display UTC and native failure cannot produce a model pose or dispatch focus',async()=>{
 const f=fixture();await f.workspace.start();f.workspace.show('satellite');f.options.store.add({name:'test'});f.attach();
 assert.equal(await f.options.onFocus(),false);assert.equal(f.calls.some(c=>c[0]==='model'),false);
 f.context({utc:'2026-10-04T22:01:12.000000000Z'});await new Promise(resolve=>setTimeout(resolve,30));assert.equal(f.calls.some(c=>c[0]==='samples'),true);
 assert.equal(f.calls.some(c=>c[0]==='model'),false);assert.equal(await f.options.onFocus(),false);f.workspace.destroy();
});
test('real V6 assembly mounts the original work panel, binds add editor and remains read-only on restore',async()=>{
 const requests=[],f=actualWorkspaceFixture(1280,720,{hash:'#satellite',fetch:async(url,options)=>{requests.push([url,options.method]);return{ok:true,json:async()=>({revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]})};}});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.ok(f.doc.getElementById('satellite-nodes'));assert.match(f.get('satellite-nodes').innerHTML,/Walker Δ/);
 assert.equal(f.get('node-count').textContent,'0');assert.deepEqual(requests,[['/api/data-management/deployment','GET']]);
 assert.equal(f.evaluate('nodeClock.read(nodeWorkspace.snapshot().display).mode'),'저장 궤도');
 await f.get('node-add').dispatch('click');assert.equal(f.get('node-count').textContent,'1');assert.equal(f.get('node-editor').hidden,false);
 assert.equal(requests.length,1);await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.get('satellite-nodes').isConnected,false);f.dispose();
});
