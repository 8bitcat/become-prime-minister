// Repliker från världen: kommentarsfält, journalisters följdfrågor, motståndares svar, publikens
// reaktioner, rubriker. Textmallar utan nätverk; med Claude-läget skriver modellen replikerna.
import { ISSUE_BY_ID, ISSUES } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { pick, fmt, clamp } from '../core/util.js';
import { llmEnabled, llmReplies, llmText, llmAnalyze } from './llm.js';
import { analyzeText } from './analyze.js';
import { ideologyLabel } from '../data/ideologies.js';
import { STAT_BY_ID } from '../data/stats.js';

const me = (s) => s.parties[s.player.partyId];
const COMMENTERS = [
  { who: 'Anna, 19, student', seg: 'studenter', style: 'ung' }, { who: 'Lasse, 64, företagare', seg: 'foretagare', style: 'rak' }, { who: 'Fatima, 34, sjuksköterska', seg: 'offentlig', style: 'saklig' },
  { who: 'Göran, 71, pensionär', seg: 'pensionarer', style: 'orolig' }, { who: 'Elin, 28, Stockholm', seg: 'storstad_unga', style: 'ironisk' }, { who: 'Mats, 45, industriarbetare', seg: 'industri', style: 'rak' },
  { who: 'Sara, 39, lärare', seg: 'offentlig', style: 'saklig' }, { who: 'Jonas, 52, lantbrukare', seg: 'landsbygd', style: 'rak' }, { who: 'Amir, 31, Malmö', seg: 'utrikes_fodda', style: 'kritisk' }, { who: 'Kristina, 58, ekonom', seg: 'hoginkomst', style: 'analytisk' },
];
const T = {
  stod: ['Äntligen någon som säger det!', 'Tack! Det här är precis vad vi behöver.', 'Du har min röst.', 'Så bra formulerat. Delar!', 'Ni är de enda som fattar.'],
  fraga: ['Hur ska ni finansiera det?', 'Vad betyder det här konkret för mig?', 'Källa?', 'Och när då? Inom mandatperioden?', 'Vad säger ni till dem som drabbas?'],
  kritik: ['Tomma ord, som vanligt.', 'Ni lovade samma sak förra valet.', 'Det här är ren populism.', 'Räkna på det en gång till.', 'Och vem betalar? Vi vanliga.'],
  ironi: ['vad betyder det här ens 😭', 'ok men var är planen', 'politiker-bingo: "satsning" ✅ "tydlighet" ✅', 'stark gjort av er att skriva fem meningar utan innehåll', 'haha nej'],
  oro: ['Jag är orolig för vad det här betyder för vården.', 'Tänk på oss som bor utanför storstäderna.', 'Mina barnbarn ska leva i det här landet.'],
  faktakoll: ['Siffran stämmer inte med SCB.', 'Det där är faktiskt fel – kolla statistiken.', 'Källa på den siffran, tack.'],
};
const segFit = (state, seg, a) => { const sg = SEGMENTS.find((x) => x.id === seg); let s = 0, n = 0; for (const id of Object.keys(a.stance || {})) { const ideal = sg.ideal[id] || 0; s += Math.sign(ideal) === Math.sign(a.stance[id]) ? 1 : -1; n++; } const base = (state.opinion.seg[seg]?.[me(state).id] || 0) / 20; return n ? s / n + base : base - .2; };

