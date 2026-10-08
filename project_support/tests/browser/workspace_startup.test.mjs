import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';

for(const hash of ['', '#mission', '#wall', '#satellite'])test(`regular startup retains ${hash||'root'} context without opening a work window`,async()=>{
 const f=fixture(1280,720,{hash,openInitialView:false});try{
  assert.equal(f.get('work-window').hidden,true);
  assert.equal(f.get('launcher').hidden,true);assert.equal(f.get('window-shelf').hidden,true);
  assert.equal(f.evaluate('location.hash'),hash);assert.equal(f.viewers.length,1);
  f.evaluate("location.hash='#wall'");await f.win.dispatch('hashchange');
  assert.equal(f.get('work-window').hidden,false);assert.equal(f.viewers.length,2);
 }finally{await new Promise(resolve=>setImmediate(resolve));f.dispose();}
});
test('explicit popout keeps its requested role window and regular explicit navigation still opens',async()=>{
 const f=fixture(1280,720,{hash:'#mission',popout:true,openInitialView:false});try{
  assert.equal(f.get('work-window').hidden,false);assert.equal(f.get('window-title').textContent,'임무계획 및 결과');
  f.evaluate("location.hash='#satellite'");await f.win.dispatch('hashchange');assert.equal(f.get('work-window').hidden,false);assert.equal(f.get('window-title').textContent,'위성 상태 및 궤도');
 }finally{await new Promise(resolve=>setImmediate(resolve));f.dispose();}
});
