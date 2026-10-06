import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {layoutTimeline,timelineMarkup} from '../../../digital_twin/visualization/mission_timeline.js';
test('source UTC task timeline includes contacts, eclipses, target and escaped labels',()=>{
 const start='2020-07-12T21:00:00Z',end='2020-07-12T23:00:00Z',rows=[{id:'N1',label:'<node>'}];
 const interval={satellite:'N1',start:'2020-07-12T21:10:00Z',end:'2020-07-12T21:20:00Z'};
 const markup=timelineMarkup(layoutTimeline({rows,start,end}),{tasks:[{...interval,id:'T1',mission_id:'M1',kind:'process',label:'<task>'}],contacts:[{...interval,station:'GS'}],eclipses:[interval],accesses:[interval],now:start});
 for(const text of ['mt-contact','mt-eclipse','mt-access','data-timeline-task="T1"','&lt;node&gt;','&lt;task&gt;','21:30'])assert.ok(markup.includes(text),text);
 assert.ok(!markup.includes('<task>'));
});

test('UTC layout/render source stays byte-identical to pinned senior implementation',async()=>{const expected=JSON.parse(await readFile(new URL('../fixtures/original_mission_timeline.json',import.meta.url),'utf8'));const source=await readFile(new URL('../../../digital_twin/visualization/mission_timeline.js',import.meta.url));assert.equal(createHash('sha256').update(source).digest('hex'),expected.sha256);});
