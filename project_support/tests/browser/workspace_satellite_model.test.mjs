import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let sequence=0;
async function fixture(){
 const renderers=[],listeners=new Map(),calls=[];
 globalThis.ModelRenderer=class{
  constructor(){this.modelLayer={tracking:false};this.viewer={scene:{renderError:{addEventListener:()=>()=>{}}}};renderers.push(this);}
  setSatelliteModel(description,source){calls.push(['show',description,source]);this.source=source;source.onStatus({phase:description.url?'loading':'unassigned',satelliteId:description.satelliteId});return Promise.resolve(null);}
  focusSatelliteModel(options){calls.push(['focus',options]);this.modelLayer.tracking=true;return true;}
  releaseSatelliteModel(){calls.push(['release']);this.modelLayer.tracking=false;}
  retrySatelliteModel(){calls.push(['retry']);return Promise.resolve(null);}
  clearSatelliteModel(){calls.push(['clear']);this.modelLayer.tracking=false;}
  setViewMode(){return Promise.resolve(true);}setViewStyle(){}setViewImagery(){return Promise.resolve(true);}update(){return false;}setGroundPoint(){}destroy(){calls.push(['destroy']);}
 };
 const code=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.ModelRenderer;');
 const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(code+'\n//'+sequence++).toString('base64')}`);
 const container={dataset:{}},status={},button={addEventListener(){},removeEventListener(){}};
 const host={setTimeout:()=>1,clearTimeout(){},addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)};
 const ui=createWorkspaceGlobe(container,status,button,host);delete globalThis.ModelRenderer;
 return{ui,calls,renderers,boot(){host.Cesium={};listeners.get('load')();}};
}
const description=(id=25544,hash='a'.repeat(64))=>({satelliteId:id,normalized_gp_sha256:hash,url:'/static/satellite_display/iss.glb',key:'iss',quality:'exact',orientation:{heading:0}});
const source=()=>({timeSource:()=> '2026-10-05T00:00:00.000000000Z',advanceUtc:()=>null,sampleAt:()=>null});

test('preboot current model only, copied description/status and explicit camera actions share existing renderer',async()=>{
 const f=await fixture(),events=[],remove=f.ui.observeModel(v=>events.push(v)),a=description(),b=description(123);
 f.ui.setSatelliteModel(a,source());a.orientation.heading=90;f.ui.setSatelliteModel(b,source());f.boot();await Promise.resolve();assert.equal(f.renderers.length,1);
 const shown=f.calls.filter(c=>c[0]==='show');assert.equal(shown.length,1);assert.equal(shown[0][1].satelliteId,123);assert.equal(f.ui.modelState().status.phase,'loading');assert.equal(f.ui.modelState().match.orientation.heading,0);
 const snap=f.ui.modelState();snap.match.orientation.heading=90;assert.equal(f.ui.modelState().match.orientation.heading,0);
 f.renderers[0].source.onStatus({phase:'ready',satelliteId:123});assert.equal(f.ui.modelState().status.phase,'ready');
 assert.equal(f.ui.focusSatelliteModel({keepRange:true}),true);assert.equal(f.ui.modelState().tracking,true);f.ui.releaseSatelliteModel();assert.equal(f.ui.modelState().tracking,false);await f.ui.retrySatelliteModel();
 assert.deepEqual(f.calls.filter(c=>['focus','release','retry'].includes(c[0])),[['focus',{keepRange:true}],['release'],['retry']]);
 remove();const count=events.length;f.ui.clearSatelliteModel();assert.equal(events.length,count);assert.equal(f.ui.modelState().selected,null);f.ui.destroy();
});

test('late status after new GP, clear or destroy cannot replace selection; model failure does not destroy globe',async()=>{
 const f=await fixture();f.boot();f.ui.setSatelliteModel(description(),source());const old=f.renderers[0].source;
 f.ui.setSatelliteModel(description(25544,'b'.repeat(64)),source());old.onStatus({phase:'ready',satelliteId:25544});assert.equal(f.ui.modelState().status.phase,'loading');
 const current=f.renderers[0].source;current.onStatus({phase:'error',satelliteId:25544,errorKind:'render',error:'GPU'});assert.equal(f.ui.modelState().status.errorKind,'render');assert.equal(f.ui.viewState().available,true);assert.equal(f.calls.filter(c=>c[0]==='destroy').length,0);
 f.ui.clearSatelliteModel();current.onStatus({phase:'ready',satelliteId:25544});assert.equal(f.ui.modelState().selected,null);
 f.ui.destroy();const before=f.ui.modelState();current.onStatus({phase:'error'});assert.deepEqual(f.ui.modelState(),before);assert.equal(f.ui.focusSatelliteModel(),false);assert.equal(f.calls.filter(c=>c[0]==='destroy').length,1);
});
