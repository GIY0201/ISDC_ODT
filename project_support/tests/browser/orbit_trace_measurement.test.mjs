import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePresentationTrace} from '../../tooling/orbit_trace_measurement.mjs';
test('only completed marked trials of this renderer contribute presentation intervals',()=>{
  const event=(name,ts,pid=7)=>({name,ts,pid});
  const events=[event('orbit-frame-trial-1-start',0),event('AnimationFrame::Presentation',1000),event('AnimationFrame::Presentation',17000),event('AnimationFrame::Presentation',41000),event('orbit-frame-trial-1-end',30000001),event('orbit-frame-trial-2-start',31000000),event('AnimationFrame::Presentation',31001000),event('AnimationFrame::Presentation',31201000),event('AnimationFrame::Presentation',200000,8)];
  const report=summarizePresentationTrace({traceEvents:events});
  assert.equal(report.completedTrials,1);assert.equal(report.incompleteTrials,1);assert.equal(report.presentation.count,2);assert.equal(report.presentation.max,24);assert.equal(report.presentation.p95,24);assert.equal(report.gates.presentation,false);assert.equal(report.gates.protocol,false);
});
test('missing presentation and ambiguous renderer provenance never pass',()=>{
  assert.equal(summarizePresentationTrace({traceEvents:[]}).gates.presentation,null);
  assert.throws(()=>summarizePresentationTrace({traceEvents:[{name:'orbit-frame-trial-1-start',ts:0,pid:1},{name:'orbit-frame-trial-2-start',ts:0,pid:2}]}),/renderer/);
});
