// Opinionen: varje väljargrupp fördelar sig över partierna efter ideologiskt avstånd
// (viktat med vad som är hett just nu), partiledare, trovärdighet, momentum, kännedom,
// skandaler, regeringens leverans – och lojalitet (man byter inte parti över en natt).
import { ISSUES } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { REGIONS } from '../data/regions.js';
import { POLL_INSTITUTES } from '../data/names.js';
import { clamp, gauss } from '../core/util.js';
import { economyMood, securityMood, welfareMood } from './sweden.js';
import { structureEffects } from './party.js';
import { STYLES, PUBLIC_IMAGE } from '../data/persona.js';
import { IDEOLOGY_BY_ID } from '../data/ideologies.js';

export const activeParties = (state) => Object.values(state.parties).filter((p) => p.active !== false);

// Hur väl partiledarens offentliga image stämmer med personligheten (0…1)
export function authenticity(person) {
  const pe = person?.persona; if (!pe) return .7;
  const img = PUBLIC_IMAGE.find((x) => x.id === pe.image); if (!img) return .7;
  const fits = img.fits.filter((f) => (pe.personality || []).includes(f) || pe.style === f || pe.voice === f || pe.bodyLanguage === f).length;
  return clamp(.25 + fits * .3, 0, 1);
}

function partyScore(state, p, sg, sal, prevShare) {
  const eff = p._eff || (p._eff = structureEffects(p));
  let dist = 0, wsum = 0, cred = 0;
  const leader = state.people[p.leader];
  for (const is of ISSUES) {
    const w = (sg.w[is.id] || 1) * (sal[is.id] || 1) * (p.profile?.[is.id] ? 1 + (p.profile[is.id] - 1) * .3 : 1);
    dist += w * Math.abs((p.pos[is.id] || 0) - (sg.ideal[is.id] || 0)); wsum += w;
    if (leader?.cred?.[is.id]) cred += w * leader.cred[is.id];
  }
  dist /= wsum; cred /= wsum;
  let score = -dist / (20 * eff.tolerance) + (cred / 100) * 1.2;
  if (leader) {
    score += sg.leader * (((leader.traits.karisma - 45) / 100) * 1.1 + ((leader.approval - 40) / 100) * 1.2);
    const st = STYLES.find((s) => s.id === leader.persona?.style); if (st?.seg?.[sg.id]) score += Math.log(st.seg[sg.id]);
    const auth = authenticity(leader); if (auth < .5) score -= (0.5 - auth) * .4;
    if (leader.persona?.experience === 'ingen' && (sg.id === 'laginkomst' || sg.id === 'landsbygd' || sg.id === 'storstad_unga')) score += .12;
  }
  score += ((p.credibility - 50) / 100) * .9 * eff.cred + (((p.trust ?? 50) - 50) / 100) * .5;
  const mg = p.structure?.malgrupper || [];
  if (mg.length) score += mg.includes(sg.id) ? .18 - mg.length * .02 : -.03;
  if (p.ext >= 2 || (p.demo ?? 0) <= -1) {
    const tags = new Set([p.ideology?.primary, ...(p.ideology?.secondary || [])].map((id) => IDEOLOGY_BY_ID[id]).filter(Boolean).flatMap((i) => i.tags));
    score -= (p.ext >= 3 ? 1.1 : .35) * (tags.has(sg.id) ? .4 : 1) + ((p.demo ?? 0) <= -2 ? .6 : (p.demo ?? 0) < 0 ? .2 : 0);
  }
  score += (p.momentum || 0) * .12;
  score += sg.media * ((p.attention - 40) / 100) * .45;
  if (state.government.parties.includes(p.id)) {
    const lead = state.government.pm && state.people[state.government.pm]?.partyId === p.id ? 1 : .6;
    score += lead * ((state.government.approval - 45) / 100) * 1.6 - .15;
  }
  const scandal = (state.scandals || []).filter((x) => x.active && x.partyId === p.id).reduce((a, x) => a + x.severity, 0);
  score -= (scandal / 100) * 1.6 * sg.media;
  score += Math.log(Math.max(prevShare, .05) + .3) * .55 * eff.loyalty; // lojalitet
  score += Math.log(clamp(state.opinion.awareness[p.id] ?? 1, .002, 1)) * 1.1; // kännedom
  score += p.base || 0; // varumärke/historia
  if (sg.id === 'laginkomst' || sg.id === 'landsbygd') score += (p.antiElite || 0) * .3;
  return score;
}

