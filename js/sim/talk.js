// Fritext i världen: presskonferensens frågor, talet, enskilda samtal, motbud i förhandlingar,
// erbjudanden i regeringsbildningen, fokusgrupper, utspel – och läckor.
import { ISSUES, ISSUE_BY_ID } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { REGIONS } from '../data/regions.js';
import { STAT_BY_ID } from '../data/stats.js';
import { MEDIA } from '../data/names.js';
import { clamp, pick, fmt } from '../core/util.js';
import { addNews } from './news.js';
import { pickJournalist, adjustJournalist } from './media.js';
import { recordStatement, factCheck, personaLabel } from '../ai/memory.js';
import { toneLabel } from '../ai/analyze.js';
import { llmEnabled, llmReplies } from '../ai/llm.js';
import { localReady, localJSON } from '../ai/local.js';
import { dealMessages } from '../ai/prompts.js';
import { MINISTRIES } from './government.js';
import { activeParties } from './opinion.js';

const me = (s) => s.parties[s.player.partyId];
const leader = (s) => s.people[me(s).leader];
const words = (t) => (t || '').toLowerCase().split(/[^a-zåäö0-9]+/).filter((w) => w.length > 4);
const overlap = (a, b) => { const B = new Set(words(b)); return words(a).filter((w) => B.has(w)).length; };

