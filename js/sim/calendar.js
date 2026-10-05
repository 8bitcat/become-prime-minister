// Den politiska kalendern i Sverige: återkommande händelser som ger spelet en verklig rytm – och som
// spelaren möter med egna ord (tal, regeringsförklaring, frågestund). Datumen är ungefärliga men följer
// verkligheten: Folk och Försvar i Sälen i januari, partiledardebatter i januari och juni, Järvaveckan
// och Almedalen på försommaren, riksdagens öppnande i september, EU-val vart femte år, juluppehåll.
import { ISSUES, ISSUE_BY_ID } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { clamp, pick, fmt, cmpDate, dayDiff } from '../core/util.js';
import { addNews } from './news.js';
import { activeParties } from './opinion.js';
import { isPlayerPM, playerInGov } from './government.js';
import { recordStatement, factCheck } from '../ai/memory.js';

const me = (s) => s.parties[s.player.partyId];
const leader = (s) => s.people[me(s).leader];
const inWeek = (prev, now, m, d) => { const y = now.y; for (const yy of [y - 1, y]) { const t = { y: yy, m, d }; if (cmpDate(t, prev) > 0 && cmpDate(t, now) <= 0) return true; } return false; };

// Talen: vilken publik, vilken fråga, hur stort genomslag
export const SPEECH_EVENTS = {
  folkforsvar: { title: 'Folk och Försvar i Sälen', place: 'Sälen', intro: 'Partiledarna talar om säkerhetsläget, försvaret och beredskapen inför försvarsmakten, myndigheterna och medierna.', issue: 'forsvar', segs: ['hoginkomst', 'landsbygd', 'pensionarer'], media: 1.2, ph: 'Säkerhetsläget är allvarligt. Sverige behöver …' },
  jarva: { title: 'Järvaveckan', place: 'Järvafältet', intro: 'Mötesplatsen i Järva. Publiken är ung, flerspråkig och trött på politiker som bara kommer vart fjärde år.', issue: 'kriminal', segs: ['utrikes_fodda', 'storstad_unga', 'forort_familjer', 'laginkomst'], media: 1.1, ph: 'Jag har inte kommit hit för att prata om er – utan med er …' },
  almedalen: { title: 'Almedalsveckan i Visby', place: 'Almedalen, Visby', intro: 'Er dag i Almedalen. Hela politiska Sverige lyssnar – journalister, lobbyister, väljare på semester. Ett bra tal sätter agendan för hösten.', issue: null, segs: SEGMENTS.map((g) => g.id), media: 2, ph: 'Kära Almedalen! …' },
  regeringsforklaring: { title: 'Regeringsförklaringen', place: 'Riksdagens kammare', intro: 'Riksdagens öppnande. Som statsminister läser du upp regeringsförklaringen: vad regeringen ska göra det kommande året.', issue: null, segs: SEGMENTS.map((g) => g.id), media: 1.6, ph: 'Herr talman, ärade ledamöter. Sverige står inför …' },
};

// Kallas varje vecka från endWeek. Returnerar köposter.
export function calendarWeek(state, rnd, prev, report) {
  const out = []; const now = state.date; const p = me(state); const l = leader(state);
  const electionYear = state.election.next.y === now.y;
  const C = (m, d) => inWeek(prev, now, m, d);
  if (C(1, 11)) out.push(p.inRiksdag || (state.opinion.support[p.id] || 0) > 2 ? { type: 'speechEvent', event: 'folkforsvar' } : null), aiSpeeches(state, rnd, 'folkforsvar');
  if ((C(1, 15) || C(6, 11)) && p.inRiksdag && !state.election.campaign) out.push({ type: 'debate', debate: 'riksdag', name: `Partiledardebatt i riksdagen (${now.m === 1 ? 'januari' : 'juni'})` });
  if (C(4, 15)) springBudget(state, rnd, report);
  if (C(6, 4)) out.push({ type: 'speechEvent', event: 'jarva' }), aiSpeeches(state, rnd, 'jarva');
  if (C(6, 21)) addNews(state, { outlet: 'svt', headline: 'Midsommar – politikerna tar ledigt', body: 'Riksdagen har gått på sommaruppehåll. Nästa stora politiska händelse är Almedalsveckan i Visby.', tags: ['politik'], importance: 1 });
  if (C(6, 29)) { out.push({ type: 'speechEvent', event: 'almedalen' }); aiSpeeches(state, rnd, 'almedalen'); }
  const open = electionYear ? { m: 9, d: 30 } : { m: 9, d: 9 };
  if (C(open.m, open.d)) { if (isPlayerPM(state)) out.push({ type: 'speechEvent', event: 'regeringsforklaring' }); else riksmote(state, rnd); }
  if (C(12, 20)) addNews(state, { outlet: 'svt', headline: 'Riksdagen går på juluppehåll', body: 'Kammaren samlas igen i mitten av januari. Partiledarna summerar året.', tags: ['politik'], importance: 1 });
  // EU-val: andra söndagen i juni vart femte år (2029, 2034 …)
  if ((now.y - 2024) % 5 === 0 && C(6, 9)) euElection(state, rnd, report);
  // frågestund (torsdagar när riksdagen sammanträder): statsministern får frågor av oppositionen
  if (state.riksdag.session && isPlayerPM(state) && rnd() < .3) out.push({ type: 'fragestund' });
  return out.filter(Boolean);
}

