import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnalysisTransport} from '../../../user_application/web/scripts/scenario/analysis_transport.js';

test('followed transport delegates actual source capability and never independent owner',async()=>{
 const calls=[],source={play:async()=>calls.push('source-play'),pause:async()=>calls.push('source-pause'),setSpeed:async n=>calls.push(['source-speed',n]),step:async n=>calls.push(['source-step',n])};
 const transport=createAnalysisTransport({follow:{source:()=>source,locked:()=>true},independent:{play:()=>calls.push('independent'),seek:()=>calls.push('independent')}});
 await transport.run('play');await transport.run('pause');await transport.run('speed',120);await transport.run('step',1);
 assert.deepEqual(calls,['source-play','source-pause',['source-speed',120],['source-step',1]]);
 await assert.rejects(transport.run('seek','2026-10-07T00:00:00Z'),/해제/);await assert.rejects(transport.run('epoch'),/해제/);await assert.rejects(transport.run('live'),/해제/);
 assert.equal(calls.length,4);
});
test('pending follow cannot fall back and detached transport retains existing owner semantics',async()=>{
 let source=null,locked=true;const calls=[];const transport=createAnalysisTransport({follow:{source:()=>source,locked:()=>locked},independent:{play:()=>calls.push('independent'),speed:n=>calls.push(n)}});
 await assert.rejects(transport.run('play'),/검증/);assert.deepEqual(calls,[]);locked=false;await transport.run('play');await transport.run('speed',10);assert.deepEqual(calls,['independent',10]);
});
test('explicit observer/source edit invalidates follow before independent mutation and missing port fails clear',()=>{
 const calls=[],transport=createAnalysisTransport({follow:{source:()=>({}),locked:()=>true,invalidate:reason=>calls.push(['invalidate',reason])}});
 transport.invalidate('station changed');calls.push('observer');assert.deepEqual(calls,[['invalidate','station changed'],'observer']);
 assert.throws(()=>createAnalysisTransport({follow:{source:()=>({}),locked:()=>true}}).invalidate('station'),/해제/);
});

test('alignment in flight cannot advance source while its native proof is awaiting',async()=>{const calls=[],transport=createAnalysisTransport({follow:{source:()=>({play:()=>calls.push('source')}),locked:()=>true,pending:()=>true}});await assert.rejects(transport.run('play'),/검증/);assert.deepEqual(calls,[]);});
