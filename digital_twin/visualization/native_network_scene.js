import {LINK_FLOW_SOURCE} from './link_flow.js';
// Ground-only rendering port of ISDC-ODT 1a1e002 NetworkScene. Existing NodeScene owns OISL.
// This class owns display primitives only; the existing native/UTC/fabric owners are injected.
export const GROUND_LINK_COLORS=Object.freeze({usable:'#4ac4ee',visible:'#7a95ab',fault:'#ff6b6b',unusable:'#5b6f82'});
export const ROUTE_COLOR='#a78bfa',STATION_COLOR='#ffbf47';
const ROUTE_WIDTH=4.5,SELECTED_WIDTH=4,BASE_WIDTH=2;
const signature=value=>JSON.stringify(value);
export class NativeNetworkScene {
 constructor({viewer,cesium,timeSource,geometryFor,verifyNetworkSnapshot,readFabricState,coverageRadiusKm,isTransitioning=()=>false}={}){
  if([timeSource,geometryFor,verifyNetworkSnapshot,coverageRadiusKm].some(fn=>typeof fn!=='function'))throw TypeError('verified native network rendering ports required');
  Object.assign(this,{viewerProvider:viewer,cesiumProvider:cesium,timeSource,geometryFor,verifyNetworkSnapshot,readFabricState,coverageRadiusKm,isTransitioning});
  this.stations=new Map();this.groundLinks=new Map();this.routeIds=new Set();this.selectedLinkId=null;this.groundLinksVisible=true;this.coverageVisible=true;this.disposed=false;this.snapshot=null;this.dataSource=null;this.linkPolylines=null;
 }
 get viewer(){return typeof this.viewerProvider==='function'?this.viewerProvider():this.viewerProvider;}
 get cesium(){return typeof this.cesiumProvider==='function'?this.cesiumProvider():this.cesiumProvider;}
 entityCollection(){
  const C=this.cesium,v=this.viewer;if(this.disposed||!C?.CustomDataSource||!v?.dataSources?.add)return null;
  if(!this.dataSource){this.sourceOwner=v;const source=this.dataSource=new C.CustomDataSource('native-ground-network');const added=v.dataSources.add(source);if(added?.then)added.then(()=>{if(this.disposed||this.dataSource!==source)v.dataSources.remove?.(source,true);}).catch(()=>this.clear());}
  return this.dataSource.entities;
 }
 linkCollection(){const C=this.cesium,v=this.viewer;if(!this.disposed&&!this.linkPolylines&&C?.PolylineCollection&&v?.scene?.primitives){this.linkOwner=v;this.linkPolylines=v.scene.primitives.add(new C.PolylineCollection());}return this.linkPolylines;}
 valid(utc){try{return !this.disposed&&this.snapshot?.status==='valid'&&this.snapshot.utc===utc&&this.timeSource()===utc&&this.verifyNetworkSnapshot(structuredClone(this.snapshot))===true&&(!this.sourceOwner||this.sourceOwner===this.viewer)&&(!this.linkOwner||this.linkOwner===this.viewer);}catch{return false;}}
 cartesianAt(id,utc,frameValidated=false){
  if(!(frameValidated?this.timeSource()===utc:this.valid(utc)))return null;const definition=this.snapshot.node_definitions.find(n=>n.id===id);if(!definition)return null;
  try{const g=this.geometryFor(structuredClone(definition),{utc}),row=g?.row;
   if(g?.node_id!==id||signature(g.node_definition)!==signature(definition)||typeof g.definition_hash!=='string'||!/^[a-f0-9]{64}$/.test(g.definition_hash)||g.definition_hash!==this.snapshot.definition_hashes?.[id]||g.frame!=='EARTH_FIXED_GMST_UTC_APPROX'||g.inertial_frame!=='SOURCE_MEAN_EQUATOR_EQUINOX_APPROX'||g.time_model!=='unix_ms_utc_approx'||g.model_profile!=='SOURCE_KEPLER_J2_V1'||g.source_commit!=='1a1e00297a0301637455b0ef2cf48b2e74576b07'||g.quality!=='engineering_assumption'||row?.utc!==utc||row.status!=='valid'||row.error_code!==null||!Array.isArray(row.position_m)||row.position_m.length!==3||!row.position_m.every(Number.isFinite)||(frameValidated?this.timeSource()!==utc:!this.valid(utc)))return null;
   return new this.cesium.Cartesian3(...row.position_m);
  }catch{return null;}
 }
 setSnapshot({snapshot,receipt=null,route=null,selectedLinkId=null}={}){
  if(this.disposed)return false;
  try{const copy=structuredClone(snapshot);if(copy?.status!=='valid'||!Array.isArray(copy.node_definitions)||copy.node_definitions.length>240||!Array.isArray(copy.stations)||copy.stations.length>24||!Array.isArray(copy.network?.links))throw Error('network scope unavailable');if(copy.stations.some(s=>!s||['longitude','latitude','altitude_km'].some(k=>!Number.isFinite(s[k]))||Math.abs(s.longitude)>180||Math.abs(s.latitude)>90))throw Error('invalid station geometry');this.snapshot=copy;if(!this.valid(copy.utc))throw Error('stale native scope');
   this.receipt=structuredClone(receipt);this.route=structuredClone(route);this.selectedLinkId=selectedLinkId==null?null:String(selectedLinkId);
   this.setStations(copy.stations.filter(s=>s.enabled));this.refreshGroundLinks();this.syncFrame(copy.utc,0);return true;
  }catch{this.clear();return false;}
 }
 refreshGroundLinks(){
  let owner=null;try{owner=this.readFabricState?.();}catch{/* Fabric failure leaves native visibility only. */}
  const receipt=owner?.status==='accepted'&&owner.pending===false&&!owner.error&&!owner.refresh_required&&this.receipt&&owner?.receipt&&signature(owner.receipt)===signature(this.receipt)?this.receipt:null;
  const route=receipt&&this.route&&signature(owner.route)===signature(this.route)?this.route:null;
  this.routeIds=new Set(route?.status==='available'?(route.hop_list??[]).map(h=>h.link_id):[]);
  const reports=new Map((receipt?.links??[]).map(l=>[l.id,l]));
  this.setGroundLinks((this.snapshot?.network.links??[]).filter(l=>l.kind==='ground'&&l.state!=='no_radio').map(l=>{const verdict=reports.get(l.id);return {id:l.id,station:l.a,satellite:l.b,state:verdict?.usable?'usable':l.faulted||verdict?.reason==='fault'?'fault':l.state==='visible'?'visible':'unusable'};}));
 }
 linkMaterial(C){return typeof C.Material==='function'?new C.Material({translucent:true,fabric:{type:'SpaceTwinLinkFlow',source:LINK_FLOW_SOURCE,uniforms:{color:C.Color.fromCssColorString(GROUND_LINK_COLORS.usable).withAlpha(.55),downColor:C.Color.fromCssColorString('#e5fff2'),upColor:C.Color.fromCssColorString('#8beaff'),spacing:96,time:0}}}):C.Material.fromType('Color',{color:C.Color.fromCssColorString(GROUND_LINK_COLORS.usable)});}
  stationPosition(station) {
    const Cesium = this.cesium;
    if (!Cesium?.Cartesian3 || !station) return null;
    return Cesium.Cartesian3.fromDegrees(Number(station.longitude), Number(station.latitude), Math.max(0, Number(station.altitude_km) || 0) * 1000);
  }

