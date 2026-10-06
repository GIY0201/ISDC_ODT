import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceScenarioPanel} from '../../../user_application/web/scripts/tabs/source_scenarios.js';
function fixture(onResume,callbacks={}){
 const fields=new Map();const element=()=>({checked:false,disabled:false,hidden:false,textContent:'',innerHTML:'',listeners:new Map(),addEventListener(k,fn){this.listeners.set(k,fn);},removeEventListener(k){this.listeners.delete(k);},querySelector(id){if(!fields.has(id))fields.set(id,element());return fields.get(id);},remove(){}});
 const document={createElement:element,getElementById:()=>({prepend(){}})};let setups=0;
 const runner={definition:null,view(){return {phase:'selected',now:0,elapsed:0,speed:1,steps:[],phases:[],log:[],scenario:this.definition};},subscribe:()=>()=>{},async setup(){setups++;}};
 const ui=createSourceScenarioPanel({runner,comparisonRows:()=>[],document,onResume,...callbacks,host:{confirm(){throw Error('native modal must not be used');}}});ui.show('run');
 return {ui,runner,get:id=>fields.get('#sc-'+id),setups:()=>setups};
}
test('scenario setup requires review of current definition and consumes review before mutation',async()=>{
 const f=fixture();assert.equal(f.get('setup').disabled,true);
 f.runner.definition={name:'A'};f.ui.update();assert.equal(f.get('setup').disabled,true);
 await f.get('setup').listeners.get('click')();assert.equal(f.setups(),0);
 f.get('setup-review').checked=true;f.get('setup-review').listeners.get('change')();assert.equal(f.get('setup').disabled,false);
 await f.get('setup').listeners.get('click')();assert.equal(f.setups(),1);assert.equal(f.get('setup-review').checked,false);assert.equal(f.get('setup').disabled,true);
 f.get('setup-review').checked=true;f.runner.definition={name:'B'};f.ui.update();assert.equal(f.get('setup-review').checked,false);
 await f.get('setup').listeners.get('click')();assert.equal(f.setups(),1);f.ui.destroy();
});

test('restoring records does not implicitly resume; explicit resume delegates only to preflight',async()=>{
 let resumes=0;const f=fixture(async()=>{resumes++;throw Error('different run rejected');});
 f.runner.restore=()=>{};await f.get('restore').listeners.get('click')();assert.equal(resumes,0);
 await f.get('resume').listeners.get('click')();assert.equal(resumes,1);assert.match(f.get('state').textContent,/different run rejected/);assert.equal(f.setups(),0);f.ui.destroy();
 const unavailable=fixture();assert.equal(unavailable.get('resume').disabled,true);unavailable.ui.destroy();
});

test('preparing state shows original stage label without inventing progress',()=>{
 const f=fixture();const view=f.runner.view.bind(f.runner);f.runner.view=()=>({...view(),phase:'preparing',setup:{stage:'missions',stages:[['missions','임무 등록과 편성 요청']]}});f.ui.update();assert.match(f.get('state').textContent,/임무 등록과 편성 요청/);assert.doesNotMatch(f.get('state').textContent,/100%/);f.ui.destroy();
});

test('explicit analysis follow awaits existing owner without a native modal and reports rejection',async()=>{
 let follow=0,release=0,stop=0;let finish;const pending=new Promise(r=>finish=r);const f=fixture(undefined,{onFollow:async()=>{follow++;await pending;throw Error('paused SIM required');},onRelease:async()=>release++,onStop:async()=>stop++});
 const action=f.get('follow').listeners.get('click')();assert.equal(follow,1);assert.equal(f.get('follow').disabled,true);finish();await action;assert.match(f.get('state').textContent,/paused SIM required/);assert.equal(f.get('follow').disabled,false);
 await f.get('release').listeners.get('click')();await f.get('stop').listeners.get('click')();assert.equal(release,1);assert.equal(stop,1);assert.equal(f.setups(),0);f.ui.destroy();
});
