import test from 'node:test';
import assert from 'node:assert/strict';
import {createSatelliteNodePanelTools} from '../../../user_application/web/scripts/tabs/satellite_nodes.js';
import {createNodeLibrary} from '../../../digital_twin/model_library/browser/satellite_nodes.js';
import {orbitElements,catalogElements} from '../../../digital_twin/simulation/browser/node_orbit_definition.js';
import {createConstellationStore} from '../../../user_application/web/scripts/nodes/constellation.js';
import {createNodeEditorTools} from '../../../user_application/web/scripts/nodes/editor.js';
const epoch=1791151272000;
class Element {
  constructor(){this.listeners=new Map();this.disabled=false;this.dataset={};}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  async click(){for(const fn of this.listeners.get('click')??[])await fn({});}
  querySelector(){return null;}querySelectorAll(){return [];}
  setAttribute(name,value){this[name]=value;}removeAttribute(name){delete this[name];}
  async submit(){for(const fn of this.listeners.get('submit')??[])await fn({preventDefault(){}});}
}
function setup(options={}){
  let equipment=0,deny=false;const values=new Map(),errors=[],changes=[],selected=[],resets=[];
  const library=createNodeLibrary({orbitElements,catalogElements,createEquipmentId:()=>`EQ-${++equipment}`});
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(deny)throw Error('denied');values.set(key,value);}};
  const store=createConstellationStore({library,storage,now:()=>epoch,verifyAcceptance:options.verifyAcceptance});store.load();
  const elements=new Map(['node-add','nodes-clear','node-editor','formation-generate'].map(id=>[id,new Element()]));
  const root={querySelector:selector=>elements.get(selector.slice(1))??null,querySelectorAll:()=>[]};
  let save,cancel,draft=null,open=false;
  const editor={open(node){draft=structuredClone(node);open=true;},close(){draft=null;open=false;},destroy(){this.close();},isOpen:()=>open,get draft(){return structuredClone(draft);}};
  let actualEditor=editor;
  const originalEditorTools=options.realEditor?createNodeEditorTools({library,catalogElements,now:()=>epoch}):null;
  const editorTools={createNodeEditor(args){save=args.onSave;cancel=args.onCancel;actualEditor=originalEditorTools?originalEditorTools.createNodeEditor(args):editor;return actualEditor;}};
  const timers={set(){throw Error('no automatic timer');},clear(){}};
  const tools=createSatelliteNodePanelTools({library});
  const panel=tools.createNodeDraftPanel({root,store,editorTools,now:()=>epoch,timers,createFormationId:()=> 'F-test',confirmClear:()=>true,onError:e=>errors.push(e),onDefinitionsChanged:(nodes,event)=>changes.push({nodes,event}),onSelected:(node,reason)=>selected.push({node,reason}),onResetTerminals:ids=>resets.push(ids),...options});
  return {library,store,panel,root,elements,editor:actualEditor,errors,changes,selected,resets,save:(node,context={})=>save(node,context),cancel:()=>cancel(),deny:()=>{deny=true;}};
}
test('initialization and passive store restoration never select camera, deploy or add a node',()=>{
  const s=setup();assert.equal(s.store.drafts.length,0);assert.deepEqual(s.selected,[]);assert.deepEqual(s.changes,[]);s.store.load();assert.deepEqual(s.selected,[]);assert.deepEqual(s.changes,[]);s.panel.destroy();
});
test('explicit single add uses original formation bus, orbit and link policy and opens only the committed draft',async()=>{
  const s=setup();s.panel.formation.change('bus','cubesat_3u');s.panel.formation.change('altitude_km',700);s.panel.formation.change('raan_start',42);await s.elements.get('node-add').click();
  const node=s.store.selected;assert.equal(node.bus,'cubesat_3u');assert.equal(node.orbit.altitude_km,700);assert.equal(node.orbit.raan,42);assert.equal(node.formation,null);assert.equal(s.editor.draft.id,node.id);assert.equal(s.changes.length,1);assert.deepEqual(s.selected,[]);
});
test('invalid raw formation fields and failed persistence cannot create or consume node identities',async()=>{
  const s=setup();s.panel.formation.change('altitude_km','');await s.elements.get('node-add').click();assert.equal(s.store.drafts.length,0);assert.equal(s.editor.isOpen(),false);
  s.panel.formation.change('altitude_km',550);s.deny();await s.elements.get('node-add').click();assert.equal(s.store.drafts.length,0);assert.equal(s.store.idFactory()().id,'NODE-0001');assert.equal(s.editor.isOpen(),false);assert.ok(s.errors.length>=2);
});
test('successful save detaches source formation, preserves identity, and resets only that terminal owner',()=>{
  const s=setup();const nodes=s.panel.formation.generate();s.panel.openEditor(nodes[0].id);const draft=s.editor.draft;draft.name='edited';const errors=s.save(draft);
  assert.deepEqual(errors,[]);assert.equal(s.store.find(draft.id).formation,null);assert.equal(s.store.find(draft.id).catalog_number,draft.catalog_number);assert.deepEqual(s.resets.at(-1),[draft.id]);assert.equal(s.store.drafts.length,40);
});
test('failed or aborted saves retain original definitions and never acknowledge terminal reset',()=>{
  const s=setup();const node=s.panel.add();const before=s.store.find(node.id);const draft={...before,name:'pending'};const abort=new AbortController();abort.abort();assert.ok(s.save(draft,{signal:abort.signal}).length);assert.deepEqual(s.store.find(node.id),before);
  s.deny();assert.ok(s.save(draft).length);assert.deepEqual(s.store.find(node.id),before);assert.equal(s.editor.isOpen(),true);assert.deepEqual(s.resets,[]);
});
test('explicit selection closes editor, adopts formation, and passes copied no-focus intent; passive events do not',()=>{
  const s=setup();const nodes=s.panel.formation.generate();const solo=s.panel.add();s.panel.select(nodes[0].id);assert.equal(s.editor.isOpen(),false);assert.equal(s.panel.formation.snapshot().activeFormationId,'F-test');assert.deepEqual(s.selected.at(-1).reason,{userInitiated:true,focus:false});s.selected.at(-1).node.name='foreign';assert.notEqual(s.store.selected.name,'foreign');s.store.select(solo.id);assert.equal(s.selected.length,1);assert.equal(s.panel.formation.snapshot().activeFormationId,null);
});
test('clear confirmation is explicit, removal closes editor and preserves deployed record',async()=>{
  // Injected receipt predicate tests preservation only; it is not actual server acceptance.
  let confirm=false;const s=setup({confirmClear:()=>confirm,verifyAcceptance:()=>true});s.panel.add();s.store.deploy(s.store.drafts,{id:'test-only'});const before=s.store.snapshot();assert.equal(await s.panel.clear(),false);assert.deepEqual(s.store.snapshot(),before);confirm=true;assert.equal(await s.panel.clear(),true);assert.equal(s.store.drafts.length,0);assert.equal(s.editor.isOpen(),false);assert.equal(s.store.deployed.length,1);assert.deepEqual(s.store.deployed,before.deployed);assert.equal(s.resets.at(-1).length,1);
});
test('late clear approval cannot remove changed drafts or operate after disposal',async()=>{
  let resolve;const s=setup({confirmClear:()=>new Promise(r=>{resolve=r;})});s.panel.add();const pending=s.panel.clear();s.store.add();resolve(true);assert.equal(await pending,false);assert.equal(s.store.drafts.length,2);
  const late=s.panel.clear();s.panel.destroy();resolve(true);assert.equal(await late,false);assert.equal(s.store.drafts.length,2);assert.equal(s.elements.get('node-add').listeners.get('click').size,0);assert.throws(()=>s.panel.add(),/disposed/);
});
test('observer errors after persisted save do not turn the committed transaction into a failed acknowledgement',()=>{
  const s=setup({onDefinitionsChanged:()=>{throw Error('render failed');},onResetTerminals:()=>{throw Error('history failed');}});const node=s.panel.add();assert.deepEqual(s.save({...node,name:'committed'}),[]);assert.equal(s.store.find(node.id).name,'committed');assert.ok(s.errors.includes('render failed'));assert.ok(s.errors.includes('history failed'));
});
test('actual editor/store composition refreshes status after save close and releases its submit listener',async()=>{
  let s;const states=[];s=setup({realEditor:true,onRefresh:()=>{if(s)states.push(s.editor.isOpen());}});
  s.panel.add();assert.equal(s.editor.isOpen(),true);await s.elements.get('node-editor').submit();
  assert.equal(s.editor.isOpen(),false);assert.equal(states.at(-1),false);assert.equal(s.store.drafts.length,1);
  s.panel.destroy();assert.equal(s.elements.get('node-editor').listeners.get('submit').size,0);
});
test('failed selection and clear leave editor/formation intact; external button listeners survive disposal',async()=>{
  const s=setup(),nodes=s.panel.formation.generate();s.panel.openEditor(nodes[0].id);s.deny();
  assert.equal(s.panel.select(nodes[1].id),false);assert.equal(s.editor.draft.id,nodes[0].id);
  assert.equal(await s.panel.clear(),false);assert.equal(s.store.drafts.length,40);assert.equal(s.editor.isOpen(),true);
  const external=()=>{};s.elements.get('node-add').addEventListener('click',external);s.panel.destroy();
  assert.equal(s.elements.get('node-add').listeners.get('click').size,1);
});
test('missing clear confirmation owner disables clear; removed edited draft closes without camera commands',async()=>{
  const s=setup({confirmClear:undefined});const node=s.panel.add();assert.equal(s.elements.get('nodes-clear').disabled,true);
  assert.equal(await s.panel.clear(),false);s.store.remove(node.id);assert.equal(s.editor.isOpen(),false);assert.deepEqual(s.selected,[]);
});
test('failed editor construction releases formation listeners before returning the initialization error',()=>{
  const s=setup();s.panel.destroy();const tools=createSatelliteNodePanelTools({library:s.library});
  assert.throws(()=>tools.createNodeDraftPanel({root:s.root,store:s.store,now:()=>epoch,timers:{set(){},clear(){}},createFormationId:()=> 'F-failed',editorTools:{createNodeEditor(){throw Error('editor initialization failed');}}}),/editor initialization failed/);
  assert.equal(s.elements.get('formation-generate').listeners.get('click').size,0);
});
