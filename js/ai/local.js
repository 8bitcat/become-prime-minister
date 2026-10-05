// Spelets egen språkmodell: körs helt lokalt i webbläsaren med WebGPU (WebLLM). Ingen nyckel, ingen
// kostnad, inget skickas någonstans. Modellen laddas ned en gång (cachas av webbläsaren) och används
// sedan för att förstå allt spelaren skriver och för att låta motståndare, journalister, väljare och
// stabschefen svara med egna ord. Utan WebGPU eller innan modellen är laddad används den inbyggda analysen.
// Alternativt kör modellen i Ollama på den egna datorn (eller en dator i hemmet): spelet pratar då med
// Ollamas API (standard http://localhost:11434) – snabbare och med större modeller, fortfarande utan nyckel.
const WEBLLM = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
const KEY = 'bpm_local_ai';
export const LOCAL_MODELS = [
  { id: 'Qwen3.5-9B-q4f16_1-MLC', name: 'Störst – Qwen3.5 9B', size: '≈ 5,1 GB', vram: 6500, desc: 'Förstår mest: ironi, berättelser, strategi. Kräver ett grafikkort med minst ~8 GB minne.' },
  { id: 'Qwen3.5-4B-q4f16_1-MLC', name: 'Stor – Qwen3.5 4B', size: '≈ 2,4 GB', vram: 3900, desc: 'Bra förståelse och snabb. Grafikkort med minst ~4 GB minne.' },
  { id: 'Qwen3.5-2B-q4f16_1-MLC', name: 'Mellan – Qwen3.5 2B', size: '≈ 1,1 GB', vram: 2300, desc: 'För bärbara datorer med inbyggd grafik.' },
  { id: 'Qwen3.5-0.8B-q4f16_1-MLC', name: 'Liten – Qwen3.5 0.8B', size: '≈ 0,5 GB', vram: 1700, desc: 'För svaga datorer och mobiler. Förstår enklare text.' },
];
// Modeller vi provat i Ollama, i den ordning spelet föredrar dem när flera finns installerade
export const SERVER_PREFS = ['gemma4:12b', 'qwen3.5:9b', 'gemma3:12b', 'qwen3:14b', 'qwen3.5:4b', 'gemma4:e4b', 'qwen3:8b'];
export const DEFAULT_SERVER = 'http://localhost:11434';
export function localSettings() { const d = { enabled: false, model: null, asked: false, server: { on: false, url: DEFAULT_SERVER, model: null } }; try { const s = { ...d, ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) }; s.server = { ...d.server, ...(s.server || {}) }; return s; } catch { return d; } }
export function saveLocalSettings(s) { try { localStorage.setItem(KEY, JSON.stringify({ ...localSettings(), ...s })); } catch { /* privat läge */ } }

let engine = null, webllm = null, loading = null, queue = Promise.resolve();
let server = null; // { url, model } när spelet är anslutet till Ollama
let status = { state: 'av', progress: 0, text: '' };
const listeners = new Set();
const emit = () => { for (const f of listeners) try { f(status); } catch { /* ignore */ } document.dispatchEvent(new CustomEvent('bpm:localai', { detail: status })); };
export const onLocalStatus = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const localStatus = () => status;
export const localReady = () => (!!engine || !!server) && status.state === 'klar';
export const localVia = () => (server && status.state === 'klar' ? 'server' : engine && status.state === 'klar' ? 'browser' : null);
export const localEnabled = () => localSettings().enabled;
export const localModelInfo = () => (server ? { id: server.model, name: `${server.model} i Ollama på din dator` } : LOCAL_MODELS.find((m) => m.id === (status.model || localSettings().model)) || null);

