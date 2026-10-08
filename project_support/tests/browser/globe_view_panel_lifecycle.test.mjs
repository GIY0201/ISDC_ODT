import test from 'node:test';import assert from 'node:assert/strict';import{fixture}from'./workspace_fixture.mjs';import{createGlobeViewPanel}from'../../../user_application/web/scripts/tabs/globe_view.js';
test('basic sunlight status keeps source time and rendering state while scientific diagnostics are disclosed separately',()=>{
 const f=fixture();let panel;
 try{
  f.get('screen').innerHTML='';
  const globe={viewState:()=>({choice:{mode:'3d',imagery:'blue_marble',theme:'dark',emphasis:true},imagery:{phase:'ready'},mode:{phase:'ready'},available:true}),observeView:()=>()=>{},changeView(){}};
  const state={enabled:true,context:{key:'earth:current',utc:'2026-10-08T04:00:00Z'},timeline:{pending:false,error:'',eop_sha256:'a'.repeat(64)},renderer:{indicator:'offscreen',lighting:true},geometry:{eop_quality:{ut1:'predicted_a',polar_motion:'observed_a'}}};
  panel=createGlobeViewPanel(globe,{state:()=>state,observe:()=>()=>{},setEnabled(){},retry(){}});panel.show('settings');
  const status=()=>f.get('globe-solar-status').textContent;
  assert.match(status(),/현재 시각.*2026-10-08 13:00:00 KST.*음영 적용됨.*태양 화면 밖/);
  assert.doesNotMatch(status(),/ERFA|UT1|EOP|predicted_a|aaaaaaaa/);
  assert.equal(f.get('globe-solar-details').tag,'details');assert.equal(Boolean(f.get('globe-solar-details').open),false);
  assert.match(f.get('globe-solar-basis').textContent,/ERFA.*실측 아님.*aaaaaaaa.*UT1 predicted_a.*극운동 observed_a/);
  state.enabled=false;panel.update();assert.match(status(),/음영 꺼짐/);
  state.enabled=true;state.renderer.lighting=false;panel.update();assert.match(status(),/음영 적용 대기/);
  state.timeline.pending=true;panel.update();assert.match(status(),/태양 자료 준비 중/);
  state.timeline.pending=false;state.timeline.error='EOP unavailable';panel.update();assert.match(status(),/태양 계산 오류: EOP unavailable/);
 }finally{panel?.destroy();f.dispose();}
});
test('solar panel exposes source KST/error/retry and removes owned solar control handlers',async()=>{
 const f=fixture();try{
 f.get('screen').innerHTML='';const observers=new Set(),calls=[];
 const globe={viewState:()=>({choice:{mode:'3d',imagery:'blue_marble',theme:'dark',emphasis:true},imagery:{phase:'ready'},mode:{phase:'ready'},available:true}),observeView:()=>()=>{},changeView(){}};
 const solar={state:()=>({enabled:true,context:{key:'stored:ISS',utc:'2020-07-12T21:16:01Z'},timeline:{status:'error',error:'EOP unavailable',eop_sha256:'a'.repeat(64)},renderer:{indicator:'unavailable'}}),observe(fn){observers.add(fn);return()=>observers.delete(fn);},setEnabled:v=>calls.push(v),retry:()=>calls.push('retry')};
 const panel=createGlobeViewPanel(globe,solar);panel.show('settings');assert.match(f.get('globe-solar-status').textContent,/EOP unavailable/);assert.match(f.get('globe-solar-status').textContent,/2020-07-13 06:16:01 KST/);const checkbox=f.get('globe-lighting'),button=f.get('globe-solar-retry');checkbox.checked=false;await checkbox.dispatch('change');await button.dispatch('click');assert.deepEqual(calls,[false,'retry']);panel.destroy();assert.equal(checkbox.listeners.get('change').size,0);assert.equal(button.listeners.get('click').size,0);assert.equal(observers.size,0);
 }finally{f.dispose();}
});
test('panel teardown removes detached and connected field handlers; remount binds one new owner',async()=>{
 const f=fixture();try{
 f.get('screen').innerHTML='';const observers=new Set(),calls=[];
 const globe={viewState:()=>({choice:{mode:'3d',imagery:'blue_marble',theme:'dark',emphasis:true},imagery:{phase:'ready',displayedImagery:'blue_marble'},mode:{phase:'ready'},available:true}),observeView:fn=>{observers.add(fn);return()=>observers.delete(fn);},changeView:patch=>(calls.push(patch),true)};
 const first=createGlobeViewPanel(globe);first.show('settings');const old=f.get('globe-mode');assert.equal(old.listeners.get('change').size,1);first.destroy();assert.equal(old.listeners.get('change').size,0);assert.equal(observers.size,0);
 const second=createGlobeViewPanel(globe);second.show('settings');old.value='2d';await old.dispatch('change');assert.deepEqual(calls,[{mode:'2d'}]);
 f.get('screen').innerHTML='';second.show('settings');assert.equal(old.listeners.get('change').size,0);const latest=f.get('globe-mode');assert.notEqual(latest,old);assert.equal(latest.listeners.get('change').size,1);second.destroy();assert.equal(latest.listeners.get('change').size,0);
 }finally{f.dispose();}
});
