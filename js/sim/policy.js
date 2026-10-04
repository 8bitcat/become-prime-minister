// Politiksystemet: gällande lag, partiprogram, härledd ideologi, reformer genom riksdagen,
// politiskt kapital, myndigheternas kapacitet, genomförandetid och oavsiktliga konsekvenser.
import { POLICIES, POLICY_BY_ID, DOMAINS, COMPASS, norm, defaultPolicy, policyLabel } from '../data/policies.js';
import { ISSUES } from '../data/issues.js';
import { IDEOLOGIES, IDEOLOGY_BY_ID } from '../data/ideologies.js';
import { STAT_BY_ID } from '../data/stats.js';
import { clamp, pick, gauss } from '../core/util.js';
import { addNews } from './news.js';
import { activeParties } from './opinion.js';

export const DOMAIN_ISSUE = { migration: 'migration', skatter: 'ekonomi', ekonomi: 'ekonomi', arbete: 'arbete', valfard: 'valfard', socialt: 'ekonomi', utbildning: 'valfard', ratt: 'kriminal', frihet: 'varderingar', demokrati: 'varderingar', forsvar: 'forsvar', utrikes: 'eu', energi: 'energi', samhalle: 'bostad' };
const TAX_IDS = new Set(['skatt_kommunal', 'skatt_statlig', 'skatt_bolag', 'skatt_kapital', 'moms', 'skatt_koldioxid', 'skatt_bensin', 'arbetsgivaravgift', 'rutrot']);
const SET_IDS = new Set([...TAX_IDS, 'a_kassa', 'barnbidrag']);
const statBacked = (p) => !!(p.budget || TAX_IDS.has(p.id)); // kostnaden fångas redan av budgetformeln
const setsStat = (p) => !!(p.budget || (p.type === 'slider' && SET_IDS.has(p.id) && STAT_BY_ID[p.id]));

