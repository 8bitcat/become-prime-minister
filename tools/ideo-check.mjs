// Kalibrering av ideologi ↔ partiprogram: för varje ideologi byggs ett program ur dess axlar
// (programFromAxes) och axlarna räknas tillbaka (axesFromProgram). Visar medelfelet mot I.pos,
// hur många som känns igen som sig själva (nearestIdeologies) och vilken etikett startpartierna får.
//   node tools/ideo-check.mjs [-v]
import { IDEOLOGIES } from '../js/data/ideologies.js';
import { ISSUES } from '../js/data/issues.js';
import { START_PARTIES } from '../js/data/parties.js';
import { POLICIES, DOMAINS } from '../js/data/policies.js';
import { axesFromProgram, programFromAxes, nearestIdeologies, ideologyDescription } from '../js/sim/policy.js';

const verbose = process.argv.includes('-v');
let errSum = 0, errN = 0, ok = 0; const miss = []; const axisErr = {};
for (const I of IDEOLOGIES) {
  const prog = programFromAxes(I.pos);
  const ax = axesFromProgram(prog);
  let e = 0;
  for (const is of ISSUES) { const d = Math.abs((ax[is.id] || 0) - (I.pos[is.id] || 0)); e += d; axisErr[is.id] = (axisErr[is.id] || 0) + d; }
  e /= ISSUES.length; errSum += e; errN++;
  const near = nearestIdeologies(prog);
  if (near[0].id === I.id) ok++; else miss.push(`${I.id}→${near[0].id}`);
  if (verbose) console.log(`${I.id.padEnd(22)} fel ${e.toFixed(1).padStart(5)}  närmast ${near[0].id}${near[0].id === I.id ? '' : '  ✗'}`);
}
console.log(`Politikområden: ${POLICIES.length} i ${Object.keys(DOMAINS).length} domäner`);
console.log(`Ideologier: ${errN} · medelfel ${(errSum / errN).toFixed(2)} · rätt igenkända ${ok}/${errN} · felklassade ${errN - ok}`);
console.log('Medelfel per axel: ' + ISSUES.map((is) => `${is.id} ${(axisErr[is.id] / errN).toFixed(1)}`).join(' · '));
if (miss.length) console.log('Felklassade: ' + miss.join(', '));
let pErr = 0;
for (const p of START_PARTIES) {
  const prog = programFromAxes(p.pos); const ax = axesFromProgram(prog);
  const e = ISSUES.reduce((a, is) => a + Math.abs((ax[is.id] || 0) - (p.pos[is.id] || 0)), 0) / ISSUES.length; pErr += e;
  const d = ideologyDescription(prog);
  console.log(`  ${p.abbr.padEnd(3)} fel ${e.toFixed(1).padStart(5)}  ${d.label}${verbose ? '  ' + ISSUES.map((is) => `${is.id.slice(0, 4)} ${p.pos[is.id]}→${ax[is.id]}`).join(' ') : ''}`);
}
console.log(`Startpartier: medelfel ${(pErr / START_PARTIES.length).toFixed(2)}`);
