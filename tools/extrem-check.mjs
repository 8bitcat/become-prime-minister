// Stresstest för ytterlighetspolitiken. Tvingar gällande lag till ett extremt läge (diktatur respektive
// statslöshet), kör N veckor med AI-regering och kö som i sim-test och jämför med en kontrollkörning med
// samma frö utan tvång. Kontrollerar också registrets markörer (x/ext/demo, xFrom/xTo, extreme) och att
// AI-partiernas program aldrig hamnar på ett ytterlighetsalternativ.
//   node tools/extrem-check.mjs [veckor] [frö]
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
import { START_PARTIES } from '../js/data/parties.js';
import { POLICIES, POLICY_BY_ID, extremeOf, normalRange } from '../js/data/policies.js';
import { programFromAxes } from '../js/sim/policy.js';
import { makeRng } from '../js/core/util.js';
import { randomLook, randomTraits } from '../js/sim/people.js';

const WEEKS = +(process.argv[2] || 120), SEED = +(process.argv[3] || 11);
let fail = 0;
const bad = (msg) => { fail++; console.log('✗ ' + msg); };

// --- 1. registret: markörer och format ---
let nx = 0, nxs = 0;
for (const p of POLICIES) {
  if (p.type === 'choice') {
    if (!p.options.some((o) => o.id === p.def)) bad(`${p.id}: def saknas bland alternativen`);
    if (p.options.find((o) => o.id === p.def)?.x) bad(`${p.id}: gällande lag är ett ytterlighetsalternativ`);
    for (const o of p.options) {
      if (o.x) { nx++; if (![1, 2, 3].includes(o.ext) || ![0, -1, -2, -3].includes(o.demo)) bad(`${p.id}.${o.id}: x utan giltiga ext/demo`); if (!o.desc) bad(`${p.id}.${o.id}: saknar beskrivning`); }
      if (Math.abs(o.v) > 1 && !o.x) bad(`${p.id}.${o.id}: |v| > 1 utan x`);
      if (o.x && Math.abs(o.v) < 1) bad(`${p.id}.${o.id}: ytterlighet med |v| < 1`);
    }
  } else if (p.xFrom != null || p.xTo != null) {
    nxs++;
    const [lo, hi] = normalRange(p);
    if (typeof p.extreme !== 'function') bad(`${p.id}: xFrom/xTo utan extreme()`);
    if (!(lo <= p.def && p.def <= hi)) bad(`${p.id}: def utanför normalintervallet`);
    for (let v = p.min; v <= p.max; v += p.step * Math.max(1, Math.round((p.max - p.min) / p.step / 400))) {
      const m = extremeOf(p, v); const inside = v >= lo && v <= hi;
      if (inside && (m.x || m.ext)) bad(`${p.id}=${v}: markerad som extrem i normalintervallet`);
      if (!inside && (!m.x || !m.ext)) bad(`${p.id}=${v}: utanför normalintervallet men inte markerad`);
    }
  }
}
// AI-partiernas program (programFromAxes) får aldrig välja ett x-alternativ, oavsett läge på axlarna
const leaks = new Set();
const poses = [...IDEOLOGIES.map((i) => i.pos), ...START_PARTIES.map((p) => p.pos)];
const r0 = makeRng(5);
for (let i = 0; i < 400; i++) poses.push(Object.fromEntries(Object.keys(IDEOLOGIES[0].pos).map((k) => [k, Math.round((r0() * 2 - 1) * 100)])));
for (const pos of poses) { const prog = programFromAxes(pos); for (const p of POLICIES) if (p.type === 'choice' && p.options.find((o) => o.id === prog[p.id])?.x) leaks.add(`${p.id}.${prog[p.id]}`); }
if (leaks.size) bad(`AI-program väljer ytterlighetsalternativ: ${[...leaks].join(', ')}`);
console.log(`Registret: ${POLICIES.length} områden · ${nx} ytterlighetsalternativ · ${nxs} reglage med ytterlighetsintervall · AI-läckor ${leaks.size}`);

