import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile(new URL('../fixtures/original_satellite_nodes.json',import.meta.url),'utf8'));
const norm=a=>Math.hypot(...a),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

test('original node golden covers every preset, mode, link policy and explicitly bounded source frames',()=>{
 assert.equal(fixture.source.commit,'1a1e00297a0301637455b0ef2cf48b2e74576b07');
 assert.equal(fixture.source.files.length,2);assert.equal(fixture.cases.length,91);
 assert.equal(new Set(fixture.cases.map(x=>x.id)).size,91);
 assert.equal(Object.keys(fixture.definitions.BUS_PRESETS).length,5);
 assert.equal(Object.keys(fixture.definitions.EQUIPMENT_CATALOG).length,9);
 assert.equal(fixture.cases.filter(x=>x.id.startsWith('power:')).length,30);
 assert.equal(fixture.cases.filter(x=>x.id.startsWith('formation:')).length,12);
 assert.equal(fixture.cases.filter(x=>x.id.startsWith('state:')).length,20);
 assert.match(fixture.evidence.frame,/GMST-only/);assert.match(fixture.evidence.meaning,/not independent/);
 assert.equal(fixture.cases.find(x=>x.id==='known-source-gap:infinite-power').expected.acceptsInfinity,true);
 for(const c of fixture.cases.filter(x=>x.id.startsWith('invalid-orbit:')))assert.equal(c.expected,null,c.id);
});

test('source state receipts respect units, rotations and LVLH orthogonality without asserting ephemeris accuracy',()=>{
 for(const c of fixture.cases.filter(x=>x.id.startsWith('state:'))){
  const s=c.expected;
  assert.ok(Math.abs(norm(s.inertial.r)-s.radius)<1e-9,c.id);
  assert.ok(Math.abs(norm(s.fixed.r)-s.radius)<1e-9,c.id);
  assert.ok(Math.abs(norm(s.sunDirection)-1)<1e-12,c.id);
  for(const axis of Object.values(s.basis))assert.ok(Math.abs(norm(axis)-1)<1e-12,c.id);
  assert.ok(Math.abs(dot(s.basis.x,s.basis.y))<1e-12,c.id);
  assert.ok(Math.abs(dot(s.basis.z,s.basis.x))<1e-12,c.id);
  assert.ok(Math.abs(dot(s.basis.y,s.basis.z))<1e-12,c.id);
  assert.ok(Math.abs(norm(s.inertial.v)-s.geodetic.velocity)<1e-12,c.id);
  assert.ok(s.geodetic.latitude>=-90&&s.geodetic.latitude<=90,c.id);
  assert.ok(s.geodetic.longitude>=-180&&s.geodetic.longitude<=180,c.id);
 }
});

test('formation receipts preserve count, unique ids, phase wrap and original disabled link roles',()=>{
 for(const c of fixture.cases.filter(x=>x.id.startsWith('formation:'))){
  const {normalized:p,summary,nodes}=c.expected;
  assert.equal(nodes.length,p.planes*p.per_plane,c.id);assert.equal(summary.total,nodes.length,c.id);
  assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length,c.id);
  assert.equal(new Set(nodes.map(n=>n.catalog_number)).size,nodes.length,c.id);
  if(p.preset==='walker_star')assert.equal(p.raan_spread,180,c.id);
  if(p.preset==='single')assert.equal(nodes.length,1,c.id);
  if(p.preset==='train')assert.equal(p.planes,1,c.id);
  const allowed=fixture.definitions.LINK_POLICIES[p.link_policy].roles;
  for(const n of nodes){
   assert.ok(n.orbit.raan>=0&&n.orbit.raan<360,c.id);assert.ok(n.orbit.mean_anomaly>=0&&n.orbit.mean_anomaly<360,c.id);
   for(const item of n.equipment)if(fixture.definitions.EQUIPMENT_CATALOG[item.catalog].kind==='oisl')assert.equal(item.enabled,allowed.includes(item.role),c.id);
  }
 }
});
