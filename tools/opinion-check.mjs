// Hur stabil är opinionen? Kör flera passiva fyraårsperioder (spelaren gör ingenting) och mäter hur
// mycket riksdagspartierna rör sig. Svensk opinion är trög: ett parti flyttar sig sällan mer än några
// procentenheter per år, och etablerade partier kollapsar inte utan orsak.
//   node tools/opinion-check.mjs [antal frön] [veckor]
import { newGame } from '../js/sim/newgame.js';
import { endWeek } from '../js/sim/turn.js';
import { resolveVote } from '../js/sim/riksdag.js';
import { applyEventChoice } from '../js/sim/events.js';
import { respondScandal } from '../js/sim/scandals.js';
import { buildDebate, resolveOption, finishDebate } from '../js/sim/debate.js';
import { applyElection } from '../js/sim/election.js';
import { formGovernmentAI, aiBudget } from '../js/sim/government.js';
import { applyFactionChoice } from '../js/sim/party.js';
import { IDEOLOGIES } from '../js/data/ideologies.js';
import { makeRng } from '../js/core/util.js';
import { randomLook, randomTraits } from '../js/sim/people.js';

const N = +(process.argv[2] || 6), WEEKS = +(process.argv[3] || 200);
const START = ['s', 'sd', 'm', 'v', 'c', 'kd', 'mp', 'l'];
const agg = {}; const elect = {};
for (let seed = 1; seed <= N; seed++) {
  const r0 = makeRng(seed * 7);
  const leaderDef = { name: 'Test Testsson', first: 'Test', last: 'Testsson', gender: 'k', age: 44, look: randomLook(r0, 'k'), traits: randomTraits(r0), bg: { utbildning: 'Jurist', yrke: 'Advokat', hemstad: 'Umeå', familj: 'Medelklass' } };
  const partyDef = { name: 'Testpartiet', abbr: 'TP', color: '#888', color2: '#fff', logo: { shape: 'star', glyph: 'TP' }, slogan: 'Test', pos: { ...IDEOLOGIES.find((i) => i.id === 'centrism').pos }, profile: {}, ideology: { primary: 'centrism', secondary: [] } };
  const { state, rnd } = newGame({ seed: seed * 101, mode: 'new', party: partyDef, leader: leaderDef });
  const start = Object.fromEntries(START.map((id) => [id, state.opinion.support[id] || 0]));
  const lo = { ...start }, hi = { ...start };
  for (let w = 0; w < WEEKS; w++) {
    endWeek(state, rnd);
    while (state.queue.length) {
      const q = state.queue.shift();
      if (q.type === 'vote') { const item = state.riksdag.bills.find((b) => b.id === q.billItemId); resolveVote(state, rnd, item, 'avstår'); }
      else if (q.type === 'event') applyEventChoice(state, rnd, q.event, q.event.choices[0]?.i ?? 0);
      else if (q.type === 'scandal') { const sc = state.scandals.find((x) => x.id === q.scandalId); respondScandal(state, rnd, sc, 'erkann'); }
      else if (q.type === 'debate' || q.type === 'interview') { const d = buildDebate(state, rnd, { kind: q.type === 'interview' ? 'interview' : q.debate || 'tv' }); d.rounds.forEach((r, i) => resolveOption(state, rnd, d, i, 0)); finishDebate(state, rnd, d); }
      else if (q.type === 'election') { const el = state.election.pending; applyElection(state, el); state.election.pending = null; for (const id of START) (elect[id] ||= []).push(el.result[id] || 0); const g = formGovernmentAI(state, rnd); if (g) state.government = g; }
      else if (q.type === 'formation') { const g = formGovernmentAI(state, rnd, { round: q.round || 1 }); if (g) state.government = g; }
      else if (q.type === 'budget') aiBudget(state, rnd);
      else if (q.type === 'faction') applyFactionChoice(state, rnd, q, 0);
    }
    for (const id of START) { const v = state.opinion.support[id] || 0; lo[id] = Math.min(lo[id], v); hi[id] = Math.max(hi[id], v); }
  }
  for (const id of START) { const a = (agg[id] ||= { d: [], end: [], lo: [], hi: [] }); a.d.push((state.opinion.support[id] || 0) - start[id]); a.end.push(state.opinion.support[id] || 0); a.lo.push(lo[id]); a.hi.push(hi[id]); a.start = start[id]; }
}
const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length;
let absSum = 0, n = 0;
console.log(`Parti  start   slut(medel)  förändring(medel)  |Δ|(medel)  lägsta  högsta   val(medel)`);
for (const id of START) { const a = agg[id]; const ad = mean(a.d.map(Math.abs)); absSum += ad; n++; console.log(`${id.toUpperCase().padEnd(5)} ${a.start.toFixed(1).padStart(5)}   ${mean(a.end).toFixed(1).padStart(6)}       ${(mean(a.d) >= 0 ? '+' : '') + mean(a.d).toFixed(1).padStart(5)}          ${ad.toFixed(1).padStart(5)}    ${Math.min(...a.lo).toFixed(1).padStart(5)}   ${Math.max(...a.hi).toFixed(1).padStart(5)}    ${elect[id] ? mean(elect[id]).toFixed(1) : '-'}`); }
console.log(`Genomsnittlig absolut förändring på ${WEEKS} veckor: ${(absSum / n).toFixed(2)} procentenheter (${N} körningar)`);
