import test from 'node:test';
import assert from 'node:assert/strict';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256);
test('UTC codec preserves nanoseconds and crosses positive leap seconds in TAI seconds',()=>{
  assert.equal(codec.advance('2020-07-12T21:16:01.000416000Z',1.25),'2020-07-12T21:16:02.250416000Z');
  assert.equal(codec.advance('2016-12-31T23:59:59.123456789Z',1),'2016-12-31T23:59:60.123456789Z');
  assert.equal(codec.advance('2016-12-31T23:59:59.123456789Z',2),'2017-01-01T00:00:00.123456789Z');
  assert.equal(codec.difference('2017-01-01T00:00:00Z','2016-12-31T23:59:59Z'),2);
});
test('mismatched leap provenance and invalid dates or leap seconds are rejected',()=>{
  assert.throws(()=>createUtcCodec('other'),/hash/);
  for(const utc of ['2020-02-30T00:00:00Z','2020-07-12T23:59:60Z','2020-07-12T21:16:01','1960-01-01T00:00:00Z'])assert.throws(()=>codec.advance(utc,0));
});
test('repeated exact UTC queries reuse validated instants without changing leap arithmetic or invalid-input rejection',()=>{
  const original=Date.UTC;let parses=0;
  Date.UTC=(...args)=>{parses++;return original(...args);};
  try{
    const local=createUtcCodec(LEAP_SHA256),start='2016-12-31T23:59:59.123456789Z';
    for(let i=0;i<240;i++){
      assert.equal(local.advance(start,0),start);
      assert.equal(local.difference(start,start),0);
    }
    assert.equal(parses,1,'a repeated 240-node display instant is validated once');
    assert.equal(local.advance(start,1),'2016-12-31T23:59:60.123456789Z');
    assert.equal(local.advance(start,2),'2017-01-01T00:00:00.123456789Z');
    assert.equal(local.difference(local.advance(start,2),start),2);
    for(let i=0;i<2;i++)assert.throws(()=>local.advance('2016-12-30T23:59:60Z',0),/invalid UTC leap second/);
    assert.throws(()=>local.advance(start,NaN),/finite elapsed/);
    assert.throws(()=>local.advance({toString:()=>start},0),/explicit UTC/);
    for(let i=0;i<300;i++)assert.equal(local.difference(local.advance(start,i),start),i);
    assert.equal(local.advance(start,0),start,'eviction never changes validation or precision');
    assert.throws(()=>createUtcCodec('other'),/hash/);
  }finally{Date.UTC=original;}
});
test('formatted output beyond the supported four-digit input year cannot bypass parsing through cache history',()=>{
  const local=createUtcCodec(LEAP_SHA256),other=createUtcCodec(LEAP_SHA256);
  const outside=local.advance('9999-12-31T23:59:59Z',1);
  assert.equal(outside.startsWith('+010000'),true,'preserve existing formatting at the output boundary');
  for(const c of [local,other]){
    assert.throws(()=>c.advance(outside,0),/explicit UTC required/);
    assert.throws(()=>c.difference(outside,outside),/explicit UTC required/);
  }
});
