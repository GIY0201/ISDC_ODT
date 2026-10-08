import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';

test('implemented workspaces do not offer a second static example overview',async()=>{
 for(const view of ['satellite','ground','data','security','em']){
  const f=fixture(1280,720,{hash:'#'+view,popout:true});
  try{await new Promise(r=>setTimeout(r,0));assert.doesNotMatch(f.get('screen').innerHTML,/class="view role"/,view);assert.equal(f.get('work-section-nav').children.some(b=>b.dataset.workSectionTarget==='work-overview-'+view),false,view);}finally{f.dispose();}
 }
});
test('DT dashboard participates in the same scrollable section layout',()=>{
 const f=fixture(1280,720,{hash:'#dtwall',popout:true});try{assert.equal(f.get('dt-dashboard').dataset.workSection,'true');assert.equal(f.get('dt-dashboard').dataset.workSectionHidden,'false');}finally{f.dispose();}
});
test('satellite tools start with catalogue selection and keep drafts when switching sections',()=>{
 const f=fixture(1280,720,{hash:'#satellite',popout:true});try{const nav=f.get('work-section-nav');assert.equal(nav.children[0].dataset.workSectionTarget,'catalog-workspace');assert.equal(nav.children[0].textContent,'위성 찾기');const draft=f.get('cat-query');draft.value='kept';for(const b of nav.children)nav.listeners.get('click')?.forEach(fn=>fn({target:b}));assert.equal(f.get('cat-query'),draft);assert.equal(draft.value,'kept');}finally{f.dispose();}
});
