// Offline original execution only. No product module imports this tool or the reference checkout.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,posix} from 'node:path';
import {createHash} from 'node:crypto';
import * as vm from 'node:vm';
const files={
 'digital_twin/simulation/browser/satellite_dynamics.js':'5580263519e45f6b3e1f7d2a5dbceae097d99d6949f8190ce8c87fe2145f6eb5',
 'digital_twin/model_library/browser/satellite_nodes.js':'722323b356b8c0937896aff45f919300099aed789372054ec142148520eadafb',
 'digital_twin/model_library/browser/ground_stations.js':'d63b55ab5d1e354de743f96a8998871d426217b62d551caeca131c39dc8c5ce4',
 'digital_twin/simulation/browser/orbit.js':'1f3f2b2121478cca9df030fa6facd5482f70bffbc01b428ca90af4b409f3b72a',
 'digital_twin/simulation/browser/ground_links.js':'cf59e9fa5ede859efd3b3bb8c729d9ba633f3cc3cb41225209514528b2b26323',
 'digital_twin/simulation/browser/oisl.js':'7f781056f135f9a0660040ed0091ee5e4f53e2dd45b89351f7848d99a97ee536',
 'digital_twin/simulation/browser/network_snapshot.js':'4f69313b8ddc34c5c6eb315168d5483eb36e6ac70eda2399bf8ca435e9516987',
 'user_application/web/scripts/nodes/links.js':'83a119b3aa9a129076db7bbf755946bd0582824e17d10b1966f1576b6d923cd5',
};
const [root,output]=process.argv.slice(2);if(!root||!output)throw Error('reference root and output required');
const code={};for(const [file,hash]of Object.entries(files)){
 const bytes=await readFile(resolve(root,file));if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('source hash mismatch:'+file);code[file]=bytes.toString('utf8');
}
const epoch=Date.UTC(2026,8,8);
class EvidenceDate extends Date{constructor(...args){super(...(args.length?args:[epoch]));}static now(){return epoch;}}
async function load(corrected){
 const context=vm.createContext({Date:EvidenceDate,structuredClone}),modules=new Map();
 for(const [file,text]of Object.entries(code))modules.set(file,new vm.SourceTextModule(corrected&&file.endsWith('/ground_links.js')
  ?text.replace('lookAnglesAt(position, station)','lookAnglesAt(position, { ...station, altitudeKm: station.altitude_km === undefined ? 0 : station.altitude_km })'):text,{context,identifier:file}));
 const imports={'/static/model_library/satellite_nodes.js':'digital_twin/model_library/browser/satellite_nodes.js',
 '/static/model_library/ground_stations.js':'digital_twin/model_library/browser/ground_stations.js',
 '/static/simulation/satellite_dynamics.js':'digital_twin/simulation/browser/satellite_dynamics.js',
 '/static/simulation/orbit.js':'digital_twin/simulation/browser/orbit.js','/static/simulation/oisl.js':'digital_twin/simulation/browser/oisl.js',
 '/static/simulation/ground_links.js':'digital_twin/simulation/browser/ground_links.js'};
 for(const module of modules.values())if(module.status==='unlinked')await module.link((name,from)=>{
  const file=imports[name]??posix.normalize(posix.join(posix.dirname(from.identifier),name));if(!modules.has(file))throw Error('unexpected source import:'+file);return modules.get(file);
 });
 for(const module of modules.values())await module.evaluate();
 return Object.fromEntries([...modules].map(([file,module])=>[file.split('/').at(-1).replace('.js',''),module.namespace]));
}
const source=await load(false),corrected=await load(true),json=value=>JSON.parse(JSON.stringify(value));
const library=source.satellite_nodes;let sequence=0;
const node=(bus,mode='nominal',mean=0)=>library.createNode({name:bus+' '+mode,bus,mode,orbit:{altitude_km:550,inclination:53,raan:0,mean_anomaly:mean,epoch}},{epoch,id:'NODE-'+(++sequence),catalogNumber:900000+sequence});
const a=node('comms_small'),b=node('comms_small','nominal',20),eo=node('eo_smallsat'),safe=node('eo_smallsat','safe');
const stations=['daejeon','jeju','svalbard'].map(preset=>source.ground_stations.createStation({preset}));
const initial=new Map([a,b].map(n=>[n.id,source.satellite_dynamics.nodeStateAt(n.orbit,epoch)]));
const primed=source.links.resolveLinks([a,b],initial,new Map(),epoch);
const at=epoch+120000,current=new Map([a,b].map(n=>[n.id,source.satellite_dynamics.nodeStateAt(n.orbit,at)]));
const pairs=source.links.resolveLinks([a,b],current,primed.histories,at).pairs;
const cases=[];
for(const [id,nodes,sites,faults]of [
 ['nominal',[a,b],stations,[]],['safe-and-payload',[eo,safe],stations,[]],
 ['faults',[a,b],stations,[{kind:'link_loss',target:b.name,active:true},{kind:'latency_spike',target:a.id,severity:'high',active:true},{kind:'latency_spike',target:a.id,severity:'low',active:true}]],
 ['inactive-fault',[a,b],stations,[{kind:'link_loss',target:a.id,active:false}]],['empty',[],[],[]],
 ['no-radio',[safe],[{...stations[0],bands:['Ka']}],[]],['zero-height',[a],[{...stations[0],altitude_km:0}],[]],
 ['below-sea-level',[a],[{...stations[0],altitude_km:-0.5}],[]],
]){
 const states=new Map(nodes.map(n=>[n.id,{geodetic:{latitude:stations[0].latitude,longitude:stations[0].longitude,altitude:550}}]));
 const input={date:at,nodes,stations:sites,faults,pairs:nodes.includes(b)?pairs:[],states:[...states]};
 const args={...input,states};cases.push({id,input:json(input),original:json(source.network_snapshot.buildNetworkSnapshot(args)),height_corrected:json(corrected.network_snapshot.buildNetworkSnapshot(args))});
}
const geometry=[];
for(const altitudeKm of [-0.5,0,0.07,9])for(const position of [{latitude:36.3742,longitude:127.3567,altitude:550},{latitude:-30,longitude:20,altitude:550},{latitude:90,longitude:0,altitude:550}]){
 const station={latitude:36.3742,longitude:127.3567,altitudeKm};geometry.push({position,station,expected:json(source.orbit.lookAnglesAt(position,station))});
}
await writeFile(output,JSON.stringify({schema:1,source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes:files,correction:'Only groundLink adapts station altitude_km to original lookAnglesAt altitudeKm; original and corrected results both retained.',cases,geometry},null,2)+'\n');
