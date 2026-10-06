// Offline execution of the original deployment client with a deterministic transport.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

export async function trace(createDataDeployment){
  const copy=structuredClone,events=[],requests=[];let ids=0,fail=false;
  const node=id=>({id,name:`  ${id}  `,mode:'nominal',equipment:[{id:'store',catalog:'dtn_store',enabled:true,role:'auto'}],orbit:{altitude_km:550}});
  let drafts=[],deployed=[],server={deployment_id:null,revision:0,nodes:[],run_id:'RUN-1',scope_id:'RUN-1:unconfigured'};
  const constellation={get drafts(){return copy(drafts);},get deployed(){return copy(deployed);},
    deploy:nodes=>{deployed=copy(nodes);},recall:()=>{deployed=[];},deployedItems:()=>copy(deployed.map(n=>({id:n.id})))};
  const fetchImpl=async(url,options)=>{
    const body=options.body?JSON.parse(options.body):null;
    requests.push({url,method:options.method,cache:options.cache,headers:options.headers??null,body});
    if(options.method==='GET')return {ok:true,status:200,json:async()=>copy(server)};
    if(fail){fail=false;throw new Error('offline');}
    if(body.deployment_id!==server.deployment_id){
      server={deployment_id:body.deployment_id,revision:body.expected_revision+1,nodes:body.nodes,run_id:'RUN-1',scope_id:`RUN-1:deployment:${body.deployment_id}`};
    }
    return {ok:true,status:200,json:async()=>copy(server)};
  };
  const client=createDataDeployment({constellation,fetchImpl,createId:()=>`DEP-${++ids}`,emit:(type,data)=>events.push({type,data:copy(data)})});
  const rows=[];
  const state=()=>{const {server,error,syncRequired,busy}=client.state;return {server,error,syncRequired,busy,deployed:copy(deployed),drafts:copy(drafts)};};
  await client.initialize();rows.push({operation:'initialize',state:state()});
  drafts=[node('A')];await client.deploy();rows.push({operation:'deploy',state:state()});
  await client.deploy();rows.push({operation:'idempotent',state:state()});
  drafts=[node('B')];fail=true;
  try{await client.deploy();}catch(error){rows.push({operation:'offline',error:error.message,state:state()});}
  await client.deploy();rows.push({operation:'retry',state:state()});
  await client.recall();rows.push({operation:'recall',state:state()});
  client.destroy?.();
  return {requests,events,rows};
}

async function main(root,output){
  const name='user_application/web/scripts/nodes/data_deployment.js';
  const raw=await readFile(path.join(root,name));const sha=createHash('sha256').update(raw).digest('hex');
  const expected='3774b247d3fe3fb1048ea583b2f2ac1547e3c488f3e2b64d97b46a5900b438b4';
  if(sha!==expected)throw new Error('source hash mismatch');
  const original=await import(`data:text/javascript;base64,${raw.toString('base64')}`);
  const receipt={source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes:{[name]:sha},
    evidence:'Original client executed with deterministic injected transport/presentation harness; no live HTTP/store authority claim',
    ...await trace(original.createDataDeployment)};
  const bytes=Buffer.from(JSON.stringify(receipt,null,2)+'\n');await writeFile(output,bytes);
  process.stdout.write(JSON.stringify({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main(...process.argv.slice(2));
