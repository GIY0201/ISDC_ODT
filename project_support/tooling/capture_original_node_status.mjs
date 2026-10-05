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
 ['user_application/web/scripts/tabs/nodes.js','cfd4bd6ab4e58deaf312c6de7b8e30adac462041d4a042457793cb4b5da7ab1a'],
 ['user_application/web/scripts/orbit/satellite_models.js','716492592ccd5bf91dcb1149e5766acb712f56b9bc79d74f8684af297f2d4d2d']];
class EvidenceDate extends Date{constructor(...args){super(...(args.length?args:[epoch]));}static now(){return epoch;}}
const [root,output]=process.argv.slice(2);if(!root||!output)throw new Error('source root and output required');
const raw=await Promise.all(paths.map(async([path,hash])=>{const bytes=await readFile(resolve(root,path));if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error(`source_hash_mismatch:${path}`);return bytes.toString('utf8');}));
const context=vm.createContext({Date:EvidenceDate,structuredClone});
function sourceFunction(name,end){const begin=raw[3].indexOf(`function ${name}(`);const stop=raw[3].indexOf(end,begin);if(begin<0||stop<0)throw new Error('source_function_boundary');return raw[3].slice(begin,stop);}
const frame=sourceFunction('statusFrame','function bindStatusActions');
const live=sourceFunction('renderStatus','function renderSceneFoot');
const fleet=sourceFunction('renderFleet','function terminalRow');
const wrapped=`import * as library from '/static/model_library/satellite_nodes.js';import {escapeMarkup as esc,displayNumber,utcLabel} from '../orbit/catalog.js';import {describeMatch} from '../orbit/satellite_models.js';
const {BUS_PRESETS,FORMATION_PRESETS,NODE_MODES}=library;
let currentNode,currentMatch,statusKey,fleetKey;
const cells=new Map();const cell=name=>{if(!cells.has(name))cells.set(name,{textContent:'',innerHTML:'',className:'',style:{}});return cells.get(name);};
const panel={hidden:false,innerHTML:'',querySelector:selector=>cell(/data-live="([^"]+)"/.exec(selector)?.[1])};
const list={innerHTML:'',querySelectorAll:()=>[]},locate={disabled:false},counter={textContent:''};
const $=selector=>({'#node-status':panel,'#node-fleet':list,'#node-locate':locate,'#node-count':counter}[selector]);
const clock={now:()=>new Date(${epoch})},editor={isOpen:()=>false},manifestModels=[];
const lastStates=new Map(),lastLinks={terminals:[],pairs:[]};
const constellation={get selected(){return currentNode;},get drafts(){return [currentNode];},get selectedId(){return currentNode.id;}};
const modelMatchFor=()=>currentMatch;const linkStateOf=()=> 'neutral';function bindStatusActions(){}function terminalRow(){throw new Error('unexpected terminal');}
${frame}${live}${fleet}
export function capture(node,match,state){currentNode=node;currentMatch=match;statusKey=fleetKey=null;cells.clear();lastStates.clear();lastStates.set(node.id,state);renderStatus();renderFleet();const texts=Object.fromEntries([...cells].filter(([key])=>!['equipment','terminals','power-bar','margin-cell'].includes(key)).map(([key,value])=>[key,value.textContent]));return {frame:panel.innerHTML,fleet:list.innerHTML,live:{texts,equipment:cell('equipment').innerHTML,terminals:cell('terminals').innerHTML,bar:cell('power-bar').style}};}`;
const modules=raw.map((code,i)=>new vm.SourceTextModule(i===3?wrapped:code,{context,identifier:paths[i][0]}));
await modules[0].link(()=>{throw new Error('unexpected dynamics import');});
await modules[1].link(path=>{if(path!=='/static/simulation/satellite_dynamics.js')throw new Error(path);return modules[0];});
await modules[2].link(()=>{throw new Error('unexpected catalog import');});
await modules[3].link(path=>{const target={'/static/model_library/satellite_nodes.js':1,'../orbit/catalog.js':2,'../orbit/satellite_models.js':4}[path];if(target===undefined)throw new Error(path);return modules[target];});
for(const module of modules)await module.evaluate();
const library=modules[1].namespace;
const cases=Object.keys(library.BUS_PRESETS).map((bus,i)=>{
 const node=library.createNode({bus,name:i===4?'<name>':`source ${i}`,orbit:{epoch:new Date(epoch).toISOString()}},{epoch,id:`NODE-${i}`,catalogNumber:900001+i});
 const match=i===1?null:{quality:'assigned',provider:i===0?'spacetwin':'nasa',label:'source model',title:'representative',credit:'source credit',thumbnail:'/static/assets/model.png',sizeMeters:12};
 const state=modules[0].namespace.nodeStateAt(node.orbit,new Date(epoch));
 return {node,match,state,allTerminalsPower:library.powerBudget(node,{sunlit:state.sunlit,activeTerminals:null}),...modules[3].namespace.capture(node,match,state)};
});
await writeFile(resolve(output),JSON.stringify({source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes:Object.fromEntries(paths),epoch,cases},null,2)+'\n');
