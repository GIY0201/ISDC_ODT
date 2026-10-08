import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';
for(const [width,height]of [[1280,720],[1920,1080]])test(`wall reuses the actual shared globe and loaded scopes without querying or changing clock ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#wall'});
 try{
  const surface=f.get('workspace-globe-surface'),canvasOwner=f.get('stored-orbit-globe'),viewer=f.viewers[0];
  assert.equal(surface.parent,f.get('desktop'));assert.equal(canvasOwner.parent,surface);assert.equal(f.viewers.length,2);
  assert.match(f.get('wall-scope-status').textContent,/프로젝트 배포/);assert.ok(f.doc.getElementById('wall-mode'));assert.equal(f.doc.getElementById('globe-view')?.isConnected===true,false);assert.equal(f.doc.getElementById('catalog-scene')?.isConnected===true,false);
  const before=f.evaluate('JSON.stringify(globe.displayContext())'),counts=f.counts();
  assert.equal(f.context.setWorkspaceWallScope('whole'),true);assert.match(f.get('wall-scope-status').textContent,/불러온 카탈로그/);
  assert.equal(f.evaluate('JSON.stringify(globe.displayContext())'),before);assert.deepEqual(f.counts(),counts);
  f.get('wall-mode').value='2d';await f.get('wall-mode').dispatch('change');assert.equal(viewer.scene.mode,3);assert.equal(f.viewers[1].scene.mode,2);
  await f.get('window-minimize').dispatch('click');assert.equal(surface.parent,f.get('desktop'));await f.get('shelf-restore').dispatch('click');assert.equal(surface.parent,f.get('desktop'));
  f.evaluate("location.hash='#settings'");await f.win.dispatch('hashchange');assert.equal(surface.parent,f.get('desktop'));assert.equal(f.viewers[0],viewer);
  f.evaluate("location.hash='#wall'");await f.win.dispatch('hashchange');assert.equal(surface.parent,f.get('desktop'));assert.equal(f.get('wall-mode').value,'2d');assert.match(f.get('wall-scope-status').textContent,/불러온 카탈로그/);
  assert.equal(f.doc.getElementById('globe-view')?.isConnected===true,false);assert.equal(f.doc.getElementById('catalog-scene')?.isConnected===true,false);
  assert.doesNotMatch(f.get('screen').innerHTML,/SAT-A|개념 시안/);assert.equal(f.doc.getElementById('window-quick'),null);
 }finally{f.dispose();}
});

test('wall catalog toggle is additive and only its explicit ON requests missing catalog data',async()=>{
 const f=fixture(1280,720,{hash:'#wall'});try{
  f.evaluate("globalThis.wallLoads=[];catalogScene.configure({group:'active',query:'',orbit:'all'});catalogScene.load=async utc=>{wallLoads.push(utc);};");
  assert.equal(f.evaluate('wallLoads.length'),0);assert.equal(f.get('wall-whole').attributes['aria-pressed'],'false');
  assert.equal(f.context.setWorkspaceWallScope('toggle'),true);await Promise.resolve();assert.equal(f.evaluate('wallLoads.length'),1);assert.equal(f.get('wall-whole').attributes['aria-pressed'],'true');
  const before=f.evaluate('JSON.stringify(globe.displayContext())');f.context.setWorkspaceWallScope('toggle');assert.equal(f.evaluate('wallLoads.length'),1);assert.equal(f.evaluate('JSON.stringify(globe.displayContext())'),before);assert.equal(f.get('wall-whole').attributes['aria-pressed'],'false');
 }finally{f.dispose();}
});

test('fresh wall ON uses existing catalog conditions and original live owner; OFF fences late setup',async()=>{
 const f=fixture(1280,720,{hash:'#wall'});try{
  f.evaluate("globalThis.wallLoads=[];globalThis.wallSetup=0;const savedWallClient=client.snapshot;client.snapshot=()=>({...savedWallClient(),status:'loading',state:null});globe.displayContext=()=>null;const previousWallTimeline=catalogTimeline.snapshot;catalogTimeline.snapshot=()=>({...previousWallTimeline(),utc:null});catalogScenePanel.requestUtc=()=> '2026-10-07T01:00:00.000Z';catalogPanel.controller.load=async()=>{wallSetup++;catalogScene.configure({group:'active',query:'',orbit:'all'});};catalogScene.load=async utc=>{wallLoads.push(utc);};");
  assert.equal(f.evaluate('wallSetup'),0);f.context.setWorkspaceWallScope('toggle');await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.evaluate('wallSetup'),1);assert.match(f.evaluate('wallLoads[0]'),/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/);assert.notEqual(f.evaluate('wallLoads[0]'),'2026-10-07T01:00:00.000Z');assert.doesNotMatch(f.get('wall-globe-caption').textContent,/위성 창에서 저장 입력/);
  f.context.setWorkspaceWallScope('toggle');assert.doesNotMatch(f.get('wall-globe-caption').textContent,/조회 준비 중/);f.evaluate("catalogScene.configure(null);catalogPanel.controller.load=()=>new Promise(resolve=>{globalThis.finishWallSetup=resolve;});");
  f.context.setWorkspaceWallScope('toggle');f.context.setWorkspaceWallScope('toggle');f.evaluate("catalogScene.configure({group:'active',query:'',orbit:'all'});finishWallSetup();");await new Promise(resolve=>setTimeout(resolve,0));assert.equal(f.evaluate('wallLoads.length'),1);
  f.evaluate("catalogScene.configure(null);");f.context.setWorkspaceWallScope('toggle');f.evaluate("location.hash='#settings'");await f.win.dispatch('hashchange');f.evaluate("location.hash='#wall'");await f.win.dispatch('hashchange');f.evaluate("catalogScene.configure({group:'active',query:'',orbit:'all'});finishWallSetup();");await new Promise(resolve=>setTimeout(resolve,0));assert.equal(f.evaluate('wallLoads.length'),1);
 }finally{f.dispose();}
});

test('enabled wall scope stays ON while live catalog coordinates are refreshing',async()=>{const f=fixture(1280,720,{hash:'#wall'});try{await new Promise(r=>setTimeout(r,0));f.evaluate("const previousSnapshot=catalogScene.snapshot;catalogScene.snapshot=()=>({...previousSnapshot(),pending:true});");f.context.setWorkspaceWallScope('whole');assert.equal(f.get('wall-whole').textContent,'전체 위성 ON');assert.equal(f.get('wall-whole').attributes['aria-pressed'],'true');assert.equal(f.get('wall-scope-status').hidden,true);f.context.setWorkspaceWallScope('ours');assert.equal(f.get('wall-whole').textContent,'전체 위성 OFF');}finally{f.dispose();}});
