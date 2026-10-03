// Skapar en ny spelomgång: Sverige, partierna, människorna, opinionen, riksdagen, regeringen.
import { START_PARTIES, RIKSDAG_SEATS } from '../data/parties.js';
import { ISSUES } from '../data/issues.js';
import { makeRng, pick, clamp, gauss } from '../core/util.js';
import { makePerson } from './people.js';
import { initSweden } from './sweden.js';
import { calibrateBase, updateSalience, makePoll } from './opinion.js';
import { formGovernmentAI } from './government.js';
import { initWorld } from './world.js';
import { initSocial } from './social.js';
import { addNews } from './news.js';
import { nextElectionDay } from './election.js';
import { SAVE_VERSION } from '../core/state.js';

const START_DATE = { y: 2027, m: 1, d: 4 }; // måndag

function traitBias(party) {
  // partiets kultur färgar ledarens egenskaper lite
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
    program: {}, promises: [],
  };
  // ledare + sex profiler
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
  // relationer mellan partierna: block + avstånd
  for (const a of Object.values(parties)) for (const b of Object.values(parties)) if (a !== b) {
    let d = 0; for (const is of ISSUES) d += Math.abs(a.pos[is.id] - b.pos[is.id]); d /= ISSUES.length;
    a.relations[b.id] = Math.round(clamp(40 - d * 1.2 + (a.bloc === b.bloc ? 20 : 0) - (a.cordon.includes(b.id) ? 40 : 0) + gauss(rnd, 0, 6), -80, 80));
  }
  let playerParty;
  if (mode === 'takeover') {
    playerParty = parties[takeoverId];
    // den gamla ledaren avgår, spelarens ledare tar över
    const old = people[playerParty.leader]; old.role = 'mp'; playerParty.people.push(old.id);
  } else {
    playerParty = {
      id: 'ny', name: partyDef.name, abbr: partyDef.abbr, color: partyDef.color, color2: partyDef.color2 || '#ffffff', logo: partyDef.logo, slogan: partyDef.slogan,
      pos: { ...partyDef.pos }, profile: partyDef.profile || {}, bloc: 'none', cordon: [], founded: START_DATE.y, members: 150, money: 50000, seats: 0, inRiksdag: false,
      org: 8, unity: 85, credibility: 40, attention: 1, momentum: 0, base: 0, isPlayer: true, people: [], relations: {}, risk: 0, active: true, lastResult: null, results: [], program: partyDef.program || {}, promises: [],
    };
    for (let i = 0; i < 3; i++) { const p = makePerson(rnd, { partyId: 'ny', role: 'mp' }); people[p.id] = p; playerParty.people.push(p.id); }
    parties.ny = playerParty;
    for (const q of Object.values(parties)) if (q !== playerParty) { q.relations.ny = -5; playerParty.relations[q.id] = 0; }
    // andra partiers block-syn på det nya partiet: hamnar vid det närmaste blocket
    const lr = (playerParty.pos.ekonomi + playerParty.pos.valfard) / 2;
    playerParty.bloc = lr < -20 ? 'left' : lr > 20 ? 'right' : 'center';
  }
  const leader = makePerson(rnd, { ...leaderDef, id: 'player', partyId: playerParty.id, role: 'leader', since: { ...START_DATE } });
  leader.traits = { ...leaderDef.traits }; leader.look = { ...leaderDef.look }; leader.bg = { ...leaderDef.bg }; leader.name = leaderDef.name; leader.first = leaderDef.first; leader.last = leaderDef.last; leader.age = leaderDef.age; leader.gender = leaderDef.gender;
  leader.approval = 35; leader.scandalRisk = Math.round(30 - leader.traits.integritet * .2);
  people[leader.id] = leader; playerParty.leader = leader.id;

  const sweden = initSweden(rnd);
  const state = {
    v: SAVE_VERSION, seed, rngState: 0, created: Date.now(), updated: Date.now(),
    date: { ...START_DATE }, week: 0, mode, player: { partyId: playerParty.id, leaderId: leader.id },
    parties, people, sweden,
    opinion: { support: {}, seg: {}, awareness: {}, salience: Object.fromEntries(ISSUES.map((i) => [i.id, 1])), boost: {}, polls: [], trend: [], house: {} },
    riksdag: { seats: Object.fromEntries(Object.values(parties).map((p) => [p.id, p.seats])), bills: [], record: {}, owed: [], passedRecently: 0, session: true },
    government: { pm: null, pmParty: null, parties: [], support: [], formed: null, type: 'caretaker', approval: 40, ministers: {}, crisis: 0, performance: 0 },
    election: { next: nextElectionDay(2030), campaign: false, last: null, history: [], debatesDone: [] },
    news: [], social: null, events: { log: [], done: [] }, scandals: [], world: initWorld(rnd),
    ap: 4, apMax: 4, queue: [], log: [], flags: {}, stats: { weeks: 0, debates: 0, debatesWon: 0, billsPassed: 0, posts: 0 },
  };
  for (const p of Object.values(parties)) state.opinion.awareness[p.id] = p.inRiksdag ? 1 : 0.004;
  // opinionen kalibreras mot startmandaten
  const targets = {}; for (const p of Object.values(parties)) if (p.inRiksdag) targets[p.id] = (p.seats / RIKSDAG_SEATS) * 100 * (0.97 + rnd() * 0.06);
  updateSalience(state);
  calibrateBase(state, targets);
  for (const p of Object.values(parties)) p.posStart = { ...p.pos };
  // regering vid start (bildad hösten 2026 i spelets fiktion)
  const gov = formGovernmentAI(state, rnd);
  if (gov) { state.government = gov; state.government.formed = { y: 2026, m: 10, d: 15 }; }
  for (let i = 0; i < 3; i++) makePoll(state, rnd);
  initSocial(state);
  // inledande nyheter
  const pmP = gov ? parties[gov.pmParty] : null;
  addNews(state, { outlet: 'svt', headline: 'Nytt politiskt år – så ser läget ut', body: pmP ? `Regeringen ${gov.parties.map((id) => parties[id].abbr).join('+')} under statsminister ${people[gov.pm].name} (${pmP.abbr}) går in i sitt första hela år. ${gov.support.length ? 'Stödpartier: ' + gov.support.map((id) => parties[id].abbr).join(', ') + '.' : ''} Nästa val hålls i september 2030.` : 'Sverige saknar regering och går in i det nya året med en expeditionsministär.', tags: ['politik'], importance: 2 });
  if (mode === 'new') addNews(state, { outlet: pick(rnd, ['expressen', 'aftonbladet']), headline: `Nytt parti bildat: ${playerParty.name}`, body: `${leader.name}, ${leader.age}, ${leader.bg.yrke.toLowerCase()} från ${leader.bg.hemstad}, lanserar ${playerParty.name} (${playerParty.abbr}) med parollen "${playerParty.slogan}". Få tror att partiet kommer att märkas i opinionen.`, tags: ['parti'], partyId: playerParty.id, importance: 1 });
  else addNews(state, { outlet: 'svt', headline: `${leader.name} ny partiledare för ${playerParty.name}`, body: `Efter en snabb process valdes ${leader.name}, ${leader.age}, till ny partiledare. "Jag är ödmjuk inför uppdraget", säger ${leader.first}. ${state.government.pm === leader.id ? 'Som ledare för det största regeringspartiet blir ' + leader.first + ' också ny statsminister.' : ''}`, tags: ['parti'], partyId: playerParty.id, importance: 3 });
  state.rngState = rnd.state();
  return { state, rnd };
}
