import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('satellite presentation names physical models and reference frames without implementation language',async()=>{
 const read=name=>readFile(new URL('../../../user_application/web/scripts/'+name,import.meta.url),'utf8');
 for(const name of ['orbit/station_card_projection.js','orbit/inspector_policy.js','workspace_nodes.js','tabs/catalog_passes.js','tabs/catalog_scene.js','tabs/catalog_time.js','tabs/catalog_workspace.js','tabs/orbit_radio.js'])assert.doesNotMatch(await read(name),/Rust/);
 assert.match(await read('orbit/inspector_policy.js'),/TEME 속력과 WGS84 좌표 변환/);assert.match(await read('tabs/catalog_passes.js'),/SGP4 궤도 모델과 IERS-A/);assert.match(await read('tabs/orbit_radio.js'),/SGP4 궤도 \+ 상대속도 모델/);
});
