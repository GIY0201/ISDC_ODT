import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
for(const [width,height] of [[1280,720],[1920,1080]])test(`explicit source-native contact query and stale/cancel fences ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#ground'});let panel;
 try{const store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');let valid=true,calls=0,release=null;const stations=store.enabled,bundle={accepted_context:{utc:'2026-10-07T00:00:00.000000000Z',context_hash:'a'.repeat(64)},node_definitions:[{id:'A',name:'A<script>'}],conditions:{end_utc:'2026-10-07T03:00:00.000000000Z'},contact_reports:stations.map((s,i)=>({station_id:s.id,geometry:{minimum_elevation_deg:s.min_elevation_deg,coverage:{resolution_seconds:30},passes:i?[]:[{satellite:'A',start:'2026-10-07T01:00:00.000000000Z',end:'2026-10-07T01:02:00.000000000Z',max_elevation_deg:45,duration_seconds:120,in_progress:false,truncated:true}]}}))};
 const contactWindows={query:async({hours,signal})=>{calls++;assert.equal(hours,3);if(release)return await new Promise(resolve=>{release=()=>resolve(structuredClone(bundle));});return structuredClone(bundle);},verify:()=>valid};
 panel=createGroundNetworkPanel({store,model,network:{networkSnapshot:()=>null,verifyNetworkSnapshot:()=>false,clearNetwork(){}},contactWindows,document:f.doc,host:f.win,refreshRuntime:async()=>{}});panel.show('ground');assert.equal(calls,0);
 await f.get('ground-node-pass-query').dispatch('click');assert.equal(calls,1);assert.match(f.get('ground-node-pass-results').innerHTML,/A&lt;script&gt;.*45.*120.*잘림/s);assert.match(f.get('ground-node-pass-status').textContent,/30.*모의|모의.*30/);
 f.get('ground-node-pass-station').value=stations[1].id;await f.get('ground-node-pass-station').dispatch('change');assert.doesNotMatch(f.get('ground-node-pass-results').innerHTML,/A&lt;script&gt;/);
 valid=false;panel.update();assert.equal(f.get('ground-node-pass-results').innerHTML,'');valid=true;
 release=()=>{};const pending=f.get('ground-node-pass-query').dispatch('click');await Promise.resolve();await f.get('ground-node-pass-cancel').dispatch('click');release();await pending;assert.equal(f.get('ground-node-pass-results').innerHTML,'');
 const late=f.get('ground-node-pass-query').dispatch('click');await Promise.resolve();panel.show('satellite');release();await late;panel.show('ground');assert.equal(f.get('ground-node-pass-results').innerHTML,'');assert.equal(f.counts().commands,0);
 }finally{panel?.destroy();f.dispose();}
});