// ---- kommentarsfält till ett inlägg ----
export async function commentsFor(state, rnd, post, analysis) {
  const p = me(state); const l = state.people[p.leader];
  const n = clamp(Math.round(3 + post.reach / 150000), 3, 7);
  const commenters = []; const pool = COMMENTERS.slice();
  while (commenters.length < n && pool.length) commenters.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  const extra = [];
  const opp = Object.values(state.parties).filter((q) => !q.isPlayer && q.active !== false && q.inRiksdag);
  if (rnd() < .5 && opp.length) { const q = pick(rnd, opp); extra.push({ who: `${state.people[q.leader].name} (${q.abbr})`, role: 'motståndare', desc: `partiledare för ${q.name}, ${ideologyLabel(q.ideology?.primary, q.ideology?.secondary)}; kritisk men politisk`, partyId: q.id }); }
  if (rnd() < .4) { const j = pick(rnd, Object.values(state.journalists || {})); if (j) extra.push({ who: `${j.name} (${j.outlet === 'svt' ? 'SVT' : j.outlet})`, role: 'journalist', desc: `journalist, bevakar ${ISSUE_BY_ID[j.beat]?.name.toLowerCase() || 'politik'}, ställer en skarp fråga eller begär källa`, journalistId: j.id }); }
  if (post.reach > 200000 && rnd() < .5) { const inf = pick(rnd, Object.values(state.influencers || {})); if (inf) extra.push({ who: inf.name, role: 'influerare', desc: `${inf.platform}-profil med ${fmt(inf.followers)} följare, ${inf.stance > 10 ? 'välvillig' : inf.stance < -10 ? 'kritisk' : 'neutral'}`, influencerId: inf.id }); }
  const speakers = [...commenters.map((c) => ({ who: c.who, role: 'väljare', desc: `${c.who}, ${SEGMENTS.find((x) => x.id === c.seg)?.name.toLowerCase()}, ${c.style}; ${segFit(state, c.seg, analysis) > .2 ? 'gillar partiet' : segFit(state, c.seg, analysis) < -.2 ? 'ogillar partiet' : 'osäker'}`, seg: c.seg })), ...extra];
  let replies = null;
  if (llmEnabled()) { try { const r = await llmReplies({ situation: `Ett inlägg på ${post.platform} av partiledaren. Räckvidd ${fmt(post.reach)}. Skriv kommentarer som i ett riktigt kommentarsfält – korta, olika ton, någon ironisk.`, playerText: post.text, playerName: l.name, abbr: p.abbr, speakers, count: speakers.length }); replies = r.map((x) => ({ who: x.who, text: x.text, tone: x.tone })); } catch (e) { console.warn('LLM', e.message); } }
  if (!replies) replies = speakers.map((sp) => ({ who: sp.who, text: templateComment(state, rnd, sp, analysis, post), tone: 'mall' }));
  // kommentatorerna svarar varandra ibland
  if (rnd() < .5 && replies.length > 2) replies.push({ who: replies[0].who, text: pick(rnd, ['Håller inte med dig där uppe.', 'Precis det jag tänkte!', 'Du missar poängen helt.', 'Läs inlägget igen…']), tone: 'svar' });
  return replies.map((r) => ({ ...r, likes: Math.round(rnd() * post.reach / 400) }));
}
function templateComment(state, rnd, sp, a, post) {
  if (sp.role === 'motståndare') return pick(rnd, [`Deras politik betyder mindre pengar till välfärden. Vi har räknat.`, `Intressant – förra året sa ${state.people[me(state).leader].first} tvärtom.`, `Vi presenterade vårt förslag redan i vintras. Välkommen efter.`, `Tomma löften utan finansiering.`]);
  if (sp.role === 'journalist') return a.claims?.some((c) => c.ok === false) ? pick(rnd, T.faktakoll) : pick(rnd, ['Finansieringen är fortfarande oklar – vi har sökt partiet för en kommentar.', 'Vad är källan till siffran?', 'Hur skiljer sig detta från vad ni sa i april?', 'Vi återkommer med en granskning.']);
  if (sp.role === 'influerare') return pick(rnd, ['Okej det här var faktiskt vettigt, lyssna folk.', 'Jag gör en video om det här i kväll.', 'Nej. Bara nej.', 'Mina följare: vad tycker ni?']);
  const fit = segFit(state, sp.seg, a);
  if (a.claims?.some((c) => c.ok === false) && rnd() < .5) return pick(rnd, T.faktakoll);
  if (sp.desc?.includes('ironisk') || a.vague) return pick(rnd, T.ironi);
  if (fit > .2) return pick(rnd, T.stod);
  if (fit < -.2) return pick(rnd, T.kritik);
  return pick(rnd, sp.desc?.includes('orolig') ? T.oro : T.fraga);
}

