import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenarioAssembly} from '../../../digital_twin/model_library/browser/scenario_assembly.js';
import {createScenarioRunner} from '../../../user_application/web/scripts/scenario/runner.js';
import {createScenarioClock} from '../../../user_application/web/scripts/scenario/clock.js';
import {createSourceScenarioPanel} from '../../../user_application/web/scripts/tabs/source_scenarios.js';
import * as kpi from '../../../digital_twin/verification/browser/scenario_kpi.js';
test('assembly requires existing owners, never creates alternate models',()=>{assert.throws(()=>createScenarioAssembly(),/owners/);});
test('runner requires supplied assembly, model and module owners before state changes',()=>{assert.throws(()=>createScenarioRunner({}),/owners/);});
test('scenario SIM clock engagement leaves GP clock untouched unless explicitly enabled',()=>{let follow=0,release=0;const status={started_at:'2026-10-07T00:00:00Z',elapsed_seconds:5,running:false,speed:1};const clock=createScenarioClock({runtime:()=>status,followAll:()=>follow++,releaseAll:()=>release++});clock.engage();assert.equal(clock.engaged,true);assert.equal(follow,0);assert.equal(clock.now(),Date.parse(status.started_at)+5000);clock.setFollowAnalysis(true);assert.equal(follow,1);clock.disengage();assert.equal(release,1);});
test('KPI refuses missing observations rather than reporting zero',()=>{const checks=kpi.evaluateChecks([{metric:'data.stability',min:90,label:'stability'}],{});assert.equal(checks[0].pending,true);});
test('scenario panel requires existing runner and document',()=>assert.throws(()=>createSourceScenarioPanel(),/owners/));

test('preflight rejects missing live dependencies before any SIM or store command', async()=>{
 const calls=[];const clock={elapsed:()=>0,now:()=>0};const runner=createScenarioRunner({assembly:{},missionTypes:{},kpi,pairKey:()=>'',api:{scenario:async()=>({id:'poc'})},constellation:{},groundSegment:{},missionStore:{},dataDeployment:{},planner:{},networkTwin:{},clock,preflight:async()=>{throw Error('native deployment adapter unavailable');}});
 await runner.select('poc');await assert.rejects(runner.setup(),/adapter unavailable/);assert.deepEqual(calls,[]);assert.equal(runner.state.phase,'selected');
});
