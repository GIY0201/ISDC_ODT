import {createBrowserId} from '../../../user_application/web/scripts/browser_identity.js';
import {createGlobeViewPanel} from '../../../user_application/web/scripts/tabs/globe_view.js';
import {createSatelliteModelPanel} from '../../../user_application/web/scripts/tabs/satellite_model.js';
import {createSatelliteHover} from '../../../user_application/web/scripts/tabs/satellite_hover.js';
import {createSatelliteModelSelection} from '../../../user_application/web/scripts/orbit/satellite_model_selection.js';
import {createModelResolver,validateSatelliteManifest} from '../../../digital_twin/model_library/browser/satellite_models.js';
import {createCatalogTrack} from '../../../user_application/web/scripts/catalog_track.js';
import {createCatalogPasses} from '../../../user_application/web/scripts/catalog_passes.js';
import {createCatalogPassPanel} from '../../../user_application/web/scripts/tabs/catalog_passes.js';
import {createCatalogTimePanel} from '../../../user_application/web/scripts/tabs/catalog_time.js';
import {createCatalogScene} from '../../../user_application/web/scripts/catalog_scene.js';
import {createCatalogScenePanel} from '../../../user_application/web/scripts/tabs/catalog_scene.js';
import {createCatalogTimeline} from '../../../user_application/web/scripts/catalog_timeline.js';
import {GROUND_STATIONS,stationGroups} from '../../../digital_twin/model_library/browser/ground_station_sites.js';
import {createStationPanel} from '../../../user_application/web/scripts/tabs/station_workspace.js';
import {createCatalogGeometry} from '../../../user_application/web/scripts/catalog_geometry.js';
import {createCatalogPanel} from '../../../user_application/web/scripts/tabs/catalog_workspace.js';
import {createHilPanel} from '../../../user_application/web/scripts/tabs/hil_workspace.js';
import {hilTopology} from '../../../digital_twin/visualization/hil_topology.js';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createWorkspaceRevisionSync} from '../../../user_application/web/scripts/workspace_revision_sync.js';
import {createKpiPanel} from '../../../user_application/web/scripts/tabs/kpi_workspace.js';
import {createSimPanel} from '../../../user_application/web/scripts/tabs/sim_workspace.js';
import {createMissionPanel} from '../../../user_application/web/scripts/tabs/mission_workspace.js';
import {createGroundPanel} from '../../../user_application/web/scripts/tabs/ground_visibility.js';
import {createRadioSeriesPanel} from './orbit_radio_series_fixture.mjs';
import {createOrbitRadioPanel} from '../../../user_application/web/scripts/tabs/orbit_radio.js';
import {createCommunicationPlanningPanel} from '../../../user_application/web/scripts/tabs/communication_planning.js';
import {createRfPanel} from '../../../user_application/web/scripts/tabs/rf_link_budget.js';
import {createWorkspacePlayback} from '../../../user_application/web/scripts/workspace_playback.js';
import {LEAP_SHA256,createUtcCodec} from '../../../user_application/web/scripts/orbit_utc.js';
import {createNodeClockControls} from '../../../user_application/web/scripts/nodes/clock_controls.js';
import {createFuturePasses} from '../../../user_application/web/scripts/nodes/future_passes.js';
import {createWorkspaceNodes} from '../../../user_application/web/scripts/workspace_nodes.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import * as nodeOisl from '../../../digital_twin/simulation/browser/oisl.js';
import {NodeScene} from '../../../digital_twin/visualization/node_scene.js';
import {createSatelliteNodePanelTools} from '../../../user_application/web/scripts/tabs/satellite_nodes.js';
import {createGroundSegmentStore} from '../../../user_application/web/scripts/communication/ground_segment.js';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import * as networkDiagram from '../../../digital_twin/visualization/network_diagram.js';
import {NativeNetworkScene} from '../../../digital_twin/visualization/native_network_scene.js';
import {createFabricExchange} from '../../../user_application/web/scripts/tabs/fabric_exchange.js';
import {createDataFabricClient} from '../../../communication/browser/data_fabric.js';
import * as sourceStationModel from '../../../digital_twin/model_library/browser/ground_stations.js';
import {createGroundLinkModel} from '../../../digital_twin/simulation/browser/ground_links.js';
import {createNetworkSnapshotModel} from '../../../digital_twin/simulation/browser/network_snapshot.js';

