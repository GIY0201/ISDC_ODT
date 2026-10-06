import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutNetwork,diagramMarkup} from '../../../digital_twin/visualization/network_diagram.js';

test('sampled diagram keeps geometry selectable without fabric quality, route or packet approval',()=>{
 const layout=layoutNetwork({satellites:[{id:'A',name:'A',raan:0},{id:'B',name:'B',raan:0}],stations:[{id:'G',name:'Ground'}]});
 const links=[{id:'AB',a:'A',b:'B',kind:'oisl',usable:true,quality:99,delay_ms:1},{id:'AG',a:'G',b:'A',kind:'ground',usable:true,quality:88}];
 const markup=diagramMarkup(layout,links,{unverifiedAnalysis:true,showLabels:true,selected:{type:'link',id:'AB'},routeLinkIds:new Set(['AB','AG']),nodeStates:new Map([['A',{tone:'ok',title:'verified custody'}]]),flowTimeSeconds:4});
 assert.match(markup,/data-diagram-link="AB"/);assert.match(markup,/통신 품질 미확인/);
 assert.doesNotMatch(markup,/품질 99|88%|nd-flow forward|class="[^"]*routed|verified custody|사용 불가/);
 assert.equal(links[0].usable,true);assert.equal(links[0].quality,99,'borrowed native input is unchanged');
 const exact=diagramMarkup(layout,links,{routeLinkIds:new Set(['AB']),showLabels:true});assert.match(exact,/품질 99/);assert.match(exact,/nd-flow forward/);
});
