// Val: jämkade uddatalsmetoden (första divisor 1,2), 4 %-spärr, 349 mandat.
// Valnatten räknar län för län med brus så att siffrorna rör sig.
import { REGIONS } from '../data/regions.js';
import { RIKSDAG_SEATS, THRESHOLD } from '../data/parties.js';
import { SEGMENTS } from '../data/segments.js';
import { gauss, clamp, shuffle } from '../core/util.js';
import { activeParties, regionalSupport } from './opinion.js';

export function sainteLague(votes, seats, { threshold = THRESHOLD, firstDivisor = 1.2 } = {}) {
  const tot = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
  const eligible = Object.entries(votes).filter(([, v]) => (v / tot) * 100 >= threshold);
  const out = Object.fromEntries(Object.keys(votes).map((k) => [k, 0]));
  if (!eligible.length) return out;
  for (let i = 0; i < seats; i++) {
    let best = null, bestQ = -1;
    for (const [id, v] of eligible) {
      const q = v / (out[id] === 0 ? firstDivisor : 2 * out[id] + 1);
      if (q > bestQ) { bestQ = q; best = id; }
    }
    out[best]++;
  }
  return out;
}

// Valdagens verkliga resultat: opinionen + valdeltagande per grupp + "bortkastad röst"-effekt + brus
export function computeElection(state, rnd) {
  const parties = activeParties(state);
  const national = {};
  let turnoutTot = 0, weightTot = 0;
  for (const sg of SEGMENTS) {
    const seg = state.opinion.seg[sg.id] || {};
    const w = sg.share * sg.turnout; turnoutTot += sg.share * sg.turnout; weightTot += sg.share;
    for (const p of parties) national[p.id] = (national[p.id] || 0) + (seg[p.id] || 0) * w;
  }
  const turnout = (turnoutTot / weightTot) * 100 + (state.sweden.stats.polarisering - 45) * .1 + gauss(rnd, 0, 1);
  let s = Object.values(national).reduce((a, b) => a + b, 0);
  for (const k in national) national[k] = (national[k] / s) * 100;
  // taktikröstning: partier nära spärren tappar till närmaste större parti i samma block
  for (const p of parties) {
    const v = national[p.id];
    if (v < 4.2 && v > 1) {
      const loss = v * (v < 2.5 ? .45 : v < 3.6 ? .25 : .1);
      const friend = parties.filter((q) => q.id !== p.id && national[q.id] > 5).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (friend) { national[p.id] -= loss; national[friend.id] += loss; }
    }
    national[p.id] = Math.max(0, national[p.id] + gauss(rnd, 0, .4 + Math.sqrt(national[p.id]) * .22) * (state.election.campaignNoise || 1));
  }
  s = Object.values(national).reduce((a, b) => a + b, 0);
  for (const k in national) national[k] = (national[k] / s) * 100;
  // regionalt: regionens profil + nationellt brus
  const regions = {};
  for (const r of REGIONS) {
    const reg = regionalSupport(state, r.id);
    const out = {};
    for (const p of parties) out[p.id] = Math.max(0, reg[p.id] * (national[p.id] / Math.max(.05, state.opinion.support[p.id] || .05)) + gauss(rnd, 0, .6));
    const t = Object.values(out).reduce((a, b) => a + b, 0);
    for (const k in out) out[k] = (out[k] / t) * 100;
    regions[r.id] = { res: out, turnout: clamp(turnout + (r.urban - .75) * 4 + gauss(rnd, 0, 1.5), 60, 95) };
  }
  // nationellt = befolkningsviktat snitt av regionerna (så att valnatten summerar rätt)
  const final = {};
  let popT = 0;
  for (const r of REGIONS) { popT += r.pop; for (const p of parties) final[p.id] = (final[p.id] || 0) + regions[r.id].res[p.id] * r.pop; }
  for (const k in final) final[k] = final[k] / popT;
  const seats = sainteLague(final, RIKSDAG_SEATS);
  const order = shuffle(rnd, REGIONS.map((r) => r.id)); // i vilken ordning länen "rapporterar"
  return { date: { ...state.date }, year: state.date.y, result: final, seats, regions, turnout: Math.round(turnout * 10) / 10, order, prev: state.election.last?.result || null, prevSeats: { ...state.riksdag.seats } };
}
function dist(a, b) { let d = 0; for (const k in a.pos) d += Math.abs(a.pos[k] - (b.pos[k] || 0)); return d; }

// Tillämpa valresultatet på världen
export function applyElection(state, el) {
  state.riksdag.seats = { ...el.seats };
  for (const p of activeParties(state)) {
    p.seats = el.seats[p.id] || 0; p.inRiksdag = p.seats > 0; p.lastResult = el.result[p.id];
    (p.results ||= []).push({ year: el.year, pct: Math.round(el.result[p.id] * 10) / 10, seats: p.seats });
    if (p.inRiksdag) { p.credibility = clamp(p.credibility + 4, 0, 100); state.opinion.awareness[p.id] = 1; }
    else if (state.opinion.awareness[p.id] < 1) state.opinion.awareness[p.id] = clamp(state.opinion.awareness[p.id] + el.result[p.id] / 25, 0, 1);
    // valresultatet blir ny "sanning" för opinionen: lojaliteten nollas mot resultatet
    const f = el.result[p.id] / Math.max(.05, state.opinion.support[p.id] || .05);
    for (const sg of SEGMENTS) { const seg = state.opinion.seg[sg.id]; if (seg && seg[p.id] != null) seg[p.id] *= clamp(f, .4, 2.5); }
    p.momentum = 0;
  }
  for (const sg of SEGMENTS) { const seg = state.opinion.seg[sg.id]; const t = Object.values(seg).reduce((a, b) => a + b, 0); for (const k in seg) seg[k] = (seg[k] / t) * 100; }
  state.opinion.support = { ...el.result };
  state.sweden.stats.valdeltagande = el.turnout;
  state.election.last = el;
  (state.election.history ||= []).push({ year: el.year, result: el.result, seats: el.seats, turnout: el.turnout });
  state.election.next = nextElectionDay(el.year + 4);
  state.election.campaign = false;
  state.election.debatesDone = [];
  state.riksdag.record = {}; // nytt riksdagsår – gamla röster bleknar i debatterna
}
export function nextElectionDay(year) { const first = new Date(Date.UTC(year, 8, 1)); const d = 1 + ((7 - first.getUTCDay()) % 7) + 7; return { y: year, m: 9, d }; }

// Riksdagens block efter ett val (för regeringsbildningen)
export function blocSeats(state) {
  const out = { left: 0, right: 0, center: 0, none: 0 };
  for (const p of activeParties(state)) out[p.bloc || 'none'] += state.riksdag.seats[p.id] || 0;
  return out;
}