export function updateOpinion(state, { inertia = .82, calibrating = false } = {}) {
  const parties = activeParties(state);
  for (const p of parties) p._eff = structureEffects(p);
  const op = state.opinion;
  const sal = op.salience;
  op.seg ||= {};
  const national = {};
  const shareTot = SEGMENTS.reduce((a, s) => a + s.share, 0);
  for (const sg of SEGMENTS) {
    const prev = op.seg[sg.id] || {};
    const scores = parties.map((p) => partyScore(state, p, sg, sal, prev[p.id] ?? 100 / parties.length));
    const mx = Math.max(...scores);
    const ex = scores.map((v) => Math.exp(v - mx));
    const tot = ex.reduce((a, b) => a + b, 0);
    const next = {};
    parties.forEach((p, i) => { const fresh = (ex[i] / tot) * 100; next[p.id] = (prev[p.id] ?? fresh) * inertia * (1 / sg.vol >= 1 ? 1 : 1) + fresh * (1 - inertia); });
    // normalisera (partier kan ha tillkommit/försvunnit)
    const s2 = Object.values(next).reduce((a, b) => a + b, 0);
    for (const k in next) next[k] = (next[k] / s2) * 100;
    op.seg[sg.id] = next;
    for (const p of parties) national[p.id] = (national[p.id] || 0) + next[p.id] * (sg.share / shareTot);
  }
  // momentum = förändring senaste veckorna (svag medvind-effekt)
  const old = op.support || {};
  for (const p of parties) {
    const prevS = old[p.id] ?? national[p.id];
    p.momentum = calibrating ? 0 : clamp(((p.momentum || 0) * .75) + (national[p.id] - prevS) * .12, -1.5, 1.5);
  }
  op.support = national;
  for (const p of parties) delete p._eff;
  if (!calibrating) {
    (op.trend ||= []).push({ week: state.week, s: Object.fromEntries(parties.map((p) => [p.id, Math.round(national[p.id] * 10) / 10])) });
    if (op.trend.length > 520) op.trend.shift();
  }
  // polarisering: hur spridda väljarna är mellan ytterkanter
  let pol = 0;
  for (const p of parties) { const ext = Math.abs(p.pos.ekonomi) + Math.abs(p.pos.migration) + Math.abs(p.pos.varderingar); pol += (national[p.id] / 100) * ext / 3; }
  op.polarization = (pol - 48) * .3;
  return national;
}

// Kalibrera partiernas "varumärke" (base) så att startopinionen matchar startmandaten.
// Körs självkonsistent: lojalitetstermen räknas på de andelar som faktiskt uppstår.
export function calibrateBase(state, targets, iters = 60) {
  const parties = activeParties(state);
  for (const p of parties) p.base = 0;
  state.opinion.seg = {};
  for (let i = 0; i < iters; i++) {
    const sup = updateOpinion(state, { inertia: 0, calibrating: true });
    for (const p of parties) if (targets[p.id] != null) p.base += Math.log(Math.max(targets[p.id], .2) / Math.max(sup[p.id], .2)) * .5;
  }
  // ett parti utan mål (nytt parti) saknar varumärke: lägst av alla, minus lite till
  const minBase = Math.min(...parties.filter((p) => targets[p.id] != null).map((p) => p.base));
  for (const p of parties) if (targets[p.id] == null) p.base = minBase - 1.2;
  for (let i = 0; i < 10; i++) updateOpinion(state, { inertia: 0, calibrating: true });
  for (const p of parties) p.momentum = 0;
}

// Varumärket växer långsamt med organisation, tid och valresultat (nya partier bygger upp det)
export function growBase(state) {
  const parties = activeParties(state);
  const maxBase = Math.max(...parties.map((p) => p.base || 0));
  for (const p of parties) {
    if (!p.isPlayer) continue;
    const target = p.inRiksdag ? maxBase - .3 : (p.results?.length ? maxBase - 1.0 : maxBase - 2.2) + (p.org / 100) * .6;
    p.base = (p.base || 0) + (target - (p.base || 0)) * .004;
  }
}

export function regionalSupport(state, regionId) {
  const r = REGIONS.find((x) => x.id === regionId);
  const parties = activeParties(state);
  const out = {}; let tot = 0;
  for (const sg of SEGMENTS) {
    const w = sg.share * (r.seg[sg.id] || 1);
    tot += w;
    const seg = state.opinion.seg[sg.id] || {};
    for (const p of parties) out[p.id] = (out[p.id] || 0) + (seg[p.id] || 0) * w;
  }
  for (const k in out) out[k] = out[k] / tot;
  // regional grundlutning: vänster/höger
  for (const p of parties) { const lr = (p.pos.ekonomi + p.pos.valfard) / 200; out[p.id] *= 1 + r.lean * lr * .5; }
  const s2 = Object.values(out).reduce((a, b) => a + b, 0);
  for (const k in out) out[k] = (out[k] / s2) * 100;
  return out;
}

