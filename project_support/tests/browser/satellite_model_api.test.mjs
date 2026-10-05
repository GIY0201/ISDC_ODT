import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../../../communication/browser/api.js';
test('static model manifest uses fixed package path, no-store and caller cancellation; HTTP failure is visible',async()=>{
 const previous=globalThis.fetch,calls=[],abort=new AbortController();
 try{
 globalThis.fetch=async(path,options)=>(calls.push([path,options]),{ok:true,json:async()=>({schema:2})});
 assert.deepEqual(await api.satelliteModelManifest({signal:abort.signal}),{schema:2});assert.equal(calls[0][0],'/static/satellite_display/manifest.json');assert.equal(calls[0][1].cache,'no-store');assert.equal(calls[0][1].signal,abort.signal);assert.equal(calls[0][1].method,undefined);
 globalThis.fetch=async()=>({ok:false,status:404,json:async()=>({})});await assert.rejects(api.satelliteModelManifest(),/404/);
 }finally{globalThis.fetch=previous;}
});
