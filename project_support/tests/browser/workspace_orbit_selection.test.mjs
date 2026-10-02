import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('empty UI choice restores server selection without clearing its result or sending a command',async()=>{
  const calls=[];
  const selection={value:'stored-tle',listeners:{},addEventListener(type,listener){this.listeners[type]=listener;}};
  const calculation={addEventListener(){}};
  const panel={innerHTML:'',querySelector(selector){return selector==='#orbit-input'?selection:calculation;}};
  const data={inputs:[{input_id:'stored-tle',satellite_id:'25544',format:'TLE',epoch_utc:'2020-07-12T21:16:01Z',raw_sha256:'hash'}],state:{input_id:'stored-tle',current_utc:'2020-07-12T21:16:01Z'},result:{revision:3,status:'complete',rows:[{utc:'2020-07-12T21:16:01Z',position_m:[1,2,3],elevation_deg:10,status:'valid'}]},status:'ready',error:''};
  globalThis.document={getElementById(id){return id==='stored-orbit'?panel:{};}};
  globalThis.testOrbitClient={snapshot:()=>data,select:value=>calls.push(value),samples(){},load(){}};
  globalThis.window={addEventListener(){}};
  const source=(await readFile(new URL('../../../user_application/web/scripts/workspace_orbit.js',import.meta.url),'utf8'))
    .replace(/import \{createWorkspaceRevisionSync\} from [^;]+;/,'const createWorkspaceRevisionSync=()=>({observe(){},destroy(){}});')
    .replace(/import \{createGroundPanel\} from [^;]+;/,'const createGroundPanel=()=>({show(){},update(){},destroy(){}});')
    .replace(/import \{api\} from [^;]+;/,'const api={};')
    .replace(/import \{createOrbitSelection\} from [^;]+;/,'const createOrbitSelection=()=>globalThis.testOrbitClient;')
    .replace(/import \{createWorkspacePlayback\} from [^;]+;/,'const createWorkspacePlayback=()=>({update(){},destroy(){}});')
    .replace(/import \{createWorkspaceGlobe\} from [^;]+;/,'const createWorkspaceGlobe=()=>({update(){},destroy(){}});');
  try {
    const ui=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    ui.showWorkspaceOrbit('satellite');
    const rendered=panel.innerHTML;
    selection.value='';
    selection.listeners.change({target:selection});
    assert.equal(selection.value,'stored-tle');
    assert.deepEqual(calls,[]);
    assert.equal(panel.innerHTML,rendered);
    selection.value='another-input';
    selection.listeners.change({target:selection});
    assert.deepEqual(calls,['another-input']);
  } finally {delete globalThis.document;delete globalThis.testOrbitClient;delete globalThis.window;}
});
