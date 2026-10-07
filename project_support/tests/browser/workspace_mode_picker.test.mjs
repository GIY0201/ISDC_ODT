import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
import {readFile} from 'node:fs/promises';
import {STORAGE_KEY} from '../../../user_application/web/scripts/settings/topology.js';
const modeItem=(f,id)=>f.get('workspace-mode-items').children.find(button=>button.id==='workspace-mode-item-'+id);
for(const [w,h] of [[1280,720],[1920,1080]])test(`header mode picker saves only explicit mode without probe/runtime commands ${w}`,async()=>{
 const records=new Map(),f=fixture(w,h,{hash:'#ground',storage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}});
 try{
  let probes=0;f.context.api.integrationProbe=()=>{probes++;throw Error('automatic probe forbidden');};
  const button=f.get('current-mode');await button.dispatch('click');
  assert.equal(button.attributes['aria-expanded'],'true');assert.equal(f.get('workspace-mode-picker').hidden,false);
  const select=modeItem(f,'em');await select.dispatch('click');
  assert.equal(JSON.parse(records.get(STORAGE_KEY)).mode,'em');assert.deepEqual(JSON.parse(records.get(STORAGE_KEY)).links,{});
  assert.equal(f.get('workspace-mode-status').textContent,'');assert.equal(f.get('workspace-mode-status').hidden,true);assert.equal(f.counts().commands,0);assert.equal(probes,0);
  f.evaluate("location.hash='#integration'");await f.win.dispatch('hashchange');assert.equal(f.get('st-mode').value,'em');
  await select.dispatch('keydown',{key:'Escape'});assert.equal(f.get('workspace-mode-picker').hidden,true);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
test('header native button and menu items retain labels and keyboard close semantics',async()=>{
 const html=await readFile(new URL('../../../user_application/web/index.html',import.meta.url),'utf8');
 assert.match(html,/<button[^>]*type="button"[^>]*id="current-mode"[^>]*aria-label="운용 모드 변경"[^>]*aria-controls="workspace-mode-picker"/);
 assert.match(html,/id="workspace-mode-items"[^>]*role="menu"/);assert.doesNotMatch(html,/workspace-mode-select|모드 설정만 저장/);
 const f=fixture();try{await f.get('current-mode').dispatch('click');await f.get('current-mode').dispatch('keydown',{key:'Escape'});assert.equal(f.get('workspace-mode-picker').hidden,true);assert.equal(f.get('current-mode').attributes['aria-expanded'],'false');}finally{f.dispose();}
});
test('failed persistence reports failure and destroyed owner cannot save a header selection',async()=>{
 let writes=0;const f=fixture(1280,720,{storage:{getItem:()=>null,setItem:()=>{writes++;throw Error('blocked');}}});
 try{await f.get('current-mode').dispatch('click');await modeItem(f,'em').dispatch('click');assert.match(f.get('workspace-mode-status').textContent,/편집|실패/);assert.doesNotMatch(f.get('workspace-mode-status').textContent,/저장했습니다/);assert.equal(writes,1);assert.equal(modeItem(f,'em').disabled,true);await f.win.dispatch('pagehide',{persisted:false});await modeItem(f,'em').dispatch('click');assert.equal(writes,1);assert.throws(()=>f.evaluate("changeWorkspaceMode('standalone')"),/종료/);}finally{f.dispose();}
});
test('applied but unsaved links and an in-flight explicit probe cannot be persisted through the header',async()=>{
 const records=new Map(),f=fixture(1280,720,{hash:'#integration',storage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}});
 try{f.get('st-host').value='draft.example';await f.get('st-editor').dispatch('input');await f.get('st-editor').dispatch('submit');assert.throws(()=>f.evaluate("changeWorkspaceMode('em')"),/편집/);assert.equal(records.has(STORAGE_KEY),false);assert.equal(f.evaluate('sourceSettingsPanel.controller.snapshot().settings.links.L02.host'),'draft.example');
  f.evaluate('sourceSettingsPanel.controller.load()');let reject;f.context.api.integrationProbe=()=>new Promise((_,fail)=>{reject=fail;});const pending=f.evaluate('sourceSettingsPanel.controller.probe().catch(()=>{})');assert.throws(()=>f.evaluate("changeWorkspaceMode('em')"),/진행/);assert.equal(records.has(STORAGE_KEY),false);reject(Error('test canceled'));await pending;
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
test('header refuses unsaved link editor and remote conflict without replacing the draft or writing storage',async()=>{
 const records=new Map(),f=fixture(1280,720,{hash:'#integration',storage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}});
 try{
  f.get('st-host').value='unsaved.example';await f.get('st-editor').dispatch('input');
  f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');await f.get('current-mode').dispatch('click');
  await modeItem(f,'em').dispatch('click');assert.equal(records.has(STORAGE_KEY),false);
  assert.match(f.get('workspace-mode-status').textContent,/편집|저장/);
  f.evaluate("location.hash='#integration'");await f.win.dispatch('hashchange');assert.equal(f.get('st-host').value,'unsaved.example');
  await f.win.dispatch('storage',{key:STORAGE_KEY,newValue:'{}'});assert.throws(()=>f.evaluate("changeWorkspaceMode('integration')"),/다른 창/);assert.equal(records.has(STORAGE_KEY),false);
 }finally{await f.win.dispatch('pagehide',{persisted:false});f.dispose();}
});
test('menu arrow navigation changes focus only and native button activation is explicit',async()=>{
 const records=new Map(),f=fixture(1280,720,{storage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}});try{
  await f.get('current-mode').dispatch('click');const buttons=f.get('workspace-mode-items').children;assert.ok(buttons.length>=3);assert.ok(buttons.every(button=>button.tag==='button'&&button.attributes.role==='menuitemradio'));
  await buttons[0].dispatch('keydown',{key:'End'});assert.equal(f.doc.activeElement,buttons.at(-1));await buttons.at(-1).dispatch('keydown',{key:'ArrowDown'});assert.equal(f.doc.activeElement,buttons[0]);assert.equal(records.has(STORAGE_KEY),false);assert.equal(f.counts().commands,0);
  await buttons[0].dispatch('keydown',{key:'Escape'});assert.equal(f.get('workspace-mode-picker').hidden,true);assert.equal(f.doc.activeElement,f.get('current-mode'));
 }finally{f.dispose();}
});
