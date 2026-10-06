import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorkspacePlayback} from '../../../user_application/web/scripts/workspace_playback.js';
import {LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {createOrbitSelection} from '../../../user_application/web/scripts/orbit_selection.js';

const utc='2020-07-12T21:16:01Z';
function fixture(){
  let seq=0;const pending=[],notifications=[];
  let state={revision:0,input_id:null,ground_point:{latitude_deg:33.5,longitude_deg:126.5,ellipsoid_height_m:0},minimum_elevation_deg:10,play_rate:1,current_utc:utc};
  const api={orbitInputs:async()=>({inputs:[{input_id:'tle',raw_sha256:'hash',epoch_utc:utc}]}),orbitState:async()=>structuredClone(state),selectOrbit:async p=>(state={...p,revision:state.revision+1,input_hash:'hash',current_utc:p.anchor_utc}),orbitSamples:(body,{signal})=>new Promise((resolve,reject)=>pending.push({body,signal,resolve:()=>resolve({...body,revision:body.selection_revision,input_hash:'hash',stale:false,rows:[],status:'complete'}),reject}))};
  const client=createOrbitSelection(api,value=>notifications.push(value),()=>`request-${++seq}`);
  return {api,client,pending,notifications};
}
async function ready(){const f=fixture();await f.client.load();await f.client.select('tle');return f;}

test('two same-revision sample queries finish in reverse order; latest request alone remains',async()=>{
  const f=await ready();const first=f.client.samples(),second=f.client.samples();assert.equal(f.pending[0].signal.aborted,true);
  f.pending[1].resolve();await second;const latest=f.client.snapshot();f.pending[0].resolve();await first;
  assert.deepEqual(f.client.snapshot(),latest);assert.equal(latest.result.client_request_id,f.pending[1].body.client_request_id);
});
test('a late rejection from an aborted old query cannot clear a newer success',async()=>{
  const f=await ready();const first=f.client.samples(),second=f.client.samples();f.pending[1].resolve();await second;
  const latest=f.client.snapshot();f.pending[0].reject(new Error('old HTTP 503'));await first;assert.deepEqual(f.client.snapshot(),latest);
});
test('queue-full 503 remains an error with no old buffer and later manual query recovers',async()=>{
  const f=await ready();const failed=f.client.samples();f.pending[0].reject(Object.assign(new Error('queue full'),{status:503}));await failed;
  assert.equal(f.client.snapshot().status,'error');assert.equal(f.client.snapshot().result,null);assert.equal(f.pending.length,1);
  const retry=f.client.samples();f.pending[1].resolve();await retry;assert.equal(f.client.snapshot().status,'ready');assert.equal(f.client.snapshot().fetching,false);
});
test('active AbortError settles fetching rather than leaving playback permanently pending',async()=>{
  const f=await ready();const task=f.client.samples();f.pending[0].reject(Object.assign(new Error('aborted'),{name:'AbortError'}));await task;
  assert.equal(f.client.snapshot().fetching,false);assert.notEqual(f.client.snapshot().status,'pending');assert.equal(f.client.snapshot().result,null);
});
test('document disposal aborts requests and ignored-abort completion cannot notify or restore results',async()=>{
  const f=await ready();const task=f.client.samples();assert.equal(typeof f.client.destroy,'function');f.client.destroy();
  assert.equal(f.pending[0].signal.aborted,true);const disposed=f.client.snapshot(),count=f.notifications.length;f.pending[0].resolve();await task;assert.deepEqual(f.client.snapshot(),disposed);assert.equal(f.notifications.length,count);
});

let rendererFixtureId=0;
async function globeFixture(){
  let onError,destroyed=0,removed=0,throwFocus=false;
  const Renderer=class{constructor(){this.viewer={scene:{renderError:{addEventListener:fn=>{onError=fn;return()=>removed++;}}}};}update(value){return Boolean(value);}setViewStyle(){}setViewImagery(){return Promise.resolve(true);}setGroundPoint(){}focus(){if(throwFocus)throw new Error('context lost');}destroy(){destroyed++;}};
  const source=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href)).replace(/import \{OrbitGlobe\} from [^;]+;/,`const OrbitGlobe=globalThis.RequestTestRenderer;`);
  globalThis.RequestTestRenderer=Renderer;
  const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(source+`
// fixture ${++rendererFixtureId}`).toString('base64')}`);
  const listeners=new Map(),status={},container={dataset:{}},button={addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
  const host={Cesium:{SingleTileImageryProvider:{fromUrl:()=>new Promise(()=>{})}},setTimeout:()=>1,clearTimeout(){},addEventListener(){},removeEventListener(){}};
  const ui=createWorkspaceGlobe(container,status,button,host);delete globalThis.RequestTestRenderer;
  const state={input_id:'tle',input_hash:'hash',revision:1,current_utc:utc};
  const snapshot={state,status:'ready',result:{...state,frame:'ITRF',rows:[{utc,position_m:[1,2,3],elevation_deg:10,status:'valid'}]}};
  return {ui,snapshot,status,container,button,fail:()=>onError(),click:()=>listeners.get('click')(),breakFocus:()=>{throwFocus=true;},counts:()=>({destroyed,removed})};
}
test('renderer error clears marker once and later numeric snapshots do not resurrect it',async()=>{
  const f=await globeFixture();try{f.ui.update(f.snapshot);f.fail();f.ui.update(f.snapshot);assert.equal(f.container.dataset.orbitVisible,'false');assert.equal(f.button.disabled,true);assert.match(f.status.textContent,/사용할 수 없습니다/);f.ui.destroy();assert.deepEqual(f.counts(),{destroyed:1,removed:1});}finally{f.ui.destroy();}
});
test('focus resource failure is reported through the same unavailable UI rather than escaping',async()=>{
  const f=await globeFixture();try{f.ui.update(f.snapshot);f.breakFocus();assert.doesNotThrow(()=>f.click());assert.equal(f.button.disabled,true);assert.equal(f.container.dataset.orbitVisible,'false');assert.match(f.status.textContent,/사용할 수 없습니다/);}finally{f.ui.destroy();}
});


test('destroyed playback ignores late chunk completion and stale timer/frame callbacks',()=>{
  const requests=[],shown=[];let frame,timer,cleared=0,cancelled=0;
  const driver=createWorkspacePlayback({samples:p=>requests.push(p),refresh:()=>requests.push('refresh')},(...args)=>shown.push(args),{now:()=>0,requestFrame:fn=>(frame=fn,1),cancelFrame:()=>cancelled++,setTimer:fn=>(timer=fn,1),clearTimer:()=>cleared++});
  const snapshot={state:{current_utc:utc,playing:true,play_rate:60,revision:1,leap_sha256:LEAP_SHA256},result:null,status:'ready',fetching:false,receivedAtMs:0};
  driver.update(snapshot);assert.equal(requests.length,1);assert.equal(requests[0].count,601);
  driver.destroy();const count=shown.length;driver.update(snapshot);frame();timer();
  assert.equal(requests.length,1);assert.equal(shown.length,count);assert.equal(cleared,1);assert.equal(cancelled,1);
});

test('disposing an in-flight selection prevents queued commands and later snapshot adoption',async()=>{
  const f=await ready();let complete,calls=0;
  f.api.selectOrbit=p=>{calls++;return new Promise(resolve=>{complete=()=>resolve({...p,revision:2,input_hash:'hash',current_utc:utc});});};
  const first=f.client.select('tle');await Promise.resolve();const second=f.client.select('tle');f.client.destroy();const disposed=f.client.snapshot();complete();await Promise.all([first,second]);
  assert.equal(calls,1);assert.deepEqual(f.client.snapshot(),disposed);await f.client.samples();assert.equal(f.pending.length,0);
});
test('initial catalog/state completion after disposal cannot notify or adopt a snapshot',async()=>{
  const f=fixture();let resolve;f.api.orbitInputs=()=>new Promise(done=>{resolve=()=>done({inputs:[{input_id:'tle'}]});});
  const loading=f.client.load();f.client.destroy();const disposed=f.client.snapshot(),count=f.notifications.length;resolve();await loading;
  assert.deepEqual(f.client.snapshot(),disposed);assert.equal(f.notifications.length,count);
});
