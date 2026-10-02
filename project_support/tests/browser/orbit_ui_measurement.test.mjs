import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMeasurements} from '../../../user_application/web/scripts/orbit_ui_measurement.js';
test('nearest-rank percentiles retain outliers and never pass empty measurements',()=>{const report=summarizeMeasurements({frames:[1,2,3,100],feedback:[20],utcResult:[90],dayResult:[1200]});assert.equal(report.frames.p95,100);assert.equal(report.frames.max,100);assert.equal(report.gates.frames,false);assert.equal(report.gates.feedback,true);assert.equal(report.gates.utcResult,true);assert.equal(report.gates.dayResult,false);assert.equal(summarizeMeasurements({}).gates.frames,null);});
test('hidden frame samples are kept separate from foreground acceptance',()=>{const report=summarizeMeasurements({frames:[16,16],hiddenFrames:[4000],feedback:[]});assert.equal(report.frames.max,16);assert.equal(report.hiddenFrames.max,4000);assert.equal(report.gates.feedback,null);});
