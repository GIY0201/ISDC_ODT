import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createModelResolver,objectKind,validateSatelliteManifest} from '../../../digital_twin/model_library/browser/satellite_models.js';
import {describeMatch} from '../../../user_application/web/scripts/orbit/satellite_model_description.js';

const fixture=JSON.parse(await readFile(new URL('../fixtures/original_satellite_models.json',import.meta.url),'utf8'));
const base='/static/assets/models/';
const clone=()=>structuredClone(fixture.manifest);

test('all original mapping records and source golden matches preserve exact ordered behavior',()=>{
 assert.equal(fixture.manifest.models.length,56);assert.equal(new Set(fixture.manifest.models.map(x=>x.file)).size,50);
 const before=JSON.stringify(fixture.manifest),resolve=createModelResolver(fixture.manifest,base);
 for(const c of fixture.cases)assert.deepEqual(resolve(c.input,c.catalog),c.expected,JSON.stringify(c.input));
 assert.equal(JSON.stringify(fixture.manifest),before);
});

test('assigned overrides exclusion, exact precedes series/family, first source rule wins, no-model stays explicit',()=>{
 const m=clone();const a=m.models[0];
 a.exact={norad:[999001],names:['^KNOWN$']};a.series={norad:[999002],names:[]};a.family={names:['^FAMILY']};
 m.models[1].exact={norad:[999001],names:['^KNOWN$']};
 const resolve=createModelResolver(m,base);
 assert.equal(resolve({NORAD_CAT_ID:999001,OBJECT_NAME:'KNOWN'}).key,a.key);
 assert.equal(resolve({NORAD_CAT_ID:999002,OBJECT_NAME:'UNKNOWN'}).quality,'series');
 assert.equal(resolve({NORAD_CAT_ID:999003,OBJECT_NAME:'FAMILY A'}).quality,'representative');
 assert.equal(resolve({OBJECT_NAME:'X DEB',model_key:a.key}).quality,'assigned');
 assert.equal(resolve({OBJECT_NAME:'X DEB'}),null);assert.equal(resolve({OBJECT_NAME:'X R/B'}),null);
 assert.equal(objectKind({OBJECT_NAME:'UNKNOWN'},{OBJECT_TYPE:'DEB'}),'debris');
 assert.equal(createModelResolver({models:[]})({}),null);
 const legacy=createModelResolver({source:{credit:'Original source',repository:'https://example.test'},models:[a],representatives:{'payload:LEO':a.key}},base);
 assert.equal(legacy({}).credit,'Original source');
});

test('resolver owns definition copies and results cannot modify source orientation or later matches',()=>{
 const m=clone(),a=m.models[0],key=a.key,scale=a.size_m/a.extent;
 const resolve=createModelResolver(m,base);const item={model_key:key,OBJECT_NAME:'ASSIGNED'};
 const first=resolve(item);first.orientation.heading=999;first.title='changed';
 a.orientation.heading=77;a.title='mutated input';a.size_m=1;m.models.length=0;
 const next=resolve(item);assert.equal(next.orientation.heading,0);assert.equal(next.scale,scale);assert.notEqual(next.title,'changed');assert.notEqual(next.title,'mutated input');
 const unmeasured=createModelResolver({models:[{key:'unknown',file:'unknown.glb',size_m:0,extent:0}],representatives:{'payload:LEO':'unknown'}});
 assert.equal(unmeasured({}).scale,1);assert.equal(unmeasured({}).sizeMeters,null);
});

test('strict loaded schema normalizes garbled presentation while preserving immutable originals and valid mapping',()=>{
 const raw=clone(),intactLabel=raw.models.find(x=>x.key==='iss').label;
 raw.models.find(x=>x.key==='terra').label='\uFFFD missing label';
 const before=JSON.stringify(raw),v=validateSatelliteManifest(raw);
 assert.equal(v.schema,2);assert.equal(v.models.length,56);assert.equal(JSON.stringify(raw),before);
 assert.equal(v.sources.spacetwin.credit,'SpaceTwin 자체 제작');
 assert.equal(v.models.find(x=>x.key==='iss').label,intactLabel);
 assert.equal(v.models.find(x=>x.key==='terra').label,'Terra');
 assert.ok(v.presentation_repairs.some(x=>x.path==='models.terra.label'));
 v.models[0].orientation.heading=98;assert.equal(raw.models[0].orientation.heading,0);
});

test('invalid paths, schema, duplicate keys, references, rules, provider links and asset hashes fail explicitly',()=>{
 const invalid=[
 m=>m.schema=1,m=>m.models=[],m=>m.models=Array.from({length:513},()=>m.models[0]),
 m=>m.models[1].key=m.models[0].key,m=>m.models[0].key='bad/key',
 ...['../x.glb','x\\y.glb','/x.glb','https://example.test/x.glb','x.glb?x','%2e.glb','x.jpg'].map(path=>m=>m.models[0].file=path),
 m=>m.models[0].thumbnail='x.glb',m=>m.models[0].provider='missing',m=>m.representatives.station='missing',
 m=>m.models[0].exact.names=['['],m=>m.models[0].exact.names=['a'.repeat(257)],
 m=>m.sources.nasa.repository='javascript:alert(1)',m=>m.sources.nasa.credit='',
 m=>m.models[0].sha256='bad',m=>m.models[0].bytes=0,m=>m.models[0].orientation.pitch=Infinity,
 ];
 for(const change of invalid){const m=clone();change(m);assert.throws(()=>validateSatelliteManifest(m));}
 assert.throws(()=>validateSatelliteManifest(null));
});

test('descriptions distinguish assigned/exact/series/representative, synthetic credit and display attitude',()=>{
 const resolve=createModelResolver(validateSatelliteManifest(clone()),base);
 const iss=describeMatch(resolve({NORAD_CAT_ID:25544,OBJECT_NAME:'ISS (ZARYA)'}));
 assert.equal(iss.state,'3D 모델 (해당 기체)');assert.match(iss.note,/현재 자세가 아닙니다/);assert.match(iss.note,/109 m/);
 assert.equal(describeMatch(resolve({model_key:'iss',OBJECT_NAME:'ASSIGNED'})).state,'사용자 지정 모델');
 assert.equal(describeMatch(resolve({NORAD_CAT_ID:49260,OBJECT_NAME:'LANDSAT 9'})).state,'동일 계열 모델');
 const generic=describeMatch(resolve({OBJECT_NAME:'STARLINK-12345'}));assert.equal(generic.state,'자체 제작 대표 형상');assert.match(generic.note,/제조사 형상이 아니며/);
 assert.equal(describeMatch(null).state,'미배정');
});
