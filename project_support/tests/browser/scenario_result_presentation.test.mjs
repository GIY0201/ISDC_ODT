import test from 'node:test';import assert from 'node:assert/strict';
import {scenarioEventMarkup,scenarioComparisonMarkup} from '../../../user_application/web/scripts/tabs/source_scenarios.js';
import {comparisonRows} from '../../../digital_twin/verification/browser/scenario_kpi.js';
test('event cards retain actual zero and source times, escape labels and never mint absent event timestamps',()=>{
 const events={fault_at_s:0,fault_link:'A<&B',detour_available_at_s:20,reroute_at_s:25,fault_end_s:40,primary_restored_at_s:null},copy=structuredClone(events),html=scenarioEventMarkup(events);
 assert.match(html,/scenario-event-cards/);assert.match(html,/T\+0 s/);assert.match(html,/T\+20 s/);assert.match(html,/재수렴 20 s/);assert.match(html,/A&lt;&amp;B/);assert.match(html,/주 경로 복귀[\s\S]*기록 없음/);assert.deepEqual(events,copy);assert.doesNotMatch(html,/T\+null|T\+undefined|NaN/);
});
test('comparison shows complete original four phases and source units, preserving zero and missing values',()=>{
 const phases={baseline:{route:{hops:0,total_delay_ms:12.3,reliability:.9},fabric:{source_stored_mb:50}}},copy=structuredClone(phases),rows=comparisonRows(phases),html=scenarioComparisonMarkup(rows);
 assert.match(html,/scenario-comparison-table/);for(const label of ['정상','장애','우회','복구'])assert.ok(html.includes(label));assert.match(html,/scope="row"/);assert.match(html,/12\.3 ms/);assert.match(html,/90\.0 %/);assert.match(html,/50 MB/);assert.match(html,/>0<\/td>/);assert.match(html,/측정 없음/);assert.deepEqual(phases,copy);assert.equal((html.match(/scope="row"/g)||[]).length,rows.length);assert.doesNotMatch(html,/>—<|NaN/);
});
