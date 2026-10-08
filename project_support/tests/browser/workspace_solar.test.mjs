import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{createUtcCodec,LEAP_SHA256}from'../../../user_application/web/scripts/orbit_utc.js';
let serial=0;
async function fixture(){
 const code=(await readFile(new URL('../../../user_application/web/scripts/workspace_solar.js',import.meta.url),'utf8'))
 .replace("'/static/visualization/solar_display.js?v=u031'",JSON.stringify(new URL('../../../digital_twin/visualization/solar_display.js',import.meta.url).href))
 .replace("'./solar_timeline.js'",JSON.stringify(new URL('../../../user_application/web/scripts/solar_timeline.js',import.meta.url).href));
 const patched=code.replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href));
 const {createWorkspaceSolar}=await import(`data:text/javascript;base64,${Buffer.from(patched+'\n//'+serial++).toString('base64')}`);
 let contextCallback,viewCallback,factory,owned;const events=new Map(),instances=[],writes=[];
 const globe={observeDisplayContext(fn){contextCallback=fn;fn(null);return()=>{contextCallback=null;};},observeView(fn){viewCallback=fn;fn({choice:{theme:'dark'}});return()=>{viewCallback=null;};},bindSolarRenderer(fn){factory=fn;return()=>{owned?.destroy();factory=null;};}};
 const host={localStorage:{getItem:()=> 'off',setItem:(...v)=>writes.push(v)},addEventListener(k,fn){events.set(k,fn);},removeEventListener(k){events.delete(k);},dispatchEvent(event){events.get(event.type)?.(event);},CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}}};
 let tick,cleared=false;host.now=()=>new Date('2026-10-08T03:00:00Z');host.setInterval=fn=>(tick=fn,1);host.clearInterval=()=>{cleared=true;};
 const api={solarSamples:()=>new Promise(()=>{})};
 const c=createWorkspaceSolar({api,globe,overlay:{},host,createDisplay:(C,viewer,overlay,options)=>{const d={updates:[],styles:[],update(v){this.updates.push(v);options.onStatus({phase:v?'ready':'unavailable',indicator:'offscreen',reason:null});},clear(reason){this.updates.push(null);options.onStatus({phase:'unavailable',reason,indicator:'unavailable'});},setStyle(...v){this.styles.push(v);},destroy(){this.destroyed=true;}};instances.push(d);return d;}});
 return{c,api,host,events,instances,writes,tick:()=>tick?.(),cleared:()=>cleared,context(v){contextCallback?.(v);},view(v){viewCallback?.({choice:{theme:v}});},boot(){owned=factory({},{});return instances.at(-1);},connected:()=>Boolean(contextCallback||viewCallback||factory)};
}
test('original preference/event policy reapplies theme, mirrors storage, tolerates denied storage and disposes',async()=>{
 const f=await fixture(),d=f.boot();assert.equal(f.c.state().enabled,false);assert.deepEqual(d.styles.at(-1),['dark',false]);f.c.setEnabled(true);assert.deepEqual(f.writes.at(-1),['spacetwin-globe-lighting-v1','on']);f.view('light');assert.deepEqual(d.styles.at(-1),['light',true]);
 f.events.get('storage')({key:'spacetwin-globe-lighting-v1',newValue:'off'});assert.equal(f.c.state().enabled,false);f.events.get('spacetwin:globelighting')({detail:{enabled:true}});assert.equal(f.c.state().enabled,true);const count=f.writes.length;f.events.get('spacetwin:globelighting')({detail:{enabled:'false'}});assert.equal(f.c.state().enabled,true);assert.equal(f.writes.length,count);
 Object.defineProperty(f.host,'localStorage',{get(){throw Error('denied');}});f.c.setEnabled(false);assert.equal(f.c.state().enabled,false);const states=[];const remove=f.c.observe(v=>states.push(v));remove();f.c.destroy();assert.equal(f.events.size,0);assert.equal(f.connected(),false);assert.equal(d.destroyed,true);const n=states.length;f.c.setEnabled(true);f.view('dark');assert.equal(states.length,n);
});
test('unselected Earth uses current UTC; selected geometry takes priority and cleanup stops the clock',async()=>{
 const f=await fixture();assert.equal(f.c.state().context.key,'earth:current');assert.equal(f.c.state().context.utc,'2026-10-08T03:00:00.000000000Z');
 const selected={key:'stored:one',utc:'2020-07-12T21:16:01.000416000Z',leap_sha256:LEAP_SHA256};f.context(selected);f.tick();assert.equal(f.c.state().context.utc,selected.utc);
 f.context(null);assert.equal(f.c.state().context.key,'earth:current');f.c.destroy();assert.equal(f.cleared(),true);f.tick();
});

