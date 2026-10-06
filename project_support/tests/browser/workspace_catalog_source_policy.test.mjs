import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
test('browser HTML normalization cannot recreate unchanged catalog buttons during status frames',async()=>{
 const items=[{NORAD_CAT_ID:2,OBJECT_NAME:'Z',MEAN_MOTION:15,EPOCH:'2026-10-06T00:00:00Z'}];
 const f=fixture(1280,720,{hash:'#satellite',satelliteGroups:async()=>({items:[{id:'active',label:'Active'}]}),satellites:async p=>({...p,source:'celestrak-cache',items,count:1,total:1,filtered_total:1,truncated:false})});
 try{for(let i=0;i<8;i++)await Promise.resolve();f.flush();const list=f.get('cat-list'),descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(list),'innerHTML');
 Object.defineProperty(list,'innerHTML',{get(){return descriptor.get.call(this).replace(/"\s+>/g,'">');},set(v){descriptor.set.call(this,v);}});
 const button=f.get('cat-sat-2');f.evaluate('catalogPanel.update()');f.evaluate('catalogPanel.update()');
 assert.equal(f.get('cat-sat-2'),button);assert.equal(button.isConnected,true);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
test('actual catalog UI whole-sort/favorite/labels share existing Viewer and leave orbit owner intact',async()=>{
 const calls=[];const items=[{NORAD_CAT_ID:2,OBJECT_NAME:'Z',MEAN_MOTION:15,EPOCH:'2026-10-06T00:00:00Z'},{NORAD_CAT_ID:10,OBJECT_NAME:'A',MEAN_MOTION:15,EPOCH:null}];
 const f=fixture(1280,720,{hash:'#satellite',satelliteGroups:async()=>({items:[{id:'active',label:'Active'}]}),satellites:async p=>{calls.push(p);return {...p,source:'celestrak-cache',items,count:2,total:2,filtered_total:2,truncated:false};},satelliteProfile:async number=>({source:'gp-cache',catalog:{NORAD_CAT_ID:number},gp:null})});
 try{for(let i=0;i<8;i++)await Promise.resolve();f.flush();const before=f.snapshot();await f.get('cat-sat-2').dispatch('click');await f.get('cat-favorite').dispatch('click');assert.match(f.get('cat-list').innerHTML,/★ Z/);await f.get('cat-sort-name').dispatch('click');for(let i=0;i<6;i++)await Promise.resolve();f.flush();assert.equal(calls.at(-1).limit,0);assert.match(f.get('cat-policy').textContent,/전체 검색 결과 2개/);assert.ok(f.get('cat-list').innerHTML.indexOf('cat-sat-10')<f.get('cat-list').innerHTML.indexOf('cat-sat-2'));
 const filter=f.get('cat-favorites-only');filter.checked=true;await filter.dispatch('change');assert.match(f.get('cat-list').innerHTML,/cat-sat-2/);assert.doesNotMatch(f.get('cat-list').innerHTML,/cat-sat-10/);assert.match(f.get('cat-detail').innerHTML,/Z · 2/);
 const labels=f.get('scene-labels');assert.equal(labels.disabled,false);labels.checked=false;await labels.dispatch('change');assert.match(f.get('scene-label-status').textContent,/숨김/);await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.get('scene-labels').checked,false);assert.deepEqual(f.snapshot(),before);assert.equal(f.viewers.length,1);assert.equal(f.counts().commands,0);
 }finally{f.dispose();}
});
