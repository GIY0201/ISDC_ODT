import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './workspace_fixture.mjs';

const html=readFileSync(new URL('../../../user_application/web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../../../user_application/web/styles/workspace.css',import.meta.url),'utf8');
const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
const declarations=selector=>rules.filter(([,selectors])=>selectors.split(',').some(value=>value.trim()===selector)).map(([, ,body])=>body).join(';');

test('application desktop occupies the final grid track without a separate bottom footer',()=>{
 assert.doesNotMatch(html,/<footer\b|id="footer-view"/);
 const rows=rules.filter(([,selector])=>selector.trim()==='.app').map(([, ,body])=>body.match(/grid-template-rows:([^;}]*)/)?.[1]).filter(Boolean);
 assert.ok(rows.length>0);
 for(const value of rows)assert.match(value,/minmax\(0,\s*1fr\)\s*$/,'no fixed blank track follows the desktop');
});

test('environment settings stays at the rail bottom without its own bordered compartment',()=>{
 assert.match(html,/<div class="rail-foot">\s*<button[^>]*data-view="settings"[^>]*>[\s\S]*?환경 설정[\s\S]*?<\/button>\s*<\/div>/);
 const rail=declarations('.rail-foot');
 assert.match(rail,/margin-top:auto/);
 assert.doesNotMatch(rail,/border(?:-top)?:[^;]+|background:[^;]+|display:none/);
});

test('unused contact card is removed while the primary globe remains mounted',()=>{
 const card=html.match(/<section class="glass contact"[\s\S]*?<\/section>/)?.[0];
 assert.equal(card,undefined);
 assert.doesNotMatch(html,/id="desktop-handoff(?:-state)?"/);
 assert.match(html,/<div id="workspace-globe-surface">[\s\S]*?id="stored-orbit-globe"[\s\S]*?id="orbit-solar-overlay"[\s\S]*?class="orbit-globe-caption"/);
 assert.match(declarations('#wall-globe-slot #workspace-globe-surface'),/position:absolute;inset:0/);
});

test('domain rail controls retain Korean names and click scopes with decorative inline SVG icons',()=>{
 for(const [scope,label,name] of [['data-group="0"','상황판','상황판 작업 목록 열기'],['data-group="1"','위성','위성 작업 목록 열기'],['data-group="2"','지상국','지상국 작업 목록 열기'],['data-group="5"','보안','보안 작업 목록 열기'],['data-view="settings"','환경 설정',null]]){
  const button=[...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match=>match[0]).find(value=>value.includes(scope));
  assert.ok(button,`${label} control exists in the initial document`);
  assert.match(button,/<svg\b[^>]*aria-hidden="true"[^>]*focusable="false"[^>]*>/);
  assert.match(button,/<span class="rail-label">/);
  assert.ok(button.includes(label));
  if(name)assert.ok(button.includes(`aria-label="${name}"`));
 }
 assert.match(declarations('.rail .rail-icon'),/width:20px/);
 assert.match(declarations('.rail button'),/flex-direction:column/);
 assert.doesNotMatch(declarations('.rail .rail-label'),/display:none/);
});

test('rail group controls retain the existing scoped launcher behavior without analytical requests',async()=>{
 const f=fixture(1280,720,{hash:'#wall'});
 try{
  const rail=f.get('rail-groups'),before=f.counts(),viewer=f.viewers[0];
  // The existing fixture parses only elements with IDs; scope-only nav buttons
  // are supplied at this DOM boundary while the real root listener is exercised.
  f.get('nav').querySelector=selector=>selector==='button'?{focus(){}}:null;
  for(const [index,title,first] of [[0,'상황판 작업공간','wall'],[1,'위성 작업공간','satellite'],[5,'보안 작업공간','security'],[6,'시험 작업공간','scene']]){
   const button={dataset:{group:String(index)},closest(selector){return selector==='[data-group]'?this:null;}};
   await rail.dispatch('click',{target:button});
   assert.equal(f.get('launcher-title').textContent,title);
   assert.equal(f.get('launcher').hidden,false);
   assert.match(f.get('nav').innerHTML,new RegExp(`^<button[^>]*data-view="${first}"`));
  }
  assert.deepEqual(f.counts(),before);
  assert.equal(f.viewers[0],viewer);
 }finally{f.dispose();}
});
