// Tecknade sprites: karaktärsark genererade med ComfyUI (tools/comfy-chars.mjs + slice-chars.py)
// och skivade till assets/chars/<id>/<pose>.webp. Varje person paras ihop med närmaste look;
// SVG-dockan (character.js) är reserv och används när galleriet saknas eller personen valt "ritad".
import { characterSVG } from './character.js';
import { OUTFIT_BY_ID, HAIR_COLORS, SKIN_TONES } from '../sim/people.js';

let MANIFEST = null, BY_ID = {}, loading = null;
export const SPRITE_BASE = 'assets/chars/';
export function loadSprites() {
  if (!loading) loading = fetch(SPRITE_BASE + 'manifest.json').then((r) => (r.ok ? r.json() : { chars: [] })).catch(() => ({ chars: [] })).then((m) => { MANIFEST = m; BY_ID = Object.fromEntries((m.chars || []).map((c) => [c.id, c])); return m; });
  return loading;
}
export const spritesReady = () => !!MANIFEST && (MANIFEST.chars || []).length > 0;
export const spriteList = () => (MANIFEST?.chars || []);
export const spriteById = (id) => BY_ID[id] || null;

const HAIR_GROUP = { spik: 'kort', sidbena: 'kort', mittbena: 'kort', kort: 'kort', rakad: 'kort', hjalm: 'kort', slick: 'kort', lugg: 'bob', tunn: 'kort', flint: 'flint', lockigt: 'lockigt', afro: 'lockigt', lang: 'lang', axellangt: 'lang', flator: 'lang', tofs: 'knut', bob: 'bob', page: 'bob', knut: 'knut' };
const COLOR_GROUP = ['mork', 'mork', 'brun', 'brun', 'blond', 'blond', 'blond', 'rod', 'rod', 'gra', 'gra', 'gra', 'mork', 'mork', 'mork'];
const OUTFIT_GROUP = { suit: 'kostym', bowtie: 'kostym', vest: 'kostym', blazer: 'kavaj', blazer_tee: 'kavaj', polo: 'kavaj', cravat: 'kavaj', shirt: 'ledig', shirt_tie: 'ledig', hoodie: 'ledig', tee: 'ledig', cardigan: 'ledig', knit: 'ledig', sweater_collar: 'ledig', plaid: 'folklig', outdoor: 'folklig', blouse: 'blus', dress: 'klanning' };
const ageBand = (age) => (age < 38 ? 'ung' : age < 56 ? 'medel' : 'aldre');
export function lookKey(person) {
  const lk = person.look || {};
  const ci = HAIR_COLORS.indexOf(lk.hairColor); const si = SKIN_TONES.indexOf(lk.skin);
  return { gender: person.gender === 'm' ? 'm' : person.gender === 'k' ? 'k' : null, age: ageBand(person.age || 45), hair: HAIR_GROUP[lk.hair] || 'kort', color: ci >= 0 ? COLOR_GROUP[ci] : 'brun', skin: si < 0 ? 'ljus' : si <= 1 ? 'ljus' : si <= 3 ? 'medel' : 'mork', glasses: !!lk.glasses && lk.glasses !== 'inga', beard: !!lk.beard && lk.beard !== 'inget', outfit: OUTFIT_GROUP[OUTFIT_BY_ID[lk.outfit]?.kind] || 'kostym' };
}
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
// Närmaste look i galleriet. Samma person får alltid samma svar (hash på id vid oavgjort).
export function pickSprite(person) {
  const list = spriteList(); if (!list.length) return null;
  const k = lookKey(person);
  let best = null, bestScore = -1e9;
  for (const c of list) {
    if (k.gender && c.gender !== k.gender) continue;
    let s = 0;
    s += ageBand(c.age) === k.age ? 3 : Math.abs(['ung', 'medel', 'aldre'].indexOf(ageBand(c.age)) - ['ung', 'medel', 'aldre'].indexOf(k.age)) === 1 ? 1 : -1;
    s += c.hair === k.hair ? 2.5 : 0; s += c.color === k.color ? 2 : 0; s += c.skin === k.skin ? 2.5 : 0;
    s += c.glasses === k.glasses ? 1.2 : 0; s += (!!c.beard) === k.beard ? 1 : 0; s += c.outfit === k.outfit ? 1 : 0;
    s += (hash(person.id + c.id) % 100) / 400; // oavgjort → stabil slump
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return best ? best.id : null;
}
export function spriteFor(person) {
  if (!person || person.sprite === 'svg') return null;
  if (person.sprite && BY_ID[person.sprite]) return BY_ID[person.sprite];
  if (!spritesReady()) return null;
  const id = pickSprite(person); if (!id) return null;
  person.sprite = id; return BY_ID[id];
}
const POSE_MAP = { stand: 'stand', point: 'point', cross: 'cross', slam: 'slam', think: 'think', open: 'open', hips: 'open' };
const EXPR_POSE = { angry: 'slam', objection: 'point', happy: 'open', confident: 'open', nervous: 'think', sad: 'think', worried: 'think', shocked: 'stand', smug: 'cross', determined: 'cross' };
// Samma signatur som characterSVG. Ger <img> när en sprite finns, annars SVG-dockan.
export function characterArt(person, opts = {}) {
  const sp = spriteFor(person);
  if (!sp) return characterSVG(person, opts);
  const { pose = 'stand', expr = 'neutral', talking = false, crop = 'bust' } = opts;
  const p = crop === 'face' || crop === 'head' ? 'face' : pose !== 'stand' ? POSE_MAP[pose] || 'stand' : EXPR_POSE[expr] || 'stand';
  let src = `${SPRITE_BASE}${sp.id}/${p}.webp`;
  if (hasCustomLook(person.spriteLook) && sp.colors) { const u = lookUrl(sp.id, person.spriteLook, p); if (u) src = u; else if (!lookReady(sp.id, person.spriteLook)) prepareLook(sp.id, person.spriteLook).then(() => document.dispatchEvent(new CustomEvent('bpm:sprites'))).catch(() => {}); }
  if (p === 'face') return `<img class="sprite-face" src="${src}" alt="" draggable="false">`;
  return `<img class="sprite${talking ? ' talking' : ''}" src="${src}" alt="" draggable="false">`;
}
import { lookUrl, lookReady, prepareLook, hasCustomLook } from './recolor.js';
export const spriteFaceUrl = (id) => `${SPRITE_BASE}${id}/face.webp`;
export const spritePoseUrl = (id, pose = 'stand') => `${SPRITE_BASE}${id}/${pose}.webp`;
