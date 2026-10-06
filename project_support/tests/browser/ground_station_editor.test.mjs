import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGroundStationEditorTools} from '../../../user_application/web/scripts/tabs/ground_station_editor.js';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
test('station editor preserves hash-captured original function body with injected dependencies',async()=>{
 const captured=JSON.parse(await readFile(new URL('../fixtures/original_ground_station_editor.json',import.meta.url),'utf8'));
 const tools=createGroundStationEditorTools({model,escape:value=>String(value)});
 assert.equal(tools.stationEditorMarkup.toString().replace(/\r\n/g,'\n'),captured.function_body.replace(/\r\n/g,'\n'));
 const station=model.createStation({name:'source',latitude:35,longitude:127},1);
 const original=tools.stationEditorMarkup(station),mounted=tools.markup(station);
 assert.equal(mounted.replace(/ id="ground-node-[^"]+"/g,''),original);
 for(const id of ['name','latitude','longitude','altitude_km','dish_m','min_elevation_deg','enabled','band-S','band-X','band-Ka','save','cancel','remove'])assert.match(mounted,new RegExp(`id="ground-node-${id}"`));
});
