import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrbitSelection} from '../../../user_application/web/scripts/orbit_selection.js';
const state={revision:0,input_id:null,ground_point:{latitude_deg:33.5,longitude_deg:126.5,ellipsoid_height_m:0},minimum_elevation_deg:10,play_rate:1};
const input={input_id:'tle',raw_sha256:'hash',epoch_utc:'2020-07-12T21:16:01Z'};
function fixture(overrides={}){let revision=0;return {orbitInputs:async()=>({inputs:[input]}),orbitState:async()=>state,selectOrbit:async p=>({...state,...p,revision:++revision,input_hash:'hash',current_utc:p.anchor_utc}),orbitSamples:async p=>({...p,revision:p.selection_revision,input_hash:'hash',stale:false,rows:[],status:'complete'}),...overrides};}
test('control observer covers queued stored commands through adoption and final notification',async()=>{
 let depth=0,releases=0;const depths=[],api=fixture(),original=api.selectOrbit;
 api.selectOrbit=async p=>{assert.ok(depth>0);return original(p);};
 const client=createOrbitSelection(api,s=>{if(s.status==='pending'||s.state?.input_id)depths.push(depth);},()=> 'id',()=>0,()=>{depth++;return()=>{depth--;releases++;};});
 await client.load();await Promise.all([client.select('tle'),client.select('tle')]);
 assert.equal(releases,2);assert.equal(depth,0);assert.ok(depths.every(n=>n>0));assert.equal(client.snapshot().state.revision,2);
});
test('control observer cleanup covers sync command failure and disposal without another API call',async()=>{
 let depth=0,releases=0,calls=0;const client=createOrbitSelection(fixture({selectOrbit:()=>{calls++;throw Error('offline');}}),()=>{},()=> 'id',()=>0,()=>{depth++;return()=>{depth--;releases++;};});
 await client.load();await client.select('tle');assert.match(client.snapshot().error,/offline/);assert.equal(releases,1);assert.equal(depth,0);client.destroy();await client.select('tle');assert.equal(calls,1);
});
test('stored control acquisition throw sends nothing; nested acquisition and pending disposal release once',async()=>{
 let calls=0,depth=0,releases=0,nested=false,client;const api=fixture({selectOrbit:async p=>{calls++;return{...state,...p,revision:calls,input_hash:'hash'};}});
 client=createOrbitSelection(api,()=>{},()=> 'id',()=>0,()=>{throw Error('capture failed');});await client.load();assert.throws(()=>client.select('tle'),/capture failed/);assert.equal(calls,0);client.destroy();
 client=createOrbitSelection(api,()=>{},()=> 'id',()=>0,()=>{depth++;if(!nested){nested=true;void client.select('tle');}return()=>{depth--;releases++;throw Error('cleanup failure');};});await client.load();await client.select('tle');assert.equal(calls,2);assert.equal(depth,0);assert.equal(releases,2);client.destroy();
 let finish;api.selectOrbit=p=>new Promise(resolve=>finish=()=>resolve({...state,...p,revision:3}));const pending= createOrbitSelection(api,()=>{},()=> 'id',()=>0,()=>{depth++;return()=>{depth--;releases++;};});await pending.load();const task=pending.select('tle');await Promise.resolve();pending.destroy();assert.equal(depth,0);const count=releases;finish();await task;assert.equal(releases,count);
});
test('selection commands are serialized against returned server revisions',async()=>{const revisions=[];let running=0;const api=fixture();const original=api.selectOrbit;api.selectOrbit=async p=>{assert.equal(running++,0);revisions.push(p.expected_revision);await new Promise(r=>setTimeout(r,2));running--;return original(p);};const client=createOrbitSelection(api,()=>{});await client.load();await Promise.all([client.select('tle'),client.select('tle')]);assert.deepEqual(revisions,[0,1]);assert.equal(client.snapshot().state.revision,2);});
test('late samples cannot overwrite a subsequent selection',async()=>{let release;const client=createOrbitSelection(fixture({orbitSamples:p=>new Promise(r=>{release=()=>r({...p,revision:p.selection_revision,input_hash:'hash',stale:false,rows:[]});})}),()=>{});await client.load();await client.select('tle');const pending=client.samples();await client.select('tle');release();await pending;assert.equal(client.snapshot().result,null);});
test('mismatched request id and hash are rejected as stale',async()=>{const client=createOrbitSelection(fixture({orbitSamples:async p=>({...p,client_request_id:'other',revision:p.selection_revision,input_hash:'wrong',rows:[]})}),()=>{});await client.load();await client.select('tle');await client.samples();assert.equal(client.snapshot().status,'stale');assert.equal(client.snapshot().result,null);});
test('conflict adopts server snapshot without retrying a command',async()=>{const client=createOrbitSelection(fixture({selectOrbit:async()=>{throw Object.assign(new Error('conflict'),{status:409,state:{...state,revision:7}});}}),()=>{});await client.load();await client.select('tle');assert.equal(client.snapshot().state.revision,7);assert.equal(client.snapshot().status,'error');});
test('matching result is displayed and snapshots cannot mutate client copies',async()=>{const client=createOrbitSelection(fixture(),()=>{});await client.load();await client.select('tle');await client.samples();const copy=client.snapshot();assert.equal(copy.result.status,'complete');copy.state.revision=999;assert.equal(client.snapshot().state.revision,1);});
test('unavailable calculation shows error instead of fabricated rows',async()=>{const client=createOrbitSelection(fixture({orbitSamples:async()=>{throw new Error('unavailable');}}),()=>{});await client.load();await client.select('tle');await client.samples();assert.equal(client.snapshot().status,'error');assert.equal(client.snapshot().result,null);});
test('missing stored inputs remains explicitly empty',async()=>{const client=createOrbitSelection(fixture({orbitInputs:async()=>({inputs:[]})}),()=>{});await client.load();assert.equal(client.snapshot().status,'empty');assert.equal(client.snapshot().result,null);});
test('play/pause take a fresh server UTC while seek returns to an explicit timestamp',async()=>{
  const commands=[];let current=state;
  const api=fixture({orbitState:async()=>({...current,current_utc:current.anchor_utc||'2020-07-12T21:16:01Z'})});
  const original=api.selectOrbit;api.selectOrbit=async p=>{commands.push(p);current=await original(p);return current;};
  const client=createOrbitSelection(api,()=>{});await client.load();await client.select('tle');
  await client.control('play');assert.equal(commands.at(-1).playing,true);
  await client.control('pause');assert.equal(commands.at(-1).playing,false);
  await client.seek(input.epoch_utc);assert.equal(commands.at(-1).anchor_utc,input.epoch_utc);
  assert.equal(commands.at(-1).playing,false);
});
test('background prefetch keeps the old buffer until a matching response and uses one-second rows',async()=>{
  let release;const api=fixture();const client=createOrbitSelection(api,()=>{});await client.load();await client.select('tle');await client.samples();
  const before=client.snapshot().result;
  api.orbitSamples=p=>new Promise(resolve=>{assert.equal(p.step_seconds,1);assert.equal(p.count,601);release=()=>resolve({...p,revision:p.selection_revision,input_hash:'hash',rows:[],status:'complete'});});
  const task=client.samples({background:true,count:601,stepSeconds:1});assert.deepEqual(client.snapshot().result,before);assert.equal(client.snapshot().fetching,true);release();await task;assert.equal(client.snapshot().fetching,false);
});
test('an old background response cannot restore a buffer after pause',async()=>{
  let current=state,release;
  const api=fixture({orbitState:async()=>({...current,current_utc:current.anchor_utc||input.epoch_utc})});
  const original=api.selectOrbit;api.selectOrbit=async p=>(current=await original(p));
  const client=createOrbitSelection(api,()=>{});await client.load();await client.select('tle');await client.control('play');
  api.orbitSamples=p=>new Promise(resolve=>{release=()=>resolve({...p,revision:p.selection_revision,input_hash:'hash',rows:[],status:'complete'});});
  const pending=client.samples({background:true,count:601,stepSeconds:1});await client.control('pause');release();await pending;
  assert.equal(client.snapshot().state.playing,false);assert.equal(client.snapshot().result,null);assert.equal(client.snapshot().fetching,false);
});
test('display rejects a different EOP/leap snapshot or coordinate/profile contract',async()=>{
  const provenance={eop_sha256:'eop',leap_sha256:'leap',frame:'ITRF',profile:'WGS72_AFSPC'};
  for(const key of Object.keys(provenance)){
    const api=fixture();const select=api.selectOrbit;
    api.selectOrbit=async p=>({...await select(p),...provenance});
    api.orbitSamples=async p=>({...p,...provenance,[key]:'other',revision:p.selection_revision,input_hash:'hash',stale:false,rows:[],status:'complete'});
    const client=createOrbitSelection(api,()=>{});await client.load();await client.select('tle');await client.samples();
    assert.equal(client.snapshot().status,'stale');assert.equal(client.snapshot().result,null);
  }
});

test('ground command uses fresh server UTC and updates height/angle with the same selection owner',async()=>{
 let current=state,body;const api=fixture({orbitState:async()=>({...current,current_utc:input.epoch_utc})});const original=api.selectOrbit;api.selectOrbit=async p=>{body=p;return current=await original(p);};
 const client=createOrbitSelection(api,()=>{});await client.load();await client.select('tle');const ground={latitude_deg:35,longitude_deg:127,ellipsoid_height_m:500};await client.setGround(ground,0);
 assert.deepEqual(body.ground_point,ground);assert.equal(body.minimum_elevation_deg,0);assert.equal(body.expected_revision,1);assert.equal(body.anchor_utc,input.epoch_utc);assert.equal(body.playing,false);
});