// ---------- PRESSKONFERENS ----------
export function pressQuestions(state, rnd, issue, a) {
  const p = me(state); const l = leader(state); const is = ISSUE_BY_ID[issue];
  const qs = [];
  const j1 = pickJournalist(state, rnd, issue);
  const stat = state.sweden.stats;
  const hot = [...ISSUES].sort((x, y) => state.opinion.salience[y.id] - state.opinion.salience[x.id]).filter((x) => x.id !== issue)[0];
  // 1. sakfrågan
  let q1;
  if (a.claims?.some((c) => c.ok === false)) { const c = a.claims.find((x) => x.ok === false); q1 = `Du sa att ${c.name.toLowerCase()} är ${fmt(c.value)}. Enligt den officiella statistiken är det ${fmt(c.actual, STAT_BY_ID[c.stat]?.d ?? 1)}. Har du fel underlag?`; }
  else if (a.promises?.length) q1 = `Du lovar alltså ${a.promises[0].number != null ? fmt(a.promises[0].number) + ' ' + (a.promises[0].unit || '') : 'det här'}. Vad kostar det, och var tar ni pengarna?`;
  else if (a.vague) q1 = `Det där var väldigt allmänt hållet. Kan du ge ett enda konkret förslag om ${is.name.toLowerCase()}?`;
  else q1 = pick(rnd, [`Hur ska det finansieras?`, `Vilka partier har ni med er på det här?`, `När märker väljarna skillnad – inom mandatperioden?`, `Vad säger ni till dem som förlorar på förslaget?`]);
  qs.push({ q: q1, journalistId: j1?.id || null, who: j1 ? `${j1.name}, ${MEDIA[j1.outlet]?.name || j1.outlet}` : 'Reporter', kind: 'sak', issue });
  // 2. utanför ämnet
  const sc = (state.scandals || []).find((x) => x.active && x.partyId === p.id);
  const j2 = pickJournalist(state, rnd, hot.id);
  const q2 = sc ? { q: `Oavsett ämne: ${sc.title.toLowerCase()}en hänger kvar. ${sc.text.split('.')[0]}. Vad säger du i dag?`, kind: 'skandal', issue: 'varderingar' }
    : state.government.crisis > 4 && !state.government.parties.includes(p.id) ? { q: `Regeringen vacklar. Är ni beredda att ta över – och med vem?`, kind: 'off', issue: 'ekonomi' }
    : { q: `En annan sak: ${hot.name.toLowerCase()} är det väljarna oroar sig mest för just nu. ${stat.arbetsloshet > 8 && hot.id === 'arbete' ? `Arbetslösheten är ${fmt(stat.arbetsloshet, 1)} procent. ` : ''}Vad är ert besked?`, kind: 'off', issue: hot.id };
  qs.push({ ...q2, journalistId: j2?.id || null, who: j2 ? `${j2.name}, ${MEDIA[j2.outlet]?.name || j2.outlet}` : 'Reporter' });
  // 3. ibland en personlig eller en gammal formulering
  if (rnd() < .55) {
    const old = (state.memory?.statements || []).filter((s) => !s.deleted && s.risky > 30 && state.week - s.week > 3).slice(-5);
    const o = old.length ? pick(rnd, old) : null;
    const q3 = o ? { q: `${pick(rnd, ['Vecka ' + o.week, 'Nyligen', 'Tidigare'])} ${o.kind === 'post' ? 'skrev' : 'sa'} du: "${o.text.slice(0, 110)}". Står du fast vid det?`, kind: 'gammalt', issue: o.issues?.[0] || 'varderingar', ref: o.id }
      : { q: pick(rnd, [`Rent personligt: hur orkar du? Du ser trött ut.`, `Har du själv någonsin ${pick(rnd, ['fuskat med skatten', 'anlitat svart städhjälp', 'kört för fort'])}?`, `Vad tjänar du i månaden?`, `Om partiet gör ett dåligt val – avgår du då?`]), kind: 'personlig', issue: 'varderingar' };
    const j3 = pick(rnd, Object.values(state.journalists || {}));
    qs.push({ ...q3, journalistId: j3?.id || null, who: j3 ? `${j3.name}, ${MEDIA[j3.outlet]?.name || j3.outlet}` : 'Reporter' });
  }
  return qs;
}
export function pressAnswer(state, rnd, q, text, a, noComment = false) {
  const p = me(state); const l = leader(state);
  const rec = noComment ? null : recordStatement(state, text, 'press', { question: q.q, questionIssue: q.issue, analysis: a });
  if (rec) factCheck(state, rec.statement);
  let delta = 0, note = '';
  if (noComment) { delta = -1; note = pick(rnd, ['Journalisterna noterar tystnaden.', '"Ingen kommentar" blir rubriken i kvällspressen.', 'Mummel i salen.']); p.attention = clamp(p.attention + 1, 0, 100); }
  else {
    if (a.answers > .6) { delta = 3; note = pick(rnd, ['Tydligt svar. Pennorna går.', 'Frågan är avklarad.', 'Journalisten nickar.']); p.credibility = clamp(p.credibility + .4, 0, 100); }
    else if (a.answers < .35) { delta = -3; note = pick(rnd, ['Journalisten: "Det var inget svar."', '"Jag frågar igen…" – du går vidare.', 'Det undvikande svaret blir ett klipp.']); p.credibility = clamp(p.credibility - .5, 0, 100); }
    else { delta = 1; note = 'Okej. Nästa fråga.'; }
    if (a.dominant === 'aggressiv') { delta -= 5; note = pick(rnd, ['Journalisten höjer ögonbrynen. Det där kommer att citeras.', 'Salen blir tyst. Någon filmar.']); p.risk = (p.risk || 0) + 3; }
    if (a.dominant === 'humor') { note = rnd() < .5 ? 'Skratt i salen – det landade.' : 'Ett skämt om det här? Ingen skrattar.'; delta += rnd() < .5 ? 2 : -3; }
    if (rec?.contradictions.length) { delta -= 3; note = `Journalisten: "${rec.contradictions[0]}"`; p.credibility = clamp(p.credibility - 1, 0, 100); }
    if (a.claims?.some((c) => c.ok === false)) delta -= 3;
    if (q.kind === 'gammalt' && a.dominant !== 'undvikande') { const st = state.memory.statements.find((s) => s.id === q.ref); if (st) { st.defended = true; } }
  }
  if (q.journalistId) adjustJournalist(state, q.journalistId, delta, delta <= -3 ? `${l.name} svarade inte på min fråga om ${ISSUE_BY_ID[q.issue]?.name.toLowerCase() || 'saken'}.` : null);
  return { delta, note };
}
export function pressSummary(state, rnd, issue, a, answers) {
  const p = me(state); const l = leader(state); const is = ISSUE_BY_ID[issue];
  const score = answers.reduce((s, x) => s + x.delta, 0) + a.clarity * 6 - (a.vague ? 4 : 0) + (a.promises?.length ? 2 : 0) + (a.dominant === 'saklig' ? 2 : 0);
  const good = score > 2;
  const quote = a.summary || firstSentence(a.text || '');
  const outlet = pick(rnd, ['svt', 'tv4', 'dn', 'ekot']);
  const head = good ? (a.promises?.length ? `${p.abbr} lovar: ${quote.slice(0, 70)}` : `${l.name} om ${is.name.toLowerCase()}: "${quote.slice(0, 70)}"`) : answers.some((x) => x.noComment) ? `${l.name} vägrade svara på presskonferensen` : `${p.abbr}:s presskonferens om ${is.name.toLowerCase()} – "${a.vague ? 'inget konkret' : 'svävande svar'}"`;
  addNews(state, { outlet, headline: head, body: good ? `${l.name} presenterade partiets linje om ${is.name.toLowerCase()}. ${pick(rnd, ['Tydligt och väl förberett, enligt kommentatorer.', 'Förslaget kommer att diskuteras i riksdagen.', 'Motståndarna kallar det ofinansierat.'])}` : `${pick(rnd, ['Frågorna från journalisterna var kritiska.', 'Det blev tydligt att partiet saknar svar på följdfrågorna.', 'Presskonferensen beskrivs som rörig.'])}`, tags: ['politik', issue], partyId: p.id, importance: good ? 2 : 1, tone: good ? 1 : -1 });
  return { good, score, headline: head };
}
const firstSentence = (t) => (t.split(/(?<=[.!?])\s/)[0] || t).trim();

