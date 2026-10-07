import {LINK_FLOW_SOURCE} from './link_flow.js';
// Ground-only rendering port of ISDC-ODT 1a1e002 NetworkScene. Existing NodeScene owns OISL.
// This class owns display primitives only; the existing native/UTC/fabric owners are injected.
export const GROUND_LINK_COLORS=Object.freeze({usable:'#4ac4ee',visible:'#7a95ab',fault:'#ff6b6b',unusable:'#5b6f82'});
export const ROUTE_COLOR='#a78bfa',STATION_COLOR='#ffbf47';
const ROUTE_WIDTH=4.5,SELECTED_WIDTH=4,BASE_WIDTH=2;
const signature=value=>JSON.stringify(value);
const stationPickOwners=new WeakMap();
function freezeStation(value){if(value&&typeof value==='object'){Object.values(value).forEach(freezeStation);Object.freeze(value);}return value;}
const NATIVE_PROFILE=Object.freeze({frame:'EARTH_FIXED_GMST_UTC_APPROX',inertial_frame:'SOURCE_MEAN_EQUATOR_EQUINOX_APPROX',time_model:'unix_ms_utc_approx',model_profile:'SOURCE_KEPLER_J2_V1',source_commit:'1a1e00297a0301637455b0ef2cf48b2e74576b07',quality:'engineering_assumption'});
const nativeProfile=value=>Object.entries(NATIVE_PROFILE).every(([key,v])=>value?.[key]===v);
function deeplyFrozen(value,seen=new Set()){
 if(!value||typeof value!=='object')return true;if(seen.has(value))return true;seen.add(value);
 const descriptors=Object.values(Object.getOwnPropertyDescriptors(value));
 return Object.isFrozen(value)&&descriptors.every(d=>'value'in d&&deeplyFrozen(d.value,seen));
}
// Structural display checks supplement, never replace, the injected private owner proof.
function sampledScope(value,utc){
 if(value?.presentation_kind!=='NETWORK_SAMPLED_UI_V1'||value.schema_version!==1||value.status!=='valid'||value.error!==null||!nativeProfile(value)||!deeplyFrozen(value)||value.utc!==value.analysis_utc||value.display_utc!==utc||!['sampled','pending'].includes(value.availability)||!Number.isFinite(value.age_seconds)||value.current_analysis!==(value.utc===utc))return false;
 const analysis=Date.parse(value.utc),display=Date.parse(utc);
 if(!Number.isFinite(analysis)||!Number.isFinite(display)||value.network?.time!==new Date(analysis).toISOString()||value.age_seconds!==(display-analysis)/1000)return false;
 const nodes=value.node_definitions,stations=value.stations,hashes=value.definition_hashes,network=value.network;
 if(!Array.isArray(nodes)||nodes.length>240||!Array.isArray(stations)||stations.length>24||!Array.isArray(value.faults)||!hashes||!Array.isArray(network?.nodes)||!Array.isArray(network.links))return false;
 const ids=new Set(),ground=new Set();
 for(const n of nodes){if(!n||typeof n.id!=='string'||!n.id||ids.has(n.id)||!/^[a-f0-9]{64}$/.test(hashes[n.id]??''))return false;ids.add(n.id);}
 if(Object.keys(hashes).length!==ids.size)return false;
 for(const s of stations){if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||ground.has(s.id)||['longitude','latitude','altitude_km'].some(k=>!Number.isFinite(s[k]))||Math.abs(s.longitude)>180||Math.abs(s.latitude)>90)return false;ground.add(s.id);}
 const enabled=new Set(stations.filter(s=>s.enabled).map(s=>s.id)),networkIds=new Set();
 for(const n of network.nodes){if(networkIds.has(n?.id)||!(n?.kind==='satellite'?ids.has(n.id):n?.kind==='ground'&&enabled.has(n.id)))return false;networkIds.add(n.id);}
 if(networkIds.size!==ids.size+enabled.size)return false;
 const links=new Set();for(const l of network.links){if(!l||typeof l.id!=='string'||links.has(l.id)||!networkIds.has(l.a)||!networkIds.has(l.b))return false;links.add(l.id);if(l.kind==='ground'&&(!enabled.has(l.a)||!ids.has(l.b)||!['visible','below_mask','no_radio'].includes(l.state)))return false;}
 return true;
}
export class NativeNetworkScene {
 constructor({viewer,cesium,timeSource,geometryFor,verifyNetworkSnapshot,readFabricState,coverageRadiusKm,isTransitioning=()=>false,sampledNetwork=null}={}){
  if([timeSource,geometryFor,verifyNetworkSnapshot,coverageRadiusKm].some(fn=>typeof fn!=='function'))throw TypeError('verified native network rendering ports required');
  Object.assign(this,{viewerProvider:viewer,cesiumProvider:cesium,timeSource,geometryFor,verifyNetworkSnapshot,readFabricState,coverageRadiusKm,isTransitioning});
  this.stations=new Map();this.groundLinks=new Map();this.routeIds=new Set();this.selectedLinkId=null;this.groundLinksVisible=true;this.coverageVisible=true;this.disposed=false;this.snapshot=null;this.dataSource=null;this.linkPolylines=null;
  this.sampledNetwork=sampledNetwork;this.sampledActive=false;this.sampledSnapshot=null;this.sampledGeneration=0;this.sampledFrame=0;
  stationPickOwners.set(this,{epoch:{},tokens:new WeakMap()});
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
  try{const copy=structuredClone(snapshot);if(copy?.presentation_kind==='NETWORK_SAMPLED_UI_V1'||copy?.status!=='valid'||!Array.isArray(copy.node_definitions)||copy.node_definitions.length>240||!Array.isArray(copy.stations)||copy.stations.length>24||!Array.isArray(copy.network?.links))throw Error('network scope unavailable');if(copy.stations.some(s=>!s||['longitude','latitude','altitude_km'].some(k=>!Number.isFinite(s[k]))||Math.abs(s.longitude)>180||Math.abs(s.latitude)>90))throw Error('invalid station geometry');this.snapshot=copy;if(!this.valid(copy.utc))throw Error('stale native scope');
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
  setStations(stations,prepared=null) {
    const Cesium = prepared?.cesium??this.cesium;
    const entities = prepared?.entities??this.entityCollection();
    if (!Cesium?.Color || !entities) return;
    const keep = new Set();
    for (const station of stations || []) {
      const id = String(station.id);
      keep.add(id);
      if(prepared&&!prepared.bound())return;
      const position = prepared?prepared.positions.get(id):this.stationPosition(station);
      const radiusKm=prepared?prepared.radii.get(id):this.coverageRadiusKm(station,this.snapshot);
      const radius=Number.isFinite(radiusKm)?Math.max(0,radiusKm)*1000:0;
      let entry = this.stations.get(id);
      if (!entry) {
        const color = Cesium.Color.fromCssColorString(STATION_COLOR);
        entry = { station, entity: null, coverage: null };
        entry.entity = entities.add({
          id: `station-${id}`,
          ...(prepared?{show:false}:{}),
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
          ...(prepared?{show:false}:{}),
          position,
          properties: { stationId: id },
          ellipse: { semiMajorAxis: Math.max(1, radius), semiMinorAxis: Math.max(1, radius), height: 0, material: color.withAlpha(0.07), outline: true, outlineColor: color.withAlpha(0.55), outlineWidth: 1 },
        });
        if(prepared&&!prepared.bound()){entities.remove(entry.entity);entities.remove(entry.coverage);return;}
        this.stations.set(id, entry);
      } else {
        if(signature(entry.station)!==signature(station))this.revokeStationPicks();
        entry.station = station;
        entry.entity.position = position;
        entry.coverage.position = position;
        if (entry.entity.label) entry.entity.label.text = station.name || id;
        if (entry.coverage.ellipse) { entry.coverage.ellipse.semiMajorAxis = Math.max(1, radius); entry.coverage.ellipse.semiMinorAxis = Math.max(1, radius); }
      }
      entry.coverage.show = !prepared&&this.coverageVisible && radius > 0;
    }
    for (const id of [...this.stations.keys()]) if (!keep.has(id)) this.removeStation(id);
    for (const key of [...this.groundLinks.keys()]) if (!keep.has(this.groundLinks.get(key).station)) this.removeGroundLink(key);
  }

  removeStation(id) {
    const entry = this.stations.get(id);
    if (!entry) return;
    this.revokeStationPicks();entry.entity.show=false;entry.coverage.show=false;
    const entities = this.dataSource?.entities;
    try { entities?.remove(entry.entity); entities?.remove(entry.coverage); } catch { /* already gone */ }
    this.stations.delete(id);
  }

  // Station id under a screen position, or null. The caller owns the input handler.
  revokeStationPicks(){stationPickOwners.get(this).epoch={};}
  stationPickScope(id,entity=null){
   const registry=stationPickOwners.get(this),epoch=registry.epoch,entry=this.stations.get(id);if(!entry)return null;
   let viewer,C;const viewerProvider=this.viewerProvider,cesiumProvider=this.cesiumProvider,timeSource=this.timeSource,transition=this.isTransitioning;
   const bound=()=>!this.disposed&&registry.epoch===epoch&&this.stations.get(id)===entry&&this.viewerProvider===viewerProvider&&this.cesiumProvider===cesiumProvider&&this.timeSource===timeSource&&this.isTransitioning===transition&&this.sourceOwner===viewer&&entry.entity.show===true&&(!entity||entity===entry.entity||entity===entry.coverage)&&(!entity||entity.show===true);
   try{
    viewer=this.viewer;C=this.cesium;
    if(!bound()||!entry.station?.enabled||this.isTransitioning()||C?.SceneMode&&viewer?.scene?.mode===C.SceneMode.MORPHING)throw Error('station unavailable');
    const utc=this.timeSource();let scope;
    if(this.sampledActive&&!(this.snapshot?.utc===utc&&this.valid(utc))){
     const port=this.sampledNetwork,read=port?.read,verify=port?.verify;
     if(typeof read!=='function'||typeof verify!=='function'||!this.sampledSnapshot||verify(this.sampledSnapshot,{utc})!==true)throw Error('sampled scope unavailable');
     scope=read({utc});
     if(!sampledScope(scope,utc)||signature(scope.stations)!==signature(this.sampledSnapshot.stations)||verify(scope,{utc})!==true||this.sampledNetwork!==port||port.read!==read||port.verify!==verify)throw Error('sampled scope changed');
     const station=scope.stations.find(s=>s.id===id);
     if(!station?.enabled||signature(station)!==signature(entry.station)||!bound()||this.viewer!==viewer||this.cesium!==C||this.timeSource()!==utc||this.isTransitioning()||C?.SceneMode&&viewer?.scene?.mode===C.SceneMode.MORPHING||this.viewer!==viewer||this.cesium!==C||this.timeSource()!==utc||!bound()||verify(scope,{utc})!==true||!bound())throw Error('station ownership changed');
    }else{
     scope=this.snapshot;
     const station=scope?.stations?.find(s=>s.id===id);
     if(!station?.enabled||signature(station)!==signature(entry.station)||!this.valid(utc)||!bound()||this.viewer!==viewer||this.cesium!==C||this.timeSource()!==utc||this.isTransitioning()||C?.SceneMode&&viewer?.scene?.mode===C.SceneMode.MORPHING||this.viewer!==viewer||this.cesium!==C||this.timeSource()!==utc||!bound()||this.verifyNetworkSnapshot(structuredClone(scope))!==true||!bound())throw Error('station ownership changed');
    }
    return {entry,viewer,epoch,station:entry.station};
   }catch{this.revokeStationPicks();return null;}
  }
  captureStationPick(id){
   if(typeof id!=='string')return null;const scope=this.stationPickScope(id);if(!scope)return null;
   const token=freezeStation({id,station:structuredClone(scope.station)});stationPickOwners.get(this).tokens.set(token,{...scope,definition:signature(scope.station)});return token;
  }
  stationPick(picked){
   const entity=picked?.id;if(!entity)return null;
   for(const [id,entry]of this.stations)if(entity===entry.entity||entity===entry.coverage){
    const scope=this.stationPickScope(id,entity);if(!scope)return null;
    const token=freezeStation({id,station:structuredClone(scope.station)});stationPickOwners.get(this).tokens.set(token,{...scope,entity,definition:signature(scope.station)});return token;
   }
   return null;
  }
  verifyStationPick(token){
   const registry=stationPickOwners.get(this),record=registry.tokens.get(token);if(!record||record.epoch!==registry.epoch)return false;
   const scope=this.stationPickScope(token.id,record.entity);
   return !!scope&&record.epoch===registry.epoch&&scope.entry===record.entry&&scope.viewer===record.viewer&&signature(scope.station)===record.definition;
  }
  stationAt(screenPosition) {
    try{const viewer=this.viewer;if(!viewer?.scene?.pick||!screenPosition)return null;
     const picked=viewer.scene.pick(screenPosition,7,7),token=this.stationPick(picked);return token&&this.verifyStationPick(token)?token.id:null;
    }catch{this.revokeStationPicks();return null;}
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
  setGroundLinks(links,prepared=null) {
    const Cesium = prepared?.cesium??this.cesium;
    const lines = prepared?.lines??this.linkCollection();
    if (!Cesium?.Color || !lines) return;
    const keep = new Set();
    for (const link of links || []) {
      if(prepared&&!prepared.bound())return;
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
        if(prepared&&!prepared.bound()){entry.line.show=false;lines.remove(entry.line);return;}
        this.groundLinks.set(key, entry);
      } else if (entry.state !== link.state) {
        const material=this.groundMaterial(Cesium, link.state);
        if(prepared&&!prepared.bound())return;
        entry.line.material = material;
        entry.material = entry.line.material;
        entry.state = link.state;
      }
      entry.station = String(link.station); entry.satellite = String(link.satellite);
    }
    for (const key of [...this.groundLinks.keys()]) if (!keep.has(key)) this.removeGroundLink(key);
    if(!prepared){this.applyEmphasis();this.placeGroundLinks(this.timeSource());}
  }

  removeGroundLink(key) {
    const entry = this.groundLinks.get(key);
    if (!entry) return;
    entry.line.show=false;
    try { this.linkPolylines?.remove(entry.line); } catch { /* already gone */ }
    this.groundLinks.delete(key);
  }

  // Route and selection emphasis over both OISL and ground link lines; base styling is restored
  // for everything else so a route that moves on does not leave thick lines behind.
  setGroundLinksVisible(visible) {
    this.groundLinksVisible = visible !== false;
    this.syncFrame(this.timeSource());
    return this.groundLinksVisible;
  }

  setCoverageVisible(visible) {
    if(visible===false&&this.coverageVisible)this.revokeStationPicks();
    this.coverageVisible = visible !== false;
    for (const entry of this.stations.values()) entry.coverage.show = this.coverageVisible && (entry.coverage.ellipse?.semiMajorAxis ?? 0) > 1;
    this.syncFrame(this.timeSource());
    return this.coverageVisible;
  }

  placeGroundLinks(utc){
 const current=this.valid(utc)&&!this.isTransitioning()&&!(this.cesium?.SceneMode&&this.viewer?.scene?.mode===this.cesium.SceneMode.MORPHING);
 if(!current)this.revokeStationPicks();
 for(const entry of this.stations.values()){entry.entity.show=current;entry.coverage.show=current&&this.coverageVisible&&(entry.coverage.ellipse?.semiMajorAxis??0)>1;}
 const positions=current?new Map([...this.stations].map(([id,entry])=>[id,this.stationPosition(entry.station)])):new Map();
 const endpoints=new Map();
 for(const entry of this.groundLinks.values()){
  const a=positions.get(entry.station);if(a&&!endpoints.has(entry.satellite))endpoints.set(entry.satellite,this.cartesianAt(entry.satellite,utc,true));const b=a?endpoints.get(entry.satellite):null;
  const drawable=!!a&&!!b&&this.groundLinksVisible&&entry.state!=='unusable';if(drawable){entry.positions=[a,b];entry.line.positions=entry.positions;}entry.line.show=drawable;
 }
 // Proof checks bound the synchronous frame instead of serializing the whole graph per endpoint.
 if(current&&!this.valid(utc)){this.revokeStationPicks();for(const entry of this.stations.values()){entry.entity.show=false;entry.coverage.show=false;}for(const entry of this.groundLinks.values())entry.line.show=false;}
 }
 applyEmphasis(){const C=this.cesium;if(!C?.Color)return;for(const [key,entry]of this.groundLinks){const routed=this.routeIds.has(key);if(entry.material?.uniforms&&'time'in entry.material.uniforms){entry.material.uniforms.color=C.Color.fromCssColorString(routed?ROUTE_COLOR:GROUND_LINK_COLORS.usable).withAlpha(.55);entry.line.material=entry.material;}else entry.line.material=routed?C.Material.fromType('Color',{color:C.Color.fromCssColorString(ROUTE_COLOR).withAlpha(.95)}):entry.material;entry.line.width=routed?ROUTE_WIDTH:key===this.selectedLinkId?SELECTED_WIDTH:BASE_WIDTH;}}
 hideSampledNetwork(){this.revokeStationPicks();for(const e of this.stations.values()){e.entity.show=false;e.coverage.show=false;}for(const e of this.groundLinks.values())e.line.show=false;this.sampledSnapshot=null;}
 setSampledActive(active){this.sampledGeneration++;this.sampledActive=active===true&&!this.disposed;this.sampledSnapshot=null;if(!this.sampledActive)this.hideSampledNetwork();return this.sampledActive;}
 placeSampledNetwork(utc){
  const frame=++this.sampledFrame,generation=this.sampledGeneration,port=this.sampledNetwork,read=port?.read,verify=port?.verify;
  const bound=()=>!this.disposed&&this.sampledActive&&generation===this.sampledGeneration&&frame===this.sampledFrame&&this.sampledNetwork===port&&port?.read===read&&port?.verify===verify;
  const fail=()=>{if(bound())this.hideSampledNetwork();return false;};
  if(!bound()||typeof read!=='function'||typeof verify!=='function')return fail();
  try{
   const C=this.cesium,v=this.viewer,mode=v?.scene?.mode,viewerProvider=this.viewerProvider,cesiumProvider=this.cesiumProvider,geometryFor=this.geometryFor,timeSource=this.timeSource,transition=this.isTransitioning,coverageRadiusKm=this.coverageRadiusKm,linksVisible=this.groundLinksVisible,coverageVisible=this.coverageVisible;
   const scopeBound=()=>bound()&&v?.scene?.mode===mode&&viewerProvider===this.viewerProvider&&cesiumProvider===this.cesiumProvider&&geometryFor===this.geometryFor&&timeSource===this.timeSource&&transition===this.isTransitioning&&coverageRadiusKm===this.coverageRadiusKm&&linksVisible===this.groundLinksVisible&&coverageVisible===this.coverageVisible&&(!this.sourceOwner||this.sourceOwner===v)&&(!this.linkOwner||this.linkOwner===v);
   // Verify around actual provider reads: a verifier callback can replace the Viewer,
   // and a provider callback can revoke the lease without changing UTC/generation.
   // This is deliberately bounded. The terminal registered-owner verifier is an
   // observational authority port, not a renderer-mutating callback; arbitrary
   // mutually mutating owners require a transaction contract, not an infinite loop.
   const current=value=>{
    const changing=transition(),currentC=this.cesium,currentViewer=this.viewer,currentUtc=timeSource(),morph=changing||C?.SceneMode&&currentViewer?.scene?.mode===C.SceneMode.MORPHING;
    if(morph||currentUtc!==utc||currentViewer!==v||currentC!==C||this.viewer!==v||this.cesium!==C||timeSource()!==utc||!scopeBound()||verify(value,{utc})!==true||!scopeBound())return false;
    if(this.viewer!==v||this.cesium!==C||timeSource()!==utc||!scopeBound())return false;
    // Final proof follows every external getter; only internal fences follow it.
    return verify(value,{utc})===true&&scopeBound();
   };
   const value=read({utc});if(!scopeBound()||!sampledScope(value,utc)||!current(value))return fail();
   const positions=new Map(),radii=new Map(),endpoints=new Map();
   for(const s of value.stations.filter(s=>s.enabled)){
    const position=C.Cartesian3.fromDegrees(s.longitude,s.latitude,Math.max(0,s.altitude_km)*1000),radius=coverageRadiusKm(s,value);
    if(!scopeBound()||!Number.isFinite(radius))return fail();positions.set(s.id,position);radii.set(s.id,Math.max(0,radius));
   }
   for(const n of value.node_definitions){const g=geometryFor(structuredClone(n),{utc}),row=g?.row;
    if(!scopeBound()||!nativeProfile(g)||g.node_id!==n.id||signature(g.node_definition)!==signature(n)||g.definition_hash!==value.definition_hashes[n.id]||row?.utc!==utc||row.status!=='valid'||row.error_code!==null||!Array.isArray(row.position_m)||row.position_m.length!==3||!row.position_m.every(Number.isFinite))return fail();
    endpoints.set(n.id,new C.Cartesian3(...row.position_m));
   }
   if(!current(value))return fail();
   const entities=this.entityCollection(),lines=this.linkCollection();if(!scopeBound()||!entities||!lines)return fail();
   const prepared={cesium:C,entities,lines,positions,radii,bound:scopeBound};
   this.setStations(value.stations.filter(s=>s.enabled),prepared);if(!scopeBound())return fail();
   this.setGroundLinks(value.network.links.filter(l=>l.kind==='ground'&&l.state!=='no_radio').map(l=>({id:l.id,station:l.a,satellite:l.b,state:l.faulted?'fault':l.state==='visible'?'visible':'unusable'})),prepared);
   if(!scopeBound())return fail();
   // No fabric receipt or route can give this historical visual command authority.
   this.routeIds=new Set();this.receipt=null;this.route=null;this.selectedLinkId=null;
   if(!current(value))return fail();
   this.sampledSnapshot=value;
   for(const e of this.stations.values()){e.entity.show=true;e.coverage.show=coverageVisible&&(e.coverage.ellipse?.semiMajorAxis??0)>1;}
   for(const e of this.groundLinks.values()){const a=positions.get(e.station),b=endpoints.get(e.satellite);e.line.width=BASE_WIDTH;e.line.material=e.material;e.positions=[a,b];e.line.positions=e.positions;e.line.show=linksVisible&&!!a&&!!b&&e.state!=='unusable';}
   return true;
  }catch{return fail();}
 }
 syncFrame(utc,nowMs=0){if(this.disposed)return;const exact=this.snapshot?.utc===utc&&this.valid(utc);if(this.sampledActive&&!exact){this.placeSampledNetwork(utc);return;}if(exact)this.refreshGroundLinks();else this.placeGroundLinks(utc);if(Number.isFinite(nowMs))for(const e of this.groundLinks.values())if(e.line.show&&e.state==='usable'&&e.line.material?.uniforms&&'time'in e.line.material.uniforms)e.line.material.uniforms.time=nowMs/1000*1.4;}
 clear(){this.setSampledActive(false);for(const id of [...this.stations.keys()])this.removeStation(id);for(const id of [...this.groundLinks.keys()])this.removeGroundLink(id);this.snapshot=null;this.receipt=null;this.route=null;this.routeIds=new Set();this.selectedLinkId=null;}
 destroy(){if(this.disposed)return;this.clear();this.disposed=true;if(this.linkPolylines)this.linkOwner?.scene?.primitives?.remove?.(this.linkPolylines);if(this.dataSource)this.sourceOwner?.dataSources?.remove?.(this.dataSource,true);this.linkPolylines=null;this.dataSource=null;}
}
