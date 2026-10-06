// The scenario clock: the server SIM clock (run start UTC plus elapsed seconds) interpolated between
// telemetry frames. While a scenario is loaded every tab clock follows it (orbit/clock.js), so the
// transport controls of any tab act on the runtime through the callbacks the player supplies.

export function createScenarioClock({ runtime = () => null, receivedAt = () => null, wallNow = () => Date.now(), control = {}, followAll = null, releaseAll = null, followedSource = null, followAnalysis = false } = {}) {
  let engaged = false;
  function elapsed() {
    const status = runtime();
    if (!status) return 0;
    const base = Number(status.elapsed_seconds) || 0;
    const stamp = receivedAt();
    if (!status.running || stamp == null) return base;
    return base + Math.max(0, (wallNow() - stamp) / 1000) * (Number(status.speed) || 1);
  }
  function startMs() {
    const status = runtime();
    const parsed = status?.started_at ? Date.parse(status.started_at) : NaN;
    return Number.isFinite(parsed) ? parsed : wallNow();
  }
  const source = {
    elapsed,
    displayProjection() {
      const status=runtime(),stamp=receivedAt(),age=wallNow()-stamp;
      if(!status||status.running!==true||!Number.isFinite(stamp)||!Number.isFinite(age)||age<0||age>3500||!Number.isFinite(Date.parse(status.started_at))||!Number.isFinite(status.elapsed_seconds)||!Number.isFinite(status.speed)||status.speed<.1||status.speed>128)return null;
      return {time_ms:startMs()+(status.elapsed_seconds+age/1000*status.speed)*1000,run_id:status.run_id,sequence:status.sequence,elapsed_seconds:status.elapsed_seconds,projected:true,age_ms:age};
    },
    startMs,
    now: () => startMs() + elapsed() * 1000,
    engage() { engaged = true; if(followAnalysis){ if(typeof followAll!=="function")throw Error("기존 분석 시계 owner가 필요합니다.");followAll(source); } },
    setFollowAnalysis(value) { const enabled=value===true; if(enabled && (typeof followAll!=="function"||typeof releaseAll!=="function"))throw Error("기존 분석 시계 owner가 필요합니다."); if(followAnalysis && !enabled && engaged)releaseAll(); followAnalysis=enabled; if(enabled && engaged)followAll(source); },
    disengage() { if(followAnalysis && engaged && (!followedSource || followedSource()===source))releaseAll();engaged=false; },
    get engaged() { return engaged; },
    get running() { return runtime()?.running === true; },
    get speed() { return Number(runtime()?.speed) || 1; },
    pause: () => control.pause?.(),
    play: () => control.play?.(),
    setSpeed: speed => control.setSpeed?.(speed),
    // The runtime only moves forward: a backward step or seek is refused, a forward one advances the clock.
    step: seconds => { if (seconds > 0) return control.advance?.(seconds); else return control.refuse?.("시나리오 시계는 되감을 수 없습니다."); },
    seek: date => { const delta = (date.getTime() - (startMs() + elapsed() * 1000)) / 1000; if (delta > 0) return control.advance?.(delta); else return control.refuse?.("시나리오 시계는 되감을 수 없습니다."); },
    live: () => control.refuse?.("시나리오 재생 중에는 시계가 서버 SIM 시각을 따릅니다."),
  };
  return source;
}
