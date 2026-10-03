// Huvudlös simulering: ny spelomgång + N veckor med automatiska beslut. Fångar körfel och
// visar att opinion/ekonomi/val beter sig rimligt. node tools/sim-test.mjs [veckor] [new|takeover] [seed]
import { newGame } from '../js/sim/newgame.js';
import { endWeek, doAction, ACTIONS, actionAvailable } from '../js/sim/turn.js';
import { resolveVote } from '../js/sim/riksdag.js';
import { applyEventChoice } from '../js/sim/events.js';
import { respondScandal } from '../js/sim/scandals.js';
import { buildDebate, resolveOption, finishDebate } from '../js/sim/debate.js';
import { applyElection } from '../js/sim/election.js';
import { formGovernmentAI, aiBudget } from '../js/sim/government.js';
import { composePost } from '../js/sim/social.js';
import { IDEOLOGIES, ISSUES } from '../js/data/issues.js';
import { makeRng } from '../js/core/util.js';
import { randomLook, randomTraits } from '../js/sim/people.js';
import { activeParties } from '../js/sim/opinion.js';

const weeks = +(process.argv[2] || 220);
const mode = process.argv[3] || 'new';
const seed = +(process.argv[4] || 42);
const r0 = makeRng(seed + 1);
const leaderDef = { name: 'Test Testsson', first: 'Test', last: 'Testsson', gender: 'k', age: 44, look: randomLook(r0, 'k'), traits: randomTraits(r0), bg: { utbildning: 'Jurist', yrke: 'Advokat', hemstad: 'Umeå', familj: 'Medelklass' } };
const partyDef = { name: 'Framtidspartiet', abbr: 'FP', color: '#8e44ad', color2: '#fff', logo: { shape: 'star', glyph: 'FP' }, slogan: 'Framåt!', pos: { ...IDEOLOGIES.find((i) => i.id === 'teknokrati').pos }, profile: { energi: 1.6, valfard: 1.3 } };
const { state, rnd } = newGame({ seed, mode, takeoverId: 's', party: partyDef, leader: leaderDef });
const me = () => state.parties[state.player.partyId];
const fmtSup = () => activeParties(state).map((p) => `${p.abbr} ${(state.opinion.support[p.id] || 0).toFixed(1)}`).join('  ');
console.log(`Start: ${mode} · regering: ${state.government.parties.join('+')} stöd ${state.government.support.join(',')} typ ${state.government.type}`);
console.log('v0  ' + fmtSup());
let errors = 0, debates = 0, votes = 0, events = 0, scandals = 0, elections = 0;
for (let w = 0; w < weeks; w++) {
  try {
    // spela: några handlingar per vecka
    const acts = ACTIONS.filter((a) => actionAvailable(state, a) && a.id !== 'vila');
    for (let k = 0; k < 3 && state.ap > 0; k++) {
      const a = acts[Math.floor(rnd() * acts.length)]; if (!a) break;
      const params = { issue: ISSUES[Math.floor(rnd() * 12)].id, region: 'AB', party: activeParties(state).find((p) => !p.isPlayer).id, amount: 10, bill: 'skatt_arbete_ner' };
      if (a.id === 'forhandla' || a.id === 'program') continue;
      doAction(state, rnd, a.id, params);
    }
    if (rnd() < .5) composePost(state, rnd, { platform: 'x', kind: 'issue', issue: 'ekonomi', tone: 'saklig', format: 'text' });
    endWeek(state, rnd);
    // processa kön
    while (state.queue.length) {
      const q = state.queue.shift();
      if (q.type === 'vote') { const item = state.riksdag.bills.find((b) => b.id === q.billItemId); resolveVote(state, rnd, item, 'ja'); votes++; }
      else if (q.type === 'event') { applyEventChoice(state, rnd, q.event, q.event.choices[0]?.i ?? 0); events++; }
      else if (q.type === 'scandal') { const sc = state.scandals.find((x) => x.id === q.scandalId); respondScandal(state, rnd, sc, 'erkann'); scandals++; }
      else if (q.type === 'debate' || q.type === 'interview') { const d = buildDebate(state, rnd, { kind: q.type === 'interview' ? 'interview' : q.debate || 'tv', campaign: q.campaign }); d.rounds.forEach((r, i) => resolveOption(state, rnd, d, i, Math.floor(rnd() * r.options.length))); finishDebate(state, rnd, d); debates++; }
      else if (q.type === 'election') { const el = state.election.pending; applyElection(state, el); state.election.pending = null; elections++; console.log(`\n🗳️ VAL ${el.year}: ` + activeParties(state).map((p) => `${p.abbr} ${el.result[p.id].toFixed(1)}% (${el.seats[p.id]})`).join(' · ') + ` · valdeltagande ${el.turnout}`); const gov = formGovernmentAI(state, rnd); if (gov) { state.government = gov; console.log(`   regering: ${gov.parties.join('+')} stöd [${gov.support.join(',')}] ${gov.type}`); } else console.log('   INGEN REGERING'); }
      else if (q.type === 'formation') { const gov = formGovernmentAI(state, rnd, { round: q.round || 1 }); if (gov) { state.government = gov; console.log(`   runda ${q.round || 1}: regering ${gov.parties.join('+')} stöd [${gov.support.join(',')}] ${gov.type}`); } }
      else if (q.type === 'budget') aiBudget(state, rnd);
    }
    if (state.week % 20 === 0) { const s = state.sweden.stats; console.log(`v${state.week} ${state.date.y}-${String(state.date.m).padStart(2, '0')}  ${fmtSup()}  | aw ${(state.opinion.awareness[me().id]).toFixed(2)} att ${me().attention.toFixed(0)} cred ${me().credibility.toFixed(0)} kr ${(me().money / 1e3).toFixed(0)}k | BNP ${s.bnp_tillvaxt.toFixed(1)} infl ${s.inflation.toFixed(1)} arb ${s.arbetsloshet.toFixed(1)} ränta ${s.styrranta} skjut ${s.skjutningar.toFixed(0)} vårdkö ${s.vardkoer.toFixed(0)} skuld ${s.statsskuld_bnp.toFixed(0)}% gov ${state.government.approval.toFixed(0)}`); }
  } catch (e) { errors++; console.error(`FEL vecka ${state.week}:`, e.stack); if (errors > 3) break; }
}
const s = state.sweden.stats;
console.log(`\nKlart: ${weeks} veckor · debatter ${debates} · omröstningar ${votes} · händelser ${events} · skandaler ${scandals} · val ${elections} · nyheter ${state.news.length} · fel ${errors}`);
const bad = Object.entries(s).filter(([k, v]) => !Number.isFinite(v));
console.log(bad.length ? 'ICKE-NUMERISKA STATS: ' + bad.map(([k]) => k).join(', ') : 'Alla stats numeriska.');
console.log('Sparstorlek: ' + (JSON.stringify(state).length / 1024).toFixed(0) + ' kB');
process.exit(errors ? 1 : 0);