// ---------- TALET ----------
export function speechOutcome(state, rnd, regionId, text, reactions) {
  const p = me(state); const l = leader(state); const r = REGIONS.find((x) => x.id === regionId);
  const score = reactions.score; // −60…60
  const best = reactions.lines.slice().sort((a, b) => b.v - a.v)[0];
  const worst = reactions.lines.slice().sort((a, b) => a.v - b.v)[0];
  const rec = recordStatement(state, text, 'speech', { audience: 'public' });
  factCheck(state, rec.statement);
  const crowd = Math.round((40 + p.attention * 6 + (state.opinion.support[p.id] || 0) * 60) * (r.pop / 400) * (.6 + rnd() * .8));
  addNews(state, { outlet: pick(rnd, ['svt', 'tv4', r.id === 'O' ? 'gp' : r.id === 'M' ? 'sydsvenskan' : r.id === 'BD' ? 'nsd' : 'svt']), headline: score > 20 ? `${l.name} i ${r.name}: "${best.s.slice(0, 70)}"` : score < -15 ? `${l.name}s tal i ${r.name} föll platt` : `${l.name} talade i ${r.name}`, body: `${fmt(crowd)} personer kom. ${score > 20 ? pick(rnd, ['Jubel när ' + l.first + ' sa: "' + best.s.slice(0, 80) + '"', 'Stående ovationer.', 'Publiken sjöng med.']) : score < -15 ? pick(rnd, ['Buropen hördes när ' + l.first + ' sa: "' + worst.s.slice(0, 80) + '"', 'Folk gick innan talet var slut.', 'Tystnaden var öronbedövande.']) : 'Artiga applåder.'}`, tags: ['kampanj'], partyId: p.id, importance: Math.abs(score) > 20 ? 2 : 1, tone: score > 20 ? 1 : score < -15 ? -1 : 0 });
  return { crowd, mult: clamp(1 + score / 60, .3, 1.9), contradictions: rec.contradictions };
}

