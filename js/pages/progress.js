// Progress page: per-exercise stats (weekly table + chart) and full workout history.

import {
  getState, exerciseName, allExercisesSorted, getWorkout, updateWorkout, deleteWorkout,
  cleanSets, getOrCreateExercise,
} from '../store.js';
import {
  weeklyBreakdown, topWeightSeries, records, exerciseIdsWithHistory, workoutsNewestFirst, volumeOf,
} from '../logic.js';
import { esc, fmtDate, fmtNum, fmtInt, fmtShortDate, deepClone, isValidISO } from '../utils.js';
import { drawLineChart } from '../components/chart.js';
import { setsTableHtml, bindSetsEditor } from '../components/setsEditor.js';
import { confirmDialog, openSheet, toast } from '../ui.js';

const VIEW_KEY = 'myowncoach:progressView';
let view = 'exercise';      // 'exercise' | 'history'
let selectedExerciseId = null;

try { view = localStorage.getItem(VIEW_KEY) || view; } catch { /* ignore */ }

export function mount(host) {
  const el = document.createElement('section');
  el.className = 'page';
  host.replaceChildren(el);
  const rerender = () => mount(host);

  el.innerHTML = `
    <header class="page-header"><div><h1>Progress</h1></div></header>
    <div class="segmented" role="tablist">
      <button class="${view === 'exercise' ? 'active' : ''}" data-view="exercise">Exercises</button>
      <button class="${view === 'history' ? 'active' : ''}" data-view="history">History</button>
    </div>
    <div data-body></div>`;

  el.querySelector('.segmented').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    view = b.dataset.view;
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ }
    rerender();
  });

  const body = el.querySelector('[data-body]');
  if (view === 'history') renderHistory(body, rerender);
  else renderExercise(body, rerender);
}

/* ---------------- per exercise ---------------- */

function renderExercise(body, rerender) {
  const withHistory = exerciseIdsWithHistory();
  const all = allExercisesSorted();
  const logged = all.filter((x) => withHistory.has(x.id));
  const others = all.filter((x) => !withHistory.has(x.id));

  if (!getState().exercises[selectedExerciseId]) selectedExerciseId = (logged[0] || all[0])?.id ?? null;
  if (!selectedExerciseId) {
    body.innerHTML = '<div class="empty">No exercises yet.</div>';
    return;
  }

  const rec = records(selectedExerciseId);
  const weeks = weeklyBreakdown(selectedExerciseId);
  const series = topWeightSeries(selectedExerciseId);

  body.innerHTML = `
    <label class="field-label" for="ex-select">Exercise</label>
    <select id="ex-select" class="input select">
      ${logged.length ? `<optgroup label="Logged">${logged.map(opt).join('')}</optgroup>` : ''}
      ${others.length ? `<optgroup label="Not logged yet">${others.map(opt).join('')}</optgroup>` : ''}
    </select>

    ${rec ? `
      <div class="stat-grid">
        <div class="stat"><span class="eyebrow">Best weight</span><strong>${fmtNum(rec.bestW)} kg</strong></div>
        <div class="stat"><span class="eyebrow">Best set</span><strong>${fmtNum(rec.bestSet.w)} × ${rec.bestSet.r}</strong></div>
        <div class="stat"><span class="eyebrow">Sessions</span><strong>${rec.sessions}</strong></div>
      </div>

      <div class="card">
        <div class="card-title">Top weight over time</div>
        <canvas class="chart" aria-label="Top weight chart"></canvas>
      </div>

      <div class="card">
        <div class="card-title">Weekly breakdown</div>
        <div class="table">
          <div class="tr th"><span>Week</span><span>Best set</span><span>Volume</span></div>
          ${weeks.slice().reverse().map((w) => `
            <div class="tr">
              <span><strong>Week ${w.week}</strong><small class="muted">${fmtShortDate(w.start)} – ${fmtShortDate(w.end)} · ${w.sessions}×</small></span>
              <span>${fmtNum(w.bestSet.w)} kg × ${w.bestSet.r}</span>
              <span>${fmtInt(w.volume)} kg</span>
            </div>`).join('')}
        </div>
        <p class="hint">Volume = weight × reps summed over every set that week.</p>
      </div>` : '<div class="empty">No sessions logged for this exercise yet.</div>'}`;

  body.querySelector('#ex-select').addEventListener('change', (e) => {
    selectedExerciseId = e.target.value;
    rerender();
  });

  const canvas = body.querySelector('canvas');
  if (canvas) {
    const draw = () => drawLineChart(canvas, series);
    requestAnimationFrame(draw);
    new ResizeObserver(draw).observe(canvas);
  }
}

