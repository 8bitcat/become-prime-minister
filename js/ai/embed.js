// Smart analys på enheten (valfritt): en liten flerspråkig inbäddningsmodell (multilingual-e5-small,
// ~118 MB, laddas en gång och cachas av webbläsaren) körs lokalt med transformers.js och matchar det
// spelaren skriver mot kunskapsbasens förberäknade vektorer (assets/ai/kb-vec.bin). Ger "förståelse"
// av fria formuleringar utan API-nyckel. Faller tyst tillbaka på trigrammatchningen om något saknas.
import { llmSettings } from './llm.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
let pipe = null, kb = null, loading = null;
let status = { state: 'av', progress: 0 };
export const smartEnabled = () => !!llmSettings().smart;
export const smartStatus = () => status;
export const smartReady = () => !!(pipe && kb);
export function loadSmart(onProgress) {
  if (loading) return loading;
  loading = (async () => {
    status = { state: 'laddar', progress: 0 }; onProgress?.(status);
    const [{ pipeline, env }, idx, vec] = await Promise.all([import(/* webpackIgnore: true */ CDN), fetch('assets/ai/kb-index.json').then((r) => { if (!r.ok) throw new Error('kb-index saknas'); return r.json(); }), fetch('assets/ai/kb-vec.bin').then((r) => { if (!r.ok) throw new Error('kb-vec saknas'); return r.arrayBuffer(); })]);
    env.allowLocalModels = false;
    pipe = await pipeline('feature-extraction', idx.model, { dtype: 'q8', progress_callback: (p) => { if (p.status === 'progress' && p.progress != null) { status = { state: 'laddar', progress: Math.round(p.progress), file: p.file }; onProgress?.(status); } } });
    const n = idx.n, dim = idx.dim;
    kb = { entries: idx.entries, n, dim, scales: new Float32Array(vec, 0, n), q: new Int8Array(vec, n * 4, n * dim), prefix: idx.prefix || '' };
    status = { state: 'klar', progress: 100 }; onProgress?.(status);
    return true;
  })().catch((e) => { status = { state: 'fel', error: e.message }; onProgress?.(status); loading = null; throw e; });
  return loading;
}
// Semantiska träffar per mening: [{ sentence, entry, sim }] i samma form som trigramträffarna
export async function embedHits(sentences) {
  if (!smartReady() || !sentences.length) return [];
  const res = await pipe(sentences.map((s) => kb.prefix + s), { pooling: 'mean', normalize: true });
  const data = res.data; const dim = kb.dim; const hits = [];
  for (let si = 0; si < sentences.length; si++) {
    const v = data.subarray(si * dim, (si + 1) * dim);
    const sc = new Array(kb.n);
    for (let i = 0; i < kb.n; i++) { let d = 0; const o = i * dim; for (let k = 0; k < dim; k++) d += v[k] * kb.q[o + k]; sc[i] = [d * kb.scales[i], i]; }
    sc.sort((a, b) => b[0] - a[0]);
    const best = sc[0][0];
    for (const [d, i] of sc.slice(0, 6)) { const sim = (d - .78) / .17; if (sim < .35 || d < best - .05) continue; hits.push({ sentence: si, entry: kb.entries[i], sim: Math.min(1, sim), cos: d }); }
  }
  return hits;
}