// ---------- ENSKILDA SAMTAL ----------
export async function privateTalk(state, rnd, target, text, a, round) {
  const p = me(state); const l = leader(state);
  const soc = (l.traits.social - 45) / 100;
  let delta = 2 + soc * 4;
  const coop = /samarbet|tillsammans|regering|stöd|överens|gemensam|kompromiss|hjälp/.test(text.toLowerCase());
  switch (a.dominant) { case 'saklig': delta += 3; break; case 'kansla': delta += 4; break; case 'humor': delta += 2 + soc * 3; break; case 'kampande': delta += 1; break; case 'aggressiv': delta -= 9; break; case 'undvikande': delta -= 1; break; }
  if (a.vague) delta -= 1;
  let leak = null; let reply = null; let note = '';
  const rec = recordStatement(state, text, 'talk', { audience: 'private', analysis: a });
  if (target.kind === 'leader') {
    const q = target.party; const ql = state.people[q.leader];
    if (coop) delta += 3;
    for (const id of a.attacks || []) { if (id === q.id) delta -= 10; else if (state.parties[id] && state.parties[id].bloc !== q.bloc) delta += 2; else delta -= 2; }
    const rel = q.relations[p.id] || 0;
    // skillnad i politik dämpar
    for (const id in a.stance) { const pos = q.pos[id] || 0; if (Math.abs(pos) > 30 && Math.sign(pos) !== Math.sign(a.stance[id])) delta -= 2; else if (Math.abs(pos) > 30) delta += 1; }
    q.relations[p.id] = clamp(rel + delta, -100, 100); p.relations[q.id] = clamp((p.relations[q.id] || 0) + delta * .7, -100, 100);
    // läcka: känsliga saker sagda i enrum kan komma ut
    const pLeak = (a.risky / 100) * .2 + ((a.attacks || []).length ? .12 : 0) - (rel > 30 ? .08 : 0) - (ql.traits.integritet - 50) / 400;
    if (rnd() < pLeak) leak = { who: ql.name, text: text.slice(0, 120) };
    reply = await talkReply(state, rnd, { who: ql.name, desc: `partiledare för ${q.name}, relation ${q.relations[p.id] > 20 ? 'god' : q.relations[p.id] < -20 ? 'dålig' : 'sval'}; ${round === 1 ? 'artig men avvaktande' : 'svarar på det som sades'}`, playerText: text, situation: `Lunch på tu man hand mellan partiledarna. Runda ${round}.` }, () => delta > 6 ? pick(rnd, ['Det här tar jag med mig. Vi hörs.', 'Intressant. Låt oss hålla kontakten.', 'Jag uppskattar att du säger det rakt ut.']) : delta > 0 ? pick(rnd, ['Mm. Vi får se.', 'Jag förstår hur du tänker – men mitt parti är inte där.', 'Det är inte så enkelt. Men tack.']) : pick(rnd, ['Jag tror vi är klara här.', 'Det där hade du kunnat spara.', 'Jag tänker inte svara på det.']));
    note = `Relation till ${q.abbr}: ${delta > 0 ? '+' : ''}${fmt(delta, 0)} (nu ${fmt(q.relations[p.id], 0)}).`;
  } else if (target.kind === 'person') {
    const per = target.person;
    if (coop || a.dominant === 'kansla') delta += 2;
    per.loyalty = clamp((per.loyalty ?? 60) + delta, 0, 100);
    if (a.dominant === 'aggressiv') per.ambition = clamp((per.ambition ?? 50) + 5, 0, 100);
    for (const f of p.factions || []) if (f.leaderId === per.id) f.mood = clamp(f.mood + delta * .8, -100, 100);
    const pLeak = (a.risky / 100) * .15 + ((a.attacks || []).length ? .1 : 0) - (per.loyalty - 50) / 300 - (per.traits.integritet - 50) / 400;
    if (rnd() < pLeak) leak = { who: per.name, text: text.slice(0, 120) };
    reply = await talkReply(state, rnd, { who: per.name, desc: `${per.ministry ? MINISTRIES.find((m) => m.id === per.ministry)?.name : 'riksdagsledamot'} i partiledarens eget parti, lojalitet ${per.loyalty > 70 ? 'hög' : per.loyalty < 40 ? 'låg' : 'måttlig'}, ambition ${per.ambition > 70 ? 'hög' : 'måttlig'}`, playerText: text, situation: `Partiledaren pratar enskilt med en partikamrat. Runda ${round}.` }, () => delta > 4 ? pick(rnd, ['Tack för att du säger det. Jag står bakom dig.', 'Det betyder mycket. Vi kör.', 'Okej. Jag är med.']) : delta > -2 ? pick(rnd, ['Jag hör vad du säger.', 'Jag ska fundera på det.', 'Det är ditt beslut.']) : pick(rnd, ['Jag vet inte om jag känner igen partiet längre.', 'Du borde lyssna mer på oss andra.', 'Okej. Men folk pratar.']));
    note = `${per.first}s lojalitet: ${delta > 0 ? '+' : ''}${fmt(delta, 0)} (nu ${fmt(per.loyalty, 0)}).`;
  } else if (target.kind === 'journalist') {
    const j = target.journalist;
    if (a.dominant === 'aggressiv') delta -= 4;
    adjustJournalist(state, j.id, delta, a.risky > 40 ? `${l.name} sa off record: "${text.slice(0, 60)}…"` : null);
    const pLeak = .18 + (a.risky / 100) * .35 + ((a.attacks || []).length ? .15 : 0) - (j.rel > 30 ? .15 : 0);
    if (rnd() < pLeak) leak = { who: `en källa på ${MEDIA[j.outlet]?.name || j.outlet}`, text: text.slice(0, 120) };
    reply = await talkReply(state, rnd, { who: j.name, desc: `${j.style} journalist på ${MEDIA[j.outlet]?.name || j.outlet}, pratar off record, ${j.rel > 20 ? 'välvillig' : j.rel < -20 ? 'fientlig' : 'neutral'}`, playerText: text, situation: `Off record-samtal på en bakgård. Runda ${round}.` }, () => delta > 3 ? pick(rnd, ['Intressant. Det här kan jag använda – anonymt, såklart.', 'Tack. Jag hör av mig.', 'Bra bakgrund. Fortsätt.']) : pick(rnd, ['Mm. Det där visste jag redan.', 'Är det här off record? Jag frågar bara.', 'Okej. Vi ses på presskonferensen.']));
    note = `Relation till ${j.name}: ${delta > 0 ? '+' : ''}${fmt(delta, 0)}.`;
  }
  if (leak) {
    p.risk = (p.risk || 0) + 6; me(state).trust = clamp((p.trust ?? 50) - 2, 0, 100);
    addNews(state, { outlet: pick(rnd, ['expressen', 'aftonbladet']), headline: `Läckt: ${l.name} i enrum – "${leak.text.slice(0, 50)}…"`, body: `Enligt ${leak.who} ska ${l.name} ha sagt: "${leak.text}". ${p.abbr} vill inte kommentera "privata samtal".`, tags: ['skandal', 'lacka'], partyId: p.id, importance: 2, tone: -1 });
    rec.statement.leaked = true;
  }
  return { reply, delta, leak, note, contradictions: rec.contradictions };
}
async function talkReply(state, rnd, { who, desc, playerText, situation }, fallback) {
  const p = me(state); const l = leader(state);
  if (llmEnabled()) { try { const r = await llmReplies({ situation, playerText, playerName: l.name, abbr: p.abbr, speakers: [{ who, desc }], count: 1 }); if (r[0]?.text) return r[0].text; } catch (e) { console.warn('LLM', e.message); } }
  return fallback();
}

