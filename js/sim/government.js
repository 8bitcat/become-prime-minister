// Regeringsbildning (negativ parlamentarism: statsministern tolereras om inte 175+ röstar nej),
// ministrar, budget. AI-partierna bildar regering själva om spelaren inte är inblandad.
import { ISSUES } from '../data/issues.js';
import { RIKSDAG_SEATS } from '../data/parties.js';
import { activeParties } from './opinion.js';
import { clamp } from '../core/util.js';

export const MINISTRIES = [
  { id: 'finans', name: 'Finansminister', issue: 'ekonomi' }, { id: 'utrikes', name: 'Utrikesminister', issue: 'eu' },
  { id: 'justitie', name: 'Justitieminister', issue: 'kriminal' }, { id: 'forsvar', name: 'Försvarsminister', issue: 'forsvar' },
  { id: 'social', name: 'Socialminister', issue: 'valfard' }, { id: 'utbildning', name: 'Utbildningsminister', issue: 'valfard' },
  { id: 'klimat', name: 'Klimat- och miljöminister', issue: 'klimat' }, { id: 'energi', name: 'Energi- och näringsminister', issue: 'energi' },
  { id: 'migration', name: 'Migrationsminister', issue: 'migration' }, { id: 'arbetsmarknad', name: 'Arbetsmarknadsminister', issue: 'arbete' },
  { id: 'landsbygd', name: 'Landsbygdsminister', issue: 'landsbygd' }, { id: 'bostad', name: 'Infrastruktur- och bostadsminister', issue: 'bostad' },
  { id: 'kultur', name: 'Kulturminister', issue: 'varderingar' }, { id: 'eu', name: 'EU-minister', issue: 'eu' },
];

export function ideologicalDistance(a, b) {
  let d = 0; for (const is of ISSUES) d += Math.abs((a.pos[is.id] || 0) - (b.pos[is.id] || 0)); return d / ISSUES.length;
}
// Vill parti q samarbeta med parti p? Avstånd, kordong, relationer, storlek.
export function willingness(state, q, p) {
  if (q.id === p.id) return 100;
  if ((p.demo ?? 0) <= -2 || (q.demo ?? 0) <= -2) return -80; // antidemokratiska partier isoleras
  if ((q.cordon || []).includes(p.id) || (p.cordon || []).includes(q.id)) return -40;
  if (p.ext >= 3 || q.ext >= 3) return -50;
  const d = ideologicalDistance(q, p);
  const rel = q.relations?.[p.id] || 0;
  let w = 70 - d * 1.2 + rel * .5 + (q.bloc === p.bloc && q.bloc !== 'none' ? 25 : 0) - (p.ext === 2 ? 25 : 0) - (p.ext === 1 && q.ext === 0 ? 5 : 0);
  if (p.isPlayer && (p.credibility < 45)) w -= (45 - p.credibility);
  if (!p.inRiksdag) w -= 30;
  return clamp(w, -50, 100);
}

// Vilka partier kan tänkas tolerera (inte rösta nej mot) en statsminister från parti p?
// round = talmansrunda (1…4). Ju fler rundor, desto fler lägger ner sina röster hellre än att tvinga fram extraval.
export function toleranceVote(state, pmParty, coalition, supporters, round = 1) {
  const seats = state.riksdag.seats;
  const inGov = new Set([pmParty.id, ...coalition]);
  const sup = new Set(supporters);
  let yes = 0, no = 0, abst = 0;
  const detail = {};
  for (const q of activeParties(state)) {
    const n = seats[q.id] || 0; if (!n) continue;
    let v;
    if (inGov.has(q.id)) v = 'ja';
    else if (sup.has(q.id)) v = 'ja';
    else {
      const w = willingness(state, q, pmParty);
      const cordoned = (q.cordon || []).includes(pmParty.id) || coalition.some((id) => (q.cordon || []).includes(id));
      v = cordoned && round < 4 ? 'nej' : w > 35 - (round - 1) * 12 ? 'avstår' : w > 10 - (round - 1) * 12 && (q.bloc === pmParty.bloc || q.bloc === 'center') ? 'avstår' : 'nej';
    }
    detail[q.id] = v;
    if (v === 'ja') yes += n; else if (v === 'nej') no += n; else abst += n;
  }
  return { yes, no, abst, passed: no < Math.ceil(RIKSDAG_SEATS / 2), detail };
}

