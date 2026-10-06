import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const identity={catalog_number:25994,normalized_gp_sha256:'a'.repeat(64),leap_sha256:'b'.repeat(64),eop_sha256:'c'.repeat(64)};
const row={...identity,utc:'2026-10-06T14:00:37.897344000Z',frame:'ITRF',status:'valid',position_m:[1,2,3],eop_quality:{ut1:'predicted_a',polar_motion:'predicted_a'}};
async function setup(){
 globalThis.ContinuityGlobe=class{constructor(){this.viewer={scene:{renderError:{addEventListener:()=>()=>{}}}};}update(value){return Boolean(value);}focus(){}setGroundPoint(){}setViewStyle(){}setViewImagery(){}setCatalogScene(){}destroy(){}};
 const code=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href)).replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.ContinuityGlobe;');
 const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 const ui=createWorkspaceGlobe({dataset:{}},{},{addEventListener(){},removeEventListener(){}},{Cesium:{},setTimeout:()=>1,clearTimeout(){},addEventListener(){},removeEventListener(){}});
 let lease=Object.freeze({}),valid=true,observer=null,removed=0,reenter=null,reads=0;
 const port={capture(){reads++;reenter?.();return valid?lease:null;},isCurrent(value,expected){reads++;return valid&&value===lease&&Object.keys(identity).every(key=>expected?.[key]===identity[key]);},observe(fn){observer=fn;return()=>{removed++;observer=null;};}};
 return {ui,port,rotate(){lease=Object.freeze({});},gap(){valid=false;observer?.({phase:'availability',reason:'gap'});},recover(){valid=true;lease=Object.freeze({});},event(event){observer?.(event);},reenter(fn){reenter=fn;},get removed(){return removed;},get reads(){return reads;}};
}
test('catalog continuity bridge preserves legacy observers and requires actual owner plus full current display identity',async()=>{
 const s=await setup();try{
  const seen=[];s.ui.observeDisplayContext(value=>seen.push(value));s.ui.catalog(row);const count=seen.length;
  assert.equal(s.ui.captureDisplayContinuity(),null);const unbind=s.ui.bindCatalogDisplayContinuity(s.port);
  const proof=s.ui.captureDisplayContinuity();assert.ok(proof);assert.equal(Object.isFrozen(proof),true);assert.equal(s.ui.verifyDisplayContinuity(proof),true);assert.equal(s.ui.captureDisplayContinuity(),proof);assert.equal(seen.length,count);
  assert.equal(s.ui.verifyDisplayContinuity(structuredClone(proof)),false);assert.equal(s.ui.verifyDisplayContinuity(Object.freeze({})),false);
  s.ui.catalog({...row,utc:'2026-10-06T14:00:38.123456000Z'});assert.equal(s.ui.verifyDisplayContinuity(proof),true);assert.equal(s.ui.captureDisplayContinuity(),proof);
  for(const field of Object.keys(identity)){s.ui.catalog({...row,[field]:field==='catalog_number'?1:'d'.repeat(64)});assert.equal(s.ui.captureDisplayContinuity(),null);assert.equal(s.ui.verifyDisplayContinuity(proof),false);s.ui.catalog(row);}
  s.rotate();assert.equal(s.ui.verifyDisplayContinuity(proof),false);assert.notEqual(s.ui.captureDisplayContinuity(),proof);
  const beforeGap=s.ui.captureDisplayContinuity();s.ui.catalog(null);s.ui.catalog(row);assert.equal(s.ui.verifyDisplayContinuity(beforeGap),false,'returning to the same source cannot resurrect a revoked globe lease');assert.notEqual(s.ui.captureDisplayContinuity(),beforeGap);
  s.reenter(()=>{s.ui.catalog(null);s.ui.catalog(row);});assert.equal(s.ui.captureDisplayContinuity(),null,'a capture callback cannot restore identity after crossing a display discontinuity');s.reenter(null);
  unbind();assert.equal(s.removed,1);assert.equal(s.ui.captureDisplayContinuity(),null);
 }finally{s.ui.destroy();delete globalThis.ContinuityGlobe;}
});
test('catalog capability bridge rejects availability gaps, source priority changes, reentrant replacement and disposed owners',async()=>{
 const s=await setup();try{
  s.ui.catalog(row);const remove=s.ui.bindCatalogDisplayContinuity(s.port),proof=s.ui.captureDisplayContinuity();
  const events=[];const stop=s.ui.observeDisplayContinuity(value=>events.push(value));const count=events.length;
  s.event({phase:'invalidated',reason:'pause'});assert.equal(events.length,count+1);assert.deepEqual(events.at(-1),{phase:'invalidated',reason:'pause'});
  s.ui.observeDisplayContinuity(()=>{throw Error('readonly observer');});s.event({phase:'settled',reason:'pause'});
  s.gap();assert.equal(s.ui.verifyDisplayContinuity(proof),false);assert.equal(s.ui.captureDisplayContinuity(),null);stop();remove();
  s.ui.bindCatalogDisplayContinuity(s.port);s.ui.catalog(null);assert.equal(s.ui.captureDisplayContinuity(),null);
  s.recover();s.ui.catalog(row);s.reenter(()=>s.ui.catalog(null));assert.equal(s.ui.captureDisplayContinuity(),null);s.reenter(null);
  s.ui.destroy();assert.equal(s.ui.captureDisplayContinuity(),null);assert.equal(s.ui.verifyDisplayContinuity(proof),false);assert.equal(s.removed,2);
 }finally{s.ui.destroy();delete globalThis.ContinuityGlobe;}
});
test('failed continuity subscription and cleanup leave no usable catalog capability',async()=>{
 const s=await setup();try{
  s.ui.catalog(row);s.ui.bindCatalogDisplayContinuity(s.port);const old=s.ui.captureDisplayContinuity();
  assert.throws(()=>s.ui.bindCatalogDisplayContinuity({...s.port,observe(){throw Error('subscribe failed');}}),/subscribe failed/);
  assert.equal(s.ui.captureDisplayContinuity(),null);assert.equal(s.ui.verifyDisplayContinuity(old),false);
  const remove=s.ui.bindCatalogDisplayContinuity({...s.port,observe(){return()=>{throw Error('remove failed');};}}),proof=s.ui.captureDisplayContinuity(),events=[];
  s.ui.observeDisplayContinuity(event=>events.push(event));assert.throws(remove,/remove failed/);assert.equal(s.ui.captureDisplayContinuity(),null);assert.equal(s.ui.verifyDisplayContinuity(proof),false);assert.equal(events.at(-1).reason,'catalog-owner-unbound');
 }finally{s.ui.destroy();delete globalThis.ContinuityGlobe;}
});
