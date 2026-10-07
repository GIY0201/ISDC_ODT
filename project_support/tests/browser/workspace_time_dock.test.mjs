import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceTimeDock} from '../../../user_application/web/scripts/workspace_time_dock.js';
function fixture(snapshot={utc:'2026-10-07T00:00:00.000000000Z',mode:'카탈로그',running:false,speed:1,speeds:[.1,1,10,60]},displayMode='analysis'){
 const elements=new Map(),calls=[],timers=new Map();let observer,removed=0,nextTimer=0,now=Date.parse('2026-10-06T20:00:00Z'),reads=0;
 class Element{constructor(){this.listeners=new Map();this.textContent='';this.disabled=false;this.value='';this.attrs={};}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,v){this.listeners.set(k,v);}removeEventListener(k,v){if(this.listeners.get(k)===v)this.listeners.delete(k);}async fire(k='click'){return this.listeners.get(k)?.({target:this});}}
 const root=new Element();root.dataset={};root.querySelector=s=>{if(!elements.has(s))elements.set(s,new Element());return elements.get(s);};
 const state={snapshot,readHook:null};const actions=Object.fromEntries(['play','pause','setSpeed','step','live'].map(name=>[name,async value=>{calls.push([name,value]);}]));
 const events=new Map(),document={hidden:false,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
 const dock=createWorkspaceTimeDock({document,root,read:()=>{reads++;state.readHook?.();return state.snapshot;},observe:fn=>{observer=fn;return()=>removed++;},actions,now:()=>now,setTimer:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)});
 if(displayMode!=='current')elements.get('[data-time-display-'+displayMode+']').fire();
 return{root,state,calls,actions,dock,timers,advance:ms=>now+=ms,visible:value=>{document.hidden=!value;events.get('visibilitychange')?.();},reads:()=>reads,get:s=>root.querySelector(s),notify:()=>observer(),removed:()=>removed};
}

