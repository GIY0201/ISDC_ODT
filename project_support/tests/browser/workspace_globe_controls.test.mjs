import test from 'node:test';import assert from 'node:assert/strict';import{fixture}from'./workspace_fixture.mjs';
const tick=async f=>{for(let i=0;i<8;i++)await Promise.resolve();f.flush();};
for(const [width,height]of [[1280,720],[1920,1080]])test(`V6 globe choices survive restore without orbit/SIM commands ${width}x${height}`,async()=>{
 const f=fixture(width,height,{hash:'#satellite'});try{await tick(f);const before=f.snapshot();
 assert.equal(f.get('globe-mode').value,'3d');assert.equal(f.get('globe-imagery').value,'blue_marble');
 f.get('globe-mode').value='2d';await f.get('globe-mode').dispatch('change');await tick(f);assert.equal(f.viewers[0].scene.mode,2);assert.equal(f.viewers[0].scene.screenSpaceCameraController.enableTilt,false);
 f.get('globe-theme').value='light';await f.get('globe-theme').dispatch('change');f.get('globe-emphasis').checked=false;await f.get('globe-emphasis').dispatch('change');assert.equal(f.get('globe-emphasis').value,'false');
 await f.get('window-minimize').dispatch('click');await f.get('shelf-restore').dispatch('click');assert.equal(f.get('globe-mode').value,'2d');assert.equal(f.get('globe-theme').value,'light');assert.equal(f.get('globe-emphasis').checked,false);
 f.context.applyWorkspaceDraft([{id:'globe-mode',value:'3d'},{id:'globe-theme',value:'dark'},{id:'globe-emphasis',value:'true'}]);await tick(f);assert.equal(f.viewers[0].scene.mode,3);assert.equal(f.get('globe-emphasis').checked,true);
 f.context.applyWorkspaceDraft([{id:'globe-mode',value:'invalid'}]);assert.equal(f.get('globe-mode').value,'3d');assert.deepEqual(f.snapshot(),before);assert.equal(f.counts().commands,0);assert.equal(f.viewers.length,1);
 await f.win.dispatch('pagehide',{persisted:false});assert.equal(f.viewers[0].destroyCount,1);
 }finally{f.dispose();}
});
