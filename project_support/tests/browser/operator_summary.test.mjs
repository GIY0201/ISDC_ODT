import test from 'node:test';
import assert from 'node:assert/strict';
import {missionSummary,resourceSummary,conditionSummary,connectionSummary} from '../../../user_application/web/scripts/operator_summary.js';
test('mission summaries retain values, escape names and label states without treating progress as success',()=>{
 const html=missionSummary({name:'<mission>',status:'running',progress:72,plan_version:3});
 assert.match(html,/&lt;mission&gt;/);assert.match(html,/수행 중/);assert.match(html,/72%/);assert.match(html,/계획 v3/);
 assert.match(resourceSummary({power:54,link:61,compute:68,storage:65}),/전력/);
 assert.match(resourceSummary({power:54}),/value="54"/);
 const conditions=conditionSummary(['획득률 ≥ 90%']);assert.match(conditions,/popover/);assert.match(conditions,/미판정/);assert.doesNotMatch(conditions,/data-tone="good"/);
 assert.match(connectionSummary({total:17,connected:1,unknown:9}),/전체/);assert.match(connectionSummary({total:17}),/17/);
});
test('resource colour is continuous scale information and unknown metric units have no safety verdict',()=>{
 assert.match(resourceSummary({compute:95}),/--resource-hue/);
 assert.doesNotMatch(resourceSummary({compute:95}),/위험|정상/);
 assert.match(conditionSummary(['다운링크 성공률 ≥ 92%']),/92%/);
});
