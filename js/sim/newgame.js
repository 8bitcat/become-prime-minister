// Skapar en ny spelomgång: Sverige, partierna, människorna, opinionen, riksdagen, regeringen,
// journalisterna och influerarna.
import { START_PARTIES, RIKSDAG_SEATS } from '../data/parties.js';
import { ISSUES } from '../data/issues.js';
import { IDEOLOGY_BY_ID, extremismOf, demoOf } from '../data/ideologies.js';
import { makeRng, pick, clamp, gauss } from '../core/util.js';
import { makePerson, applyPersona, credOf, fixLook, randomPersona } from './people.js';
import { initSweden } from './sweden.js';
import { calibrateBase, updateSalience, makePoll } from './opinion.js';
import { formGovernmentAI } from './government.js';
import { initWorld } from './world.js';
import { initSocial } from './social.js';
import { addNews } from './news.js';
import { nextElectionDay } from './election.js';
import { SAVE_VERSION } from '../core/state.js';
import { defaultStructure, initFactions } from './party.js';
import { initJournalists, initInfluencers } from './media.js';
import { defaultPolicy } from '../data/policies.js';
import { programFromAxes, syncAxes, coalitionAgreement } from './policy.js';
import { recordStatement } from '../ai/memory.js';

const START_DATE = { y: 2027, m: 1, d: 4 }; // måndag
const START_IDEOLOGY = { s: 'socialdemokrati', sd: 'nationalkonservatism', m: 'liberalkonservatism', v: 'dem_socialism', c: 'gron_liberalism', kd: 'kristdemokrati', mp: 'gron', l: 'liberalism' };

function traitBias(party) {
  const b = {};
  if (party.pos.varderingar > 40) b.integritet = 4;
  if (party.pos.migration > 60) b.aggressivitet = 10;
  if (party.pos.ekonomi > 40) b.intelligens = 4;
  if (party.pos.ekonomi < -40) b.social = 5;
  if (party.pos.klimat < -60) b.karisma = -3;
  return b;
}

export function makeParty(def, rnd, people, { isPlayer = false } = {}) {
  const party = {
    id: def.id, name: def.name, abbr: def.abbr, color: def.color, color2: def.color2 || '#ffffff', logo: def.logo, slogan: def.slogan,
    pos: { ...def.pos }, profile: def.profile || {}, bloc: def.bloc || 'none', cordon: def.cordon || [],
    founded: def.founded, members: def.members, money: def.money, seats: def.seats || 0, inRiksdag: (def.seats || 0) > 0,
    org: def.seats ? 60 + Math.round(def.seats / 4) : 10, unity: 70, credibility: 55, attention: def.seats ? 30 + Math.round(def.seats / 3) : 2, momentum: 0, base: 0,
    isPlayer, people: [], relations: {}, risk: 0, active: true, lastResult: def.seats ? Math.round((def.seats / RIKSDAG_SEATS) * 1000) / 10 : null, results: [],
    program: {}, promises: [], trust: 50, activists: 0, factions: [], localBase: { kommuner: Math.round((def.seats || 0) * 2.2), regionSeats: {} }, manifest: null,
    structure: defaultStructure(def), ideology: { primary: START_IDEOLOGY[def.id] || 'centrism', secondary: [] }, ext: 0, demo: 0,
  };
  party.ext = extremismOf(party.ideology.primary); party.demo = demoOf(party.ideology.primary);
  const leader = makePerson(rnd, { partyId: party.id, role: 'leader', bias: traitBias(party), age: clamp(Math.round(gauss(rnd, 50, 8)), 32, 70), since: { y: 2020 + Math.floor(rnd() * 6), m: 1 + Math.floor(rnd() * 12), d: 1 } });
  people[leader.id] = leader; party.leader = leader.id;
  const n = def.seats ? 7 : 3;
  for (let i = 0; i < n; i++) { const p = makePerson(rnd, { partyId: party.id, role: 'mp', bias: traitBias(party) }); people[p.id] = p; party.people.push(p.id); }
  return party;
}