// ---------- MOTBUD I FÖRHANDLING ----------
export async function negotiationCounter(state, rnd, q, item, demand, text, a) {
  const p = me(state); const l = leader(state); const ql = state.people[q.leader];
  const t = text.toLowerCase();
  const rel = q.relations[p.id] || 0; const soc = (l.traits.social - 45) / 100;
  recordStatement(state, text, 'negotiation', { audience: 'private', analysis: a });
  // spelets AI: motparten läser budet och bestämmer själv
  if (localReady()) {
    try {
      const { messages, schema } = dealMessages({ who: ql.name, party: q.name, demand: demand.text, offer: text, relation: rel > 30 ? 'god, ni litar på varandra' : rel < -30 ? 'dålig, ni misstror varandra' : 'sval' });
      const r = await localJSON(messages, schema, { max: 160, temp: .5 });
      const decision = r.beslut === 'ja' ? 'accept' : r.beslut === 'motbud' ? (rnd() < .55 + rel / 250 + soc * .3 ? 'counter' : 'reject') : 'reject';
      q.relations[p.id] = clamp(rel + (decision === 'reject' ? (a.dominant === 'aggressiv' ? -8 : -2) : 2), -100, 100);
      if (r.replik) return { decision, reply: String(r.replik).trim() };
    } catch (e) { console.warn('förhandling AI', e.message); }
  }
  let decision;
  if (a.dominant === 'aggressiv') decision = 'reject';
  else if (/accepter|går med på|vi säger ja|okej, |det kan vi|vi ställer upp|deal|överens/.test(t) || overlap(text, demand.text) >= 2) decision = 'accept';
  else if (/erbjud|i utbyte|istället|i stället|om ni |stöd|post|minister|kompromiss|möt|halvvägs|delvis|\d/.test(t) || a.promises?.length) decision = rnd() < .3 + rel / 200 + soc * .3 + a.clarity * .2 ? 'counter' : 'reject';
  else decision = 'reject';
  if (decision === 'reject') q.relations[p.id] = clamp(rel - (a.dominant === 'aggressiv' ? 8 : 2), -100, 100);
  if (decision === 'counter') q.relations[p.id] = clamp(rel + 2, -100, 100);
  let reply = null;
  if (llmEnabled()) { try { const r = await llmReplies({ situation: `Förhandling om "${item.title || 'förslaget'}". ${ql.name} (${q.abbr}) krävde: "${demand.text}". Partiledaren svarade med ett ${decision === 'accept' ? 'ja' : decision === 'counter' ? 'motbud som accepteras' : 'bud som avvisas'}. Skriv ${ql.first}s svar.`, playerText: text, playerName: l.name, abbr: p.abbr, speakers: [{ who: ql.name, desc: `partiledare för ${q.name}, förhandlar hårt men vill ha inflytande` }], count: 1 }); reply = r[0]?.text; } catch (e) { console.warn('LLM', e.message); } }
  if (!reply) reply = decision === 'accept' ? pick(rnd, ['Då har vi en uppgörelse. Vi röstar ja.', 'Bra. Då är vi överens – och vi håller vad vi lovar.', 'Okej. Handslag.']) : decision === 'counter' ? pick(rnd, ['Det är inte vad vi bad om, men… okej. Vi kan leva med det.', 'Hm. Jag tar det. Men nästa gång är det vår tur.', 'Du är hårdare än jag trodde. Vi går med på det.']) : pick(rnd, ['Nej. Det räcker inte.', 'Vi har gett vårt bud. Ta det eller låt bli.', 'Då får ni klara er utan oss.', a.dominant === 'aggressiv' ? 'Jag förhandlar inte med någon som pratar så.' : 'Det där var inget bud.']);
  return { decision, reply };
}

