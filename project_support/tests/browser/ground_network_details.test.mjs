import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import {layoutNetwork,diagramMarkup} from '../../../digital_twin/visualization/network_diagram.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
for(const [width,height] of [[1280,720],[1920,1080]])test(`verified ground SVG, individual custody and hop details ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#ground'});let panel;
 try{
  const store=f.evaluate('sourceGround');f.evaluate('groundNetworkPanel.destroy()');let valid=true,accepted=false;const projections=[];
  const proof={status:'valid',utc:'2026-09-07T12:00:00.000000000Z',node_definitions:[{id:'A',name:'A<script>',orbit:{raan:50,mean_anomaly:22},formation:{id:'F',plane:1,index:0}}],stations:[{id:'G',name:'Station',longitude:127,enabled:true},{id:'off',enabled:false}],network:{nodes:[{id:'A',name:'A<script>',kind:'satellite'},{id:'G',name:'Station',kind:'ground'}],links:[{id:'AG',a:'A',b:'G',kind:'ground',range_km:400}]}};
  const receipt={sequence:1,summary:{stored_mb:12,delivered_mb:1,dropped_mb:0},elapsed_s:3,nodes:[{id:'A',kind:'satellite',custody:'storing',stored_mb:12,capacity_mb:20,generation_mbps:2,next_hop:'G',ground_path:false}],links:[{id:'AG',quality:91,usable:true}]};
  const route={status:'available',path:['A','G'],hop_list:[{link_id:'AG',from:'A',to:'G',kind:'ground',delay_ms:4,capacity_mbps:8000,quality:91}],total_delay_ms:4,bottleneck_mbps:8000,reliability:.91};
  const sceneCalls=[],networkScene={setSnapshot:value=>sceneCalls.push(value),setGroundLinksVisible:value=>sceneCalls.push({links:value}),setCoverageVisible:value=>sceneCalls.push({coverage:value}),clear:()=>sceneCalls.push({clear:true})};
  const network={networkSnapshot:()=>structuredClone(proof),verifyNetworkSnapshot:()=>valid,clearNetwork(){valid=false;}};
  const fabric={snapshot:()=>({receipt:accepted?structuredClone(receipt):null,route:accepted?structuredClone(route):null}),send:async()=>{accepted=true;},route:async()=>{},refresh:async()=>{}};
  const diagram={layoutNetwork:input=>{projections.push(input);return input;},diagramMarkup:(layout,links,options)=>`<svg data-quality="${links[0]?.quality??'unknown'}" data-route="${[...options.routeLinkIds].join(',')}">${layout.satellites[0]?.name}</svg>`,CUSTODY_LABELS:{storing:'보관 중 (지상 경로 없음)'},LINK_KIND_LABELS:{ground:'지상 RF 링크'}};
  panel=createGroundNetworkPanel({store,model,network,fabric,diagram,networkScene,document:f.doc,host:f.win,refreshRuntime:async()=>{}});panel.show('ground');
  assert.match(f.get('ground-node-diagram').innerHTML,/data-quality="unknown"/);
  assert.equal(sceneCalls.at(-1).snapshot.utc,proof.utc);
  await f.get('ground-node-scene-links').dispatch('click');assert.deepEqual(sceneCalls.filter(v=>Object.hasOwn(v,'links')).at(-1),{links:false});
  await f.get('ground-node-scene-coverage').dispatch('click');assert.deepEqual(sceneCalls.filter(v=>Object.hasOwn(v,'coverage')).at(-1),{coverage:false});
  assert.equal(projections.at(-1).satellites[0].raan,50);assert.deepEqual(projections.at(-1).stations.map(s=>s.id),['G']);
  assert.equal(f.get('ground-node-fabric-custody').innerHTML,'');
  await f.get('ground-node-fabric-send').dispatch('click');
  assert.match(f.get('ground-node-diagram').innerHTML,/data-quality="91".*data-route="AG"/);
  assert.match(f.get('ground-node-fabric-custody').innerHTML,/A&lt;script&gt;.*보관 중.*12.*20.*2.*Station/);
  assert.match(f.get('ground-node-fabric-hops').innerHTML,/A&lt;script&gt; → Station.*지상 RF 링크.*4.*8.*91/);
  diagram.layoutNetwork=layoutNetwork;diagram.diagramMarkup=diagramMarkup;panel.update();
  assert.match(f.get('ground-node-diagram').innerHTML,/<svg.*data-diagram-link="AG"/);
  assert.match(f.get('ground-node-diagram').innerHTML,/nd-ground-line ground routed/);
  assert.match(f.get('ground-node-diagram').innerHTML,/A&lt;script&gt;/);assert.doesNotMatch(f.get('ground-node-diagram').innerHTML,/<script>/);
  assert.match(f.get('ground-node-diagram').innerHTML,/Ω 50°/);
  await f.get('ground-node-diagram').dispatch('click',{target:{closest:()=>({getAttribute:key=>key==='data-diagram-link'?'AG':null})}});
  assert.match(f.get('ground-node-diagram-detail').innerHTML,/range_km.*400/s);
  valid=false;panel.update();assert.ok(sceneCalls.some(v=>v.clear));assert.equal(f.get('ground-node-diagram-detail').innerHTML,'');assert.equal(f.get('ground-node-diagram').innerHTML,'');assert.equal(f.get('ground-node-fabric-custody').innerHTML,'');assert.equal(f.get('ground-node-fabric-hops').innerHTML,'');
  valid=true;accepted=false;panel.update();assert.match(f.get('ground-node-diagram-status').textContent,/미확인/);assert.doesNotMatch(f.get('ground-node-diagram').innerHTML,/data-diagram-link=/);assert.equal(f.get('ground-node-fabric-custody').innerHTML,'');
  assert.equal(f.counts().commands,0);
 }finally{panel?.destroy();f.dispose();}
});

test('network diagram exact default output preserves pinned source across topology and UI states',()=>{
 const golden=JSON.parse(readFileSync(new URL('../fixtures/original_network_diagram_outputs.json',import.meta.url),'utf8'));
 assert.equal(golden.source_commit,'1a1e00297a0301637455b0ef2cf48b2e74576b07');
 assert.equal(golden.windows_source_sha256,'eab9d9183a691cd6809a96476bf67af28a0acb1fd633bd2526db7059cd67e9af');
 assert.equal(golden.source_sha256,'b74f2672bedd632aaf1631c2565a3fd6e1d9b7c73ae3fc07252bff7e9c9525fe');
 assert.equal(golden.cases.length,10);
 for(const item of golden.cases){const options={...item.options};if(options.routeLinkIds)options.routeLinkIds=new Set(options.routeLinkIds);if(options.nodeStates)options.nodeStates=new Map(options.nodeStates);const output=diagramMarkup(layoutNetwork(item.layout),item.links,options).replace(/\r\n/g,'\n');assert.equal(createHash('sha256').update(output).digest('hex'),item.output_sha256,item.id);}
});
