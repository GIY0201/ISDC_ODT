import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
test('linked task opens its own named target without replacing the current DOM or sending a foreign form draft',async()=>{
 let opened;const messages=[],child={location:{origin:'http://localhost'},document:{readyState:'complete'},focus(){},postMessage:(value,origin)=>messages.push({value,origin})};const f=fixture(1280,720,{open:(url,name)=>{opened={url,name};return child;}});try{
  const field=f.get('ground-height'),viewer=f.viewers[0],title=f.get('window-title').textContent;field.value='unsaved source';field.focus();const target=f.doc.createElement('button');target.dataset.view='mission';f.get('screen').append(target);const counts=f.counts();await f.doc.dispatch('click',{target});
  assert.equal(new URL(opened.url).hash,'#mission');assert.equal(opened.name,'isdc-odt-v6-mission');assert.equal(f.get('window-title').textContent,title);assert.equal(f.get('ground-height'),field);assert.equal(field.value,'unsaved source');assert.equal(f.viewers[0],viewer);assert.deepEqual(f.counts(),counts);assert.equal(messages[0].value.view,'mission');assert.equal(messages[0].value.state.view,'mission');assert.deepEqual(structuredClone(messages[0].value.draft),[]);
  await f.win.dispatch('message',{origin:'http://localhost',source:child,data:{type:'isdc-v6-ready'}});assert.equal(messages.at(-1).value.view,'mission');assert.deepEqual(structuredClone(messages.at(-1).value.draft),[]);
 }finally{f.dispose();}
});
test('blocked linked task stays in its current window and closed child readiness cannot resurrect delivery',async()=>{
 let child=null;const messages=[],f=fixture(1280,720,{open:()=>child});try{const target=f.doc.createElement('button');target.dataset.view='mission';f.get('screen').append(target);const field=f.get('ground-height');field.value='321';await f.doc.dispatch('click',{target});assert.match(f.get('popout-feedback').textContent,/차단/);assert.equal(f.get('window-title').textContent,'지상국·통신');assert.equal(f.get('ground-height'),field);
  child={closed:false,location:{origin:'http://localhost'},document:{readyState:'loading'},focus(){},postMessage:value=>messages.push(value)};await f.doc.dispatch('click',{target});child.closed=true;await f.win.dispatch('message',{origin:'http://localhost',source:child,data:{type:'isdc-v6-ready'}});assert.equal(messages.length,0);
 }finally{f.dispose();}
});
test('linked target reuses its owned live window and popup roles can parent a further linked task',async()=>{
 let opens=0;const messages=[],child={location:{origin:'http://localhost'},document:{readyState:'complete'},focus(){},postMessage:value=>messages.push(value)},f=fixture(1280,720,{popout:true,opener:{postMessage(){}},open:()=>{opens++;return child;}});try{
  const target=f.doc.createElement('button');target.dataset.view='mission';f.get('screen').append(target);await f.doc.dispatch('click',{target});await f.doc.dispatch('click',{target});assert.equal(opens,1);assert.equal(messages.length,2);
  await f.win.dispatch('message',{origin:'http://localhost',source:child,data:{type:'isdc-v6-ready'}});assert.equal(messages.at(-1).view,'mission');assert.deepEqual(structuredClone(messages.at(-1).draft),[]);const count=messages.length;await f.win.dispatch('pagehide',{persisted:false});await f.win.dispatch('message',{origin:'http://localhost',source:child,data:{type:'isdc-v6-ready'}});assert.equal(messages.length,count);assert.notEqual(child.closed,true);
 }finally{f.dispose();}
});
test('page exit during child focus cannot publish or register late popup drafts',async()=>{
 const messages=[];let f;const child={location:{origin:'http://localhost'},document:{readyState:'complete'},focus(){void f.win.dispatch('pagehide',{persisted:false});},postMessage:value=>messages.push(value)};f=fixture(1280,720,{open:()=>child});try{await f.get('window-popout').dispatch('click');assert.equal(messages.length,0);await f.win.dispatch('message',{origin:'http://localhost',source:child,data:{type:'isdc-v6-ready'}});assert.equal(messages.length,0);assert.notEqual(child.closed,true);}finally{f.dispose();}
});

test('restore shelf is absent without a minimized target and restores the same window when present',async()=>{
 const f=fixture();try{
  assert.equal(f.get('window-shelf').hidden,true);
  await f.get('window-minimize').dispatch('click');assert.equal(f.get('window-shelf').hidden,false);assert.equal(f.get('work-window').hidden,true);
  await f.get('shelf-restore').dispatch('click');assert.equal(f.get('window-shelf').hidden,true);assert.equal(f.get('work-window').hidden,false);
  await f.get('window-minimize').dispatch('click');await f.get('window-close').dispatch('click');assert.equal(f.get('window-shelf').hidden,true);assert.equal(f.viewers.length,1);
 }finally{f.dispose();}
});

