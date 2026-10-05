// Teckentrigram och viktad Dice-likhet: tålig matchning av svenska formuleringar (böjningar, stavfel,
// sammansättningar) utan ordlistor. Vanliga trigram (" de", "det", " är" …) väger lätt, ovanliga tungt,
// så att "det är en bra poäng" inte liknar "det är en skandal". Indexet håller kunskapsbasen förberedd.
const norm = (s) => (' ' + String(s || '').toLowerCase().replace(/[^a-zåäöéü0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ');
export function trigrams(s) {
  const t = norm(s); const out = new Set();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}
export function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0; const [s, l] = a.size < b.size ? [a, b] : [b, a];
  for (const g of s) if (l.has(g)) n++;
  return (2 * n) / (a.size + b.size);
}
export class Index {
  constructor(entries) {
    this.entries = entries.map((e) => ({ ...e, g: trigrams(e.t) }));
    // dokumentfrekvens → vikt per trigram
    const df = new Map();
    for (const e of this.entries) for (const g of e.g) df.set(g, (df.get(g) || 0) + 1);
    this.w = (g) => 1 / (1 + Math.log(1 + (df.get(g) || 0)));
    for (const e of this.entries) { let s = 0; for (const g of e.g) s += this.w(g); e.wsum = s; }
  }
  // Sök en mening: returnerar [{entry, sim}] över minimitröskeln. sim = viktad Dice, eller för fraser som
  // ryms helt i meningen: viktad andel av frasens trigram som finns (×0.9), bara för fraser med ≥ 8 trigram.
  search(text, { top = 10, min = .28 } = {}) {
    const g = trigrams(text); if (g.size < 3) return [];
    let gsum = 0; for (const x of g) gsum += this.w(x);
    const hits = [];
    for (const e of this.entries) {
      let inter = 0; for (const x of e.g) if (g.has(x)) inter += this.w(x);
      if (!inter) continue;
      const d = (2 * inter) / (e.wsum + gsum);
      const c = e.g.size >= 8 && e.g.size <= g.size ? (inter / e.wsum) * .9 : 0;
      const sim = Math.max(d, c);
      if (sim >= min) hits.push({ entry: e, sim });
    }
    hits.sort((a, b) => b.sim - a.sim);
    return hits.slice(0, top);
  }
}
export const normalize = norm;
