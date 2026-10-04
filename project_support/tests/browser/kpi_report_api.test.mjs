import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../../../communication/browser/api.js';
test('report transport keeps original bytes, paths, MIME, cancellation and errors',async()=>{
 const original=globalThis.fetch;const calls=[],bytes=new Uint8Array([239,187,191,65]);const signal=new AbortController().signal;
 try{globalThis.fetch=async(path,options)=>{calls.push({path,options});return {ok:true,headers:new Headers({'Content-Type':path.endsWith('.csv')?'text/csv; charset=utf-8':'application/json'}),arrayBuffer:async()=>bytes.buffer};};
 const r=await api.report('csv',{signal});assert.equal(calls[0].path,'/api/reports/summary.csv');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.signal,signal);assert.deepEqual(r.bytes,bytes);assert.equal(r.filename,'spacetwin-report.csv');
 await api.report('json');assert.equal(calls[1].path,'/api/reports/snapshot.json');await assert.rejects(()=>api.report('other'));
 globalThis.fetch=async()=>({ok:false,status:503});await assert.rejects(()=>api.report('json'),/503/);
 globalThis.fetch=async()=>({ok:true,headers:new Headers({'Content-Type':'text/html'})});await assert.rejects(()=>api.report('json'),/형식/);
 globalThis.fetch=async()=>{throw new DOMException('aborted','AbortError');};await assert.rejects(()=>api.report('json'),{name:'AbortError'});
 }finally{globalThis.fetch=original;}
});
