import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {createGroundNetworkPanel} from '../../../user_application/web/scripts/tabs/ground_network.js';
import * as model from '../../../digital_twin/model_library/browser/ground_stations.js';
import * as diagramModel from '../../../digital_twin/visualization/network_diagram.js';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function setup(width=1280,height=720){
 const f=fixture(width,height,{hash:'#ground'});f.evaluate('groundNetworkPanel.destroy()');
 const stations=Array.from({length:24},(_,i)=>({...model.createStation({preset:'daejeon'}),id:'G'+i,name:'Ground '+i}));
 const nodes=Array.from({length:240},(_,i)=>({id:'N'+i,name:'Native '+i+(i===0?' <script>':''),orbit:{raan:Math.floor(i/40)*60},formation:{id:'F',plane:Math.floor(i/40),index:i%40}}));
 const view=freeze({presentation_kind:'NETWORK_SAMPLED_UI_V1',status:'valid',utc:'2026-10-07T00:00:00.000000000Z',analysis_utc:'2026-10-07T00:00:00.000000000Z',display_utc:'2026-10-07T00:00:02.500000000Z',age_seconds:2.5,current_analysis:false,availability:'pending',reason:'pending_current_analysis',node_definitions:nodes,stations,faults:[],network:{nodes:[...nodes.map(n=>({...n,kind:'satellite'})),...stations.map(s=>({...s,kind:'ground'}))],links:nodes.map(n=>({id:n.id+'G',a:n.id,b:'G0',kind:'ground',state:'visible',usable:true,quality:100}))}});
 const state={valid:true,view,diagramHook:null,readHook:null},registered=new WeakSet([view]),calls=[];
 const store={ready:true,stations,selectedId:'G0',persistence:'memory_only',error:'',availablePresets:()=>[],find:id=>stations.find(s=>s.id===id),subscribe:()=>()=>{},get enabled(){return stations;}};
 const network={networkSnapshot:()=>({status:'unavailable'}),verifyNetworkSnapshot:()=>false,networkSampledPresentation:()=>{state.readHook?.();return state.view;},verifySampledNetworkPresentation:v=>state.valid&&v===state.view&&registered.has(v),clearNetwork:()=>{state.valid=false;}};
 const fabric={snapshot:()=>({receipt:{sequence:1,summary:{stored_mb:100,delivered_mb:20},nodes:[{id:'N0',custody:'delivering',stored_mb:50}],links:[{id:'N0G',usable:true,quality:100}]},route:{status:'available',hop_list:[{link_id:'N0G'}]}}),send:async()=>calls.push('send'),refresh:async()=>{},route:async()=>calls.push('route')};
 const scene={setActive:v=>calls.push(['active',v]),clear:()=>calls.push('clear'),setSnapshot:v=>calls.push(['snapshot',v]),setGroundLinksVisible:v=>calls.push(['links',v]),setCoverageVisible:v=>calls.push(['coverage',v])};
 const diagram={...diagramModel,layoutNetwork(input){state.diagramHook?.();return diagramModel.layoutNetwork(input);}};
 const panel=createGroundNetworkPanel({store,model,network,fabric,diagram,networkScene:scene,document:f.doc,host:f.win,refreshRuntime:async()=>{}});
 return {f,panel,state,calls,view,registered,scene,network};
}
for(const [width,height]of [[1280,720],[1920,1080]])test(`sampled ground presentation keeps full240/24 scope and unknown action quality ${width}x${height}`,async()=>{
 const s=setup(width,height);try{
  s.panel.show('ground');const get=s.f.get;
  assert.match(get('ground-node-summary').textContent,/분석 UTC 2026-10-07T00:00:00\.000000000Z/);assert.match(get('ground-node-summary').textContent,/표시 UTC 2026-10-07T00:00:02\.500000000Z/);assert.match(get('ground-node-summary').textContent,/2\.500 s.*현재 분석.*미확인/);assert.match(get('ground-node-summary').textContent,/갱신 중/);
  const markup=get('ground-node-diagram').innerHTML;assert.equal([...markup.matchAll(/data-diagram-node=/g)].length,264);assert.match(markup,/통신 품질 미확인/);assert.doesNotMatch(markup,/nd-flow forward|100%|routed/);
  assert.match(get('ground-node-results').innerHTML,/N0G/);assert.equal(get('ground-node-next').disabled,false);await get('ground-node-next').dispatch('click');assert.match(get('ground-node-results').innerHTML,/N50G/);
  assert.equal(get('ground-node-fabric-send').disabled,true);assert.equal(get('ground-node-fabric-route').disabled,true);assert.equal(get('ground-node-fabric-custody').innerHTML,'');assert.equal(get('ground-node-fabric-hops').innerHTML,'');assert.equal(s.calls.some(c=>Array.isArray(c)&&c[0]==='snapshot'),false,'sampled view never passes through exact setSnapshot');assert.equal(s.calls.includes('clear'),false,'ordinary verified pending does not deactivate consumer');
  s.panel.show('satellite');assert.ok(s.calls.includes('clear'));assert.deepEqual(s.calls.filter(Array.isArray).filter(c=>c[0]==='active').at(-1),['active',false]);
  s.panel.show('ground');assert.deepEqual(s.calls.filter(Array.isArray).filter(c=>c[0]==='active').at(-1),['active',true]);
 }finally{s.panel.destroy();s.f.dispose();}
});
test('copied or revoked sampled ground view cannot retain diagram or analysis claim',()=>{
 const s=setup();try{s.panel.show('ground');s.state.view=structuredClone(s.view);s.panel.update();assert.equal(s.f.get('ground-node-diagram').innerHTML,'');assert.doesNotMatch(s.f.get('ground-node-summary').textContent,/분석 UTC/);s.state.view=s.view;s.state.valid=false;s.panel.update();assert.equal(s.f.get('ground-node-diagram').innerHTML,'');}finally{s.panel.destroy();s.f.dispose();}
});
test('leaving ground inside diagram callback cannot publish stale sampled contents',()=>{
 const s=setup();try{s.panel.show('ground');s.state.diagramHook=()=>{s.state.diagramHook=null;s.panel.show('satellite');};s.panel.update();assert.equal(s.f.get('ground-node-diagram').innerHTML,'');assert.doesNotMatch(s.f.get('ground-node-summary').textContent,/분석 UTC/);assert.deepEqual(s.calls.filter(Array.isArray).filter(c=>c[0]==='active').at(-1),['active',false]);}finally{s.panel.destroy();s.f.dispose();}
});
test('same-UTC authority revoked in renderer callback clears every sampled claim',()=>{
 const s=setup();try{s.panel.show('ground');s.scene.setCoverageVisible=()=>{s.state.valid=false;};s.panel.update();assert.equal(s.f.get('ground-node-diagram').innerHTML,'');assert.doesNotMatch(s.f.get('ground-node-summary').textContent,/분석 UTC/);assert.doesNotMatch(s.f.get('ground-node-diagram-status').textContent,/분석 UTC/);}finally{s.panel.destroy();s.f.dispose();}
});
test('nested fresh sampled refresh survives the obsolete diagram callback',()=>{
 const s=setup();try{s.panel.show('ground');const newer=freeze({...s.view,analysis_utc:'2026-10-07T00:00:03.000000000Z',display_utc:'2026-10-07T00:00:03.000000000Z',age_seconds:0,current_analysis:true,availability:'sampled'});s.registered.add(newer);s.state.diagramHook=()=>{s.state.diagramHook=null;s.state.view=newer;s.panel.update();};s.panel.update();assert.match(s.f.get('ground-node-summary').textContent,/분석 UTC 2026-10-07T00:00:03/);assert.match(s.f.get('ground-node-diagram-status').textContent,/분석 UTC 2026-10-07T00:00:03/);assert.match(s.f.get('ground-node-diagram').innerHTML,/data-diagram-node="N0"/);}finally{s.panel.destroy();s.f.dispose();}
});
test('late owner verifier exception neutralizes a retained sampled panel without throwing',()=>{
 const s=setup();try{s.panel.show('ground');let checks=0;const verify=s.network.verifySampledNetworkPresentation;s.network.verifySampledNetworkPresentation=(...args)=>{if(++checks===2)throw Error('owner unavailable');return verify(...args);};assert.doesNotThrow(()=>s.panel.update());assert.equal(s.f.get('ground-node-diagram').innerHTML,'');assert.doesNotMatch(s.f.get('ground-node-summary').textContent,/분석 UTC/);assert.equal(s.f.get('ground-node-scene-links').disabled,true);}finally{s.panel.destroy();s.f.dispose();}
});
for(const source of ['diagram','renderer'])test(`sampled ${source} callback failure clears retained presentation`,()=>{
 const s=setup();try{s.panel.show('ground');if(source==='diagram')s.state.diagramHook=()=>{throw Error('callback unavailable');};else s.scene.setCoverageVisible=()=>{throw Error('callback unavailable');};assert.doesNotThrow(()=>s.panel.update());assert.equal(s.f.get('ground-node-diagram').innerHTML,'');assert.doesNotMatch(s.f.get('ground-node-summary').textContent,/분석 UTC/);assert.doesNotMatch(s.f.get('ground-node-diagram-status').textContent,/분석 UTC/);}finally{s.panel.destroy();s.f.dispose();}
});
