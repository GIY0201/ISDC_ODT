import test from 'node:test';import assert from 'node:assert/strict';
import * as presentation from '../../../user_application/web/scripts/workspace_text_presentation.js';
test('read-only expanded details survive telemetry remounts and explicit close survives the next update',()=>{
 let observer;const listeners=new Map(),host={MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){this.stopped=true;}}};
 const root={details:[],querySelectorAll(){return this.details;},addEventListener(n,fn){listeners.set(n,fn);},removeEventListener(n){listeners.delete(n);},contains(e){return this.details.includes(e);}};
 const details=(label)=>({nodeType:1,tagName:'DETAILS',id:'',open:false,querySelector(){return {textContent:label};},closest(){return {id:'dt-dashboard'};},querySelectorAll(){return [];}});
 const a=details('모듈별 연결 상태');root.details=[a];
 const stop=presentation.installDisclosurePersistence(root,host);
 const click=d=>listeners.get('click')({target:{closest:()=>({parentElement:d})}});
 click(a);a.open=true;
 const b=details('모듈별 연결 상태');root.details=[b];observer([{addedNodes:[b]}]);assert.equal(b.open,true);
 click(b);b.open=false;
 const c=details('모듈별 연결 상태');root.details=[c];observer([{addedNodes:[c]}]);assert.equal(c.open,false);
 const other=details('연결 경로');root.details.push(other);observer([{addedNodes:[other]}]);assert.equal(other.open,false);
 stop();assert.equal(listeners.size,0);
});
