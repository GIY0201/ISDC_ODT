// Deferred existing-runner transaction tests. No native or hardware claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as kpi from '../../../digital_twin/verification/browser/scenario_kpi.js';
const {createScenarioRunner}=await import(process.env.ISDC_SCENARIO_DRAIN_RUNNER??new URL('../../../user_application/web/scripts/scenario/runner.js',import.meta.url));

for(const command of ['pause','speed','advance'])test(command+' drain blocks telemetry timer restart and old coalesced ticks',async()=>{
  const originalSet=globalThis.setInterval,originalClear=globalThis.clearInterval;
  const timers=new Map();let timerIds=0,finish,nativeCalls=0,active=0,maxActive=0;
  globalThis.setInterval=fn=>{const id=++timerIds;timers.set(id,fn);return id;};
  globalThis.clearInterval=id=>timers.delete(id);
  const blocked=new Promise(resolve=>finish=resolve),commands=[];
  const runner=createScenarioRunner({assembly:{},missionTypes:{},kpi,pairKey:()=>'',api:{scenario:async()=>({id:'poc',steps:[]}),runtimeControl:async action=>{commands.push(action);return{};},runtimeSpeed:async speed=>{commands.push(['speed',speed]);return{};},scenarioAdvance:async()=>{commands.push('advance');return{elapsed_seconds:1};}},constellation:{deployed:[],drafts:[]},groundSegment:{stations:[]},missionStore:{find:()=>null},dataDeployment:{},planner:{},networkTwin:{tick(){nativeCalls++;},exchange:async()=>{active++;maxActive=Math.max(maxActive,active);if(nativeCalls===1)await blocked;active--;},reachable:()=>false,report:null,last:{}},clock:{elapsed:()=>0,now:()=>0,disengage(){}}});
  try{
    await runner.select('poc');runner.state.phase='playing';
    const first=runner.tick();for(let i=0;i<10&&!active;i++)await Promise.resolve();assert.equal(active,1);
    const oldQueued=runner.tick();
    const pending=command==='pause'?runner.pause():command==='speed'?runner.setSpeed(10):runner.advance(1);
    for(let i=0;i<30;i++){runner.onTelemetry();for(const fn of [...timers.values()].slice(0,1))fn();await Promise.resolve();}
    assert.equal(timers.size,0,'telemetry must not restart intervals during drain');assert.equal(nativeCalls,1);assert.deepEqual(commands,[]);
    finish();await first;await oldQueued;await pending;
    assert.equal(maxActive,1);assert.equal(nativeCalls,command==='advance'?3:1,'coalesced old tick cannot start another drain cycle');
    assert.deepEqual(commands,command==='pause'?['pause']:command==='speed'?[['speed',10]]:['advance']);
    if(command==='pause')assert.equal(runner.state.phase,'paused');else assert.equal(timers.size,2,'successful playing control resumes existing timers once');
  }finally{finish?.();runner.stop();globalThis.setInterval=originalSet;globalThis.clearInterval=originalClear;}
});
