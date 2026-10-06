import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSettingsPanel} from '../../../user_application/web/scripts/tabs/source_settings.js';
import {ICDS,MODULES,STORAGE_KEY} from '../../../user_application/web/scripts/settings/topology.js';
import {createSimWorkspace} from '../../../user_application/web/scripts/tabs/sim_workspace.js';
function fixture(readSocket=()=>null){
 const elements=new Map(),records=new Map(),events=new Map();let requests=0;
 class Element{
  constructor(){this.listeners=new Map();this.hidden=false;this.value='';this.checked=false;this.html='';}
  set innerHTML(html){this.html=html;for(const m of html.matchAll(/\bid="([^"]+)"/g))elements.set(m[1],new Element());}get innerHTML(){return this.html;}
  prepend(child){elements.set(child.id,child);}querySelector(q){return elements.get(q.slice(1));}
  addEventListener(e,fn){this.listeners.set(e,fn);}removeEventListener(e){this.listeners.delete(e);}remove(){elements.delete(this.id);}
  async dispatch(e){return this.listeners.get(e)?.({preventDefault(){},target:this});}
 }
 elements.set('screen',new Element());
 const document={createElement:()=>new Element(),getElementById:id=>elements.get(id)};
 const host={location:{host:'127.0.0.1:8891'},confirm:()=>true,addEventListener:(e,fn)=>events.set(e,fn),removeEventListener:e=>events.delete(e)};
 const storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
 const panel=createSourceSettingsPanel({document,host,storage,readSocket,probe:async body=>{requests++;return{checked_at:'2026-10-06T16:00:00Z',results:Object.fromEntries(body.links.map(l=>[l.id,{state:'unverified',method:'in-process',detail:'original planned component'}]))};}});
 return{panel,elements,records,events,get requests(){return requests;},get:id=>elements.get('st-'+id)};
}
test('V6 settings presents original modules, topology and all ICD message histories with explicit probe',async()=>{
 const f=fixture();f.panel.show('settings');const root=f.elements.get('source-module-settings');assert.ok(root);assert.equal(f.requests,0);
 for(const i of ICDS){assert.ok(root.innerHTML.includes(i.id));for(const m of i.messages)assert.ok(root.innerHTML.includes(m.id));}
 for(const m of MODULES)assert.ok(root.innerHTML.includes(m.name));
 assert.match(f.get('topology').innerHTML,/viewBox="0 0 1320 720"/);await f.get('probe').dispatch('click');assert.equal(f.requests,1);assert.match(f.get('status').textContent,/마지막 확인 UTC/);f.panel.destroy();
});
test('link editing is preserved and cannot be applied accidentally on route change or conflict',async()=>{
 const f=fixture();f.panel.show('settings');f.get('host').value='fabric.example.test';await f.get('editor').dispatch('input');f.panel.show('ground');f.panel.show('settings');assert.equal(f.get('host').value,'fabric.example.test');
 await f.get('probe').dispatch('click');assert.equal(f.requests,0);assert.match(f.get('status').textContent,/반영/);
 await f.get('editor').dispatch('submit');assert.equal(f.records.size,0);await f.get('save').dispatch('click');assert.equal(JSON.parse(f.records.get(STORAGE_KEY)).links.L02.host,'fabric.example.test');
 f.get('host').value='keep-edit';await f.get('editor').dispatch('input');f.events.get('storage')({key:STORAGE_KEY});assert.equal(f.get('host').value,'keep-edit');assert.equal(f.get('save').disabled,true);assert.match(f.get('status').textContent,/다른 창/);f.panel.destroy();
});
test('unchanged settings remain probeable after moving between V6 routes; defaults reset requires explicit save',async()=>{
 const f=fixture();f.panel.show('settings');f.panel.show('ground');f.panel.show('settings');await f.get('probe').dispatch('click');assert.equal(f.requests,1);
 f.get('host').value='test.example';await f.get('editor').dispatch('input');await f.get('editor').dispatch('submit');await f.get('save').dispatch('click');await f.get('reset').dispatch('click');assert.equal(f.get('host').value,'127.0.0.1');assert.equal(JSON.parse(f.records.get(STORAGE_KEY)).links.L02.host,'test.example');await f.get('save').dispatch('click');assert.equal(Object.hasOwn(JSON.parse(f.records.get(STORAGE_KEY)).links,'L02'),false);f.panel.destroy();
});
test('settings reads actual SIM owner socket string and refreshes when existing connection opens/closes',()=>{
 let notify;const sim=createSimWorkspace({},(_,status)=>{notify=status;return()=>{};},()=>{},()=>{},{setTimer:()=>null,clearTimer:()=>{}});
 const f=fixture(()=>sim.snapshot().connection);f.panel.show('settings');assert.equal(sim.snapshot().connection,'idle');assert.match(f.get('links').innerHTML,/WebSocket 끊김/);
 sim.connect();notify('open');assert.equal(sim.snapshot().connection,'open');f.panel.update();assert.match(f.get('links').innerHTML,/WebSocket 텔레메트리 수신 중/);
 notify('closed');f.panel.update();assert.match(f.get('links').innerHTML,/WebSocket 끊김/);f.panel.destroy();sim.destroy();
});
