// Markup + event handling for an exercise card with editable sets.
// Used both by the live workout and by the "edit past workout" sheet.
//
// Each exercise object: { exerciseId, sets: [{ w, r }] } (values may be strings while editing).

import { esc, fmtNum } from '../utils.js';

export function setRowHtml(set, j, { wPlaceholder = '', rPlaceholder = '', badge = '' } = {}) {
  return `
    <div class="set-row" data-set="${j}">
      <span class="set-num">${j + 1}</span>
      <input class="input input-num" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off"
             data-field="w" value="${esc(set.w ?? '')}" placeholder="${esc(wPlaceholder)}" aria-label="Set ${j + 1} weight in kg">
      <input class="input input-num" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="next" autocomplete="off"
             data-field="r" value="${esc(set.r ?? '')}" placeholder="${esc(rPlaceholder)}" aria-label="Set ${j + 1} reps">
      <button class="icon-btn" data-action="remove-set" aria-label="Remove set ${j + 1}">✕</button>
      <div class="pr-slot">${badge}</div>
    </div>`;
}

export function prBadgeHtml(pr) {
  return pr ? `<span class="pr-badge">🏆 ${esc(pr.label)}</span>` : '';
}

export function setsTableHtml(sets, rowOpts = () => ({})) {
  return `
    <div class="sets">
      <div class="set-row set-head"><span>Set</span><span>kg</span><span>Reps</span><span></span></div>
      ${sets.map((s, j) => setRowHtml(s, j, rowOpts(j))).join('')}
    </div>
    <button class="btn btn-ghost btn-block" data-action="add-set">+ Add set</button>`;
}

export function setChipsHtml(sets) {
  return sets.map((s) => `<span class="chip">${fmtNum(s.w)} × ${s.r}</span>`).join('');
}

/**
 * Wires up add/remove set + typing for a container of exercise cards
 * (each card has data-ex="<index>").
 *
 * handlers: {
 *   getExercises(): array,
 *   onInput(exIndex, setIndex, field, rowEl),   // after the value is written
 *   onStructureChange(),                        // after add/remove (caller re-renders)
 *   onRemoveExercise(exIndex),
 * }
 */
export function bindSetsEditor(container, handlers) {
  container.addEventListener('input', (e) => {
    const input = e.target.closest('[data-field]');
    if (!input) return;
    const card = input.closest('[data-ex]');
    const row = input.closest('[data-set]');
    const ex = handlers.getExercises()[+card.dataset.ex];
    const set = ex.sets[+row.dataset.set];
    set[input.dataset.field] = input.value;
    handlers.onInput?.(+card.dataset.ex, +row.dataset.set, input.dataset.field, row);
  });

  // "Next" on the keyboard jumps kg -> reps -> next set's kg.
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const input = e.target.closest('[data-field]');
    if (!input) return;
    e.preventDefault();
    const all = [...container.querySelectorAll('[data-field]')];
    const next = all[all.indexOf(input) + 1];
    if (next) next.focus(); else input.blur();
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('[data-ex]');
    if (!card) return;
    const exIndex = +card.dataset.ex;
    const ex = handlers.getExercises()[exIndex];
    if (btn.dataset.action === 'add-set') {
      const prev = ex.sets[ex.sets.length - 1];
      ex.sets.push({ w: prev ? prev.w : '', r: '' });
      handlers.onStructureChange();
      // Focus the new set's reps (weight is copied from the previous set).
      requestAnimationFrame(() => {
        const rows = container.querySelectorAll(`[data-ex="${exIndex}"] .set-row:not(.set-head)`);
        rows[rows.length - 1]?.querySelector(prev && prev.w !== '' ? '[data-field="r"]' : '[data-field="w"]')?.focus();
      });
    } else if (btn.dataset.action === 'remove-set') {
      ex.sets.splice(+btn.closest('[data-set]').dataset.set, 1);
      handlers.onStructureChange();
    } else if (btn.dataset.action === 'remove-exercise') {
      handlers.onRemoveExercise?.(exIndex);
    }
  });
}
