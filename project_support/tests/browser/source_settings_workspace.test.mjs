import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [width,height] of [[1280,720],[1920,1080]])test(`real V6 assembly mounts original settings and preserves edits ${width}x${height}`,async()=>{
 const records=new Map(),f=fixture(width,height,{hash:'#integration',storage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}});
 try{
  assert.ok(f.get('source-module-settings'));assert.match(f.get('source-module-settings').innerHTML,/ICD-08/);assert.match(f.get('st-topology').innerHTML,/1320 720/);
  f.get('st-host').value='unsaved.test';await f.get('st-editor').dispatch('input');
  f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');f.evaluate("location.hash='#integration'");await f.win.dispatch('hashchange');
  assert.equal(f.get('st-host').value,'unsaved.test');await f.get('st-save').dispatch('click');assert.match(f.get('st-status').textContent,/반영/);assert.equal(records.has('spacetwin-integration-settings'),false);
  await f.get('st-editor').dispatch('submit');await f.get('st-save').dispatch('click');assert.equal(JSON.parse(records.get('spacetwin-integration-settings')).links.L02.host,'unsaved.test');
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
test('actual multiwindow settings drafts preserve link scope and checked across rerender',async()=>{
 const f=fixture(1280,720,{hash:'#integration'});
 try{
  const channel=f.channels.find(c=>c.name==='isdc-odt-v6-mock');
  f.get('st-enabled').checked=false;await f.get('screen').dispatch('change',{target:f.get('st-enabled')});
  const sent=channel.messages.findLast(m=>m.type==='draft'&&m.id==='st-enabled');assert.equal(sent.checked,false);assert.equal(sent.settings_link,'L02');
  await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'integration',id:'st-host',value:'handoff.unsaved.test',settings_link:'L02'}});
  await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'integration',id:'st-reconnect',value:'on',checked:false,settings_link:'L02'}});
  f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');f.evaluate("location.hash='#integration'");await f.win.dispatch('hashchange');
  assert.equal(f.get('st-host').value,'handoff.unsaved.test');assert.equal(f.get('st-reconnect').checked,false);
  await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'integration',id:'st-host',value:'foreign.test',settings_link:'L03'}});assert.equal(f.get('st-host').value,'handoff.unsaved.test');
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});
test('initial popout snapshot owns selected link without saving; focused checkbox rejects conflict',async()=>{
 const opener={postMessage(){}};const f=fixture(1280,720,{hash:'#integration',popout:true,opener});
 try{
  await f.win.dispatch('message',{origin:'http://localhost',source:opener,data:{type:'isdc-v6-snapshot',view:'integration',state:{view:'integration'},draft:[{id:'st-link',value:'L03',settings_link:'L03'},{id:'st-host',value:'snapshot.unsaved.test',settings_link:'L03'},{id:'st-enabled',value:'on',checked:false,settings_link:'L03'}]}});f.flush();
  assert.equal(f.get('st-link').value,'L03');assert.equal(f.get('st-host').value,'snapshot.unsaved.test');assert.equal(f.get('st-enabled').checked,false);
  const mode=f.evaluate('sourceSettingsPanel.controller.snapshot()');assert.equal(mode.settings.links.L03,undefined);assert.equal(mode.dirty,false);
  f.get('st-enabled').focus();const channel=f.channels.find(c=>c.name==='isdc-odt-v6-mock');
  await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'integration',id:'st-enabled',value:f.get('st-enabled').value,checked:true,settings_link:'L03'}});
  assert.equal(f.get('st-enabled').checked,false);assert.match(f.get('popout-feedback').textContent,/현재 편집값/);
  f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');f.evaluate("location.hash='#integration'");await f.win.dispatch('hashchange');assert.equal(f.get('st-host').value,'snapshot.unsaved.test');assert.equal(f.get('st-enabled').checked,false);
  await f.win.dispatch('pagehide',{persisted:false});
 }finally{f.dispose();}
});

