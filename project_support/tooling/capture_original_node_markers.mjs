import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [root,output]=process.argv.slice(2);if(!root||!output)throw Error('reference root and output required');
const path='digital_twin/visualization/globe.js',expected='b4a10eef5adee593f4f9d42b95be641771fe786bc3206632a83a8f9358a6e608',bytes=await readFile(resolve(root,path));if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('source hash mismatch');
const text=bytes.toString('utf8').replace(/\r\n/g,'\n');
const method=name=>{const start=text.indexOf('  '+name+'(');if(start<0)throw Error('missing source method:'+name);const rest=text.slice(start);const end=rest.slice(1).search(/\n  [a-zA-Z_$][\w$]*\(/);if(end<0)throw Error('missing method boundary');return rest.slice(0,end+1);};
const fn=name=>{const start=text.indexOf('function '+name+'('),end=text.indexOf('\n}',start);if(start<0||end<0)throw Error('missing source helper');return text.slice(start,end+2);};
const palette=text.slice(text.indexOf('const PALETTES ='),text.indexOf('const PATH_DENSE_HALF_WINDOW_MS'));
const selectionDim=text.match(/^const SELECTION_DIM = .*;$/m)?.[0];if(!selectionDim)throw Error('missing source selection dim');
const script=palette+'\n'+selectionDim+'\n'+['paletteFor','satelliteColor','satelliteAlpha'].map(fn).join('\n')+'\nexport function sourceClass(C){const window={Cesium:C};return class{'+['basePointSize','highlightPoint','pointAlpha','restorePointStyle','addCesiumEntity','shouldShowLabel','palette'].map(method).join('\n')+'\n};}';
const {sourceClass}=await import('data:text/javascript;base64,'+Buffer.from(script).toString('base64'));
class Cartesian3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}static fromDegrees(x,y,z){return new Cartesian3(x,y,z);}}
class Color{constructor(css,alpha=1){Object.assign(this,{css,alpha});}static fromCssColorString(css){return new Color(css);}withAlpha(alpha){return new Color(this.css,alpha);}}
Color.WHITE=new Color('white');Color.TRANSPARENT=new Color('transparent',0);
class Collection{add(v){return v;}}
const C={Cartesian3,Color,Cartesian2:class{constructor(x,y){Object.assign(this,{x,y});}},NearFarScalar:class{constructor(near,nearValue,far,farValue){Object.assign(this,{near,nearValue,far,farValue});}},LabelStyle:{FILL_AND_OUTLINE:'fill_outline'}};
const Original=sourceClass(C),cases=[];
for(const count of [1,200,201,240])for(const theme of ['dark','light'])for(const selected of [null,'1'])for(const sdcMode of [false,true]){
 const scene=new Original();Object.assign(scene,{items:Array(count),theme,selectedId:selected,hoveredId:null,sdcMode,entities:new Map(),labels:new Map(),records:new Map(),positions:new Map(),pointCollection:new Collection(),labelCollection:new Collection(),visibleIds:null,labelsVisible:false});
 const points={};for(const id of count===1?['1']:['1','2']){const item={node:true,OBJECT_NAME:'node '+id,ORBIT_REGIME:'LEO'};scene.records.set(id,{item});scene.addCesiumEntity(id,item,0);if(id===selected)scene.highlightPoint(id,'selected');const point={...scene.entities.get(id)},label={...scene.labels.get(id)};delete point.position;delete point.show;delete point.id;delete label.position;delete label.show;delete label.id;points[id]={point,label,labelWithPosition:scene.shouldShowLabel(id,true),labelWithoutPosition:scene.shouldShowLabel(id,false)};}
 cases.push({count,theme,selected,sdcMode,points});
}
const scene=new Original();Object.assign(scene,{items:Array(2),theme:'dark',selectedId:null,entities:new Map([['1',{pixelSize:0,color:null,outlineWidth:0}]]),records:new Map(),visibleIds:new Set(),labelsVisible:false});scene.highlightPoint('1','hover');const hover=scene.entities.get('1');
scene.records.set('1',{item:{node:true}});const filtered=scene.shouldShowLabel('1',true);scene.selectedId='1';const selectedFilterException=scene.shouldShowLabel('1',true);
const palettes=Object.fromEntries(['dark','light'].map(theme=>{scene.theme=theme;return [theme,scene.palette()];}));
const receipt={source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',source_hashes:{[path]:expected},harness:'Original source methods against Cesium doubles; no physical/GPU claims',cases,hover,palettes,filtered,selectedFilterException};
const result=JSON.stringify(receipt,null,2)+'\n';await writeFile(resolve(output),result);process.stdout.write(JSON.stringify({bytes:Buffer.byteLength(result),sha256:createHash('sha256').update(result).digest('hex')})+'\n');
