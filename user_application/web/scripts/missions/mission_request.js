import {NODE_COMMUNICATION_METADATA} from '../nodes/node_timeline.js';
// Source OR-01 composition over injected, already-owned native/optical inputs.
// No private propagation, primed history, clock, persistent cache or command.
function key(value){
 const ordered=v=>{
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(Array.isArray(v))return v.map(ordered);
  if(v&&Object.getPrototypeOf(v)===Object.prototype)return Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])]));
  throw new Error('finite JSON mission inputs required');
 };
 return JSON.stringify(ordered(value));
}
const same=(a,b)=>key(a)===key(b);
const requireValue=(condition,message)=>{if(!condition)throw new Error(message);};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const point=site=>({latitude_deg:site.latitude,longitude_deg:site.longitude,ellipsoid_height_m:(site.altitude_km??0)*1000});
export function createNativeMissionRequestBuilder({missionTypes,constraints,windowRecords,optical,readContext,verifyContext,requestWindows,advanceUtc,differenceUtc}={}){
 if([readContext,verifyContext,requestWindows,advanceUtc,differenceUtc].some(v=>typeof v!=='function')||
  ['validateMission','satelliteCapabilities','requestParams'].some(k=>typeof missionTypes?.[k]!=='function')||
  ['planHorizon','busyIntervals','faultedPairKeys','faultedStationIds'].some(k=>typeof constraints?.[k]!=='function')||
  ['contacts','access'].some(k=>typeof windowRecords?.[k]!=='function')||
  ['update','verifyLinkSnapshot'].some(k=>typeof optical?.[k]!=='function'))throw new TypeError('existing mission/native/optical/context owners required');
 let disposed=false;
 async function build(mission,{requestId,exclude=[],signal}={}){
  const captured=structuredClone(readContext()),source=structuredClone(mission),capturedKey=key(captured),missionKey=key(source);
  const current=()=>{
   if(signal?.aborted)throw new DOMException('mission request cancelled','AbortError');
   requireValue(!disposed&&key(readContext())===capturedKey&&key(mission)===missionKey&&verifyContext(structuredClone(captured))===true,'mission context changed or unavailable');
  };
  current();
  requireValue(typeof requestId==='string'&&requestId.trim()&&requestId.length<=128,'explicit mission window request id required');
  const {nodes,stations,missions,faults,utc}=captured;
  requireValue(Array.isArray(nodes)&&nodes.length>0&&nodes.length<=240&&new Set(nodes.map(n=>n.id)).size===nodes.length&&nodes.every(n=>typeof n.id==='string'&&n.id.trim()),'mission node scope invalid');
  requireValue(Array.isArray(stations)&&stations.length<=64&&new Set(stations.map(s=>s.id)).size===stations.length&&Array.isArray(missions)&&Array.isArray(faults),'mission station/task/fault scope invalid');
  requireValue(advanceUtc(utc,0)===utc&&!/:60(?:\.|Z)/.test(utc),'unsupported common mission UTC');
  const errors=missionTypes.validateMission(source,{satellites:nodes,stations});
  requireValue(errors.length===0,errors.join(' '));
  const horizon=constraints.planHorizon(Date.parse(utc),Date.parse(source.deadline)),end=advanceUtc(utc,horizon.hours*3600);
  const params=missionTypes.requestParams(source),target=source.kind==='observe'?{ground_point:{latitude_deg:Number(params.latitude),longitude_deg:Number(params.longitude),ellipsoid_height_m:0},off_nadir_degrees:Number(params.max_off_nadir_deg)}:null;
  const external=source.kind==='pickup'?structuredClone(captured.external??null):null;
  if(source.kind==='pickup')requireValue(external&&String(external.catalog_number)===String(params.external_id)&&external.profile==='WGS72_AFSPC'&&typeof external.group==='string'&&external.group.trim()&&['normalized_gp_sha256','eop_sha256','leap_sha256'].every(k=>hash(external[k])),'explicit external GP/EOP/leap identity required');
  const query={request_id:requestId,nodes,sites:stations.map(s=>({station_id:s.id,ground_point:point(s),minimum_elevation_deg:s.min_elevation_deg??0})),start_utc:utc,end_utc:end,target,external,max_external_range_km:external?Number(params.max_range_km):null};
  key(query); // Reject nonfinite inputs before either async operation.
  const links=await optical.update();current();
  requireValue(links?.schema_version===1&&links.status==='valid'&&Object.entries(NODE_COMMUNICATION_METADATA).every(([k,v])=>links[k]===v)&&optical.verifyLinkSnapshot(links,{nodes,utc})===true&&same(links.node_definitions,nodes)&&links.utc===utc,'verified current optical snapshot required');
  const hashes=links.definition_hashes;
  requireValue(hashes&&same(Object.keys(hashes).sort(),nodes.map(n=>n.id).sort())&&Object.values(hashes).every(hash),'complete optical node hashes required');
  const bundle=structuredClone(await requestWindows(structuredClone(query),{signal}));current();key(bundle);
  requireValue(optical.verifyLinkSnapshot(links,{nodes,utc})===true,'optical context changed');
  requireValue(bundle.schema_version===1&&bundle.status==='sampled'&&bundle.request_id===requestId&&bundle.communication_status==='unknown'&&same(bundle.node_definitions,nodes)&&same(bundle.definition_hashes,hashes),'native mission bundle identity changed');
  const conditions={sites:query.sites,target,external,max_external_range_km:query.max_external_range_km,start_utc:utc,end_utc:end};
  requireValue(same(bundle.conditions,conditions),'native mission query conditions changed');
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const verifyReport=(report,kind,limit)=>{
   requireValue((kind==='eclipse'?report?.schema_version===undefined:report?.schema_version===1)&&report.status==='sampled'&&Object.entries(NODE_COMMUNICATION_METADATA).every(([k,v])=>report[k]===v)&&same(report.definition_hashes,hashes),'native '+kind+' receipt changed');
   const c=report.coverage;
   requireValue(c&&c.start_utc===utc&&c.end_utc===end&&c.short_intervals_may_be_missed===true,'native window horizon/coverage changed');
   if(kind==='eclipse')requireValue(c.resolution_seconds===60&&c.boundary_tolerance_seconds===1,'native eclipse sampling changed');
   if(kind==='crosslink')requireValue(c.resolution_seconds===30&&c.boundary_tolerance_seconds===1&&c.range_resolution_seconds===10&&c.minimum_range_is_sampled===true&&c.exact_end_included===true,'native crosslink sampling changed');
   const rows=report.passes??report.windows;
   requireValue(Array.isArray(rows)&&rows.length<=limit,'native window capacity invalid');
   const ids=new Set();
   for(const row of rows){
    requireValue(typeof row.id==='string'&&row.id.length>0&&!ids.has(row.id)&&byId.has(row.satellite)&&typeof row.in_progress==='boolean'&&typeof row.truncated==='boolean','invalid native window identity/flags');ids.add(row.id);
    requireValue(typeof row.start==='string'&&typeof row.end==='string'&&advanceUtc(row.start,0)===row.start&&advanceUtc(row.end,0)===row.end&&differenceUtc(row.start,utc)>=0&&differenceUtc(end,row.end)>=0&&differenceUtc(row.end,row.start)>=0,'native window outside captured horizon');
    if(kind==='crosslink')requireValue(row.external===String(external.catalog_number)&&Number.isFinite(row.min_range_km)&&row.min_range_km>=0&&row.min_range_km<=query.max_external_range_km+0.5,'invalid native crosslink range/identity');
   }
   return rows;
  };
  requireValue(Array.isArray(bundle.contact_reports)&&bundle.contact_reports.length===stations.length&&new Set(bundle.contact_reports.map(r=>r.station_id)).size===stations.length,'complete native contact sites required');
  const contactRecords=[];
  const slice=(report,node)=>({...report,definition_hashes:{[node.id]:hashes[node.id]},passes:report.passes.filter(r=>r.satellite===node.id)});
  let contactCount=0;
  for(const item of bundle.contact_reports){
   const station=stations.find(s=>s.id===item.station_id);requireValue(station,'unknown native contact station');
   contactCount+=verifyReport(item.geometry,'contact',20000).length;requireValue(contactCount<=20000,'native contact capacity exceeded');
   for(const node of nodes)contactRecords.push(...windowRecords.contacts({node,station,geometry:slice(item.geometry,node),definitionHash:hashes[node.id]}));
  }
  const eclipses=verifyReport(bundle.eclipse_report,'eclipse',20000).map(r=>structuredClone(r));
  const access=[];
  if(target){
   verifyReport(bundle.target_report,'access',5000);
   for(const node of nodes){
    const records=windowRecords.access({node,target:{latitude:target.ground_point.latitude_deg,longitude:target.ground_point.longitude_deg,altitude_km:0},offNadirDegrees:target.off_nadir_degrees,geometry:slice(bundle.target_report,node),definitionHash:hashes[node.id]});
    if(missionTypes.satelliteCapabilities(node).camera)access.push(...records);
   }
  }else requireValue(bundle.target_report===null,'unexpected native target report');
  let crosslinks=[];
  if(external){
   crosslinks=verifyReport(bundle.external_report,'crosslink',5000).map(r=>structuredClone(r));
   const r=bundle.external_report;
   requireValue(Object.entries(external).every(([k,v])=>same(r.external?.[k],v))&&r.external.frame==='ITRF'&&r.external.eop_kind==='IERS_A'&&Array.isArray(r.external.eop_qualities)&&r.external.eop_qualities.length>0&&r.comparison_frame==='WGS84_GEODETIC_EARTH_FIXED_APPROX'&&r.max_range_km===query.max_external_range_km&&r.los_margin_km===100,'precise external receipt changed');
   requireValue(typeof r.external.source==='string'&&r.external.source.trim()&&typeof r.external.fetched_at==='string'&&Number.isFinite(Date.parse(r.external.fetched_at))&&typeof r.external.stale==='boolean'&&typeof r.external.warning==='string'&&typeof r.external.name==='string'&&advanceUtc(r.external.epoch_utc,0)===r.external.epoch_utc&&r.external.eop_qualities.every(q=>['final_b','observed_a','predicted_a'].includes(q.ut1)&&['final_b','observed_a','predicted_a'].includes(q.polar_motion)),'external provenance/quality unavailable');
  }else requireValue(bundle.external_report===null,'unexpected native external report');
  const stationFaults=constraints.faultedStationIds(stations,faults),pairFaults=constraints.faultedPairKeys(links.pairs,nodes,faults),busy=constraints.busyIntervals(missions,{except:source.id}),mesh={};
  for(const pair of links.pairs){
   requireValue(byId.has(pair.a)&&byId.has(pair.b)&&pair.a!==pair.b,'optical pair scope changed');
   if(pair.state!=='locked'||pairFaults.has(pair.key))continue;
   (mesh[pair.a]??=[]).push(pair.b);(mesh[pair.b]??=[]).push(pair.a);
  }
  requireValue(Array.isArray(exclude)&&Array.isArray(source.exclude??[])&&[...exclude,...(source.exclude??[])].every(x=>typeof x==='string'&&x.trim()),'explicit excluded identities required');
  const request={time:utc,mission:{id:source.id,kind:source.kind,priority:source.priority,window_start:source.window_start,deadline:source.deadline,params},satellites:nodes.map(n=>({id:n.id,name:n.name,mode:n.mode,formation:n.formation?.id||null,capabilities:missionTypes.satelliteCapabilities(n),power:{generation_w:n.power?.generation_w,bus_w:n.power?.bus_w,battery_wh:n.power?.battery_wh},busy:busy[n.id]||[]})),stations:stations.filter(s=>!stationFaults.has(s.id)).map(s=>({id:s.id,name:s.name,bands:s.bands})),windows:{contacts:contactRecords.filter(r=>!stationFaults.has(r.station)),target_access:access,crosslinks,eclipses},mesh,exclude:[...new Set([...(source.exclude??[]),...exclude])],horizon:{start:utc,end,faulted_stations:[...stationFaults],faulted_links:[...pairFaults],locked_links:links.pairs.filter(p=>p.state==='locked').length}};
  key(request);current();
  return structuredClone({request,context:captured,evidence:bundle});
 }
 return Object.freeze({build,destroy(){disposed=true;}});
}
