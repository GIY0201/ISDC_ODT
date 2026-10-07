import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createCatalogTimeline} from '../../../user_application/web/scripts/catalog_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';

test('catalog advancing display has one native display boundary while control/error changes retain node refresh',async()=>{
 const source=await readFile(new URL('../../../user_application/web/scripts/workspace_orbit.js',import.meta.url),'utf8');
 const callback=source.match(/createCatalogTimeline\(api,value=>globe.catalog\(value\),(\(\)=>\{[^\n]+\})\);/)[1];
 let now=0,frame,refreshes=0,displayReads=0,failed=false;
 const H='a'.repeat(64),codec=createUtcCodec(LEAP_SHA256),utc=codec.advance('2026-10-07T00:00:00Z',0);
 const base={group:'active',catalog_number:25544,normalized_gp_sha256:H,utc,epoch_utc:utc,eop_sha256:H,leap_sha256:LEAP_SHA256,frame:'ITRF',profile:'WGS72_AFSPC',eop_kind:'IERS_A',source:'celestrak-cache',position_m:[7000000,0,0]};
 const point={latitude_deg:0,longitude_deg:0,ellipsoid_height_m:0,virtual:true,ellipsoid:'WGS84'};
 const owners={sceneTime:null,catalogNodeControlKey:null,catalogTimeline:null,catalogTimePanel:{update(){}},catalogPanel:{update(){}},stationPanel:{update(){}},nodeWorkspace:{refresh(){refreshes++;}},catalogTrack:null,catalogPasses:null,catalogPassPanel:null,catalogScenePanel:null,catalogScene:null,notifyWorkspaceContext(){}};
 const notify=vm.runInNewContext('('+callback+')',owners);
 const timeline=createCatalogTimeline({catalogSamples:async p=>{if(failed)throw Error('native query failed');return {...base,...p,version:1,status:'valid',communication_status:'unknown',units:{position:'m',range:'m',elevation:'deg',azimuth:'deg',time:'UTC'},rows:Array.from({length:p.count},(_,i)=>({utc:codec.advance(p.start_utc,i),status:'valid',error_code:null,position_m:[7000000+i,0,0],elevation_deg:10,range_m:1000,azimuth_deg:0,visible:true,eop_quality:{ut1:'final_b',polar_motion:'final_b'}}))};}},()=>displayReads++,notify,{now:()=>now,requestFrame:fn=>(frame=fn,1),cancelFrame:()=>{frame=null;},requestId:()=> 'catalog-node-refresh'});
 owners.catalogTimeline=timeline;
 try{
  timeline.select(base);timeline.observer(point,5);await timeline.calculate();timeline.play();
  const before=refreshes,shown=displayReads;
  for(const value of [250,500,750]){now=value;const tick=frame;frame=null;tick();}
  assert.equal(displayReads,shown+3,'every native UTC is still painted');
  assert.equal(refreshes,before,'UTC-only notifications must not duplicate the display observer refresh');
  timeline.pause();assert.ok(refreshes>before,'same-UTC pause must refresh node clock controls');
  let previous=refreshes;timeline.rate(10);assert.ok(refreshes>previous,'same-UTC speed must refresh controls');
  previous=refreshes;failed=true;await timeline.calculate();assert.ok(refreshes>previous,'pending/failure notifications must refresh controls');assert.match(timeline.snapshot().error,/native query failed/);
  previous=refreshes;timeline.clear();assert.ok(refreshes>previous,'selection removal must refresh controls');
 }finally{timeline.destroy();}
});