// ---------- ERBJUDANDE I REGERINGSBILDNINGEN ----------
export function formationOffer(state, q, text, a) {
  const p = me(state); const t = text.toLowerCase();
  let bonus = 0; const ministries = [];
  for (const m of MINISTRIES) { const key = m.name.toLowerCase().replace('minister', ''); if (t.includes(key.trim()) || t.includes(m.name.toLowerCase())) { ministries.push(m.id); } }
  bonus += Math.min(16, ministries.length * 8);
  if (/ministerpost|platser i regeringen|i regeringen|statsråd/.test(t) && !ministries.length) bonus += 5;
  for (const id in a.stance) { const pos = q.pos[id] || 0; if (Math.abs(pos) > 25) bonus += Math.sign(pos) === Math.sign(a.stance[id]) ? 4 : -5; }
  if (a.dominant === 'aggressiv') bonus -= 15; if (a.dominant === 'kansla' || a.dominant === 'saklig') bonus += 3; if (a.promises?.length) bonus += 4; if (a.vague) bonus -= 3;
  bonus = clamp(bonus, -20, 25);
  q.offerBonus = bonus;
  recordStatement(state, text, 'negotiation', { audience: 'private', analysis: a });
  (state.secretDeals ||= []).push({ partyId: q.id, text: text.slice(0, 200), week: state.week, year: state.date.y, ministries, leaked: false, bonus });
  return { bonus, ministries };
}
export function clearOffers(state) { for (const q of Object.values(state.parties)) delete q.offerBonus; }
export function leakSecretDeals(state, rnd) {
  const p = me(state); const l = leader(state);
  for (const d of state.secretDeals || []) {
    if (d.leaked || state.week - d.week > 60) continue;
    if (rnd() < .05) {
      d.leaked = true; const q = state.parties[d.partyId]; if (!q) continue;
      p.trust = clamp((p.trust ?? 50) - 4, 0, 100); p.credibility = clamp(p.credibility - 3, 0, 100); p.risk = (p.risk || 0) + 5;
      for (const o of activeParties(state)) if (o.id !== p.id && o.id !== q.id) o.relations[p.id] = clamp((o.relations[p.id] || 0) - 4, -100, 100);
      addNews(state, { outlet: pick(rnd, ['dn', 'svd', 'expressen']), headline: `Avslöjat: ${p.abbr}:s hemliga löfte till ${q.abbr} under regeringsbildningen`, body: `I ett dokument som läckt till redaktionen lovar ${l.name} ${q.abbr}: "${d.text.slice(0, 120)}". ${d.ministries.length ? 'Bland annat ' + d.ministries.map((id) => MINISTRIES.find((m) => m.id === id)?.name.toLowerCase()).join(' och ') + '.' : ''} Oppositionen kräver svar.`, tags: ['politik', 'lacka'], partyId: p.id, importance: 2, tone: -1 });
    }
  }
}