// --- 2. simulering med tvingad lag ---
const SETS = {
  diktatur: { styrelseform: 'enpartistat', allmanna_val: 'avskaffade', oppositionspartier: 'forbud_all', press: 'propaganda', yttrandefrihet: 'censur', overvakning: 'kreditsystem', polis_inriktning: 'hemlig', fangelse: 'arbetslager', agande_industri: 'planekonomi', strejkratt: 'forbjuden', atervandring_antal: 300000, atervandring_form: 'tvingande_utlandska', granskontroll: 'mur', invandringsstopp: 'total' },
  anarki: { styrelseform: 'anarki', polis_inriktning: 'avskaffad', fangelse: 'avskaffade', granskontroll: 'inga_granser', utg_forsvar: 0, centralbank: 'ingen', skattesystem: 'ingen', varnplikt: 'avskaffad', strejkratt: 'bred' },
};
for (const [name, set] of Object.entries(SETS)) for (const [id, v] of Object.entries(set)) { const p = POLICY_BY_ID[id]; if (!p) bad(`${name}: okänt område ${id}`); else if (p.type === 'choice' ? !p.options.some((o) => o.id === v) : v < p.min || v > p.max) bad(`${name}: ogiltigt värde ${id}=${v}`); }

function run(set) {
  const rl = makeRng(SEED * 7);
  const leaderDef = { name: 'Test Testsson', first: 'Test', last: 'Testsson', gender: 'k', age: 44, look: randomLook(rl, 'k'), traits: randomTraits(rl), bg: { utbildning: 'Jurist', yrke: 'Advokat', hemstad: 'Umeå', familj: 'Medelklass' } };
  const partyDef = { name: 'Testpartiet', abbr: 'TP', color: '#888', color2: '#fff', logo: { shape: 'star', glyph: 'TP' }, slogan: 'Test', pos: { ...IDEOLOGIES.find((i) => i.id === 'centrism').pos }, profile: {}, ideology: { primary: 'centrism', secondary: [] } };
  const { state, rnd } = newGame({ seed: SEED * 101, mode: 'new', party: partyDef, leader: leaderDef });
  const start = snap(state);
  const force = () => { for (const [id, v] of Object.entries(set)) state.policy[id] = v; state.reforms = (state.reforms || []).filter((r) => !(r.policyId in set)); };
  force();
  let errors = 0;
  for (let w = 0; w < WEEKS; w++) {
    try {
      endWeek(state, rnd);
      while (state.queue.length) {
        const q = state.queue.shift();
        if (q.type === 'vote') { const item = state.riksdag.bills.find((b) => b.id === q.billItemId); resolveVote(state, rnd, item, 'avstår'); }
        else if (q.type === 'event') applyEventChoice(state, rnd, q.event, q.event.choices[0]?.i ?? 0);
        else if (q.type === 'scandal') { const sc = state.scandals.find((x) => x.id === q.scandalId); respondScandal(state, rnd, sc, 'erkann'); }
        else if (q.type === 'debate' || q.type === 'interview') { const d = buildDebate(state, rnd, { kind: q.type === 'interview' ? 'interview' : q.debate || 'tv' }); d.rounds.forEach((r, i) => resolveOption(state, rnd, d, i, 0)); finishDebate(state, rnd, d); }
        else if (q.type === 'election') { const el = state.election.pending; applyElection(state, el); state.election.pending = null; const g = formGovernmentAI(state, rnd); if (g) state.government = g; }
        else if (q.type === 'formation') { const g = formGovernmentAI(state, rnd, { round: q.round || 1 }); if (g) state.government = g; }
        else if (q.type === 'budget') aiBudget(state, rnd);
        else if (q.type === 'faction') applyFactionChoice(state, rnd, q, 0);
      }
      force(); // AI-regeringen försöker riva upp lagen – tvånget gäller hela körningen
    } catch (e) { errors++; console.error(`FEL vecka ${state.week}:`, e.stack); if (errors > 3) break; }
  }
  return { start, end: snap(state), state, errors };
}
function snap(state) {
  const s = state.sweden.stats, c = state.world.countries;
  return { ...s, rel_eu: c.eu.rel, rel_usa: c.usa.rel, rel_nato: c.nato.rel, rel_fn: c.fn.rel, rel_ryssland: c.ryssland.rel, isolering: state.sweden.isolering || 0 };
}
const ROWS = [['demokratiindex', 'Demokratiindex (0–10)', 2], ['pressfrihet', 'Pressfrihet', 0], ['yttrandefrihet', 'Yttrandefrihet', 0], ['rattssakerhet', 'Rättssäkerhet', 0], ['korruption', 'Korruptionsindex (högt = rent)', 0],
  ['bnp_tillvaxt', 'BNP-tillväxt %', 1], ['bnp_per_capita', 'BNP per capita tkr', 0], ['arbetsloshet', 'Arbetslöshet %', 1], ['inflation', 'Inflation %', 1], ['kronkurs_eur', 'Kronkurs EUR', 2], ['export', 'Export mdkr', 0], ['investeringar', 'Investeringar % BNP', 1], ['direktinvesteringar', 'Direktinvesteringar', 0], ['statsskuld_bnp', 'Skuld % BNP', 0],
  ['invandring', 'Invandring tusen/år', 0], ['utvandring', 'Utvandring tusen/år', 0], ['atervandring', 'Återvandring tusen/år', 0], ['asylsokande', 'Asylsökande tusen/år', 1], ['befolkning', 'Befolkning tusen', 0], ['andel_utrikes_fodda', 'Utrikes födda %', 1],
  ['protester', 'Protester', 0], ['polarisering', 'Polarisering', 0], ['extremism', 'Extremism', 0], ['trygghet', 'Trygghet', 0], ['gang_index', 'Gängindex', 0], ['skjutningar', 'Skjutningar/år', 0], ['fangar', 'Fångar', 0], ['poliser', 'Poliser', 0], ['soldater', 'Soldater', 0], ['lycka', 'Lycka (0–10)', 2], ['vardkoer', 'Vårdköer', 0], ['gini', 'Gini', 3], ['fattigdom', 'Fattigdom %', 1],
  ['rel_eu', 'Relation EU', 0], ['rel_usa', 'Relation USA', 0], ['rel_nato', 'Relation NATO', 0], ['rel_fn', 'Relation FN', 0], ['rel_ryssland', 'Relation Ryssland', 0], ['isolering', 'Isolering (0–1)', 2]];
