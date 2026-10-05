import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createNodeEditorTools} from '../../../user_application/web/scripts/nodes/editor.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
const epoch=1791151272000;
function setup(){let seq=0;const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++seq}`});return {library,tools:createNodeEditorTools({library,catalogElements,now:()=>epoch}),node:library.createNode({bus:'flat_panel'}, {epoch,id:'N-1',catalogNumber:900001})};}
const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,c)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[c]));
class Element {
 constructor(){this.listeners=new Map();this.hidden=false;this.disabled=false;this.dataset={};this.attributes=new Map();this.value='';this.type='';this.tagName='DIV';this._html='';}
 addEventListener(event,fn){const list=this.listeners.get(event)??new Set();list.add(fn);this.listeners.set(event,list);}
 removeEventListener(event,fn){this.listeners.get(event)?.delete(fn);}
 async dispatch(event,details={}){for(const fn of [...(this.listeners.get(event)??[])])await fn({preventDefault(){},target:this,...details});}
 setAttribute(k,v){this.attributes.set(k,v);}removeAttribute(k){this.attributes.delete(k);}focus(){this.focused=true;}
 set innerHTML(s){this._html=s;}get innerHTML(){return this._html;}
}
class Form extends Element {
 set innerHTML(html){
  this._html=html;this.paths=new Map();this.ids=new Map();
  for(const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)){
   const [,tag,attrs]=match;const path=/data-path="([^"]+)"/.exec(attrs)?.[1];const id=/id="([^"]+)"/.exec(attrs)?.[1];
   const el=new Element();el.tagName=tag.toUpperCase();el.type=/type="([^"]+)"/.exec(attrs)?.[1]??tag;el.dataset.path=path;
   el.value=decode(/value="([^"]*)"/.exec(attrs)?.[1]??'');
   if(tag==='select'){const body=html.slice(match.index+match[0].length).split('</select>')[0];el.value=decode(/<option value="([^"]*)" selected/.exec(body)?.[1]??/<option value="([^"]*)"/.exec(body)?.[1]??'');}
   if(tag==='textarea')el.value=decode(html.slice(match.index+match[0].length).split('</textarea>')[0]);
   if(path)this.paths.set(path,el);if(id)this.ids.set(id,el);
  }
  for(const id of [...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]))if(!this.ids.has(id))this.ids.set(id,new Element());
 }
 get innerHTML(){return this._html;}
 querySelector(selector){if(selector.startsWith('#'))return this.ids.get(selector.slice(1))??null;return this.paths.get(/data-path="([^"]+)"/.exec(selector)?.[1])??null;}
 querySelectorAll(selector){return selector==='[data-path]'?[...this.paths.values()]:selector==='input,select,textarea,button'?[...new Set([...this.paths.values(),...this.ids.values()])]:[];}
}

test('original editor markup and static summaries match pinned source',async()=>{
 const {tools}=setup();const fixture=JSON.parse(await readFile(new URL('../fixtures/original_node_editor.json',import.meta.url),'utf8'));
 for(const c of fixture.cases){assert.equal(tools.editorMarkup(c.node,c.options),c.markup);assert.equal(tools.orbitSummaryText(c.node.orbit),c.summary);}
});

test('name/notes/model data escaped and equipment own-target excluded',()=>{
 const {tools,node}=setup();node.name='<img onerror="x">';node.notes='<script>x</script>';
 const markup=tools.editorMarkup(node,{models:[{key:'x"',label:'<model>',provider:'spacetwin',size_m:1}],otherNodes:[node,{id:'N-2',name:'<other>'}]});
 assert.ok(markup.includes('&lt;img'));assert.ok(!markup.includes('<script>'));assert.ok(markup.includes('&lt;model&gt;'));assert.ok(!markup.includes('value="N-1"'));
 assert.ok(markup.includes('value="N-2"'));assert.ok(markup.includes('data-path="power.battery_wh"'));
});

test('mode preserves unrelated draft; bus intentionally resets bus properties while retaining orbit and name',async()=>{
 const {tools,node,library}=setup(),form=new Form();const editor=tools.createNodeEditor({form,onSave:()=>[]});editor.open(node,{focus:false});
 const original=editor.draft;form.paths.get('mode').value='safe';await form.paths.get('mode').dispatch('change');
 assert.equal(editor.draft.mode,'safe');assert.deepEqual(editor.draft.orbit,original.orbit);assert.deepEqual(editor.draft.equipment,original.equipment);
 form.paths.get('bus').value='cubesat_3u';await form.paths.get('bus').dispatch('change');
 assert.equal(editor.draft.bus,'cubesat_3u');assert.deepEqual(editor.draft.orbit,original.orbit);assert.equal(editor.draft.name,node.name);assert.equal(editor.draft.power.generation_w,library.BUS_PRESETS.cubesat_3u.generation_w);
 editor.draft.name='outside';assert.equal(editor.draft.name,node.name);assert.equal(node.mode,'nominal');
});

test('blank number and invalid calendar prevent save without discarding draft',async()=>{
 const {tools,node}=setup(),form=new Form();let saves=0;const editor=tools.createNodeEditor({form,onSave:()=>{saves++;return [];}});editor.open(node);
 form.paths.get('orbit.altitude_km').value='';await form.paths.get('orbit.altitude_km').dispatch('input');await form.dispatch('submit');
 assert.equal(saves,0);assert.equal(editor.isOpen(),true);assert.equal(form.ids.get('node-editor-errors').hidden,false);
 form.paths.get('orbit.altitude_km').value='550';await form.paths.get('orbit.altitude_km').dispatch('input');form.paths.get('orbit.epoch').value='2026-02-30T12:00:00';await form.paths.get('orbit.epoch').dispatch('input');await form.dispatch('submit');assert.equal(saves,0);
});

test('owner errors/throws/missing acknowledgement preserve edits; successful save copies before close',async()=>{
 const {tools,node}=setup(),form=new Form();let result=['storage error'],captured;
 const editor=tools.createNodeEditor({form,onSave:next=>{captured=next;if(result instanceof Error)throw result;return result;}});editor.open(node);
 form.paths.get('notes').value='kept';await form.paths.get('notes').dispatch('input');await form.dispatch('submit');assert.equal(editor.draft.notes,'kept');
 result=new Error('failure');await form.dispatch('submit');assert.equal(editor.isOpen(),true);
 result=undefined;await form.dispatch('submit');assert.equal(editor.isOpen(),true);
 result=[];await form.dispatch('submit');assert.equal(editor.isOpen(),false);assert.equal(captured.notes,'kept');assert.equal(node.notes,'');
});

test('equipment add/change/remove is isolated, and preview credits use text content',async()=>{
 const {tools,node}=setup(),form=new Form();const editor=tools.createNodeEditor({form,onSave:()=>[],onModelChange:()=>({thumbnail:'/static/assets/a.png',alt:'model',note:'<credit>'})});editor.open(node);
 assert.equal(form.ids.get('node-model-caption').textContent,'<credit>');assert.equal(form.ids.get('node-model-preview').src,'/static/assets/a.png');
 form.ids.get('node-equipment-catalog').value='oisl_standard';await form.ids.get('node-equipment-add').dispatch('click');const item=editor.draft.equipment.at(-1);
 const row={dataset:{eq:item.id},classList:{toggle(){}}};const target={value:'N-2',closest:()=>row,matches:s=>s==='[data-eq-target]'};
 await form.ids.get('node-equipment-list').dispatch('change',{target});assert.equal(editor.draft.equipment.at(-1).target,'N-2');
 const button={closest:()=>row};await form.ids.get('node-equipment-list').dispatch('click',{target:{closest:()=>button}});assert.equal(editor.draft.equipment.length,node.equipment.length);assert.equal(node.equipment.length,7);
});

test('close/destroy remove owned listeners and preserve external submit handler',async()=>{
 const {tools,node}=setup(),form=new Form();let external=0,saves=0;const outside=()=>external++;form.addEventListener('submit',outside);
 const editor=tools.createNodeEditor({form,onSave:()=>{saves++;return [];}});editor.open(node,{focus:false});assert.equal(form.paths.get('name').focused,undefined);
 const stale=form.paths.get('name');editor.close();await stale.dispatch('input');editor.open(node);editor.destroy();await form.dispatch('submit');assert.equal(saves,0);assert.equal(external,1);assert.equal(form.listeners.get('submit').size,1);
});

test('late asynchronous save cannot close a different edited node',async()=>{
 const {tools,node}=setup(),form=new Form();let resolve,signal;const editor=tools.createNodeEditor({form,onSave:(n,context)=>{signal=context.signal;return new Promise(r=>resolve=r);}});
 editor.open(node);const saving=form.dispatch('submit');await Promise.resolve();assert.equal(form.ids.get('node-editor-save').disabled,true);
 editor.open({...node,id:'N-2'}, {focus:false});assert.equal(signal.aborted,true);resolve([]);await saving;assert.equal(editor.isOpen(),true);assert.equal(editor.draft.id,'N-2');
});


test('unavailable model and removed OISL target remain selected and visibly unconfirmed',()=>{
 const {tools,node}=setup();node.model_key='missing-model';node.equipment[0].target='REMOVED';
 const markup=tools.editorMarkup(node,{models:[],otherNodes:[]});
 assert.match(markup,/<option value="missing-model" selected[^>]*>[^<]*미확인/);
 assert.match(markup,/<option value="REMOVED" selected[^>]*>[^<]*미확인/);
});

test('explicit time input and invalid replacement preserve editor ownership',async()=>{
 const {tools,node}=setup(),form=new Form();const editor=tools.createNodeEditor({form,onSave:()=>[]});editor.open(node);
 await form.ids.get('node-epoch-now').dispatch('click');assert.equal(editor.draft.orbit.epoch,epoch);
 assert.throws(()=>editor.open({...node,name:''}));assert.equal(editor.draft.id,node.id);assert.equal(editor.isOpen(),true);
 editor.destroy();assert.throws(()=>editor.open(node),/disposed/);
});
