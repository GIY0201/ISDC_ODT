import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpticalDisplayScheduler} from '../../../user_application/web/scripts/nodes/optical_display_scheduler.js';
function setup({bridge=true,slow=false}={}){
 let display={utc:'2026-10-07T00:00:00.123456789Z',key:'catalog:1:hash',leap_sha256:'full-leap',eop_sha256:'full-eop'},lease=Object.freeze({}),valid=true,timer=null,finish=null,controlError=null;const samples=[],exact=[],errors=[],cancels=[],microtasks=[],timerCalls=[],clears=[];
 const scheduler=createOpticalDisplayScheduler({readDisplay:()=>{if(controlError)throw controlError;return display;},...(bridge?{readContinuity:()=>valid?lease:null,verifyContinuity:value=>valid&&value===lease}:{}),requestSampled:(value,authority)=>{samples.push({display:value,lease:authority});return slow?new Promise(resolve=>{finish=resolve;}):Promise.resolve();},requestExact:value=>{exact.push(value);return Promise.resolve();},cancelSampled:()=>cancels.push(true),onError:error=>errors.push(error),setTimer:(fn,ms)=>{timerCalls.push(ms);timer=fn;return timerCalls.length;},clearTimer:id=>{clears.push(id);timer=null;},queueMicrotask:fn=>microtasks.push(fn)});
 return {scheduler,samples,exact,errors,cancels,timerCalls,clears,get display(){return display;},set display(value){display=value;},set valid(value){valid=value;},rotate(){lease=Object.freeze({});},set error(value){controlError=value;},tick(){timer?.();},flush(){while(microtasks.length)microtasks.shift()();},finish(){finish?.();finish=null;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('real lease schedules immediate and 1000ms sampled analysis with zero analytic requests per natural frame',async()=>{
 const s=setup();s.scheduler.start();s.flush();await settle();assert.deepEqual(s.timerCalls,[1000]);assert.equal(s.samples.length,1);assert.deepEqual(s.samples[0].display,s.display);
 for(let i=0;i<100;i++){s.display={...s.display,utc:`arbitrary exact native UTC ${i}`};s.scheduler.observe();}s.flush();await settle();assert.equal(s.samples.length,1);assert.equal(s.exact.length,0);s.tick();s.flush();await settle();assert.equal(s.samples.length,2);assert.equal(s.samples[1].display.utc,s.display.utc);s.scheduler.destroy();
});

test('slow sampled operation retains one active and one latest intent without cancelling timer ticks',async()=>{
 const s=setup({slow:true});s.scheduler.start();s.flush();assert.equal(s.samples.length,1);for(let i=1;i<=20;i++){s.display={...s.display,utc:`exact-${i}`};s.tick();s.scheduler.observe();s.flush();}assert.equal(s.samples.length,1);assert.equal(s.cancels.length,0);s.finish();await settle();s.flush();assert.equal(s.samples.length,2);assert.equal(s.samples[1].display.utc,'exact-20');s.finish();await settle();s.scheduler.destroy();
});

test('control entry suppresses pause final paint and availability fallback until settled microtask reads current source',async()=>{
 const s=setup();s.scheduler.start();s.flush();await settle();s.scheduler.continuityEvent({phase:'invalidated',reason:'pause'});s.valid=false;s.scheduler.observe();s.scheduler.continuityEvent({phase:'availability',reason:'old final paint'});s.flush();assert.equal(s.exact.length,0);assert.equal(s.cancels.length,1);
 s.scheduler.continuityEvent({phase:'settled',reason:'pause'});assert.equal(s.exact.length,0);s.display={...s.display,utc:'exact pause boundary'};s.flush();await settle();assert.equal(s.exact.length,1);assert.equal(s.exact[0].utc,'exact pause boundary');
 s.scheduler.continuityEvent({phase:'invalidated',reason:'same UTC seek'});s.scheduler.continuityEvent({phase:'settled',reason:'same UTC seek'});s.flush();await settle();assert.equal(s.exact.length,2);s.scheduler.destroy();
});

test('availability before viewport notification defers and deduplicates fresh complete owner reads',async()=>{
 const s=setup();s.scheduler.start();s.flush();await settle();s.scheduler.continuityEvent({phase:'availability',reason:'source changed'});s.scheduler.continuityEvent({phase:'availability',reason:'recovery'});s.scheduler.observe();assert.equal(s.samples.length,1);s.rotate();s.display={utc:'full new exact UTC',key:'catalog:2:new',leap_sha256:'new-leap',eop_sha256:'new-eop',provenance:{full:'kept'}};s.flush();await settle();assert.equal(s.samples.length,2);assert.deepEqual(s.samples[1].display,s.display);s.scheduler.destroy();
});

test('ignored abort retains serial active operation then captures latest paused exact intent',async()=>{
 const s=setup({slow:true});s.scheduler.start();s.flush();s.scheduler.continuityEvent({phase:'invalidated',reason:'pause'});s.valid=false;s.scheduler.continuityEvent({phase:'settled',reason:'pause'});s.flush();assert.equal(s.exact.length,0);assert.equal(s.samples.length,1);s.display={...s.display,utc:'latest actual paused UTC'};s.finish();await settle();s.flush();assert.equal(s.exact.length,1);assert.equal(s.exact[0].utc,s.display.utc);s.scheduler.destroy();
});

test('legacy and unsupported paused/stored/SIM sources retain exact frame calls without fabricated sampling',async()=>{
 for(const bridge of [false,true]){const s=setup({bridge});s.valid=false;s.scheduler.start();s.flush();await settle();const count=s.exact.length;for(let i=0;i<4;i++){s.display={utc:`exact-${i}`,key:'stored:actual'};s.scheduler.observe();}assert.equal(s.exact.length,count+4);assert.equal(s.samples.length,0);s.scheduler.destroy();}
 const s=setup();s.scheduler.start();s.flush();await settle();s.error=Error('projected SIM not analysis authority');s.scheduler.observe();s.flush();assert.equal(s.samples.length,1);assert.equal(s.exact.length,0);assert.equal(s.errors.length,1);s.scheduler.destroy();
});

test('inactive and disposal clear timers and suppress late microtasks/results without changing display',async()=>{
 const s=setup({slow:true});s.scheduler.start();s.flush();const original=s.display;s.scheduler.setActive(false);assert.equal(s.clears.length,1);s.tick();s.scheduler.force();s.flush();s.finish();await settle();s.flush();assert.equal(s.samples.length,1);assert.equal(s.display,original);s.scheduler.setActive(true);s.flush();assert.equal(s.timerCalls.length,2);assert.equal(s.samples.length,2);s.scheduler.force();s.scheduler.destroy();s.finish();await settle();s.flush();s.tick();s.scheduler.observe();assert.equal(s.samples.length,2);assert.equal(s.clears.length,2);assert.equal(s.display,original);
});

test('reentrant explicit invalidation during owner capture cannot dispatch before the new settled intent',async()=>{
 let scheduler,reenter=false,lease=Object.freeze({}),utc='before control';const tasks=[],sampled=[];
 scheduler=createOpticalDisplayScheduler({readDisplay:()=>({utc}),readContinuity:()=>{if(reenter){reenter=false;scheduler.continuityEvent({phase:'invalidated',reason:'seek'});utc='after same-source seek';lease=Object.freeze({});scheduler.continuityEvent({phase:'settled',reason:'seek'});}return lease;},verifyContinuity:value=>value===lease,requestSampled:display=>{sampled.push(display);return Promise.resolve();},requestExact:()=>{throw Error('not expected');},cancelSampled:()=>{},setTimer:()=>1,clearTimer:()=>{},queueMicrotask:fn=>tasks.push(fn)});
 try{scheduler.start();reenter=true;tasks.shift()();assert.equal(sampled.length,0,'an operation crossing an explicit invalidation must yield to its settled intent');while(tasks.length)tasks.shift()();await settle();assert.equal(sampled.length,1);assert.equal(sampled[0].utc,'after same-source seek');}finally{scheduler.destroy();}
});

test('sampled query rejection reports once and preserves periodic retry; disposed late rejection is inert',async()=>{
 let reject,queries=0;const tasks=[],errors=[];let timer;const lease=Object.freeze({});const scheduler=createOpticalDisplayScheduler({readDisplay:()=>({utc:'exact authoritative string'}),readContinuity:()=>lease,verifyContinuity:value=>value===lease,requestSampled:()=>{queries++;return new Promise((_,fail)=>{reject=fail;});},requestExact:()=>{throw Error('unexpected exact');},cancelSampled:()=>{},onError:error=>errors.push(error),setTimer:fn=>(timer=fn,1),clearTimer:()=>{},queueMicrotask:fn=>tasks.push(fn)});
 const flush=()=>{while(tasks.length)tasks.shift()();};scheduler.start();flush();reject(Error('native failed'));await settle();assert.equal(errors.length,1);timer();flush();assert.equal(queries,2);scheduler.destroy();reject(Error('late disposed'));await settle();flush();assert.equal(errors.length,1);assert.equal(queries,2);
});

test('one-shot timer recurrence owns one handle and late cleared callbacks cannot restart work',async()=>{
 const handles=[],cleared=[],tasks=[],samples=[];const lease=Object.freeze({});const scheduler=createOpticalDisplayScheduler({readDisplay:()=>({utc:'unchanged exact owner UTC'}),readContinuity:()=>lease,verifyContinuity:value=>value===lease,requestSampled:display=>{samples.push(display);return Promise.resolve();},requestExact:()=>{throw Error('not exact');},cancelSampled:()=>{},setTimer:(callback,delay)=>{handles.push({callback,delay});return handles.length;},clearTimer:id=>cleared.push(id),queueMicrotask:fn=>tasks.push(fn)});
 const flush=()=>{while(tasks.length)tasks.shift()();};try{scheduler.start();flush();await settle();assert.equal(handles.length,1);handles[0].callback();assert.equal(handles.length,2);assert.deepEqual(handles.map(h=>h.delay),[1000,1000]);flush();await settle();assert.equal(samples.length,2);
  scheduler.setActive(false);assert.deepEqual(cleared,[2]);handles[1].callback();assert.equal(handles.length,2);scheduler.setActive(true);flush();await settle();assert.equal(handles.length,3);assert.equal(samples.length,3);handles[0].callback();handles[1].callback();flush();await settle();assert.equal(handles.length,3);assert.equal(samples.length,3);scheduler.destroy();handles[2].callback();assert.equal(handles.length,3);assert.deepEqual(cleared,[2,3]);
 }finally{scheduler.destroy();}
});
