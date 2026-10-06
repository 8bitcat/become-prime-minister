// Jämför modeller i Ollama på spelets egna uppgifter: analysen av det spelaren skriver (samma prompt och
// samma JSON-schema som spelet) och repliker från motståndare. Mäter träffsäkerhet och tid.
//   node tools/ollama-lab.mjs gemma4:12b qwen3.5:9b     (Ollama på http://localhost:11434, eller OLLAMA_URL)
import { analysisMessages, fromLocalAnalysis, repliesMessages } from '../js/ai/prompts.js';
const URL_ = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : ['gemma4:12b', 'qwen3.5:9b'];
const PARTIES = [{ id: 's', abbr: 'S' }, { id: 'sd', abbr: 'SD' }, { id: 'm', abbr: 'M' }, { id: 'v', abbr: 'V' }, { id: 'c', abbr: 'C' }, { id: 'kd', abbr: 'KD' }, { id: 'mp', abbr: 'MP' }, { id: 'l', abbr: 'L' }];
const CASES = [
  { text: 'Du är en lögnare och en idiot, Lena Berg. Ni i Vänsterpartiet har förstört Sverige!', counterpart: 'Lena Berg (V)', check: (a) => a.emotion.insult >= .9 && a.attacks.includes('v') && /aggressiv|dryg/.test(a.dominant), want: 'förolämpning mot V, aggressiv' },
  { text: 'Jag vill faktiskt ge Johan Ek en eloge. Hans arbete med äldreomsorgen har varit klokt och modigt.', counterpart: 'Johan Ek (KD)', check: (a) => a.emotion.praise >= .5 && !(a.emotion.insult > 0) && a.topics.includes('valfard'), want: 'beröm, äldreomsorg' },
  { text: 'Jaha, så regeringens plan för lägre elpriser är vindkraft om tio år. Briljant. Pensionärerna kan ju frysa så länge.', check: (a) => a.topics.includes('energi') && /humor|aggressiv|dryg|kampande/.test(a.dominant), want: 'ironi om energi' },
  { text: 'Vi sänker skatten för vanliga löntagare med 500 kronor i månaden och betalar det genom att trappa ned ränteavdraget.', check: (a) => a.topics.includes('ekonomi') && (a.stance.ekonomi || 0) > 0 && a.promisesText.length >= 1, want: 'skattesänkning (höger på ekonomi), löfte' },
  { text: 'Sverige måste införa ett totalt invandringsstopp och skicka hem 300 000 personer om året.', check: (a) => a.topics.includes('migration') && (a.stance.migration || 0) > 0, want: 'restriktiv migration' },
  { text: 'Min mamma är undersköterska och jobbar delade turer för 26 000 i månaden. Det håller inte, och alla här vet det.', check: (a) => a.topics.some((t) => ['valfard', 'arbete'].includes(t)) && /kansla|kampande|saklig/.test(a.dominant), want: 'personlig berättelse, välfärd/arbete' },
  { text: 'Det där är en bra fråga, men jag tycker vi ska prata om framtiden i stället.', question: 'Kommer ni att höja skatten?', check: (a) => a.dominant === 'undvikande' || (a.answers != null && a.answers <= .2), want: 'undviker frågan' },
  { text: 'Lilla vän, du har uppenbarligen inte läst budgeten. Låt de vuxna sköta ekonomin.', counterpart: 'Anna Ström (MP)', check: (a) => a.dominant === 'dryg' || (a.dryg || 0) > .4, want: 'dryg' },
];
async function chat(model, messages, schema, max) {
  const t0 = Date.now();
  const r = await fetch(URL_ + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, stream: false, think: false, keep_alive: '30m', format: schema, options: { temperature: .1, top_p: .9, num_predict: max, num_ctx: 4096, ...(/gemma4/.test(model) ? { draft_num_predict: 0 } : {}) } }) });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return { txt: j.message.content, ms: Date.now() - t0, tok: j.eval_count || 0, evalMs: (j.eval_duration || 0) / 1e6, promptTok: j.prompt_eval_count || 0 };
}
for (const model of MODELS) {
  console.log(`\n=== ${model} ===`);
  await chat(model, [{ role: 'user', content: 'ok' }], undefined, 2).catch((e) => console.log('  väckning:', e.message));
  let hit = 0, time = 0, toks = 0, evalMs = 0;
  for (const c of CASES) {
    const { messages, schema } = analysisMessages({ text: c.text, question: c.question || null, kind: c.question ? 'svar på fråga' : 'debattinlägg', counterpart: c.counterpart || null, parties: PARTIES.map((p) => p.abbr) });
    try {
      const r = await chat(model, messages, schema, 260);
      const a = fromLocalAnalysis(JSON.parse(r.txt), PARTIES); if (process.env.RAW && !c.check(a)) console.log("    RAW", r.txt.replace(/\s+/g, " ").slice(0, 600));
      const good = !!c.check(a); hit += good; time += r.ms; toks += r.tok; evalMs += r.evalMs;
      console.log(`  ${good ? '✓' : '✗'} ${c.want.padEnd(40)} ${String(r.ms).padStart(5)} ms · ${a.dominant} · ${a.topics.join(',')} · "${(a.summary || '').slice(0, 90)}"`);
    } catch (e) { console.log(`  ✗ ${c.want}: ${e.message}`); }
  }
  console.log(`  Analys: ${hit}/${CASES.length} rätt · snitt ${(time / CASES.length / 1000).toFixed(1)} s per analys · ${(toks / (evalMs / 1000 || 1)).toFixed(0)} token/s`);
  const { messages, schema } = repliesMessages({ situation: 'TV-debatt i SVT om sjukvården. Publiken i studion.', playerName: 'Sara Lind', playerText: 'Mormor fick ligga nio timmar i en korridor på akuten. Ni har haft makten i åtta år – vad har ni gjort?', speakers: [{ who: 'Karin Lund', desc: 'statsminister (M), pressad men saklig, försvarar regeringens satsningar' }, { who: 'Journalisten', desc: 'programledaren, ställer en skarp följdfråga' }] });
  try { const r = await chat(model, messages, schema, 300); const j = JSON.parse(r.txt); console.log(`  Repliker (${(r.ms / 1000).toFixed(1)} s):`); for (const x of j.repliker || []) console.log(`    ${x.vem}: ${x.text}`); } catch (e) { console.log('  repliker:', e.message); }
}
