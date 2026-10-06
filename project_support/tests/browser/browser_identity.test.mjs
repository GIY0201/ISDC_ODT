import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../../../user_application/web/scripts/browser_identity.js');

test('browser IDs use native UUID with its crypto receiver when available',async()=>{
 const {createBrowserId}=await load();const crypto={randomUUID(){assert.equal(this,crypto);return 'native';},getRandomValues(){throw Error('unused');}};
 assert.equal(createBrowserId(crypto),'native');
});
test('browser IDs use cryptographic bytes with UUID v4 version/variant when native UUID is absent',async()=>{
 const {createBrowserId}=await load();let calls=0;const crypto={getRandomValues(bytes){calls++;assert.equal(bytes.length,16);bytes.set(Array.from({length:16},(_,i)=>i));return bytes;}};
 assert.equal(createBrowserId(crypto),'00010203-0405-4607-8809-0a0b0c0d0e0f');assert.equal(calls,1);
});
test('missing randomness fails explicitly without time or Math.random identifiers',async()=>{
 const {createBrowserId}=await load();assert.throws(()=>createBrowserId({}),/식별자/);assert.throws(()=>createBrowserId(null),/식별자/);
});
