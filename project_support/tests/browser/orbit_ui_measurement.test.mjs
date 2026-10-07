import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMeasurements,installOrbitUiMeasurement,bindOrbitUiDiagnostics} from '../../../user_application/web/scripts/orbit_ui_measurement.js';

test('diagnostics install only on explicit open and preserve one recorder through close and reopen',()=>{
  let open,installs=0;const panel={hidden:false},raw={frames:[42]};
  const button={addEventListener:(_,fn)=>{open=fn;},removeEventListener(){}};
  const recorder={raw,show(){panel.hidden=false;},hide(){panel.hidden=true;}};
  bindOrbitUiDiagnostics(button,()=>{installs++;return recorder;});
  assert.equal(installs,0);open();assert.equal(installs,1);
  recorder.hide();assert.equal(panel.hidden,true);open();assert.equal(panel.hidden,false);
  assert.equal(installs,1);assert.deepEqual(raw.frames,[42]);
});
test('nearest-rank percentiles retain outliers and never pass empty measurements',()=>{const report=summarizeMeasurements({frames:[1,2,3,100],feedback:[20],utcResult:[90],dayResult:[1200]});assert.equal(report.frames.p95,100);assert.equal(report.frames.max,100);assert.equal(report.gates.frames,false);assert.equal(report.gates.feedback,true);assert.equal(report.gates.utcResult,true);assert.equal(report.gates.dayResult,false);assert.equal(summarizeMeasurements({}).gates.frames,null);});
test('hidden frame samples are kept separate from foreground acceptance',()=>{const report=summarizeMeasurements({frames:[16,16],hiddenFrames:[4000],feedback:[]});assert.equal(report.frames.max,16);assert.equal(report.hiddenFrames.max,4000);assert.equal(report.gates.feedback,null);});

function fixture(){
  const listeners={},buttons={},output={},callbacks=new Map();let now=0,next=0,eventObserver,box,mutationObserver;
  const doc={visibilityState:'visible',hasFocus:()=>true,createElement:()=>box={style:{},querySelector:id=>id==='#measure-output'?output:(buttons[id]??={addEventListener:(_,callback)=>listeners[id]=callback})},body:{append(){}},querySelector:()=>null,addEventListener:(_,cb)=>listeners.click=cb,removeEventListener:()=>{delete listeners.click;}};
  class Observer {constructor(cb){if(cb){this.callback=cb;mutationObserver=this;}}observe(){this.disconnected=false;}disconnect(){this.disconnected=true;}}
  class EventObserver extends Observer {static supportedEntryTypes=['event'];constructor(cb){super();this.callback=cb;eventObserver=this;}observe(options){this.options=options;}takeRecords(){return [];}}
  const host={document:doc,navigator:{userAgent:'test',hardwareConcurrency:4},performance:{now:()=>now},innerWidth:1280,innerHeight:720,devicePixelRatio:1,requestAnimationFrame:cb=>{callbacks.set(++next,cb);return next;},cancelAnimationFrame:id=>callbacks.delete(id),MutationObserver:Observer,PerformanceObserver:EventObserver,addEventListener:(_,cb)=>listeners.pagehide=cb};
  const recorder=installOrbitUiMeasurement(host);
  return {recorder,host,listeners,buttons,output,get box(){return box;},get mutationObserver(){return mutationObserver;},get eventObserver(){return eventObserver;},advance:value=>{now=value;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(cb=>cb(now));}};
}