function aiSpeeches(state, rnd, ev) {
  const E = SPEECH_EVENTS[ev]; const others = activeParties(state).filter((q) => !q.isPlayer && q.inRiksdag);
  if (!others.length) return;
  const q = pick(rnd, others); const ql = state.people[q.leader];
  const issue = E.issue ? ISSUE_BY_ID[E.issue] : [...ISSUES].sort((a, b) => (state.opinion.salience[b.id] || 1) * (q.profile?.[b.id] || 1) - (state.opinion.salience[a.id] || 1) * (q.profile?.[a.id] || 1))[0];
  const good = rnd() < .5;
  addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'ekot']), headline: good ? `${ql.name} (${q.abbr}) i ${E.place}: "${(q.pos[issue.id] || 0) < 0 ? issue.left : issue.right}"` : `${ql.name}s tal i ${E.place} gick obemärkt förbi`, body: good ? `${q.abbr}-ledaren lyfte ${issue.name.toLowerCase()} och fick starka applåder.` : 'Kommentatorerna kallade talet "förutsägbart".', tags: ['politik'], partyId: q.id, importance: 1 });
  q.attention = clamp(q.attention + (good ? 4 : 1) * E.media, 0, 100);
}
function springBudget(state, rnd, report) {
  const gov = state.government; if (!gov.pmParty) return;
  if (isPlayerPM(state)) { report.items.push('📑 Vårändringsbudgeten lämnas till riksdagen – regeringens justeringar av årets budget (ändra under Regeringen → Budgeten).'); return; }
  addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'ekot']), headline: `Vårändringsbudgeten: regeringen ${state.sweden.stats.budgetsaldo < 0 ? 'lånar till nya satsningar' : 'satsar på ' + pick(rnd, ['polisen', 'vården', 'försvaret', 'skolan'])}`, body: `Finansministern presenterade vårändringsbudgeten. Oppositionen kallar den ${pick(rnd, ['otillräcklig', 'ansvarslös', 'ett lappande och lagande'])}.`, tags: ['politik', 'ekonomi'], importance: 2 });
}
function riksmote(state, rnd) {
  const gov = state.government; if (!gov.pm) return;
  const pm = state.people[gov.pm];
  addNews(state, { outlet: 'svt', headline: `Riksdagens öppnande: ${pm.name} läste regeringsförklaringen`, body: `Regeringen lovar satsningar på ${pick(rnd, ['tryggheten', 'vården', 'jobben', 'försvaret', 'klimatet'])}. ${playerInGov(state) ? 'Ert parti ingår i regeringen.' : 'Oppositionen dömer ut förklaringen som "tomma ord".'}`, tags: ['politik'], importance: 2 });
}
function euElection(state, rnd, report) {
  const parties = activeParties(state); const turnout = 50 + rnd() * 10;
  const res = parties.map((q) => ({ q, v: Math.max(0, (state.opinion.support[q.id] || 0) * (q.pos?.eu < -30 ? 1.15 : q.pos?.eu > 30 ? 1.05 : 1) + (rnd() - .5) * 1.5) }));
  const tot = res.reduce((a, x) => a + x.v, 0) || 1; for (const x of res) x.pct = x.v / tot * 100;
  res.sort((a, b) => b.pct - a.pct);
  const mine = res.find((x) => x.q.isPlayer);
  state.history.timeline.push({ date: { ...state.date }, week: state.week, kind: 'val', text: `EU-val: ${res.slice(0, 4).map((x) => `${x.q.abbr} ${fmt(x.pct, 1)} %`).join(', ')}. Valdeltagande ${fmt(turnout, 0)} %.` });
  addNews(state, { outlet: 'svt', headline: `EU-valet: ${res[0].q.abbr} störst – ${mine ? `${mine.q.abbr} fick ${fmt(mine.pct, 1)} %` : ''}`, body: `Valdeltagandet stannade på ${fmt(turnout, 0)} procent. ${res.slice(0, 5).map((x) => `${x.q.abbr} ${fmt(x.pct, 1)}`).join(', ')}. Resultatet ses som ett test inför riksdagsvalet.`, tags: ['val'], importance: 3 });
  if (mine) { const p = mine.q; const gain = mine.pct - (state.opinion.support[p.id] || 0); p.attention = clamp(p.attention + 8, 0, 100); p.momentum = (p.momentum || 0) + gain * .05; report.items.push(`🇪🇺 EU-valet: ni fick ${fmt(mine.pct, 1)} % (${gain >= 0 ? '+' : ''}${fmt(gain, 1)} mot opinionen).`); }
}

