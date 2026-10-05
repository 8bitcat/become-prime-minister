// Spelets egen språkmodell: körs helt lokalt i webbläsaren med WebGPU (WebLLM). Ingen nyckel, ingen
// kostnad, inget skickas någonstans. Modellen laddas ned en gång (cachas av webbläsaren) och används
// sedan för att förstå allt spelaren skriver och för att låta motståndare, journalister, väljare och
// stabschefen svara med egna ord. Utan WebGPU eller innan modellen är laddad används den inbyggda analysen.
const WEBLLM = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
const KEY = 'bpm_local_ai';
export const LOCAL_MODELS = [
  { id: 'Qwen3.5-9B-q4f16_1-MLC', name: 'Störst – Qwen3.5 9B', size: '≈ 5,1 GB', vram: 6500, desc: 'Förstår mest: ironi, berättelser, strategi. Kräver ett grafikkort med minst ~8 GB minne.' },
  { id: 'Qwen3.5-4B-q4f16_1-MLC', name: 'Stor – Qwen3.5 4B', size: '≈ 2,4 GB', vram: 3900, desc: 'Bra förståelse och snabb. Grafikkort med minst ~4 GB minne.' },
  { id: 'Qwen3.5-2B-q4f16_1-MLC', name: 'Mellan – Qwen3.5 2B', size: '≈ 1,1 GB', vram: 2300, desc: 'För bärbara datorer med inbyggd grafik.' },
  { id: 'Qwen3.5-0.8B-q4f16_1-MLC', name: 'Liten – Qwen3.5 0.8B', size: '≈ 0,5 GB', vram: 1700, desc: 'För svaga datorer och mobiler. Förstår enklare text.' },
];
export function localSettings() { try { return { enabled: false, model: null, asked: false, ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) }; } catch { return { enabled: false, model: null, asked: false }; } }
export function saveLocalSettings(s) { try { localStorage.setItem(KEY, JSON.stringify({ ...localSettings(), ...s })); } catch { /* privat läge */ } }

let engine = null, webllm = null, loading = null, queue = Promise.resolve();
let status = { state: 'av', progress: 0, text: '' };
const listeners = new Set();
const emit = () => { for (const f of listeners) try { f(status); } catch { /* ignore */ } document.dispatchEvent(new CustomEvent('bpm:localai', { detail: status })); };
export const onLocalStatus = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const localStatus = () => status;
export const localReady = () => !!engine && status.state === 'klar';
export const localEnabled = () => localSettings().enabled;
export const localModelInfo = () => LOCAL_MODELS.find((m) => m.id === (status.model || localSettings().model)) || null;

// Kan den här enheten köra modellen? Väljer en lämplig storlek.
export async function probeDevice() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return { ok: false, reason: 'Webbläsaren saknar WebGPU (prova Chrome, Edge eller Safari 26).' };
  try {
    const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!a) return { ok: false, reason: 'Inget grafikkort tillgängligt för WebGPU.' };
    const info = a.info || {}; const f16 = a.features.has('shader-f16');
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const vendor = (info.vendor || '').toLowerCase(); const arch = (info.architecture || '').toLowerCase();
    // eget grafikkort (NVIDIA/AMD) av nyare generation → störst; Apple Silicon → stor; inbyggd grafik → mellan; mobil → liten
    const discreteNew = /nvidia|amd/.test(vendor) && /lovelace|ampere|blackwell|ada|rdna-?[34]|rdna3|rdna4/.test(arch);
    const discrete = /nvidia|amd/.test(vendor) && a.limits.maxBufferSize >= 2 ** 30;
    const rec = mobile ? LOCAL_MODELS[3] : discreteNew ? LOCAL_MODELS[0] : discrete || /apple/.test(vendor) ? LOCAL_MODELS[1] : LOCAL_MODELS[2];
    return { ok: f16, reason: f16 ? null : 'Grafikkortet saknar stöd för 16-bitars beräkningar (shader-f16).', vendor: info.vendor, arch: info.architecture, mobile, recommended: rec.id };
  } catch (e) { return { ok: false, reason: e.message }; }
}
export async function isCached(modelId) { try { webllm ||= await import(WEBLLM); return await webllm.hasModelInCache(modelId); } catch { return false; } }

