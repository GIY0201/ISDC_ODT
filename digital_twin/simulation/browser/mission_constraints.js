// Original source planning constraints; no clock, history or propagation.
export function createMissionConstraints({timeOf}={}) {
 if(typeof timeOf!=='function')throw new TypeError('source mission time parser required');
 const MAX_HORIZON_HOURS=24;
// BEGIN ORIGINAL CONSTRAINTS
function planHorizon(nowMs, deadlineMs, { marginHours = 1, minHours = 2, maxHours = MAX_HORIZON_HOURS } = {}) {
  const wanted = (Math.max(0, (deadlineMs ?? nowMs) - nowMs) / 3600_000) + marginHours;
  const hours = Math.max(minHours, Math.min(maxHours, wanted));
  return { start: nowMs, end: nowMs + hours * 3600_000, hours };
}

// Intervals where the predicate holds, sampled on a step and refined at the edges by bisection.

function busyIntervals(missions, { except = null } = {}) {
  const busy = {};
  for (const mission of missions || []) {
    if (mission.id === except || mission.status !== 'committed' || !mission.plan?.tasks) continue;
    for (const task of mission.plan.tasks) {
      if (!task.satellite || timeOf(task.start) === null || timeOf(task.end) === null) continue;
      (busy[task.satellite] ||= []).push({ start: task.start, end: task.end, task_id: task.id, mission_id: mission.id });
    }
  }
  for (const list of Object.values(busy)) list.sort((p, q) => timeOf(p.start) - timeOf(q.start));
  return busy;
}

function faultTargets(faults, kind) {
  return new Set((faults || []).filter(fault => fault?.kind === kind && fault.active !== false).map(fault => String(fault.target)));
}

// OISL pairs the runtime's active link-loss faults touch: by pair id or by either node's id or name.
function faultedPairKeys(pairs, nodes, faults) {
  const targets = faultTargets(faults, "link_loss");
  if (!targets.size) return new Set();
  const byId = new Map((nodes || []).map(node => [node.id, node]));
  const keys = new Set();
  for (const pair of pairs || []) {
    const a = byId.get(pair.a); const b = byId.get(pair.b);
    const names = [pair.key, pair.a, pair.b, a?.name, b?.name].filter(value => value != null).map(String);
    if (names.some(name => targets.has(name))) keys.add(pair.key);
  }
  return keys;
}

// Stations the runtime's active link-loss faults name, by id or name.
function faultedStationIds(stations, faults) {
  const targets = faultTargets(faults, "link_loss");
  return new Set((stations || []).filter(station => targets.has(station.id) || targets.has(station.name)).map(station => station.id));
}
// END ORIGINAL CONSTRAINTS
 return Object.freeze({planHorizon,busyIntervals,faultedPairKeys,faultedStationIds});
}
