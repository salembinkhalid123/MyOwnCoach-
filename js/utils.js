// Small, dependency-free helpers.

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Local date as YYYY-MM-DD (not UTC, so late-night workouts land on the right day). */
export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isValidISO(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) && !isNaN(parseISO(iso).getTime());
}

/** "Tue, Nov 10" (adds the year when it is not the current year). */
export function fmtDate(iso, { weekday = true } = {}) {
  const d = parseISO(iso);
  const opts = { day: 'numeric', month: 'short' };
  if (weekday) opts.weekday = 'short';
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

export function fmtShortDate(date) {
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/** Format a number without useless decimals: 60 -> "60", 62.5 -> "62.5". */
export function fmtNum(n) {
  if (n == null || isNaN(n)) return '';
  return String(Math.round(n * 100) / 100);
}

export function fmtInt(n) {
  return Math.round(n).toLocaleString('en-US');
}

/** Accepts "62.5" or "62,5" (some phone keyboards use a comma). */
export function parseNum(v) {
  if (v == null || v === '') return NaN;
  return parseFloat(String(v).replace(',', '.'));
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Monday 00:00 of the week containing `date`. */
export function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
