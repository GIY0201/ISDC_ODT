import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace_fixture.mjs';

test('station management starts collapsed and a map edit reveals the existing editor without saving',async()=>{
 const f=fixture(1280,720,{hash:'#ground'});
 try{
  const management=f.get('ground-node-management');
  assert.equal(management?.tag,'details');assert.equal(Boolean(management.open),false);
  f.evaluate("sourceGround.select('GS-DAEJEON')");
  const before=JSON.stringify(f.evaluate('sourceGround.stations'));
  await f.get('ground-node-map-edit').dispatch('click');
  assert.equal(management.open,true);assert.equal(f.get('ground-node-editor').hidden,false);
  assert.equal(f.get('ground-node-name').value,'대전');
  assert.equal(JSON.stringify(f.evaluate('sourceGround.stations')),before);assert.equal(f.counts().commands,0);
 }finally{f.dispose();}
});

test('advanced deployed analysis and communication diagnostics are collapsed but retain actions',()=>{
 const f=fixture(1280,720,{hash:'#ground'});
 try{
  for(const id of ['ground-node-analysis','ground-node-contact-plan','ground-node-fabric-disclosure','ground-node-diagnostics']){
   assert.equal(f.get(id)?.tag,'details',id);assert.equal(Boolean(f.get(id).open),false,id);
  }
  for(const id of ['ground-node-calculate','ground-node-pass-query','ground-node-fabric-send','ground-node-future-pass-refresh'])assert.ok(f.get(id),id);
  assert.equal(f.counts().commands,0);
 }finally{f.dispose();}
});

test('catalog visibility describes its actual selected time basis instead of implying current time',()=>{
 const f=fixture(1280,720,{hash:'#ground'});
 try{
  const html=f.get('catalog-passes').innerHTML;
  assert.match(html,/선택 시각부터 24시간 조회/);
  assert.doesNotMatch(html,/앞으로 24시간|시간 탐색에서 적용/);
  assert.match(f.get('cat-pass-status').textContent,/위성을 먼저 선택/);
  assert.equal(f.get('cat-pass-query').disabled,true);
  assert.ok(f.get('cat-pass-basis'));
 }finally{f.dispose();}
});
