// Färgar om de tecknade figurerna i webbläsaren: hår, hud, kläder, skjorta och detalj byts med hjälp av
// etikettkartorna (labels-<pose>.png från tools/mask-chars.py). Skuggningen bevaras genom att varje
// pixels ljushet skalas relativt delens medelfärg. Resultatet cachas som blob-URL:er.
import { SPRITE_BASE, spriteById } from './sprites.js';

export const PARTS = [['hair', 'Hår'], ['skin', 'Hud'], ['jacket', 'Kläder'], ['shirt', 'Skjorta/blus'], ['accent', 'Detalj (slips m.m.)']];
const LABEL_ID = { skin: 1, hair: 2, jacket: 3, shirt: 4, accent: 5 };
const POSES = ['stand', 'cross', 'point', 'open', 'think', 'slam', 'face'];
const cache = new Map(); // key → { urls: {pose: url}, ready: Promise }
const imgCache = new Map();

export const lookKeyOf = (spriteId, look) => spriteId + '|' + JSON.stringify(look || {});
export const hasCustomLook = (look) => !!look && Object.values(look).some((v) => v);
function loadImage(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('kunde inte läsa ' + src)); im.src = src; }));
  return imgCache.get(src);
}
const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (r, g, b) => .299 * r + .587 * g + .114 * b;

async function recolorPose(spriteId, pose, look, baseColors) {
  const [img, lab] = await Promise.all([loadImage(`${SPRITE_BASE}${spriteId}/${pose}.webp`), loadImage(`${SPRITE_BASE}${spriteId}/labels-${pose}.png`)]);
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0); const px = g.getImageData(0, 0, w, h);
  const lc = document.createElement('canvas'); lc.width = w; lc.height = h; const lg = lc.getContext('2d', { willReadFrequently: true });
  lg.drawImage(lab, 0, 0, w, h); const lp = lg.getImageData(0, 0, w, h).data;
  const d = px.data;
  const plan = {};
  for (const [part] of PARTS) { const target = hex(look?.[part]); const base = hex(baseColors?.[part]); if (!target || !base) continue; plan[LABEL_ID[part]] = { target, baseL: Math.max(20, lum(...base)) }; }
  if (!Object.keys(plan).length) return null;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const label = lp[i]; const p = plan[label]; if (!p) continue;
    const L = lum(d[i], d[i + 1], d[i + 2]);
    let f = L / p.baseL; f = f > 1 ? 1 + (f - 1) * .6 : f; // ljusa högdagrar dämpas något
    d[i] = Math.min(255, p.target[0] * f); d[i + 1] = Math.min(255, p.target[1] * f); d[i + 2] = Math.min(255, p.target[2] * f);
  }
  g.putImageData(px, 0, 0);
  const blob = await new Promise((res) => c.toBlob(res, 'image/webp', .9));
  return URL.createObjectURL(blob || new Blob());
}
// Förbereder alla poser för en sprite + look. Returnerar { urls } (tomt om inget att färga)
export function prepareLook(spriteId, look) {
  const key = lookKeyOf(spriteId, look);
  if (cache.has(key)) return cache.get(key).ready;
  const sp = spriteById(spriteId);
  const entry = { urls: {}, ready: null };
  entry.ready = (async () => {
    if (!sp?.colors || !hasCustomLook(look)) return entry.urls;
    for (const pose of POSES) { try { const u = await recolorPose(spriteId, pose, look, sp.colors); if (u) entry.urls[pose] = u; } catch (e) { console.warn('recolor', pose, e.message); } }
    return entry.urls;
  })();
  cache.set(key, entry);
  return entry.ready;
}
export function lookUrl(spriteId, look, pose) { const e = cache.get(lookKeyOf(spriteId, look)); return e?.urls?.[pose] || null; }
export const lookReady = (spriteId, look) => cache.has(lookKeyOf(spriteId, look));