// AI: försök bilda regering efter ett val (eller vid spelstart). Returnerar regeringsobjektet eller null.
export function formGovernmentAI(state, rnd, { exclude = [], round = 1 } = {}) {
  const parties = activeParties(state).filter((p) => (state.riksdag.seats[p.id] || 0) > 0 && !exclude.includes(p.id));
  const seats = state.riksdag.seats;
  const bySize = [...parties].sort((a, b) => seats[b.id] - seats[a.id]);
  const candidates = [];
  for (const pm of bySize.slice(0, 4)) {
    // samla koalition: villiga partier i avståndsordning tills majoritet, annars stödpartier
    const willing = parties.filter((q) => q.id !== pm.id && willingness(state, q, pm) > 25).sort((a, b) => willingness(state, b, pm) - willingness(state, a, pm));
    const coalition = [], supporters = [];
    let total = seats[pm.id];
    for (const q of willing) {
      if (total >= 175) break;
      const w = willingness(state, q, pm);
      if (w > 45 && ideologicalDistance(q, pm) < 32) coalition.push(q.id); else supporters.push(q.id);
      total += seats[q.id];
    }
    const vote = toleranceVote(state, pm, coalition, supporters, round);
    candidates.push({ pm, coalition, supporters, vote, total, score: (vote.passed ? 1000 : 0) + total - (pm.ext || 0) * 12 + (state.government?.pmParty === pm.id ? 3 : 0) });
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates.find((c) => c.vote.passed);
  if (!best) return null;
  return buildGovernment(state, rnd, best.pm.id, best.coalition, best.supporters, best.vote);
}

export function buildGovernment(state, rnd, pmPartyId, coalition, supporters, vote) {
  const seats = state.riksdag.seats;
  const partiesIn = [pmPartyId, ...coalition];
  const govSeats = partiesIn.reduce((a, id) => a + (seats[id] || 0), 0);
  const withSupport = govSeats + supporters.reduce((a, id) => a + (seats[id] || 0), 0);
  const pmParty = state.parties[pmPartyId];
  const gov = {
    pm: pmParty.leader, pmParty: pmPartyId, parties: partiesIn, support: supporters, formed: { ...state.date },
    type: govSeats >= 175 ? 'majority' : withSupport >= 175 ? 'minority-support' : 'minority',
    approval: 48, crisis: 0, ministers: {}, vote, performance: 0, budgets: 0, capital: 55,
    agreement: coalitionAgreement(state, [...partiesIn, ...supporters]),
  };
  // ministrar: posterna fördelas efter mandat, starkaste personerna till viktigaste posterna
  const pool = partiesIn.flatMap((id) => (state.parties[id].people || []).map((pid) => state.people[pid]).filter((x) => x && x.alive && x.id !== pmParty.leader));
  const quota = {}; for (const id of partiesIn) quota[id] = Math.max(1, Math.round((seats[id] / govSeats) * MINISTRIES.length));
  const used = new Set();
  for (const m of MINISTRIES) {
    const cands = pool.filter((p) => !used.has(p.id) && quota[p.partyId] > 0).sort((a, b) => (b.traits.intelligens + b.traits.ledarskap + b.traits.erfarenhet) - (a.traits.intelligens + a.traits.ledarskap + a.traits.erfarenhet));
    const pick = cands[0] || pool.find((p) => !used.has(p.id));
    if (pick) { used.add(pick.id); quota[pick.partyId]--; gov.ministers[m.id] = pick.id; pick.role = 'minister'; pick.ministry = m.id; }
  }
  // pm/partiledare som var ministrar: nollställ roller för övriga
  for (const p of Object.values(state.people)) if (p.role === 'minister' && !used.has(p.id)) { p.role = p.partyId && state.parties[p.partyId]?.leader === p.id ? 'leader' : 'mp'; delete p.ministry; }
  return gov;
}

export function dissolveGovernment(state, reason) {
  const gov = state.government;
  for (const pid of Object.values(gov.ministers || {})) { const p = state.people[pid]; if (p) { p.role = state.parties[p.partyId]?.leader === p.id ? 'leader' : 'mp'; delete p.ministry; } }
  state.government = { pm: null, pmParty: null, parties: [], support: [], formed: null, type: 'caretaker', approval: 30, ministers: {}, caretakerOf: gov.pmParty, crisis: 0 };
  (state.government.history ||= []).push({ ...gov, ended: { ...state.date }, reason });
}

export const isPlayerPM = (state) => state.government.pm && state.government.pm === state.player.leaderId;
export const playerInGov = (state) => state.government.parties.includes(state.player.partyId);

// Regeringens egen "prestation" (för veckorapport & opinion): små beslut som påverkar performance.
export function govAction(state, delta, note) { state.government.performance = clamp((state.government.performance || 0) + delta, -10, 10); if (note) state.government.lastNote = note; }

// Budgeten: regeringen (AI) justerar utgifterna mot sin ideologi varje höst
export function aiBudget(state, rnd) {
  const gov = state.government; if (!gov.pmParty) return null;
  const s = state.sweden.stats;
  const pos = {}; const ids = gov.parties; let tot = 0;
  for (const id of ids) { const p = state.parties[id]; const w = state.riksdag.seats[id] || 1; tot += w; for (const k in p.pos) pos[k] = (pos[k] || 0) + p.pos[k] * w; }
  for (const k in pos) pos[k] /= tot;
  const changes = [];
  const adj = (id, pct, label) => { const before = s[id]; s[id] *= 1 + pct / 100; changes.push({ id, before, after: s[id], label }); };
  if (pos.ekonomi > 30) { adj('skatt_kommunal', -.5, 'Sänkt kommunalskatt'); adj('utg_socialt', -1.5, 'Stramare bidrag'); }
  if (pos.ekonomi < -30) { adj('skatt_statlig', 2, 'Höjd statlig skatt'); adj('utg_socialt', 1.5, 'Höjda ersättningar'); }
  if (pos.forsvar > 40) adj('utg_forsvar', 4, 'Försvarsanslaget höjs');
  if (pos.kriminal > 40) { adj('utg_polis', 4, 'Fler poliser'); adj('utg_rattsvasende', 3, 'Fler fängelseplatser'); }
  if (pos.klimat < -30) { adj('utg_klimat', 8, 'Klimatsatsning'); adj('skatt_koldioxid', 3, 'Höjd koldioxidskatt'); }
  if (pos.klimat > 30) adj('skatt_bensin', -3, 'Sänkt bensinskatt');
  if (pos.valfard < -20) { adj('utg_sjukvard', 2, 'Mer till vården'); adj('utg_utbildning', 1.5, 'Mer till skolan'); }
  if (pos.landsbygd > 40) adj('utg_infrastruktur', 3, 'Vägar och järnväg på landsbygden');
  if (pos.migration > 40) adj('utg_migration', -4, 'Lägre migrationskostnader');
  if (pos.energi > 50) state.policy.karnkraft_mal = Math.min(150, (state.policy.karnkraft_mal ?? 48) + 2);
  gov.budgets = (gov.budgets || 0) + 1;
  syncLawFromStats(state);
  return changes;
}
import { syncLawFromStats, coalitionAgreement } from './policy.js';