export function newGame({ seed = Date.now() % 2147483647, mode, takeoverId, party: partyDef, leader: leaderDef }) {
  const rnd = makeRng(seed);
  const people = {};
  const parties = {};
  for (const def of START_PARTIES) parties[def.id] = makeParty(def, rnd, people, { isPlayer: mode === 'takeover' && def.id === takeoverId });
  for (const a of Object.values(parties)) for (const b of Object.values(parties)) if (a !== b) {
    let d = 0; for (const is of ISSUES) d += Math.abs(a.pos[is.id] - b.pos[is.id]); d /= ISSUES.length;
    a.relations[b.id] = Math.round(clamp(40 - d * 1.2 + (a.bloc === b.bloc ? 20 : 0) - (a.cordon.includes(b.id) ? 40 : 0) + gauss(rnd, 0, 6), -80, 80));
  }
  let playerParty;
  if (mode === 'takeover') {
    playerParty = parties[takeoverId];
    const old = people[playerParty.leader]; old.role = 'mp'; playerParty.people.push(old.id);
  } else {
    const ideology = partyDef.ideology || { primary: 'centrism', secondary: [] };
    playerParty = {
      id: 'ny', name: partyDef.name, abbr: partyDef.abbr, color: partyDef.color, color2: partyDef.color2 || '#ffffff', logo: partyDef.logo, slogan: partyDef.slogan,
      pos: { ...partyDef.pos }, profile: partyDef.profile || {}, bloc: 'none', cordon: [], founded: START_DATE.y, members: 150, money: 50000, seats: 0, inRiksdag: false,
      org: 8, unity: 85, credibility: 40, attention: 1, momentum: 0, base: 0, isPlayer: true, people: [], relations: {}, risk: 0, active: true, lastResult: null, results: [], program: {}, promises: [],
      trust: 50, activists: 10, factions: [], localBase: { kommuner: 0, regionSeats: {} }, manifest: null,
      structure: { ...defaultStructure(), ...(partyDef.structure || {}) }, ideology, ext: extremismOf(ideology.primary, ideology.secondary), demo: demoOf(ideology.primary, ideology.secondary),
    };
    for (let i = 0; i < 3; i++) { const p = makePerson(rnd, { partyId: 'ny', role: 'mp' }); people[p.id] = p; playerParty.people.push(p.id); }
    parties.ny = playerParty;
    for (const q of Object.values(parties)) if (q !== playerParty) { q.relations.ny = playerParty.ext >= 3 ? -60 : playerParty.ext === 2 ? -25 : -5; playerParty.relations[q.id] = 0; }
    const lr = (playerParty.pos.ekonomi + playerParty.pos.valfard) / 2;
    playerParty.bloc = lr < -20 ? 'left' : lr > 20 ? 'right' : 'center';
    if (playerParty.ext >= 2) for (const q of Object.values(parties)) if (q !== playerParty) q.cordon.push('ny');
  }
  // spelarens ledare
  const persona = leaderDef.persona || randomPersona(rnd, { age: leaderDef.age, gender: leaderDef.gender, role: 'leader' });
  const leader = makePerson(rnd, { id: 'player', partyId: playerParty.id, role: 'leader', since: { ...START_DATE }, gender: leaderDef.gender, age: leaderDef.age, first: leaderDef.first, last: leaderDef.last, persona, look: fixLook({ ...leaderDef.look }), traits: { ...leaderDef.traits } });
  leader.name = leaderDef.name; leader.bg = { ...leaderDef.bg }; leader.baseTraits = { ...leaderDef.traits }; leader.traits = applyPersona(leaderDef.traits, persona); leader.cred = credOf(persona);
  leader.approval = 35; leader.scandalRisk = Math.round(30 - leader.traits.integritet * .2); leader.ambition = 80; leader.loyalty = 99;
  people[leader.id] = leader; playerParty.leader = leader.id;

  const sweden = initSweden(rnd);
  const state = {
    v: SAVE_VERSION, seed, rngState: 0, created: Date.now(), updated: Date.now(),
    date: { ...START_DATE }, week: 0, mode, player: { partyId: playerParty.id, leaderId: leader.id },
    parties, people, sweden,
    opinion: { support: {}, seg: {}, awareness: {}, salience: Object.fromEntries(ISSUES.map((i) => [i.id, 1])), boost: {}, polls: [], trend: [], house: {} },
    riksdag: { seats: Object.fromEntries(Object.values(parties).map((p) => [p.id, p.seats])), bills: [], record: {}, owed: [], passedRecently: 0, session: true },
    government: { pm: null, pmParty: null, parties: [], support: [], formed: null, type: 'caretaker', approval: 40, ministers: {}, crisis: 0, performance: 0, history: [] },
    election: { next: nextElectionDay(2030), campaign: false, last: null, history: [], debatesDone: [] },
    news: [], social: null, events: { log: [], done: [] }, scandals: [], world: initWorld(rnd),
    journalists: initJournalists(rnd), influencers: initInfluencers(rnd),
    history: { leaders: [], timeline: [{ date: { ...START_DATE }, week: 0, kind: 'start', text: mode === 'new' ? `${playerParty.name} bildas av ${leader.name}.` : `${leader.name} tar över som partiledare för ${playerParty.name}.` }], bios: [] },
    ap: 4, apMax: 4, queue: [], log: [], flags: {}, stats: { weeks: 0, debates: 0, debatesWon: 0, billsPassed: 0, posts: 0 },
    policy: defaultPolicy(), reforms: [],
    memory: { statements: [], persona: { saklig: 0, kampande: 0, aggressiv: 0, humor: 0, kansla: 0, undvikande: 0, n: 0 }, promises: [], corrections: 0 }, secretDeals: [],
  };
  if (partyDef?.manifesto) { playerParty.manifesto = partyDef.manifesto; playerParty.ideologyName = partyDef.ideologyName || null; }
  if (leaderDef.sprite) leader.sprite = leaderDef.sprite;
  for (const p of Object.values(parties)) { p.program = programFromAxes(p.pos); if (!p.isPlayer || mode === 'takeover') syncAxes(p); else { /* nytt parti: programmet härleds ur den valda ideologin */ syncAxes(p); } }
  for (const p of Object.values(parties)) { state.opinion.awareness[p.id] = p.inRiksdag ? 1 : 0.004; state.history.leaders.push({ personId: p.leader, partyId: p.id, name: people[p.leader].name, from: people[p.leader].since || { ...START_DATE }, to: null, reason: null }); }
  for (const j of Object.values(state.journalists)) { people[j.person.id] = j.person; delete j.person; j.personId = Object.keys(people).find((id) => people[id].name === j.name); }
  const targets = {}; for (const p of Object.values(parties)) if (p.inRiksdag) targets[p.id] = (p.seats / RIKSDAG_SEATS) * 100 * (0.97 + rnd() * 0.06);
  updateSalience(state);
  calibrateBase(state, targets);
  for (const p of Object.values(parties)) { p.posStart = { ...p.pos }; initFactions(state, rnd, p); }
  const gov = formGovernmentAI(state, rnd);
  if (gov) { state.government = gov; state.government.formed = { y: 2026, m: 10, d: 15 }; state.government.history = []; state.government.capital = 55; state.government.agreement = coalitionAgreement(state, [...gov.parties, ...gov.support]); state.history.timeline.push({ date: { y: 2026, m: 10, d: 15 }, week: -12, kind: 'regering', text: `Regeringen ${gov.parties.map((id) => parties[id].abbr).join('+')} tillträder under ${people[gov.pm].name}.` }); }
  for (let i = 0; i < 3; i++) makePoll(state, rnd);
  initSocial(state);
  const pmP = gov ? parties[gov.pmParty] : null;
  addNews(state, { outlet: 'svt', headline: 'Nytt politiskt år – så ser läget ut', body: pmP ? `Regeringen ${gov.parties.map((id) => parties[id].abbr).join('+')} under statsminister ${people[gov.pm].name} (${pmP.abbr}) går in i sitt första hela år. ${gov.support.length ? 'Stödpartier: ' + gov.support.map((id) => parties[id].abbr).join(', ') + '.' : ''} Nästa val hålls i september 2030.` : 'Sverige saknar regering och går in i det nya året med en expeditionsministär.', tags: ['politik'], importance: 2 });
  if (mode === 'new') addNews(state, { outlet: pick(rnd, ['expressen', 'aftonbladet']), headline: `Nytt parti bildat: ${playerParty.name}`, body: `${leader.name}, ${leader.age}, ${leader.bg.yrke.toLowerCase()} från ${leader.bg.hemstad}, lanserar ${playerParty.name} (${playerParty.abbr}) – ${IDEOLOGY_BY_ID[playerParty.ideology.primary]?.name.toLowerCase() || 'ett nytt parti'} – med parollen "${playerParty.slogan}". ${playerParty.ext >= 3 ? 'Samtliga riksdagspartier tar avstånd.' : 'Få tror att partiet kommer att märkas i opinionen.'}`, tags: ['parti'], partyId: playerParty.id, importance: playerParty.ext >= 2 ? 2 : 1 });
  else addNews(state, { outlet: 'svt', headline: `${leader.name} ny partiledare för ${playerParty.name}`, body: `Efter en snabb process valdes ${leader.name}, ${leader.age}, till ny partiledare. "Jag är ödmjuk inför uppdraget", säger ${leader.first}. ${state.government.pm === leader.id ? 'Som ledare för det största regeringspartiet blir ' + leader.first + ' också ny statsminister.' : ''}`, tags: ['parti'], partyId: playerParty.id, importance: 3 });
  // programförklaringen i egna ord: löften och ståndpunkter registreras i det politiska minnet
  if (playerParty.manifesto) recordStatement(state, playerParty.manifesto, 'program', { audience: 'public' });
  state.rngState = rnd.state();
  return { state, rnd };
}
