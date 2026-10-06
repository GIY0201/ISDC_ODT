import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import {createFabricExchange} from '../../../user_application/web/scripts/tabs/fabric_exchange.js';
import {createDataFabricClient} from '../../../communication/browser/data_fabric.js';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
for(const [width,height] of [[1280,720],[1920,1080]])test(`source transport/controller/ground presentation share one verified input ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#ground'});let panel;
 try{
  const store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');let changed=false,sequence=0,conflict=false;const calls=[];
  const proof={status:'valid',utc:'2026-09-07T12:00:00.000000000Z',definition_hashes:{A:'native'},stations:store.stations,faults:[],network:{time:'2026-09-07T12:00:00.000Z',nodes:[{id:'A',name:'위성 A'},{id:'G',name:'지상국 G'}],links:[{id:'AG',kind:'ground'}]}};
  const network={networkSnapshot:()=>changed?{status:'unavailable'}:structuredClone(proof),verifyNetworkSnapshot:v=>!changed&&JSON.stringify(v)===JSON.stringify(proof),clearNetwork:()=>{changed=true;},updateNetwork:async()=>proof};
  const client=createDataFabricClient({fetchImpl:async(url,options)=>{
   calls.push({url,options});
   if(url.endsWith('/status'))return {ok:true,status:200,json:async()=>({exchange_contract:'guarded-v1',reachable:true,instance_id:'one',sequence,network_hash:sequence?'a'.repeat(64):null})};
   if(conflict)return {ok:false,status:409,json:async()=>({detail:'다른 창 변경'})};
   const base={exchange_contract:'guarded-v1',instance_id:'one',network_hash:'a'.repeat(64)};
   if(url.endsWith('/network')){sequence++;return {ok:true,status:200,json:async()=>({...base,sequence,request_id:options.headers['X-ISDC-Fabric-Request-Id'],elapsed_s:10,summary:{stored_mb:4.5,delivered_mb:5.25,dropped_mb:0},links:[{id:'AG',quality:88,usable:true}]})};}
   return {ok:true,status:200,json:async()=>({...base,sequence,...JSON.parse(options.body),status:'available',path:['A','G'],total_delay_ms:2,bottleneck_mbps:10,reliability:0.88})};
  }});
  const fabric=createFabricExchange({client,network,clientId:'panel_test',onChange:()=>panel?.update()});
  panel=createGroundNetworkPanel({store,model,network,fabric,document:f.doc,host:f.win,refreshRuntime:async()=>{}});panel.show('ground');
  assert.equal(calls.length,0);await f.get('ground-node-fabric-send').dispatch('click');
  assert.match(f.get('ground-node-fabric-status').textContent,/모의 통신망 수락/);assert.match(f.get('ground-node-fabric-dtn').textContent,/4.5 MB.*5.25 MB/);assert.match(f.get('ground-node-fabric-results').innerHTML,/88/);
  assert.deepEqual(JSON.parse(calls.find(c=>c.url.endsWith('/network')).options.body),proof.network);
  for(const [field,value] of [['source','A'],['target','G'],['objective','latency']]){f.get('ground-node-fabric-'+field).value=value;await f.get('ground-node-fabric-'+field).dispatch('change');}
  assert.equal(f.get('ground-node-fabric-route').disabled,false);
  await f.get('ground-node-fabric-route').dispatch('click');assert.match(f.get('ground-node-fabric-path').textContent,/A → G.*2 ms.*10 Mbps/);
  conflict=true;await f.get('ground-node-fabric-route').dispatch('click');assert.equal(f.get('ground-node-fabric-send').disabled,true);assert.match(f.get('ground-node-fabric-status').textContent,/다른 창/);assert.match(f.get('ground-node-fabric-dtn').textContent,/未確認|미확인/);
  conflict=false;await f.get('ground-node-fabric-refresh').dispatch('click');assert.equal(f.get('ground-node-fabric-send').disabled,false);
  changed=true;panel.update();assert.equal(f.get('ground-node-fabric-send').disabled,true);assert.match(f.get('ground-node-fabric-path').textContent,/미확인/);
  panel.destroy();fabric.destroy();await f.win.dispatch('pagehide',{persisted:false});
 }finally{panel?.destroy();f.dispose();}
});
