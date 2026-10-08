import test from 'node:test';
import assert from 'node:assert/strict';
import {wallSummaryMarkup,dtSummaryMarkup} from '../../../user_application/web/scripts/workspace_wall_summary.js';
test('actual control dashboard never reports virtual runtime or accepted virtual nodes as operational measurements',()=>{const c={text:{satellite:'<SAT>'},deployment:{status:'accepted',count:40},run:{status:'source_sim',id:'RUN-A',running:true},mission:{id:'M-virtual'},data:{objects:[{}]}};const before=structuredClone(c),html=wallSummaryMarkup(c);assert.match(html,/원격측정/);assert.match(html,/미연동/);assert.match(html,/&lt;SAT&gt;/);assert.doesNotMatch(html,/RUN-A|40개|M-virtual|SIM 실행/);assert.deepEqual(c,before);});
test('DT overview exposes owned scenario progress and connection states without fabricating outcomes',()=>{const html=dtSummaryMarkup({context:{deployment:{status:'accepted',count:40}},runtime:{run_id:'RUN-A',running:false,elapsed_seconds:884.681,speed:5},scenario:{phase:'paused',scenario:{name:'<시험>'},steps:[{id:'a',status:'done'},{id:'b',status:'pending'}]},links:[{state:'active',link:{id:'L1',from:'A',to:'B'}}]});assert.match(html,/RUN-A/);assert.match(html,/40/);assert.match(html,/&lt;시험&gt;/);assert.match(html,/일시정지/);assert.match(html,/연결/);assert.match(html,/미판정/);assert.doesNotMatch(html,/data-command|onclick|·/);});
test('paired dashboards flank their central globe or system graph',()=>{assert.match(wallSummaryMarkup({}),/dashboard-side-left/);assert.match(wallSummaryMarkup({}),/dashboard-side-right/);const html=dtSummaryMarkup({modules:[{id:'A',name:'모듈 A',x:0,y:0,w:120,h:70}],links:[]});assert.match(html,/모듈 연결도/);assert.match(html,/<svg/);assert.match(html,/dt-center-panel/);});

test('DT module graph and folded cards preserve standby and disabled link evidence',()=>{
 const modules=[{id:'waiting',name:'대기 모듈',x:0,y:0,w:120,h:70},{id:'disabled',name:'중지 모듈',x:150,y:0,w:120,h:70}];
 const links=[{state:'standby',link:{id:'L13',from:'waiting',to:'waiting'}},{state:'disabled',link:{id:'L14',from:'disabled',to:'disabled'}}];
 const before=structuredClone({modules,links}),html=dtSummaryMarkup({modules,links});
 assert.match(html,/<title>대기 모듈 \/ 대기<\/title>/);
 assert.match(html,/<title>중지 모듈 \/ 사용 안 함<\/title>/);
 assert.match(html,/<div class="dt-module connection-standby"><strong>대기 모듈<\/strong><span>대기<\/span>/);
 assert.match(html,/<div class="dt-module connection-disabled"><strong>중지 모듈<\/strong><span>사용 안 함<\/span>/);
 assert.deepEqual({modules,links},before);
});