  // stations: [{ id, name, latitude, longitude, altitude_km, min_elevation_deg, bands }]. Coverage is
  // the ground range inside which a satellite at the constellation altitude clears the mask.
  setStations(stations) {
    const Cesium = this.cesium;
    const entities = this.entityCollection();
    if (!Cesium?.Color || !entities) return;
    const keep = new Set();
    for (const station of stations || []) {
      const id = String(station.id);
      keep.add(id);
      const position = this.stationPosition(station);
      const radiusKm=this.coverageRadiusKm(station,this.snapshot);
      const radius=Number.isFinite(radiusKm)?Math.max(0,radiusKm)*1000:0;
      let entry = this.stations.get(id);
      if (!entry) {
        const color = Cesium.Color.fromCssColorString(STATION_COLOR);
        entry = { station, entity: null, coverage: null };
        entry.entity = entities.add({
          id: `station-${id}`,
          position,
          properties: { stationId: id },
          point: { pixelSize: 10, color, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: 0 },
          label: {
            text: station.name || id, font: '700 12px Segoe UI', fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.fromCssColorString('#5a3a00'), outlineWidth: 4, style: Cesium.LabelStyle?.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, 16), scaleByDistance: Cesium.NearFarScalar ? new Cesium.NearFarScalar(1e6, 1, 2.5e7, .55) : undefined,
          },
        });
        entry.coverage = entities.add({
          id: `station-coverage-${id}`,
          position,
          properties: { stationId: id },
          ellipse: { semiMajorAxis: Math.max(1, radius), semiMinorAxis: Math.max(1, radius), height: 0, material: color.withAlpha(0.07), outline: true, outlineColor: color.withAlpha(0.55), outlineWidth: 1 },
        });
        this.stations.set(id, entry);
      } else {
        entry.station = station;
        entry.entity.position = position;
        entry.coverage.position = position;
        if (entry.entity.label) entry.entity.label.text = station.name || id;
        if (entry.coverage.ellipse) { entry.coverage.ellipse.semiMajorAxis = Math.max(1, radius); entry.coverage.ellipse.semiMinorAxis = Math.max(1, radius); }
      }
      entry.coverage.show = this.coverageVisible && radius > 0;
    }
    for (const id of [...this.stations.keys()]) if (!keep.has(id)) this.removeStation(id);
    for (const key of [...this.groundLinks.keys()]) if (!keep.has(this.groundLinks.get(key).station)) this.removeGroundLink(key);
  }

  removeStation(id) {
    const entry = this.stations.get(id);
    if (!entry) return;
    const entities = this.entityCollection();
    try { entities?.remove(entry.entity); entities?.remove(entry.coverage); } catch { /* already gone */ }
    this.stations.delete(id);
  }

  // Station id under a screen position, or null. The caller owns the input handler.
  stationAt(screenPosition) {
    const viewer = this.viewer;
    if (!viewer?.scene?.pick || !screenPosition) return null;
    const picked = viewer.scene.pick(screenPosition, 7, 7);
    const value = picked?.id?.properties?.stationId;
    const id = typeof value?.getValue === 'function' ? value.getValue() : value;
    return id == null ? null : String(id);
  }

  groundMaterial(Cesium, state) {
    const css = GROUND_LINK_COLORS[state] || GROUND_LINK_COLORS.unusable;
    const color = Cesium.Color.fromCssColorString(css);
    if (state === 'usable') {
      // Reuse the OISL packet material, retaining the ground-link base colour.
      const material = this.linkMaterial(Cesium, 'locked');
      material.uniforms.color = color.withAlpha(.55);
      return material;
    }
    if (state === 'visible') return Cesium.Material.fromType('PolylineDash', { color: color.withAlpha(0.7), dashLength: 10 });
    if (state === 'fault') return Cesium.Material.fromType('PolylineDash', { color: color.withAlpha(0.9), dashLength: 8 });
    return Cesium.Material.fromType('Color', { color: color.withAlpha(state === 'usable' ? 0.9 : 0.5) });
  }

  // links: [{ id, station, satellite, state }] where satellite is the globe record id and state is
  // usable (fabric accepted), visible (above the mask but not usable), fault or unusable (not drawn).
  setGroundLinks(links) {
    const Cesium = this.cesium;
    const lines = this.linkCollection();
    if (!Cesium?.Color || !lines) return;
    const keep = new Set();
    for (const link of links || []) {
      const key = String(link.id);
      keep.add(key);
      let entry = this.groundLinks.get(key);
      if (!entry) {
        entry = { station: String(link.station), satellite: String(link.satellite), positions: [], state: null, line: null };
        entry.line = lines.add({
          id: `ground-link-${key}`,
          positions: [], show: false, width: BASE_WIDTH, material: this.groundMaterial(Cesium, link.state),
        });
        entry.state = link.state;
        entry.material = entry.line.material;
        this.groundLinks.set(key, entry);
      } else if (entry.state !== link.state) {
        entry.line.material = this.groundMaterial(Cesium, link.state);
        entry.material = entry.line.material;
        entry.state = link.state;
      }
      entry.station = String(link.station); entry.satellite = String(link.satellite);
    }
    for (const key of [...this.groundLinks.keys()]) if (!keep.has(key)) this.removeGroundLink(key);
    this.applyEmphasis();
    this.placeGroundLinks(this.timeSource());
  }

  removeGroundLink(key) {
    const entry = this.groundLinks.get(key);
    if (!entry) return;
    try { this.linkPolylines?.remove(entry.line); } catch { /* already gone */ }
    this.groundLinks.delete(key);
  }

  // Route and selection emphasis over both OISL and ground link lines; base styling is restored
  // for everything else so a route that moves on does not leave thick lines behind.
  setGroundLinksVisible(visible) {
    this.groundLinksVisible = visible !== false;
    this.placeGroundLinks(this.timeSource());
    return this.groundLinksVisible;
  }

  setCoverageVisible(visible) {
    this.coverageVisible = visible !== false;
    for (const entry of this.stations.values()) entry.coverage.show = this.coverageVisible && (entry.coverage.ellipse?.semiMajorAxis ?? 0) > 1;
    this.placeGroundLinks(this.timeSource());
    return this.coverageVisible;
  }

  placeGroundLinks(utc){
 const current=this.valid(utc)&&!this.isTransitioning()&&!(this.cesium?.SceneMode&&this.viewer?.scene?.mode===this.cesium.SceneMode.MORPHING);
 for(const entry of this.stations.values()){entry.entity.show=current;entry.coverage.show=current&&this.coverageVisible&&(entry.coverage.ellipse?.semiMajorAxis??0)>1;}
 const positions=current?new Map([...this.stations].map(([id,entry])=>[id,this.stationPosition(entry.station)])):new Map();
 const endpoints=new Map();
 for(const entry of this.groundLinks.values()){
  const a=positions.get(entry.station);if(a&&!endpoints.has(entry.satellite))endpoints.set(entry.satellite,this.cartesianAt(entry.satellite,utc,true));const b=a?endpoints.get(entry.satellite):null;
  const drawable=!!a&&!!b&&this.groundLinksVisible&&entry.state!=='unusable';if(drawable){entry.positions=[a,b];entry.line.positions=entry.positions;}entry.line.show=drawable;
 }
 // Proof checks bound the synchronous frame instead of serializing the whole graph per endpoint.
 if(current&&!this.valid(utc)){for(const entry of this.stations.values()){entry.entity.show=false;entry.coverage.show=false;}for(const entry of this.groundLinks.values())entry.line.show=false;}
 }
 applyEmphasis(){const C=this.cesium;if(!C?.Color)return;for(const [key,entry]of this.groundLinks){const routed=this.routeIds.has(key);if(entry.material?.uniforms&&'time'in entry.material.uniforms){entry.material.uniforms.color=C.Color.fromCssColorString(routed?ROUTE_COLOR:GROUND_LINK_COLORS.usable).withAlpha(.55);entry.line.material=entry.material;}else entry.line.material=routed?C.Material.fromType('Color',{color:C.Color.fromCssColorString(ROUTE_COLOR).withAlpha(.95)}):entry.material;entry.line.width=routed?ROUTE_WIDTH:key===this.selectedLinkId?SELECTED_WIDTH:BASE_WIDTH;}}
 syncFrame(utc,nowMs=0){if(this.disposed)return;if(this.valid(utc))this.refreshGroundLinks();else this.placeGroundLinks(utc);if(Number.isFinite(nowMs))for(const e of this.groundLinks.values())if(e.line.show&&e.state==='usable'&&e.line.material?.uniforms&&'time'in e.line.material.uniforms)e.line.material.uniforms.time=nowMs/1000*1.4;}
 clear(){for(const id of [...this.stations.keys()])this.removeStation(id);for(const id of [...this.groundLinks.keys()])this.removeGroundLink(id);this.snapshot=null;this.receipt=null;this.route=null;this.routeIds=new Set();this.selectedLinkId=null;}
 destroy(){if(this.disposed)return;this.clear();this.disposed=true;if(this.linkPolylines)this.linkOwner?.scene?.primitives?.remove?.(this.linkPolylines);if(this.dataSource)this.sourceOwner?.dataSources?.remove?.(this.dataSource,true);this.linkPolylines=null;this.dataSource=null;}
}
