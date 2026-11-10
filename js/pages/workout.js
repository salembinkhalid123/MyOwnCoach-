// Workout page: pick a day (next in rotation is pre-selected), log sets, finish.

import {
  getState, save, nextDayId, exerciseName, startDraft, discardDraft, finishDraft,
  getOrCreateExercise, allExercisesSorted,
} from '../store.js';
import { lastSession, suggestion, records, prFor, prsInWorkout } from '../logic.js';
import { DEFAULT_SET_COUNT } from '../defaults.js';
import { esc, fmtDate, fmtNum, todayISO, parseNum } from '../utils.js';
import { confirmDialog, alertDialog, toast } from '../ui.js';
import { setsTableHtml, setChipsHtml, prBadgeHtml, bindSetsEditor } from '../components/setsEditor.js';

let selectedDayId = null;

export function mount(host) {
  const el = document.createElement('section');
  el.className = 'page';
  host.replaceChildren(el);
  const rerender = () => mount(host);
  if (getState().draft) mountDraft(el, rerender);
  else mountPicker(el, rerender);
}

/* ---------------- day picker ---------------- */

function mountPicker(el, rerender) {
  const s = getState();
  const nextId = nextDayId();
  if (!s.days[selectedDayId]) selectedDayId = nextId;
  const day = s.days[selectedDayId];

  el.innerHTML = `
    <header class="page-header">
      <div><h1>Workout</h1><p class="muted">${fmtDate(todayISO())}</p></div>
    </header>

    <div class="card hero">
      <div class="eyebrow">Next in rotation</div>
      <div class="hero-title">${esc(s.days[nextId].name)}</div>
      <div class="rotation">
        ${s.rotation.map((id) => `<span class="rot-step ${id === nextId ? 'active' : ''}">${esc(s.days[id].name)}</span>`).join('<span class="rot-arrow">›</span>')}
      </div>
    </div>

    <h2 class="section-title">Pick a day</h2>
    <div class="day-grid">
      ${s.rotation.map((id) => `
        <button class="day-btn ${id === selectedDayId ? 'selected' : ''}" data-day="${id}">
          ${esc(s.days[id].name)}${id === nextId ? '<small>Next</small>' : ''}
        </button>`).join('')}
    </div>

    <div class="card">
      <div class="card-title">${esc(day.name)} <span class="muted">· ${day.exerciseIds.length} exercises</span></div>
      ${day.exerciseIds.length ? `<ul class="preview-list">
        ${day.exerciseIds.map((id) => {
          const last = lastSession(id);
          return `<li><span>${esc(exerciseName(id))}</span><span class="muted small">${last ? `Last: ${fmtDate(last.date, { weekday: false })}` : 'New'}</span></li>`;
        }).join('')}
      </ul>` : '<p class="muted">No exercises yet. Add some in Settings, or add them during the workout.</p>'}
    </div>

    <button class="btn btn-primary btn-block btn-lg" data-action="start">Start ${esc(day.name)} workout</button>`;

  el.addEventListener('click', (e) => {
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) { selectedDayId = dayBtn.dataset.day; rerender(); return; }
    if (e.target.closest('[data-action="start"]')) {
      startDraft(selectedDayId, day.exerciseIds.map(newDraftExercise));
      window.scrollTo(0, 0);
      rerender();
    }
  });
}

/** Start with as many sets as last time (or a default), empty values. */
function newDraftExercise(exerciseId) {
  const last = lastSession(exerciseId);
  const count = last ? last.sets.length : DEFAULT_SET_COUNT;
  return { exerciseId, sets: Array.from({ length: count }, () => ({ w: '', r: '' })) };
}

/* ---------------- live workout ---------------- */

