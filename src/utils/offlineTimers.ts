export type OfflineTimes = Record<string, number>;

export function mergeOfflineDeadlines(previous: OfflineTimes, seconds: OfflineTimes = {}, now = Date.now()): OfflineTimes {
  const next: OfflineTimes = {};
  for (const [id, remaining] of Object.entries(seconds)) {
    if (!Number.isFinite(remaining) || remaining <= 0) continue;
    const deadline = now + Math.ceil(remaining) * 1000;
    next[id] = previous[id] === undefined ? deadline : Math.min(previous[id], deadline);
  }
  return next;
}

export function remainingOfflineSeconds(deadlines: OfflineTimes, now = Date.now()): OfflineTimes {
  return Object.fromEntries(Object.entries(deadlines)
    .filter(([, deadline]) => Number.isFinite(deadline) && deadline > now)
    .map(([id, deadline]) => [id, Math.ceil((deadline - now) / 1000)]));
}

export function pruneOfflineDeadlines(deadlines: OfflineTimes, now = Date.now()): OfflineTimes {
  const entries = Object.entries(deadlines);
  const active = entries.filter(([, deadline]) => Number.isFinite(deadline) && deadline > now);
  return active.length === entries.length ? deadlines : Object.fromEntries(active);
}