// ---- journalistens följdfråga ----
export async function followUp(state, rnd, { question, answer, analysis, journalist, issue, kind }) {
  const p = me(state); const l = state.people[p.leader];
  if (llmEnabled()) { try { const r = await llmReplies({ situation: `${kind === 'podd' ? 'Ett poddsamtal' : 'En TV-utfrågning'}. Programledaren frågade: "${question}". ${analysis.answers < .4 ? 'Svaret besvarade egentligen inte frågan.' : ''} ${analysis.claims?.some((c) => c.ok === false) ? 'Svaret innehöll en felaktig siffra.' : ''} ${analysis.contradiction ? 'Svaret motsäger tidigare uttalanden: ' + analysis.contradiction : ''}`, playerText: answer, playerName: l.name, abbr: p.abbr, speakers: [{ who: journalist?.name || 'Programledaren', desc: `${kind === 'podd' ? 'avslappnad poddvärd' : journalist?.style === 'skarp' ? 'skarp, påläst politisk journalist' : journalist?.style === 'provocerande' ? 'provocerande kvällstidningsjournalist' : 'lugn public service-journalist'}; ställer EN följdfråga eller konstaterar något och går vidare` }], count: 1 }); return r[0]?.text; } catch (e) { console.warn('LLM', e.message); } }
  if (analysis.answers < .35) return pick(rnd, ['Fast det där svarade egentligen inte på frågan. Hur?', 'Jag frågade igen: hur ska det gå till?', 'Det var ett långt svar utan att svara. Siffror, tack.']);
  if (analysis.claims?.some((c) => c.ok === false)) { const c = analysis.claims.find((x) => x.ok === false); return `Nu sa du ${fmt(c.value)} – men den faktiska siffran är ${fmt(c.actual, STAT_BY_ID[c.stat]?.d ?? 1)}. Har du fel underlag?`; }
  if (analysis.promises?.length) return pick(rnd, ['Det är ett nytt löfte. Vad kostar det, och när är det på plats?', 'Ni lovar alltså det här inför valet. Vi noterar det.', 'Och om ni inte lyckas – avgår du då?']);
  if (analysis.dominant === 'aggressiv') return pick(rnd, ['Är det inte lite väl hårda ord?', 'Du låter arg. Varför?', 'Ska vi hålla oss till sakfrågan?']);
  if (analysis.dominant === 'humor') return pick(rnd, [kind === 'podd' ? 'Haha okej – men på allvar nu.' : 'Tittarna vill nog ha ett svar, inte ett skämt.', 'Roligt. Och svaret?']);
  return pick(rnd, ['Okej. Nästa fråga.', 'Tack, det var tydligt.', 'Vi går vidare.']);
}

