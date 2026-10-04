import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../../../communication/browser/api.js';
test('existing HIL paths payloads and optional cancellation preserve old calls',async()=>{
 const old=globalThis.fetch,calls=[],signal=new AbortController().signal;
 try{globalThis.fetch=async(p,o)=>{calls.push([p,o]);return {ok:true,json:async()=>({ok:true})};};
 await api.deviceAction('A','sync',{signal});await api.hilPreflight({signal});await api.hilSequence('fault_recovery',{signal});await api.recording(false,{signal});
 assert.deepEqual(calls.map(x=>x[0]),['/api/hil/device','/api/hil/preflight','/api/hil/sequence','/api/hil/recording']);
 for(const [,o] of calls){assert.equal(o.signal,signal);assert.equal(o.cache,'no-store');}
 assert.deepEqual(JSON.parse(calls[0][1].body),{device_id:'A',action:'sync'});assert.deepEqual(JSON.parse(calls[2][1].body),{sequence_id:'fault_recovery'});assert.deepEqual(JSON.parse(calls[3][1].body),{enabled:false});
 await api.hilSequence();assert.equal(JSON.parse(calls.at(-1)[1].body).sequence_id,'closed_loop');
 globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({detail:'먼저 장비를 연결해야 합니다.'})});await assert.rejects(()=>api.deviceAction('A','sync'),/먼저/);
 }finally{globalThis.fetch=old;}
});
