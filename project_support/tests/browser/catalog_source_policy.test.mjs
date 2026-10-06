import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogWorkspace} from '../../../user_application/web/scripts/tabs/catalog_workspace.js';
const rows=Array.from({length:205},(_,i)=>({NORAD_CAT_ID:i+1,OBJECT_NAME:`Satellite ${205-i}`,ORBIT_REGIME:i%2?'LEO':'MEO',EPOCH:i===0?null:`2026-10-06T00:00:00Z`}));
const groups={items:[{id:'active',label:'Active'}]};
function fixture(extra={}) {const calls=[],writes=[];let response=extra.response;const api={satelliteGroups:async()=>groups,satellites:async p=>{calls.push(p);const items=p.limit===0?rows:rows.slice(p.offset,p.offset+100);return response?.(p)??{source:'celestrak-cache',group:p.group,offset:p.offset,limit:p.limit,items,count:items.length,total:205,filtered_total:205,truncated:p.limit!==0&&p.offset+items.length<205};},satelliteProfile:async n=>({source:'gp-cache',catalog:{NORAD_CAT_ID:n},gp:null})};const c=createCatalogWorkspace(api,()=>{},{storage:{getItem:()=>JSON.stringify(['205','bad']),setItem:(...a)=>writes.push(a)},now:()=>Date.parse('2026-10-07T00:00:00Z')});return {c,calls,writes};}
test('source whole-collection sorting crosses page boundaries and keeps selected owner',async()=>{const {c,calls}=fixture();await c.load();await c.select(1);await c.sort('name');assert.equal(calls.at(-1).limit,0);assert.equal(c.snapshot().result.items[0].NORAD_CAT_ID,205);assert.equal(c.snapshot().selected,1);await c.next();assert.equal(c.snapshot().applied.offset,100);assert.equal(calls.length,2);await c.sort('id');assert.equal(c.snapshot().result.items[0].NORAD_CAT_ID,1);await c.sort('id');assert.equal(c.snapshot().result.items[0].NORAD_CAT_ID,205);c.destroy();});
test('original favorites key persists only explicit toggles; whole-filter includes off-page favorite',async()=>{const {c,calls,writes}=fixture();await c.load();assert.equal(writes.length,0);await c.favoritesOnly(true);assert.equal(calls.at(-1).limit,0);assert.deepEqual(c.snapshot().result.items.map(x=>x.NORAD_CAT_ID),[205]);await c.select(205);c.toggleFavorite();assert.equal(writes[0][0],'spacetwin-orbit-favorites-v1');assert.equal(c.snapshot().result.count,0);assert.equal(c.snapshot().selected,205);c.destroy();});
test('partial full-response cannot claim global sorting and preserves last successful page',async()=>{const {c}=fixture({response:p=>p.limit===0?{source:'celestrak-cache',group:p.group,offset:0,limit:0,items:rows.slice(0,100),count:100,total:205,filtered_total:205,truncated:true}:null});await c.load();await c.sort('id');assert.equal(c.snapshot().result.count,100);assert.equal(c.snapshot().policy.applied,false);assert.match(c.snapshot().error,/응답|전체/);c.destroy();});
test('scope change discards complete collection, then reapplies policy to new verified group response',async()=>{const {c,calls}=fixture();await c.load();await c.sort('id');c.edit('query','draft');await c.next();assert.equal(calls.length,2);await c.search();assert.equal(calls.at(-1).query,'draft');assert.equal(calls.at(-1).limit,0);c.destroy();});
test('original epoch sort keeps unknown last in either direction',async()=>{const {selectCatalog}=await import('../../../user_application/web/scripts/orbit/catalog.js');const items=[{NORAD_CAT_ID:10,OBJECT_NAME:'ISS',EPOCH:null},{NORAD_CAT_ID:2,OBJECT_NAME:'ISS B',EPOCH:'1970-01-01T00:00:00Z'},{NORAD_CAT_ID:4,OBJECT_NAME:'GPS',EPOCH:'1970-01-01T01:00:00Z'}];assert.deepEqual(selectCatalog(items,{sort:'age',direction:'desc',now:7200000}).map(x=>x.NORAD_CAT_ID),[2,4,10]);assert.deepEqual(selectCatalog(items,{sort:'age',now:7200000}).map(x=>x.NORAD_CAT_ID),[4,2,10]);});

test('late whole-collection response cannot publish after new scope search',async()=>{let resolve;const late=new Promise(r=>resolve=r); const calls=[];const owner=createCatalogWorkspace({satelliteGroups:async()=>groups,satellites:async p=>{calls.push(p);if(p.limit===0)return late;const items=rows.slice(0,100);return {source:'celestrak-cache',group:p.group,offset:0,limit:100,items,count:100,total:205,filtered_total:205,truncated:true};}});
 await owner.load();const work=owner.sort('id');owner.edit('query','new');await owner.search();resolve({source:'celestrak-cache',group:'active',offset:0,limit:0,items:rows,count:205,total:205,filtered_total:205,truncated:false});await work;assert.equal(owner.snapshot().applied.query,'new');assert.equal(owner.snapshot().policy.applied,false);assert.equal(owner.snapshot().result.count,100);owner.destroy();
});

test('source catalog policy remains byte-identical to pinned upstream evidence',async()=>{const {readFile}=await import('node:fs/promises');const {createHash}=await import('node:crypto');const bytes=await readFile(new URL('../../../user_application/web/scripts/orbit/catalog.js',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'90f98da034d2e6f8f44c35dc1c980828f177f23af6a8f435b18a9545ecbe4007');});

test('favorite changes preserve fetched scope while unapplied draft remains separate',async()=>{
 const {c,calls}=fixture();await c.load();await c.sort('id');await c.select(1);
 c.edit('query','unsubmitted');c.toggleFavorite();
 assert.equal(c.snapshot().draft.query,'unsubmitted');assert.equal(c.snapshot().applied.query,'');assert.equal(c.snapshot().selected,1);assert.equal(calls.length,2);
 await c.next();assert.equal(c.snapshot().applied.offset,0);
 await c.selectExternal({status:'valid',catalog_number:2,name:'wrong scope'}, {group:'active',query:'unsubmitted',orbit:'all',utc:'2026-10-07T00:00:00Z'});
 assert.equal(c.snapshot().selected,1);c.destroy();
});

test('whole collection reply applies captured request scope despite later draft edit',async()=>{
 let resolve;const late=new Promise(r=>resolve=r);const calls=[];
 const c=createCatalogWorkspace({satelliteGroups:async()=>groups,satellites:async p=>{calls.push({...p});if(p.limit===0)return late;return {source:'celestrak-cache',group:p.group,offset:0,limit:100,items:rows.slice(0,100),count:100,total:205,filtered_total:205,truncated:true};},satelliteProfile:async n=>({source:'gp-cache',catalog:{NORAD_CAT_ID:n}})});
 await c.load();await c.select(1);const work=c.sort('id');c.edit('query','unsubmitted');
 resolve({source:'celestrak-cache',group:'active',offset:0,limit:0,items:rows,count:205,total:205,filtered_total:205,truncated:false});await work;
 assert.equal(c.snapshot().applied.query,calls.at(-1).query);assert.equal(c.snapshot().draft.query,'unsubmitted');assert.equal(c.snapshot().selected,1);
 await c.selectExternal({status:'valid',catalog_number:2,name:'wrong scope'},{group:'active',query:'unsubmitted',orbit:'all',utc:'2026-10-07T00:00:00Z'});
 assert.equal(c.snapshot().selected,1);c.destroy();
});
