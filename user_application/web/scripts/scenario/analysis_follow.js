// Source followAll/releaseAll compatibility over existing analysis owners.
// Retains only capability/identity fences, never a clock, position or runtime state.
export function createAnalysisFollowCoordinator({stored,catalog,readRuntime,utcOfRuntime,codec,wallNow=()=>Date.now()}={}){
 if(!stored?.snapshot||!catalog?.snapshot||typeof readRuntime!=='function'||typeof utcOfRuntime!=='function'||typeof codec?.advance!=='function')throw Error('existing analysis owners required');
 let source=null,scope=null,busy=false,dead=false,generation=0;
 const requireValue=(value,message)=>{if(!value)throw Error(message);};
 const identity=()=>{const a=stored.snapshot(),b=catalog.snapshot();return {
  stored:a.state?.input_id?{input_id:a.state.input_id,input_hash:a.state.input_hash,ground_point:a.state.ground_point,minimum_elevation_deg:a.state.minimum_elevation_deg,leap_sha256:a.state.leap_sha256,frame:a.state.frame,profile:a.state.profile}:null,
  catalog:b.selected?{group:b.selected.group,catalog_number:b.selected.catalog_number,normalized_gp_sha256:b.selected.normalized_gp_sha256,eop_sha256:b.selected.eop_sha256,leap_sha256:b.selected.leap_sha256,frame:b.selected.frame,profile:b.selected.profile,observer:b.observer,minimumElevation:b.minimumElevation}:null
 };};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const canonical=value=>{requireValue(typeof value==='string'&&codec.advance(value,0)===value,'canonical native UTC required');return value;};
 function preflight(s){const a=stored.snapshot(),b=catalog.snapshot();requireValue(s.stored||s.catalog,'selected GP analysis input required');if(s.stored)requireValue(a.status==='ready'&&!a.fetching&&s.stored.input_hash&&s.stored.frame==='ITRF'&&typeof stored.seek==='function'&&typeof stored.samples==='function','stored native analysis prerequisites unavailable');if(s.catalog)requireValue(!b.pending&&!b.error&&s.catalog.observer&&s.catalog.frame==='ITRF'&&typeof catalog.calculate==='function','catalog observer/native analysis prerequisites unavailable');}
 function sim(){const r=readRuntime();requireValue(r?.run_id&&r.running===false,'actual paused SIM required');return {run_id:r.run_id,utc:canonical(utcOfRuntime(r))};}
 function check(ticket,s,r){requireValue(!dead&&ticket===generation&&same(identity(),s),'analysis selection changed');if(r){const actual=sim();requireValue(actual.run_id===r.run_id&&actual.utc===r.utc,'actual SIM run/UTC changed');}}
 async function calculate(utc,s,ticket,r){
  check(ticket,s,r);
  if(s.stored){await stored.seek(utc);check(ticket,s,r);requireValue(stored.snapshot().status==='ready'&&stored.snapshot().state.current_utc===utc,'stored native seek failed');await stored.samples({startUtc:utc,stepSeconds:1,count:3});check(ticket,s,r);const a=stored.snapshot(),v=a.result,row=v?.rows?.find(x=>x.utc===utc);requireValue(a.status==='ready'&&!a.fetching&&v?.frame==='ITRF'&&v.leap_sha256===s.stored.leap_sha256&&row?.status==='valid'&&Array.isArray(row.position_m)&&row.position_m.length===3&&row.position_m.every(Number.isFinite),'stored native calculation failed');}
  if(s.catalog){catalog.pause();catalog.seek(utc);check(ticket,s,r);await catalog.calculate();check(ticket,s,r);const b=catalog.snapshot(),row=catalog.sampleAt(utc);requireValue(!b.pending&&!b.error&&b.utc===utc&&row?.utc===utc&&row.frame==='ITRF'&&row.normalized_gp_sha256===s.catalog.normalized_gp_sha256&&row.eop_sha256===s.catalog.eop_sha256&&Array.isArray(row.position_m)&&row.position_m.every(Number.isFinite),'catalog native calculation failed');}
  // A different window may seek the stored owner while catalog HTTP is pending.
  // Identity alone is insufficient: both accepted owner cursors must still be
  // paused at this instant, with the current revision's native sample intact.
  if(s.stored){const a=stored.snapshot(),row=a.result?.rows?.find(x=>x.utc===utc);requireValue(a.status==='ready'&&!a.fetching&&a.state.current_utc===utc&&a.state.playing===false&&a.result?.revision===a.state.revision&&row?.status==='valid','stored analysis cursor changed');}
 }
 async function exclusive(work){requireValue(!dead,'analysis follow disposed');requireValue(!busy,'analysis follow alignment pending');busy=true;try{return await work();}finally{busy=false;}}
 async function followAll(value){return exclusive(async()=>{requireValue(value&&typeof value.now==='function','source capability required');const s=identity();preflight(s);const r=sim(),ticket=++generation;source=null;scope=null;await calculate(r.utc,s,ticket,r);scope={identity:s,run_id:r.run_id};source=value;return {run_id:r.run_id,utc:r.utc,frame:'ITRF',communication_status:'unknown'};});}
 async function align(){return exclusive(async()=>{requireValue(source&&scope,'analysis follow not engaged');preflight(scope.identity);const r=sim();requireValue(r.run_id===scope.run_id,'actual SIM run changed');const ticket=++generation;try{await calculate(r.utc,scope.identity,ticket,r);return {run_id:r.run_id,utc:r.utc,frame:'ITRF',communication_status:'unknown'};}catch(e){source=null;scope=null;throw e;}});}
 async function releaseAll(value=source){return exclusive(async()=>{if(!source||value!==source)return false;const s=scope.identity;preflight(s);requireValue(same(identity(),s),'analysis selection changed');const ticket=++generation,utc=canonical(codec.advance(new Date(wallNow()).toISOString(),0));source=null;scope=null;await calculate(utc,s,ticket,null);check(ticket,s,null);
   // Original releaseAll calls clock.live(): wall UTC, running, 1x. Native
   // calculation must succeed first; a failed/changed owner is never restarted.
   if(s.stored){await stored.select(s.stored.input_id,utc,{playing:true,playRate:1});check(ticket,s,null);requireValue(stored.snapshot().status==='ready'&&stored.snapshot().state.playing===true&&stored.snapshot().state.play_rate===1,'stored live release failed');await stored.samples({startUtc:utc,stepSeconds:1,count:601});check(ticket,s,null);const a=stored.snapshot(),v=a.result,row=v?.rows?.find(x=>x.utc===utc);if(a.status!=='ready'||v?.frame!=='ITRF'||row?.status!=='valid'||!Array.isArray(row.position_m)||!row.position_m.every(Number.isFinite)){await stored.control('pause');throw Error('stored live native calculation failed');}}
   if(s.catalog){catalog.rate(1);catalog.play();requireValue(catalog.snapshot().playing===true,'catalog live release failed');}return true;});}
 function currentSource(){if(dead||!source||!scope)return null;try{if(!same(identity(),scope.identity)||readRuntime()?.run_id!==scope.run_id){++generation;source=null;scope=null;}}catch{++generation;source=null;scope=null;}return source;}
 return Object.freeze({followAll,releaseAll,followedSource:currentSource,isFollowing:()=>!dead&&(busy||currentSource()!==null),isPending:()=>!dead&&busy,invalidate(){if(dead)return false;++generation;source=null;scope=null;return true;},align,destroy(){if(dead)return;dead=true;++generation;source=null;scope=null;}});
}
