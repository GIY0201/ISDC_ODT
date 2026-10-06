import {NODE_COMMUNICATION_METADATA} from '../nodes/node_timeline.js';
import {createUtcCodec,LEAP_SHA256} from '../orbit_utc.js';
const codec=createUtcCodec(LEAP_SHA256);
// Original source1a1e002 orbit.js hoverSatellite facts/placement. Native position
// and its UTC replace the original browser-propagated altitude. No selection,
// query, propagation or camera callback is accepted by this presentation port.
export function createSatelliteHover(container, cesium) {
  const document = container.ownerDocument;
  const card = document.createElement('aside');
  card.className = 'satellite-hover-card';
  card.style.position = 'absolute';
  card.style.pointerEvents = 'none';
  card.style.maxWidth = '100%';
  card.style.overflowWrap = 'anywhere';
  const name = document.createElement('b');
  const facts = document.createElement('small');
  const time = document.createElement('small');
  for (const node of [name, facts, time]) node.style.display = 'block';
  card.append(name, facts, time);
  card.hidden = true;
  container.append(card);
  let disposed = false,kind=null;
  const bounded = value => Array.from(String(value ?? '')).slice(0, 256).join('');
  function clear(domain) { if(typeof domain==='string'&&domain!==kind)return;card.hidden = true;kind=null; }
  const clamp = (value, total, extent, minimum, margin) => {
    const maximum = Math.max(0, total - extent - margin);
    return Math.max(Math.min(minimum, maximum), Math.min(maximum, value));
  };
  function show(payload) {
    if (disposed) return;
    if(payload?.kind==='source_node'){
      const geometry=payload.node_geometry,row=geometry?.row;
      let valid=payload.item&&payload.screen&&[payload.screen.x,payload.screen.y].every(Number.isFinite)&&typeof payload.id==='string'&&payload.id===geometry?.node_id&&geometry.node_definition?.schema===1&&geometry.node_definition.id===payload.id&&/^[a-f0-9]{64}$/.test(geometry.definition_hash)&&Object.entries(NODE_COMMUNICATION_METADATA).every(([key,value])=>geometry[key]===value)&&row?.status==='valid'&&row.error_code===null&&Array.isArray(row.position_m)&&row.position_m.length===3&&row.position_m.every(Number.isFinite)&&Number.isFinite(row.height_km);
      try{valid=valid&&codec.advance(row.utc,0)===row.utc;}catch{valid=false;}
      if(!valid){clear();return;}
      name.textContent=bounded(payload.item.OBJECT_NAME);
      facts.textContent=`노드 ${bounded(payload.id)} / ${bounded(payload.item.ORBIT_REGIME)||'미확인'} / ${row.height_km.toFixed(3)} km`;
      time.textContent=`${row.utc} · Kepler+J2 모의 계산 · GMST/UTC 근사 좌표 · 실제 통신 미확인${row.interpolated?' · 보간 위치':''}`;
      kind='source_node';place(payload.screen);return;
    }
    const position = payload?.position;
    if (!payload?.item || !payload.screen ||
        !Number.isFinite(payload.screen.x) || !Number.isFinite(payload.screen.y) ||
        position?.frame !== 'ITRF' || position.status === 'error' || position.error_code || !Array.isArray(position.position_m) ||
        position.position_m.length !== 3 || !position.position_m.every(Number.isFinite) ||
        typeof position.utc !== 'string' || position.utc.length > 40 ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(position.utc) ||
        payload.id == null || position.catalog_number == null ||
        String(payload.id) !== String(position.catalog_number)) {
      clear(); return;
    }
    let height;
    try {
      height = cesium.Cartographic.fromCartesian(new cesium.Cartesian3(...position.position_m))?.height;
    } catch { clear(); return; }
    if (!Number.isFinite(height)) { clear(); return; }
    name.textContent = bounded(payload.item.OBJECT_NAME);
    facts.textContent = `NORAD ${bounded(payload.id)} / ${bounded(payload.item.ORBIT_REGIME) || '미확인'} / ${(height / 1000).toFixed(3)} km`;
    time.textContent = `${position.utc} · WGS84 타원체 고도${position.interpolated ? ' · 보간 위치' : ''}`;
    kind='gp';place(payload.screen);
  }
  function place(screen){
    card.hidden = false;
    card.style.left = `${clamp(screen.x + 12, container.clientWidth, card.offsetWidth, 6, 8)}px`;
    card.style.top = `${clamp(screen.y + 48, container.clientHeight, card.offsetHeight, 38, 8)}px`;
  }
  container.addEventListener('mouseleave', clear);
  return {
    show, clear,
    destroy() {
      if (disposed) return;
      disposed = true; clear();
      container.removeEventListener('mouseleave', clear);
      card.remove();
    },
  };
}
