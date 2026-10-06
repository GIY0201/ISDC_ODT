import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenarioClock} from '../../../user_application/web/scripts/scenario/clock.js';

test('source forward transport returns the actual owner completion promise', async () => {
  let complete; const calls=[];
  const clock=createScenarioClock({runtime:()=>({started_at:'2026-10-07T00:00:00Z',elapsed_seconds:10,running:false}),control:{advance:n=>{calls.push(n);return new Promise(resolve=>complete=resolve);},refuse:message=>Promise.reject(Error(message))}});
  const pending=clock.step(5);assert.equal(typeof pending.then,'function');complete('advanced');assert.equal(await pending,'advanced');
  const sought=clock.seek(new Date('2026-10-07T00:00:20Z'));assert.equal(typeof sought.then,'function');complete('sought');assert.equal(await sought,'sought');
  assert.deepEqual(calls,[5,10]);await assert.rejects(clock.step(-1),/되감을/);await assert.rejects(clock.seek(new Date('2026-10-07T00:00:00Z')),/되감을/);
});
