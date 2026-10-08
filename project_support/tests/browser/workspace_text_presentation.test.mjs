import test from 'node:test';
import assert from 'node:assert/strict';
import {installTextPresentation,isSupplementalExplanation} from '../../../user_application/web/scripts/workspace_text_presentation.js';

function element(tag,children=[],attrs={}){const node={nodeType:1,tagName:tag.toUpperCase(),childNodes:children,parentElement:null,attributes:{...attrs},getAttribute(k){return this.attributes[k]??null;},hasAttribute(k){return k in this.attributes;},setAttribute(k,v){this.attributes[k]=v;}};for(const child of children)child.parentElement=node;return node;}
const text=data=>({nodeType:3,data,parentElement:null});
function host(){let callback,disconnected=false;return {MutationObserver:class{constructor(fn){callback=fn;}observe(){}disconnect(){disconnected=true;}},notify(records){callback(records);},get disconnected(){return disconnected;}};}

test('all display labels normalize without changing controls, raw code, option values or source objects',()=>{
 const title=text('위성 상태·궤도'),status=text('UTC · KST'),raw=text('{"name":"A·B"}'),option=text('A·B');
 const button=element('button',[title],{'aria-label':'위성·지상국',title:'선택 · 확인','data-view':'satellite'});
 button.value='A·B';const click=()=>42;button.onclick=click;
 const root=element('div',[button,element('p',[status]),element('pre',[raw]),element('option',[option])]);
 const h=host(),stop=installTextPresentation(root,h);
 assert.equal(title.data,'위성 상태 및 궤도');assert.equal(status.data,'UTC, KST');
 assert.equal(button.getAttribute('aria-label'),'위성, 지상국');assert.equal(button.value,'A·B');assert.equal(button.onclick,click);assert.equal(button.getAttribute('data-view'),'satellite');
 assert.equal(raw.data,'{"name":"A·B"}');assert.equal(option.data,'A, B');assert.equal(option.parentElement.getAttribute('value'),'A·B');
 const next=text('SIM · 재생');element('p',[next]);h.notify([{type:'childList',addedNodes:[next]}]);assert.equal(next.data,'모의실험, 재생');
 next.data='SIM·정지';h.notify([{type:'characterData',target:next}]);assert.equal(next.data,'모의실험, 정지');
 stop();assert.ok(h.disconnected);next.data='A·B';h.notify([{type:'characterData',target:next}]);assert.equal(next.data,'A·B');
});

test('provider attribution, editor text and machine-readable payloads remain exact',()=>{
 const values=['Cesium · provider','A·B','const x = "A·B";'];
 const nodes=values.map(text);const root=element('div',[element('div',[nodes[0]],{'class':'cesium-credit-textContainer'}),element('textarea',[nodes[1]]),element('code',[nodes[2]])]);
 installTextPresentation(root,host());assert.deepEqual(nodes.map(n=>n.data),values);
});

test('help disclosure hides optional prose while keeping warnings, status, consent and links visible',()=>{
 const prose={tagName:'P',textContent:'화면 테마는 지도 밝기와 별개입니다. 전체화면 종료는 Esc 키로도 할 수 있습니다.',id:'',getAttribute:()=>null,closest:()=>null,querySelector:()=>null};
 assert.equal(isSupplementalExplanation(prose),true);
 for(const patch of [{id:'live-status'},{getAttribute:()=> 'status'},{querySelector:()=>({tagName:'INPUT'})},{closest:()=>({tagName:'DETAILS'})},{textContent:'계산 실패: UTC 범위를 확인하세요.'}])assert.equal(isSupplementalExplanation({...prose,...patch}),false);
});

test('hidden advanced-control prose is not promoted into visible help',()=>{
 const hiddenProse={tagName:'P',textContent:'적용된 카탈로그 검색 결과 전체 정밀좌표를 표시합니다. 이전 고급 조회 모드의 설명입니다.',id:'',getAttribute:()=>null,closest:selector=>selector.includes('[hidden]')?{}:null,querySelector:()=>null};
 assert.equal(isSupplementalExplanation(hiddenProse),false);
});
