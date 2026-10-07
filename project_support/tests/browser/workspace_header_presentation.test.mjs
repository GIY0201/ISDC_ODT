import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectWorkspaceContext} from '../../../user_application/web/scripts/workspace_context.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('main status is a single row with a mode, without duplicated branding or always visible unknown UTC',()=>{
 const html=read('../../../user_application/web/index.html');
 assert.doesNotMatch(html,/<header class="topbar">/);assert.doesNotMatch(html,/class="glass contact"/);
 assert.match(html,/id="current-mode"/);assert.doesNotMatch(html,/id="clock"/);
 assert.match(html,/id="context-id"/);assert.match(html,/source_security\.css/);
});
test('configured integration mode is labeled as configuration and does not assert equipment connection',()=>{
 for(const [id,label] of [['standalone','단독 운용'],['em','EM 연동'],['integration','통합 시험']]){
  const v=projectWorkspaceContext({configuredMode:id});assert.equal(v.text.mode,label);assert.equal(v.run.status,'unavailable');
 }
 for(const id of ['bad','toString','__proto__'])assert.equal(projectWorkspaceContext({configuredMode:id}).text.mode,'운용 모드 미확인');
});
test('integration keeps its accessible section label without duplicate internal title',()=>{
 const js=read('../../../user_application/web/scripts/tabs/source_settings.js');
 assert.doesNotMatch(js,/<header><h2>모듈 연결 설정과 ICD<\/h2>/);
 assert.match(js,/setAttribute\('aria-label','모듈 연결 설정과 ICD'\)/);
});
