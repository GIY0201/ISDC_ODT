import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceConfigurationStorage} from '../../../user_application/web/scripts/workspace_configuration.js';
test('server configuration restores across browser instances and preserves local import backup',async()=>{
 const db=new Map(),local=new Map([['spacetwin-ground-stations-v1',JSON.stringify({schema:1,sequence:0,selectedId:null,stations:[]})]]);
 const fetchImpl=async(url,options={})=>{if(url.endsWith('/status'))return {ok:true,json:async()=>({enabled:true})};const kind=url.split('/').at(-1);if(options.method==='PUT'){const b=JSON.parse(options.body),old=db.get(kind)??{revision:0};if(old.revision!==b.expected_revision)return {ok:false,status:409,json:async()=>({detail:'conflict'})};db.set(kind,{kind,revision:old.revision+1,value:b.value});}return {ok:true,json:async()=>db.get(kind)??{kind,revision:0,value:null}};};
 const port={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)};
 const a=createWorkspaceConfigurationStorage({storage:port,fetchImpl});await a.start();assert.equal(a.snapshot().state,'saved');assert.ok(local.has('spacetwin-ground-stations-v1.before-postgresql'));
 a.setItem('spacetwin-ground-stations-v1',JSON.stringify({schema:1,sequence:1,selectedId:null,stations:[]}));assert.equal(a.snapshot().state,'saving');await a.flush();assert.equal(db.get('ground_stations').value.sequence,1);
 const other=new Map(),b=createWorkspaceConfigurationStorage({storage:{getItem:k=>other.get(k)??null,setItem:(k,v)=>other.set(k,v)},fetchImpl});await b.start();assert.equal(JSON.parse(b.getItem('spacetwin-ground-stations-v1')).sequence,1);
 a.setItem('spacetwin-ground-stations-v1',JSON.stringify({schema:1,sequence:2,selectedId:null,stations:[]}));await a.flush();b.setItem('spacetwin-ground-stations-v1',JSON.stringify({schema:1,sequence:3,selectedId:null,stations:[]}));await b.flush();assert.equal(b.snapshot().state,'error');assert.equal(db.get('ground_stations').value.sequence,2);assert.equal(JSON.parse(b.getItem('spacetwin-ground-stations-v1')).sequence,3);
});
