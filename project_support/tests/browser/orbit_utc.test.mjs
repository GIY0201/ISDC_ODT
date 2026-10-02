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