test('closing the real panel stops interaction observation and reopening retains original trial data',()=>{
 const f=fixture();f.listeners['#measure-start']();f.advance(1);f.advance(43);const before=structuredClone(f.recorder.raw);
 f.listeners['#measure-close']();assert.equal(f.box.hidden,true);assert.equal(f.eventObserver.disconnected,true);assert.equal(f.listeners.click,undefined);
 f.recorder.show();assert.equal(f.box.hidden,false);assert.equal(typeof f.listeners.click,'function');assert.deepEqual(f.recorder.raw,before);
 f.advance(30001);assert.equal(f.recorder.raw.events.filter(e=>e.id==='frame-trial-complete').length,1);
});
test('a running thirty-second trial cannot be restarted or count an incomplete trial as complete',()=>{
  const f=fixture();f.listeners['#measure-start']();f.advance(1000);f.listeners['#measure-start']();f.advance(30001);
  assert.equal(f.recorder.raw.events.filter(e=>e.id==='frame-trial').length,1);
  assert.equal(f.recorder.raw.events.filter(e=>e.id==='frame-trial-complete').length,1);
  assert.equal(f.recorder.raw.events.find(e=>e.id==='frame-trial-complete').trial,1);
  f.listeners['#measure-start']();f.listeners.pagehide({persisted:false});
  assert.equal(f.recorder.raw.events.filter(e=>e.id==='frame-trial-aborted').length,1);
});
test('Event Timing retains slow observed presentation and never substitutes RAF or missing entries',()=>{
  const f=fixture();assert.deepEqual(f.eventObserver.options,{type:'event',buffered:false,durationThreshold:16});
  f.eventObserver.callback({getEntries:()=>[{name:'click',startTime:10,duration:80,processingStart:14,processingEnd:22,interactionId:42,target:{closest:()=>({id:'orbit-seek'})}}]});
  f.listeners['#measure-report']();const record=JSON.parse(f.output.textContent);
  assert.equal(record.raw.eventTiming[0].duration,80);assert.equal(record.summary.gates.eventTiming,false);
  assert.equal(summarizeMeasurements({feedback:[10]}).gates.eventTiming,null);
  f.listeners.pagehide({persisted:false});assert.equal(f.eventObserver.disconnected,true);
});
test('input presentation groups related entries by interaction and excludes pointer hover',()=>{
  const report=summarizeMeasurements({eventTiming:[{visible:'visible',interactionId:0,duration:200},{visible:'visible',interactionId:4,duration:16},{visible:'visible',interactionId:4,duration:24},{visible:'hidden',interactionId:5,duration:200}]});
  assert.equal(report.eventTiming.count,1);assert.equal(report.eventTiming.max,24);assert.equal(report.gates.eventTiming,true);
});

test('explicit raw download preserves outliers, incomplete trials and context without changing measurements',()=>{
  const f=fixture(),created=f.host.document.createElement;let blob,download,clicked=false,removed=false,revoked=false,deferred;
  f.host.Blob=class{constructor(parts,options){blob={parts,options};}};
  f.host.URL={createObjectURL:()=> 'blob:validation',revokeObjectURL:url=>{assert.equal(url,'blob:validation');revoked=true;}};
  f.host.setTimeout=callback=>{deferred=callback;};
  f.host.document.createElement=tag=>tag==='a'?(download={click(){clicked=true;},remove(){removed=true;}}):created(tag);
  f.listeners['#measure-start']();f.advance(1);f.advance(4001);
  const before=structuredClone(f.recorder.raw);f.listeners['#measure-download']();
  const record=JSON.parse(blob.parts[0]);assert.deepEqual(record.raw,before);assert.equal(record.summary.frames.max,4000);
  assert.equal(record.context.viewport[0],1280);assert.equal(record.raw.events.some(e=>e.id==='frame-trial-complete'),false);
  assert.deepEqual(f.recorder.raw,before);assert.equal(download.download,'isdc_browser_measurements.json');assert.equal(clicked,true);assert.equal(removed,true);
  assert.equal(revoked,false);deferred();assert.equal(revoked,true);
});

test('closing aborts incomplete query latency so reopening cannot count an unobserved completion',()=>{
 const f=fixture(),fields={
 '#visibility-start':{value:'2026-10-07T00:00:00Z'},'#visibility-end':{value:'2026-10-08T00:00:00Z'},
 '#visibility-result':{textContent:''},'#visibility-status':{textContent:'계산 중'},
 '#stored-orbit-globe':{dataset:{orbitVisible:'false'}},'#stored-orbit li':{},'#stored-orbit [role="status"]':{textContent:'pending'}
 };
 f.host.document.querySelector=id=>fields[id]??null;
 f.listeners.click({target:{closest:()=>({id:'visibility-query'})}});
 f.listeners.click({target:{closest:()=>({id:'orbit-calculate'})}});
 f.recorder.hide();
 fields['#visibility-result'].textContent='조회 UTC';fields['#visibility-status'].textContent='완료';
 fields['#stored-orbit-globe'].dataset.orbitVisible='true';fields['#stored-orbit [role="status"]'].textContent='ready';
 f.advance(60000);f.recorder.show();f.mutationObserver.callback();
 assert.deepEqual(f.recorder.raw.dayResult,[]);assert.deepEqual(f.recorder.raw.utcResult,[]);
 assert.equal(f.recorder.raw.events.filter(e=>e.id==='query-observation-aborted').length,2);
});
