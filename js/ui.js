// Reusable UI pieces: toasts, confirm/prompt dialogs, full-screen sheets.
// Open dialogs push a history entry so the Android back button closes them.

import { esc } from './utils.js';

/* ---------- toast ---------- */

let toastTimer = null;
export function toast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div class="toast toast-${type}" role="status">${esc(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 2600);
}

/* ---------- modal stack + back button ---------- */

const stack = [];

window.addEventListener('popstate', () => {
  const top = stack.pop();
  if (top) top.teardown();
});

function openLayer(el, onClosed) {
  document.body.appendChild(el);
  document.body.classList.add('no-scroll');
  const layer = {
    teardown() {
      el.remove();
      if (!stack.length) document.body.classList.remove('no-scroll');
      onClosed?.();
    },
  };
  stack.push(layer);
  history.pushState({ layer: stack.length }, '');
  return () => {
    // Closing goes through history so the back stack stays in sync.
    if (stack.includes(layer)) history.back();
  };
}

/* ---------- dialogs ---------- */

export function confirmDialog({ title, message = '', okText = 'OK', cancelText = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2 class="modal-title">${esc(title)}</h2>
        ${message ? `<p class="modal-text">${esc(message)}</p>` : ''}
        <div class="modal-actions">
          ${cancelText ? `<button class="btn" data-r="0">${esc(cancelText)}</button>` : ''}
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(okText)}</button>
        </div>
      </div>`;
    const close = openLayer(el, () => resolve(result));
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-r]');
      if (btn) { result = btn.dataset.r === '1'; close(); } else if (e.target === el) close();
    });
  });
}

export function alertDialog({ title, message = '', okText = 'OK', html = '' }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2 class="modal-title">${esc(title)}</h2>
        ${message ? `<p class="modal-text">${esc(message)}</p>` : ''}
        ${html}
        <div class="modal-actions"><button class="btn btn-primary" data-ok>${esc(okText)}</button></div>
      </div>`;
    const close = openLayer(el, () => resolve());
    el.addEventListener('click', (e) => { if (e.target.closest('[data-ok]') || e.target === el) close(); });
  });
}

export function promptDialog({ title, value = '', placeholder = '', okText = 'Save', inputmode = 'text' }) {
  return new Promise((resolve) => {
    let result = null;
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.innerHTML = `
      <form class="modal" role="dialog" aria-modal="true">
        <h2 class="modal-title">${esc(title)}</h2>
        <input class="input" name="v" value="${esc(value)}" placeholder="${esc(placeholder)}"
               inputmode="${inputmode}" autocomplete="off" enterkeyhint="done">
        <div class="modal-actions">
          <button type="button" class="btn" data-cancel>Cancel</button>
          <button type="submit" class="btn btn-primary">${esc(okText)}</button>
        </div>
      </form>`;
    const close = openLayer(el, () => resolve(result));
    const form = el.querySelector('form');
    const input = form.elements.v;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      result = input.value.trim() || null;
      close();
    });
    el.addEventListener('click', (e) => { if (e.target.closest('[data-cancel]') || e.target === el) close(); });
    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}

/**
 * Full-screen sheet. `build(body, close)` fills the body element.
 * Returns the close function.
 */
export function openSheet({ title, build, onClosed }) {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `
    <div class="sheet-header">
      <button class="btn btn-ghost btn-sm" data-close>Close</button>
      <h2 class="sheet-title">${esc(title)}</h2>
      <span class="sheet-spacer"></span>
    </div>
    <div class="sheet-body"></div>`;
  const close = openLayer(el, onClosed);
  el.querySelector('[data-close]').addEventListener('click', close);
  build(el.querySelector('.sheet-body'), close);
  return close;
}
