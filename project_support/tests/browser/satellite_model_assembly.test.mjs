import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {readFile} from 'node:fs/promises';
import {LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const manifest=JSON.parse(await readFile(new URL('../../../digital_twin/model_library/packages/satellite_display/v1/manifest.json',import.meta.url),'utf8'));
test('real workspace imports model panel and selection glue, reports manifest readiness and tears down observers',async()=>{
 const f=fixture(1280,720,{hash:'#satellite',satelliteModelManifest:async()=>manifest});
 try{await new Promise(r=>setImmediate(r));assert.ok(f.get('satellite-model-status').textContent);assert.equal(f.evaluate('globe.modelState().manifest.phase'),'ready');assert.equal(f.evaluate('typeof modelSelection.select'),'function');
 const before=f.counts();f.evaluate("modelPanel.applyDraft([{id:'satellite-model-focus',value:'true'}])");assert.deepEqual(f.counts(),before);await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.evaluate('globe.modelState().selected'),null);
 }finally{f.dispose();}
});
test('real catalog item/native selection resolves ISS in one Viewer, preserves stored state and clears model target',async()=>{
 const epoch='2026-10-04T01:53:16.268928000Z';
 const f=fixture(1920,1080,{hash:'#satellite',satelliteModelManifest:async()=>manifest,satelliteGroups:async()=>({items:[{id:'active',label:'Active'}]}),satellites:async p=>({...p,source:'celestrak-cache',items:[{NORAD_CAT_ID:25544,OBJECT_NAME:'ISS',MEAN_MOTION:15,EPOCH:epoch}],count:1,total:1,filtered_total:1}),satelliteProfile:async()=>({source:'gp-cache',catalog:{NORAD_CAT_ID:25544,OBJECT_TYPE:'PAY'},gp:{NORAD_CAT_ID:25544,EPOCH:epoch}}),catalogPosition:async p=>({version:1,status:'valid',...p,name:'ISS',source:'celestrak-cache',utc:epoch,epoch_utc:epoch,frame:'ITRF',profile:'WGS72_AFSPC',position_m:[4000000,5000000,1000000],normalized_gp_sha256:'a'.repeat(64),eop_sha256:'b'.repeat(64),leap_sha256:LEAP_SHA256,eop_kind:'IERS_A',eop_quality:{ut1:'predicted_a',polar_motion:'predicted_a'}})});
 try{await new Promise(r=>setImmediate(r));const before=f.snapshot();await f.get('cat-sat-25544').dispatch('click');await new Promise(r=>setImmediate(r));
 assert.equal(f.evaluate('globe.modelState().match.key'),'iss');assert.equal(f.evaluate('globe.modelState().selected.catalog_number'),25544);assert.match(f.get('satellite-model-quality').textContent,/해당 기체/);assert.equal(f.viewers.length,1);assert.equal(f.counts().commands,0);assert.deepEqual(f.snapshot(),before);
 const count=f.counts();
 f.viewers[0].scene.pick=()=>({id:{satelliteId:25544}});
 f.evaluate("globe.catalog({catalog_number:25544,normalized_gp_sha256:'"+'a'.repeat(64)+"',frame:'ITRF',utc:'"+epoch+"',position_m:[4000000,5000000,1000000],name:'ISS',orbit_regime:'LEO',eop_quality:{ut1:'predicted_a',polar_motion:'predicted_a'}})");
 f.pickHandlers[0].move({endPosition:{x:50,y:60}});
 const card=f.get('stored-orbit-globe').children.find(node=>node.className==='satellite-hover-card');assert.ok(card);assert.equal(card.hidden,false);assert.equal(card.children[0].textContent,'ISS');assert.match(card.children[1].textContent,/123.456 km/);assert.match(card.children[2].textContent,new RegExp(epoch.replaceAll('.','\\.')));
 assert.deepEqual(f.counts(),count);
 await f.get('cat-position-clear').dispatch('click');assert.equal(card.hidden,true);assert.equal(f.evaluate('globe.modelState().selected'),null);assert.equal(f.get('satellite-model-image').hidden,true);assert.deepEqual(f.snapshot(),before);await f.win.dispatch('pagehide',{persisted:false});assert.equal(card.isConnected,false);
 }finally{f.dispose();}
});