// En opinionsmätning: stöd + husfel + brus
export function makePoll(state, rnd) {
  const inst = POLL_INSTITUTES[state.week % POLL_INSTITUTES.length];
  state.opinion.house ||= {};
  const house = (state.opinion.house[inst] ||= {});
  const res = {};
  for (const p of activeParties(state)) {
    house[p.id] ??= gauss(rnd, 0, .4);
    const s = state.opinion.support[p.id] || 0;
    res[p.id] = Math.max(0, Math.round((s + house[p.id] + gauss(rnd, 0, .35 + Math.sqrt(s) * .28)) * 10) / 10);
  }
  const poll = { week: state.week, date: { ...state.date }, inst, res };
  state.opinion.polls.unshift(poll);
  if (state.opinion.polls.length > 300) state.opinion.polls.pop();
  return poll;
}

// Vad är hett? Salience drivs av statistiken (och händelser som lägger på en tillfällig boost).
export function updateSalience(state) {
  const s = state.sweden.stats, op = state.opinion;
  op.boost ||= {};
  const base = {
    ekonomi: 1 + Math.abs(s.inflation - 2) * .12 + (s.arbetsloshet - 8.2) * .08 - (s.reallon) * .05,
    migration: .9 + (s.asylsokande - 11.5) * .02 + (s.integration < 50 ? .15 : 0),
    kriminal: 1 + (s.skjutningar - 320) * .003 + (s.gang_index - 70) * .01,
    klimat: .85 + Math.max(0, 45 - s.utslapp) * -.01 + (s.elpris > 130 ? -.1 : 0),
    forsvar: .8 + (s.sakerhetslage - 65) * .02,
    eu: .6,
    valfard: 1 + (s.vardkoer - 95) * .005 + (s.skolresultat < 480 ? .15 : 0),
    landsbygd: .7 + (s.bensinpris - 17.5) * .05,
    varderingar: .75 + (s.polarisering - 45) * .01,
    arbete: .7 + (s.arbetsloshet - 8.2) * .05 + (s.strejkdagar > 20 ? .2 : 0),
    bostad: .75 + (s.bolanranta - 3.6) * .1 + (s.boendekostnad - 24) * .03,
    energi: .7 + (s.elpris - 85) * .006,
  };
  const next = {};
  for (const is of ISSUES) { next[is.id] = clamp((op.salience?.[is.id] ?? 1) * .6 + (base[is.id] + (op.boost[is.id] || 0)) * .4, .3, 2.5); op.boost[is.id] = (op.boost[is.id] || 0) * .75; }
  const mean = Object.values(next).reduce((a, b) => a + b, 0) / ISSUES.length;
  for (const k in next) next[k] = next[k] / mean;
  op.salience = next;
}

// Regeringens popularitet: leverans + smekmånad + skandaler + trötthet
export function updateGovApproval(state) {
  const gov = state.government;
  if (!gov.pm) { gov.approval = 35; return; }
  const months = gov.formed ? Math.max(0, (state.date.y * 12 + state.date.m) - (gov.formed.y * 12 + gov.formed.m)) : 0;
  const honeymoon = months < 6 ? (6 - months) * 1.2 : 0;
  const fatigue = Math.min(10, months / 12 * 1.6);
  const scandal = (state.scandals || []).filter((x) => x.active && gov.parties.includes(x.partyId)).reduce((a, x) => a + x.severity, 0) * .25;
  const pm = state.people[gov.pm];
  const pmBonus = pm ? (pm.traits.karisma - 45) * .08 + (pm.traits.ledarskap - 45) * .05 : 0;
  const target = 45 + economyMood(state) * 7 + securityMood(state) * 5 + welfareMood(state) * 4 + honeymoon - fatigue - scandal + pmBonus - (gov.crisis || 0) * 2 + (gov.type === 'minority' ? -1.5 : 0) + (gov.performance || 0);
  gov.approval = clamp(gov.approval + (target - gov.approval) * .2, 8, 85);
  gov.performance = (gov.performance || 0) * .9;
}

// Partiledarens stöd bland egna väljare + allmänheten
export function updateLeaderApproval(state) {
  for (const p of activeParties(state)) {
    const l = state.people[p.leader]; if (!l) continue;
    const scandal = (state.scandals || []).filter((x) => x.active && x.partyId === p.id).reduce((a, x) => a + x.severity, 0) * .3;
    const target = 38 + (l.traits.karisma - 45) * .25 + (l.traits.retorik - 45) * .1 + (p.momentum || 0) * 2 + (l.debateBonus || 0) - scandal + (p.id === state.people[state.government.pm]?.partyId ? (state.government.approval - 45) * .4 : 0) + (p.credibility - 50) * .1;
    l.approval = clamp(l.approval + (target - l.approval) * .15, 5, 90);
    l.debateBonus = (l.debateBonus || 0) * .85;
  }
}
