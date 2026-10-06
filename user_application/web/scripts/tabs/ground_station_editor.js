// Original communication.js station editor body, source1a1e002; dependencies injected.
export function createGroundStationEditorTools({model,escape}={}) {
 const {BANDS,BAND_LABELS,STATION_PRESETS}=model;const esc=escape;
function stationEditorMarkup(station) {
  const bandBoxes = BANDS.map(band => `<label class="cm-check"><input type="checkbox" name="bands" value="${band}" ${station.bands.includes(band) ? "checked" : ""}> ${esc(BAND_LABELS[band])}</label>`).join("");
  return `<header class="cm-editor-head"><b>지상국 편집</b><small>${esc(station.id)}${station.preset ? ` · 프리셋 ${esc(STATION_PRESETS[station.preset]?.name || station.preset)}` : " · 직접 입력"}</small></header>
    <label>이름 <input name="name" value="${esc(station.name)}" maxlength="40" required></label>
    <div class="cm-grid-2"><label>위도 ° <input name="latitude" type="number" step="0.0001" min="-90" max="90" value="${esc(station.latitude)}"></label><label>경도 ° <input name="longitude" type="number" step="0.0001" min="-180" max="180" value="${esc(station.longitude)}"></label></div>
    <div class="cm-grid-3"><label>고도 km <input name="altitude_km" type="number" step="0.01" min="-0.5" max="9" value="${esc(station.altitude_km)}"></label><label>안테나 m <input name="dish_m" type="number" step="0.1" min="0.5" max="70" value="${esc(station.dish_m)}"></label><label>최소 고각 ° <input name="min_elevation_deg" type="number" step="0.5" min="0" max="89" value="${esc(station.min_elevation_deg)}"></label></div>
    <div class="cm-bands">${bandBoxes}</div>
    <label class="cm-check"><input type="checkbox" name="enabled" ${station.enabled !== false ? "checked" : ""}> 통신망에 사용</label>
    <ul class="cm-errors" hidden></ul>
    <div class="cm-editor-actions"><button type="button" data-station-remove class="danger">삭제</button><span class="cm-spacer"></span><button type="button" data-station-cancel>닫기</button><button type="submit" class="cm-primary">저장</button></div>`;
}
 return Object.freeze({stationEditorMarkup,markup:station=>stationEditorMarkup(station)
  .replace(/name="([^"]+)"(?: value="([^"]+)")?/g,(all,name,value)=>`${all} id="ground-node-${name==='bands'?`band-${value}`:name}"`)
  .replace('class="cm-errors"','id="ground-node-errors" class="cm-errors"')
  .replace('data-station-remove','id="ground-node-remove" data-station-remove')
  .replace('data-station-cancel','id="ground-node-cancel" data-station-cancel')
  .replace('type="submit"','id="ground-node-save" type="submit"')});
}
