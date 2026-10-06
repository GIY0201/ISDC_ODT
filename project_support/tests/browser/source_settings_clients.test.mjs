import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDataFabricClient} from '../../../communication/browser/data_fabric.js';
import {createSourceSettingsController} from '../../../user_application/web/scripts/settings/controller.js';
import {LINKS,resolveLink,STORAGE_KEY} from '../../../user_application/web/scripts/settings/topology.js';
const orchestrationSource=(await readFile(new URL('../../../communication/browser/orchestration.js',import.meta.url),'utf8')).replace('"/static/communication/data_fabric.js"',JSON.stringify(new URL('../../../communication/browser/data_fabric.js',import.meta.url).href));
const {createOrchestrationClient}=await import(`data:text/javascript;base64,${Buffer.from(orchestrationSource).toString('base64')}`);
test('explicit V6 setting save retargets existing actual ICD-02/03 clients without recreating them',async()=>{
 const records=new Map(),requests=[],storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
 const fetchImpl=async(url,options)=>{requests.push({url,options});return{ok:true,status:200,json:async()=>({reachable:true,implementation:'remote-test'})};};
 const fabric=createDataFabricClient({storage,fetchImpl}),missions=createOrchestrationClient({storage,fetchImpl});
 const settings=createSourceSettingsController({storage,probe:()=>{throw Error('not authorized');}});settings.load();
 assert.deepEqual(fabric.endpoint(),{base:'',placement:'server',source:'server'});assert.deepEqual(missions.endpoint(),{base:'',placement:'server',source:'server'});
 for(const [id,host,port] of [['L02','fabric.example.test',7402],['L03','missions.example.test',7403]])settings.editLink(id,{...resolveLink(LINKS.find(l=>l.id===id)),transport:'TCP',host,port});
 assert.equal(records.has(STORAGE_KEY),false);await fabric.status();await missions.status();assert.deepEqual(requests.map(r=>r.url),['/api/data-fabric/status','/api/orchestration/status']);
 settings.save();await fabric.status();await missions.status();assert.deepEqual(requests.slice(-2).map(r=>r.url),['http://fabric.example.test:7402/api/data-fabric/status','http://missions.example.test:7403/api/orchestration/status']);
 settings.editLink('L02',{...resolveLink(LINKS.find(l=>l.id==='L02'),settings.snapshot().settings.links),host:'next.example.test'});await fabric.status();assert.match(requests.at(-1).url,/fabric\.example\.test/);settings.save();await fabric.status();assert.match(requests.at(-1).url,/next\.example\.test/);
 assert.ok(requests.every(r=>r.options.cache==='no-store'));
});
test('source configured transport does not pretend the browser uses native UDP or gRPC',async()=>{
 const records=new Map(),storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)},urls=[];
 const settings=createSourceSettingsController({storage,probe:()=>null});settings.load();settings.editLink('L02',{...resolveLink(LINKS.find(l=>l.id==='L02')),transport:'UDP',host:'fabric.example.test',port:7402});settings.save();
 const client=createDataFabricClient({storage,fetchImpl:async url=>{urls.push(url);return{ok:true,status:200,json:async()=>({reachable:true})};}});await client.status();assert.equal(urls[0],'http://fabric.example.test:7402/api/data-fabric/status');
});