test('blocked popout is explained without changing the parent window or Viewer',async()=>{const f=fixture();try{await f.get('window-popout').dispatch('click');assert.equal(f.get('popout-feedback').hidden,false);assert.match(f.get('popout-feedback').textContent,/차단/);assert.equal(f.viewers.length,1);assert.equal(f.get('work-window').hidden,false);}finally{f.dispose();}});
test('popout opens the current task on the same origin and sends a draft to an already loaded child',async()=>{
  let opened;const messages=[];const child={location:{origin:'http://localhost'},document:{readyState:'complete'},focus(){},postMessage:(value,origin)=>messages.push({value,origin})};
  const f=fixture(1280,720,{open:(url,name)=>{opened={url,name};return child;}});try{f.get('ground-height').value='444';await f.get('window-popout').dispatch('click');const url=new URL(opened.url);assert.equal(url.searchParams.get('popout'),'1');assert.equal(url.hash,'#ground');assert.equal(url.origin,'http://localhost');assert.equal(messages[0].origin,url.origin);assert.equal(messages[0].value.view,'ground');assert.ok(messages[0].value.draft.some(row=>row.id==='ground-height'&&row.value==='444'));assert.equal(f.viewers.length,1);}finally{f.dispose();}
});
test('parent does not provide drafts to an unregistered same-origin message source',async()=>{let sent=0;const f=fixture();try{await f.win.dispatch('message',{origin:'http://localhost',source:{postMessage(){sent++;}},data:{type:'isdc-v6-ready'}});assert.equal(sent,0);}finally{f.dispose();}});
test('child accepts its opener snapshot after real ground-panel render and preserves transferred draft',async()=>{
  const opener={postMessage(){}};const f=fixture(1280,720,{popout:true,opener});try{await f.win.dispatch('message',{origin:'http://localhost',source:opener,data:{type:'isdc-v6-snapshot',view:'ground',state:{view:'ground'},draft:[{id:'ground-height',value:'444'},{id:'visibility-start',value:'2020-07-12T21:47:41Z'}]}});assert.equal(f.get('ground-height').value,'444');assert.equal(f.get('visibility-start').value,'2020-07-12T21:47:41Z');f.context.render();f.flush();assert.equal(f.get('ground-height').value,'444');assert.equal(f.viewers.length,1);}finally{f.dispose();}
});
test('child rejects a snapshot from another same-origin window',async()=>{const f=fixture(1280,720,{popout:true,opener:{postMessage(){}}});try{await f.win.dispatch('message',{origin:'http://localhost',source:{},data:{type:'isdc-v6-snapshot',view:'mission',state:{view:'mission'},draft:[]}});assert.equal(f.get('window-title').textContent,'지상국·통신');}finally{f.dispose();}});
test('remote draft update survives subsequent orbit rendering and does not echo back',async()=>{const f=fixture();try{const channel=f.channels.find(c=>c.name==='isdc-odt-v6-mock'),before=channel.messages?.length??0;await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'ground',id:'ground-height',value:'333'}});await channel.dispatch('message',{data:{type:'state',sender:'other',state:{sat:'SAT-B'}}});assert.equal(f.get('ground-height').value,'333');assert.equal((channel.messages||[]).filter(row=>row.type==='draft').length,0);assert.ok((channel.messages?.length??0)>=before);}finally{f.dispose();}});
test('remote draft does not silently overwrite a field the user is editing',async()=>{const f=fixture();try{const field=f.get('ground-height');field.value='123';field.focus();await f.channels.find(c=>c.name==='isdc-odt-v6-mock').dispatch('message',{data:{type:'draft',sender:'other',view:'ground',id:field.id,value:'333'}});assert.equal(field.value,'123');assert.equal(f.get('popout-feedback').hidden,false);assert.match(f.get('popout-feedback').textContent,/유지/);}finally{f.dispose();}});
test('closing child keeps one Viewer until exit and releases channels once on exit',async()=>{const f=fixture(1280,720,{popout:true});try{await f.get('window-close').dispatch('click');assert.equal(f.win.closed,true);assert.equal(f.viewers.length,1);await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.viewers[0].destroyCount,1);assert.ok(f.channels.every(c=>c.closed));}finally{f.dispose();}});

test('revision-owned selectors are excluded from draft messages and popout snapshots',async()=>{const f=fixture();try{const channel=f.channels.find(c=>c.name==='isdc-odt-v6-mock');const field=f.get('ground-input'),before=field.value;await channel.dispatch('message',{data:{type:'draft',sender:'other',view:'ground',id:field.id,value:'forged-input'}});assert.equal(field.value,before);await f.get('screen').dispatch('change',{target:field});assert.equal(channel.messages.filter(row=>row.type==='draft'&&row.id===field.id).length,0);}finally{f.dispose();}});

test('unchanged draft restoration does not mark an applied ground point as edited',async()=>{const f=fixture();try{const before=f.get('visibility-status').textContent;await f.channels.find(c=>c.name==='isdc-odt-v6-mock').dispatch('message',{data:{type:'state',sender:'other',state:{sat:'SAT-B'}}});assert.equal(f.get('visibility-status').textContent,before);}finally{f.dispose();}});
