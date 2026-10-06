// Offline hash-pinned source execution. Product code never imports this tool.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import * as vm from 'node:vm';
import {gzipSync} from 'node:zlib';
const paths=[
 ['digital_twin/simulation/browser/satellite_dynamics.js','5580263519e45f6b3e1f7d2a5dbceae097d99d6949f8190ce8c87fe2145f6eb5'],
 ['digital_twin/model_library/browser/satellite_nodes.js','722323b356b8c0937896aff45f919300099aed789372054ec142148520eadafb'],
 ['digital_twin/simulation/browser/oisl.js','7f781056f135f9a0660040ed0091ee5e4f53e2dd45b89351f7848d99a97ee536'],
 ['user_application/web/scripts/nodes/links.js','83a119b3aa9a129076db7bbf755946bd0582824e17d10b1966f1576b6d923cd5'],
];
const [root,output]=process.argv.slice(2);if(!root||!output)throw Error('source root and output required');
const raw=[];
for(const [name,sha] of paths){const bytes=await readFile(resolve(root,name));if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error(`source hash mismatch: ${name}`);raw.push(bytes.toString('utf8'));}
const epoch=Date.UTC(2026,8,8);
class EvidenceDate extends Date {constructor(...args){super(...(args.length?args:[epoch]));}static now(){return epoch;}}
const context=vm.createContext({Date:EvidenceDate,structuredClone});
const modules=raw.map((code,i)=>new vm.SourceTextModule(code,{context,identifier:paths[i][0]}));
const byStatic={'/static/simulation/satellite_dynamics.js':modules[0],'/static/model_library/satellite_nodes.js':modules[1],'/static/simulation/oisl.js':modules[2]};
for(const module of modules)if(module.status==='unlinked')await module.link(specifier=>{if(!byStatic[specifier])throw Error(`unexpected import: ${specifier}`);return byStatic[specifier];});
for(const module of modules)await module.evaluate();
const dynamics=modules[0].namespace,library=modules[1].namespace,links=modules[3].namespace;
const copy=value=>JSON.parse(JSON.stringify(value));
let ids=0;
function node(name,mean,extra={}){const id=`NODE-${++ids}`;return library.createNode({name,bus:'comms_small',orbit:{altitude_km:550,inclination:53,raan:0,mean_anomaly:mean,epoch},...extra},{epoch,id,catalogNumber:900000+ids});}
const cases=[];
function scenario(id,initial,steps){
 let histories=new Map(),nodes=initial;const rows=[];
 for(const step of steps){
   if(step.reset)histories=new Map();
   if(step.nodes)nodes=step.nodes;
   const at=epoch+step.seconds*1000;
   const states=new Map(nodes.map(n=>[n.id,dynamics.nodeStateAt(n.orbit,at)]));
   for(const missing of step.missing??[])states.set(missing,null);
   const result=links.resolveLinks(nodes,states,histories,at);
   rows.push(copy({input:{date:at,nodes,states:[...states],histories:[...histories]},expected:{terminals:result.terminals,pairs:result.pairs,histories:[...result.histories],summary:links.linkSummary(result.pairs)}}));
   histories=result.histories;
 }
 cases.push({id,rows});
}
const a=node('A',0),b=node('B',20),near=node('NEARER',10);
scenario('same-plane-acquire-retarget-rewind',[a,b],[{seconds:0},{seconds:1},{seconds:12},{seconds:90},{seconds:91,nodes:[a,b,near]},{seconds:-1},{seconds:180}]);
const explicit=node('EXPLICIT',0),far=node('FAR',180);
explicit.equipment.find(e=>e.role==='fore').target=far.id;
const stale=copy(explicit);stale.equipment.find(e=>e.role==='fore').target='NODE-GONE';
scenario('explicit-earth-stale-missing-target',[explicit,far],[{seconds:0},{seconds:90},{seconds:91,missing:[far.id]},{seconds:92,nodes:[stale,far]},{seconds:93,missing:[stale.id]}]);
const safe=node('SAFE',40,{mode:'safe'}),standby=node('STANDBY',20,{mode:'standby'});
scenario('modes-owner-unavailable',[a,safe,standby],[{seconds:0},{seconds:90},{seconds:91,missing:[a.id]}]);
const mini=node('MINI',0,{bus:'cubesat_3u'}),long=node('LONG',30,{equipment:[{id:'LONG-EQ',catalog:'oisl_long_range',role:'auto',target:'auto',enabled:true}]});
scenario('mini-long-range',[mini,long,b],[{seconds:0},{seconds:30},{seconds:180}]);
const disabled=copy(a);for(const e of disabled.equipment)if(e.catalog.startsWith('oisl_'))e.enabled=false;
scenario('disabled-empty',[a,b],[{seconds:0},{seconds:90,nodes:[disabled,b]},{seconds:91,nodes:[]}]);
const own=copy(a),hidden=copy(far),cross=copy(b);
own.formation={id:'FALLBACK',plane:0};hidden.formation={id:'FALLBACK',plane:0};cross.formation={id:'FALLBACK',plane:1};
scenario('preferred-plane-infeasible-fallback',[own,hidden,cross],[{seconds:0},{seconds:90}]);
let sequence=0;
const formation=library.generateFormation({preset:'walker_delta',planes:2,per_plane:10,altitude_km:550,inclination:53,phasing:1,raan_start:0,raan_spread:30,anomaly_start:0,bus:'comms_small',link_policy:'grid',prefix:'T'},{epoch,idFactory:()=>({id:`GRID-${++sequence}`,catalogNumber:901000+sequence}),formationId:'FRM-T'});
for(let minute=0;minute<96;minute+=8)scenario(`dense-two-plane:${minute}`,formation,[{seconds:minute*60-120,reset:true},{seconds:minute*60-60},{seconds:minute*60}]);
const receipt={source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes:Object.fromEntries(paths),evidence:'Original resolver/library/optical equations executed with original timed dynamics only offline. No product JS propagation, native/live-browser/network acceptance.',epoch,cases};
const json=Buffer.from(JSON.stringify(receipt)+'\n'),bytes=output.endsWith('.gz')?gzipSync(json,{level:9}):json;await writeFile(output,bytes);
process.stdout.write(JSON.stringify({bytes:bytes.length,json_bytes:json.length,scenarios:cases.length,steps:cases.reduce((sum,c)=>sum+c.rows.length,0),sha256:createHash('sha256').update(bytes).digest('hex'),json_sha256:createHash('sha256').update(json).digest('hex')})+'\n');
