// Bounded offline source control-flow evidence; never imported by the product.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import * as vm from 'node:vm';
const epoch=1791151272000;
const paths=[
 ['digital_twin/simulation/browser/satellite_dynamics.js','5580263519e45f6b3e1f7d2a5dbceae097d99d6949f8190ce8c87fe2145f6eb5'],
 ['digital_twin/model_library/browser/satellite_nodes.js','722323b356b8c0937896aff45f919300099aed789372054ec142148520eadafb'],
 ['user_application/web/scripts/nodes/constellation.js','a4b7a68595ae219688ee16922fe58af852d2a074641c7185081242cc9760f231']];
class EvidenceDate extends Date{constructor(...args){super(...(args.length?args:[epoch]));}static now(){return epoch;}}
const [root,output]=process.argv.slice(2);if(!root||!output)throw new Error('source root and output required');
const raw=await Promise.all(paths.map(async([path,hash])=>{const bytes=await readFile(resolve(root,path));if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error(`source_hash_mismatch:${path}`);return bytes.toString('utf8');}));
const context=vm.createContext({Date:EvidenceDate,structuredClone});
const modules=raw.map((code,i)=>new vm.SourceTextModule(code,{context,identifier:paths[i][0]}));
await modules[0].link(()=>{throw new Error('unexpected dynamics import');});
await modules[1].link(path=>{if(path!=='/static/simulation/satellite_dynamics.js')throw new Error(path);return modules[0];});
await modules[2].link(path=>{if(path!=='/static/model_library/satellite_nodes.js')throw new Error(path);return modules[1];});
for(const module of modules)await module.evaluate();
const store=modules[2].namespace.createConstellationStore({storage:null,now:()=>epoch});const steps=[];
function capture(operation,args=[]){
 if(operation==='update')store.update(args[0],{...store.find(args[0]),notes:args[1]});else store[operation](...args);
 steps.push(JSON.parse(JSON.stringify({operation,args,expected:{drafts:store.drafts,deployed:store.deployed,deployedAt:store.deployedAt,selectedId:store.selectedId,dirty:store.isDirty()}})));
}
capture('load');capture('add',[{bus:'flat_panel'}]);capture('add',[{name:'second'}]);capture('duplicate',['NODE-0001']);capture('update',['NODE-0002','changed']);capture('select',['NODE-0001']);capture('remove',['NODE-0003']);capture('deploy');capture('add',[{name:'later'}]);capture('recall');capture('clear');
await writeFile(resolve(output),JSON.stringify({source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes:Object.fromEntries(paths),epoch,steps},null,2)+'\n');
