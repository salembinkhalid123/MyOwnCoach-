// Single source of truth for all app data, persisted to localStorage.
//
// Data shape:
// {
//   schemaVersion: 1,
//   settings:   { calorieGoal },
//   exercises:  { [exerciseId]: { id, name } }      <- shared library: ONE history per exercise
//   days:       { [dayId]: { id, name, exerciseIds: [] } }
//   rotation:   ['push', 'pull', ...],             <- day ids in rotation order
//   rotationIndex: 0,                              <- index into rotation of the NEXT day
//   workouts:   [{ id, date, dayId, dayName, createdAt, exercises: [{ exerciseId, sets: [{ w, r }] }] }]
//   draft:      null | { dayId, dayName, date, startedAt, exercises: [{ exerciseId, sets: [{ w, r }] }] }
//               (draft set values are kept as raw strings while typing)
//   caloriesToday:  { startedOn: 'YYYY-MM-DD' | null, entries: [{ id, name, kcal }] }
//   calorieHistory: [{ id, date, eaten, goal, entries: n }]
// }

import { DEFAULT_DAYS, ROTATION, DEFAULT_CALORIE_GOAL } from './defaults.js';
import { uid, todayISO, parseNum, isValidISO } from './utils.js';

const STORAGE_KEY = 'myowncoach:data';
export const SCHEMA_VERSION = 1;

let state = null;
const listeners = new Set();

/* ---------- lifecycle ---------- */

function buildDefaultState() {
  const exercises = {};
  const idFor = (name) => {
    const found = Object.values(exercises).find((e) => sameName(e.name, name));
    if (found) return found.id;
    const id = uid();
    exercises[id] = { id, name };
    return id;
  };
  const days = {};
  for (const d of DEFAULT_DAYS) {
    days[d.id] = { id: d.id, name: d.name, exerciseIds: d.exercises.map(idFor) };
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { calorieGoal: DEFAULT_CALORIE_GOAL },
    exercises,
    days,
    rotation: [...ROTATION],
    rotationIndex: 0,
    workouts: [],
    draft: null,
    caloriesToday: { startedOn: null, entries: [] },
    calorieHistory: [],
    lastBackupAt: null,
  };
}

/** Fill in anything missing (older backups, partial data). */
function normalize(data) {
  const base = buildDefaultState();
  const s = { ...base, ...data };
  s.settings = { ...base.settings, ...(data.settings || {}) };
  s.caloriesToday = { ...base.caloriesToday, ...(data.caloriesToday || {}) };
  s.workouts = Array.isArray(s.workouts) ? s.workouts : [];
  s.calorieHistory = Array.isArray(s.calorieHistory) ? s.calorieHistory : [];
  s.rotation = (s.rotation || []).filter((id) => s.days[id]);
  if (!s.rotation.length) s.rotation = Object.keys(s.days);
  if (!(s.rotationIndex >= 0 && s.rotationIndex < s.rotation.length)) s.rotationIndex = 0;
  s.schemaVersion = SCHEMA_VERSION;
  return s;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? normalize(JSON.parse(raw)) : buildDefaultState();
  } catch (err) {
    console.error('Could not load data', err);
    state = buildDefaultState();
  }
  return state;
}

export function getState() {
  return state;
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save data', err);
    listeners.forEach((fn) => fn({ type: 'save-error', err }));
  }
}

export function onStoreEvent(fn) {
  listeners.add(fn);
}

/* ---------- exercise library ---------- */

function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function exerciseName(id) {
  return state.exercises[id]?.name ?? 'Unknown exercise';
}

export function findExerciseByName(name) {
  return Object.values(state.exercises).find((e) => sameName(e.name, name)) || null;
}

/** Same name => same exercise => shared history across days. */
export function getOrCreateExercise(name) {
  const clean = name.trim();
  const found = findExerciseByName(clean);
  if (found) return found.id;
  const id = uid();
  state.exercises[id] = { id, name: clean };
  return id;
}

