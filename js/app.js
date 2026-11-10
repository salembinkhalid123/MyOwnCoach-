// App entry: load data, hash router for the bottom tabs, service worker.

import { loadState, onStoreEvent } from './store.js';
import { toast } from './ui.js';
import * as workout from './pages/workout.js';
import * as progress from './pages/progress.js';
import * as calories from './pages/calories.js';
import * as settings from './pages/settings.js';

const routes = { workout, progress, calories, settings };
const DEFAULT_ROUTE = 'workout';

loadState();
onStoreEvent((e) => {
  if (e.type === 'save-error') toast('Could not save! Storage may be full — export a backup.', 'error');
});

const host = document.getElementById('app');
let current = null;

function currentRoute() {
  const name = location.hash.replace('#', '');
  return routes[name] ? name : DEFAULT_ROUTE;
}

function render() {
  const name = currentRoute();
  if (name !== current) window.scrollTo(0, 0);
  current = name;
  routes[name].mount(host);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === name);
    a.setAttribute('aria-current', a.dataset.route === name ? 'page' : 'false');
  });
}

// Tapping the active tab again re-renders it (e.g. returns the Progress page to the top).
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (a && a.dataset.route === current) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

window.addEventListener('hashchange', render);
render();

// Ask the browser not to evict our data (best effort, mostly Android/Chrome).
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW registration failed', err));
  });
}