const fmt = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : String(v));
const control = run({});
if (control.errors) bad(`kontrollkörningen gav ${control.errors} fel`);
for (const [name, set] of Object.entries(SETS)) {
  const res = run(set);
  console.log(`\n=== ${name.toUpperCase()} · ${WEEKS} veckor · frö ${SEED} ===`);
  console.log('                                    start   kontroll   tvingad');
  for (const [id, label, d] of ROWS) console.log(`  ${label.padEnd(32)} ${fmt(res.start[id], d).padStart(8)} ${fmt(control.end[id], d).padStart(10)} ${fmt(res.end[id], d).padStart(9)}`);
  if (res.errors) bad(`${name}: ${res.errors} körfel`);
  const nonFinite = Object.entries(res.end).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v)).map(([k]) => k);
  if (nonFinite.length) bad(`${name}: icke-numeriska värden: ${nonFinite.join(', ')}`);
  const e = res.end;
  if (!(e.befolkning > 5000)) bad(`${name}: befolkningen orimlig (${e.befolkning})`);
  if (!(e.demokratiindex >= 0 && e.demokratiindex <= 10)) bad(`${name}: demokratiindex utanför 0–10`);
  for (const k of ['protester', 'polarisering', 'trygghet', 'pressfrihet', 'yttrandefrihet', 'rattssakerhet', 'integration', 'sammanhallning']) if (!(e[k] > -3 && e[k] < 103)) bad(`${name}: ${k} utanför 0–100 (${fmt(e[k], 1)})`);
  for (const k of ['export', 'investeringar', 'poliser', 'soldater', 'varnpliktiga', 'hemvarn', 'fangar', 'atervandring', 'andel_utrikes_fodda']) if (!(e[k] >= 0)) bad(`${name}: ${k} negativ (${fmt(e[k], 1)})`);
  if (e.demokratiindex >= control.end.demokratiindex && name === 'diktatur') bad('diktatur: demokratiindex föll inte');
  console.log(`  Alla stats numeriska: ${nonFinite.length ? 'NEJ' : 'ja'}`);
}
console.log(fail ? `\n${fail} fel` : '\nInga fel.');
process.exit(fail ? 1 : 0);