// ---------- IDEOLOGI UR PROGRAMMET ----------
export function axesFromProgram(program) {
  const acc = {}, w = {};
  for (const p of POLICIES) {
    const v = program?.[p.id]; if (v == null) continue;
    const nv = norm(p, v);
    for (const ax in p.axes || {}) { acc[ax] = (acc[ax] || 0) + nv * p.axes[ax]; w[ax] = (w[ax] || 0) + Math.abs(p.axes[ax]); }
  }
  const out = {};
  for (const is of ISSUES) out[is.id] = w[is.id] ? Math.round(clamp((acc[is.id] / w[is.id]) * 140, -100, 100)) : 0;
  return out;
}
export function compassFromProgram(program) {
  const acc = {}, w = {};
  for (const p of POLICIES) {
    const v = program?.[p.id]; if (v == null) continue;
    const nv = norm(p, v);
    for (const ax in p.comp || {}) { acc[ax] = (acc[ax] || 0) + nv * p.comp[ax]; w[ax] = (w[ax] || 0) + Math.abs(p.comp[ax]); }
  }
  const out = {};
  for (const c of COMPASS) out[c.id] = w[c.id] ? Math.round(clamp((acc[c.id] / w[c.id]) * 140, -100, 100)) : 0;
  return out;
}
// Startprogram ur ett axelläge (för AI-partier och ideologiförval): varje område får det värde
// som bäst motsvarar axlarna det bidrar till.
const PROGRAM_DIV = 1.15;
export function programFromAxes(pos) {
  const program = {};
  for (const p of POLICIES) {
    const axes = Object.entries(p.axes || {});
    let target = 0, wsum = 0;
    for (const [ax, w] of axes) { target += ((pos[ax] || 0) / 100) * Math.sign(w) * Math.abs(w); wsum += Math.abs(w); }
    target = wsum ? clamp(target / wsum / PROGRAM_DIV, -1, 1) : 0;
    if (p.type === 'choice') program[p.id] = p.options.slice().sort((a, b) => Math.abs(a.v - target) - Math.abs(b.v - target))[0].id;
    else { const raw = target >= 0 ? p.def + target * (p.max - p.def) : p.def + target * (p.def - p.min); program[p.id] = Math.round(raw / p.step) * p.step; if (!Number.isInteger(p.step)) program[p.id] = Math.round(program[p.id] * 100) / 100; }
  }
  return program;
}
export function syncAxes(party) { if (!party.program) return; party.pos = axesFromProgram(party.program); }
// Ideologiernas lägen i samma (härledda) skala som partiprogrammen – räknas en gång
let IDEO_AXES = null;
const ideoAxes = () => IDEO_AXES || (IDEO_AXES = Object.fromEntries(IDEOLOGIES.map((i) => [i.id, axesFromProgram(programFromAxes(i.pos))])));
export function nearestIdeologies(program) {
  const pos = axesFromProgram(program);
  const ia = ideoAxes();
  return IDEOLOGIES.map((i) => { let d = 0; for (const is of ISSUES) d += Math.abs((ia[i.id][is.id] || 0) - (pos[is.id] || 0)); return { id: i.id, name: i.name, d: d / ISSUES.length }; }).sort((a, b) => a.d - b.d).slice(0, 3);
}
export function ideologyDescription(program) {
  const near = nearestIdeologies(program);
  const c = compassFromProgram(program);
  const tags = COMPASS.map((ax) => { const v = c[ax.id]; if (Math.abs(v) < 20) return null; return (v < 0 ? ax.left : ax.right); }).filter(Boolean);
  const first = near[0], second = near[1];
  const label = first.d < 18 ? first.name : first.d < 30 ? `${first.name} med inslag av ${second.name.toLowerCase()}` : `en egen blandning: ${first.name.toLowerCase()} och ${second.name.toLowerCase()}`;
  return { label, tags, near, compass: c };
}
// Partiprogram i text, domän för domän
export function programText(party) {
  const out = [];
  for (const [dom, name] of Object.entries(DOMAINS)) {
    const items = POLICIES.filter((p) => p.domain === dom && party.program?.[p.id] != null && Math.abs(norm(p, party.program[p.id])) > .15);
    if (!items.length) continue;
    out.push({ domain: name, lines: items.map((p) => `${p.name}: ${policyLabel(p, party.program[p.id])}`) });
  }
  return out;
}

