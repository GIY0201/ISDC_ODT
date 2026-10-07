import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
test('empty UI choice restores server selection without clearing its result or sending a command',async()=>{
 const f=fixture(1280,720,{hash:'#satellite'});
 try{f.evaluate('globalThis.selectionCalls=[];client.select=value=>selectionCalls.push(value);');const selection=f.get('orbit-input'),panel=f.get('stored-orbit'),before=f.snapshot(),rendered=panel.innerHTML,counts=f.counts();
  selection.value='';await selection.dispatch('change');assert.equal(selection.value,before.state.input_id);assert.deepEqual(structuredClone(f.context.selectionCalls),[]);assert.deepEqual(f.snapshot(),before);assert.deepEqual(f.counts(),counts);assert.equal(panel.innerHTML,rendered);
  selection.value='another-input';await selection.dispatch('change');assert.deepEqual(structuredClone(f.context.selectionCalls),['another-input']);assert.deepEqual(f.snapshot(),before);
 }finally{f.dispose();}
});