export function loadLocal(modelId, onProgress) {
  if (onProgress) listeners.add(onProgress);
  if (loading && status.model === modelId) return loading;
  loading = (async () => {
    status = { state: 'laddar', progress: 0, text: 'Startar …', model: modelId }; emit();
    webllm ||= await import(WEBLLM);
    if (engine) { try { await engine.unload(); } catch { /* ok */ } engine = null; }
    const worker = new Worker(new URL('./llm-worker.js', import.meta.url), { type: 'module' });
    engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback: (p) => { status = { state: 'laddar', progress: Math.round((p.progress || 0) * 100), text: p.text || '', model: modelId }; emit(); } });
    status = { state: 'klar', progress: 100, text: 'Redo', model: modelId }; emit();
    saveLocalSettings({ enabled: true, model: modelId });
    return true;
  })().catch(async (e) => {
    engine = null; loading = null;
    // för lite grafikminne → prova automatiskt nästa mindre modell
    const i = LOCAL_MODELS.findIndex((m) => m.id === modelId);
    if (/memory|allocat|OOM|buffer|device lost|exceed/i.test(e.message || '') && i >= 0 && i < LOCAL_MODELS.length - 1) {
      status = { state: 'laddar', progress: 0, text: `För lite grafikminne – provar ${LOCAL_MODELS[i + 1].name}`, model: LOCAL_MODELS[i + 1].id }; emit();
      return loadLocal(LOCAL_MODELS[i + 1].id);
    }
    status = { state: 'fel', progress: 0, text: e.message, model: modelId }; emit(); throw e;
  });
  return loading;
}
export async function unloadLocal() { if (engine) { try { await engine.unload(); } catch { /* ok */ } } engine = null; loading = null; status = { state: 'av', progress: 0, text: '' }; emit(); }

// Gemma saknar systemroll: systemtexten läggs först i första användarmeddelandet
function prep(messages, modelId) {
  if (!/gemma/i.test(modelId || '')) return messages;
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ ...m }));
  if (sys && rest[0]) rest[0].content = sys + '\n\n' + rest[0].content;
  return rest;
}
// Avklippt JSON (max_tokens nåddes): stäng öppna strängar, listor och objekt så att det som hann skrivas kan användas
export function closeJSON(t) {
  let s = t, inStr = false, esc2 = false; const stack = [];
  for (const ch of s) { if (inStr) { if (esc2) esc2 = false; else if (ch === '\\') esc2 = true; else if (ch === '"') inStr = false; continue; } if (ch === '"') inStr = true; else if (ch === '{' || ch === '[') stack.push(ch); else if (ch === '}' || ch === ']') stack.pop(); }
  if (inStr) s += '"';
  s = s.replace(/,\s*$/, '').replace(/,\s*"[^"]*"\s*:\s*$/, '').replace(/:\s*$/, ': ""');
  while (stack.length) s += stack.pop() === '{' ? '}' : ']';
  return s;
}
// Upprepningar ("hårt hårt hårt …") som små modeller ibland fastnar i
export function tidy(t) { return String(t || '').replace(/\b(\p{L}+)(?:[\s,]+\1\b){2,}/giu, '$1').replace(/(.{12,}?)\1{2,}/g, '$1').replace(/\s{2,}/g, ' ').trim(); }
// En fråga i taget till modellen (kö). schema → JSON enligt schemat (grammatikstyrt), annars fri text.
export function localChat(messages, { schema = null, max = 300, temp = .6, penalty = .4 } = {}) {
  const run = async () => {
    if (!localReady()) throw new Error('Den lokala modellen är inte laddad');
    const req = { messages: prep(messages, status.model), max_tokens: max, temperature: temp, top_p: .9, frequency_penalty: penalty, presence_penalty: penalty * .5, repetition_penalty: 1.08, extra_body: { enable_thinking: false } };
    if (schema) req.response_format = { type: 'json_object', schema: JSON.stringify(schema) };
    status = { ...status, busy: true }; emit();
    try { const r = await engine.chat.completions.create(req); const fin = r.choices[0].finish_reason; const txt = (r.choices[0].message.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim(); return schema && fin === 'length' ? closeJSON(txt) : txt; }
    finally { status = { ...status, busy: false }; emit(); }
  };
  const p = queue.then(run, run); queue = p.catch(() => {}); return p;
}
// Bakgrundsjobb (t.ex. nyhetsartiklar): körs bara när ingen interaktiv fråga väntar, en i taget
let interactive = 0; const lowQueue = []; let lowRunning = false;
const pumpLow = () => {
  if (lowRunning || interactive > 0 || !lowQueue.length || !localReady()) return;
  lowRunning = true; const job = lowQueue.shift();
  localChat(job.messages, { ...job.opts, low: true }).then(job.resolve, job.reject).finally(() => { lowRunning = false; setTimeout(pumpLow, 400); });
};
export function localJSONLow(messages, schema, opts = {}) {
  if (lowQueue.length > 6) lowQueue.shift()?.reject(new Error('överhoppad'));
  return new Promise((resolve, reject) => { lowQueue.push({ messages, opts: { ...opts, schema }, resolve, reject }); setTimeout(pumpLow, 1500); }).then((txt) => { try { return JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('ogiltigt svar'); } });
}
export async function localJSON(messages, schema, opts = {}) {
  interactive++;
  if (lowRunning && engine) { try { engine.interruptGenerate(); } catch { /* ok */ } } // spelaren går före bakgrundsjobben
  try { return await localJSONInner(messages, schema, opts); } finally { interactive--; setTimeout(pumpLow, 1500); }
}
async function localJSONInner(messages, schema, opts = {}) {
  const txt = await localChat(messages, { ...opts, schema });
  try { return JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('Modellen gav inget giltigt svar'); }
}