// ---------- GÄLLANDE LAG, GENOMFÖRANDE OCH EFFEKTER ----------
export function effectiveLaw(state) {
  const law = { ...(state.policy || defaultPolicy()) };
  for (const r of state.reforms || []) {
    const p = POLICY_BY_ID[r.policyId]; if (!p) continue;
    if (p.type === 'choice') law[r.policyId] = r.progress < .5 ? r.from : r.to;
    else law[r.policyId] = r.from + (r.to - r.from) * r.progress * (r.mult || 1);
  }
  return law;
}
export function policyEffects(state) {
  const law = effectiveLaw(state);
  const fx = { set: {}, utg: 0 };
  for (const p of POLICIES) {
    const v = law[p.id]; if (v == null) continue;
    if (setsStat(p)) fx.set[p.budget || p.id] = v;
    if (!statBacked(p)) fx.utg += p.cost(v) || 0;
    try { p.fx(v, fx); } catch (e) { /* skyddar simuleringen mot ett trasigt fx */ }
  }
  return fx;
}
export function reformCost(p, from, to) {
  const d = Math.abs(norm(p, to) - norm(p, from));
  const domMult = { demokrati: 1.6, frihet: 1.4, utrikes: 1.4, ekonomi: 1.2 }[p.domain] || 1;
  return Math.round((4 + d * 14) * domMult * (p.konst ? 2 : 1));
}
export const reformTitle = (p, to) => `${p.name}: ${policyLabel(p, to)}`;
export function billLike(state, item) {
  const p = POLICY_BY_ID[item.policyId];
  const to = item.to, from = item.from;
  return { id: 'reform:' + p.id, kind: 'reform', policyId: p.id, title: reformTitle(p, to), desc: `${p.desc || ''} Från ${policyLabel(p, from)} till ${policyLabel(p, to)}.${p.konst ? ' Grundlagsändring: kräver två beslut med val emellan.' : ''} Full effekt efter ${p.lag} månader.`, area: DOMAIN_ISSUE[p.domain] || 'ekonomi', vec: {}, cost: Math.round((p.cost(to) || 0) - (p.cost(from) || 0)), from, to, konst: !!p.konst };
}
// Hur ett parti ser på en reform: närmare det egna programmet = bra
export function reformStance(party, item) {
  const p = POLICY_BY_ID[item.policyId]; if (!p) return 0;
  const prog = party.program?.[p.id] ?? p.def;
  const before = Math.abs(norm(p, item.from) - norm(p, prog)), after = Math.abs(norm(p, item.to) - norm(p, prog));
  return clamp((before - after) * 1.6, -1, 1);
}
export function proposeReform(state, rnd, proposerId, policyId, to, { byPlayer = false, second = false } = {}) {
  const p = POLICY_BY_ID[policyId];
  const from = state.policy[policyId];
  const r = typeof rnd === 'function' ? rnd : Math.random;
  const item = { id: 'r' + state.week + '_' + policyId + '_' + Math.floor(r() * 1e4), kind: 'reform', policyId, from, to, proposer: proposerId, week: state.week, date: { ...state.date }, status: 'pending', deals: {}, byPlayer, voteWeek: state.week + (second ? 2 : 3), second, billId: 'reform:' + policyId };
  state.riksdag.bills.unshift(item);
  return item;
}
// Reformen antogs: starta genomförandet (eller lägg den vilande om grundlag)
export function applyReform(state, rnd, item) {
  const p = POLICY_BY_ID[item.policyId];
  if (p.konst && !item.second) {
    (state.riksdag.vilande ||= []).push({ policyId: item.policyId, to: item.to, from: item.from, proposer: item.proposer, byPlayer: item.byPlayer, year: state.election.next.y });
    addNews(state, { outlet: 'svt', headline: `Grundlagsändring vilande: ${reformTitle(p, item.to)}`, body: 'Riksdagen antog förslaget en första gång. Det träder i kraft bara om nästa riksdag, efter valet, antar det igen.', tags: ['riksdag', 'grundlag'], importance: 3 });
    return { pending: true };
  }
  state.reforms = (state.reforms || []).filter((r) => r.policyId !== item.policyId);
  const mult = p.type === 'choice' ? 1 : clamp(gauss(rnd, 1, .15), .6, 1.4);
  const side = rnd() < .25 ? pick(rnd, SIDE_EFFECTS[p.domain] || SIDE_EFFECTS.generic) : null;
  state.reforms.push({ policyId: item.policyId, from: item.from, to: item.to, start: state.week, months: Math.max(1, p.lag), progress: p.lag <= 1 ? 1 : 0, mult, side, konst: !!p.konst });
  state.policy[item.policyId] = item.to;
  (state.sweden.reforms ||= []).push({ billId: 'reform:' + item.policyId, title: reformTitle(p, item.to), date: { ...state.date }, proposer: item.proposer });
  state.history.timeline.push({ date: { ...state.date }, week: state.week, kind: 'reform', text: `${reformTitle(p, item.to)}${p.konst ? ' (grundlag)' : ''}.` });
  if (side) addNews(state, { outlet: pick(rnd, ['dn', 'svd', 'ekot']), headline: `Experter varnar: ${reformTitle(p, item.to).toLowerCase()} kan få oväntade effekter`, body: side.text, tags: ['politik'], importance: 1 });
  return { pending: false };
}
const SIDE_EFFECTS = {
  generic: [{ text: 'Myndigheterna räknar med längre genomförandetid än regeringen lovat.', fx: (o) => { o.kapacitet = (o.kapacitet || 0) - .5; } }, { text: 'Reformen kräver fler anställda än beräknat – kostnaden kan bli högre.', fx: (o) => { o.utg = (o.utg || 0) + 2; } }],
  skatter: [{ text: 'Skatteplanering kan äta upp en del av effekten.', fx: (o) => { o.utg = (o.utg || 0) + 3; } }, { text: 'Hushållen reagerar starkare än väntat – konsumtionen påverkas.', fx: (o) => { o.growth = (o.growth || 0) - .1; } }],
  samhalle: [{ text: 'Markpriserna kan drivas upp när byggandet tar fart.', fx: (o) => { o.prisG = (o.prisG || 0) + 1; } }, { text: 'Kommunerna saknar planhandläggare – projekten riskerar att fastna.', fx: (o) => { o.bygg = (o.bygg || 0) - 2; } }],
  migration: [{ text: 'Kommunerna varnar för att bostäder och skolplatser inte räcker.', fx: (o) => { o.bostadsko = (o.bostadsko || 0) + .5; } }, { text: 'Domstolarna överbelastas av överklaganden.', fx: (o) => { o.handlaggning = (o.handlaggning || 0) + 1; } }],
  ratt: [{ text: 'Häktena och anstalterna är redan fulla – fler platser krävs.', fx: (o) => { o.utg = (o.utg || 0) + 3; } }],
  valfard: [{ text: 'Personalbristen gör att pengarna inte omsätts i vård direkt.', fx: (o) => { o.vardkoer = (o.vardkoer || 0) + 4; } }],
  energi: [{ text: 'Tillståndsprocesserna kan ta flera år längre än planen.', fx: (o) => { o.kapacitet = (o.kapacitet || 0) - .5; } }],
};
// Månadsvis: genomförandet fortskrider, myndigheternas kapacitet bromsar, färdiga reformer meddelas
export function stepReforms(state, rnd) {
  const fx = policyEffects(state);
  const cap = 5 + (fx.kapacitet || 0) + (state.sweden.stats.digitalisering - 78) * .05 + (state.sweden.stats.korruption - 83) * .03;
  const active = (state.reforms || []).filter((r) => r.progress < 1);
  const load = active.reduce((a, r) => a + (r.konst ? 2 : r.months > 24 ? 1.5 : 1), 0);
  const speed = load > cap ? cap / load : 1;
  state.sweden.adminLoad = load; state.sweden.adminCap = cap;
  for (const r of active) {
    r.progress = Math.min(1, r.progress + (1 / r.months) * speed);
    if (r.progress >= 1) { const p = POLICY_BY_ID[r.policyId]; addNews(state, { outlet: 'svt', headline: `Nu genomförd: ${reformTitle(p, r.to).toLowerCase()}`, body: r.mult && Math.abs(r.mult - 1) > .2 ? (r.mult > 1 ? 'Effekten blev större än beräknat.' : 'Effekten blev mindre än beräknat – verkligheten lydde inte beslutet fullt ut.') : 'Reformen har trätt i kraft fullt ut.', tags: ['politik'], importance: 1 }); }
  }
  if (load > cap * 1.5 && rnd() < .25) addNews(state, { outlet: pick(rnd, ['dn', 'svd']), headline: 'Myndigheterna överbelastade: reformerna försenas', body: `${active.length} stora reformer genomförs samtidigt. Nya datasystem, rekryteringar och lokaler saknas. "Vi hinner inte", säger en generaldirektör.`, tags: ['politik'], importance: 2, tone: -1 });
  state.reforms = (state.reforms || []).filter((r) => r.progress < 1 || state.week - r.start < 8);
  return fx;
}
export function capitalRegen(state) {
  const gov = state.government; if (!gov.pm) return;
  const fx = policyEffects(state);
  gov.capital = clamp((gov.capital ?? 50) + 3 + (gov.approval > 55 ? 1 : gov.approval < 35 ? -1 : 0) + (fx.kapital || 0) + (gov.type === 'majority' ? 1 : 0), 0, 100);
}
// AI-regeringen föreslår reformer mot sitt program (den största skillnaden först)
export function aiGovernmentReforms(state, rnd) {
  const gov = state.government; if (!gov.pmParty || (gov.capital ?? 50) < 20) return;
  const pm = state.parties[gov.pmParty]; if (pm.isPlayer) return;
  const pending = state.riksdag.bills.filter((b) => b.status === 'pending');
  if (pending.length >= 4 || rnd() > .6) return;
  const program = gov.agreement || pm.program; if (!program) return;
  const cands = POLICIES.map((p) => ({ p, d: Math.abs(norm(p, program[p.id] ?? p.def) - norm(p, state.policy[p.id] ?? p.def)) })).filter((x) => x.d > .2 && !(state.reforms || []).some((r) => r.policyId === x.p.id) && !pending.some((b) => b.policyId === x.p.id)).sort((a, b) => b.d - a.d).slice(0, 6);
  if (!cands.length) return;
  const { p } = pick(rnd, cands);
  const to = program[p.id];
  const cost = reformCost(p, state.policy[p.id], to);
  if (cost > (gov.capital ?? 50)) return;
  gov.capital -= cost;
  const item = proposeReform(state, rnd, pm.id, p.id, to);
  addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'ekot']), headline: `Regeringen föreslår: ${reformTitle(p, to).toLowerCase()}`, body: `${p.desc || ''} Omröstning i riksdagen om tre veckor.`, tags: ['riksdag', DOMAIN_ISSUE[p.domain]], importance: 2 });
  return item;
}
// AI-partiernas program driver mot väljarnas ideal: nudga områden som drar åt rätt håll
export function aiProgramDrift(state, rnd, party, axisDelta) {
  if (!party.program) return;
  for (const ax in axisDelta) {
    const d = axisDelta[ax]; if (Math.abs(d) < .4) continue;
    const cands = POLICIES.filter((p) => p.axes?.[ax]);
    for (let i = 0; i < 2 && cands.length; i++) {
      const p = pick(rnd, cands); const dir = Math.sign(d) * Math.sign(p.axes[ax]);
      const cur = party.program[p.id] ?? p.def;
      if (p.type === 'choice') { const opts = p.options.slice().sort((a, b) => a.v - b.v); const idx = opts.findIndex((o) => o.id === cur); const ni = clamp(idx + dir, 0, opts.length - 1); if (rnd() < .3) party.program[p.id] = opts[ni].id; }
      else { const nv = clamp(cur + dir * p.step * Math.max(1, Math.round((p.max - p.min) / p.step * .04)), p.min, p.max); party.program[p.id] = Number.isInteger(p.step) ? Math.round(nv) : Math.round(nv * 100) / 100; }
    }
  }
  syncAxes(party);
}
// Regeringsöverenskommelse: mandatviktat snitt av regeringspartiernas program (kompromisserna)
export function coalitionAgreement(state, partyIds) {
  const agreement = {}; const seats = state.riksdag.seats;
  const tot = partyIds.reduce((a, id) => a + (seats[id] || 1), 0);
  for (const p of POLICIES) {
    if (p.type === 'choice') { const votes = {}; for (const id of partyIds) { const v = state.parties[id].program?.[p.id] ?? p.def; votes[v] = (votes[v] || 0) + (seats[id] || 1); } agreement[p.id] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]; }
    else { let s = 0; for (const id of partyIds) s += (state.parties[id].program?.[p.id] ?? p.def) * (seats[id] || 1); const v = s / tot; agreement[p.id] = Number.isInteger(p.step) ? Math.round(v / p.step) * p.step : Math.round(v * 100) / 100; }
  }
  return agreement;
}
export function syncLawFromStats(state) {
  const s = state.sweden.stats; const idx = state.sweden.priceIndex || 1;
  for (const p of POLICIES) { if (p.budget) state.policy[p.id] = Math.round(s[p.budget] / idx); else if (SET_IDS.has(p.id) && STAT_BY_ID[p.id]) state.policy[p.id] = s[p.id]; }
}
export { POLICIES, POLICY_BY_ID, DOMAINS, COMPASS, norm, policyLabel };
