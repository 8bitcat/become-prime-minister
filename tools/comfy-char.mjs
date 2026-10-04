// Genererar en karaktärsark (samma person i flera poser) med Z-Image Turbo i ComfyUI (port 8188).
//   node tools/comfy-char.mjs --out test1 --seed 7 [--w 1536 --h 1024 --steps 8] "prompt…"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'http://127.0.0.1:8188';
const args = process.argv.slice(2);
const opt = { out: 'char', seed: Math.floor(Math.random() * 1e9), w: 1536, h: 1024, steps: 8, cfg: 1, shift: 3, dir: 'tools/out/chars' };
const rest = [];
for (let i = 0; i < args.length; i++) { const a = args[i]; if (a.startsWith('--')) { const k = a.slice(2); opt[k] = isNaN(+args[i + 1]) ? args[i + 1] : +args[i + 1]; i++; } else rest.push(a); }
const prompt = rest.join(' ');
if (!prompt) { console.error('ingen prompt'); process.exit(1); }
const g = {
  1: { class_type: 'UNETLoader', inputs: { unet_name: 'z_image_turbo_bf16.safetensors', weight_dtype: 'default' } },
  3: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: opt.shift } },
  4: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'lumina2', device: 'default' } },
  5: { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
  6: { class_type: 'CLIPTextEncode', inputs: { clip: ['4', 0], text: prompt } },
  7: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['6', 0] } },
  8: { class_type: 'EmptySD3LatentImage', inputs: { width: opt.w, height: opt.h, batch_size: 1 } },
  9: { class_type: 'KSampler', inputs: { model: ['3', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['8', 0], seed: opt.seed, steps: opt.steps, cfg: opt.cfg, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1 } },
  10: { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['5', 0] } },
  11: { class_type: 'SaveImage', inputs: { images: ['10', 0], filename_prefix: 'bpm/' + opt.out } },
};
const t0 = Date.now();
const r = await fetch(HOST + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: g, client_id: 'bpm' }) });
const j = await r.json();
if (!j.prompt_id) { console.error('fel från ComfyUI:', JSON.stringify(j).slice(0, 1500)); process.exit(1); }
let hist = null;
for (let i = 0; i < 900; i++) { await new Promise((res) => setTimeout(res, 1000)); const h = await (await fetch(HOST + '/history/' + j.prompt_id)).json(); if (h[j.prompt_id]) { hist = h[j.prompt_id]; break; } }
if (!hist) { console.error('timeout'); process.exit(1); }
if (hist.status && hist.status.status_str === 'error') { console.error('körfel:', JSON.stringify(hist.status.messages).slice(0, 2000)); process.exit(1); }
const outs = Object.values(hist.outputs).flatMap((o) => o.images || []);
const outDir = path.resolve(ROOT, opt.dir); fs.mkdirSync(outDir, { recursive: true });
for (const im of outs) {
  const u = `${HOST}/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder || '')}&type=${im.type}`;
  const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
  const dest = path.join(outDir, opt.out + '.png');
  fs.writeFileSync(dest, buf);
  console.log('sparad', dest, Math.round(buf.length / 1024) + ' kB', 'seed', opt.seed, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}