// ---- motståndarens svar i en debatt ----
export async function opponentReply(state, rnd, { opponentParty, opponent, playerText, analysis, issue, statement }) {
  const p = me(state); const l = state.people[p.leader];
  const is = ISSUE_BY_ID[issue];
  if (llmEnabled()) { try { const r = await llmReplies({ situation: `TV-debatt om ${is?.name.toLowerCase()}. ${opponent.name} (${opponentParty.abbr}, ${ideologyLabel(opponentParty.ideology?.primary, opponentParty.ideology?.secondary)}) sa nyss: "${statement}". Partiledaren svarade. ${analysis.contradiction ? 'Svaret motsäger partiledarens tidigare linje: ' + analysis.contradiction : ''} ${analysis.claims?.some((c) => c.ok === false) ? 'Svaret innehöll en felaktig siffra som motståndaren kan påpeka.' : ''}`, playerText, playerName: l.name, abbr: p.abbr, speakers: [{ who: opponent.name, desc: `partiledare för ${opponentParty.name}; ${opponent.persona?.personality?.join(', ') || 'rutinerad'}; svarar skarpt men politiskt, max 3 meningar, kan ställa en motfråga` }], count: 1 }); return r[0]?.text; } catch (e) { console.warn('LLM', e.message); } }
  if (analysis.claims?.some((c) => c.ok === false)) { const c = analysis.claims.find((x) => x.ok === false); return `Nej. ${STAT_BY_ID[c.stat]?.name || 'Siffran'} är ${fmt(c.actual, STAT_BY_ID[c.stat]?.d ?? 1)}, inte ${fmt(c.value)}. Om ni inte ens kan siffrorna, hur ska ni styra landet?`; }
  if (analysis.contradictions?.length || analysis.contradiction) return pick(rnd, ['Det där är inte vad ni sa för ett år sedan. Vilken linje gäller egentligen?', 'Ni byter fot i den här frågan varje gång det blåser.', 'Väljarna hör att ni säger en sak i dag och en annan i morgon.']);
  if (analysis.dominant === 'aggressiv') return pick(rnd, ['Jag tänker inte sänka mig till den nivån.', 'Personangrepp är det enda ni har när argumenten tar slut.', `Lågt, ${l.first}. Riktigt lågt.`]);
  if (analysis.dominant === 'humor') return pick(rnd, ['Publiken skrattar. Jag gör det inte – det här är allvar.', 'Mycket roligt. Men svara på frågan.']);
  if (analysis.vague || analysis.answers < .35) return pick(rnd, ['Där hör ni – inga svar, bara ord.', 'Det var många ord utan ett enda förslag.', `Vad är ert förslag, ${l.first}? Konkret?`]);
  if (analysis.promises?.length) return pick(rnd, ['Och det är finansierat hur? Med luft?', 'Ett nytt löfte. Lägg det på högen.', 'Vi har hört det förut. Vad hände förra gången?']);
  return pick(rnd, ['Vi kan väl vara överens om att det är komplicerat.', 'Jag känner inte igen den beskrivningen.', 'Det är inte så enkelt som du låter påskina.', `Hur ska ni finansiera det ni just sa?`]);
}

// ---- publikens reaktion på ett tal, mening för mening ----
export function speechReactions(state, rnd, speech, analysis, region) {
  const sentences = speech.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3).slice(0, 14);
  const l = state.people[me(state).leader];
  const kar = (l.traits.karisma - 45) / 100, ret = (l.traits.retorik - 45) / 100;
  let meter = 0; const out = [];
  for (const s of sentences) {
    const a = analyzeText(s, { stats: state.sweden.stats });
    let v = (a.dominant === 'kampande' ? 2 : a.dominant === 'kansla' ? 2 : a.dominant === 'saklig' ? 1 : a.dominant === 'humor' ? (rnd() < .6 ? 2 : -1) : a.dominant === 'aggressiv' ? (rnd() < .5 ? 2 : -2) : 0) + kar * 2 + ret + (a.promises.length ? 1 : 0) + (region && s.toLowerCase().includes(region.name.toLowerCase()) ? 2 : 0) + (rnd() - .5);
    if (s.length > 220) v -= 1;
    meter += v;
    out.push({ s, v, react: v > 2.5 ? pick(rnd, ['jubel', 'applåder', 'stående ovationer']) : v > 1 ? pick(rnd, ['applåder', 'bifall', 'nickar']) : v > -.5 ? pick(rnd, ['tystnad', 'mummel', 'avvaktande']) : v > -2 ? pick(rnd, ['förvirring', 'tystnad', 'några skratt']) : pick(rnd, ['burop', 'visslingar', 'folk tittar på mobilen']) });
  }
  const score = clamp(meter / Math.max(1, sentences.length) * 25, -60, 60);
  return { lines: out, score };
}

