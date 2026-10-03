// Små SVG-diagram: linjediagram, sparkline, mandatbåge.
import { esc } from '../core/util.js';

export function lineChart(series, { w = 720, h = 240, min = null, max = null, labels = [], yfmt = (v) => v, hline = null } = {}) {
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  if (!all.length) return `<svg class="chart" viewBox="0 0 ${w} ${h}"></svg>`;
  let lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  if (hi - lo < 1e-9) { hi = lo + 1; }
  const pad = { l: 44, r: 12, t: 10, b: 24 };
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i) => pad.l + (i / Math.max(1, n - 1)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
  let g = '';
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) { const v = lo + ((hi - lo) * i) / ticks; g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#27395a" stroke-width="1"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#93a3bd">${esc(yfmt(v))}</text>`; }
  if (hline != null) g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(hline)}" y2="${y(hline)}" stroke="#e5484d" stroke-dasharray="4 4"/>`;
  for (const [i, l] of labels.entries()) if (l) g += `<text x="${x(i)}" y="${h - 6}" text-anchor="middle" font-size="11" fill="#93a3bd">${esc(l)}</text>`;
  for (const s of series) {
    const pts = s.values.map((v, i) => (Number.isFinite(v) ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : null)).filter(Boolean);
    if (!pts.length) continue;
    g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.5}" stroke-linejoin="round" stroke-linecap="round" opacity="${s.opacity ?? 1}"/>`;
    const last = s.values.length - 1;
    if (Number.isFinite(s.values[last])) g += `<circle cx="${x(last)}" cy="${y(s.values[last])}" r="3.5" fill="${s.color}"/>`;
  }
  return `<svg class="chart" viewBox="0 0 ${w} ${h}">${g}</svg>`;
}

export function sparkline(values, color = '#f2c14e', w = 110, h = 26) {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
  const lo = Math.min(...v), hi = Math.max(...v);
  const y = (x) => hi - lo < 1e-9 ? h / 2 : 2 + (1 - (x - lo) / (hi - lo)) * (h - 4);
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * w},${y(x)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

// Mandatbåge: 349 prickar i halvcirkel, sorterade vänster→höger efter partiets lutning
export function hemicycle(seats, parties, { w = 600, h = 320, highlight = null } = {}) {
  const order = Object.entries(seats).filter(([, n]) => n > 0).map(([id, n]) => ({ p: parties[id], n })).filter((x) => x.p).sort((a, b) => ((a.p.pos.ekonomi + a.p.pos.valfard + a.p.pos.varderingar) - (b.p.pos.ekonomi + b.p.pos.valfard + b.p.pos.varderingar)));
  const dots = [];
  for (const o of order) for (let i = 0; i < o.n; i++) dots.push({ color: o.p.color, id: o.p.id });
  const total = dots.length || 349;
  const rows = 8; const cx = w / 2, cy = h - 20; const r0 = 90, dr = (h - 60 - r0) / (rows - 1);
  // fördela prickar per rad proportionellt mot radens omkrets
  const perRow = []; let left = total;
  const circ = Array.from({ length: rows }, (_, i) => Math.PI * (r0 + i * dr)); const cs = circ.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rows; i++) { const n = i === rows - 1 ? left : Math.round((circ[i] / cs) * total); perRow.push(n); left -= n; }
  // positioner: vinkel från π till 0, sorterade så att vänster fylls först
  const pos = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < perRow[i]; j++) { const a = Math.PI - (Math.PI * (j + .5)) / perRow[i]; pos.push({ x: cx + Math.cos(a) * (r0 + i * dr), y: cy - Math.sin(a) * (r0 + i * dr), a }); }
  pos.sort((p, q) => q.a - p.a);
  let g = '';
  pos.forEach((p, i) => { const d = dots[i]; if (!d) return; g += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${highlight === d.id ? 6.5 : 5.2}" fill="${d.color}" ${highlight && highlight !== d.id ? 'opacity=".35"' : ''} stroke="${highlight === d.id ? '#fff' : 'none'}" stroke-width="1.5"/>`; });
  g += `<text x="${cx}" y="${cy - 10}" text-anchor="middle" font-size="26" font-weight="800" fill="#e8eef8">${total}</text><text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="11" fill="#93a3bd">MANDAT · MAJORITET 175</text>`;
  return `<svg class="hemi" viewBox="0 0 ${w} ${h}">${g}</svg>`;
}

export function seatBar(seats, parties, total = 349) {
  const order = Object.entries(seats).filter(([, n]) => n > 0).map(([id, n]) => ({ p: parties[id], n })).filter((x) => x.p).sort((a, b) => ((a.p.pos.ekonomi + a.p.pos.valfard) - (b.p.pos.ekonomi + b.p.pos.valfard)));
  return `<div class="seats">${order.map((o) => `<i style="width:${(o.n / total) * 100}%;background:${o.p.color}" title="${esc(o.p.abbr)} ${o.n}"></i>`).join('')}</div>`;
}

export function barRow(label, value, max, color = 'var(--gold)', text = null) {
  return `<div class="pbar" style="margin:4px 0"><span style="width:120px;font-size:13px">${esc(label)}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%;background:${color}"></i></div><b style="width:60px;text-align:right;font-size:13px">${esc(text ?? value)}</b></div>`;
}