// ---------- OLLAMA PÅ DEN EGNA DATORN ----------
const withTimeout = (ms) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; };
const cleanUrl = (u) => String(u || DEFAULT_SERVER).trim().replace(/\/+$/, '').replace(/^(?!https?:\/\/)/, 'http://');
// Chrome och Edge frågar om en webbplats får nå enheter i det lokala nätverket (även den egna datorn).
// Har spelaren svarat nej blockeras anropen – det ska då stå hur man ändrar det.
async function networkPermission() {
  for (const name of ['local-network-access', 'loopback-network']) { try { return (await navigator.permissions.query({ name })).state; } catch { /* okänd i den här webbläsaren */ } }
  return null;
}
const BLOCKED = 'Webbläsaren nekar spelet att nå din dator. Klicka på symbolen till vänster om adressfältet → Webbplatsinställningar → "Lokalt nätverk" → Tillåt, och ladda om sidan.';
// Vilka modeller finns i Ollama? Kastar ett begripligt fel om servern inte svarar eller nekar spelet.
export async function probeServer(url = DEFAULT_SERVER) {
  const u = cleanUrl(url); const to = withTimeout(4000);
  try {
    const r = await fetch(u + '/api/tags', { signal: to.signal });
    if (r.status === 403) throw new Error('Ollama nekar spelet. Sätt miljövariabeln OLLAMA_ORIGINS så att den tillåter ' + location.origin + ' och starta om Ollama.');
    if (!r.ok) throw new Error('Ollama svarade med fel ' + r.status);
    const j = await r.json();
    const models = (j.models || []).map((m) => ({ id: m.name, size: m.size, params: m.details?.parameter_size || '' })).filter((m) => !/embed|bge|minilm/i.test(m.id));
    return { url: u, models };
  } catch (e) {
    if (e instanceof TypeError && typeof navigator !== 'undefined' && (await networkPermission()) === 'denied') throw new Error(BLOCKED);
    if (e.name === 'AbortError' || e instanceof TypeError) throw new Error(`Hittar ingen Ollama på ${u}. Är Ollama igång – och tillåter den ${typeof location !== 'undefined' ? location.origin : 'spelet'} (OLLAMA_ORIGINS)?`);
    throw e;
  } finally { to.done(); }
}
export const pickServerModel = (models, wanted) => (models.find((m) => m.id === wanted) || SERVER_PREFS.map((p) => models.find((m) => m.id === p)).find(Boolean) || models[0] || null)?.id || null;
// Anslut: kontrollera servern, välj modell och väck den (första anropet laddar modellen i grafikminnet)
export function connectServer(url = DEFAULT_SERVER, model = null) {
  loading = (async () => {
    status = { state: 'laddar', progress: 5, text: 'Söker Ollama på din dator …', model: 'server' }; emit();
    const { url: u, models } = await probeServer(url);
    const id = pickServerModel(models, model);
    if (!id) throw new Error('Ollama är igång men har ingen modell. Kör t.ex. "ollama pull gemma4:12b".');
    status = { state: 'laddar', progress: 40, text: `Väcker ${id} på din dator …`, model: id }; emit();
    if (engine) { try { await engine.unload(); } catch { /* ok */ } engine = null; }
    server = { url: u, model: id };
    await serverChat([{ role: 'user', content: 'Svara bara: ok' }], { max: 4, temp: 0 });
    status = { state: 'klar', progress: 100, text: 'Redo', model: id, via: 'server' }; emit();
    saveLocalSettings({ server: { on: true, url: u, model: id } });
    return true;
  })().catch((e) => { server = null; loading = null; status = { state: 'fel', progress: 0, text: e.message, model: 'server' }; emit(); throw e; });
  return loading;
}
export function disconnectServer() { server = null; loading = null; saveLocalSettings({ server: { ...localSettings().server, on: false } }); status = { state: 'av', progress: 0, text: '' }; emit(); }
let lowAbort = null;
async function serverChat(messages, { schema = null, max = 300, temp = .6, penalty = .4, low = false } = {}) {
  const ctl = new AbortController(); if (low) lowAbort = ctl;
  const to = setTimeout(() => ctl.abort(), 120000);
  try {
    // JSON-svar utan upprepningsstraff: straffen hindrar modellen från att återanvända ord den just skrivit ("ekonomi" → "ekonomi: lägre skatt")
    const body = { model: server.model, messages, stream: false, think: false, keep_alive: '30m', options: schema ? { temperature: temp, top_p: .9, num_predict: max, num_ctx: 8192 } : { temperature: temp, top_p: .9, num_predict: max, presence_penalty: penalty * .3, frequency_penalty: penalty * .5, num_ctx: 8192 } };
    if (schema) body.format = schema;
    if (/gemma4/i.test(server.model)) body.options.draft_num_predict = 0; // Ollama 0.35: Gemma 4:s utkastmodell kraschar på Windows
    const r = await fetch(server.url + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`Ollama: ${r.status} ${t.slice(0, 160)}`); }
    const j = await r.json();
    const txt = (j.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return schema && j.done_reason === 'length' ? closeJSON(txt) : txt;
  } finally { clearTimeout(to); if (low) lowAbort = null; }
}

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
export async function unloadLocal() { if (engine) { try { await engine.unload(); } catch { /* ok */ } } engine = null; server = null; loading = null; status = { state: 'av', progress: 0, text: '' }; emit(); }

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
export function localChat(messages, { schema = null, max = 300, temp = .6, penalty = .4, low = false } = {}) {
  const run = async () => {
    if (!localReady()) throw new Error('Den lokala modellen är inte laddad');
    if (server) { status = { ...status, busy: true }; emit(); try { return await serverChat(messages, { schema, max, temp, penalty, low }); } finally { status = { ...status, busy: false }; emit(); } }
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
  if (lowRunning && lowAbort) { try { lowAbort.abort(); } catch { /* ok */ } }
  try { return await localJSONInner(messages, schema, opts); } finally { interactive--; setTimeout(pumpLow, 1500); }
}
async function localJSONInner(messages, schema, opts = {}) {
  const txt = await localChat(messages, { ...opts, schema });
  try { return JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('Modellen gav inget giltigt svar'); }
}
