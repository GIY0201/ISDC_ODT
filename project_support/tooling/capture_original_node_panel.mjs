// Bounded offline source control-flow evidence; never imported by the product.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import * as vm from 'node:vm';
const epoch=1791151272000;
const paths=[
 ['digital_twin/simulation/browser/satellite_dynamics.js','5580263519e45f6b3e1f7d2a5dbceae097d99d6949f8190ce8c87fe2145f6eb5'],
 ['digital_twin/model_library/browser/satellite_nodes.js','722323b356b8c0937896aff45f919300099aed789372054ec142148520eadafb'],
 ['user_application/web/scripts/orbit/catalog.js','90f98da034d2e6f8f44c35dc1c980828f177f23af6a8f435b18a9545ecbe4007'],
 ['user_application/web/scripts/tabs/nodes.js','cfd4bd6ab4e58deaf312c6de7b8e30adac462041d4a042457793cb4b5da7ab1a']];
class EvidenceDate extends Date{constructor(...args){super(...(args.length?args:[epoch]));}static now(){return epoch;}}
const [root,output]=process.argv.slice(2);if(!root||!output)throw new Error('source root and output required');
const raw=await Promise.all(paths.map(async([path,hash])=>{const bytes=await readFile(resolve(root,path));if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error(`source_hash_mismatch:${path}`);return bytes.toString('utf8');}));
const context=vm.createContext({Date:EvidenceDate,structuredClone});
function sourceFunction(name,end){const begin=raw[3].indexOf(`function ${name}(`);const stop=raw[3].indexOf(end,begin);if(begin<0||stop<0)throw new Error('source_function_boundary');return raw[3].slice(begin,stop);}
const controls=sourceFunction('controlEnabled','// Every slider');
const render=sourceFunction('renderFormationControls','// The computed layout');
const summary=sourceFunction('formationSummaryText','function renderFormationHints');
const wrapped=`import * as library from '/static/model_library/satellite_nodes.js';import {escapeMarkup as esc,displayNumber} from '../orbit/catalog.js';
const {FORMATION_CONTROLS,FORMATION_PRESETS}=library;let formationParams;
const host={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
const $=selector=>selector==='#formation-controls'?host:{};
const document={querySelectorAll:()=>[]};function renderFormationHints(){}
${controls}${render}${summary}
export function capture(params){formationParams=library.normalizeFormationParams(params);renderFormationControls();return {params:formationParams,markup:host.innerHTML,summary:formationSummaryText()};}`;
const modules=raw.map((code,i)=>new vm.SourceTextModule(i===3?wrapped:code,{context,identifier:paths[i][0]}));
await modules[0].link(()=>{throw new Error('unexpected dynamics import');});
await modules[1].link(path=>{if(path!=='/static/simulation/satellite_dynamics.js')throw new Error(path);return modules[0];});
await modules[2].link(()=>{throw new Error('unexpected catalog import');});
await modules[3].link(path=>{const target={'/static/model_library/satellite_nodes.js':1,'../orbit/catalog.js':2}[path];if(target===undefined)throw new Error(path);return modules[target];});
for(const module of modules)await module.evaluate();
const library=modules[1].namespace;
const formations=Object.keys(library.FORMATION_PRESETS).map(preset=>modules[3].namespace.capture({...library.FORMATION_DEFAULTS,preset}));
await writeFile(resolve(output),JSON.stringify({source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes:Object.fromEntries(paths),epoch,formations},null,2)+'\n');