test('actual timeline assembly follows injected UTC, reports copied quality, failure and explicit recovery',async()=>{
 const f=await fixture(),d=f.boot(),codec=createUtcCodec(LEAP_SHA256),H='a'.repeat(64),utc='2020-07-12T21:16:01.000416000Z';let calls=0;
 const response=p=>({...p,schema_version:1,status:'valid',frame:'ITRF',end_utc:codec.advance(p.start_utc,600),eop_sha256:H,leap_sha256:LEAP_SHA256,solar_model:'ERFA_builtin',frame_transform:'IAU2006_2000A',observed_cip_offsets:false,purpose:'display_geometry',units:{time:'UTC',direction:'unitless'},rows:Array.from({length:601},(_,i)=>({utc:codec.advance(p.start_utc,i),status:'valid',direction_to_sun:[1,0,0],eop_quality:{ut1:'predicted_a',polar_motion:'observed_a'}}))});
 f.api.solarSamples=p=>{calls++;return Promise.resolve(response(p));};const context={key:'catalog:25544:hash',utc,leap_sha256:LEAP_SHA256,eop_sha256:H};f.context(context);await new Promise(r=>setImmediate(r));assert.equal(d.updates.at(-1).utc,utc);f.context({...context,utc:codec.advance(utc,.5)});assert.equal(d.updates.at(-1).interpolated,true);assert.equal(calls,1);const state=f.c.state();state.geometry.eop_quality.ut1='changed';assert.equal(f.c.state().geometry.eop_quality.ut1,'predicted_a');
 f.api.solarSamples=()=>{calls++;return Promise.reject(Error('EOP unavailable'));};f.context({...context,utc:codec.advance(utc,1000)});await new Promise(r=>setImmediate(r));assert.equal(d.updates.at(-1),null);assert.match(f.c.state().timeline.error,/EOP unavailable/);assert.equal(f.c.state().geometry,null);
 f.api.solarSamples=p=>{calls++;return Promise.resolve(response(p));};f.c.retry();await new Promise(r=>setImmediate(r));assert.equal(d.updates.at(-1).utc,codec.advance(utc,1000));f.c.destroy();
});

test('replica solar uses the existing native sample and preferences without another query or primary teardown',async()=>{
 const f=await fixture(),primary=f.boot(),codec=createUtcCodec(LEAP_SHA256),H='a'.repeat(64),utc='2020-07-12T21:16:01.000416000Z';let calls=0,valid=true,child;
 f.api.solarSamples=p=>{calls++;return Promise.resolve({...p,schema_version:1,status:'valid',frame:'ITRF',end_utc:codec.advance(p.start_utc,600),eop_sha256:H,leap_sha256:LEAP_SHA256,solar_model:'ERFA_builtin',frame_transform:'IAU2006_2000A',observed_cip_offsets:false,purpose:'display_geometry',units:{time:'UTC',direction:'unitless'},rows:Array.from({length:601},(_,i)=>({utc:codec.advance(p.start_utc,i),status:'valid',direction_to_sun:[1,0,0],eop_quality:{ut1:'predicted_a',polar_motion:'observed_a'}}))});};
 const context={key:'catalog:25544:hash',utc,leap_sha256:LEAP_SHA256,eop_sha256:H};f.context(context);await new Promise(r=>setImmediate(r));
 const replica={bindSolar(factory){child=factory({}, {},{readContext:()=>valid?context:null,verifySource:()=>valid});return true;}};
 assert.equal(f.c.bindDisplayReplica(replica,{}),true);const secondary=f.instances[1];child.syncFrame(utc);assert.equal(calls,1);assert.equal(secondary.updates.at(-1).utc,utc);assert.equal(secondary.updates.at(-1).eop_sha256,H);
 f.c.setEnabled(true);f.view('light');child.syncFrame(utc);assert.deepEqual(secondary.styles.at(-1),['light',true]);valid=false;child.syncFrame(utc);assert.equal(secondary.updates.at(-1),null);child.destroy();assert.equal(secondary.destroyed,true);assert.notEqual(primary.destroyed,true);f.c.destroy();assert.equal(primary.destroyed,true);
});