// ---- motparten i en förhandling ----
export async function negotiationReply(state, rnd, { party, playerText, analysis, demand, round }) {
  const l = state.people[party.leader]; const pl = state.people[me(state).leader];
  if (llmEnabled()) { try { const r = await llmReplies({ situation: `Regeringsförhandling bakom stängda dörrar, runda ${round}. ${l.name} (${party.abbr}) kräver: "${demand}". Partiledaren svarade. Avgör om ${l.first} accepterar (om spelaren gav något konkret), kräver mer, eller lämnar bordet.`, playerText, playerName: pl.name, abbr: me(state).abbr, speakers: [{ who: l.name, desc: `partiledare för ${party.name}; förhandlar hårt men vill in i regeringen; svarar 1–3 meningar och säger tydligt om det är ett ja, ett nej eller ett motbud` }], count: 1 }); return r[0]?.text; } catch (e) { console.warn('LLM', e.message); } }
  return null;
}

// ---- analys med Claude om det är påslaget, annars regelbaserad ----
export async function analyze(state, text, { question = null, questionIssue = null } = {}) {
  const p = me(state); const l = state.people[p.leader];
  const ctx = { stats: state.sweden.stats, parties: Object.values(state.parties).filter((q) => q.active !== false && !q.isPlayer), people: Object.values(state.people).filter((x) => x.role === 'leader' || x.role === 'minister').slice(0, 40), question, questionIssue };
  const base = analyzeText(text, ctx);
  if (!llmEnabled()) return base;
  try {
    const hist = (state.memory?.statements || []).slice(-8).map((s) => `v${s.week} (${s.kind}): "${s.text.slice(0, 120)}"`).join('\n');
    const r = await llmAnalyze(text, { partyName: p.name, abbr: p.abbr, ideology: ideologyLabel(p.ideology?.primary, p.ideology?.secondary), issueList: ISSUES.map((i) => `${i.id}: ${i.name} (−100 ${i.left} … +100 ${i.right})`).join('; '), partyList: Object.values(state.parties).filter((q) => q.active !== false).map((q) => `${q.id}: ${q.name}`).join(', '), statList: ['arbetsloshet', 'inflation', 'bnp_tillvaxt', 'statsskuld_bnp', 'skjutningar', 'vardkoer', 'elpris', 'asylsokande', 'utslapp', 'poliser', 'styrranta', 'medianlon', 'byggstarter', 'dodligt_vald'].map((id) => `${id}=${fmt(state.sweden.stats[id], STAT_BY_ID[id].d)} ${STAT_BY_ID[id].unit}`).join(', '), question, history: hist });
    const merged = { ...base, dominant: r.dominant, clarity: r.clarity, answers: question ? r.answers : base.answers, vague: r.vague, risky: r.risky, summary: r.summary, contradiction: r.contradiction, llm: true };
    for (const id of r.issues || []) if (ISSUE_BY_ID[id]) merged.issues[id] = Math.max(merged.issues[id] || 0, 1);
    for (const s of r.stance || []) if (ISSUE_BY_ID[s.issue]) merged.stance[s.issue] = clamp(s.dir, -1, 1);
    merged.promises = (r.promises || []).map((x) => ({ ...x, issue: ISSUE_BY_ID[x.issue] ? x.issue : null }));
    merged.claims = (r.claims || []).map((c) => { const actual = state.sweden.stats[c.stat]; const st = STAT_BY_ID[c.stat]; return st ? { stat: c.stat, name: st.name, value: c.value, actual, ok: actual == null ? null : Math.abs(c.value - actual) <= Math.max(Math.abs(actual) * .15, st.d === 0 ? 1 : .3) } : null; }).filter(Boolean);
    merged.attacks = (r.attacks || []).filter((id) => state.parties[id]);
    return merged;
  } catch (e) { console.warn('LLM-analys misslyckades, använder regelbaserad', e.message); return base; }
}
export const generateText = (prompt, max) => (llmEnabled() ? llmText(prompt, max).catch(() => null) : Promise.resolve(null));
