// Tiny dependency-free line chart on <canvas> (crisp on retina screens).

import { fmtNum, fmtShortDate } from '../utils.js';

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function yTicks(min, max, count = 4) {
  if (min === max) { min -= 5; max += 5; }
  const step = niceStep((max - min) / count);
  const lo = Math.max(0, Math.floor(min / step) * step);
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** points: [{ x: timestamp, y: number }] sorted by x. */
export function drawLineChart(canvas, points, { unit = 'kg' } = {}) {
  const css = getComputedStyle(document.documentElement);
  const color = (v) => css.getPropertyValue(v).trim();
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (!W || !H) return;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = '12px system-ui, -apple-system, sans-serif';

  if (!points.length) {
    ctx.fillStyle = color('--text-dim');
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', W / 2, H / 2);
    return;
  }

  const pad = { l: 42, r: 16, t: 22, b: 26 };
  const ys = points.map((p) => p.y);
  const ticks = yTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  let xMin = points[0].x;
  let xMax = points[points.length - 1].x;
  if (xMin === xMax) { xMin -= 3 * 86400000; xMax += 3 * 86400000; }

  const px = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const py = (y) => pad.t + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);

  // grid + y labels
  ctx.strokeStyle = color('--border');
  ctx.fillStyle = color('--text-dim');
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of ticks) {
    const y = Math.round(py(t)) + 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillText(fmtNum(t), pad.l - 8, y);
  }

  // x labels (up to 4, evenly spaced in time)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelCount = Math.min(4, Math.max(2, points.length));
  for (let i = 0; i < labelCount; i++) {
    const x = xMin + ((xMax - xMin) * i) / (labelCount - 1);
    const lx = Math.min(Math.max(px(x), pad.l + 18), W - pad.r - 18);
    ctx.fillText(fmtShortDate(new Date(x)), lx, H - pad.b + 8);
  }

  const accent = color('--accent');

  // area fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, color('--accent-fade'));
  grad.addColorStop(1, 'transparent');
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(px(p.x), py(p.y)) : ctx.moveTo(px(p.x), py(p.y))));
  ctx.lineTo(px(points[points.length - 1].x), H - pad.b);
  ctx.lineTo(px(points[0].x), H - pad.b);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // line
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(px(p.x), py(p.y)) : ctx.moveTo(px(p.x), py(p.y))));
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // points
  ctx.fillStyle = accent;
  for (const p of points) {
    ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 3.5, 0, Math.PI * 2); ctx.fill();
  }

  // label the latest value
  const last = points[points.length - 1];
  ctx.fillStyle = color('--text');
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = px(last.x) > W - 60 ? 'right' : 'center';
  ctx.fillText(`${fmtNum(last.y)} ${unit}`, Math.min(px(last.x), W - pad.r), py(last.y) - 8);
}
