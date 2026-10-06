import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSatelliteNodePanelTools} from '../../../user_application/web/scripts/tabs/satellite_nodes.js';
import {createNodeEditorTools} from '../../../user_application/web/scripts/nodes/editor.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import {createConstellationStore} from '../../../user_application/web/scripts/nodes/constellation.js';
const epoch=1791151272000,utc=new Date(epoch).toISOString();
class Element {
  constructor(){this.listeners=new Map();this.attributes=new Map();this.dataset={};this.style={};this.hidden=false;this.disabled=false;this.checked=false;this.value='';this.textContent='';this.children=[];this.ids=new Map();this.live=new Map();this.html='';}
  addEventListener(key,fn){if(!this.listeners.has(key))this.listeners.set(key,new Set());this.listeners.get(key).add(fn);}
  removeEventListener(key,fn){this.listeners.get(key)?.delete(fn);}
  async dispatch(key,event={}){for(const fn of [...(this.listeners.get(key)??[])])await fn({target:this,preventDefault(){},...event});}
  setAttribute(key,value){this.attributes.set(key,String(value));}getAttribute(key){return this.attributes.get(key)??null;}removeAttribute(key){this.attributes.delete(key);}
  focus(){this.focused=true;}contains(target){return this===target||this.children.some(child=>child.contains(target));}
  closest(selector){return selector==='[data-node-id]'&&this.dataset.nodeId?this:null;}
  set innerHTML(value){this.html=value;this.ids.clear();this.live.clear();this.rows=[];
    for(const match of value.matchAll(/<[a-z][^>]*\sid="([^"]+)"[^>]*>/g)){const el=new Element();el.disabled=/\sdisabled(?:\s|>)/.test(match[0]);el.hidden=/\shidden(?:\s|>)/.test(match[0]);this.ids.set(match[1],el);}
    for(const match of value.matchAll(/data-live="([^"]+)"/g))this.live.set(match[1],new Element());
    for(const match of value.matchAll(/data-node-id="([^"]+)"/g)){const row=new Element();row.dataset.nodeId=match[1];row.dot=new Element();this.rows.push(row);}
  }get innerHTML(){return this.html;}
  querySelector(selector){if(selector==='.status-dot')return this.dot??null;if(selector.startsWith('#'))return this.ids.get(selector.slice(1))??null;return this.live.get(/data-live="([^"]+)"/.exec(selector)?.[1])??null;}
  querySelectorAll(selector){if(selector==='[data-node-id]')return this.rows??[];return [];}
}
class Root extends Element {
  constructor(markup){super();this.innerHTML=markup;this.scene=[];
    for(const match of markup.matchAll(/data-node-scene="([^"]+)"/g)){const button=new Element();button.dataset.nodeScene=match[1];this.scene.push(button);}
    this.presets=[];for(const match of markup.matchAll(/data-formation-preset="([^"]+)"/g)){const button=new Element();button.dataset.formationPreset=match[1];this.presets.push(button);}
  }
  querySelectorAll(selector){if(selector==='[data-node-scene]')return this.scene;if(selector==='[data-formation-preset]')return this.presets;return [];}
}
function setup(){
  let eq=0,id=0;const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++eq}`});
  const tools=createSatelliteNodePanelTools({library}),store=createConstellationStore({library,now:()=>epoch});store.load();
  const timers={set:()=>++id,clear(){}};
  const root=new Root(tools.workPanelMarkup());
  const editorTools=createNodeEditorTools({library,catalogElements,now:()=>epoch});
  return {library,tools,store,root,timers,editorTools};
}
function geometry(node){return {node_id:node.id,node_definition:structuredClone(node),definition_hash:'test-hash',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption',row:{utc,status:'valid',error_code:null,position_m:[7000000,0,0],inertial_velocity_km_s:[0,7.5,0],raan_deg:12,argp_deg:23,mean_anomaly_deg:34,longitude_deg:1,latitude_deg:2,height_km:550,sunlit:true}};}
test('source work panel contains all edit/formation/scene controls without a second Viewer or enabled unaccepted deploy',()=>{
  const {tools}=setup(),markup=tools.workPanelMarkup();for(const id of ['formation-prefix','formation-bus','formation-links','formation-controls','formation-live','formation-generate','formation-remove','nodes-clear','deploy-state','nodes-deploy','nodes-recall','node-count','node-add','node-fleet','node-status','node-editor','node-tip','node-clock','node-clock-pause','node-clock-back','node-clock-forward','node-clock-speed','node-clock-now','node-lighting','node-zoom'])assert.match(markup,new RegExp(`id="${id}"`));
  assert.doesNotMatch(markup,/node-cesium|globe-fallback|<canvas|<iframe|<script/);assert.match(markup,/id="nodes-deploy"[^>]*disabled/);assert.match(markup,/role="listbox"/);assert.match(markup,/aria-live="polite"/);assert.match(markup,/공용 지구/);
});
test('scene controls read owner state and only explicit clicks invoke existing actions, with current-owner aria',async()=>{
  const {tools,root}=setup(),calls=[],errors=[];let scene={ready:true,tracks:true,links:true,models:true,lighting:true,zoom:50},display={utc,running:false,speed:1,speeds:[1,10,60],mode:'paused'};
  const actions={home:()=>calls.push('home'),untrack:()=>calls.push('untrack'),toggleTracks:()=>{calls.push('tracks');scene.tracks=!scene.tracks;},setLinksVisible:v=>{calls.push(['links',v]);scene.links=v;},setModelsVisible:v=>{scene.models=v;},setLighting:v=>{scene.lighting=v;},zoomBy:v=>calls.push(['zoomBy',v]),setZoom:v=>{scene.zoom=v;},play:()=>{display.running=true;},pause:()=>{display.running=false;},step:v=>calls.push(['step',v]),setSpeed:v=>{display.speed=v;},live:()=>calls.push('live')};
  const panel=tools.createNodeSceneControls({root,readScene:()=>scene,readDisplay:()=>display,actions,onError:e=>errors.push(e)});
  assert.deepEqual(calls,[]);assert.equal(root.ids.get('node-clock').textContent,utc);const tracks=root.scene.find(b=>b.dataset.nodeScene==='tracks');await tracks.dispatch('click');assert.equal(tracks.getAttribute('aria-pressed'),'false');
  await root.scene.find(b=>b.dataset.nodeScene==='home').dispatch('click');assert.deepEqual(calls.slice(-2),['untrack','home']);
  await root.ids.get('node-clock-pause').dispatch('click');assert.equal(display.running,true);await root.ids.get('node-clock-pause').dispatch('click');assert.equal(display.running,false);
  await root.ids.get('node-clock-back').dispatch('click');await root.ids.get('node-clock-forward').dispatch('click');assert.deepEqual(calls.slice(-2),[['step',-60],['step',60]]);
  const speed=root.ids.get('node-clock-speed');speed.value='60';await speed.dispatch('change');assert.equal(display.speed,60);speed.value='600';await speed.dispatch('change');assert.equal(display.speed,60);assert.equal(errors.length,1);
  panel.destroy();assert.equal(tracks.listeners.get('click').size,0);
});
test('unavailable scene or missing owners stay disabled and held callbacks cannot execute after disposal',async()=>{
  const {tools,root}=setup();let ready=false,count=0;const panel=tools.createNodeSceneControls({root,readScene:()=>({ready}),readDisplay:()=>({utc}),actions:{home:()=>count++,untrack:()=>{}}});
  const home=root.scene.find(b=>b.dataset.nodeScene==='home'),held=[...home.listeners.get('click')][0];assert.equal(home.disabled,true);await held();assert.equal(count,0);ready=true;panel.refresh();assert.equal(home.disabled,false);panel.destroy();await held();assert.equal(count,0);assert.equal(root.ids.get('node-clock-pause').disabled,true);
});
test('whole component assembly synchronizes source fleet, status, editor, formation and clears without automatic focus',async()=>{
  const {tools,root,store,editorTools,timers}=setup();let available=true,focus=0;const selected=[];
  const panel=tools.createNodeWorkPanel({root,store,editorTools,timers,now:()=>epoch,createFormationId:()=> 'F-work',readDisplay:()=>({utc}),geometryFor:node=>available?geometry(node):null,viewport:()=>({width:1280,height:720}),confirmClear:()=>true,onSelected:(node,reason)=>selected.push({node,reason}),onFocus:()=>focus++});
  assert.equal(focus,0);await root.ids.get('node-add').dispatch('click');assert.equal(root.ids.get('node-count').textContent,'1');assert.equal(root.ids.get('node-status').hidden,true);
  await root.ids.get('node-editor').dispatch('submit');assert.equal(root.ids.get('node-status').hidden,false);assert.equal(root.ids.get('node-status').live.get('raan').textContent,'12.00°');
  const fleet=root.ids.get('node-fleet'),row=fleet.rows[0];await row.dispatch('click');assert.equal(selected.length,1);assert.deepEqual(selected[0].reason,{userInitiated:true,focus:false});assert.equal(focus,0);
  await fleet.dispatch('dblclick',{target:row});assert.equal(focus,1);available=false;await fleet.dispatch('dblclick',{target:row});assert.equal(focus,1);
  await root.ids.get('nodes-clear').dispatch('click');assert.equal(store.drafts.length,0);assert.equal(root.ids.get('node-count').textContent,'0');assert.equal(root.ids.get('nodes-deploy').disabled,true);panel.destroy();assert.equal(fleet.listeners.get('dblclick').size,0);
});
test('passive restore and display refresh cannot dispatch selected/focus/clock/deployment commands',()=>{
  const {tools,root,store,editorTools,timers}=setup();store.add();let commands=0;const panel=tools.createNodeWorkPanel({root,store,editorTools,timers,now:()=>epoch,createFormationId:()=> 'F-work',readDisplay:()=>({utc}),viewport:()=>({width:1280,height:720}),onSelected:()=>commands++,onFocus:()=>commands++,actions:{home:()=>commands++,live:()=>commands++}});
  panel.refresh();store.load();panel.refresh();assert.equal(commands,0);panel.destroy();
});
test('source editor/formation/status styles are scoped to the work panel and exclude private-globe rules',async()=>{
  const css=await readFile(new URL('../../../user_application/web/styles/satellite_nodes.css',import.meta.url),'utf8');
  for(const selector of ['.ns-editor','.ns-sliders','.ns-eq-row','.ns-terminal','.ns-fleet-row','.ns-tip'])assert.ok(css.includes(`.satellite-node-work-panel ${selector}`));
  assert.doesNotMatch(css,/#view-nodes|node-cesium|cesium-credit|globe-fallback/);assert.match(css,/overflow: auto/);assert.match(css,/:focus-visible/);assert.match(css,/max-width: 900px/);
});
test('Escape and source zoom wheel amounts delegate only from this panel, never after disposal',async()=>{
  const {tools,root}=setup(),calls=[];const controls=tools.createNodeSceneControls({root,readScene:()=>({ready:true,zoom:50}),readDisplay:()=>({utc}),actions:{untrack:value=>calls.push(['untrack',value]),zoomBy:value=>calls.push(['wheel',value])}});
  await root.dispatch('keydown',{key:'Escape'});await root.ids.get('node-zoom-in').dispatch('click');await root.ids.get('node-zoom-out').dispatch('click');
  assert.deepEqual(calls,[['untrack',{aimAtEarth:true}],['wheel',120],['wheel',-120]]);controls.destroy();await root.dispatch('keydown',{key:'Escape'});assert.equal(calls.length,3);
});

test('unavailable shared camera disables home before it can release tracking',async()=>{
 const {tools,root}=setup();let calls=0;
 const controls=tools.createNodeSceneControls({root,readScene:()=>({ready:true,cameraReady:false,zoom:null}),readDisplay:()=>({utc}),actions:{untrack:()=>calls++,home:()=>calls++}});
 const home=root.scene.find(button=>button.dataset.nodeScene==='home');assert.equal(home.disabled,true);await home.dispatch('click');assert.equal(calls,0);controls.destroy();
});
test('formation/inspector markup and source presentation rules match pinned original static receipt',async()=>{
  const {tools}=setup();const fixture=JSON.parse(await readFile(new URL('../fixtures/original_node_work_panel.json',import.meta.url),'utf8'));
  const formation=fixture.formationMarkup.replace('id="nodes-deploy" class="ns-deploy"','id="nodes-deploy" class="ns-deploy" disabled').replace('대시보드 미반영','서버 배치 미확인').replace('작업 세트의 사본을 대시보드(궤도 탭) 카탈로그에 반영합니다. 대시보드의 SDC 버튼으로 내 위성만 볼 수 있습니다.','서버 수락 경로 연결 후 명시적으로 배치합니다. 현재는 서버 배치 미확인입니다.').replace('대시보드에서 내 위성을 모두 제거합니다. 작업 세트는 유지됩니다.','서버 수락 경로 연결 후 명시적으로 회수합니다. 작업 세트는 유지됩니다.');
  assert.ok(tools.workPanelMarkup().includes(formation.replaceAll('\r\n','\n')));assert.ok(tools.workPanelMarkup().includes(fixture.inspectorMarkup.replaceAll('\r\n','\n')));
  const css=await readFile(new URL('../../../user_application/web/styles/satellite_nodes.css',import.meta.url),'utf8');
  for(const rule of fixture.presentationRules)assert.ok(css.includes(rule.replaceAll('#view-nodes','.satellite-node-work-panel')),rule);
  assert.deepEqual(fixture.zoomWheelAmounts,[120,-120]);
});
test('shared-owner speeds extend source choices, malformed capabilities disable commands, and late actions preserve current state',async()=>{
  const {tools,root}=setup();let display={utc,running:false,speed:0.1,speeds:[0.1,1,10,60]},scene={ready:true,links:true};let finish;const errors=[];
  const controls=tools.createNodeSceneControls({root,readScene:()=>scene,readDisplay:()=>display,onError:error=>errors.push(error),actions:{setSpeed:value=>{display.speed=value;},setLinksVisible:()=>new Promise(resolve=>{finish=resolve;})}});
  assert.match(root.ids.get('node-clock-speed').innerHTML,/value="0.1"/);assert.equal(root.ids.get('node-clock-speed').value,'0.1');
  const links=root.scene.find(button=>button.dataset.nodeScene==='links');const pending=links.dispatch('click');scene.links=false;controls.refresh();finish(true);await pending;assert.equal(links.getAttribute('aria-pressed'),'false');
  display.speeds=[-1,NaN];controls.refresh();assert.equal(root.ids.get('node-clock-speed').disabled,true);const before=display.speed;root.ids.get('node-clock-speed').value='-1';await root.ids.get('node-clock-speed').dispatch('change');assert.equal(display.speed,before);
  controls.destroy();
});
test('disposal during home untracking prevents its later camera command and removes only owned listeners',async()=>{
  const {tools,root}=setup();let finish,homes=0,external=0;const home=root.scene.find(button=>button.dataset.nodeScene==='home');home.addEventListener('click',()=>external++);
  const panel=tools.createNodeSceneControls({root,readScene:()=>({ready:true}),readDisplay:()=>({utc}),actions:{untrack:()=>new Promise(resolve=>{finish=resolve;}),home:()=>homes++}});
  const pending=home.dispatch('click');await Promise.resolve();panel.destroy();finish();await pending;assert.equal(homes,0);assert.equal(external,1);assert.equal(home.listeners.get('click').size,1);
});
test('failed whole-panel construction releases already-created editor, formation and store subscriptions',()=>{
  const {tools,root,store,editorTools,timers}=setup();
  assert.throws(()=>tools.createNodeWorkPanel({root,store,editorTools,timers,now:()=>epoch,createFormationId:()=> 'F-work',readDisplay:()=>({utc}),readScene:null,viewport:()=>({width:1280,height:720})}),/dependencies_required/);
  assert.equal(root.ids.get('node-add').listeners.get('click').size,0);assert.equal(root.ids.get('node-editor').listeners.get('submit').size,0);assert.equal(root.ids.get('formation-generate').listeners.get('click').size,0);
  assert.doesNotThrow(()=>store.add());
});
