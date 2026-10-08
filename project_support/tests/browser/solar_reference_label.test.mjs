import test from 'node:test';
import assert from 'node:assert/strict';
import {solarReferenceTime} from '../../../user_application/web/scripts/tabs/globe_view.js';
test('KST display keeps the same solar instant across midnight without changing UTC',()=>{
 assert.equal(solarReferenceTime('2026-10-08T18:00:00.000000000Z'),'2026-10-09 03:00:00 KST');
 assert.equal(solarReferenceTime('2020-07-12T21:16:01.000416000Z'),'2020-07-13 06:16:01 KST');
});
