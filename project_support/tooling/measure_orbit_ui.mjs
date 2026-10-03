/** Analyze a saved browser recorder JSON without launching another browser. */
import {readFile,writeFile} from 'node:fs/promises';
import {summarizeMeasurements} from '../../user_application/web/scripts/orbit_ui_measurement.js';
import {summarizePresentationTrace} from './orbit_trace_measurement.mjs';
const [input,output,tracePath]=process.argv.slice(2);
if(!input)throw new Error('Usage: node measure_orbit_ui.mjs input.json [summary.json]');
const record=JSON.parse(await readFile(input,'utf8'));
const result={context:record.context,summary:summarizeMeasurements(record.raw)};
if(tracePath)result.trace=summarizePresentationTrace(JSON.parse(await readFile(tracePath,'utf8')));
if(output)await writeFile(output,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
