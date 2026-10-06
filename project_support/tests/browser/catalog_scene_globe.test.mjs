import test from 'node:test';import assert from 'node:assert/strict';
import {OrbitGlobe} from '../../../digital_twin/visualization/orbit_globe.js';
import {SatelliteModelLayer} from '../../../digital_twin/visualization/satellite_model.js';
import {createUtcCodec,LEAP_SHA256} from '../../../user_application/web/scripts/orbit_utc.js';
import {NODE_COMMUNICATION_METADATA} from '../../../user_application/web/scripts/nodes/node_timeline.js';
function fixture(){const collections=[],handlers=[],viewers=[],allocations={colors:0,scales:0};
 class Collection{constructor(){this.items=[];collections.push(this);}add(v){this.items.push(v);return v;}removeAll(){this.items=[];}}
 class Handler{constructor(){handlers.push(this);this.actions=new Map();}setInputAction(fn,type){this.actions.set(type,fn);if(type===1)this.pick=fn;}destroy(){this.dead=true;}}
 class Viewer{constructor(){this.clock={};this.items=[];this.entities={add:v=>(this.items.push(v),v),remove:v=>this.items.splice(this.items.indexOf(v),1)};this.scene={canvas:{},globe:{},pick:()=>this.picked,requestRender(){},primitives:{add:v=>v,remove:v=>{v.removed=true;}}};this.camera={};viewers.push(this);}destroy(){this.dead=true;}}
 class Color{constructor(css,alpha=1){allocations.colors++;Object.assign(this,{css,alpha});}withAlpha(alpha){return new Color(this.css,alpha);}static fromCssColorString(css){return new Color(css);}}
 const C={Viewer,Color,Cartesian3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}},Cartesian2:class{},ConstantPositionProperty:class{constructor(value){this.value=value;}},ReferenceFrame:{FIXED:'fixed'},JulianDate:{fromIso8601:v=>v},EllipsoidTerrainProvider:class{},PointPrimitiveCollection:Collection,LabelCollection:Collection,NearFarScalar:class{constructor(){allocations.scales++;}},LabelStyle:{FILL_AND_OUTLINE:1},ScreenSpaceEventHandler:Handler,ScreenSpaceEventType:{LEFT_CLICK:1}};
 Color.WHITE=new Color('white');Color.CYAN=new Color('cyan');Color.TRANSPARENT=new Color('transparent');return{globe:new OrbitGlobe(C,{}),collections,handlers,viewers,allocations};
}
const utc='2020-07-12T21:16:01.000416000Z';
const scene=(n=16633)=>({frame:'ITRF',utc,scene_sha256:'a'.repeat(64),count:n,valid_count:n,error_count:0,rows:Array.from({length:n},(_,i)=>({catalog_number:i+1,name:'sat'+i,status:'valid',normalized_gp_sha256:'b'.repeat(64),epoch_utc:utc,orbit_regime:['LEO','MEO','GEO','HEO'][i%4],position_m:[7000000,i+1,0]}))});
test('native node picking shares one handler, requires owned primitive, and never becomes a catalog selection',()=>{
 const {globe,handlers}=fixture(),selected=[],hover=[],catalog=[],primitive={show:true};globe.C.ScreenSpaceEventType.MOUSE_MOVE=2;
 globe.setCatalogScene(scene(2),id=>catalog.push(id));
 globe.setNodeInteraction({owns:(id,p)=>id==='NODE-1'&&p===primitive&&p.show,onSelect:id=>selected.push(id),onHover:id=>hover.push(id)});
 globe.viewer.picked={id:{nodeId:'NODE-1'},primitive};handlers[0].pick({position:{}});assert.deepEqual(selected,['NODE-1']);assert.deepEqual(catalog,[]);
 handlers[0].actions.get(2)({endPosition:{x:1,y:2}});assert.equal(hover.at(-1),'NODE-1');assert.equal(handlers.length,1);
 globe.viewer.picked={id:{nodeId:'NODE-1',catalogNumber:1},primitive:{show:true}};handlers[0].pick({position:{}});assert.equal(selected.length,1);assert.deepEqual(catalog,[]);
 primitive.show=false;globe.viewer.picked={id:{nodeId:'NODE-1'},primitive};handlers[0].pick({position:{}});assert.equal(selected.length,1);
 globe.setNodeInteraction(null);globe.viewer.picked={id:{catalogNumber:1}};handlers[0].pick({position:{}});assert.deepEqual(catalog,[1]);assert.equal(hover.at(-1),null);globe.destroy();
 handlers[0].pick({position:{}});assert.equal(selected.length,1);
});
test('selected source model pick requires the shared layer primitive and a currently validated native pose',async()=>{
 const {globe,handlers}=fixture(),selected=[],codec=createUtcCodec(LEAP_SHA256),definition={schema:1,id:'NODE-1'},stamp=codec.advance(utc,0);
 const sample={...NODE_COMMUNICATION_METADATA,node_id:'NODE-1',node_definition:definition,definition_hash:'a'.repeat(64),row:{utc:stamp,status:'valid',error_code:null,position_m:[7000000,0,0]}};
 const layer=new SatelliteModelLayer({advanceUtc:codec.advance,timeSource:()=>stamp});await layer.show({pose_source:{kind:'source_node',node_definition:definition,definition_hash:sample.definition_hash}},()=>sample,stamp);
 layer.model={show:true};globe.modelLayer=layer;globe.setNodeInteraction({owns:(_id,_primitive,selectedModel)=>selectedModel,onSelect:id=>selected.push(id)});
 globe.viewer.picked={id:{node_id:'NODE-1'},primitive:layer.model};handlers[0].pick({position:{}});assert.deepEqual(selected,['NODE-1']);
 sample.frame='ITRF';handlers[0].pick({position:{}});assert.equal(selected.length,1);sample.frame=NODE_COMMUNICATION_METADATA.frame;
 globe.viewer.picked={id:{node_id:'NODE-1'},primitive:{show:true}};handlers[0].pick({position:{}});assert.equal(selected.length,1);globe.destroy();
});
test('native hover emits picked scene UTC or selected UTC, including model picks, without selecting or sharing geometry',()=>{
 const {globe,handlers}=fixture(),events=[],selected=[];globe.C.ScreenSpaceEventType.MOUSE_MOVE=2;
 globe.onSatelliteHover=value=>events.push(value);globe.setCatalogScene(scene(2),n=>selected.push(n));
 const move=(id)=>{globe.viewer.picked=id==null?null:{id};handlers[0].actions.get(2)({endPosition:{x:25,y:40}});};
 move({catalogNumber:2});assert.equal(events.at(-1).position.utc,utc);assert.equal(events.at(-1).item.OBJECT_NAME,'sat1');assert.equal(events.at(-1).item.ORBIT_REGIME,'MEO');assert.deepEqual(events.at(-1).position.position_m,[7000000,2,0]);
 events.at(-1).position.position_m[0]=0;move({catalogNumber:2});assert.equal(events.at(-1).position.position_m[0],7000000);
 const selectedUtc='2020-07-12T21:16:02.000416000Z';globe.update({...scene(2).rows[0],frame:'ITRF',utc:selectedUtc,name:'ISS',orbit_regime:'LEO',interpolated:true});
 move('stored-orbit-satellite');assert.equal(events.at(-1).position.utc,selectedUtc);assert.equal(events.at(-1).position.interpolated,true);assert.equal(events.at(-1).id,1);
 move({satelliteId:1});assert.equal(events.at(-1).position.utc,selectedUtc);
 move({satelliteId:'1'});assert.equal(events.at(-1)?.position.utc,selectedUtc,'original GLB picks carry string satellite IDs');
 const failed=scene(2);failed.rows[1].status='error';globe.setCatalogScene(failed);move({catalogNumber:2});assert.equal(events.at(-1),null);
 globe.update(null);move({satelliteId:1});assert.equal(events.at(-1),null);assert.deepEqual(selected,[]);globe.destroy();
});
test('hover restores exact original size/color, changes only two points and survives theme/selection',()=>{
 const {globe,allocations}=fixture();globe.setCatalogScene(scene());const other=globe.catalogPoints.get(9000).color;
 globe.hoverCatalog(1);assert.equal(globe.catalogPoints.get(1).pixelSize,7);assert.equal(globe.catalogPoints.get(1).color.css,'#ffffff');
 const count=allocations.colors;for(let i=0;i<100;i++)globe.hoverCatalog(1);assert.equal(allocations.colors,count);
 globe.hoverCatalog(2);assert.equal(globe.catalogPoints.get(1).pixelSize,2.4);assert.equal(globe.catalogPoints.get(1).color.css,'#ff9f43');assert.equal(globe.catalogPoints.get(9000).color,other);assert.ok(allocations.colors-count<8);
 globe.setViewStyle('light',true);assert.equal(globe.catalogPoints.get(2).color.css,'#1c2833');
 globe.update({...scene(3).rows[0],frame:'ITRF',utc});assert.equal(globe.catalogPoints.get(2).color.alpha,1);globe.hoverCatalog(null);assert.equal(globe.catalogPoints.get(2).color.alpha,.9*.65);
 globe.hoverCatalog(999999);assert.equal(globe.hoveredCatalog,null);globe.setCatalogScene(null);globe.destroy();assert.equal(globe.hoverCatalog(1),false);
});
test('stationary hover refreshes only the picked native projection and keeps selected playback UTC independent',()=>{
 const {globe,handlers}=fixture(),events=[];globe.C.ScreenSpaceEventType.MOUSE_MOVE=2;globe.onSatelliteHover=v=>events.push(v);
 const whole=scene(3);globe.setCatalogScene(whole);globe.viewer.picked={id:{catalogNumber:2}};handlers[0].actions.get(2)({endPosition:{x:25,y:40}});
 const next=scene(3);next.utc='2020-07-12T21:16:05.000416000Z';next.rows[1].position_m=[7000010,5,0];globe.setCatalogScene(next);assert.equal(events.at(-1).position.utc,next.utc);assert.deepEqual(events.at(-1).position.position_m,next.rows[1].position_m);
 const selected={...scene(3).rows[0],frame:'ITRF',utc:'2020-07-12T21:16:06.000416000Z',name:'selected',interpolated:true};globe.update(selected);globe.viewer.picked={id:'stored-orbit-satellite'};handlers[0].actions.get(2)({endPosition:{x:25,y:40}});
 globe.setCatalogScene({...next,utc:'2020-07-12T21:16:09.000416000Z'});assert.equal(events.at(-1).position.utc,selected.utc);
 globe.update({...selected,utc:'2020-07-12T21:16:06.500416000Z',position_m:[7000020,6,0]});assert.equal(events.at(-1).position.utc,'2020-07-12T21:16:06.500416000Z');assert.equal(events.at(-1).position.interpolated,true);assert.deepEqual(events.at(-1).screen,{x:25,y:40});globe.destroy();assert.equal(events.at(-1),null);
});
test('mouse hover and leave use one handler, clear failed rows, and never issue selection',()=>{
 const {globe,handlers}=fixture(),listeners=new Map(),selected=[];globe.C.ScreenSpaceEventType.MOUSE_MOVE=2;globe.container.addEventListener=(name,fn)=>listeners.set(name,fn);globe.container.removeEventListener=name=>listeners.delete(name);globe.container.style={};globe.viewer.scene.canvas.style={};
 globe.setCatalogScene(scene(3),number=>selected.push(number));globe.viewer.picked={id:{catalogNumber:2}};handlers[0].actions.get(2)({endPosition:{}});assert.equal(globe.hoveredCatalog,2);assert.equal(globe.container.style.cursor,'pointer');assert.deepEqual(selected,[]);assert.equal(handlers.length,1);
 listeners.get('mouseleave')();assert.equal(globe.hoveredCatalog,null);assert.equal(globe.viewer.scene.canvas.style.cursor,'');handlers[0].actions.get(2)({endPosition:{}});
 const data=scene(3);data.rows[1]={...data.rows[1],status:'error',position_m:null};globe.setCatalogScene(data);assert.equal(globe.hoveredCatalog,null);globe.destroy();assert.equal(listeners.size,0);assert.equal(handlers[0].dead,true);
});
test('theme repaint preserves native positions/UTC and original palette with selection dim',()=>{
 const {globe}=fixture(),data=scene(4);globe.setCatalogScene(data);const positions=[...globe.catalogPoints.values()].map(p=>p.position);
 globe.setViewStyle('light',true);assert.equal(globe.catalogPoints.get(1).color.css,'#c9651a');assert.equal(globe.catalogPoints.get(2).color.css,'#8f8a12');assert.equal(globe.catalogLabels.get(1).outlineColor.css,'#ffffff');
 globe.update({...data.rows[0],frame:'ITRF',utc});assert.equal(globe.entity.point.color.css,'#d35400');assert.equal(globe.entity.label.fillColor.css,'#d35400');assert.equal(globe.catalogPoints.get(2).color.alpha,.98*.65);
 const current=globe.viewer.clock.currentTime;globe.setViewStyle('dark',false);assert.equal(globe.entity.point.color.css,'#efff62');assert.equal(globe.catalogPoints.get(2).color.css,'#e6ed55');assert.equal(globe.viewer.clock.currentTime,current);assert.deepEqual([...globe.catalogPoints.values()].map(p=>p.position),positions);
 globe.update(null);assert.equal(globe.catalogPoints.get(2).color.alpha,.98);globe.destroy();
});
test('whole16633 point primitives use original colors/size/occlusion and one Viewer/pick handler',()=>{
 const {globe,collections,viewers,handlers}=fixture(),picked=[];const data=scene();globe.setCatalogScene(data,n=>picked.push(n));
 assert.equal(globe.catalogPoints.size,16633);assert.equal(viewers.length,1);assert.equal(handlers.length,1);
 const point=globe.catalogPoints.get(16633);assert.equal(point.pixelSize,2.4);assert.equal(point.disableDepthTestDistance,0);assert.equal(point.color.css,'#ff9f43');
 assert.equal(globe.catalogPoints.get(2).color.css,'#e6ed55');assert.equal(globe.catalogPoints.get(3).color.css,'#5ee277');assert.equal(globe.catalogPoints.get(4).color.css,'#53c8ff');
 globe.viewer.picked={id:point.id};handlers[0].pick({position:{}});assert.deepEqual(picked,[16633]);
 data.rows[0].position_m[0]=0;assert.equal(globe.catalogPoints.get(1).position.x,7000000);
 globe.setCatalogScene(scene());assert.equal(globe.catalogPoints.get(16633),point);assert.equal(collections.length,2);
 for(let i=0;i<20;i++)globe.update({frame:'ITRF',utc,position_m:[1,2,3]});assert.equal(collections.length,2);globe.destroy();assert.equal(handlers[0].dead,true);
});
test('failed rows get no point, small labels and selected marker use own UTC without duplicate selected point',()=>{
 const {globe}=fixture(),data=scene(3);data.rows[1]={...data.rows[1],status:'error',position_m:null,error_code:'decayed'};data.valid_count=2;data.error_count=1;
 globe.setCatalogScene(data);assert.equal(globe.catalogPoints.size,2);assert.equal(globe.catalogLabels.size,2);
 globe.update({...data.rows[0],frame:'ITRF',utc:'2020-07-12T21:17:01.000416000Z'});assert.equal(globe.catalogPoints.get(1).show,false);assert.equal(globe.viewer.clock.currentTime,'2020-07-12T21:17:01.000416000Z');
 globe.update(null);assert.equal(globe.catalogPoints.get(1).show,true);globe.setCatalogScene(null);assert.equal(globe.catalogPoints.size,0);assert.equal(globe.catalogLabels.size,0);globe.destroy();
});
test('a previously valid selected point stays hidden when the new snapshot fails and selected display is cleared',()=>{
 const {globe}=fixture(),data=scene(1);globe.setCatalogScene(data);globe.update({...data.rows[0],frame:'ITRF',utc});
 const failed={...data,valid_count:0,error_count:1,rows:[{...data.rows[0],status:'error',error_code:'decayed',position_m:null}]};globe.setCatalogScene(failed);globe.update(null);assert.equal(globe.catalogPoints.get(1).show,false);globe.destroy();
});

