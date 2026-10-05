import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as definition from '../../../digital_twin/simulation/browser/node_orbit_definition.js';

const fixture=JSON.parse(await readFile(new URL('../fixtures/original_satellite_nodes.json',import.meta.url),'utf8'));
test('static orbital definitions preserve every original element and reject original invalid domains',()=>{
 for(const c of fixture.cases.filter(x=>x.id.startsWith('elements:')||x.id.startsWith('invalid-orbit:'))){
  assert.deepEqual(JSON.parse(JSON.stringify(definition.orbitElements(c.input.orbit))),c.expected,c.id);
 }
});
test('edited definitions do not reuse stale elements; missing epoch and nonfinite values are invalid',()=>{
 const orbit=structuredClone(fixture.cases.find(x=>x.id==='elements:0').input.orbit);
 const initial=definition.orbitElements(orbit);orbit.altitude_km=800;
 assert.notEqual(definition.orbitElements(orbit).a,initial.a);
 for(const key of ['altitude_km','eccentricity','inclination','raan','argp','mean_anomaly','epoch']){
  const bad={...orbit,[key]:Infinity};assert.equal(definition.orbitElements(bad),null,key);
 }
 delete orbit.epoch;assert.equal(definition.orbitElements(orbit),null);
});
test('browser orbital helper has no time propagation or guessed Sun/frame conversion',()=>{
 for(const name of ['nodeStateAt','nodePositionAt','inertialStateAt','sunDirectionAt','gmst','fixedFromInertial'])assert.equal(definition[name],undefined,name);
});
test('explicit epoch validation rejects invalid calendar rollovers, timezone guesses and leap collapse',()=>{
 for(const value of ['2026-02-30T12:00:00Z','2026-01-01T24:00:00Z','2026-01-01T12:00:00','2016-12-31T23:59:60Z'])assert.equal(definition.epochMillis(value),null,value);
 assert.equal(definition.epochMillis('2026-10-04T22:01:12.000Z'),fixture.evidence.epoch);
});