test('environment settings reuse the one shared globe controls and preserve preferences across routes',async()=>{
 const f=fixture(1280,720,{hash:'#settings'});
 try{
  assert.ok(f.get('globe-view'));assert.ok(f.get('st-diagnostics'));assert.equal(f.doc.getElementById('st-host'),null);assert.equal(f.get('screen').children[0].id,'globe-view');
  f.get('globe-theme').value='light';await f.get('globe-theme').dispatch('change');
  f.evaluate("location.hash='#satellite'");await f.win.dispatch('hashchange');assert.equal(f.get('globe-theme').value,'light');
  f.evaluate("location.hash='#settings'");await f.win.dispatch('hashchange');assert.equal(f.get('globe-theme').value,'light');assert.equal(f.viewers.length,1);
 }finally{f.dispose();}
});

test('settings remount retains one diagnostics recorder and its original measurements',async()=>{
 let installs=0,shows=0;const raw={frames:[42]},recorder={raw,show(){shows++;}};
 const f=fixture(1280,720,{hash:'#settings',installOrbitUiMeasurement:()=>{installs++;return recorder;}});
 try{
  assert.equal(installs,0);await f.get('st-diagnostics').dispatch('click');assert.equal(installs,1);
  f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');f.evaluate("location.hash='#settings'");await f.win.dispatch('hashchange');
  await f.get('st-diagnostics').dispatch('click');assert.equal(installs,1);assert.equal(shows,2);assert.deepEqual(raw.frames,[42]);assert.equal(f.viewers.length,1);
 }finally{f.dispose();}
});

test('settings attribution uses the existing Viewer original credit action and preserves required credit containers',async()=>{
 const f=fixture(1280,720,{hash:'#settings'});let clicks=0;const classes=new Set(),link={disabled:false,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},click(){clicks++;}},logo={},screenCredits={};
 try{
  assert.equal(f.get('st-attribution').disabled,true);
  const container={logo,screenCredits,querySelector:q=>q==='.cesium-credit-expand-link'?link:null};f.viewers[0].creditDisplay={container};
  f.evaluate('sourceSettingsPanel.update()');assert.equal(f.get('st-attribution').disabled,false);assert.equal(classes.has('isdc-settings-attribution'),true);assert.equal(clicks,0);
  await f.get('st-attribution').dispatch('click');assert.equal(clicks,1);assert.equal(f.viewers.length,1);assert.equal(container.logo,logo);assert.equal(container.screenCredits,screenCredits);
  await f.win.dispatch('pagehide',{persisted:false});assert.equal(classes.has('isdc-settings-attribution'),false);
 }finally{f.dispose();}
});

for(const view of ['settings','integration'])test(`${view} hides target quickbar and target route restore retains its provenance`,async()=>{
 const f=fixture(1280,720,{hash:'#'+view});
 try{
  assert.equal(f.doc.getElementById('window-quick'),null);
  f.evaluate("location.hash='#ground'");await f.win.dispatch('hashchange');assert.equal(f.doc.getElementById('window-quick'),null);
  f.get('clock');f.get('desktop-handoff-state');f.evaluate('notifyWorkspaceContext()');const texts=['clock','desktop-handoff-state'].map(id=>f.get(id).textContent);
  await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.doc.getElementById('window-quick'),null);
  assert.deepEqual(['clock','desktop-handoff-state'].map(id=>f.get(id).textContent),texts);
  f.evaluate(`location.hash='#${view}'`);await f.win.dispatch('hashchange');assert.equal(f.doc.getElementById('window-quick'),null);
  await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.doc.getElementById('window-quick'),null);assert.equal(f.viewers.length,1);
 }finally{f.dispose();}
});

test('satellite to environment route cannot recreate stale satellite panels during transition',async()=>{
 const f=fixture(1280,720,{hash:'#satellite'});
 try{
  assert.ok(f.doc.getElementById('satellite-model-panel'));assert.ok(f.doc.getElementById('station-workspace'));assert.ok(f.doc.getElementById('catalog-workspace'));
  f.evaluate("location.hash='#settings'");await f.win.dispatch('hashchange');
  for(const id of ['satellite-model-panel','station-workspace','catalog-workspace'])assert.equal(f.doc.getElementById(id)?.isConnected===true,false,id);
  assert.ok(f.doc.getElementById('source-environment-settings'));assert.ok(f.doc.getElementById('globe-view'));assert.equal(f.viewers.length,1);
 }finally{f.dispose();}
});
