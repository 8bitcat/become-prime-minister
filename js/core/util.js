// Småverktyg: slump med frö, formatering, datum.

// Mulberry32 – deterministisk slump så att sparade världar kan spelas upp igen.
export function makeRng(seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rnd.state = () => a;
  return rnd;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const round = (v, d = 0) => { const m = 10 ** d; return Math.round(v * m) / m; };
export const sum = (arr) => arr.reduce((s, v) => s + v, 0);
export const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
export const weighted = (rnd, items, wf) => {
  const ws = items.map(wf); const tot = sum(ws);
  let r = rnd() * tot;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
};
export const gauss = (rnd, mean = 0, sd = 1) => {
  const u = 1 - rnd(), v = rnd();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
export const shuffle = (rnd, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const uid = (rnd) => Math.floor(rnd() * 1e9).toString(36) + Date.now().toString(36).slice(-3);

// --- format ---
const nf0 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export const fmt = (v, d = 0) => (d === 0 ? nf0 : d === 1 ? nf1 : nf2).format(v);
export const pct = (v, d = 1) => fmt(v, d) + ' %';
export const kr = (v) => {
  const a = Math.abs(v);
  if (a >= 1e9) return fmt(v / 1e9, 1) + ' mdkr';
  if (a >= 1e6) return fmt(v / 1e6, 1) + ' mnkr';
  if (a >= 1e4) return fmt(v / 1e3, 0) + ' tkr';
  return fmt(v, 0) + ' kr';
};
export const signed = (v, d = 1, unit = '') => (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v), d) + unit;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- datum ---
export const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const WEEKDAYS = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
export const toDate = (d) => new Date(Date.UTC(d.y, d.m - 1, d.d));
export const fromDate = (dt) => ({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
export const addDays = (d, n) => { const dt = toDate(d); dt.setUTCDate(dt.getUTCDate() + n); return fromDate(dt); };
export const dayDiff = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export const cmpDate = (a, b) => (a.y - b.y) || (a.m - b.m) || (a.d - b.d);
export const fmtDate = (d, long = false) => long ? `${d.d} ${MONTHS[d.m - 1]} ${d.y}` : `${d.d} ${MONTHS_SHORT[d.m - 1]} ${d.y}`;
export const isoDate = (d) => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
export const weekNo = (d) => {
  const dt = toDate(d); const day = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((dt - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
};
// Andra söndagen i september = svensk valdag
export const electionDay = (year) => { const first = new Date(Date.UTC(year, 8, 1)); const dow = first.getUTCDay(); const d = 1 + ((7 - dow) % 7) + 7; return { y: year, m: 9, d }; };
export const monthKey = (d) => d.y * 12 + (d.m - 1);

export const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
