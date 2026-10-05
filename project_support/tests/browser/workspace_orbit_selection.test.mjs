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
    .replace(/import \{GROUND_STATIONS,stationGroups\} from [^;]+;/,'const GROUND_STATIONS={},stationGroups=()=>[];')
    .replace(/import \{createStationPanel\} from [^;]+;/,'const createStationPanel=()=>({controller:{choose(){}},show(){},update(){},destroy(){}});')
    .replace(/import \{createGroundPanel\} from [^;]+;/,'const createGroundPanel=()=>({show(){},update(){},destroy(){}});')
    .replace(/import \{createCatalogTimePanel\} from [^;]+;/,'const createCatalogTimePanel=()=>({show(){},update(){},applyDraft(){},destroy(){}});')
    .replace(/import \{createCatalogTimeline\} from [^;]+;/,'const createCatalogTimeline=()=>({select(){},destroy(){}});')
    .replace(/import \{createCatalogScene\} from [^;]+;/,'const createCatalogScene=()=>({snapshot(){return {}},destroy(){}});')
    .replace(/import \{createCatalogScenePanel\} from [^;]+;/,'const createCatalogScenePanel=()=>({show(){},update(){},applyDraft(){},destroy(){}});')
    .replace(/import \{createCatalogGeometry\} from [^;]+;/,'const createCatalogGeometry=()=>({select(){},clear(){},snapshot(){return {}},destroy(){}});')
    .replace(/import \{createCatalogPanel\} from [^;]+;/,'const createCatalogPanel=()=>({show(){},update(){},applyDraft(){},destroy(){}});')
    .replace(/import \{createHilPanel\} from [^;]+;/,'const createHilPanel=()=>({show(){},update(){},receive(){},connection(){},applyDraft(){},destroy(){}});')
    .replace(/import \{hilTopology\} from [^;]+;/,'const hilTopology=()=>{};')
    .replace(/import \{createKpiPanel\} from [^;]+;/,'const createKpiPanel=()=>({show(){},update(){},receive(){},connection(){},applyDraft(){},destroy(){}});')
    .replace(/import \{drawMultiLine,drawSparkline\} from [^;]+;/,'const drawMultiLine=()=>{},drawSparkline=()=>{};')
    .replace(/import \{createSimPanel\} from [^;]+;/,'const createSimPanel=()=>({show(){},update(){},applyDraft(){},destroy(){}});')
    .replace(/import \{createMissionPanel\} from [^;]+;/,'const createMissionPanel=()=>({show(){},update(){},applyDraft(){},destroy(){}});')
    .replace(/import \{createRadioSeriesPanel\} from [^;]+;/,'const createRadioSeriesPanel=()=>({show(){},update(){},applyDraft(){},choose(){},clearInterval(){},destroy(){}});')
    .replace(/import \{createOrbitRadioPanel\} from [^;]+;/,'const createOrbitRadioPanel=()=>({show(){},update(){},applyDraft(){},destroy(){}});')
    .replace(/import \{createCommunicationPlanningPanel\} from [^;]+;/,'const createCommunicationPlanningPanel=()=>({show(){},update(){},applyDraft(){},destroy(){}});')
    .replace(/import \{createRfPanel\} from [^;]+;/,'const createRfPanel=()=>({show(){},update(){},destroy(){}});')
    .replace(/import \{api,telemetrySocket\} from [^;]+;/,'const api={},telemetrySocket=()=>()=>{};')
    .replace(/import \{createOrbitSelection\} from [^;]+;/,'const createOrbitSelection=()=>globalThis.testOrbitClient;')
    .replace(/import \{createWorkspacePlayback\} from [^;]+;/,'const createWorkspacePlayback=()=>({update(){},destroy(){}});')
    .replace(/import \{createWorkspaceGlobe\} from [^;]+;/,'const createWorkspaceGlobe=()=>({update(){},catalog(){},stations(){},selectStation(){},focusStation(){},destroy(){}});');
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
