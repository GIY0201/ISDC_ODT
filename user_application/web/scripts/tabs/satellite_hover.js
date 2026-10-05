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
  let disposed = false;
  const bounded = value => Array.from(String(value ?? '')).slice(0, 256).join('');
  function clear() { card.hidden = true; }
  const clamp = (value, total, extent, minimum, margin) => {
    const maximum = Math.max(0, total - extent - margin);
    return Math.max(Math.min(minimum, maximum), Math.min(maximum, value));
  };
  function show(payload) {
    if (disposed) return;
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
    card.hidden = false;
    card.style.left = `${clamp(payload.screen.x + 12, container.clientWidth, card.offsetWidth, 6, 8)}px`;
    card.style.top = `${clamp(payload.screen.y + 48, container.clientHeight, card.offsetHeight, 38, 8)}px`;
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
