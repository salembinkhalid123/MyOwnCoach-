// Calories page: daily counter, food log, End Day, and history.

import {
  getState, addFood, removeFood, caloriesEatenToday, endCalorieDay, deleteCalorieDay,
} from '../store.js';
import { esc, fmtDate, fmtInt, todayISO } from '../utils.js';
import { confirmDialog, toast } from '../ui.js';

export function mount(host) {
  const el = document.createElement('section');
  el.className = 'page';
  host.replaceChildren(el);
  const rerender = () => mount(host);

  const s = getState();
  const goal = s.settings.calorieGoal;
  const eaten = caloriesEatenToday();
  const remaining = goal - eaten;
  const over = remaining < 0;
  const pct = goal > 0 ? Math.min(100, (eaten / goal) * 100) : 100;
  const { startedOn, entries } = s.caloriesToday;
  const staleDay = startedOn && startedOn !== todayISO();
  const history = [...s.calorieHistory].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  el.innerHTML = `
    <header class="page-header">
      <div><h1>Calories</h1><p class="muted">${fmtDate(startedOn || todayISO())}</p></div>
    </header>

    ${staleDay ? `<div class="notice">This counter started on ${fmtDate(startedOn)}. Tap <strong>End Day</strong> to save it and start fresh.</div>` : ''}

    <div class="card cal-hero">
      <div class="eyebrow">${over ? 'Over goal' : 'Remaining'}</div>
      <div class="cal-big ${over ? 'text-danger' : ''}">${fmtInt(remaining)}</div>
      <div class="muted">kcal</div>
      <div class="progress"><div class="progress-bar ${over ? 'over' : ''}" style="width:${pct}%"></div></div>
      <div class="cal-stats">
        <div><span class="eyebrow">Goal</span><strong>${fmtInt(goal)}</strong></div>
        <div><span class="eyebrow">Eaten</span><strong>${fmtInt(eaten)}</strong></div>
        <div><span class="eyebrow">Remaining</span><strong class="${over ? 'text-danger' : 'text-accent'}">${fmtInt(remaining)}</strong></div>
      </div>
    </div>

    <form class="card food-form" autocomplete="off">
      <div class="card-title">Add food</div>
      <input class="input" name="name" placeholder="Food name (e.g. Chicken & rice)" enterkeyhint="next">
      <div class="row">
        <input class="input" name="kcal" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Calories" enterkeyhint="done">
        <button class="btn btn-primary" type="submit">Add</button>
      </div>
    </form>

    <div class="card">
      <div class="card-title">Today <span class="muted">· ${entries.length} item${entries.length === 1 ? '' : 's'}</span></div>
      ${entries.length ? `<ul class="food-list">
        ${entries.map((f) => `
          <li>
            <span class="food-name">${esc(f.name)}</span>
            <span class="food-kcal">${fmtInt(f.kcal)} kcal</span>
            <button class="icon-btn" data-del="${f.id}" aria-label="Delete ${esc(f.name)}">✕</button>
          </li>`).join('')}
      </ul>` : '<p class="muted">Nothing logged yet today.</p>'}
    </div>

    <button class="btn btn-block btn-lg btn-outline" data-action="end-day">End Day</button>

    <h2 class="section-title">History</h2>
    ${history.length ? `<div class="list">
      ${history.map((d) => {
        const diff = d.eaten - d.goal;
        const isOver = diff > 0;
        return `
          <div class="list-item static">
            <div>
              <div class="list-title">${fmtDate(d.date)}</div>
              <div class="muted small">${fmtInt(d.eaten)} / ${fmtInt(d.goal)} kcal</div>
            </div>
            <div class="list-right">
              <span class="badge ${isOver ? 'badge-danger' : 'badge-success'}">${isOver ? `Over +${fmtInt(diff)}` : `Under −${fmtInt(-diff)}`}</span>
              <button class="icon-btn" data-del-day="${d.id}" aria-label="Delete day">✕</button>
            </div>
          </div>`;
      }).join('')}
    </div>` : '<div class="empty">Days you end will appear here.</div>'}`;

  const form = el.querySelector('.food-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    const kcal = parseInt(form.elements.kcal.value, 10);
    if (!(kcal > 0)) {
      toast('Enter the calories as a number', 'error');
      form.elements.kcal.focus();
      return;
    }
    addFood(name, kcal);
    rerender();
    document.querySelector('.food-form input[name="name"]')?.focus();
  });
  // "Next" on the name field goes to calories.
  form.elements.name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); form.elements.kcal.focus(); }
  });

  el.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) { removeFood(del.dataset.del); rerender(); return; }

    const delDay = e.target.closest('[data-del-day]');
    if (delDay) {
      const ok = await confirmDialog({ title: 'Delete this day from history?', okText: 'Delete', danger: true });
      if (ok) { deleteCalorieDay(delDay.dataset.delDay); rerender(); }
      return;
    }

    if (e.target.closest('[data-action="end-day"]')) {
      const ok = await confirmDialog({
        title: 'End day?',
        message: `Save ${fmtInt(eaten)} kcal to history and reset the counter.`,
        okText: 'End Day',
      });
      if (ok) {
        endCalorieDay();
        toast(over ? `Saved: ${fmtInt(-remaining)} kcal over goal` : `Saved: ${fmtInt(remaining)} kcal under goal`, over ? 'error' : 'success');
        rerender();
      }
    }
  });
}
