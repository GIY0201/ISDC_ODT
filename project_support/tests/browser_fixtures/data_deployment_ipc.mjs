// Actual browser client/store talking to the actual Python ASGI router via test IPC.
import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {createDataDeployment} from '../../../user_application/web/scripts/nodes/data_deployment.js';
import {createConstellationStore} from '../../../user_application/web/scripts/nodes/constellation.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';

const input=createInterface({input:process.stdin})[Symbol.asyncIterator]();
let ids=0,equipment=0,client;
const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++equipment}`});
const store=createConstellationStore({library,now:()=>1791151272000,verifyAcceptance:(...args)=>client.verifyAcceptance(...args)});
store.load();
const fetchImpl=async(url,options)=>{
  process.stdout.write(JSON.stringify({kind:'request',url,method:options.method,body:options.body?JSON.parse(options.body):null})+'\n');
  const {value,done}=await input.next();if(done)throw new Error('test transport closed');
  const reply=JSON.parse(value);if(reply.drop)throw new Error('reply lost after server acceptance');
  return new Response(JSON.stringify(reply.body),{status:reply.status,headers:{'content-type':'application/json'}});
};
client=createDataDeployment({constellation:store,fetchImpl,createId:()=>`DEP-${++ids}`});
try{
  await client.initialize();const sent=store.add({name:'sent',bus:'eo_small'});
  await assert.rejects(client.deploy(),/reply lost/);assert.equal(store.deployed.length,0);
  store.update(sent.id,{...sent,orbit:{...sent.orbit,altitude_km:sent.orbit.altitude_km+10}});
  await client.deploy();assert.equal(client.state.server.revision,1);assert.equal(store.deploymentConfirmed,true);
  assert.equal(store.deployed[0].orbit.altitude_km,sent.orbit.altitude_km);
  const changed=store.drafts[0];store.update(changed.id,{...changed,name:'explicit reapply'});
  await assert.rejects(client.deploy(),error=>error.status===409);
  assert.equal(client.state.server.revision,2);assert.equal(client.state.syncRequired,true);
  await client.deploy();assert.equal(client.state.server.revision,3);
  await client.recall();assert.equal(client.state.server.revision,4);assert.equal(store.deployed.length,0);assert.equal(store.drafts.length,1);
  process.stdout.write(JSON.stringify({kind:'result',server:client.state.server,confirmed:store.deploymentConfirmed,draft:store.drafts[0].name})+'\n');
}finally{client.destroy();process.stdin.destroy();}
