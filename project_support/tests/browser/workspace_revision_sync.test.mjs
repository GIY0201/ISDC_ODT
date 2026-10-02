import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createOrbitSelection} from '../../../user_application/web/scripts/orbit_selection.js';
const path=new URL('../../../user_application/web/scripts/workspace_revision_sync.js',import.meta.url);

function channelHost(){const channels=[];return {channels,host:{BroadcastChannel:class{constructor(){this.handler=null;this.sent=[];channels.push(this);}addEventListener(_,fn){this.handler=fn;}removeEventListener(){this.handler=null;}postMessage(data){this.sent.push(data);}close(){this.closed=true;}},addEventListener(){},removeEventListener(){}}};}
async function module(){return import(path.href);}
test('revision notification re-reads server state instead of adopting channel payload',async()=>{
  const {createWorkspaceRevisionSync}=await module();const f=channelHost();let current={state:{revision:1},status:'ready',fetching:false},calls=0;
  const client={snapshot:()=>structuredClone(current),refresh:async options=>{assert.equal(options.force,true);calls++;current.state.revision=2;}};
  const sync=createWorkspaceRevisionSync(client,f.host);sync.observe(current);await f.channels[0].handler({data:{type:'revision',revision:2,state:{input_id:'forged'}}});await Promise.resolve();assert.equal(calls,1);assert.equal(current.state.input_id,undefined);sync.destroy();assert.equal(f.channels[0].closed,true);
});
test('busy client defers a revision hint until query settles, and destruction prevents future refresh',async()=>{
  const {createWorkspaceRevisionSync}=await module();const f=channelHost();let current={state:{revision:1},status:'pending',fetching:true},calls=0;
  const client={snapshot:()=>current,refresh:async()=>{calls++;current.state.revision=2;}};const sync=createWorkspaceRevisionSync(client,f.host);
  await f.channels[0].handler({data:{type:'revision',revision:2}});assert.equal(calls,0);current={state:{revision:1},status:'ready',fetching:false};sync.observe(current);await Promise.resolve();assert.equal(calls,1);sync.destroy();sync.observe({state:{revision:3},status:'ready'});assert.equal(calls,1);
});
test('two real clients conflict on one server revision without retry; dirty intent remains caller-owned',async()=>{
  let state={revision:0,input_id:null,current_utc:'2020-07-12T21:16:01Z',ground_point:{latitude_deg:33.5,longitude_deg:126.5,ellipsoid_height_m:0},minimum_elevation_deg:10,play_rate:1};let requests=0,reads=0;
  const api={orbitInputs:async()=>({inputs:[{input_id:'tle',raw_sha256:'hash',epoch_utc:state.current_utc}]}),orbitState:async()=>{reads++;return structuredClone(state);},selectOrbit:async p=>{requests++;if(p.expected_revision!==state.revision)throw Object.assign(new Error('revision conflict'),{status:409,state:structuredClone(state)});return state={...p,current_utc:p.anchor_utc,input_hash:'hash',revision:state.revision+1};}};
  const a=createOrbitSelection(api,()=>{},()=> 'a'),b=createOrbitSelection(api,()=>{},()=> 'b');await Promise.all([a.load(),b.load()]);await Promise.all([a.select('tle'),b.select('tle')]);assert.equal(requests,2);assert.equal(state.revision,1);assert.equal(b.snapshot().status,'error');assert.match(b.snapshot().error,/conflict/);assert.equal(b.snapshot().state.revision,1);assert.ok(reads>=3,'conflict performs a fresh snapshot query');a.destroy();b.destroy();
});
