import test from 'node:test';import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';
let sequence=0;
async function fixture(){
 const renderers=[],listeners=new Map(),calls=[];
 globalThis.ViewRenderer=class{constructor(C,node,options){this.options=options;this.viewer={scene:{renderError:{addEventListener:()=>()=>{}}}};renderers.push(this);}setViewMode(mode){calls.push(['mode',mode]);return Promise.resolve(true);}setViewStyle(...value){calls.push(['style',...value]);}setViewImagery(mode){calls.push(['imagery',mode]);return Promise.resolve(true);}update(){return false;}setGroundPoint(){}destroy(){calls.push(['destroy']);}};
 const source=(await readFile(new URL('../../../user_application/web/scripts/workspace_globe.js',import.meta.url),'utf8')).replace("'./orbit_utc.js'",JSON.stringify(new URL('../../../user_application/web/scripts/orbit_utc.js',import.meta.url).href)).replace(/import \{OrbitGlobe\} from [^;]+;/,'const OrbitGlobe=globalThis.ViewRenderer;');
 const {createWorkspaceGlobe}=await import(`data:text/javascript;base64,${Buffer.from(source+'\n//'+sequence++).toString('base64')}`);
 const container={dataset:{}},status={},button={addEventListener(){},removeEventListener(){}};
 const host={setTimeout:()=>1,clearTimeout(){},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const ui=createWorkspaceGlobe(container,status,button,host);
 delete globalThis.ViewRenderer;
 return{ui,host,calls,renderers,container,boot(){host.Cesium={};listeners.get('load')();}};
}
test('preboot choices copied/validated, applied to one renderer, late source status disposed',async()=>{
 const f=await fixture();const states=[];const remove=f.ui.observeView(s=>states.push(s));
 assert.equal(f.ui.changeView({mode:'2d',imagery:'osm',theme:'light',emphasis:false}),true);
 const before=f.ui.viewState();assert.equal(f.ui.changeView({mode:'invalid',theme:'dark'}),false);assert.deepEqual(f.ui.viewState(),before);
 before.choice.mode='3d';assert.equal(f.ui.viewState().choice.mode,'2d');f.boot();await Promise.resolve();
 assert.equal(f.renderers.length,1);assert.ok(f.calls.some(c=>c[0]==='mode'&&c[1]==='2d'));assert.ok(f.calls.some(c=>c[0]==='imagery'&&c[1]==='osm'));assert.ok(f.calls.some(c=>c[0]==='style'&&c[1]==='light'&&c[2]===false));
 f.renderers[0].options.onStatus({requestedImagery:'osm',displayedImagery:'natural',phase:'fallback',error:'tiles'});assert.equal(f.ui.viewState().imagery.phase,'fallback');assert.equal(f.container.dataset.imagery,'natural');
 remove();const count=states.length;f.ui.changeView({emphasis:true});assert.equal(states.length,count);f.ui.destroy();f.ui.destroy();assert.equal(f.calls.filter(c=>c[0]==='destroy').length,1);
 const disposed=f.ui.viewState();f.renderers[0].options.onStatus({phase:'ready'});assert.deepEqual(f.ui.viewState(),disposed);assert.equal(f.ui.changeView({mode:'3d'}),false);
});
test('provider factory preserves original URLs/options and current local Blue Marble',async()=>{
 const f=await fixture();f.boot();const calls=[];
 const C={SingleTileImageryProvider:{fromUrl:(...x)=>(calls.push(['blue',...x]),Promise.resolve({}))},ArcGisMapServerImageryProvider:{fromUrl:(...x)=>(calls.push(['sat',...x]),Promise.resolve({}))},OpenStreetMapImageryProvider:class{constructor(x){calls.push(['osm',x]);}},TileMapServiceImageryProvider:{fromUrl:(...x)=>(calls.push(['natural',...x]),Promise.resolve({}))},buildModuleUrl:x=>'cesium/'+x};
 // The factory is bound to the supplied Cesium object, never global window.
 Object.assign(f.host.Cesium,C);const factory=f.renderers[0].options.createProvider;
 for(const name of ['blue_marble','satellite','osm','natural'])await factory(name);
 assert.equal(calls[0][1],'/static/assets/nasa_blue_marble_september.jpg');assert.equal(calls[1][2].enablePickFeatures,false);assert.match(calls[1][1],/World_Imagery\/MapServer$/);assert.equal(calls[2][1].url,'https://tile.openstreetmap.org/');assert.equal(calls[3][1],'cesium/Assets/Textures/NaturalEarthII');
 f.ui.destroy();
});
