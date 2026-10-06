import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogTimeline} from '../../../user_application/web/scripts/catalog_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256),H='a'.repeat(64),base={group:'active',catalog_number:25544,name:'ISS',utc:codec.advance('2020-07-12T21:16:01.000416Z',0),epoch_utc:codec.advance('2020-07-12T21:16:01.000416Z',0),normalized_gp_sha256:H,eop_sha256:H,leap_sha256:LEAP_SHA256,frame:'ITRF',profile:'WGS72_AFSPC',eop_kind:'IERS_A',eop_quality:{ut1:'final_b',polar_motion:'final_b'},source:'celestrak-cache',position_m:[7e6,1,2]};
const point={latitude_deg:36,longitude_deg:127,ellipsoid_height_m:0,virtual:true,ellipsoid:'WGS84'};
function response(p){return {...base,...p,version:1,status:'valid',communication_status:'unknown',units:{position:'m',range:'m',elevation:'deg',azimuth:'deg',time:'UTC'},rows:Array.from({length:p.count},(_,i)=>({utc:codec.advance(p.start_utc,i),status:'valid',error_code:null,position_m:[7e6+i,1,2],elevation_deg:10,range_m:1000+i,azimuth_deg:350,visible:true,eop_quality:base.eop_quality}))};}
function setup(action=p=>response(p)){
 let now=0,frame=null,reenter=null;const calls=[],shown=[],notifications=[];
 const timeline=createCatalogTimeline({catalogSamples:async p=>{calls.push(p);return action(p,calls);}},value=>{shown.push(value);reenter?.('display');},()=>{notifications.push(true);reenter?.('notify');},{now:()=>now,requestId:()=> 'continuity-test',requestFrame:fn=>(frame=fn,1),cancelFrame:()=>{frame=null;}});
 return {timeline,calls,shown,notifications,set reenter(fn){reenter=fn;},tick(ms){now=ms;const fn=frame;frame=null;fn?.();},async ready(){timeline.select(base);timeline.observer(point,5);await timeline.calculate();timeline.play();}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('real catalog capability preserves arbitrary natural progression and complete readonly authority',async()=>{
 const s=setup();try{const port=s.timeline.displayContinuity;assert.ok(Object.isFrozen(port));assert.equal(port.capture(),null);await s.ready();const lease=port.capture();assert.ok(lease);assert.ok(Object.isFrozen(lease.selected.position_m));assert.ok(Object.isFrozen(lease.observer));assert.deepEqual(lease.selected,base);assert.deepEqual(lease.observer,point);assert.equal(lease.minimumElevation,5);assert.equal(lease.rate,1);assert.equal(lease.key,`catalog:25544:${H}`);
  const before=s.calls.length,shown=s.shown.length,notifications=s.notifications.length;for(let i=0;i<10;i++){assert.equal(port.capture(),lease);assert.equal(port.isCurrent(lease),true);}assert.equal(s.calls.length,before);assert.equal(s.shown.length,shown);assert.equal(s.notifications.length,notifications);
  for(const ms of [13.125,37.999,500,1100.12345,25000]){s.tick(ms);assert.equal(port.capture(),lease);assert.equal(port.isCurrent(lease),true);}assert.equal(s.calls.length,before);
  assert.equal(port.isCurrent(structuredClone(lease)),false);assert.equal(port.isCurrent(Object.freeze({...lease})),false);assert.equal(port.isCurrent(null),false);
 }finally{s.timeline.destroy();}
});

test('all accepted controls revoke before reentrant callbacks and suppress capture throughout transaction',async()=>{
 for(const operation of ['pause','play','rate','seek','observer','select','calculate','invalidate','clear','destroy']){
  const s=setup();try{await s.ready();const port=s.timeline.displayContinuity,old=port.capture();let callbacks=0;
   if(operation==='play')s.timeline.pause();
   s.reenter=()=>{callbacks++;assert.equal(port.isCurrent(old),false,operation);assert.equal(port.capture(),null,`${operation} capture inside existing callback`);};
   if(operation==='pause')s.timeline.pause();else if(operation==='play')s.timeline.play();else if(operation==='rate')s.timeline.rate(10);else if(operation==='seek')s.timeline.seek(s.timeline.currentUtc());else if(operation==='observer')s.timeline.observer(point,5);else if(operation==='select')s.timeline.select(base);else if(operation==='calculate')await s.timeline.calculate();else s.timeline[operation]();
   assert.ok(callbacks>0,operation);assert.equal(port.isCurrent(old),false);s.reenter=null;
   if(operation==='rate'||operation==='play'){const next=port.capture();assert.ok(next);assert.notEqual(next,old);assert.equal(next.rate,operation==='rate'?10:1);}else assert.equal(port.capture(),null);
  }finally{s.reenter=null;s.timeline.destroy();}
 }
});

test('scoped continuity observer bridges notify-only commands without changing legacy notifications',async()=>{
 const s=setup();try{await s.ready();const port=s.timeline.displayContinuity,events=[];const remove=port.observe(event=>{events.push(event);assert.ok(Object.isFrozen(event));});const lease=port.capture(),shown=s.shown.length,notified=s.notifications.length;
  s.timeline.rate(10);assert.equal(port.isCurrent(lease),false);assert.ok(events.some(event=>event.phase==='invalidated'));assert.ok(events.some(event=>event.phase==='settled'));assert.equal(s.shown.length,shown+1,'existing pause final paint only');assert.equal(s.notifications.length,notified+2,'existing pause+rate notifications only');
  remove();const count=events.length;s.timeline.pause();assert.equal(events.length,count);
 }finally{s.timeline.destroy();}
});

test('accepted background buffers preserve lease while ignored late responses cannot resurrect a seek',async()=>{
 let finish;const s=setup((p,calls)=>calls.length===1?response(p):new Promise(resolve=>{finish=()=>resolve(response(p));}));
 try{await s.ready();s.timeline.rate(60);const port=s.timeline.displayContinuity,lease=port.capture();s.tick(5000);assert.equal(s.calls.length,2);assert.equal(port.isCurrent(lease),true);s.tick(5500);assert.equal(port.capture(),lease);finish();await settle();assert.equal(port.capture(),lease);assert.equal(port.isCurrent(lease),true);
  s.tick(10000);assert.equal(s.calls.length,3);s.timeline.seek(s.timeline.currentUtc());finish();await settle();assert.equal(port.isCurrent(lease),false);assert.equal(port.capture(),null);assert.equal(s.timeline.snapshot().buffer,null);
 }finally{s.timeline.destroy();}
});

test('native availability gaps and failure revoke leases without revival after identical-input recovery',async()=>{
 for(const kind of ['gap','failure']){
  let failed=false;const s=setup((p,calls)=>{if(kind==='failure'&&calls.length>1&&failed)throw Error('native unavailable');const value=response(p);if(kind==='gap'&&!failed){value.status='partial';value.rows[1]={...value.rows[1],status:'error',error_code:'native_gap',position_m:null,elevation_deg:null,range_m:null,azimuth_deg:null,visible:null};}return value;});
  try{await s.ready();const port=s.timeline.displayContinuity,lease=port.capture();if(kind==='gap'){s.tick(1000);assert.equal(port.capture(),null);s.tick(2000);assert.ok(port.capture());assert.notEqual(port.capture(),lease);}else{failed=true;s.timeline.rate(60);const playingLease=port.capture();s.tick(5000);await settle();assert.equal(port.isCurrent(playingLease),false);assert.equal(port.capture(),null);failed=false;await s.timeline.calculate();s.timeline.play();assert.ok(port.capture());}
   assert.equal(port.isCurrent(lease),false);
  }finally{s.timeline.destroy();}
 }
});

test('display identity proof rejects mismatches and callback drift; scoped observers isolate errors and disposal',async()=>{
 const s=setup();try{await s.ready();const port=s.timeline.displayContinuity,lease=port.capture(),expected={catalog_number:base.catalog_number,normalized_gp_sha256:H,leap_sha256:LEAP_SHA256,eop_sha256:H};assert.equal(port.isCurrent(lease,expected),true);
  for(const key of Object.keys(expected))assert.equal(port.isCurrent(lease,{...expected,[key]:key==='catalog_number'?999:'foreign'}),false,key);
  assert.equal(port.isCurrent(lease,{}),false);
  const hostile={...expected,get catalog_number(){s.timeline.pause();return base.catalog_number;}};assert.equal(port.isCurrent(lease,hostile),false);
  s.timeline.play();let count=0;port.observe(()=>{throw Error('observer failure');});port.observe(()=>{count++;});s.timeline.rate(10);assert.equal(s.timeline.snapshot().rate,10);assert.ok(port.capture());assert.ok(count>0);s.timeline.destroy();const after=count;s.timeline.pause();s.timeline.rate(1);assert.equal(count,after);assert.equal(port.capture(),null);assert.equal(port.isCurrent(lease,expected),false);
 }finally{s.timeline.destroy();}
});

test('foreground pending transaction and nested command cannot grant leases before native terminal response',async()=>{
 let finish;const s=setup((p,calls)=>calls.length===1?response(p):new Promise(resolve=>{finish=()=>resolve(response(p));}));
 try{await s.ready();const port=s.timeline.displayContinuity,lease=port.capture();const work=s.timeline.calculate();assert.equal(port.isCurrent(lease),false);assert.equal(port.capture(),null);assert.equal(s.timeline.snapshot().pending,true);
  s.timeline.rate(10);assert.equal(port.capture(),null);finish();await work;assert.equal(port.capture(),null,'foreground query remains paused');s.timeline.play();assert.ok(port.capture());assert.notEqual(port.capture(),lease);
 }finally{s.timeline.destroy();}
});

test('scoped availability recovery is published only after the real display callback receives the valid row',async()=>{
 const s=setup(p=>{const value=response(p);value.status='partial';value.rows[1]={...value.rows[1],status:'error',error_code:'gap',position_m:null,elevation_deg:null,range_m:null,azimuth_deg:null,visible:null};return value;});
 try{await s.ready();const port=s.timeline.displayContinuity,events=[];port.observe(event=>{if(event.phase==='availability'&&event.reason==='display available'){assert.equal(s.shown.at(-1)?.status,'valid');assert.ok(port.capture());events.push(event);}});const lease=port.capture();s.tick(1000);s.tick(2000);assert.equal(port.isCurrent(lease),false);assert.equal(events.length,1);
 }finally{s.timeline.destroy();}
});
