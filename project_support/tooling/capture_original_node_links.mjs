import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [root,output]=process.argv.slice(2);if(!root||!output)throw Error('reference root and output required');
const expected={'digital_twin/visualization/node_scene.js':'0a64617def9394bf25414321a30c66f210957bb4d61c494df7c9197359e6f9c6','digital_twin/visualization/link_flow.js':'e20347895e3aa3913bb711bc856c547060d163c3c4624e7db8e7b7f8762c3b24'};
const texts={};for(const [path,hash]of Object.entries(expected)){const bytes=await readFile(resolve(root,path));if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('source hash mismatch:'+path);texts[path]=bytes.toString('utf8');}
const data=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const source=texts['digital_twin/visualization/node_scene.js'].replace("'./link_flow.js?v=20260908-oisl-flow1'",JSON.stringify(data(texts['digital_twin/visualization/link_flow.js'])));
const {NodeScene,LINK_COLORS}=await import(data(source));
class Cartesian3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}static fromDegrees(x,y,z){return new Cartesian3(x,y,z);}static subtract(a,b,r){Object.assign(r,{x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});return r;}static magnitude(v){return Math.hypot(v.x,v.y,v.z);}static normalize(v,r){const m=this.magnitude(v);Object.assign(r,{x:v.x/m,y:v.y/m,z:v.z/m});return r;}}
class Color{constructor(css,alpha=1){Object.assign(this,{css,alpha});}static fromCssColorString(css){return new Color(css);}withAlpha(alpha){return new Color(this.css,alpha);}}
class Collection{constructor(){this.items=[];}add(v){this.items.push(v);return v;}remove(v){const i=this.items.indexOf(v);if(i<0)return false;this.items.splice(i,1);return true;}}
// Execute original link methods with injected Cesium and controlled render-animation time.
let now=2000;Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
class Material{constructor(options){this.options=options;this.uniforms=options.fabric.uniforms;}static fromType(type,uniforms){return {type,uniforms};}}
const C={Cartesian3,Color,Material,PolylineCollection:Collection};
const viewer={scene:{primitives:new Collection()}};
const globe={viewer,positionAt:id=>id==='missing'?null:{longitude:Number(id),latitude:10,altitude:550}};
const scene=new NodeScene({globe,cesium:C,timeSource:()=>new Date(0)});
const receipt={source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes:expected,harness:'Executed original class with Cesium doubles; qualitative material/component evidence only',states:{}};
for(const state of Object.keys(LINK_COLORS)){
 scene.setLinks([{key:'pair',a:'1',b:'2',state}]);const e=scene.links.get('pair');
 receipt.states[state]={width:e.line.width,show:e.line.show,positions:e.line.positions,material:e.line.material};
}
scene.setLinks([{key:'pair',a:'1',b:'2',state:'locked'}]);const material=scene.links.get('pair').line.material;
now=5000;scene.animateLinkFlow();receipt.phase=material.uniforms.time;
scene.setLinks([{key:'pair',a:'2',b:'1',state:'locked'}]);receipt.sameMaterial=material===scene.links.get('pair').line.material;
scene.setLinksVisible(false);now=7000;scene.animateLinkFlow();receipt.hiddenPhase=material.uniforms.time;
scene.setLinksVisible(true);scene.setLinks([{key:'pair',a:'1',b:'missing',state:'locked'}]);scene.animateLinkFlow();receipt.missingPhase=material.uniforms.time;receipt.missingShow=scene.links.get('pair').line.show;
scene.setLinks([]);receipt.removed=scene.links.size;scene.clear();receipt.remaining=viewer.scene.primitives.items.length;
const bytes=JSON.stringify(receipt,null,2)+'\n';await writeFile(resolve(output),bytes);process.stdout.write(JSON.stringify({bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')})+'\n');