// Talet vid en kalenderhändelse. reactions = speechReactions(...) från ai/generate.js
export function eventSpeechOutcome(state, rnd, ev, text, reactions, analysis) {
  const E = SPEECH_EVENTS[ev]; const p = me(state); const l = leader(state);
  const score = reactions.score; const best = reactions.lines.slice().sort((a, b) => b.v - a.v)[0];
  const rec = recordStatement(state, text, 'speech', { audience: 'public', analysis });
  factCheck(state, rec.statement);
  const eff = clamp(score / 60, -1, 1) * E.media;
  p.attention = clamp(p.attention + 6 * E.media + Math.max(0, eff) * 6, 0, 100);
  const aw = state.opinion.awareness[p.id] ?? 1; if (aw < 1) state.opinion.awareness[p.id] = clamp(aw + .02 * E.media, 0, 1);
  for (const sid of E.segs) { const seg = state.opinion.seg[sid]; if (seg) seg[p.id] = Math.max(.01, (seg[p.id] || .1) + eff * .18 * (E.segs.length > 6 ? .6 : 1)); }
  if (E.issue) { p.profile[E.issue] = Math.min(2.5, (p.profile[E.issue] || 1) + Math.max(0, eff) * .15); state.opinion.boost[E.issue] = (state.opinion.boost[E.issue] || 0) + .2; }
  for (const id of analysis?.topics?.slice(0, 2) || []) state.opinion.boost[id] = (state.opinion.boost[id] || 0) + .15 * E.media;
  p.credibility = clamp(p.credibility + eff * 2 - (rec.contradictions.length ? 2 : 0), 0, 100);
  if (ev === 'regeringsforklaring') { state.government.approval = clamp(state.government.approval + eff * 4, 0, 100); state.government.capital = clamp((state.government.capital ?? 50) + Math.max(0, eff) * 6, 0, 100); }
  const quote = (analysis?.summary || best?.s || text).slice(0, 90);
  addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'aftonbladet', 'ekot']), headline: score > 18 ? `${l.name} i ${E.place}: "${best.s.slice(0, 70)}"` : score < -12 ? `${l.name}s tal i ${E.place} föll platt` : `${l.name} talade i ${E.place}`, body: `${E.title}: ${score > 18 ? `starkt mottagande. ${quote}` : score < -12 ? 'Publiken var sval och kommentatorerna kritiska.' : 'Ett ordentligt men försiktigt tal.'}`, tags: ['politik'], partyId: p.id, importance: E.media >= 1.6 ? 3 : 2, tone: score > 18 ? 1 : score < -12 ? -1 : 0 });
  return { score, eff, contradictions: rec.contradictions };
}

