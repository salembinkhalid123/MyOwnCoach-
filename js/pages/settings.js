// Settings: calorie goal, rotation, exercises per day, backup/restore, reset.

import {
  getState, setCalorieGoal, nextDayId, setNextDay, exerciseName, allExercisesSorted,
  addExerciseToDay, removeExerciseFromDay, moveExerciseInDay, renameExerciseInDay,
  exportJSON, importJSON, resetAll,
} from '../store.js';
import { APP_VERSION } from '../defaults.js';
import { esc, todayISO } from '../utils.js';
import { confirmDialog, promptDialog, toast } from '../ui.js';

let editDayId = null;

export function mount(host) {
  const el = document.createElement('section');
  el.className = 'page';
  host.replaceChildren(el);
  const rerender = () => mount(host);

  const s = getState();
  if (!s.days[editDayId]) editDayId = s.rotation[0];
  const day = s.days[editDayId];
  const lastBackup = s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'never';

  el.innerHTML = `
    <header class="page-header"><div><h1>Settings</h1></div></header>

    <h2 class="section-title">Calories</h2>
    <form class="card" data-form="goal">
      <label class="field-label" for="goal">Daily calorie goal (kcal)</label>
      <div class="row">
        <input id="goal" class="input" type="text" inputmode="numeric" pattern="[0-9]*" value="${s.settings.calorieGoal}">
        <button class="btn btn-primary" type="submit">Save</button>
      </div>
    </form>

    <h2 class="section-title">Rotation</h2>
    <div class="card">
      <label class="field-label" for="next-day">Next workout day</label>
      <select id="next-day" class="input select">
        ${s.rotation.map((id) => `<option value="${id}" ${id === nextDayId() ? 'selected' : ''}>${esc(s.days[id].name)}</option>`).join('')}
      </select>
      <p class="hint">Order: ${s.rotation.map((id) => esc(s.days[id].name)).join(' → ')} → repeat</p>
    </div>

    <h2 class="section-title">Exercises per day</h2>
    <div class="segmented segmented-5">
      ${s.rotation.map((id) => `<button class="${id === editDayId ? 'active' : ''}" data-edit-day="${id}">${esc(s.days[id].name)}</button>`).join('')}
    </div>
    <div class="card">
      ${day.exerciseIds.length ? `<ul class="manage-list">
        ${day.exerciseIds.map((id, i) => `
          <li data-index="${i}">
            <span class="manage-name">${esc(exerciseName(id))}</span>
            <span class="manage-actions">
              <button class="icon-btn" data-ex-action="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button>
              <button class="icon-btn" data-ex-action="down" ${i === day.exerciseIds.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>
              <button class="icon-btn" data-ex-action="rename" aria-label="Rename">✎</button>
              <button class="icon-btn danger" data-ex-action="remove" aria-label="Remove">✕</button>
            </span>
          </li>`).join('')}
      </ul>` : '<p class="muted">No exercises on this day.</p>'}
      <form class="row add-row" data-form="add-ex">
        <input class="input" list="settings-ex-list" placeholder="Add exercise to ${esc(day.name)}" autocomplete="off" enterkeyhint="done">
        <button class="btn" type="submit">Add</button>
      </form>
      <datalist id="settings-ex-list">${allExercisesSorted().map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist>
      <p class="hint">Exercises with the same name share one history across all days. Renaming changes the name everywhere, including past workouts.</p>
    </div>

    <h2 class="section-title">Backup</h2>
    <div class="card">
      <p class="muted small">All data lives only on this phone. Export a backup regularly (last: ${lastBackup}).</p>
      <button class="btn btn-primary btn-block" data-action="export">Export backup</button>
      <button class="btn btn-block" data-action="import">Import backup</button>
      <input type="file" accept="application/json,.json" data-import hidden>
    </div>

    <h2 class="section-title">Danger zone</h2>
    <div class="card">
      <button class="btn btn-danger-ghost btn-block" data-action="reset">Reset all data</button>
    </div>

    <p class="footer-note">MyOwnCoach v${APP_VERSION} · Works offline · ${s.workouts.length} workouts saved</p>`;

  /* --- calorie goal --- */
  el.querySelector('[data-form="goal"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = parseInt(e.target.querySelector('input').value, 10);
    if (!(v > 0 && v < 20000)) { toast('Enter a goal between 1 and 20000', 'error'); return; }
    setCalorieGoal(v);
    e.target.querySelector('input').blur();
    toast(`Daily goal set to ${v} kcal`, 'success');
  });

  /* --- rotation --- */
  el.querySelector('#next-day').addEventListener('change', (e) => {
    setNextDay(e.target.value);
    toast(`Next workout: ${s.days[e.target.value].name}`, 'success');
  });

  /* --- exercises --- */
  el.querySelector('[data-form="add-ex"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const name = input.value.trim();
    if (!name) return;
    const res = addExerciseToDay(editDayId, name);
    if (!res.ok) { toast(`${name} is already on ${day.name}`, 'error'); return; }
    rerender();
    toast(`Added to ${day.name}`, 'success');
  });

  el.addEventListener('click', async (e) => {
    const dayBtn = e.target.closest('[data-edit-day]');
    if (dayBtn) { editDayId = dayBtn.dataset.editDay; rerender(); return; }

    const exBtn = e.target.closest('[data-ex-action]');
    if (exBtn) {
      const i = +exBtn.closest('[data-index]').dataset.index;
      const name = exerciseName(day.exerciseIds[i]);
      const act = exBtn.dataset.exAction;
      if (act === 'up' || act === 'down') {
        moveExerciseInDay(editDayId, i, act === 'up' ? -1 : 1);
        rerender();
      } else if (act === 'rename') {
        const newName = await promptDialog({ title: 'Rename exercise', value: name });
        if (!newName || newName === name) return;
        const res = renameExerciseInDay(editDayId, i, newName);
        if (!res.ok) toast(`${newName} is already on ${day.name}`, 'error');
        else toast(res.linked ? `Linked to existing "${newName}" history` : 'Renamed', 'success');
        rerender();
      } else if (act === 'remove') {
        const ok = await confirmDialog({
          title: `Remove ${name} from ${day.name}?`,
          message: 'Your logged history for this exercise is kept.',
          okText: 'Remove', danger: true,
        });
        if (ok) { removeExerciseFromDay(editDayId, i); rerender(); }
      }
      return;
    }

    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'export') await exportBackup(rerender);
    else if (action === 'import') el.querySelector('[data-import]').click();
    else if (action === 'reset') {
      const ok = await confirmDialog({
        title: 'Reset ALL data?',
        message: 'Deletes every workout, calorie day and custom exercise on this phone. Export a backup first!',
        okText: 'Reset everything', danger: true,
      });
      if (!ok) return;
      const sure = await confirmDialog({ title: 'Are you absolutely sure?', okText: 'Yes, reset', danger: true });
      if (sure) { resetAll(); toast('All data reset'); rerender(); }
    }
  });

  /* --- import --- */
  el.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const ok = await confirmDialog({
      title: 'Restore this backup?',
      message: 'This replaces ALL current data on this phone with the backup.',
      okText: 'Restore', danger: true,
    });
    if (!ok) return;
    try {
      importJSON(text);
      toast('Backup restored', 'success');
      rerender();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function exportBackup(rerender) {
  const json = exportJSON();
  const filename = `myowncoach-backup-${todayISO()}.json`;
  const blob = new Blob([json], { type: 'application/json' });

  // On phones the share sheet is the most reliable way to save a file ("Save to Files", Drive, etc.).
  try {
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'MyOwnCoach backup' });
      rerender();
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return; // user closed the share sheet
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded', 'success');
  rerender();
}
