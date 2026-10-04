// Valfritt Claude-läge: spelaren lägger in en egen API-nyckel (sparas bara i webbläsaren).
// Utan nyckel använder spelet den regelbaserade analysen och textmallarna. Med nyckel
// analyserar Claude det du skriver och skriver motståndarnas, journalisternas och
// väljarnas repliker. SDK:t hämtas först när läget slås på.
const KEY = 'bpm_llm';
export const MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (bäst)' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (snabb & bra)' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (billigast)' },
];
export function llmSettings() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { key: '', model: 'claude-opus-5-5', enabled: false }; } catch { return { key: '', model: 'claude-opus-5-5', enabled: false }; } }
export function saveLlmSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ok */ } }
export const llmEnabled = () => { const s = llmSettings(); return !!(s.enabled && s.key); };

let clientPromise = null;
async function client() {
  const s = llmSettings();
  if (!s.key) throw new Error('Ingen API-nyckel');
  if (!clientPromise) clientPromise = import('https://esm.sh/@anthropic-ai/sdk@latest').then(({ default: Anthropic }) => new Anthropic({ apiKey: s.key, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60000 }));
  return clientPromise;
}
export function resetClient() { clientPromise = null; }

const SYSTEM = `Du är spelmotorn i "Become Prime Minister", en svensk politisk simulering. Du analyserar vad spelaren (en partiledare) skriver och skriver repliker åt journalister, motståndare, väljare och andra figurer i spelet. Svara alltid på svenska, kort och naturligt, i den ton som passar figuren. Du hittar inte på verkliga personer. Du får bara använda siffror som står i kontexten. Håll dig strikt till det JSON-format som efterfrågas.`;

// Gemensam JSON-anrop. schema = JSON-schema för svaret.
export async function askJSON(prompt, schema, { maxTokens = 1500, effort = 'low' } = {}) {
  const s = llmSettings();
  const c = await client();
  const res = await c.messages.create({
    model: s.model || 'claude-opus-5-5', max_tokens: maxTokens,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }],
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude avböjde');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('Oväntat svar'); }
}

// ---- analys av spelarens text ----
export const ANALYSIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    dominant: { type: 'string', enum: ['saklig', 'kampande', 'aggressiv', 'humor', 'kansla', 'undvikande'] },
    clarity: { type: 'number' }, answers: { type: 'number' }, vague: { type: 'boolean' }, risky: { type: 'integer' },
    issues: { type: 'array', items: { type: 'string' } },
    stance: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { issue: { type: 'string' }, dir: { type: 'number' } }, required: ['issue', 'dir'] } },
    promises: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' }, number: { type: ['number', 'null'] }, unit: { type: ['string', 'null'] }, issue: { type: ['string', 'null'] }, absolute: { type: 'boolean' } }, required: ['text', 'number', 'unit', 'issue', 'absolute'] } },
    claims: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { stat: { type: 'string' }, value: { type: 'number' } }, required: ['stat', 'value'] } },
    attacks: { type: 'array', items: { type: 'string' } },
    contradiction: { type: ['string', 'null'] },
    summary: { type: 'string' },
  },
  required: ['dominant', 'clarity', 'answers', 'vague', 'risky', 'issues', 'stance', 'promises', 'claims', 'attacks', 'contradiction', 'summary'],
};
export async function llmAnalyze(text, ctx) {
  const prompt = `Analysera partiledarens text. Kontext:
- Partiet: ${ctx.partyName} (${ctx.abbr}). Ideologi: ${ctx.ideology}.
- Frågeaxlar (id: beskrivning): ${ctx.issueList}
- Partier i spelet (id: namn): ${ctx.partyList}
- Aktuell statistik (id: värde): ${ctx.statList}
${ctx.question ? `- Texten är ett svar på frågan: "${ctx.question}"` : ''}
${ctx.history ? `- Tidigare uttalanden av samma person (för motsägelser): ${ctx.history}` : ''}

Texten:
"""${text}"""

Returnera: dominant ton; clarity 0–1; answers 0–1 (hur väl frågan besvaras, 0.5 om ingen fråga); vague; risky 0–100 (risk att det landar fel/skapar skandal); issues (axel-id:n som berörs); stance (axel-id + dir −1 vänster…+1 höger); promises (konkreta löften med siffra om sådan finns, absolute=true vid "aldrig/alltid"); claims (faktapåståenden om statistik i listan, med stat-id och påstått värde); attacks (parti-id som angrips); contradiction (kort text om texten motsäger tidigare uttalanden, annars null); summary (en mening som en journalist skulle sammanfatta det med).`;
  return askJSON(prompt, ANALYSIS_SCHEMA, { maxTokens: 1200 });
}

// ---- generering av repliker ----
export const REPLIES_SCHEMA = { type: 'object', additionalProperties: false, properties: { replies: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { who: { type: 'string' }, text: { type: 'string' }, tone: { type: 'string' } }, required: ['who', 'text', 'tone'] } } }, required: ['replies'] };
export async function llmReplies(spec) {
  // spec: { situation, playerText, speakers: [{who, role, desc}], count, style }
  const prompt = `Situation: ${spec.situation}
Partiledaren (${spec.playerName}, ${spec.abbr}) sa/skrev:
"""${spec.playerText}"""
${spec.extra || ''}
Skriv ${spec.count} repliker, en per talare i listan (who = exakt namnet):
${spec.speakers.map((s) => `- ${s.who}: ${s.desc}`).join('\n')}
Varje replik 1–3 meningar, på svenska, i figurens röst och ton. Reagera på det som faktiskt sades. tone = en av saklig|aggressiv|humor|kansla|undvikande|stodjande|kritisk.`;
  const r = await askJSON(prompt, REPLIES_SCHEMA, { maxTokens: 1800 });
  return r.replies;
}
export const TEXT_SCHEMA = { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] };
export async function llmText(prompt, maxTokens = 600) { const r = await askJSON(prompt + '\nSvara med JSON {"text": "..."}', TEXT_SCHEMA, { maxTokens }); return r.text; }
// Snabbtest av nyckeln
export async function llmPing() { const r = await askJSON('Svara med JSON {"text": "ok"}', TEXT_SCHEMA, { maxTokens: 50 }); return r.text; }
