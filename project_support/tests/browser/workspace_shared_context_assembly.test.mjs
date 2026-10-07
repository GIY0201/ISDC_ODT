import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {LEAP_SHA256,createUtcCodec} from '../../../user_application/web/scripts/orbit_utc.js';
const utc='2020-07-12T21:16:01.000416000Z',H='a'.repeat(64),codec=createUtcCodec(LEAP_SHA256),quality={ut1:'final_b',polar_motion:'final_b'};
const meta={name:'ISS',epoch_utc:utc,source:'celestrak-cache',normalized_gp_sha256:H,eop_sha256:H,leap_sha256:LEAP_SHA256,frame:'ITRF',profile:'WGS72_AFSPC',eop_kind:'IERS_A',eop_quality:quality};
const gp={NORAD_CAT_ID:25544,OBJECT_NAME:'ISS',MEAN_MOTION:15,RA_OF_ASC_NODE:0,EPOCH:utc};
const settle=async f=>{for(let i=0;i<16;i++)await Promise.resolve();f.flush();};
function setup(width,height){let positions=0;const f=fixture(width,height,{hash:'#satellite',satelliteGroups:async()=>({items:[{id:'active',label:'Active'}]}),satellites:async p=>({...p,source:'celestrak-cache',items:[gp],count:1,total:1,filtered_total:1}),satelliteProfile:async()=>({source:'gp-cache',catalog:{NORAD_CAT_ID:25544},gp}),catalogPosition:async p=>{positions++;return {...meta,...p,utc,version:1,status:'valid',position_m:[7e6,1,2]};},catalogSamples:async p=>({...meta,...p,version:1,status:'valid',communication_status:'unknown',units:{position:'m',range:'m',elevation:'deg',azimuth:'deg',time:'UTC'},rows:Array.from({length:p.count},(_,i)=>({utc:codec.advance(p.start_utc,i),position_m:[7e6+i,1,2],elevation_deg:10,range_m:1000000+i,azimuth_deg:null,visible:10>=p.minimum_elevation_deg,eop_quality:quality,status:'valid',error_code:null}))})});
 // The DOM adapter constructs script literals; register existing index.html
 // header IDs used by the dynamic map as real DOM nodes, not product stubs.
 for(const id of ['desktop-sat-status','clock','desktop-event','desktop-data-utc','desktop-handoff','desktop-handoff-state','desktop-scene-credit'])f.get(id);
 return {f,get positions(){return positions;}};
}
for(const [width,height]of [[1280,720],[1920,1080]])test(`real native GP context survives satellite-ground-run V6 renders ${width}x${height}`,async()=>{
 const s=setup(width,height),f=s.f;
 try{await settle(f);const before=f.snapshot();await f.get('cat-sat-25544').dispatch('click');await settle(f);
  for(const view of ['satellite','ground','run','satellite']){f.evaluate(`openWorkspaceView('${view}')`);await settle(f);
   assert.equal(f.get('desktop-sat-name').textContent,'ISS · GP 위성');assert.equal(f.get('context-id').textContent,'25544');assert.match(f.get('context-rel').textContent,/GP 위성.*celestrak-cache/);assert.match(f.get('desktop-sat-status').textContent,/native_analysis.*실제 원격측정·RF 미확인/);assert.doesNotMatch(f.get('desktop-event').textContent,/E-014/);assert.equal(f.get('desktop-event').textContent,'실제 경보 미연동');assert.equal(f.get('desktop-data-utc').textContent,utc);assert.equal(f.get('clock').textContent,utc);assert.doesNotMatch(f.get('desktop-handoff').textContent,/GS-02|03:24/);assert.match(f.get('desktop-scene-credit').textContent,/ISS · GP 위성/);assert.ok(f.get('desktop-scene-credit').textContent.includes(utc));assert.match(f.get('desktop-handoff-state').textContent,/RF 미확인/);assert.match(f.get('alert-text').textContent,/실제 RF·수신.*미확인/);
  }
  assert.equal(s.positions,1);assert.equal(f.viewers.length,1);assert.equal(f.counts().commands,0);assert.deepEqual(f.snapshot(),before);
 }finally{f.dispose();}
});
test('native GP clear removes selected context synchronously and late native response cannot republish it',async()=>{
 const s=setup(1280,720),f=s.f;
 try{await settle(f);await f.get('cat-sat-25544').dispatch('click');await settle(f);assert.equal(f.get('desktop-sat-name').textContent,'ISS · GP 위성');
  let finish;f.context.api.catalogPosition=p=>new Promise(resolve=>{finish=()=>resolve({...meta,...p,utc,version:1,status:'valid',position_m:[7e6,1,2]});});
  await f.get('cat-sat-25544').dispatch('click');await settle(f);assert.ok(finish);await f.get('cat-position-clear').dispatch('click');const cleared=f.get('desktop-sat-name').textContent;assert.doesNotMatch(cleared,/GP 위성/);assert.notEqual(f.get('context-id').textContent,'25544');finish();await settle(f);assert.equal(f.get('desktop-sat-name').textContent,cleared);assert.equal(f.viewers.length,1);assert.equal(f.counts().commands,0);
 }finally{f.dispose();}
});
test('shared visible UTC header follows exact native GP UTC instead of retained fixed example',async()=>{
 const {f}=setup(1280,720);
 try{f.get('clock').textContent='2026-09-23 03:18 UTC';await settle(f);await f.get('cat-sat-25544').dispatch('click');await settle(f);assert.equal(f.get('clock').textContent,utc);assert.equal(f.evaluate('readWorkspaceContext().utc.value'),utc);assert.equal(f.counts().commands,0);}
 finally{f.dispose();}
});
