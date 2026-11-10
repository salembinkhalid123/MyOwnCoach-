// Read-only training analytics: history lookup, PRs, progression, weekly stats.

import { getState } from './store.js';
import { PROGRESSION } from './defaults.js';
import { parseISO, mondayOf, daysBetween, fmtNum } from './utils.js';

function chronological(workouts) {
  return [...workouts].sort((a, b) =>
    a.date === b.date ? (a.createdAt || 0) - (b.createdAt || 0) : a.date < b.date ? -1 : 1);
}

export function workoutsNewestFirst() {
  return chronological(getState().workouts).reverse();
}

/**
 * Every logged session of one exercise, oldest first, across ALL days.
 * `excludeWorkoutId` lets the edit screen ignore the workout being edited.
 */
export function exerciseHistory(exerciseId, excludeWorkoutId = null) {
  const out = [];
  for (const w of chronological(getState().workouts)) {
    if (w.id === excludeWorkoutId) continue;
    for (const e of w.exercises) {
      if (e.exerciseId === exerciseId && e.sets.length) {
        out.push({ workoutId: w.id, date: w.date, dayName: w.dayName, sets: e.sets });
      }
    }
  }
  return out;
}

export function lastSession(exerciseId, excludeWorkoutId = null) {
  const h = exerciseHistory(exerciseId, excludeWorkoutId);
  return h.length ? h[h.length - 1] : null;
}

/** Best set = heaviest weight, ties broken by reps. */
function isBetterSet(a, b) {
  return !b || a.w > b.w || (a.w === b.w && a.r > b.r);
}

export function bestSetOf(sets) {
  let best = null;
  for (const s of sets) if (isBetterSet(s, best)) best = s;
  return best;
}

export function volumeOf(sets) {
  return sets.reduce((sum, s) => sum + s.w * s.r, 0);
}

/** Records before a given workout (or overall). */
export function records(exerciseId, excludeWorkoutId = null) {
  const hist = exerciseHistory(exerciseId, excludeWorkoutId);
  if (!hist.length) return null;
  let bestW = -Infinity;
  let repsAtBestW = 0;
  let bestWR = -Infinity;
  let bestSet = null;
  for (const h of hist) {
    for (const s of h.sets) {
      if (s.w > bestW) { bestW = s.w; repsAtBestW = s.r; } else if (s.w === bestW) repsAtBestW = Math.max(repsAtBestW, s.r);
      bestWR = Math.max(bestWR, s.w * s.r);
      if (isBetterSet(s, bestSet)) bestSet = s;
    }
  }
  return { bestW, repsAtBestW, bestWR, bestSet, sessions: hist.length };
}

/**
 * Does this set beat previous records? Returns null or { kind, label }.
 * No PRs are shown for the very first session of an exercise.
 */
export function prFor(rec, w, r) {
  if (!rec || !(r > 0) || isNaN(w)) return null;
  if (w > rec.bestW) return { kind: 'weight', label: 'Weight PR' };
  if (w * r > rec.bestWR) return { kind: 'set', label: 'Set PR' };
  if (w === rec.bestW && r > rec.repsAtBestW) return { kind: 'reps', label: 'Rep PR' };
  return null;
}

/** Collect every PR inside a saved workout (for the "workout saved" summary). */
export function prsInWorkout(workout) {
  const result = [];
  for (const e of workout.exercises) {
    const rec = records(e.exerciseId, workout.id);
    if (!rec) continue;
    // Report only the most impressive PR set per exercise.
    const rank = { weight: 3, set: 2, reps: 1 };
    let best = null;
    for (const s of e.sets) {
      const pr = prFor(rec, s.w, s.r);
      if (!pr) continue;
      const better = !best
        || rank[pr.kind] > rank[best.pr.kind]
        || (rank[pr.kind] === rank[best.pr.kind] && s.w * s.r > best.set.w * best.set.r);
      if (better) best = { set: s, pr };
    }
    if (best) result.push({ exerciseId: e.exerciseId, ...best });
  }
  return result;
}

/** Double progression suggestion based on the last session. */
export function suggestion(last) {
  if (!last) {
    return { type: 'new', weight: null, text: 'First time: pick a weight you can do for 8–12 reps.' };
  }
  const top = Math.max(...last.sets.map((s) => s.w));
  const topSets = last.sets.filter((s) => s.w === top);
  const reps = topSets.map((s) => s.r).join(' / ');
  const allHit = last.sets.every((s) => s.r >= PROGRESSION.repTarget);

  if (top <= 0) {
    return { type: 'same', weight: 0, text: `Bodyweight: beat ${reps} reps.` };
  }
  if (allHit) {
    const w = Math.round((top + PROGRESSION.increment) * 100) / 100;
    return {
      type: 'up',
      weight: w,
      text: `You hit ${PROGRESSION.repTarget}+ reps on every set → go up to ${fmtNum(w)} kg.`,
    };
  }
  return { type: 'same', weight: top, text: `Stay at ${fmtNum(top)} kg and beat ${reps} reps.` };
}

/**
 * Weekly breakdown for an exercise. Week 1 = the Monday-to-Sunday week of the
 * first logged session; weeks without training are skipped.
 */
export function weeklyBreakdown(exerciseId) {
  const hist = exerciseHistory(exerciseId);
  if (!hist.length) return [];
  const firstMonday = mondayOf(parseISO(hist[0].date));
  const weeks = new Map();
  for (const h of hist) {
    const monday = mondayOf(parseISO(h.date));
    const n = Math.floor(daysBetween(firstMonday, monday) / 7) + 1;
    if (!weeks.has(n)) {
      const end = new Date(monday);
      end.setDate(end.getDate() + 6);
      weeks.set(n, { week: n, start: monday, end, sessions: 0, volume: 0, sets: 0, bestSet: null });
    }
    const wk = weeks.get(n);
    wk.sessions += 1;
    wk.sets += h.sets.length;
    wk.volume += volumeOf(h.sets);
    const b = bestSetOf(h.sets);
    if (isBetterSet(b, wk.bestSet)) wk.bestSet = b;
  }
  return [...weeks.values()].sort((a, b) => a.week - b.week);
}

/** Top weight per training day, for the chart. */
export function topWeightSeries(exerciseId) {
  const byDate = new Map();
  for (const h of exerciseHistory(exerciseId)) {
    const top = Math.max(...h.sets.map((s) => s.w));
    byDate.set(h.date, Math.max(byDate.get(h.date) ?? -Infinity, top));
  }
  return [...byDate.entries()].map(([date, y]) => ({ x: parseISO(date).getTime(), y, date }));
}

export function exerciseIdsWithHistory() {
  const ids = new Set();
  for (const w of getState().workouts) for (const e of w.exercises) if (e.sets.length) ids.add(e.exerciseId);
  return ids;
}