// Execute the real window handlers and orbit assembly. Only DOM layout, HTTP,
// Cesium and scheduling are adapters; expected bounds are acceptance criteria.
import {createMissionServices} from '../../../user_application/web/scripts/missions/mission_services.js';
import {createSourceDataPanel} from '../../../user_application/web/scripts/tabs/source_data.js';
import {createSourceSecurityPanel} from '../../../user_application/web/scripts/tabs/source_security.js';
import {createSourceSettingsPanel} from '../../../user_application/web/scripts/tabs/source_settings.js';
import {projectWorkspaceContext} from '../../../user_application/web/scripts/workspace_context.js';
import {createAnalysisTransport} from '../../../user_application/web/scripts/scenario/analysis_transport.js';
import {createAnalysisFollowCoordinator} from '../../../user_application/web/scripts/scenario/analysis_follow.js';
import {createWorkspaceScenario} from '../../../user_application/web/scripts/scenario/workspace_adapter.js';
import {createSourceScenarioPanel} from '../../../user_application/web/scripts/tabs/source_scenarios.js';
import {createScenarioAssembly} from '../../../digital_twin/model_library/browser/scenario_assembly.js';
import * as scenarioKpi from '../../../digital_twin/verification/browser/scenario_kpi.js';
import * as dataViewModel from '../../../user_application/web/scripts/data_management/view_model.js';
import {createSourceMissionPanel} from '../../../user_application/web/scripts/tabs/source_missions.js';
import {createMissionTypes} from '../../../digital_twin/model_library/browser/mission_types.js';
import {createMissionConstraints} from '../../../digital_twin/simulation/browser/mission_constraints.js';
import {layoutTimeline,timelineMarkup} from '../../../digital_twin/visualization/mission_timeline.js';
const orchestrationSource=(await readFile(new URL('../../../communication/browser/orchestration.js',import.meta.url),'utf8')).replace('"/static/communication/data_fabric.js"',JSON.stringify(new URL('../../../communication/browser/data_fabric.js',import.meta.url).href));
const {createOrchestrationClient}=await import(`data:text/javascript;base64,${Buffer.from(orchestrationSource).toString('base64')}`);
const web=new URL('../../../user_application/web/scripts/',import.meta.url);
const windowSource=(await readFile(new URL('workspace.js',web),'utf8')).replace(/^import .*;\r?\n/,'');
const orbitSource=(await readFile(new URL('workspace_orbit.js',web),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/export function /g,'function ');
const globeSource=(await readFile(new URL('workspace_globe.js',web),'utf8')).replace(/'\/static\/visualization\/orbit_globe\.js(?:\?[^']*)?'/,JSON.stringify(new URL('../../../digital_twin/visualization/orbit_globe.js',import.meta.url).href)).replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href));
const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(globeSource).toString('base64')}`);
const solarSource=(await readFile(new URL('workspace_solar.js',web),'utf8')).replace("'/static/visualization/solar_display.js'",JSON.stringify(new URL('../../../digital_twin/visualization/solar_display.js',import.meta.url).href)).replace("'./solar_timeline.js'",JSON.stringify(new URL('../../../user_application/web/scripts/solar_timeline.js',import.meta.url).href));
const {createWorkspaceSolar}=await import(`data:text/javascript;base64,${Buffer.from(solarSource).toString('base64')}`);

export function fixture(width=1280,height=720,options={}){
  const elements=new Map(),jobs=[],timers=new Set(),frames=new Set(),viewers=[],channels=[],streams=[],charts=[],pickHandlers=[];
  let context,active=null,nextId=0,commands=0,queries=0,clientDestroyed=0;
  class Element {
    constructor(id='',tag='div'){this.id=id;this.tag=tag;this.style={};this.dataset={};this.attributes={};this.listeners=new Map();this.children=[];this.hidden=false;this.isConnected=true;this._value='';this._html='';this.textContent='';this.scrollTop=0;this.capture=null;const classes=new Set();this.classList={contains:v=>classes.has(v),add:v=>classes.add(v),remove:v=>classes.delete(v)};}
    set value(value){this._value=String(value??'');}get value(){return this._value;}
    set innerHTML(value){for(const child of this.descendants()){child.isConnected=false;if(elements.get(child.id)===child)elements.delete(child.id);}this.children=[];this._html=value;for(const match of value.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const child=new Element(match[3],match[1]);child.value=match[2].match(/\bvalue="([^"]*)"/)?.[1]||'';child.checked=/\bchecked\b/.test(match[2]);this.prepend(child);}}
    get innerHTML(){return this._html;}
    *descendants(){for(const child of this.children){yield child;yield* child.descendants();}}
    prepend(child){child.parent=this;child.isConnected=true;this.children.unshift(child);if(child.id)elements.set(child.id,child);}
    append(...children){for(const child of children){child.parent=this;child.isConnected=true;this.children.push(child);}}
    remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
    get ownerDocument(){return doc;}
    querySelector(selector){if(selector.startsWith('#'))return [...this.descendants()].find(el=>el.id===selector.slice(1))||null;return [...this.descendants()].find(el=>el.tag===selector)||null;}
    querySelectorAll(selector){return [...this.descendants()].filter(el=>selector.includes('input')?['input','select','textarea'].includes(el.tag):el.tag==='button');}
    addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
    removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
    async dispatch(name,data={}){await Promise.all([...this.listeners.get(name)||[]].map(fn=>fn({target:this,preventDefault(){},...data})));flush();}
    closest(selector){return selector==='button'&&this.tag==='button'?this:selector.includes('[data-view]')&&this.dataset.view?this:null;}
    setAttribute(name,value){this.attributes[name]=String(value);}removeAttribute(name){delete this.attributes[name];}
    hasAttribute(name){return name in this.attributes;}
    focus(){active=this;}
    setPointerCapture(id){this.capture=id;}releasePointerCapture(){this.capture=null;}
    getBoundingClientRect(){
      const number=(value,fallback)=>value?.startsWith('calc')?Number(value.includes('100vw')?context.innerWidth:context.innerHeight)-Number(value.match(/- (\d+)px/)?.[1]||0):value?parseFloat(value):fallback;
      const expanded=this.classList.contains('expanded');
      let w=number(this.style.width,Math.min(760,context.innerWidth-110)),h=number(this.style.height,Math.min(560,context.innerHeight-160));
      if(!expanded){w=Math.max(460,Math.min(context.innerWidth-90,w));h=Math.max(360,Math.min(context.innerHeight-130,h));}
      const left=number(this.style.left,76+.03*context.innerWidth),top=number(this.style.top,126);
      return {left,top,width:w,height:h,right:left+w,bottom:top+h};
    }
    get offsetWidth(){return this.getBoundingClientRect().width;}get offsetHeight(){return this.getBoundingClientRect().height;}
    get clientWidth(){return this.getBoundingClientRect().width;}get clientHeight(){return this.getBoundingClientRect().height;}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id,id.includes('button')||id.startsWith('window-')&&id!=='window-titlebar'?'button':'div'));return elements.get(id);};
  const doc=new Element('document');doc.getElementById=id=>elements.get(id)||null;doc.createElement=tag=>new Element('',tag);doc.body=new Element('body');Object.defineProperty(doc,'activeElement',{get:()=>active});doc.querySelector=()=>null;doc.querySelectorAll=()=>[];
  for(const id of [...windowSource.matchAll(/getElementById\('([^']+)'\)/g)].map(match=>match[1]))get(id);
  for(const id of ['stored-orbit-globe','orbit-globe-status','orbit-globe-focus','orbit-solar-overlay'])get(id);
  get('screen').tag='main';get('shelf-restore').hidden=true;
  const win=new Element('window');
  class Channel extends Element {constructor(name){super();this.name=name;channels.push(this);}postMessage(value){this.messages??=[];this.messages.push(structuredClone(value));options.channelSend?.(this,value);}close(){this.closed=true;}}
  class Viewer {constructor(){this.canvas={style:{}};this.items=[];this.primitives=[];this.clock={};this.scene={canvas:this.canvas,globe:{},primitives:{add:e=>(this.primitives.push(e),e),remove:e=>this.primitives.splice(this.primitives.indexOf(e),1)},requestRender(){},renderError:{addEventListener:()=>()=>{this.errorRemoved=true;}}};this.camera={flyTo:x=>{this.flight=x;},viewBoundingSphere(){},lookAtTransform(){}};this.entities={add:e=>(this.items.push(e),e),remove:e=>{const i=this.items.indexOf(e);if(i>=0)this.items.splice(i,1);},removeAll:()=>this.items.splice(0)};this.imageryLayers={addImageryProvider(){}};viewers.push(this);}destroy(){this.destroyCount=(this.destroyCount||0)+1;}}
  class PrimitiveCollection {constructor(){this.items=[];}add(v){this.items.push(v);return v;}remove(v){const i=this.items.indexOf(v);if(i<0)return false;this.items.splice(i,1);return true;}removeAll(){this.items.length=0;}}
  class Cartesian3 {constructor(x,y,z){Object.assign(this,{x,y,z});}static fromDegrees(lon,lat,h){return new Cartesian3(lon,lat,h);}}
  const Cesium={Viewer,Cartesian3,Color:{CYAN:'cyan',WHITE:'white',fromCssColorString:v=>v},JulianDate:{fromIso8601:v=>v},ReferenceFrame:{FIXED:'fixed'},ConstantPositionProperty:class{constructor(value){this.value=value;}},BoundingSphere:class{},HeadingPitchRange:class{},Matrix4:{IDENTITY:{}},EllipsoidTerrainProvider:class{},SingleTileImageryProvider:{fromUrl:()=>new Promise(()=>{})}};
  Cesium.ArcType={NONE:0};
  Cesium.SceneMode={SCENE2D:2,SCENE3D:3,MORPHING:0};
  Cesium.Viewer=class extends Viewer{constructor(...args){super(...args);const listeners=new Set();this.scene.mode=3;const nodeFrames=new Set();this.scene.preRender={addEventListener:fn=>{nodeFrames.add(fn);return()=>nodeFrames.delete(fn);},raise:()=>{for(const fn of [...nodeFrames])fn();}};this.scene.screenSpaceCameraController={};this.scene.morphComplete={addEventListener:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};const finish=mode=>{this.scene.mode=mode;for(const fn of [...listeners])fn();};this.scene.morphTo2D=()=>finish(2);this.scene.morphTo3D=()=>finish(3);this.scene.completeMorph=()=>finish(this.scene.mode);this.camera.cancelFlight=()=>{};this.imageryLayers={addImageryProvider:provider=>({provider}),remove(){}};}};
  Cesium.PointPrimitiveCollection=PrimitiveCollection;Cesium.LabelCollection=PrimitiveCollection;Cesium.NearFarScalar=class{};Cesium.Cartesian2=class{};Cesium.LabelStyle={FILL_AND_OUTLINE:1};Cesium.Color.TRANSPARENT='transparent';
  Cesium.Cartographic={fromCartesian:()=>({height:123456})};
  Cesium.ScreenSpaceEventType={LEFT_CLICK:1,MOUSE_MOVE:2};Cesium.ScreenSpaceEventHandler=class{constructor(){pickHandlers.push(this);}setInputAction(fn,type){if(type===1)this.click=fn;else this.move=fn;}destroy(){this.dead=true;}};
  const originalColor=Cesium.Color.fromCssColorString;Cesium.Color.fromCssColorString=v=>Object.assign(new String(originalColor(v)),{withAlpha:alpha=>({css:v,alpha})});
  const state={revision:4,input_id:'tle',input_hash:'hash',current_utc:'2020-07-12T21:16:01.000416000Z',ground_point:{latitude_deg:33.4996,longitude_deg:126.5312,ellipsoid_height_m:0,virtual:true,ellipsoid:'WGS84'},minimum_elevation_deg:10,playing:false,play_rate:1,leap_sha256:LEAP_SHA256,eop_sha256:'eop',frame:'ITRF',profile:'WGS72_AFSPC'};
  const snapshot={inputs:[{input_id:'tle',satellite_id:'25544',format:'TLE',epoch_utc:state.current_utc,raw_sha256:'hash'}],state,result:{client_request_id:'buffer',leap_sha256:LEAP_SHA256,revision:4,input_id:'tle',input_hash:'hash',frame:'ITRF',rows:[{utc:state.current_utc,status:'valid',position_m:[1,2,3],elevation_deg:10}]},status:'ready',error:'',receivedAtMs:0};
  const client={destroy:()=>{clientDestroyed++;},snapshot:()=>structuredClone(snapshot),load:()=>jobs.push(()=>context.render()),samples:async()=>{queries++;},setGround:async(point,angle)=>{commands++;if(options.setGround)await options.setGround(point,angle);Object.assign(state,{ground_point:structuredClone(point),minimum_elevation_deg:angle,playing:false,revision:state.revision+1});snapshot.result=null;context.render();},refresh:async()=>{}};
  const api={securityDashboard:options.securityDashboard??(async()=>{throw Error('security fixture unavailable');}),orbitVisibility:async p=>{queries++;return {...p,revision:p.selection_revision,query_start_utc:p.start_utc,query_end_utc:p.end_utc,input_hash:state.input_hash,eop_sha256:state.eop_sha256,leap_sha256:state.leap_sha256,frame:state.frame,profile:state.profile,communication_status:'unknown',status:'none',intervals:[],contacts:[],errors:[],stale:false};}};
  api.issReceiveProfile=options.rfProfileRequest??(async()=>{throw new Error('Profile transport not supplied by fixture');});
  api.satelliteModelManifest=options.satelliteModelManifest??(async()=>{throw new Error('Model manifest transport not supplied by fixture');});
  api.nodeSamples=options.nodeSamples??(async()=>{throw Error('Native node transport not supplied by fixture');});
  api.nodeTrack=options.nodeTrack??(async()=>{throw Error('Native node transport not supplied by fixture');});
  api.nodeMissionWindows=options.nodeMissionWindows??(async()=>{throw Error('Native mission-window transport not supplied by fixture');});
  api.bootstrap=options.planningBootstrap??(async()=>{throw Error("Planning transport not supplied");});
  for(const key of ['runtimeControl','runtimeSpeed','selectScenario','injectFault','missionAction','missionTask','validateMission','replanMission'])api[key]=options[key];
  api.route=options.planningRoute;api.contacts=options.planningContacts;
  api.catalogTrack=options.catalogTrack;api.catalogVisibility=options.catalogVisibility;api.catalogScene=options.catalogScene;api.catalogSamples=options.catalogSamples;api.catalogPosition=options.catalogPosition;api.satelliteGroups=options.satelliteGroups;api.satellites=options.satellites;api.satelliteProfile=options.satelliteProfile;
  api.report=options.report;for(const key of ['deviceAction','hilPreflight','hilSequence','recording'])api[key]=options[key];
  api.orbitRadio=options.radioRequest;
  api.orbitRadioSeries=options.seriesRequest;
  if(options.visibilityRequest)api.orbitVisibility=options.visibilityRequest;
  api.linkBudget=options.rfRequest??(async()=>{throw new Error('RF transport not supplied by fixture');});
  const schedule=set=>()=>{const id=++nextId;set.add(id);return id;};
  Object.assign(win,{Cesium,setTimeout:options.setTimeout??(()=>++nextId),clearTimeout:options.clearTimeout??(()=>{}),BroadcastChannel:Channel,opener:options.opener??null,open:options.open??(()=>null),close:()=>{win.closed=true;}});
  Object.assign(win,{innerWidth:width,innerHeight:height,crypto:options.crypto??{randomUUID:()=>String(++nextId)},localStorage:options.storage??null,confirm:()=>false,fetch:options.fetch??(async()=>({ok:true,json:async()=>({revision:0,run_id:'fixture',scope_id:'fixture:unconfigured',deployment_id:null,nodes:[]})}))});
  if(options.storageGetter)Object.defineProperty(win,'localStorage',{get:options.storageGetter});
  context=vm.createContext({document:doc,window:win,innerWidth:width,innerHeight:height,location:{hash:options.hash??'#ground',search:options.popout?'?popout=1':'',origin:'http://localhost',href:'http://localhost/#ground'},URL,URLSearchParams,structuredClone,performance:{now:()=>0},crypto:{randomUUID:()=>String(++nextId)},queueMicrotask:fn=>jobs.push(fn),api,drawMultiLine:(canvas,series)=>charts.push(structuredClone(series)),drawSparkline:(canvas,series)=>charts.push(structuredClone(series)),GROUND_STATIONS,stationGroups,createStationPanel,createCatalogTimePanel,createCatalogTimeline:(api,display,notify)=>createCatalogTimeline(api,display,notify,{now:options.catalogNow??(()=>0),requestFrame:options.catalogRequestFrame??schedule(frames),cancelFrame:options.catalogCancelFrame??(id=>frames.delete(id)),requestId:()=>String(++nextId)}),hilTopology,createHilPanel,createCatalogPanel,createCatalogGeometry,createKpiPanel,telemetrySocket:(message,status)=>{const stream={message,status,closed:0};streams.push(stream);return()=>stream.closed++;},createSimPanel,createMissionPanel,createRadioSeriesPanel,createGroundPanel,createRfPanel,createCommunicationPlanningPanel,createOrbitRadioPanel,createWorkspaceRevisionSync:c=>createWorkspaceRevisionSync(c,win),createOrbitSelection:()=>client,createWorkspaceGlobe:(container,status,button)=>createWorkspaceGlobe(container,status,button,win),createWorkspacePlayback:(c,show)=>createWorkspacePlayback(c,show,{now:()=>0,requestFrame:schedule(frames),cancelFrame:id=>frames.delete(id),setTimer:schedule(timers),clearTimer:id=>timers.delete(id)}),BroadcastChannel:Channel});
  Object.assign(context,{createWorkspaceSolar:args=>createWorkspaceSolar({...args,host:win,createDisplay:()=>({setStyle(){},clear(){},update(){},destroy(){}})}),createSatelliteHover,createSatelliteModelPanel,createSatelliteModelSelection,createModelResolver,validateSatelliteManifest,createGlobeViewPanel,createCatalogTrack,createCatalogPasses,createCatalogPassPanel,createCatalogScenePanel,createCatalogScene:(api,display,notify,host)=>createCatalogScene(api,display,notify,{...host,now:()=>0,setTimer:schedule(timers),clearTimer:id=>timers.delete(id),requestId:()=>String(++nextId)})});
  // Imported ground UI uses the same adapted document as the VM assembly.
  Object.assign(context,{createBrowserId,createWorkspaceNodes,createNodeLibrary,orbitElements,catalogElements,nodeOisl,NodeScene,createSatelliteNodePanelTools,createNodeClockControls,createUtcCodec,LEAP_SHA256});
  Object.assign(context,{projectWorkspaceContext,createAnalysisTransport,createAnalysisFollowCoordinator,createWorkspaceScenario,createSourceScenarioPanel,createScenarioAssembly,scenarioKpi,createSourceSettingsPanel,createSourceSecurityPanel,createSourceDataPanel,dataViewModel,createMissionServices,createSourceMissionPanel,createMissionTypes,createMissionConstraints,createOrchestrationClient,layoutTimeline,timelineMarkup,createGroundSegmentStore,createGroundNetworkPanel,createFuturePasses,networkDiagram,NativeNetworkScene,createFabricExchange,createDataFabricClient,sourceStationModel,createGroundLinkModel,createNetworkSnapshotModel});
  globalThis.document=doc;
  // Optional factory injection keeps the real root assembly testable with its
  // actual controller owners; existing fixtures retain their defaults.
  if(options.orbitSelectionFactory)context.createOrbitSelection=options.orbitSelectionFactory;
  if(options.futurePassesFactory)context.createFuturePasses=options.futurePassesFactory;
  if(options.simPanelFactory)context.createSimPanel=(...args)=>options.simPanelFactory(createSimPanel,...args);
  if(options.scenarioFactory)context.createWorkspaceScenario=args=>options.scenarioFactory(createWorkspaceScenario,args);
  if(options.nodeWorkspaceFactory)context.createWorkspaceNodes=args=>options.nodeWorkspaceFactory(createWorkspaceNodes,args);
  vm.runInContext(orbitSource,context,{filename:'workspace_orbit.js'});vm.runInContext(windowSource,context,{filename:'workspace.js'});flush();
  function flush(){while(jobs.length)jobs.shift()();}
  const resize=async(w,h)=>{context.innerWidth=w;context.innerHeight=h;await win.dispatch('resize');};
  return {get,win,doc,context,resize,viewers,channels,streams,charts,timers,frames,pickHandlers,pickCatalog(number){viewers[0].scene.pick=()=>({id:{catalogNumber:number}});pickHandlers[0].click({position:{}});},evaluate:source=>vm.runInContext(source,context),snapshot:()=>structuredClone(snapshot),counts:()=>({commands,queries,clientDestroyed}),flush,dispose(){delete globalThis.document;}};
}