test('full scene style allocation scales with visual classes and epoch aging refreshes retained points',()=>{
 const {globe,allocations}=fixture(),before={...allocations},data=scene();globe.setCatalogScene(data);
 assert.ok(allocations.colors-before.colors<=8,'four orbit classes should share colors');assert.ok(allocations.scales-before.scales<=2,'distance scales should be shared');
 const point=globe.catalogPoints.get(1);assert.equal(point.color.alpha,.9);
 globe.setCatalogScene({...data,utc:'2020-07-16T21:16:01.000416000Z'});assert.equal(globe.catalogPoints.get(1),point);assert.equal(point.color.alpha,.56);
 globe.setCatalogScene(data);assert.equal(point.color.alpha,.9);globe.destroy();
});

test('unchanged GP epoch parsing is reused across UTC refreshes but replaced epoch is reparsed',()=>{
 const {globe}=fixture(),data=scene();globe.setCatalogScene(data);const parse=Date.parse;let calls=0;
 Date.parse=value=>{calls++;return parse(value);};
 try{globe.setCatalogScene({...data,utc:'2020-07-16T21:16:01.000416000Z'});assert.equal(calls,1);assert.equal(globe.catalogPoints.get(1).color.alpha,.56);
  const changed=scene(1);changed.scene_sha256='d'.repeat(64);changed.rows[0].epoch_utc='2020-07-16T21:16:01.000416000Z';changed.utc=changed.rows[0].epoch_utc;globe.setCatalogScene(changed);assert.equal(calls,3);assert.equal(globe.catalogPoints.get(1).color.alpha,.98);
 }finally{Date.parse=parse;globe.destroy();}
});