// ---------- FOKUSGRUPP ----------
export function focusGroup(state, rnd) {
  const p = me(state); const l = leader(state);
  const mem = state.memory || { statements: [] };
  const recent = mem.statements.slice(-30);
  const segs = [...SEGMENTS].sort((a, b) => b.share - a.share);
  const chosen = [segs[0], segs[Math.floor(segs.length / 2)], ...(p.structure?.malgrupper || []).map((id) => SEGMENTS.find((x) => x.id === id)).filter(Boolean)].filter((x, i, arr) => x && arr.indexOf(x) === i).slice(0, 4);
  const out = [];
  for (const sg of chosen) {
    const sup = state.opinion.seg[sg.id]?.[p.id] || 0;
    const aw = state.opinion.awareness[p.id] ?? 1;
    let fit = 0, n = 0; const heard = {};
    for (const s of recent) for (const id in s.stance || {}) { const ideal = sg.ideal[id] || 0; fit += Math.sign(ideal) === Math.sign(s.stance[id]) ? 1 : -1; n++; heard[id] = (heard[id] || 0) + 1; }
    const care = [...ISSUES].sort((a, b) => (sg.w[b.id] || 1) - (sg.w[a.id] || 1)).slice(0, 3);
    const silent = care.filter((is) => !heard[is.id]);
    const tone = personaLabel(state);
    const lines = [];
    if (aw < .3) lines.push(`"Vilka? Aldrig hört talas om dem."`);
    else if (n && fit / n > .3) lines.push(`"De säger saker som vi tycker."`);
    else if (n && fit / n < -.3) lines.push(`"De står för motsatsen till det vi vill."`);
    else lines.push(`"Jag vet inte riktigt vad de vill."`);
    if (silent.length) lines.push(`"Om ${silent.map((is) => is.name.toLowerCase()).join(' och ')} har de aldrig sagt något."`);
    if (tone) lines.push(`"${l.first} verkar ${tone}."`);
    if (mem.persona?.aggressiv > .35) lines.push(`"Lite för mycket skrik för min smak."`);
    if (mem.persona?.undvikande > .3) lines.push(`"Svarar aldrig på frågan."`);
    if (mem.statements.filter((s) => s.contradictions?.length).length > 2) lines.push(`"De byter åsikt beroende på vem som frågar."`);
    out.push({ seg: sg, support: sup, like: n ? fit / n : 0, lines, care: care.map((is) => is.name) });
  }
  const tips = [];
  const issuesHeard = {}; for (const s of recent) for (const id of s.issues || []) issuesHeard[id] = (issuesHeard[id] || 0) + 1;
  const topHot = [...ISSUES].sort((a, b) => state.opinion.salience[b.id] - state.opinion.salience[a.id]).slice(0, 3);
  for (const is of topHot) if (!issuesHeard[is.id]) tips.push(`${is.name} är hett just nu – ni har inte sagt något om det på länge.`);
  if ((mem.promises || []).length > 6) tips.push(`Ni har gett ${mem.promises.length} konkreta löften. Väljarna kommer att räkna.`);
  if (!tips.length) tips.push('Rådgivaren: "Fortsätt som nu. Fast jag kan ha fel."');
  return { groups: out, tips, persona: personaLabel(state) };
}

