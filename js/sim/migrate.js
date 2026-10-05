// Uppgraderar äldre sparningar till dagens format utan att förstöra progress.
import { defaultStructure } from './party.js';
import { fixLook, randomPersona, credOf } from './people.js';
import { initJournalists, initInfluencers } from './media.js';
import { makeRng } from '../core/util.js';
import { extremismOf, demoOf } from '../data/ideologies.js';
import { defaultPolicy, POLICIES } from '../data/policies.js';
import { STATS } from '../data/stats.js';
import { programFromAxes } from './policy.js';

const START_IDEOLOGY = { s: 'socialdemokrati', sd: 'nationalkonservatism', m: 'liberalkonservatism', v: 'dem_socialism', c: 'gron_liberalism', kd: 'kristdemokrati', mp: 'gron', l: 'liberalism' };
export const CURRENT_SAVE = 4;

export function migrate(state) {
  const rnd = makeRng((state.seed || 1) ^ 0x5a5a);
  const from = state.v || 1;
  for (const p of Object.values(state.parties)) {
    p.structure ||= defaultStructure(['s', 'sd', 'm', 'v', 'c', 'kd', 'mp', 'l'].includes(p.id) ? { id: p.id } : null);
    p.structure.malgrupper ||= [];
    p.factions ||= []; p.activists ??= Math.round((p.members || 0) * .06); p.trust ??= 50; p.localBase ||= { kommuner: Math.round((p.seats || 0) * 2.2), regionSeats: {} }; p.manifest ||= null;
    p.ideology ||= { primary: START_IDEOLOGY[p.id] || 'centrism', secondary: [] };
    p.ext ??= extremismOf(p.ideology.primary, p.ideology.secondary); p.demo ??= demoOf(p.ideology.primary, p.ideology.secondary);
    p.results ||= []; p.promises ||= []; p.people ||= []; p.relations ||= {};
    p.program ||= programFromAxes(p.pos);
  }
  for (const per of Object.values(state.people)) {
    per.look = fixLook(per.look || {});
    per.persona ||= randomPersona(rnd, { age: per.age, gender: per.gender, role: per.role });
    per.cred ||= credOf(per.persona); per.baseTraits ||= { ...per.traits };
    per.ambition ??= 50; per.loyalty ??= 60; per.career ||= []; per.posDelta ||= {};
  }
  state.journalists ||= (() => { const j = initJournalists(rnd); for (const x of Object.values(j)) { state.people[x.person.id] = x.person; x.personId = x.person.id; delete x.person; } return j; })();
  for (const j of Object.values(state.journalists)) if (j.person) { state.people[j.person.id] = j.person; j.personId = j.person.id; delete j.person; }
  state.influencers ||= initInfluencers(rnd);
  state.history ||= { leaders: Object.values(state.parties).map((p) => ({ personId: p.leader, partyId: p.id, name: state.people[p.leader]?.name || '?', from: state.people[p.leader]?.since || state.date, to: null, reason: null })), timeline: [], bios: [] };
  state.government.history ||= [];
  state.stats ||= { weeks: state.week, debates: 0, debatesWon: 0, billsPassed: 0, posts: 0 };
  state.flags ||= {};
  if (!state.policy) { state.policy = defaultPolicy(); const s = state.sweden.stats; for (const k of Object.keys(state.policy)) if (s[k] != null && typeof s[k] === 'number') state.policy[k] = s[k]; }
  // nya politikområden och mätserier: gällande lag = dagens, partiernas ståndpunkt härleds ur deras axlar
  for (const pol of POLICIES) if (state.policy[pol.id] == null) state.policy[pol.id] = pol.def;
  for (const p of Object.values(state.parties)) { let base = null; for (const pol of POLICIES) if (p.program[pol.id] == null) { base ||= programFromAxes(p.pos); p.program[pol.id] = base[pol.id]; } }
  for (const st of STATS) if (!st.derived && state.sweden.stats[st.id] == null) state.sweden.stats[st.id] = st.init;
  state.reforms ||= []; state.sweden.priceIndex ||= 1 + (state.sweden.months || 0) * .002; state.sweden.stats.integritet ??= 75;
  state.government.capital ??= 50; state.riksdag.vilande ||= [];
  // v4: politiskt minne, fritext-inlägg, trötthet, hemliga uppgörelser
  state.memory ||= { statements: [], persona: { saklig: 0, kampande: 0, aggressiv: 0, humor: 0, kansla: 0, undvikande: 0, n: 0 }, promises: [], corrections: 0 };
  state.secretDeals ||= [];
  for (const po of state.social?.posts || []) { po.comments ||= []; po.deleted ??= false; }
  for (const per of Object.values(state.people)) per.fatigue ??= 0;
  state.memory.persona.dryg ??= 0; // v5: dryghet som egen ton
  state.v = CURRENT_SAVE;
  return from;
}
