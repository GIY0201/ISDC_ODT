import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';

for(const [width,height] of [[1920,1080],[2560,1440]])test(`complete custody and route hops remain independent of contact paging ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#ground'});let panel;
 try{
  const store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');
  let valid=true;
  const nodes=Array.from({length:61},(_,i)=>({id:`N${i}`,name:`Node ${i}`,kind:'satellite'}));
  const snapshot={status:'valid',utc:'2026-10-07T00:00:00.000000000Z',network:{nodes,links:[]},node_definitions:nodes,stations:[]};
  const custody=nodes.map((node,i)=>({...node,custody:'storing',stored_mb:i,capacity_mb:100,generation_mbps:2,next_hop:i<60?`N${i+1}`:null}));
  const route={status:'available',path:['N0','N1','N2','N3'],hop_list:Array.from({length:3},(_,i)=>({link_id:`L${i}`,from:`N${i}`,to:`N${i+1}`,kind:'optical',delay_ms:i+1,capacity_mbps:8000,quality:90})),total_delay_ms:6,bottleneck_mbps:8000,reliability:.9};
  const receipt={sequence:1,nodes:custody,links:[],summary:{stored_mb:1830,delivered_mb:0,dropped_mb:0},elapsed_s:1};
  const station=store.enabled[0];
  const stamp=seconds=>new Date(Date.parse(snapshot.utc)+seconds*1000).toISOString().replace('.000Z','.000000000Z');
  const contacts={accepted_context:{utc:snapshot.utc},node_definitions:nodes,conditions:{end_utc:'2026-10-07T03:00:00.000000000Z'},contact_reports:[{station_id:station.id,geometry:{minimum_elevation_deg:station.min_elevation_deg,coverage:{resolution_seconds:30},passes:Array.from({length:51},(_,i)=>({satellite:'N0',start:stamp(i*60),end:stamp(i*60+1),duration_seconds:1,max_elevation_deg:45,in_progress:false,truncated:false}))}}]};
  const fabric={snapshot:()=>({receipt:structuredClone(receipt),route:structuredClone(route)}),send:async()=>{},refresh:async()=>{},route:async()=>{}};
  panel=createGroundNetworkPanel({store,model,network:{networkSnapshot:()=>structuredClone(snapshot),verifyNetworkSnapshot:()=>valid,clearNetwork(){}},fabric,contactWindows:{query:async()=>structuredClone(contacts),verify:()=>valid},document:f.doc,host:f.win,refreshRuntime:async()=>{}});
  panel.show('ground');
  const count=id=>(f.get(id).innerHTML.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr>/g)||[]).length;
  const initialCounts={custody:count('ground-node-fabric-custody'),hops:count('ground-node-fabric-hops')};
  const before={custody:f.get('ground-node-fabric-custody').innerHTML,hops:f.get('ground-node-fabric-hops').innerHTML};
  await f.get('ground-node-pass-query').dispatch('click');
  assert.equal(count('ground-node-pass-results'),50);
  await f.get('ground-node-pass-next').dispatch('click');
  assert.equal(count('ground-node-pass-results'),1);
  assert.deepEqual({before:initialCounts,after:{custody:count('ground-node-fabric-custody'),hops:count('ground-node-fabric-hops')}},{before:{custody:61,hops:3},after:{custody:61,hops:3}},'complete custody and hops are independent of contact pagination');
  assert.equal(f.get('ground-node-fabric-custody').innerHTML,before.custody);
  assert.equal(f.get('ground-node-fabric-hops').innerHTML,before.hops);
  valid=false;panel.update();
  assert.equal(f.get('ground-node-fabric-custody').innerHTML,'');
  assert.equal(f.get('ground-node-fabric-hops').innerHTML,'');
  assert.equal(f.counts().commands,0);
 }finally{panel?.destroy();f.dispose();}
});