// Frågestund: en oppositionsledare frågar statsministern (spelaren) – frågan utgår från det som skaver
export function fragestundQuestion(state, rnd) {
  const opp = activeParties(state).filter((q) => !q.isPlayer && q.inRiksdag && !state.government.parties.includes(q.id));
  const q = opp.length ? pick(rnd, opp) : pick(rnd, activeParties(state).filter((x) => !x.isPlayer));
  const ql = state.people[q.leader]; const s = state.sweden.stats;
  const hot = [...ISSUES].sort((a, b) => (state.opinion.salience[b.id] || 1) - (state.opinion.salience[a.id] || 1))[0];
  const cands = [
    s.skjutningar > 300 && `Skjutningarna fortsätter – ${fmt(s.skjutningar, 0)} på ett år. När ska statsministern ta ansvar för tryggheten?`,
    s.vardkoer > 100 && `Vårdköerna är ${fmt(s.vardkoer, 0)} dagar. Vad säger statsministern till alla som väntar?`,
    s.arbetsloshet > 8 && `Arbetslösheten ligger på ${fmt(s.arbetsloshet, 1)} procent. Var är regeringens jobbpolitik?`,
    s.inflation > 3.5 && `Inflationen äter upp lönerna – ${fmt(s.inflation, 1)} procent. Vad gör regeringen för vanliga hushåll?`,
    s.elpris > 110 && `Elpriset är ${fmt(s.elpris, 0)} öre. Hur länge ska hushållen betala för regeringens energipolitik?`,
    `Min fråga gäller ${hot.name.toLowerCase()}. Varför har regeringen inte levererat det den lovade?`,
    (state.scandals || []).find((x) => x.active && state.government.parties.includes(x.partyId)) && `Hur kan statsministern ha förtroende för en regering som skakas av skandaler?`,
  ].filter(Boolean);
  return { partyId: q.id, askerId: ql.id, asker: ql.name, abbr: q.abbr, question: pick(rnd, cands), issue: hot.id };
}
export function fragestundOutcome(state, rnd, fq, text, a, noComment) {
  const p = me(state); const l = leader(state); const q = state.parties[fq.partyId];
  if (!noComment) recordStatement(state, text, 'riksdag', { question: fq.question, questionIssue: fq.issue, analysis: a });
  let delta = noComment ? -4 : (a.answers - .5) * 8 + (a.dominant === 'saklig' ? 2 : a.dominant === 'aggressiv' ? -3 : a.dominant === 'dryg' ? -4 : a.dominant === 'undvikande' ? -3 : 1) + ((a.claims || []).filter((c) => c.ok === false).length ? -4 : 0) + ((a.emotion?.insult || 0) > .3 ? -5 : 0);
  state.government.approval = clamp(state.government.approval + delta * .3, 0, 100);
  p.credibility = clamp(p.credibility + delta * .25, 0, 100);
  if (q) q.relations[p.id] = clamp((q.relations[p.id] || 0) + ((a.emotion?.insult || 0) > .3 || a.dominant === 'dryg' ? -6 : (a.emotion?.praise || 0) > .3 ? 3 : 0), -100, 100);
  addNews(state, { outlet: pick(rnd, ['svt', 'ekot', 'dn']), headline: delta > 2 ? `Frågestunden: ${l.name} gav ${fq.asker} svar på tal` : delta < -2 ? `Frågestunden: ${l.name} pressad av ${fq.asker} (${fq.abbr})` : `Frågestund i riksdagen om ${ISSUE_BY_ID[fq.issue]?.name.toLowerCase()}`, body: noComment ? 'Statsministern valde att inte svara i sak.' : `"${text.slice(0, 120)}${text.length > 120 ? '…' : ''}"`, tags: ['riksdag'], partyId: p.id, importance: Math.abs(delta) > 3 ? 2 : 1, tone: delta > 2 ? 1 : delta < -2 ? -1 : 0 });
  return { delta };
}
// Frågestund åt andra hållet: spelaren (i opposition) frågar statsministern
export function askPmOutcome(state, rnd, text, a) {
  const p = me(state); const l = leader(state); const gov = state.government; const pm = gov.pm ? state.people[gov.pm] : null;
  recordStatement(state, text, 'riksdag', { analysis: a });
  const sharp = clamp(.3 + a.clarity * .4 + ((a.claims || []).filter((c) => c.ok).length ? .15 : 0) - ((a.claims || []).filter((c) => c.ok === false).length ? .3 : 0) + (a.dominant === 'aggressiv' ? .05 : 0) - (a.dominant === 'dryg' ? .15 : 0), 0, 1);
  const hit = rnd() < sharp;
  p.attention = clamp(p.attention + 3 + (hit ? 4 : 0), 0, 100);
  if (hit) { gov.approval = clamp(gov.approval - 1.5, 0, 100); p.credibility = clamp(p.credibility + 1, 0, 100); }
  addNews(state, { outlet: pick(rnd, ['svt', 'ekot']), headline: hit ? `${l.name} satte press på ${pm?.name || 'statsministern'} i frågestunden` : `Frågestund: ${pm?.name || 'statsministern'} parerade ${l.name}s fråga`, body: `"${text.slice(0, 120)}${text.length > 120 ? '…' : ''}"`, tags: ['riksdag'], partyId: p.id, importance: hit ? 2 : 1, tone: hit ? 1 : 0 });
  return { hit, pm };
}
