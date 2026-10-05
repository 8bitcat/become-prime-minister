// Förberäknar inbäddningar för kunskapsbasen (js/ai/kb.js) med Xenova/multilingual-e5-small så att
// "Smart analys på enheten" i spelet bara behöver bädda in spelarens egen text.
//   cd tools/embed && npm i @huggingface/transformers@3   (en gång)
//   node tools/embed-kb.mjs   → assets/ai/kb-index.json + assets/ai/kb-vec.bin (int8 + skala per vektor)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'tools/embed/package.json'));
const tmod = await import(pathToFileURL(require.resolve('@huggingface/transformers')).href);
const pipeline = tmod.pipeline || tmod.default?.pipeline;
if (typeof pipeline !== 'function') throw new Error('hittar inte pipeline i transformers-paketet: ' + Object.keys(tmod).join(','));
const { kbEntries } = await import('../js/ai/kb.js');

export const MODEL = 'Xenova/multilingual-e5-small';
export const DIM = 384;
const entries = kbEntries();
console.log(`${entries.length} poster · laddar ${MODEL} …`);
const t0 = Date.now();
const extractor = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
console.log(`modell klar ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const out = new Int8Array(entries.length * DIM); const scales = new Float32Array(entries.length);
const B = 32;
for (let i = 0; i < entries.length; i += B) {
  const batch = entries.slice(i, i + B).map((e) => 'query: ' + e.t);
  const res = await extractor(batch, { pooling: 'mean', normalize: true });
  const data = res.data;
  for (let j = 0; j < batch.length; j++) {
    const v = data.subarray(j * DIM, (j + 1) * DIM);
    let mx = 0; for (const x of v) mx = Math.max(mx, Math.abs(x));
    const s = mx / 127 || 1; scales[i + j] = s;
    for (let k = 0; k < DIM; k++) out[(i + j) * DIM + k] = Math.round(v[k] / s);
  }
  if ((i / B) % 5 === 0) console.log(`  ${Math.min(i + B, entries.length)}/${entries.length}`);
}
const dir = path.join(ROOT, 'assets/ai'); fs.mkdirSync(dir, { recursive: true });
const bin = Buffer.concat([Buffer.from(scales.buffer), Buffer.from(out.buffer)]);
fs.writeFileSync(path.join(dir, 'kb-vec.bin'), bin);
fs.writeFileSync(path.join(dir, 'kb-index.json'), JSON.stringify({ model: MODEL, dim: DIM, n: entries.length, prefix: 'query: ', entries: entries.map((e) => ({ t: e.t, kind: e.kind, issue: e.issue, dir: e.dir, tone: e.tone, emo: e.emo, policy: e.policy })) }));
console.log(`klart: ${entries.length} vektorer, ${(bin.length / 1024).toFixed(0)} kB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
// snabbtest: närmaste poster för några fria formuleringar
const probe = async (s) => { const r = await extractor(['query: ' + s], { pooling: 'mean', normalize: true }); const q = r.data; const sc = []; for (let i = 0; i < entries.length; i++) { let d = 0; for (let k = 0; k < DIM; k++) d += q[k] * out[i * DIM + k] * scales[i]; sc.push([d, i]); } sc.sort((a, b) => b[0] - a[0]); return sc.slice(0, 3).map(([d, i]) => `${entries[i].t} (${d.toFixed(2)}${entries[i].issue ? ' ' + entries[i].issue : ''}${entries[i].tone ? ' ' + entries[i].tone : ''}${entries[i].emo ? ' ' + entries[i].emo : ''})`).join(' | '); };
for (const s of ['folk har inte råd med maten längre', 'mormor fick ligga i korridoren på sjukhuset', 'ni är ena riktiga pajasar', 'vi måste rädda jorden åt barnen', 'jag tycker du är väldigt klok', 'stäng gränsen nu']) console.log(`"${s}" → ${await probe(s)}`);
