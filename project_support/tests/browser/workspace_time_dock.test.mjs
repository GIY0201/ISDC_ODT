import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceTimeDock} from '../../../user_application/web/scripts/workspace_time_dock.js';
function fixture(snapshot={utc:'2026-10-07T00:00:00.000000000Z',mode:'카탈로그',running:false,speed:1,speeds:[.1,1,10,60]}){
 const elements=new Map(),calls=[];let observer,removed=0;
 class Element{constructor(){this.listeners=new Map();this.textContent='';this.disabled=false;this.value='';this.attrs={};}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,v){this.listeners.set(k,v);}removeEventListener(k,v){if(this.listeners.get(k)===v)this.listeners.delete(k);}async fire(k='click'){return this.listeners.get(k)?.({target:this});}}
 const root=new Element();root.querySelector=s=>{if(!elements.has(s))elements.set(s,new Element());return elements.get(s);};
 const state={snapshot,readHook:null};const actions=Object.fromEntries(['play','pause','setSpeed','step','live'].map(name=>[name,async value=>{calls.push([name,value]);}]));
 const dock=createWorkspaceTimeDock({document:{},root,read:()=>{state.readHook?.();return state.snapshot;},observe:fn=>{observer=fn;return()=>removed++;},actions});
 return{root,state,calls,actions,dock,get:s=>root.querySelector(s),notify:()=>observer(),removed:()=>removed};
}
test('UTC dock uses supplied current owner and explicit controls only, with no mount commands',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.get('[data-time-utc]').textContent,f.state.snapshot.utc);assert.equal(f.get('[data-time-toggle]').disabled,false);
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
 const f=fixture(null);assert.equal(f.get('[data-time-utc]').textContent,'UTC 미확인');for(const id of ['toggle','back','forward','live','speed'])assert.equal(f.get(`[data-time-${id}]`).disabled,true);
 f.state.snapshot={utc:'2026-10-07T00:00:00.000000000Z',mode:'카탈로그',speed:1,speeds:[1]};f.notify();assert.equal(f.get('[data-time-toggle]').disabled,true);await f.get('[data-time-toggle]').fire();assert.equal(f.calls.length,0);
 f.state.snapshot={utc:'known',mode:'SIM',running:false,speed:1,speeds:[1],capabilities:{step:false}};f.notify();assert.equal(f.get('[data-time-live]').disabled,true);assert.equal(f.get('[data-time-back]').disabled,true);await f.get('[data-time-live]').fire();assert.equal(f.calls.length,0);f.dock.destroy();
});
test('pending single flight preserves errors and ignores dispose/late publication',async()=>{
 const f=fixture();let reject;f.actions.play=()=>{f.calls.push(['pending']);return new Promise((_,r)=>reject=r);};const p=f.get('[data-time-toggle]').fire();await f.get('[data-time-forward]').fire();assert.equal(f.calls.length,1);assert.equal(f.get('[data-time-speed]').disabled,true);
 reject(Error('입력 변경으로 거절'));await p;assert.match(f.get('[data-time-error]').textContent,/입력 변경/);f.notify();assert.match(f.get('[data-time-error]').textContent,/입력 변경/);
 let finish;f.actions.play=()=>new Promise(r=>finish=r);const late=f.get('[data-time-toggle]').fire();f.dock.destroy();const before=f.get('[data-time-error]').textContent;finish();await late;assert.equal(f.get('[data-time-error]').textContent,before);assert.equal(f.get('[data-time-toggle]').listeners.size,0);
});
