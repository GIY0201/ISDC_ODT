import {NODE_COMMUNICATION_METADATA} from '../nodes/node_timeline.js';
// Pure complete native receipt validation. Approval/currentness and projection remain with callers.
const requireValue=(v,message)=>{if(!v)throw Error(message);};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function key(value){
 const ordered=v=>{if(v===null||typeof v==='string'||typeof v==='boolean')return v;if(typeof v==='number'&&Number.isFinite(v))return v;if(Array.isArray(v))return v.map(ordered);if(v&&Object.getPrototypeOf(v)===Object.prototype)return Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])]));throw Error('finite native contact JSON required');};
 return JSON.stringify(ordered(value));
}
const same=(a,b)=>key(a)===key(b);
export function createNativeContactBundleValidator({advanceUtc,differenceUtc}={}){
 if(typeof advanceUtc!=='function'||typeof differenceUtc!=='function')throw TypeError('existing precise UTC codec required');
 const canonical=utc=>typeof utc==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/.test(utc)&&!/:60\./.test(utc)&&advanceUtc(utc,0)===utc;
 function scope(hashes,nodeIds){requireValue(Array.isArray(nodeIds)&&nodeIds.length>0&&nodeIds.length<=240&&new Set(nodeIds).size===nodeIds.length&&nodeIds.every(id=>typeof id==='string'&&id.trim())&&same(Object.keys(hashes??{}).sort(),[...nodeIds].sort())&&Object.values(hashes??{}).every(hash),'contact definition scope changed');}
 function horizon(start,end,maximum=86400){requireValue(canonical(start)&&canonical(end)&&Number.isFinite(maximum)&&maximum>0&&differenceUtc(end,start)>0&&differenceUtc(end,start)<=maximum,'contact query horizon changed');}
 function metadata(report,hashes,schema){requireValue(report?.schema_version===schema&&report.status==='sampled'&&Object.entries(NODE_COMMUNICATION_METADATA).every(([k,v])=>report[k]===v)&&same(report.definition_hashes,hashes),'native window receipt changed');}
 function rows(items,{nodeIds,start,end,contact}){
  requireValue(Array.isArray(items)&&items.length<=20000,'native window capacity invalid');const ids=new Set(),nodes=new Set(nodeIds);
  for(const row of items){
   requireValue(typeof row?.id==='string'&&row.id&&!ids.has(row.id)&&nodes.has(row.satellite)&&typeof row.in_progress==='boolean'&&typeof row.truncated==='boolean','native window identity/flags invalid');ids.add(row.id);
   requireValue(canonical(row.start)&&canonical(row.end)&&differenceUtc(row.start,start)>=0&&differenceUtc(end,row.end)>=0&&differenceUtc(row.end,row.start)>=0,'native window outside captured horizon');
   if(contact)requireValue(canonical(row.peak)&&differenceUtc(row.peak,row.start)>=0&&differenceUtc(row.end,row.peak)>=0&&Number.isFinite(row.max_elevation_deg)&&row.max_elevation_deg>=0&&row.max_elevation_deg<=90,'contact pass record invalid');
  }
 }
 function validateContacts(bundle,{query,definitionHashes=null,maximumHorizonSeconds=86400}={}){
  key(query);requireValue(query&&Array.isArray(query.nodes)&&Array.isArray(query.sites)&&new Set(query.sites.map(s=>s.station_id)).size===query.sites.length,'contact query scope invalid');
  const nodeIds=query.nodes.map(n=>n.id),hashes=bundle?.definition_hashes;scope(hashes,nodeIds);horizon(query.start_utc,query.end_utc,maximumHorizonSeconds);
  const conditions=Object.fromEntries(['sites','target','external','max_external_range_km','start_utc','end_utc'].map(k=>[k,query[k]]));
  requireValue(bundle?.schema_version===1&&bundle.status==='sampled'&&bundle.communication_status==='unknown'&&bundle.request_id===query.request_id&&same(bundle.node_definitions,query.nodes)&&same(bundle.conditions,conditions)&&(definitionHashes===null||same(hashes,definitionHashes)),'contact bundle identity/conditions changed');
  requireValue(Array.isArray(bundle.contact_reports)&&bundle.contact_reports.length===query.sites.length&&new Set(bundle.contact_reports.map(r=>r.station_id)).size===query.sites.length,'contact site scope changed');
  let count=0;
  for(const item of bundle.contact_reports){
   const site=query.sites.find(s=>s.station_id===item.station_id),report=item.geometry;requireValue(site,'unknown native contact station');metadata(report,hashes,1);
   requireValue(same(report.site,site.ground_point)&&report.minimum_elevation_deg===site.minimum_elevation_deg,'contact geometry site/mask changed');
   const c=report.coverage;requireValue(c?.start_utc===query.start_utc&&c.end_utc===query.end_utc&&c.resolution_seconds===30&&c.peak_bracket_seconds===0.1&&c.boundary_bracket_seconds===1&&c.short_intervals_may_be_missed===true,'contact sampling contract changed');
   rows(report.passes,{nodeIds,start:query.start_utc,end:query.end_utc,contact:true});count+=report.passes.length;requireValue(count<=20000,'contact aggregate capacity exceeded');
  }
  return true;
 }
 function validateEclipse(report,{startUtc,endUtc,definitionHashes,nodeIds}={}){
  key(report);scope(definitionHashes,nodeIds);horizon(startUtc,endUtc);metadata(report,definitionHashes,undefined);
  const c=report.coverage;requireValue(c?.start_utc===startUtc&&c.end_utc===endUtc&&c.resolution_seconds===60&&c.boundary_tolerance_seconds===1&&c.short_intervals_may_be_missed===true,'native eclipse sampling changed');rows(report.windows,{nodeIds,start:startUtc,end:endUtc,contact:false});return true;
 }
 return Object.freeze({validateContacts,validateEclipse});
}
