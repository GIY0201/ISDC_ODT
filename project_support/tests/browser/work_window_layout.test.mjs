import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkWindowLayout} from '../../../user_application/web/scripts/work_window_layout.js';
import {fixture as workspaceFixture} from './workspace_fixture.mjs';
function fixture(){
 class Element{constructor(tag='section'){this.tagName=tag.toUpperCase();this.id='';this.dataset={};this.hidden=false;this.children=[];this.listeners=new Map();this.attributes={};this.ownerDocument=doc;this.classList={contains:name=>this.classes?.includes(name)};}append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}}replaceChildren(...items){this.children=[];this.append(...items);}setAttribute(k,v){this.attributes[k]=String(v);}removeAttribute(k){delete this.attributes[k];}addEventListener(k,fn){this.listeners.set(k,fn);}removeEventListener(k){this.listeners.delete(k);}querySelector(){return this.title?{textContent:this.title}:null;}contains(el){return this.children.includes(el);}click(){this.parentElement.listeners.get('click')?.({target:this});}}
 const doc={createElement:tag=>new Element(tag)},screen=new Element('main'),navigation=new Element('nav'),windowElement=new Element(),observations=[];let resized=0;
 const host={MutationObserver:class{constructor(fn){this.fn=fn;observations.push(this);}observe(){}disconnect(){this.stopped=true;}},ResizeObserver:class{constructor(fn){this.fn=fn;observations.push(this);}observe(){}disconnect(){this.stopped=true;}}};
 const panel=(id,title)=>{const el=new Element();el.id=id;el.classes=['panel'];el.title=title;return el;};
 return{screen,navigation,windowElement,host,observations,panel,create:()=>createWorkWindowLayout({screen,navigation,windowElement,host,onResize:()=>resized++}),resized:()=>resized};
}
test('section navigation retains actual fields and hidden controller state, while remount and resize remain UI only',()=>{
 const f=fixture(),a=f.panel('catalog-workspace','카탈로그'),b=f.panel('satellite-nodes','노드'),hidden=f.panel('source-data-services','데이터');hidden.hidden=true;a.input={value:'unapplied draft'};const input=a.input;f.screen.append(a,b,hidden);const layout=f.create();layout.setView('satellite');
 assert.equal(f.navigation.children.length,2);assert.equal(a.dataset.workSectionHidden,'false');assert.equal(b.dataset.workSectionHidden,'true');f.navigation.children[1].click();assert.equal(b.dataset.workSectionHidden,'false');assert.equal(a.dataset.workSectionHidden,'true');assert.equal(a.input,input);assert.equal(input.value,'unapplied draft');assert.equal(hidden.hidden,true);
 const replacement=f.panel('satellite-nodes','노드');f.screen.replaceChildren(a,replacement,hidden);f.observations[0].fn();assert.equal(replacement.dataset.workSectionHidden,'false');assert.equal(b.dataset.workSectionHidden,undefined);assert.equal(a.input,input);f.observations[1].fn();assert.ok(f.resized()>0);
 layout.destroy();assert.equal(f.navigation.hidden,true);assert.equal(a.dataset.workSectionHidden,undefined);assert.equal(f.observations.every(o=>o.stopped),true);
});
test('wall stays intact and scenario dock stays pinned without acquiring another controller or view',()=>{
 const f=fixture(),wall=f.panel('wall','지구'),dock=f.panel('source-scenario-dock','실행');wall.classes=['view','wall-live'];f.screen.append(wall,dock);const layout=f.create();layout.setView('wall');assert.equal(f.navigation.hidden,true);assert.equal(wall.dataset.workSectionHidden,'false');assert.equal(dock.dataset.workSectionHidden,undefined);assert.equal(dock.hidden,false);layout.destroy();
});
test('real role composition exposes mounted sections without issuing commands or losing unsaved input on section switch',async()=>{
 const f=workspaceFixture(720,600,{hash:'#satellite',popout:true});try{
  const nav=f.get('work-section-nav');assert.ok(nav.children.length>=4);const input=f.get('cat-query');input.value='preserved pending query';const counts=f.counts(),viewer=f.viewers[0];
  for(const button of [...nav.children])await nav.dispatch('click',{target:button});assert.equal(f.get('cat-query'),input);assert.equal(input.value,'preserved pending query');assert.deepEqual(f.counts(),counts);assert.equal(f.viewers[0],viewer);assert.equal(f.get('screen').dataset.workLayout,'sections');
  await f.resize(1280,720);assert.equal(f.get('cat-query'),input);assert.equal(input.value,'preserved pending query');
 }finally{f.dispose();}
});