function mountDraft(el, rerender) {
  const s = getState();
  const d = s.draft;

  // Per-exercise context computed once per render (history doesn't change mid-workout).
  const ctx = d.exercises.map((ex) => {
    const last = lastSession(ex.exerciseId);
    return { last, sug: suggestion(last), rec: records(ex.exerciseId) };
  });

  const effectiveWeight = (i, set) => {
    const w = parseNum(set.w);
    return isNaN(w) ? (ctx[i].sug.weight ?? 0) : w;
  };
  const prOf = (i, set) => prFor(ctx[i].rec, effectiveWeight(i, set), parseInt(set.r, 10));

  el.innerHTML = `
    <header class="page-header">
      <div><h1>${esc(d.dayName)}</h1><p class="muted">${fmtDate(d.date)} · in progress</p></div>
      <button class="btn btn-ghost btn-sm" data-action="discard">Discard</button>
    </header>
    <p class="hint">Grey numbers are suggestions. Leave kg empty to use the suggested weight.</p>

    <div class="ex-list">
      ${d.exercises.map((ex, i) => exerciseCardHtml(ex, i, ctx[i], prOf)).join('')}
    </div>

    <form class="card add-ex" data-form="add-exercise">
      <label class="field-label" for="add-ex-input">Add an exercise to this session</label>
      <div class="row">
        <input id="add-ex-input" class="input" list="ex-datalist" placeholder="Exercise name" autocomplete="off" enterkeyhint="done">
        <button class="btn" type="submit">Add</button>
      </div>
      <datalist id="ex-datalist">${allExercisesSorted().map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist>
    </form>

    <button class="btn btn-primary btn-block btn-lg" data-action="finish">Finish workout</button>`;

  bindSetsEditor(el, {
    getExercises: () => d.exercises,
    onInput(i, j, _field, row) {
      save();
      row.querySelector('.pr-slot').innerHTML = prBadgeHtml(prOf(i, d.exercises[i].sets[j]));
    },
    onStructureChange() { save(); rerender(); },
    async onRemoveExercise(i) {
      const ok = await confirmDialog({
        title: `Remove ${exerciseName(d.exercises[i].exerciseId)}?`,
        message: 'Only removes it from this session.',
        okText: 'Remove', danger: true,
      });
      if (ok) { d.exercises.splice(i, 1); save(); rerender(); }
    },
  });

  el.querySelector('[data-form="add-exercise"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = e.target.querySelector('input').value.trim();
    if (!name) return;
    d.exercises.push(newDraftExercise(getOrCreateExercise(name)));
    save();
    rerender();
  });

  el.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'discard') {
      const ok = await confirmDialog({
        title: 'Discard this workout?', message: 'Everything you logged in this session will be lost.',
        okText: 'Discard', danger: true,
      });
      if (ok) { discardDraft(); rerender(); }
    } else if (action === 'finish') {
      await finish(d, effectiveWeight, rerender);
    }
  });
}

function exerciseCardHtml(ex, i, { last, sug }, prOf) {
  return `
    <div class="card ex-card" data-ex="${i}">
      <div class="ex-head">
        <h3>${esc(exerciseName(ex.exerciseId))}</h3>
        <button class="icon-btn" data-action="remove-exercise" aria-label="Remove exercise">✕</button>
      </div>
      ${last ? `
        <div class="last">
          <div class="last-label">Last time · ${fmtDate(last.date)}${last.dayName ? ` · ${esc(last.dayName)}` : ''}</div>
          <div class="chips">${setChipsHtml(last.sets)}</div>
        </div>` : ''}
      <div class="suggestion suggestion-${sug.type}">💡 ${esc(sug.text)}</div>
      ${setsTableHtml(ex.sets, (j) => ({
        wPlaceholder: sug.weight != null ? fmtNum(sug.weight) : 'kg',
        rPlaceholder: last?.sets[j] ? String(last.sets[j].r) : 'reps',
        badge: prBadgeHtml(prOf(i, ex.sets[j])),
      }))}
    </div>`;
}

async function finish(d, effectiveWeight, rerender) {
  const logged = d.exercises.reduce((n, ex) => n + ex.sets.filter((st) => parseInt(st.r, 10) > 0).length, 0);
  if (!logged) {
    await alertDialog({ title: 'Nothing logged yet', message: 'Enter reps for at least one set before finishing.' });
    return;
  }
  const ok = await confirmDialog({
    title: 'Finish workout?',
    message: `${logged} set${logged === 1 ? '' : 's'} will be saved. Sets without reps are skipped.`,
    okText: 'Finish',
  });
  if (!ok) return;

  // Fill empty weights with the suggested weight shown as placeholder.
  d.exercises.forEach((ex, i) => ex.sets.forEach((st) => {
    if (st.w === '' && parseInt(st.r, 10) > 0) st.w = String(effectiveWeight(i, st));
  }));

  const workout = finishDraft();
  if (!workout) return;
  const prs = prsInWorkout(workout);
  window.scrollTo(0, 0);
  rerender();

  const s = getState();
  const nextName = s.days[nextDayId()].name;
  if (prs.length) {
    await alertDialog({
      title: `🏆 ${prs.length} new PR${prs.length > 1 ? 's' : ''}!`,
      message: `Workout saved. Next up: ${nextName}.`,
      html: `<ul class="pr-list">${prs.map((p) => `
        <li><strong>${esc(exerciseName(p.exerciseId))}</strong>
        <span>${fmtNum(p.set.w)} kg × ${p.set.r} · ${esc(p.pr.label)}</span></li>`).join('')}</ul>`,
      okText: 'Nice!',
    });
  } else {
    toast(`Workout saved. Next up: ${nextName}`, 'success');
  }
}