test('actual current UTC/KST ticks independently from a paused replay and never reads or changes its owner',()=>{
 const f=fixture(),before=structuredClone(f.state.snapshot),reads=f.reads();assert.equal(f.get('[data-time-current-utc]').textContent,'20:00:00');assert.equal(f.get('[data-time-current-kst]').textContent,'05:00:00');assert.equal(f.get('[data-time-current-kst-date]').textContent,'2026-10-07');assert.equal(f.get('[data-time-utc]').textContent,'00:00:00');assert.match(f.root.innerHTML,/현재 시각/);assert.doesNotMatch(f.root.innerHTML,/컴퓨터 시계/);assert.match(f.root.innerHTML,/궤도 분석 시각/);assert.equal(f.timers.size,1);const {fn,ms}=f.timers.values().next().value;assert.equal(ms,1000);f.advance(2300);f.timers.delete(f.timers.keys().next().value);fn();assert.equal(f.get('[data-time-current-kst]').textContent,'05:00:02');assert.equal(f.reads(),reads);assert.deepEqual(f.state.snapshot,before);assert.equal(f.calls.length,0);f.dock.destroy();assert.equal(f.timers.size,0);const held=f.get('[data-time-current-kst]').textContent;f.advance(1000);fn();assert.equal(f.get('[data-time-current-kst]').textContent,held);
});
test('title menu switches current/analysis/both displays without moving any clock and current-only hides inert analysis controls',async()=>{
 const initial={utc:'2026-10-07T00:00:00.000000000Z',mode:'카탈로그',running:false,speed:1,speeds:[1]},f=fixture(initial,'current');
 assert.equal(f.root.dataset.displayMode,'current');assert.equal(f.get('[data-time-display-toggle]').textContent,'현재 시각');assert.equal(f.get('[data-time-analysis-group]').hidden,true);assert.equal(f.get('[data-time-controls]').hidden,true);await f.get('[data-time-toggle]').fire();assert.equal(f.calls.length,0);
 await f.get('[data-time-display-toggle]').fire();assert.equal(f.get('[data-time-display-menu]').hidden,false);assert.equal(f.get('[data-time-display-toggle]').attrs['aria-expanded'],'true');
 await f.get('[data-time-display-both]').fire();assert.equal(f.root.dataset.displayMode,'both');assert.equal(f.get('[data-time-current-group]').hidden,false);assert.equal(f.get('[data-time-analysis-group]').hidden,false);assert.equal(f.get('[data-time-controls]').hidden,false);assert.equal(f.get('[data-time-display-menu]').hidden,true);assert.deepEqual(f.state.snapshot,initial);assert.equal(f.calls.length,0);
 await f.get('[data-time-display-analysis]').fire();assert.equal(f.get('[data-time-current-group]').hidden,true);assert.equal(f.get('[data-time-analysis-group]').hidden,false);assert.equal(f.get('[data-time-utc]').textContent,'00:00:00');assert.equal(f.timers.size,1);const held=f.get('[data-time-display-current]').listeners.get('click');f.dock.destroy();held();assert.equal(f.root.dataset.displayMode,'analysis');assert.equal(f.timers.size,0);
});
test('current time suspends while hidden, recaptures system time on visibility and rejects old timer callbacks',()=>{
 const f=fixture(null),old=f.timers.values().next().value.fn;f.visible(false);assert.equal(f.timers.size,0);f.advance(60000);old();assert.equal(f.get('[data-time-current-kst]').textContent,'05:00:00');f.visible(true);assert.equal(f.get('[data-time-current-kst]').textContent,'05:01:00');assert.equal(f.timers.size,1);old();assert.equal(f.timers.size,1);assert.equal(f.calls.length,0);assert.equal(f.get('[data-time-utc]').textContent,'--:--:--');f.dock.destroy();assert.equal(f.timers.size,0);
});
test('UTC dock uses supplied current owner and explicit controls only, with no mount commands',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.get('[data-time-utc]').textContent,'00:00:00');assert.equal(f.get('[data-time-date]').textContent,'2026-10-07');assert.equal(f.get('[data-time-utc]').attrs.datetime,f.state.snapshot.utc);assert.equal(f.get('[data-time-toggle]').disabled,false);
 await f.get('[data-time-toggle]').fire();await f.get('[data-time-back]').fire();await f.get('[data-time-forward]').fire();f.get('[data-time-speed]').value='10';await f.get('[data-time-speed]').fire('change');await f.get('[data-time-live]').fire();
 assert.deepEqual(f.calls,[['play',undefined],['step',-60],['step',60],['setSpeed',10],['live',undefined]]);
 f.state.snapshot={...f.state.snapshot,running:true,speed:10};f.notify();await f.get('[data-time-toggle]').fire();assert.equal(f.calls.at(-1)[0],'pause');f.dock.destroy();assert.equal(f.removed(),1);
});
test('reentrant reads cannot dispatch an outer stale click and disposal suppresses rendering',async()=>{
 const f=fixture();let nested;f.state.readHook=()=>{f.state.readHook=null;nested=f.get('[data-time-forward]').fire();};await f.get('[data-time-toggle]').fire();await nested;assert.deepEqual(f.calls,[['step',60]]);
 f.state.readHook=()=>{f.state.readHook=null;f.dock.destroy();};const old=f.get('[data-time-utc]').textContent;f.state.snapshot=null;f.notify();assert.equal(f.get('[data-time-utc]').textContent,old);assert.equal(f.removed(),1);
});
test('unsupported edited rate and disposed handlers never issue commands',async()=>{
 const f=fixture();f.get('[data-time-speed]').value='600';await f.get('[data-time-speed]').fire('change');assert.equal(f.calls.length,0);f.state.snapshot={...f.state.snapshot,speeds:[NaN]};f.notify();assert.equal(f.get('[data-time-speed]').disabled,true);f.dock.destroy();await f.get('[data-time-live]').fire();assert.equal(f.calls.length,0);
});
test('unknown owner and bufferless catalogue never invent running or allow stale disabled clicks',async()=>{
 const f=fixture(null);assert.equal(f.get('[data-time-utc]').textContent,'--:--:--');assert.equal(f.get('[data-time-date]').textContent,'표시 시각 없음');for(const id of ['toggle','back','forward','live','speed'])assert.equal(f.get(`[data-time-${id}]`).disabled,true);
 f.state.snapshot={utc:'2026-10-07T00:00:00.000000000Z',mode:'카탈로그',speed:1,speeds:[1]};f.notify();assert.equal(f.get('[data-time-toggle]').disabled,true);await f.get('[data-time-toggle]').fire();assert.equal(f.calls.length,0);
 f.state.snapshot={utc:'known',mode:'SIM',running:false,speed:1,speeds:[1],capabilities:{step:false}};f.notify();assert.equal(f.get('[data-time-live]').disabled,true);assert.equal(f.get('[data-time-back]').disabled,true);await f.get('[data-time-live]').fire();assert.equal(f.calls.length,0);f.dock.destroy();
});
test('pending single flight preserves errors and ignores dispose/late publication',async()=>{
 const f=fixture();let reject;f.actions.play=()=>{f.calls.push(['pending']);return new Promise((_,r)=>reject=r);};const p=f.get('[data-time-toggle]').fire();await f.get('[data-time-forward]').fire();assert.equal(f.calls.length,1);assert.equal(f.get('[data-time-speed]').disabled,true);
 reject(Error('입력 변경으로 거절'));await p;assert.match(f.get('[data-time-error]').textContent,/입력 변경/);f.notify();assert.match(f.get('[data-time-error]').textContent,/입력 변경/);
 let finish;f.actions.play=()=>new Promise(r=>finish=r);const late=f.get('[data-time-toggle]').fire();f.dock.destroy();const before=f.get('[data-time-error]').textContent;finish();await late;assert.equal(f.get('[data-time-error]').textContent,before);assert.equal(f.get('[data-time-toggle]').listeners.size,0);
});

test('KST derives from the same UTC including date rollover and leap-second display',()=>{
 const f=fixture({utc:'2026-12-31T23:59:60.000000000Z',mode:'저장 서버 커서',running:false,speed:1,speeds:[1]});
 assert.equal(f.get('[data-time-utc]').textContent,'23:59:60');assert.equal(f.get('[data-time-date]').textContent,'2026-12-31');assert.equal(f.get('[data-time-kst]').textContent,'08:59:60');assert.equal(f.get('[data-time-kst-date]').textContent,'2027-01-01');assert.equal(f.calls.length,0);f.dock.destroy();
});
