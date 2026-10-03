import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createWorkspaceRevisionSync} from '../../../user_application/web/scripts/workspace_revision_sync.js';
import {createGroundPanel} from '../../../user_application/web/scripts/tabs/ground_visibility.js';
import {createRfPanel} from '../../../user_application/web/scripts/tabs/rf_link_budget.js';
import {createWorkspacePlayback} from '../../../user_application/web/scripts/workspace_playback.js';
import {LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';

// Execute the real window handlers and orbit assembly. Only DOM layout, HTTP,
// Cesium and scheduling are adapters; expected bounds are acceptance criteria.
const web=new URL('../../../user_application/web/scripts/',import.meta.url);
const windowSource=(await readFile(new URL('workspace.js',web),'utf8')).replace(/^import .*;\r?\n/,'');
const orbitSource=(await readFile(new URL('workspace_orbit.js',web),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/export function /g,'function ');
const globeSource=(await readFile(new URL('workspace_globe.js',web),'utf8')).replace("'/static/visualization/orbit_globe.js?v=t028-r1'",JSON.stringify(new URL('../../../digital_twin/visualization/orbit_globe.js',import.meta.url).href));
const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(globeSource).toString('base64')}`);

export function fixture(width=1280,height=720,options={}){
  const elements=new Map(),jobs=[],timers=new Set(),frames=new Set(),viewers=[],channels=[];
  let context,active=null,nextId=0,commands=0,queries=0,clientDestroyed=0;
  class Element {
    constructor(id='',tag='div'){this.id=id;this.tag=tag;this.style={};this.dataset={};this.attributes={};this.listeners=new Map();this.children=[];this.hidden=false;this.isConnected=true;this._value='';this._html='';this.textContent='';this.scrollTop=0;this.capture=null;const classes=new Set();this.classList={contains:v=>classes.has(v),add:v=>classes.add(v),remove:v=>classes.delete(v)};}
    set value(value){this._value=String(value??'');}get value(){return this._value;}
    set innerHTML(value){for(const child of this.descendants()){child.isConnected=false;if(elements.get(child.id)===child)elements.delete(child.id);}this.children=[];this._html=value;for(const match of value.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const child=new Element(match[3],match[1]);child.value=match[2].match(/\bvalue="([^"]*)"/)?.[1]||'';this.prepend(child);}}
    get innerHTML(){return this._html;}
    *descendants(){for(const child of this.children){yield child;yield* child.descendants();}}
    prepend(child){child.parent=this;child.isConnected=true;this.children.unshift(child);if(child.id)elements.set(child.id,child);}
    querySelector(selector){if(selector.startsWith('#'))return elements.get(selector.slice(1))||null;return [...this.descendants()].find(el=>el.tag===selector)||null;}
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
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id,id.includes('button')||id.startsWith('window-')&&id!=='window-titlebar'?'button':'div'));return elements.get(id);};
  const doc=new Element('document');doc.getElementById=id=>elements.get(id)||null;doc.createElement=tag=>new Element('',tag);doc.body=new Element('body');Object.defineProperty(doc,'activeElement',{get:()=>active});doc.querySelector=()=>null;doc.querySelectorAll=()=>[];
  for(const id of [...windowSource.matchAll(/getElementById\('([^']+)'\)/g)].map(match=>match[1]))get(id);
  for(const id of ['stored-orbit-globe','orbit-globe-status','orbit-globe-focus'])get(id);
  get('screen').tag='main';get('shelf-restore').hidden=true;
  const win=new Element('window');
  class Channel extends Element {constructor(name){super();this.name=name;channels.push(this);}postMessage(value){this.messages??=[];this.messages.push(structuredClone(value));options.channelSend?.(this,value);}close(){this.closed=true;}}
  class Viewer {constructor(){this.items=[];this.clock={};this.scene={globe:{},requestRender(){},renderError:{addEventListener:()=>()=>{this.errorRemoved=true;}}};this.camera={viewBoundingSphere(){},lookAtTransform(){}};this.entities={add:e=>(this.items.push(e),e),remove:e=>{const i=this.items.indexOf(e);if(i>=0)this.items.splice(i,1);},removeAll:()=>this.items.splice(0)};this.imageryLayers={addImageryProvider(){}};viewers.push(this);}destroy(){this.destroyCount=(this.destroyCount||0)+1;}}
  class Cartesian3 {constructor(x,y,z){Object.assign(this,{x,y,z});}static fromDegrees(lon,lat,h){return new Cartesian3(lon,lat,h);}}
  const Cesium={Viewer,Cartesian3,Color:{CYAN:'cyan',WHITE:'white',fromCssColorString:v=>v},JulianDate:{fromIso8601:v=>v},ReferenceFrame:{FIXED:'fixed'},ConstantPositionProperty:class{constructor(value){this.value=value;}},BoundingSphere:class{},HeadingPitchRange:class{},Matrix4:{IDENTITY:{}},EllipsoidTerrainProvider:class{},SingleTileImageryProvider:{fromUrl:()=>new Promise(()=>{})}};
  const state={revision:4,input_id:'tle',input_hash:'hash',current_utc:'2020-07-12T21:16:01.000416000Z',ground_point:{latitude_deg:33.4996,longitude_deg:126.5312,ellipsoid_height_m:0,virtual:true,ellipsoid:'WGS84'},minimum_elevation_deg:10,playing:false,play_rate:1,leap_sha256:LEAP_SHA256,eop_sha256:'eop',frame:'ITRF',profile:'WGS72_AFSPC'};
  const snapshot={inputs:[{input_id:'tle',satellite_id:'25544',format:'TLE',epoch_utc:state.current_utc,raw_sha256:'hash'}],state,result:{client_request_id:'buffer',revision:4,input_id:'tle',input_hash:'hash',frame:'ITRF',rows:[{utc:state.current_utc,status:'valid',position_m:[1,2,3],elevation_deg:10}]},status:'ready',error:'',receivedAtMs:0};
  const client={destroy:()=>{clientDestroyed++;},snapshot:()=>structuredClone(snapshot),load:()=>jobs.push(()=>context.render()),samples:async()=>{queries++;},setGround:async()=>{commands++;},refresh:async()=>{}};
  const api={orbitVisibility:async p=>{queries++;return {...p,revision:p.selection_revision,query_start_utc:p.start_utc,query_end_utc:p.end_utc,input_hash:state.input_hash,eop_sha256:state.eop_sha256,leap_sha256:state.leap_sha256,frame:state.frame,profile:state.profile,communication_status:'unknown',status:'none',intervals:[],contacts:[],errors:[],stale:false};}};
  api.issReceiveProfile=options.rfProfileRequest??(async()=>{throw new Error('Profile transport not supplied by fixture');});
  api.linkBudget=options.rfRequest??(async()=>{throw new Error('RF transport not supplied by fixture');});
  const schedule=set=>()=>{const id=++nextId;set.add(id);return id;};
  Object.assign(win,{Cesium,setTimeout:()=>++nextId,clearTimeout(){},BroadcastChannel:Channel,opener:options.opener??null,open:options.open??(()=>null),close:()=>{win.closed=true;}});
  context=vm.createContext({document:doc,window:win,innerWidth:width,innerHeight:height,location:{hash:options.hash??'#ground',search:options.popout?'?popout=1':'',origin:'http://localhost',href:'http://localhost/#ground'},URL,URLSearchParams,structuredClone,performance:{now:()=>0},crypto:{randomUUID:()=>String(++nextId)},queueMicrotask:fn=>jobs.push(fn),api,createGroundPanel,createRfPanel,createWorkspaceRevisionSync:c=>createWorkspaceRevisionSync(c,win),createOrbitSelection:()=>client,createWorkspaceGlobe:(container,status,button)=>createWorkspaceGlobe(container,status,button,win),createWorkspacePlayback:(c,show)=>createWorkspacePlayback(c,show,{now:()=>0,requestFrame:schedule(frames),cancelFrame:id=>frames.delete(id),setTimer:schedule(timers),clearTimer:id=>timers.delete(id)}),BroadcastChannel:Channel});
  // Imported ground UI uses the same adapted document as the VM assembly.
  globalThis.document=doc;
  vm.runInContext(orbitSource,context,{filename:'workspace_orbit.js'});vm.runInContext(windowSource,context,{filename:'workspace.js'});flush();
  function flush(){while(jobs.length)jobs.shift()();}
  const resize=async(w,h)=>{context.innerWidth=w;context.innerHeight=h;await win.dispatch('resize');};
  return {get,win,doc,context,resize,viewers,channels,timers,frames,snapshot:()=>structuredClone(snapshot),counts:()=>({commands,queries,clientDestroyed}),flush,dispose(){delete globalThis.document;}};
}