export function allExercisesSorted() {
  return Object.values(state.exercises).sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------- days & rotation ---------- */

export function nextDayId() {
  return state.rotation[state.rotationIndex] ?? state.rotation[0];
}

export function setNextDay(dayId) {
  const idx = state.rotation.indexOf(dayId);
  if (idx >= 0) {
    state.rotationIndex = idx;
    save();
  }
}

export function addExerciseToDay(dayId, name) {
  const day = state.days[dayId];
  const exId = getOrCreateExercise(name);
  if (day.exerciseIds.includes(exId)) return { ok: false, reason: 'duplicate' };
  day.exerciseIds.push(exId);
  save();
  return { ok: true };
}

export function removeExerciseFromDay(dayId, index) {
  state.days[dayId].exerciseIds.splice(index, 1);
  save();
}

export function moveExerciseInDay(dayId, index, delta) {
  const list = state.days[dayId].exerciseIds;
  const to = index + delta;
  if (to < 0 || to >= list.length) return;
  [list[index], list[to]] = [list[to], list[index]];
  save();
}

/**
 * Rename an exercise everywhere (all days + history, since history stores the id).
 * If the new name already belongs to another exercise, this day's slot is linked
 * to that exercise instead, so they share one history from now on.
 */
export function renameExerciseInDay(dayId, index, newName) {
  const clean = newName.trim();
  const day = state.days[dayId];
  const exId = day.exerciseIds[index];
  const existing = findExerciseByName(clean);
  if (existing && existing.id !== exId) {
    if (day.exerciseIds.includes(existing.id)) return { ok: false, reason: 'duplicate' };
    day.exerciseIds[index] = existing.id;
    save();
    return { ok: true, linked: true };
  }
  state.exercises[exId].name = clean;
  save();
  return { ok: true, linked: false };
}

/* ---------- workout draft ---------- */

/** `exercises` is prepared by the workout page (it knows last-session set counts). */
export function startDraft(dayId, exercises) {
  state.draft = {
    dayId,
    dayName: state.days[dayId].name,
    date: todayISO(),
    startedAt: Date.now(),
    exercises,
  };
  save();
}

export function discardDraft() {
  state.draft = null;
  save();
}

/** Convert raw string sets into numbers. Sets without reps are dropped. */
export function cleanSets(rawSets) {
  return rawSets
    .map((s) => {
      const r = parseInt(s.r, 10);
      const w = parseNum(s.w);
      if (!(r > 0)) return null;
      return { w: isNaN(w) || w < 0 ? 0 : w, r };
    })
    .filter(Boolean);
}

/** Saves the draft as a workout and advances the rotation. Returns the workout (or null if empty). */
export function finishDraft() {
  const d = state.draft;
  const exercises = d.exercises
    .map((ex) => ({ exerciseId: ex.exerciseId, sets: cleanSets(ex.sets) }))
    .filter((ex) => ex.sets.length);
  if (!exercises.length) return null;

  const workout = {
    id: uid(),
    date: d.date,
    dayId: d.dayId,
    dayName: d.dayName,
    createdAt: Date.now(),
    exercises,
  };
  state.workouts.push(workout);

  const idx = state.rotation.indexOf(d.dayId);
  if (idx >= 0) state.rotationIndex = (idx + 1) % state.rotation.length;
  state.draft = null;
  save();
  return workout;
}

/* ---------- saved workouts ---------- */

export function getWorkout(id) {
  return state.workouts.find((w) => w.id === id) || null;
}

export function updateWorkout(updated) {
  const i = state.workouts.findIndex((w) => w.id === updated.id);
  if (i >= 0) {
    state.workouts[i] = updated;
    save();
  }
}

export function deleteWorkout(id) {
  state.workouts = state.workouts.filter((w) => w.id !== id);
  save();
}

/* ---------- calories ---------- */

export function setCalorieGoal(goal) {
  state.settings.calorieGoal = goal;
  save();
}

export function addFood(name, kcal) {
  const c = state.caloriesToday;
  if (!c.startedOn) c.startedOn = todayISO();
  c.entries.push({ id: uid(), name: name.trim() || 'Food', kcal });
  save();
}

export function removeFood(id) {
  const c = state.caloriesToday;
  c.entries = c.entries.filter((e) => e.id !== id);
  save();
}

export function caloriesEatenToday() {
  return state.caloriesToday.entries.reduce((sum, e) => sum + e.kcal, 0);
}

export function endCalorieDay() {
  const c = state.caloriesToday;
  state.calorieHistory.push({
    id: uid(),
    date: c.startedOn || todayISO(),
    eaten: caloriesEatenToday(),
    goal: state.settings.calorieGoal,
    entries: c.entries.length,
  });
  state.caloriesToday = { startedOn: null, entries: [] };
  save();
}

export function deleteCalorieDay(id) {
  state.calorieHistory = state.calorieHistory.filter((d) => d.id !== id);
  save();
}

/* ---------- backup ---------- */

export function exportJSON() {
  state.lastBackupAt = Date.now();
  save();
  return JSON.stringify({ app: 'MyOwnCoach', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

/** Validates and replaces all data. Throws an Error with a readable message if invalid. */
export function importJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const data = parsed && parsed.data ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || !data.exercises || !data.days || !Array.isArray(data.workouts)) {
    throw new Error('That file does not look like a MyOwnCoach backup.');
  }
  for (const w of data.workouts) {
    if (!w.id || !isValidISO(w.date) || !Array.isArray(w.exercises)) {
      throw new Error('The backup contains a damaged workout entry.');
    }
  }
  state = normalize(data);
  save();
}

export function resetAll() {
  state = buildDefaultState();
  save();
}
