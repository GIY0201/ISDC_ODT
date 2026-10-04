import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [w,h] of [[1280,720],[1920,1080]])test(`catalog real assembly one Viewer/draft/restore ${w}x${h}`,async()=>{
 let calls=0;const f=fixture(w,h,{hash:'#satellite',satelliteGroups:async()=>({items:[{id:'active',label:'전체'}]}),satellites:async p=>(calls++,{...p,source:'celestrak-cache',items:[{NORAD_CAT_ID:25544,OBJECT_NAME:'<ISS>',MEAN_MOTION:15}],count:1,total:1,filtered_total:1,fetched_at:null}),satelliteProfile:async()=>({source:'gp-cache',catalog:{NORAD_CAT_ID:25544},gp:null})});
 try{for(let i=0;i<8;i++)await Promise.resolve();f.flush();assert.ok(f.doc.getElementById('catalog-workspace'));assert.match(f.get('cat-list').innerHTML,/&lt;ISS&gt;/);assert.equal(f.viewers.length,1);const before=f.snapshot();
 const field=f.get('cat-query');field.value='draft';await field.dispatch('input');await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.get('cat-query').value,'draft');assert.equal(calls,1);
 await f.get('cat-sat-25544').dispatch('click');for(let i=0;i<4;i++)await Promise.resolve();assert.match(f.get('cat-detail').innerHTML,/미확인/);assert.deepEqual(f.snapshot(),before);assert.equal(f.counts().commands,0);
 f.context.applyWorkspaceDraft([{id:'cat-query',value:'remote'}]);assert.equal(f.get('cat-query').value,'remote');assert.equal(calls,1);await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
