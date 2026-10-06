import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('solar UTC priority uses valid catalog then stored then scene and renderer disposal belongs to one globe',async()=>{
 let removed=0,destroyed=0,attached=0;globalThis.SolarGlobe=class{constructor(){this.viewer={scene:{renderError:{addEventListener:()=>()=>{}}}};}update(){return false;}setGroundPoint(){}setViewStyle(){}setViewImagery(){}setCatalogScene(){}destroy(){destroyed++;}};
 const code=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href)).replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.SolarGlobe;');
 const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 const host={Cesium:{},setTimeout:()=>1,clearTimeout(){},addEventListener(){},removeEventListener(){}};
 const ui=createWorkspaceGlobe({dataset:{}},{},{addEventListener(){},removeEventListener(){}},host),seen=[],remove=ui.observeDisplayContext(v=>seen.push(v));
 ui.bindSolarRenderer(()=>{attached++;return{destroy(){removed++;}};});
 const H='a'.repeat(64),L='b'.repeat(64),time='2020-07-12T21:16:01Z';
 ui.catalogScene({frame:'ITRF',scene_sha256:H,utc:time,leap_sha256:L,eop_sha256:H,count:1,valid_count:1,error_count:0,rows:[]},()=>{});assert.equal(seen.at(-1).key,'scene:'+H);
 const state={input_id:'ISS',input_hash:H,revision:1,current_utc:time};const row={utc:time,position_m:[1,2,3],status:'valid'};
 ui.update({status:'ready',state,result:{...state,frame:'ITRF',leap_sha256:L,rows:[row]}});assert.match(seen.at(-1).key,/^stored:/);assert.equal(seen.at(-1).eop_sha256,null);
 ui.catalog({...row,frame:'ITRF',catalog_number:25544,normalized_gp_sha256:H,leap_sha256:L,eop_sha256:H});assert.match(seen.at(-1).key,/^catalog:/);
 ui.catalog({...row,status:'unknown',frame:'ITRF',catalog_number:25544});assert.match(seen.at(-1).key,/^stored:/);
 ui.catalog({...row,frame:'TEME',catalog_number:25544});assert.match(seen.at(-1).key,/^stored:/);
 ui.update({status:'pending',state,result:null});assert.match(seen.at(-1).key,/^scene:/);ui.catalogScene(null);assert.equal(seen.at(-1),null);
 remove();ui.destroy();assert.equal(attached,1);assert.equal(removed,1);assert.equal(destroyed,1);delete globalThis.SolarGlobe;
});

test('shared globe gates UTC/revision/hash, clears during requests, and disposes exactly once',async()=>{
  const instances=[];globalThis.TestGlobe=class {
    constructor(){this.updates=[];this.viewer={scene:{renderError:{addEventListener:()=>()=>{}}}};instances.push(this);}
    update(value){this.updates.push(value);return Boolean(value);}
    setGroundPoint(value){this.ground=value;}
    setViewStyle(){}setViewImagery(){return Promise.resolve(true);}setViewMode(){return Promise.resolve(true);}
    focus(){}destroy(){this.destroyCount=(this.destroyCount||0)+1;}
  };
  const source=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href)).replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.TestGlobe;');
  const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const host={Cesium:{SingleTileImageryProvider:{fromUrl:()=>new Promise(()=>{})}},setTimeout:()=>1,clearTimeout(){},addEventListener(){},removeEventListener(){}};
  const container={dataset:{}},status={},button={addEventListener(){},removeEventListener(){}};
  const ui=createWorkspaceGlobe(container,status,button,host);
  const state={input_id:'tle',input_hash:'hash',revision:3,current_utc:'2020-07-12T21:16:01Z'};
  const result={...state,frame:'ITRF',rows:[{utc:state.current_utc,position_m:[1,2,3],status:'valid'}]};
  const snapshot={state,result,status:'ready'};
  try{
    ui.update(snapshot);assert.equal(button.disabled,false);assert.match(status.textContent,/표시 UTC 2020/);
    for(const change of [{status:'pending'},{status:'error'},{result:{...result,stale:true}},{result:{...result,revision:4}},{result:{...result,input_hash:'other'}},{result:{...result,input_id:'other'}},{state:{...state,current_utc:'2020-07-12T21:17:01Z'}}]){
      ui.update({...snapshot,...change});assert.equal(container.dataset.orbitVisible,'false');assert.equal(button.disabled,true);assert.equal(instances[0].updates.at(-1),null);
    }
    ui.update(snapshot);assert.equal(instances.length,1);ui.destroy();ui.destroy();assert.equal(instances[0].destroyCount,1);
  }finally{delete globalThis.TestGlobe;}
});
test('missing Cesium reports unavailable without a synthetic marker',async()=>{
  const source=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href)).replace(/import \{OrbitGlobe\} from [^;]+;/,'class OrbitGlobe {constructor(){throw new Error("must not construct");}}');
  const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  let load;
  const host={setTimeout:()=>1,clearTimeout(){},addEventListener:(name,fn)=>{load=fn;},removeEventListener(){}};
  const status={},container={dataset:{}},button={addEventListener(){},removeEventListener(){}};
  const ui=createWorkspaceGlobe(container,status,button,host);load();
  assert.match(status.textContent,/사용할 수 없습니다/);assert.equal(container.dataset.orbitVisible,'false');assert.equal(button.disabled,true);ui.destroy();
});

test('authoritative transition query follows mode phase without cloning view state',async()=>{
 let settle,reject;globalThis.TransitionQueryGlobe=class{constructor(){this.viewer={scene:{renderError:{addEventListener:()=>()=>{}}}};}update(){return false;}setGroundPoint(){}setViewStyle(){}setViewImagery(){}setViewMode(){return new Promise((a,b)=>{settle=a;reject=b;});}destroy(){}};
 const source=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href)).replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.TransitionQueryGlobe;');
 const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const host={Cesium:{},setTimeout:()=>1,clearTimeout(){},addEventListener(){},removeEventListener(){}},ui=createWorkspaceGlobe({dataset:{}},{},{addEventListener(){},removeEventListener(){}},host);
 try{
  assert.equal(typeof ui.isTransitioning,'function');
  const query=expected=>{const clone=globalThis.structuredClone;globalThis.structuredClone=()=>{throw Error('transition guard must not clone view state');};try{for(let i=0;i<100;i++)assert.equal(ui.isTransitioning(),expected);}finally{globalThis.structuredClone=clone;}assert.equal(ui.isTransitioning(),ui.viewState().mode.phase!=='ready');};
  query(false);const copied=ui.viewState();copied.mode.phase='pending';copied.choice.mode='2d';query(false);
  ui.changeView({mode:'2d'});query(true);settle(true);await Promise.resolve();query(false);
  ui.changeView({mode:'3d'});query(true);settle(false);await Promise.resolve();query(true);
  ui.changeView({mode:'2d'});reject(Error('morph failed'));await Promise.resolve();await Promise.resolve();query(true);
  ui.changeView({mode:'3d'});query(true);ui.destroy();query(true);settle(true);await Promise.resolve();query(true);
 }finally{ui.destroy();delete globalThis.TransitionQueryGlobe;}
});
