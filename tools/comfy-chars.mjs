// Genererar hela rollgalleriet: en karaktärsark (3×2 poser, vit bakgrund) per look med Z-Image Turbo
// i ComfyUI (127.0.0.1:8188). Resultatet skivas sedan av tools/slice-chars.py till assets/chars/.
//   node tools/comfy-chars.mjs            → alla som saknas
//   node tools/comfy-chars.mjs k01 m07    → bara dessa
//   node tools/comfy-chars.mjs --force    → gör om alla
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'http://127.0.0.1:8188';
const OUT = path.join(ROOT, 'tools/out/chars');
fs.mkdirSync(OUT, { recursive: true });

// Rollgalleriet. Attributen används av js/art/sprites.js för att para ihop en person med närmaste look.
// hair: kort|lang|bob|knut|lockigt|flint · color: mork|brun|blond|rod|gra · skin: ljus|medel|mork · outfit: kostym|kavaj|ledig|folklig|blus|klanning
const K = (id, age, hair, color, skin, glasses, outfit, extra = '') => ({ id, gender: 'k', age, hair, color, skin, glasses, beard: false, outfit, extra });
const M = (id, age, hair, color, skin, glasses, beard, outfit, extra = '') => ({ id, gender: 'm', age, hair, color, skin, glasses, beard, outfit, extra });
export const CAST = [
  K('k01', 48, 'bob', 'gra', 'ljus', true, 'kostym', 'navy blazer over white blouse'),
  K('k02', 34, 'lang', 'blond', 'ljus', false, 'kavaj', 'light grey blazer, white top'),
  K('k03', 41, 'knut', 'mork', 'medel', false, 'blus', 'burgundy blouse with bow'),
  K('k04', 58, 'kort', 'gra', 'ljus', true, 'kostym', 'charcoal pantsuit, pearl necklace'),
  K('k05', 29, 'lang', 'mork', 'mork', false, 'ledig', 'green knit sweater'),
  K('k06', 45, 'bob', 'brun', 'ljus', false, 'klanning', 'dark blue dress'),
  K('k07', 52, 'kort', 'rod', 'ljus', true, 'kavaj', 'forest green blazer, cream blouse'),
  K('k08', 37, 'lockigt', 'mork', 'mork', false, 'kostym', 'black suit, white shirt'),
  K('k09', 63, 'kort', 'gra', 'ljus', false, 'folklig', 'wool cardigan over checked shirt'),
  K('k10', 31, 'knut', 'blond', 'ljus', true, 'kavaj', 'beige blazer, black top'),
  K('k11', 44, 'lang', 'brun', 'medel', false, 'blus', 'white blouse, small earrings'),
  K('k12', 55, 'bob', 'mork', 'medel', true, 'kostym', 'red pantsuit'),
  K('k13', 39, 'kort', 'blond', 'ljus', false, 'ledig', 'white shirt with rolled sleeves'),
  K('k14', 47, 'lang', 'gra', 'ljus', false, 'kavaj', 'grey blazer, blue blouse'),
  K('k15', 26, 'lockigt', 'brun', 'medel', false, 'ledig', 'hoodie, modern'),
  K('k16', 60, 'knut', 'gra', 'mork', true, 'klanning', 'purple dress, cardigan'),
  K('k17', 42, 'bob', 'rod', 'ljus', false, 'folklig', 'outdoor jacket, flannel'),
  K('k18', 50, 'kort', 'mork', 'ljus', false, 'kostym', 'navy pinstripe suit'),
  K('k19', 35, 'lang', 'mork', 'medel', true, 'blus', 'light blue blouse'),
  K('k20', 68, 'kort', 'gra', 'ljus', true, 'kavaj', 'camel blazer, silk scarf'),
  M('m01', 55, 'kort', 'mork', 'ljus', false, false, 'kostym', 'charcoal suit, light blue shirt, dark tie, grey temples'),
  M('m02', 38, 'kort', 'blond', 'ljus', false, 'stubb', 'kavaj', 'navy blazer, open white shirt'),
  M('m03', 47, 'flint', 'mork', 'ljus', true, 'skagg', 'kostym', 'dark grey suit, burgundy tie'),
  M('m04', 62, 'kort', 'gra', 'ljus', true, false, 'kostym', 'navy suit, red tie'),
  M('m05', 33, 'kort', 'mork', 'mork', false, 'stubb', 'ledig', 'blazer over t-shirt'),
  M('m06', 44, 'lockigt', 'brun', 'medel', false, 'skagg', 'kavaj', 'green blazer, white shirt'),
  M('m07', 58, 'kort', 'gra', 'ljus', false, 'mustasch', 'folklig', 'checked flannel shirt'),
  M('m08', 41, 'kort', 'rod', 'ljus', false, 'skagg', 'ledig', 'knit sweater with shirt collar'),
  M('m09', 29, 'kort', 'mork', 'medel', true, false, 'kostym', 'slim black suit, thin tie'),
  M('m10', 50, 'flint', 'gra', 'mork', false, false, 'kostym', 'navy suit, gold tie'),
  M('m11', 36, 'lang', 'brun', 'ljus', false, 'stubb', 'ledig', 'hair in a bun, hoodie, modern'),
  M('m12', 66, 'kort', 'gra', 'ljus', true, 'skagg', 'kavaj', 'tweed blazer, wool tie'),
  M('m13', 45, 'kort', 'brun', 'ljus', false, false, 'kostym', 'blue suit, white shirt, no tie'),
  M('m14', 39, 'kort', 'mork', 'mork', false, 'skagg', 'kavaj', 'camel blazer, black turtleneck'),
  M('m15', 53, 'kort', 'mork', 'medel', true, 'mustasch', 'kostym', 'grey suit, striped tie'),
  M('m16', 31, 'kort', 'blond', 'ljus', false, false, 'folklig', 'work jacket, yellow shirt'),
  M('m17', 48, 'kort', 'gra', 'ljus', false, 'stubb', 'ledig', 'rolled-up light blue shirt, no jacket'),
  M('m18', 59, 'flint', 'mork', 'ljus', false, false, 'kostym', 'black suit, bow tie'),
  M('m19', 42, 'kort', 'mork', 'ljus', true, false, 'kavaj', 'burgundy blazer, open collar'),
  M('m20', 70, 'kort', 'gra', 'ljus', true, 'skagg', 'folklig', 'cardigan over shirt, reading glasses'),
];
const HAIR = { kort: 'short neat hair', lang: 'long straight hair', bob: 'chin-length bob haircut', knut: 'hair tied up in a bun', lockigt: 'curly hair', flint: 'bald head' };
const COLOR = { mork: 'black', brun: 'brown', blond: 'blonde', rod: 'red', gra: 'grey' };
const SKIN = { ljus: 'fair skin', medel: 'olive skin', mork: 'dark brown skin' };
const BEARD = { skagg: 'full beard', stubb: 'short stubble', mustasch: 'mustache' };
export function promptFor(c) {
  const who = c.gender === 'k' ? 'woman' : 'man';
  const hair = c.hair === 'flint' ? HAIR.flint : `${COLOR[c.color]} ${HAIR[c.hair]}`;
  const face = [SKIN[c.skin], c.glasses ? 'glasses' : '', c.beard ? BEARD[c.beard] || '' : (c.gender === 'm' ? 'clean shaven' : '')].filter(Boolean).join(', ');
  return `anime character reference sheet of one Swedish ${who} politician, ${c.age} years old, ${hair}, ${face}, wearing ${c.extra}. The same person drawn six times in a grid of 3 columns and 2 rows on a pure white background. Every cell shows the upper body from the waist up at exactly the same scale, centered in its cell, with empty white space between the cells. Top row: 1) standing neutral and calm, arms relaxed; 2) arms crossed, stern frown; 3) pointing forward with the index finger, mouth open, shouting. Bottom row: 4) smiling warmly with both palms open, explaining; 5) hand on chin, thinking, worried; 6) fist raised, angry, shouting. Clean lineart, flat cel shading, identical face, hairstyle and clothes in every cell, realistic adult proportions, high quality anime illustration`;
}
async function generate(c, seed) {
  const g = {
    1: { class_type: 'UNETLoader', inputs: { unet_name: 'z_image_turbo_bf16.safetensors', weight_dtype: 'default' } },
    3: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: 3 } },
    4: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'lumina2', device: 'default' } },
    5: { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
    6: { class_type: 'CLIPTextEncode', inputs: { clip: ['4', 0], text: promptFor(c) } },
    7: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['6', 0] } },
    8: { class_type: 'EmptySD3LatentImage', inputs: { width: 1536, height: 1536, batch_size: 1 } },
    9: { class_type: 'KSampler', inputs: { model: ['3', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['8', 0], seed, steps: 8, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1 } },
    10: { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['5', 0] } },
    11: { class_type: 'SaveImage', inputs: { images: ['10', 0], filename_prefix: 'bpm/' + c.id } },
  };
  const r = await fetch(HOST + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: g, client_id: 'bpm' }) });
  const j = await r.json();
  if (!j.prompt_id) throw new Error('ComfyUI: ' + JSON.stringify(j).slice(0, 400));
  let hist = null;
  for (let i = 0; i < 900; i++) { await new Promise((res) => setTimeout(res, 1000)); const h = await (await fetch(HOST + '/history/' + j.prompt_id)).json(); if (h[j.prompt_id]) { hist = h[j.prompt_id]; break; } }
  if (!hist) throw new Error('timeout');
  if (hist.status?.status_str === 'error') throw new Error('körfel: ' + JSON.stringify(hist.status.messages).slice(0, 600));
  const im = Object.values(hist.outputs).flatMap((o) => o.images || [])[0];
  const u = `${HOST}/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder || '')}&type=${im.type}`;
  const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
  fs.writeFileSync(path.join(OUT, c.id + '.png'), buf);
  return buf.length;
}
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
fs.writeFileSync(path.join(OUT, 'cast.json'), JSON.stringify(CAST, null, 1));
const todo = CAST.filter((c) => (!only.length || only.includes(c.id)) && (force || !fs.existsSync(path.join(OUT, c.id + '.png'))));
console.log(`${todo.length} ark att generera`);
for (const c of todo) {
  const t0 = Date.now();
  try { const n = await generate(c, 1000 + parseInt(c.id.slice(1), 10) * 7 + (c.gender === 'k' ? 0 : 500)); console.log(`✓ ${c.id} ${Math.round(n / 1024)} kB ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
  catch (e) { console.log(`✗ ${c.id}: ${e.message}`); }
}
console.log('klart');
