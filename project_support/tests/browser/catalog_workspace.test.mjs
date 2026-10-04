import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogWorkspace,profileRows} from '../../../user_application/web/scripts/tabs/catalog_workspace.js';
const groups={items:[{id:'active',label:'전체'},{id:'stations',label:'정거장'}]};
const item={NORAD_CAT_ID:25544,OBJECT_NAME:'ISS',MEAN_MOTION:15,PERIOD_MINUTES:96,INCLINATION:0};
const page=(p,extra={})=>({source:'celestrak-cache',group:p.group,label:'전체',items:[item],count:1,total:201,filtered_total:201,offset:p.offset,limit:100,fetched_at:'2026-10-05T00:00:00Z',...extra});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
test('dynamic groups, applied filters and server pagination; draft does not query',async()=>{
 const calls=[];const c=createCatalogWorkspace({satelliteGroups:async()=>groups,satellites:async p=>(calls.push(p),page(p)),satelliteProfile:async()=>({source:'gp-cache',catalog:{NORAD_CAT_ID:25544},gp:item})});
 await c.load();c.edit('query','ISS');assert.equal(c.snapshot().applied.query,'');assert.equal(calls.length,1);await c.next();assert.equal(c.snapshot().draft.query,'ISS');assert.equal(calls.length,1);
 await c.search();assert.equal(calls.at(-1).query,'ISS');await c.next();assert.equal(calls.at(-1).offset,100);await c.previous();assert.equal(calls.at(-1).offset,0);
 c.edit('group','arbitrary');assert.equal(c.snapshot().draft.group,'active');c.destroy();
});
test('late list/profile cannot overwrite current query, failure retains labelled last results',async()=>{
 const a=deferred(),detail=deferred();let n=0;
 const c=createCatalogWorkspace({satelliteGroups:async()=>groups,satellites:async p=>++n===1?a.promise:page(p),satelliteProfile:()=>detail.promise});
 const first=c.load();await Promise.resolve();await Promise.resolve();c.edit('query','new');await c.search();a.resolve(page({group:'active',offset:0},{items:[],count:0}));await first;
 assert.equal(c.snapshot().result.items[0].OBJECT_NAME,'ISS');const pending=c.select(25544);c.edit('query','other');await c.search();detail.resolve({source:'gp-cache',catalog:{NORAD_CAT_ID:25544},gp:item});await pending;assert.equal(c.snapshot().profile,null);
 c.destroy();
});
test('invalid response and transport failure preserve last result and unknown values',async()=>{
 let bad=false;const c=createCatalogWorkspace({satelliteGroups:async()=>groups,satellites:async p=>bad?{...page(p),count:4}:page(p)});
 await c.load();bad=true;await c.search();assert.match(c.snapshot().error,/응답/);assert.equal(c.snapshot().result.count,1);
 const rows=profileRows({NORAD_CAT_ID:25544,MEAN_MOTION:null,PERIOD_MINUTES:0,APOGEE_KM:0,INCLINATION:0},{source:'gp-cache',catalog:{NORAD_CAT_ID:25544,RCS:null},gp:null});
 assert.ok(rows.some(([k,v])=>k==='경사각 °'&&v===0));assert.ok(rows.some(([k,v])=>k==='주기 min'&&v==='미확인'));assert.ok(rows.some(([k,v])=>k==='소유 기관'&&v==='미확인'));c.destroy();
});
test('empty/demo/unavailable and explicit source preserved, copies immutable',async()=>{
 for(const source of ['demo-fallback','upstream-unavailable','celestrak-stale']){
 const c=createCatalogWorkspace({satelliteGroups:async()=>groups,satellites:async p=>page(p,{source,items:[],count:0,filtered_total:0,total:0,warning:'offline',stale:true})});await c.load();const s=c.snapshot();assert.equal(s.result.source,source);if(source==='upstream-unavailable')assert.equal(s.status,'원본 조회 불가');s.draft.query='mutated';assert.equal(c.snapshot().draft.query,'');c.destroy();}
});