function opt(x) {
  return `<option value="${x.id}" ${x.id === selectedExerciseId ? 'selected' : ''}>${esc(x.name)}</option>`;
}

/* ---------------- history ---------------- */

function renderHistory(body, rerender) {
  const list = workoutsNewestFirst();
  if (!list.length) {
    body.innerHTML = '<div class="empty">No workouts yet. Finish a workout and it will show up here.</div>';
    return;
  }
  body.innerHTML = `
    <div class="list">
      ${list.map((w) => {
        const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
        const vol = w.exercises.reduce((n, e) => n + volumeOf(e.sets), 0);
        return `
          <button class="list-item" data-open="${w.id}">
            <div>
              <div class="list-title">${esc(w.dayName)}</div>
              <div class="muted small">${fmtDate(w.date)} · ${w.exercises.length} exercises · ${sets} sets</div>
            </div>
            <div class="list-right"><strong>${fmtInt(vol)}</strong><small class="muted">kg vol.</small></div>
          </button>`;
      }).join('')}
    </div>`;

  body.addEventListener('click', (e) => {
    const item = e.target.closest('[data-open]');
    if (item) openWorkoutEditor(item.dataset.open, rerender);
  });
}

/** Full-screen editor for a saved workout: change date, sets, exercises; or delete it. */
function openWorkoutEditor(workoutId, rerender) {
  const original = getWorkout(workoutId);
  if (!original) return;
  const draft = deepClone(original);
  draft.exercises.forEach((e) => e.sets.forEach((s) => { s.w = fmtNum(s.w); s.r = String(s.r); }));

  openSheet({
    title: `${original.dayName} · ${fmtDate(original.date, { weekday: false })}`,
    onClosed: rerender,
    build(body, close) {
      const paint = () => {
        body.innerHTML = `
          <label class="field-label" for="w-date">Date</label>
          <input id="w-date" class="input" type="date" value="${draft.date}">
          <div class="ex-list">
            ${draft.exercises.map((ex, i) => `
              <div class="card ex-card" data-ex="${i}">
                <div class="ex-head">
                  <h3>${esc(exerciseName(ex.exerciseId))}</h3>
                  <button class="icon-btn" data-action="remove-exercise" aria-label="Remove exercise">✕</button>
                </div>
                ${setsTableHtml(ex.sets)}
              </div>`).join('')}
          </div>
          <form class="card add-ex" data-form="add">
            <label class="field-label" for="edit-add">Add exercise</label>
            <div class="row">
              <input id="edit-add" class="input" list="edit-datalist" placeholder="Exercise name" autocomplete="off">
              <button class="btn" type="submit">Add</button>
            </div>
            <datalist id="edit-datalist">${allExercisesSorted().map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist>
          </form>
          <button class="btn btn-primary btn-block btn-lg" data-action="save">Save changes</button>
          <button class="btn btn-danger-ghost btn-block" data-action="delete">Delete workout</button>`;

        body.querySelector('#w-date').addEventListener('change', (e) => { draft.date = e.target.value; });
        body.querySelector('[data-form="add"]').addEventListener('submit', (e) => {
          e.preventDefault();
          const name = e.target.querySelector('input').value.trim();
          if (!name) return;
          draft.exercises.push({ exerciseId: getOrCreateExercise(name), sets: [{ w: '', r: '' }] });
          paint();
        });
      };
      paint();

      bindSetsEditor(body, {
        getExercises: () => draft.exercises,
        onStructureChange: paint,
        async onRemoveExercise(i) {
          const ok = await confirmDialog({
            title: `Remove ${exerciseName(draft.exercises[i].exerciseId)}?`,
            message: 'It will be removed from this workout when you save.', okText: 'Remove', danger: true,
          });
          if (ok) { draft.exercises.splice(i, 1); paint(); }
        },
      });

      body.addEventListener('click', async (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'save') {
          if (!isValidISO(draft.date)) { toast('Please pick a valid date', 'error'); return; }
          const exercises = draft.exercises
            .map((ex) => ({ exerciseId: ex.exerciseId, sets: cleanSets(ex.sets) }))
            .filter((ex) => ex.sets.length);
          if (!exercises.length) { toast('Add at least one set with reps, or delete the workout', 'error'); return; }
          updateWorkout({ ...original, date: draft.date, exercises });
          toast('Workout updated', 'success');
          close();
        } else if (action === 'delete') {
          const ok = await confirmDialog({
            title: 'Delete this workout?', message: 'This cannot be undone.', okText: 'Delete', danger: true,
          });
          if (ok) { deleteWorkout(workoutId); toast('Workout deleted'); close(); }
        }
      });
    },
  });
}
