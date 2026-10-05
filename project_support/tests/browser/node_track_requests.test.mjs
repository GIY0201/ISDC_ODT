import test from 'node:test';
import assert from 'node:assert/strict';
import {createNodeTrackTimeline} from '../../../user_application/web/scripts/nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256),start=codec.advance('2026-10-04T22:01:12Z',0),period=95.651,H='a'.repeat(64);
const nodes=()=>[{schema:1,id:'N-1',catalog_number:900001,orbit:{altitude_km:550,inclination:53,epoch:'2026-10-04T00:00:00Z'}}];
function response(p){
 const center=Date.parse(p.center_utc);
 return {schema_version:1,request_id:p.request_id,status:'valid',model_profile:'SOURCE_KEPLER_J2_V1',frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption',nodes:p.nodes.map(n=>({node_id:n.id,definition_hash:H,period_minutes:period,path_visible:true,rows:Array.from({length:121},(_,i)=>({utc:codec.advance(new Date(Math.trunc(center+(i-60)*period*60000/120)).toISOString(),0),status:'valid',error_code:null,position_m:[i,2,3],inertial_velocity_km_s:[1,2,3],raan_deg:1,argp_deg:2,mean_anomaly_deg:3,sunlit:true,longitude_deg:4,latitude_deg:5,height_km:550}))}))};
}
function setup(action=p=>response(p)){
 const calls=[];let yields=0;
 const timeline=createNodeTrackTimeline({api:{nodeTrack:async(p,o)=>{calls.push({p,signal:o.signal});return action(p,o,calls);}},periodFor:()=>period,requestId:()=> 'track',yieldControl:async()=>{yields++;}});
 timeline.setDefinitions(nodes());return {timeline,calls,get yields(){return yields;}};
}
const until=async predicate=>{for(let i=0;i<100&&!predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(predicate());};
test('shared display UTC refreshes at absolute30seconds and never requests on reads or subthreshold frames',async()=>{
 const s=setup();assert.equal(await s.timeline.refresh(start),true);assert.equal(s.yields,1);
 for(const dt of [0,1,10,29,-29]){assert.equal(await s.timeline.refresh(codec.advance(start,dt)),false);s.timeline.pathFor(nodes()[0]);s.timeline.snapshot();}
 assert.equal(s.calls.length,1);assert.equal(await s.timeline.refresh(codec.advance(start,-30)),true);assert.equal(s.calls.length,2);assert.equal(s.timeline.snapshot().centerUtc,codec.advance(start,-30));s.timeline.destroy();
});
test('same generation pending refresh deduplicates; definition changes abort concrete signal and reject ignored abort',async()=>{
 let finish;const s=setup(p=>new Promise(resolve=>{finish=()=>resolve(response(p));}));
 const first=s.timeline.refresh(start);await until(()=>finish);const duplicate=s.timeline.refresh(codec.advance(start,1));assert.equal(s.calls.length,1);
 const defs=nodes();defs[0].orbit.altitude_km=600;s.timeline.setDefinitions(defs);assert.equal(s.calls[0].signal.aborted,true);finish();assert.equal(await first,false);assert.equal(await duplicate,false);assert.equal(s.timeline.pathFor(defs[0]),null);s.timeline.destroy();
});
test('latest explicit seek wins and late old receipt cannot replace it',async()=>{
 const releases=[];const s=setup(p=>new Promise(resolve=>releases.push(()=>resolve(response(p)))));
 const first=s.timeline.calculate(start);await until(()=>releases.length===1);const later=codec.advance(start,100),next=s.timeline.calculate(later);await until(()=>releases.length===2);releases[1]();assert.equal(await next,true);releases[0]();assert.equal(await first,false);assert.equal(s.timeline.pathFor(nodes()[0]).center_utc,later);s.timeline.destroy();
});
test('failed query clears path and automatic refresh remains stopped until explicit retry',async()=>{
 let failing=false;const s=setup(p=>{if(failing)throw Error('native unavailable');return response(p);});await s.timeline.refresh(start);failing=true;
 assert.equal(await s.timeline.refresh(codec.advance(start,30)),false);assert.equal(s.timeline.pathFor(nodes()[0]),null);assert.match(s.timeline.snapshot().error,/unavailable/);
 for(let dt=31;dt<100;dt++)assert.equal(await s.timeline.refresh(codec.advance(start,dt)),false);assert.equal(s.calls.length,2);
 failing=false;assert.equal(await s.timeline.calculate(codec.advance(start,100)),true);assert.equal(s.calls.length,3);s.timeline.destroy();
});
test('known sample hash constrains track receipt and refresh publication is atomic during cooperative work',async()=>{
 let resume;const timeline=createNodeTrackTimeline({api:{nodeTrack:async p=>response(p)},periodFor:()=>period,requestId:()=> 'atomic',yieldControl:()=>new Promise(resolve=>{resume=resolve;})});timeline.setDefinitions(nodes());
 const work=timeline.calculate(start,{expectedHashes:{'N-1':H}});await until(()=>resume);assert.equal(timeline.pathFor(nodes()[0]),null);resume();assert.equal(await work,true);
 assert.equal(await timeline.calculate(codec.advance(start,30),{expectedHashes:{'N-1':'b'.repeat(64)}}),false);assert.equal(timeline.pathFor(nodes()[0]),null);timeline.destroy();
});
test('clear destroy malformed UTC and empty definitions do not create clock transport or stale paths',async()=>{
 const s=setup();assert.equal(await s.timeline.calculate('2016-12-31T23:59:60Z'),false);assert.equal(s.calls.length,0);assert.match(s.timeline.snapshot().error,/unsupported_node_time/);
 s.timeline.setDefinitions([]);assert.equal(await s.timeline.calculate(start),false);assert.equal(s.calls.length,0);s.timeline.destroy();assert.equal(s.timeline.pathFor(nodes()[0]),null);assert.throws(()=>s.timeline.refresh(start),/disposed/);
});
test('all240 tracks use one29040row query and240 cooperative yields before atomic publication',async()=>{
 const calls=[];let yields=0,finish;
 const defs=Array.from({length:240},(_,i)=>({...nodes()[0],id:'N-'+i,catalog_number:900001+i}));
 const timeline=createNodeTrackTimeline({api:{nodeTrack:async(p,o)=>{calls.push({p,signal:o.signal});return response(p);}},periodFor:()=>period,requestId:()=> 'all',yieldControl:async()=>{if(++yields===240)await new Promise(resolve=>{finish=resolve;});}});
 timeline.setDefinitions(defs);const work=timeline.refresh(start);await until(()=>finish);assert.equal(calls.length,1);assert.equal(calls[0].p.nodes.length*121,29040);assert.equal(yields,240);assert.equal(timeline.pathFor(defs[0]),null);assert.equal(timeline.pathFor(defs[239]),null);
 finish();assert.equal(await work,true);assert.equal(timeline.pathFor(defs[239]).positions_m.length,121);timeline.destroy();
});
test('dispose during cooperative work aborts actual signal and prevents late publication',async()=>{
 let resume,signal;const timeline=createNodeTrackTimeline({api:{nodeTrack:async(p,o)=>{signal=o.signal;return response(p);}},periodFor:()=>period,requestId:()=> 'dispose',yieldControl:()=>new Promise(resolve=>{resume=resolve;})});timeline.setDefinitions(nodes());
 const work=timeline.calculate(start);await until(()=>resume);timeline.destroy();assert.equal(signal.aborted,true);resume();assert.equal(await work,false);assert.equal(timeline.pathFor(nodes()[0]),null);
});
test('transport mutation and observer errors cannot alter captured definitions or native acceptance',async()=>{
 const events=[];let count=0;const timeline=createNodeTrackTimeline({api:{nodeTrack:async p=>{count++;const value=response(p);p.nodes[0].orbit.altitude_km=1000;return value;}},periodFor:()=>period,requestId:()=> 'notify',yieldControl:async()=>{},onChange:()=>{throw Error('observer');},onError:e=>events.push(e)});
 const defs=nodes();timeline.setDefinitions(defs);assert.equal(await timeline.calculate(start),true);assert.equal(timeline.pathFor(defs[0]).node_definition.orbit.altitude_km,550);assert.equal(timeline.snapshot().error,'');assert.equal(count,1);assert.ok(events.includes('observer'));timeline.destroy();
});
test('fast playback coalesces pending automatic refresh instead of aborting work every30displayseconds',async()=>{
 let finish;const s=setup(p=>new Promise(resolve=>{finish=()=>resolve(response(p));}));const first=s.timeline.refresh(start);await until(()=>finish);
 const pending=s.timeline.refresh(codec.advance(start,60));assert.equal(s.calls.length,1);assert.equal(s.calls[0].signal.aborted,false);
 finish();assert.equal(await first,true);assert.equal(await pending,true);assert.equal(s.timeline.snapshot().centerUtc,start);s.timeline.destroy();
});
