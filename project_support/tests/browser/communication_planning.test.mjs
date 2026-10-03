import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommunicationPlanning,routeMarkup,contactsMarkup} from '../../../user_application/web/scripts/tabs/communication_planning.js';
import {api} from '../../../communication/browser/api.js';
export const graph={nodes:[{id:'A',type:'satellite'},{id:'B',type:'ground'}],links:[{id:'L',source:'A',target:'B',quality:90,protocol:'DTN'}]};
export const route=(source='A',target='B',objective='balanced')=>({source,target,objective,path:[source,target],link_ids:['L'],hops:1,cost:20,status:'available',active_fault_targets:[]});
export const contacts=hours=>({hours,count:1,provenance:'scenario-contact-plan-v1',items:[{id:'C',link_id:'L',source:'A',target:'B',start:'2026-10-04T00:00:00Z',end:'2026-10-04T00:05:00Z',duration_minutes:5,quality:90,capacity_mb:10,provenance:'scenario-contact-plan-v1'}]});
const service={bootstrap:async()=>({communication:graph}),route:async(s,t,o)=>route(s,t,o),contacts:async h=>contacts(h)};
test('server graph drives choices; independent route/contacts results and drafts are owned copies',async()=>{
 const c=createCommunicationPlanning(service);await c.load();c.setDraft({source:'A',target:'B'});await c.route();await c.contacts();assert.equal(c.snapshot().route.result.cost,20);assert.equal(c.snapshot().contacts.result.count,1);
 c.setDraft({objective:'latency'});assert.equal(c.snapshot().route.result,null);assert.ok(c.snapshot().contacts.result);c.setDraft({hours:'2'});assert.equal(c.snapshot().contacts.result,null);
 const copy=c.snapshot();copy.network.nodes[0].id='changed';assert.equal(c.snapshot().network.nodes[0].id,'A');c.destroy();
});
test('late requests after edits/reloads/destroy cannot restore stale results',async()=>{
 const waits=[];const c=createCommunicationPlanning({...service,route:(s,t,o,{signal})=>new Promise(resolve=>waits.push({resolve,signal,s,t,o}))});await c.load();c.setDraft({source:'A',target:'B'});const first=c.route();c.setDraft({objective:'latency'});const second=c.route();assert.equal(waits[0].signal.aborted,true);waits[1].resolve(route('A','B','latency'));await second;waits[0].resolve(route());await first;assert.equal(c.snapshot().route.result.objective,'latency');
 const third=c.route();c.destroy();waits[2].resolve(route('A','B','latency'));await third;assert.equal(c.snapshot().route.result,null);
});
test('input boundaries and malformed replies cannot masquerade as successful plans',async()=>{
 let queries=0;const c=createCommunicationPlanning({...service,contacts:async h=>{queries++;return {...contacts(h),provenance:'actual-reception'};}});await c.load();
 for(const hours of ['','0','73','1.5','Infinity']){c.setDraft({hours});await c.contacts();assert.equal(c.snapshot().contacts.status,'error');}assert.equal(queries,0);
 c.setDraft({hours:'12'});await c.contacts();assert.equal(c.snapshot().contacts.status,'error');
 c.setDraft({source:'UNKNOWN',target:'B'});await c.route();assert.equal(c.snapshot().route.status,'error');c.destroy();
});
test('network errors and unavailable/empty results remain distinct',async()=>{
 const c=createCommunicationPlanning({...service,route:async(s,t,o)=>({source:s,target:t,objective:o,path:[],link_ids:[],hops:0,cost:null,status:'unavailable',active_fault_targets:['B']}),contacts:async h=>({hours:h,count:0,items:[],provenance:'scenario-contact-plan-v1'})});await c.load();c.setDraft({source:'A',target:'B'});await c.route();await c.contacts();assert.match(routeMarkup(c.snapshot().route),/경로 없음/);assert.match(contactsMarkup(c.snapshot().contacts),/일정 없음/);c.destroy();
 const bad=createCommunicationPlanning({bootstrap:async()=>{throw Error('offline');}});await bad.load();assert.equal(bad.snapshot().networkStatus,'error');assert.equal(bad.snapshot().network,null);bad.destroy();
});
test('contact cancellation, independent edits and network reload fence pending replies',async()=>{
 const waits=[];const c=createCommunicationPlanning({...service,contacts:(h,{signal})=>new Promise(resolve=>waits.push({h,signal,resolve}))});await c.load();c.setDraft({source:'A',target:'B'});await c.route();
 const first=c.contacts();c.setDraft({hours:'1'});assert.equal(waits[0].signal.aborted,true);const second=c.contacts();waits[1].resolve(contacts(1));await second;waits[0].resolve(contacts(12));await first;assert.equal(c.snapshot().contacts.result.hours,1);assert.ok(c.snapshot().route.result);
 const third=c.contacts();await c.load();waits[2].resolve(contacts(1));await third;assert.equal(c.snapshot().contacts.result,null);assert.equal(c.snapshot().route.result,null);
 const fourth=c.contacts();c.cancel('contacts');waits[3].resolve(contacts(1));await fourth;assert.equal(c.snapshot().contacts.status,'idle');c.destroy();
});
test('malformed graph, echoed route and invalid contact UTC/count/link fail closed',async()=>{
 for(const network of [{nodes:[...graph.nodes,graph.nodes[0]],links:graph.links},{nodes:graph.nodes,links:[{...graph.links[0],source:'UNKNOWN'}]}]){const c=createCommunicationPlanning({...service,bootstrap:async()=>({communication:network})});await c.load();assert.equal(c.snapshot().networkStatus,'error');assert.equal(c.snapshot().network,null);c.destroy();}
 for(const bad of [{...route(),objective:'latency'},{...route(),link_ids:['missing']},{...route(),hops:2},{...route(),cost:Infinity}]){const c=createCommunicationPlanning({...service,route:async()=>bad});await c.load();c.setDraft({source:'A',target:'B'});await c.route();assert.equal(c.snapshot().route.status,'error');c.destroy();}
 for(const patch of [{count:2},{hours:1},{items:[{...contacts(12).items[0],end:'2026-10-04T00:01:00Z'}]},{items:[{...contacts(12).items[0],link_id:'missing'}]}]){const c=createCommunicationPlanning({...service,contacts:async()=>({...contacts(12),...patch})});await c.load();await c.contacts();assert.equal(c.snapshot().contacts.status,'error');c.destroy();}
});
test('zero-hop route and all contact rows are retained; server text is escaped',async()=>{
 const c=createCommunicationPlanning({...service,route:async(s,t,o)=>({source:s,target:t,objective:o,path:[s],link_ids:[],hops:0,cost:0,status:'available',active_fault_targets:['<img src=x onerror=bad()>']})});await c.load();c.setDraft({source:'A',target:'A'});await c.route();assert.equal(c.snapshot().route.status,'ready');assert.match(routeMarkup(c.snapshot().route),/&lt;img/);assert.doesNotMatch(routeMarkup(c.snapshot().route),/<img/);
 const r=contacts(12);r.items=Array.from({length:30},(_,i)=>({...r.items[0],id:String(i)}));r.count=30;assert.equal((contactsMarkup({result:r,queriedUtc:'now'}).match(/<tr>/g)||[]).length,31);c.destroy();
});
test('existing transport methods accept abort without changing routes or request payloads',async()=>{
 const old=globalThis.fetch,seen=[],abort=new AbortController();globalThis.fetch=async(path,options)=>{seen.push({path,options});return {ok:true,json:async()=>({})};};try{await api.bootstrap({signal:abort.signal});await api.route('A','B','latency',{signal:abort.signal});await api.contacts(72,{signal:abort.signal});assert.ok(seen.every(x=>x.options.signal===abort.signal&&x.options.cache==='no-store'));assert.equal(seen[1].path,'/api/communication/route');assert.deepEqual(JSON.parse(seen[1].options.body),{source:'A',target:'B',objective:'latency'});assert.equal(seen[2].path,'/api/communication/contacts?hours=72');}finally{globalThis.fetch=old;}
});
