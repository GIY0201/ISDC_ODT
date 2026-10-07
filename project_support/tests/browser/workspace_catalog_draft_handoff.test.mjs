import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogTimePanel} from '../../../user_application/web/scripts/tabs/catalog_time.js';
import {fixture} from './workspace_fixture.mjs';
import {LEAP_SHA256,createUtcCodec} from '../../../user_application/web/scripts/orbit_utc.js';
const utc='2020-07-12T21:16:01.000416000Z',H='a'.repeat(64),codec=createUtcCodec(LEAP_SHA256),quality={ut1:'final_b',polar_motion:'final_b'};
async function prepared(w=1280,h=720){
 const meta={name:'ISS',epoch_utc:utc,source:'celestrak-cache',normalized_gp_sha256:H,eop_sha256:H,leap_sha256:LEAP_SHA256,frame:'ITRF',profile:'WGS72_AFSPC',eop_kind:'IERS_A',eop_quality:quality};let sampleCalls=0;
 const f=fixture(w,h,{hash:'#satellite',satelliteGroups:async()=>({items:[{id:'active',label:'Active'}]}),satellites:async p=>({...p,source:'celestrak-cache',items:[{NORAD_CAT_ID:25544,OBJECT_NAME:'ISS',MEAN_MOTION:15}],count:1,total:1,filtered_total:1}),satelliteProfile:async()=>({source:'gp-cache',catalog:{NORAD_CAT_ID:25544}}),catalogPosition:async p=>({...meta,...p,utc,version:1,status:'valid',position_m:[7e6,1,2]}),catalogSamples:async p=>{sampleCalls++;return {...meta,...p,version:1,status:'valid',communication_status:'unknown',units:{position:'m',range:'m',elevation:'deg',azimuth:'deg',time:'UTC'},rows:Array.from({length:p.count},(_,i)=>({utc:codec.advance(p.start_utc,i),position_m:[7e6+i,1,2],elevation_deg:10,range_m:1000+i,azimuth_deg:90,visible:10>=p.minimum_elevation_deg,eop_quality:quality,status:'valid',error_code:null}))};}});
 const settle=async()=>{for(let i=0;i<16;i++)await Promise.resolve();f.flush();};
 await settle();await f.get('cat-sat-25544').dispatch('click');await settle();f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');f.get('station-select').value='DAEJEON';await f.get('station-select').dispatch('change');await f.get('station-catalog-use').dispatch('click');f.evaluate("location.hash='#satellite'");await f.win.dispatch('hashchange');await f.get('cat-time-calculate').dispatch('click');await settle();
 assert.equal(f.evaluate('!!catalogTimeline.snapshot().buffer'),true);assert.equal(f.evaluate('nodeClock.read(globe.displayContext()).running'),false);
 return {f,settle,sampleCalls:()=>sampleCalls,draft:()=>['station','height','angle','utc'].map(key=>({id:'cat-time-'+key,value:f.get('cat-time-'+key).value}))};
}
for(const [w,h] of [[1280,720],[1920,1080]])test(`same catalog draft survives real satellite to ground navigation ${w}x${h}`,async()=>{
 const {f,settle,sampleCalls}=await prepared(w,h);try{const calls=sampleCalls(),before=f.evaluate('globe.displayContext().utc');f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');await settle();assert.equal(f.evaluate('globe.displayContext().utc'),before);assert.equal(f.evaluate('!!catalogTimeline.snapshot().buffer'),true);assert.equal(f.evaluate('nodeClock.read(globe.displayContext()).running'),false);assert.equal(sampleCalls(),calls);assert.equal(f.counts().commands,0);assert.equal(f.viewers.length,1);}finally{f.dispose();}
});
test('same remote catalog strings preserve accepted buffer without another calculation',async()=>{
 const {f,draft,sampleCalls}=await prepared();try{const calls=sampleCalls();f.context.handoff=draft();f.evaluate('applyWorkspaceDraft(handoff,true)');assert.equal(f.evaluate('!!catalogTimeline.snapshot().buffer'),true);assert.equal(f.evaluate('nodeClock.read(globe.displayContext()).running'),false);assert.equal(sampleCalls(),calls);}finally{f.dispose();}
});
test('changed remote catalog field still revokes buffer and requires explicit calculation',async()=>{
 const {f,draft,sampleCalls}=await prepared();try{const calls=sampleCalls();f.context.handoff=draft().map(item=>item.id==='cat-time-height'?{...item,value:'123.45'}:item);f.evaluate('applyWorkspaceDraft(handoff,true)');assert.equal(f.evaluate('!!catalogTimeline.snapshot().buffer'),false);assert.equal(f.evaluate('nodeClock.read(globe.displayContext()).running'),undefined);assert.equal(sampleCalls(),calls);assert.match(f.get('cat-time-status').textContent,/적용 전/);assert.equal(f.counts().commands,0);}finally{f.dispose();}
});

for(const [pending,buffer] of [[false,null],[true,null],[true,{status:'valid'}]])test(`same handoff leaves existing pending=${pending}, buffer=${!!buffer} and follow untouched`,()=>{
 let invalidations=0,detaches=0;const state={pending,buffer};const panel=createCatalogTimePanel({invalidate(){invalidations++;state.pending=false;state.buffer=null;}},{},{follow:{locked:()=>true,source:()=>({running:true}),invalidate(){detaches++;}}});
 panel.applyDraft([{id:'cat-time-station',value:''},{id:'cat-time-height',value:'0'},{id:'cat-time-angle',value:'5'},{id:'cat-time-utc',value:''}]);
 assert.equal(invalidations,0);assert.equal(detaches,0);assert.equal(state.pending,pending);assert.equal(state.buffer,buffer);panel.destroy();
});
test('unsupported and non-string handoff fields have no control effects',()=>{
 let invalidations=0,detaches=0;const panel=createCatalogTimePanel({invalidate(){invalidations++;}},{},{follow:{locked:()=>true,invalidate(){detaches++;}}});panel.applyDraft([{id:'cat-time-height',value:0},{id:'cat-time-rate',value:'10'},{id:'unrelated',value:'changed'}]);assert.equal(invalidations,0);assert.equal(detaches,0);panel.destroy();
});
test('different numeric spelling remains a real draft change and detaches follow',()=>{
 let invalidations=0,detaches=0;const panel=createCatalogTimePanel({invalidate(){invalidations++;}},{},{follow:{locked:()=>true,invalidate(){detaches++;}}});panel.applyDraft([{id:'cat-time-height',value:'0.0'}]);assert.equal(invalidations,1);assert.equal(detaches,1);panel.applyDraft([{id:'cat-time-height',value:'0.0'}]);assert.equal(invalidations,1);assert.equal(detaches,1);panel.destroy();
});
test('changed UTC spelling is not normalized into an identical handoff',async()=>{
 const {f,draft,sampleCalls}=await prepared();try{const calls=sampleCalls();f.context.handoff=draft().map(item=>item.id==='cat-time-utc'?{...item,value:item.value.replace('000Z','Z')}:item);f.evaluate('applyWorkspaceDraft(handoff,true)');assert.equal(f.evaluate('!!catalogTimeline.snapshot().buffer'),false);assert.equal(sampleCalls(),calls);}finally{f.dispose();}
});
