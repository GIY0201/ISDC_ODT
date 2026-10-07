import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Reuse the existing full renderer/owned proof fixture, with the production
// owner's borrowed frozen historical subtrees instead of fixture-only clones.
const fixtureUrl=new URL('./native_network_sampled_scene.test.mjs',import.meta.url);
let fixtureSource=await readFile(fixtureUrl,'utf8');
fixtureSource=fixtureSource.slice(0,fixtureSource.indexOf("test('"))
 .replace('...structuredClone(original)','...original')
 .replace(/from '([^']+)'/g,(_,path)=>`from '${path.startsWith('.')?new URL(path,fixtureUrl).href:path}'`);
const {fixture,hidden}=await import('data:text/javascript;base64,'+Buffer.from(fixtureSource+'\nexport {fixture,hidden};').toString('base64'));
test('full240 borrowed immutable graph has bounded repeated descriptor work while all native/current owner checks remain fresh',()=>{
 const f=fixture(240,24);f.activate();const lines=[...f.scene.groundLinks.values()].map(e=>e.line),checks=f.checks,geometry=f.geometryReads;
 const original=Object.getOwnPropertyDescriptors;let visits=0;Object.getOwnPropertyDescriptors=value=>{visits++;return original(value);};
 try{for(let i=0;i<8;i++){f.utc=`2026-10-07T00:00:00.${String(600000000+i).padStart(9,'0')}Z`;f.scene.syncFrame(f.utc);}}
 finally{Object.getOwnPropertyDescriptors=original;}
 assert.ok(visits<=16,`fresh wrappers should be checked without rewalking immutable fleet: ${visits}`);
 assert.equal(f.geometryReads-geometry,8*240);assert.ok(f.checks-checks>=8*3);assert.equal(f.scene.groundLinks.size,5760);assert.ok([...f.scene.groundLinks.values()].every(e=>e.line.show));assert.deepEqual([...f.scene.groundLinks.values()].map(e=>e.line),lines);f.scene.destroy();
});
test('new wrapper mutable child and frozen accessor cannot borrow cached deep immutability',()=>{
 const f=fixture();f.activate();const good=f.last;f.scene.sampledNetwork.verify=()=>true;
 f.substitute=Object.freeze({...good,node_definitions:[...good.node_definitions]});f.scene.syncFrame(f.utc);hidden(f);
 let getterCalls=0;const accessor={};Object.defineProperty(accessor,'value',{enumerable:true,get(){getterCalls++;return 1;}});Object.freeze(accessor);
 f.substitute=Object.freeze({...good,additional:accessor});f.scene.syncFrame(f.utc);hidden(f);assert.equal(getterCalls,0);
 f.substitute=Object.freeze({...good,definition_hashes:Object.freeze({...good.definition_hashes,A0:'foreign'})});f.scene.syncFrame(f.utc);hidden(f);f.scene.destroy();
});
test('whole cyclic graph failure cannot memoize a child whose frozen ancestor still contains a mutable descendant',()=>{
 const f=fixture();f.activate();const good=f.last;f.scene.sampledNetwork.verify=()=>true;
 const a={},b={parent:a},mutable=[];a.first=b;a.last=mutable;Object.freeze(a);Object.freeze(b);
 f.substitute=Object.freeze({...good,additional:a});f.scene.syncFrame(f.utc);hidden(f);
 f.substitute=Object.freeze({...good,additional:b});f.scene.syncFrame(f.utc);hidden(f);
 Object.freeze(mutable);f.scene.syncFrame(f.utc);assert.ok([...f.scene.groundLinks.values()].every(e=>e.line.show));f.scene.destroy();
});
test('immutable reuse never memoizes private proof, source/UTC or reentrant revocation',()=>{
 const f=fixture();f.activate();f.revoke();f.scene.syncFrame(f.utc);assert.ok([...f.scene.groundLinks.values()].every(e=>e.line.show));
 f.verifyHook=()=>f.fail();f.scene.syncFrame(f.utc);hidden(f);f.scene.destroy();
 const other=fixture();other.activate();let once=true;other.scene.isTransitioning=()=>{if(once){once=false;other.revoke();}return false;};other.scene.syncFrame(other.utc);hidden(other);other.scene.destroy();
 const drift=fixture();drift.activate();drift.scene.sampledNetwork.verify=()=>true;drift.substitute=Object.freeze({...drift.last,age_seconds:900});drift.scene.syncFrame(drift.utc);hidden(drift);drift.scene.destroy();
});
