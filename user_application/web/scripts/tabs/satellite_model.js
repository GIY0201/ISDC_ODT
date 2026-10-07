import {describeMatch} from '../orbit/satellite_model_description.js';

// Original orbit.js renderShape descriptions and explicit camera actions,
// composed with copied model presentation state rather than a runtime store.
export function createSatelliteModelPanel(globe) {
  let view = null, disposed = false, boundPanel = null, bindings = [];
  const phases = {
    unassigned: '3D 모델 미배정 · 점 표시', loading: '3D 모델 준비 중',
    ready: '3D 모델 렌더링 준비 완료', error: '3D 모델 오류 · 점 표시 유지',
    hidden_no_geometry: '현재 UTC의 좌표 없음 · 모델 숨김',
  };
  function unbind() {
    for (const [node, fn] of bindings) node.removeEventListener('click', fn);
    bindings = []; boundPanel = null;
  }
  function draw() {
    if (disposed || view !== 'satellite') return;
    let panel = document.getElementById('satellite-model-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'satellite-model-panel'; panel.className = 'panel';
      document.getElementById('screen').prepend(panel);
      // All variable text/URLs are assigned below, never interpolated as HTML.
      panel.innerHTML = '<header><h2>선택 위성 3D 모델</h2></header><div class="body"><p id="satellite-model-quality"></p><p id="satellite-model-label"></p><img id="satellite-model-image" width="160" alt=""><p id="satellite-model-note"></p><a id="satellite-model-credit" target="_blank" rel="noopener noreferrer"></a><p id="satellite-model-status" role="status"></p><button id="satellite-model-focus" type="button">모델 초점</button> <button id="satellite-model-follow" type="button">현재 거리로 추적</button> <button id="satellite-model-release" type="button">추적 해제</button> <button id="satellite-model-retry" type="button">모델 재시도</button><small>표시 자세는 좌표 기반 근사이며 실제 자세 측정값이 아닙니다.</small></div>';
    }
    const node = id => panel.querySelector('#satellite-model-' + id);
    if (panel !== boundPanel) {
      unbind(); boundPanel = panel;
      const actions = {
        focus: () => globe.focusSatelliteModel({keepRange: false}),
        follow: () => globe.focusSatelliteModel({keepRange: true}),
        release: () => globe.releaseSatelliteModel(),
        retry: () => globe.retrySatelliteModel(),
      };
      for (const [id, action] of Object.entries(actions)) {
        const button = node(id);
        const fn = () => { if (!disposed && !button.disabled) action(); };
        button.addEventListener('click', fn); bindings.push([button, fn]);
      }
    }
    const state = globe.modelState(), match = state.match, text = describeMatch(match);
    node('quality').textContent = text.state;
    node('quality').dataset.quality = match?.quality || 'none';
    node('label').textContent = text.label; node('note').textContent = text.note;
    const image = node('image'); image.hidden = !match;
    image.alt = match ? text.alt : '';
    if (match) image.src = match.thumbnail; else image.removeAttribute('src');
    const credit = node('credit'); credit.hidden = !text.credit;
    credit.textContent = text.credit;
    if (/^https:\/\//.test(text.creditUrl)) credit.setAttribute('href', text.creditUrl);
    else credit.removeAttribute('href');
    const status = state.status || {phase: 'unassigned'};
    const manifest = state.manifest;
    const manifestText = manifest?.phase === 'error' ? ` · 모델 목록 오류: ${manifest.error}` : manifest?.phase === 'loading' ? ' · 모델 목록 준비 중' : '';
    node('status').textContent = `${phases[status.phase] || '상태 미확인'}${status.error ? ' · ' + status.error : ''}${manifestText}${state.tracking ? ' · 선택 위성 추적 중' : ''}`;
    const canFocus = !!state.selected && !['hidden_no_geometry', 'error'].includes(status.phase);
    node('focus').disabled = !canFocus; node('follow').disabled = !canFocus;
    node('release').disabled = !state.tracking;
    node('retry').disabled = status.phase !== 'error' || !match;
  }
  const remove = globe.observeModel(draw);
  return {
    show(next) { view = next;if(view!=='satellite'){unbind();document.getElementById('satellite-model-panel')?.remove();return;}draw(); }, update: draw,
    // Draft restoration is intentionally display-only, with no camera command.
    applyDraft() { draw(); },
    destroy() {
      if (disposed) return;
      disposed = true; remove(); unbind(); view = null;
    },
  };
}