// ---------- UTSPEL I FRITEXT ----------
export function utspelEffect(state, rnd, text, a, issueId) {
  const p = me(state); const l = leader(state);
  const issue = issueId || Object.entries(a.issues || {}).sort((x, y) => y[1] - x[1])[0]?.[0] || 'ekonomi';
  const is = ISSUE_BY_ID[issue];
  const rec = recordStatement(state, text, 'post', { audience: 'public', analysis: a });
  factCheck(state, rec.statement);
  const clear = a.clarity;
  state.opinion.boost[issue] = (state.opinion.boost[issue] || 0) + .2 + clear * .2;
  p.profile[issue] = Math.min(2.5, (p.profile[issue] || 1) + .1 + clear * .1);
  for (const pr of a.promises || []) (p.promises ||= []).push({ issue, week: state.week, text: pr.text.slice(0, 120), free: true });
  if (!a.promises?.length) (p.promises ||= []).push({ issue, week: state.week, text: firstSentence(text).slice(0, 120), free: true });
  const quote = a.summary || firstSentence(text);
  addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen', 'dn', 'svt']), headline: a.vague ? `${p.abbr} gör utspel om ${is.name.toLowerCase()} – utan konkreta förslag` : `${p.abbr}:s utspel: "${quote.slice(0, 80)}"`, body: `${l.name} ${a.promises?.length ? 'lovar' : 'föreslår'}: "${text.slice(0, 160)}${text.length > 160 ? '…' : ''}" ${rec.contradictions.length ? 'Kritiker påpekar att partiet tidigare sagt något annat.' : pick(rnd, ['Motståndarna kallar det ofinansierat.', 'Förslaget välkomnas av intresseorganisationer.', 'Experter är skeptiska till genomförbarheten.', 'Utspelet dominerar dagens nyhetsflöde.'])}`, tags: ['politik', issue], partyId: p.id, importance: a.vague ? 1 : 2, tone: a.vague ? -1 : 0 });
  return { issue, clear, contradictions: rec.contradictions, vague: a.vague };
}
export { toneLabel };
