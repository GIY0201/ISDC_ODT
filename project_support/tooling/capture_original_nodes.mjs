// Offline evidence tooling only. Executes hash-pinned original modules in a VM;
// product modules never import this tool or its external reference checkout.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as vm from 'node:vm';

const SOURCE_COMMIT='1a1e00297a0301637455b0ef2cf48b2e74576b07';
const SOURCES=Object.freeze({
 'digital_twin/simulation/browser/satellite_dynamics.js':'5580263519e45f6b3e1f7d2a5dbceae097d99d6949f8190ce8c87fe2145f6eb5',
 'digital_twin/model_library/browser/satellite_nodes.js':'722323b356b8c0937896aff45f919300099aed789372054ec142148520eadafb',
});
const EPOCH=Date.parse('2026-10-04T22:01:12.000Z');
class EvidenceDate extends Date {
 constructor(...args){super(...(args.length ? args : [EPOCH]));}
 static now(){return EPOCH;}
}

function jsonCopy(value){
 const check=x=>{
  if(typeof x==='number'&&!Number.isFinite(x))throw new Error('nonfinite_original_result');
  if(x&&typeof x==='object')for(const v of Object.values(x))check(v);
 };
 check(value);return JSON.parse(JSON.stringify(value));
}

export async function createOriginalNodeGolden({sourceRoot,stateOffsetsSeconds=[-86400,0,1,600,86400],additionalOrbits=[]}={}){
 if(!Array.isArray(stateOffsetsSeconds)||!stateOffsetsSeconds.length||stateOffsetsSeconds.length>100||stateOffsetsSeconds.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw new Error('invalid_state_offsets');
 if(!Array.isArray(additionalOrbits)||additionalOrbits.length>20||additionalOrbits.some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw new Error('invalid_additional_orbits');
 if(typeof sourceRoot!=='string'||!sourceRoot.trim())throw new Error('source_root_required');
 const raw=[];
 // Validate every byte before creating or evaluating any original module.
 for(const [path,sha256] of Object.entries(SOURCES)){
  const bytes=await readFile(resolve(sourceRoot,path));
  if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error(`source_hash_mismatch:${path}`);
  raw.push({path,sha256,code:bytes.toString('utf8')});
 }
 if(typeof vm.SourceTextModule!=='function')throw new Error('vm_modules_flag_required: use node --experimental-vm-modules');
 const context=vm.createContext({Date:EvidenceDate,structuredClone});
 const modules=raw.map(s=>new vm.SourceTextModule(s.code,{context,identifier:s.path}));
 await modules[0].link(()=>{throw new Error('unexpected_dynamics_import');});
 await modules[1].link(specifier=>{
  if(specifier!=='/static/simulation/satellite_dynamics.js')throw new Error(`unexpected_node_import:${specifier}`);
  return modules[0];
 });
 await modules[0].evaluate();await modules[1].evaluate();
 const dynamics=modules[0].namespace,nodes=modules[1].namespace;
 const cases=[],SetInSource=vm.runInContext('Set',context);
 let sequence=0;
 const idFactory=()=>({id:`NODE-${String(++sequence).padStart(4,'0')}`,catalogNumber:nodes.NODE_CATALOG_BASE+sequence});
 const capture=(id,input,expected)=>cases.push(jsonCopy({id,input,expected}));
 for(const bus of Object.keys(nodes.BUS_PRESETS)){
  const ids=idFactory(),node=nodes.createNode({bus},{epoch:EPOCH,...ids});
  capture(`bus:${bus}`,{partial:{bus},options:{epoch:EPOCH,...ids}},node);
  for(const mode of Object.keys(nodes.NODE_MODES))for(const sunlit of [true,false]){
   const input={node:{...node,mode},options:{sunlit}};
   capture(`power:${bus}:${mode}:${sunlit}`,input,nodes.powerBudget(input.node,input.options));
  }
  capture(`mass:${bus}`,{node},nodes.nodeMass(node));
  capture(`catalog:${bus}`,{node},nodes.nodeCatalogItem(node));
  const first=nodes.activeOislTerminals(node)[0];
  const selected=first?[first.id]:[];
  capture(`terminal-power:${bus}`,{node,options:{sunlit:true,activeTerminals:selected}},
   nodes.powerBudget(node,{sunlit:true,activeTerminals:new SetInSource(selected)}));
 }
 for(const preset of Object.keys(nodes.FORMATION_PRESETS))for(const link_policy of Object.keys(nodes.LINK_POLICIES)){
  const params={preset,link_policy,planes:3,per_plane:4,phasing:2,spacing_deg:17,raan_start:350,anomaly_start:355,prefix:'ODT'};
  const startSequence=sequence,options={epoch:EPOCH,formationId:`FRM-${preset}-${link_policy}`};
  capture(`formation:${preset}:${link_policy}`,{params,options,startSequence},
   {normalized:nodes.normalizeFormationParams(params),summary:nodes.formationSummary(params),nodes:nodes.generateFormation(params,{...options,idFactory})});
 }
 const orbitalInputs=[
  {altitude_km:550,eccentricity:0,inclination:53,raan:20,argp:30,mean_anomaly:40,epoch:EPOCH},
  {altitude_km:5000,eccentricity:0.2,inclination:63.4,raan:315,argp:45,mean_anomaly:240,epoch:EPOCH},
  {altitude_km:35786,eccentricity:0,inclination:0,raan:0,argp:0,mean_anomaly:0,epoch:EPOCH},
  {altitude_km:800,eccentricity:0.001,inclination:98,raan:180,argp:20,mean_anomaly:90,epoch:EPOCH},
 ];
 for(const [index,orbit] of [...orbitalInputs,...additionalOrbits].entries()){
  capture(`elements:${index}`,{orbit},dynamics.orbitElements(orbit));
  for(const seconds of stateOffsetsSeconds){
   const millis=EPOCH+seconds*1000;
   capture(`state:${index}:${seconds}`,{orbit,millis},dynamics.nodeStateAt(orbit,millis));
  }
 }
 for(const [id,change] of Object.entries({e_limit:{eccentricity:0.95},inclination:{inclination:181},perigee:{altitude_km:119},apogee:{altitude_km:200001}})){
  const orbit={...orbitalInputs[0],...change};capture(`invalid-orbit:${id}`,{orbit},dynamics.orbitElements(orbit));
 }
 const invalidPower=nodes.createNode({}, {epoch:EPOCH,...idFactory()});invalidPower.power.generation_w=Infinity;
 capture('known-source-gap:infinite-power',{}, {validationErrors:nodes.validateNode(invalidPower),acceptsInfinity:nodes.validateNode(invalidPower).length===0});
 return jsonCopy({schema:1,source:{repository:'https://github.com/HyeonJun9138/ISDC-ODT',commit:SOURCE_COMMIT,files:raw.map(({path,sha256})=>({path,sha256}))},
  evidence:{epoch:EPOCH,frozen_clock:true,units:{distance:'km',speed:'km/s',time:'Unix milliseconds; internal seconds',angles:'degrees; internal radians'},
   frame:'original pseudo-inertial / GMST-only Earth-fixed; UTC approximates UT1; no polar motion',
   meaning:'original engineering model behavior, not independent physical accuracy or GP/SGP4 equivalence'},
  definitions:Object.fromEntries(['NODE_SCHEMA','NODE_CATALOG_BASE','EQUIPMENT_KINDS','OISL_ROLES','EQUIPMENT_CATALOG','BUS_PRESETS','NODE_MODES','FORMATION_PRESETS','LINK_POLICIES','FORMATION_CONTROLS','FORMATION_DEFAULTS'].map(key=>[key,nodes[key]])),cases});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--source-root'||args[2]!=='--output')throw new Error('usage: --source-root <reference> --output <fixture>');
 const output=resolve(args[3]),root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
 const inside=(parent,target)=>{const p=relative(parent,target);return p!==''&&!p.startsWith('..')&&!isAbsolute(p);};
 if(![resolve(root,'project_support/tests/fixtures'),resolve(root,'data/workspace/validation')].some(p=>inside(p,output)))throw new Error('output_outside_evidence_directories');
 if(inside(resolve(args[1]),output))throw new Error('output_inside_reference');
 const fixture=await createOriginalNodeGolden({sourceRoot:args[1]});
 await writeFile(output,`${JSON.stringify(fixture,null,2)}\n`,'utf8');
 process.stdout.write(`${JSON.stringify({cases:fixture.cases.length,source_commit:SOURCE_COMMIT,output:relative(root,output)})}\n`);
}
