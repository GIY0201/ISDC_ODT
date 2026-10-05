import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('shared globe gates UTC/revision/hash, clears during requests, and disposes exactly once',async()=>{
  const instances=[];globalThis.TestGlobe=class {
    constructor(){this.updates=[];this.viewer={scene:{renderError:{addEventListener:()=>()=>{}}}};instances.push(this);}
    update(value){this.updates.push(value);return Boolean(value);}
    setGroundPoint(value){this.ground=value;}
    setViewStyle(){}setViewImagery(){return Promise.resolve(true);}setViewMode(){return Promise.resolve(true);}
    focus(){}destroy(){this.destroyCount=(this.destroyCount||0)+1;}
  };
  const source=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.TestGlobe;');
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
  const source=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace(/import \{OrbitGlobe\} from [^;]+;/,'class OrbitGlobe {constructor(){throw new Error("must not construct");}}');
  const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  let load;
  const host={setTimeout:()=>1,clearTimeout(){},addEventListener:(name,fn)=>{load=fn;},removeEventListener(){}};
  const status={},container={dataset:{}},button={addEventListener(){},removeEventListener(){}};
  const ui=createWorkspaceGlobe(container,status,button,host);load();
  assert.match(status.textContent,/사용할 수 없습니다/);assert.equal(container.dataset.orbitVisible,'false');assert.equal(button.disabled,true);ui.destroy();
});
