// Politiskt minne: allt spelaren skriver sparas med analys. Används för motsägelser, gamla inlägg
// som grävs fram, löfteskoll av fritextlöften, journalisters research och den växande "personan".
import { ISSUES, ISSUE_BY_ID } from '../data/issues.js';
import { STAT_BY_ID } from '../data/stats.js';
import { clamp, fmt } from '../core/util.js';
import { analyzeText, toneLabel } from './analyze.js';
import { addNews } from '../sim/news.js';

export function initMemory(state) { state.memory ||= { statements: [], persona: { saklig: 0, kampande: 0, aggressiv: 0, humor: 0, kansla: 0, undvikande: 0, n: 0 }, promises: [], corrections: 0 }; return state.memory; }

// Analysera + spara. kind: 'post'|'debate'|'interview'|'press'|'speech'|'negotiation'|'talk'|'program'|'riksdag'
export function recordStatement(state, text, kind, { question = null, questionIssue = null, audience = 'public', analysis = null } = {}) {
  const mem = initMemory(state);
  const me = state.parties[state.player.partyId];
  const ctx = { stats: state.sweden.stats, parties: Object.values(state.parties).filter((p) => p.active !== false && !p.isPlayer), people: Object.values(state.people).filter((p) => p.role === 'leader' || p.role === 'minister').slice(0, 40), question, questionIssue };
  const a = analysis || analyzeText(text, ctx);
  // motsägelser mot partiets program/axlar och tidigare uttalanden
  const contradictions = [];
  for (const id in a.stance) { const pos = me.pos[id] || 0; if (Math.abs(pos) > 30 && Math.sign(pos) !== Math.sign(a.stance[id]) && Math.abs(a.stance[id]) > .3) contradictions.push({ type: 'program', issue: id, text: `Partiprogrammet lutar ${pos < 0 ? 'åt vänster' : 'åt höger'} om ${ISSUE_BY_ID[id].name.toLowerCase()}, men uttalandet går åt andra hållet.` }); }
  for (const old of mem.statements.slice(-60)) { for (const id in a.stance) { if (old.stance?.[id] != null && Math.sign(old.stance[id]) !== Math.sign(a.stance[id]) && Math.abs(old.stance[id]) > .3 && Math.abs(a.stance[id]) > .3) { contradictions.push({ type: 'old', issue: id, week: old.week, text: `Vecka ${old.week} (${old.kind}) sa ni: "${old.text.slice(0, 90)}…" – nu säger ni tvärtom om ${ISSUE_BY_ID[id].name.toLowerCase()}.`, old }); break; } } if (contradictions.length > 2) break; }
  if (a.contradiction) contradictions.push({ type: 'llm', text: a.contradiction });
  const s = { id: 'st' + state.week + '_' + Math.floor(Math.random() * 1e6).toString(36), week: state.week, date: { ...state.date }, kind, audience, text: text.slice(0, 600), question, dominant: a.dominant, tone: a.tone, clarity: a.clarity, answers: a.answers, issues: Object.keys(a.issues || {}), stance: a.stance, promises: a.promises, claims: a.claims, attacks: a.attacks, risky: a.risky, contradictions: contradictions.map((c) => c.text), summary: a.summary || null, deleted: false, resurfaced: false };
  mem.statements.push(s); if (mem.statements.length > 400) mem.statements.shift();
  // personan: glidande medel
  const P = mem.persona; P.n++; for (const k of ['saklig', 'kampande', 'aggressiv', 'humor', 'kansla', 'undvikande']) P[k] = P[k] * .9 + (a.dominant === k ? 1 : 0) * .1;
  // löften med siffror sparas för löfteskollen
  for (const pr of a.promises || []) if (pr.number != null || pr.absolute) mem.promises.push({ id: s.id, text: pr.text, number: pr.number, unit: pr.unit, issue: pr.issue, week: state.week, year: state.date.y, kind, absolute: !!pr.absolute, checked: null, stat: promiseStat(pr), baseline: promiseStat(pr) ? state.sweden.stats[promiseStat(pr)] : null });
  return { analysis: a, statement: s, contradictions: contradictions.map((c) => c.text) };
}
function promiseStat(pr) {
  const t = (pr.text || '').toLowerCase();
  if (/bostäder|bostad/.test(t)) return 'byggstarter';
  if (/poliser/.test(t)) return 'poliser';
  if (/arbetslös/.test(t)) return 'arbetsloshet';
  if (/vårdkö|väntetid/.test(t)) return 'vardkoer';
  if (/utsläpp/.test(t)) return 'utslapp';
  if (/skjutning/.test(t)) return 'skjutningar';
  if (/skatt/.test(t)) return 'skattekvot';
  if (/soldat|försvar/.test(t)) return 'utg_forsvar';
  if (/lärare/.test(t)) return 'behoriga_larare';
  return null;
}
// Personabeskrivning som medier använder
export function personaLabel(state) {
  const P = state.memory?.persona; if (!P || P.n < 3) return null;
  const top = Object.entries(P).filter(([k]) => k !== 'n').sort((a, b) => b[1] - a[1]);
  const [k1, v1] = top[0], [k2, v2] = top[1];
  const l1 = toneLabel(k1), l2 = toneLabel(k2);
  return v1 > .5 ? `utpräglat ${l1}` : v2 > .25 ? `${l1} och ${l2}` : l1;
}
// Faktakoll av påståenden (körs direkt när något publiceras offentligt)
export function factCheck(state, statement) {
  const wrong = (statement.claims || []).filter((c) => c.ok === false);
  if (!wrong.length) return null;
  const me = state.parties[state.player.partyId]; const l = state.people[me.leader];
  const c = wrong[0]; const st = STAT_BY_ID[c.stat];
  me.trust = clamp((me.trust ?? 50) - 3, 0, 100); me.credibility = clamp(me.credibility - 2, 0, 100);
  addNews(state, { outlet: 'svt', headline: `Faktakoll: ${l.name} hade fel om ${st?.name.toLowerCase() || c.name}`, body: `${l.name} påstod att ${st?.name.toLowerCase() || c.name} är ${fmt(c.value, st?.d ?? 1)} ${st?.unit || ''}. Den faktiska siffran är ${fmt(c.actual, st?.d ?? 1)} ${st?.unit || ''}. ${l.first} kan rätta sig – det brukar uppskattas.`, tags: ['faktakoll', 'skandal'], partyId: me.id, importance: 2, tone: -1 });
  statement.factChecked = c;
  return c;
}
export function correctClaim(state, statement) {
  const me = state.parties[state.player.partyId]; const l = state.people[me.leader];
  const c = statement.factChecked; if (!c) return;
  me.trust = clamp((me.trust ?? 50) + 4, 0, 100); state.memory.corrections++;
  const st = STAT_BY_ID[c.stat];
  addNews(state, { outlet: 'dn', headline: `${l.name} rättar sig: "Jag angav fel siffra"`, body: `"Den korrekta siffran är ${fmt(c.actual, st?.d ?? 1)} ${st?.unit || ''}. Jag ber om ursäkt." Rättelsen tas emot väl.`, tags: ['faktakoll'], partyId: me.id, importance: 1, tone: 1 });
  statement.corrected = true;
}
// Ett gammalt uttalande som motsäger dagens linje – journalisternas favorit
export function digOldStatement(state, rnd) {
  const mem = state.memory; if (!mem) return null;
  const me = state.parties[state.player.partyId];
  const cands = mem.statements.filter((s) => !s.resurfaced && !s.deleted && state.week - s.week > 20 && (s.risky > 35 || Object.keys(s.stance || {}).some((id) => Math.abs(me.pos[id] || 0) > 30 && Math.sign(me.pos[id]) !== Math.sign(s.stance[id]) && Math.abs(s.stance[id]) > .3)));
  if (!cands.length) return null;
  const s = cands[Math.floor(rnd() * cands.length)];
  s.resurfaced = true;
  return s;
}
// Löfteskollen för fritextlöften (körs vid valrörelsens start och när en mandatperiod gått)
export function checkTextPromises(state) {
  const mem = state.memory; if (!mem) return [];
  const out = [];
  for (const pr of mem.promises) {
    if (pr.checked != null || state.date.y - pr.year < 3) continue;
    if (!pr.stat || pr.baseline == null) { pr.checked = 'oklart'; out.push(pr); continue; }
    const now = state.sweden.stats[pr.stat]; const st = STAT_BY_ID[pr.stat];
    const good = st?.good; const improved = good === 'down' ? now < pr.baseline : now > pr.baseline;
    const delta = Math.abs(now - pr.baseline);
    pr.checked = improved && (pr.number == null || delta >= pr.number * .5 || pr.unit === '%' || pr.unit === 'procent') ? (pr.number != null && delta < pr.number * .9 && pr.unit !== '%' && pr.unit !== 'procent' ? 'delvis' : 'hållet') : 'brutet';
    out.push(pr);
  }
  return out;
}
export const statementKindLabel = (k) => ({ post: 'inlägg', debate: 'debatt', interview: 'intervju', press: 'presskonferens', speech: 'tal', negotiation: 'förhandling', talk: 'samtal', program: 'program', riksdag: 'riksdagen', podd: 'podd' })[k] || k;
