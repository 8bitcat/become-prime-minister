// Personligheten formas av beteendet: skriver du ofta aggressivt stiger aggressiviteten, är du dryg
// sjunker karisman, är du personlig och varm växer den sociala förmågan. Månadsvis, inom ±18 från
// egenskaperna du skapades med. Medierna skriver när förändringen blir tydlig.
import { clamp, pick } from '../core/util.js';
import { addNews } from './news.js';

const NAMES = { karisma: 'karisma', retorik: 'retorik', intelligens: 'intelligens', lugn: 'lugn', aggressivitet: 'aggressivitet', integritet: 'integritet', stresstalighet: 'stresstålighet', social: 'social förmåga', ledarskap: 'ledarskap', erfarenhet: 'erfarenhet' };
export function driftTraits(state, rnd) {
  const p = state.parties[state.player.partyId]; const l = state.people[p.leader];
  const P = state.memory?.persona; if (!P || P.n < 4) return null;
  l.baseTraits ||= { ...l.traits }; l.drift ||= {};
  const d = {}; const add = (k, v) => { d[k] = (d[k] || 0) + v; };
  const dryg = P.dryg || 0;
  if (P.aggressiv > .22) { add('aggressivitet', P.aggressiv * 2.4); add('lugn', -P.aggressiv * 1.2); }
  if (dryg > .12) { add('karisma', -dryg * 3.2); add('social', -dryg * 1.6); }
  if (P.kansla > .22) { add('karisma', P.kansla * 1.3); add('social', P.kansla * 1.1); }
  if (P.saklig > .4) { add('intelligens', (P.saklig - .3) * 1.3); add('retorik', (P.saklig - .3) * .9); }
  if (P.humor > .18) add('karisma', P.humor * 1.1);
  if (P.undvikande > .22) { add('retorik', -P.undvikande * 1.3); add('integritet', -P.undvikande * .9); }
  if (P.kampande > .28) { add('retorik', P.kampande * .9); add('karisma', P.kampande * .6); }
  if (P.aggressiv < .1 && dryg < .05 && P.n > 10) add('lugn', .2);
  const changed = [];
  for (const k in d) {
    const cur = l.traits[k] ?? 45; const base = l.baseTraits[k] ?? cur;
    const next = clamp(cur + d[k], Math.max(5, base - 18), Math.min(95, base + 18));
    if (Math.abs(next - cur) < .05) continue;
    l.traits[k] = Math.round(next * 10) / 10; l.drift[k] = Math.round(((l.drift[k] || 0) + (next - cur)) * 10) / 10;
    changed.push(`${NAMES[k] || k} ${next - cur > 0 ? '+' : ''}${(next - cur).toFixed(1)}`);
  }
  // rubriker när mönstret blivit tydligt
  state.flags.drift ||= {};
  const F = state.flags.drift;
  if ((l.drift.aggressivitet || 0) >= 6 && !F.aggr) { F.aggr = true; addNews(state, { outlet: pick(rnd, ['dn', 'svd', 'expressen']), headline: `${l.name} har blivit allt mer aggressiv – "en annan politiker än för ett år sedan"`, body: `Kommentatorer noterar en hårdare ton i allt ${l.first} skriver och säger. "Det syns i debatterna, i inläggen, överallt." Anhängarna älskar det. Mitten tvekar.`, tags: ['parti'], partyId: p.id, importance: 2, tone: -1 }); }
  if ((l.drift.karisma || 0) <= -6 && !F.dryg) { F.dryg = true; addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen']), headline: `Väljarna om ${l.name}: "Dryg"`, body: `I fokusgrupper återkommer samma ord om partiledaren: nedlåtande, överlägsen, dryg. "Man känner sig dum när hen pratar", säger en väljare. Karisman har tagit stryk.`, tags: ['parti'], partyId: p.id, importance: 2, tone: -1 }); }
  if ((l.drift.karisma || 0) >= 6 && !F.charm) { F.charm = true; addNews(state, { outlet: pick(rnd, ['svt', 'dn']), headline: `${l.name} har vuxit in i rollen – "varmare och tydligare"`, body: `Väljare beskriver partiledaren som mer personlig och närvarande än tidigare. Det märks i mätningarna av ledarförtroendet.`, tags: ['parti'], partyId: p.id, importance: 1, tone: 1 }); }
  if ((l.drift.retorik || 0) <= -5 && !F.undvik) { F.undvik = true; addNews(state, { outlet: 'svd', headline: `${l.name} svarar allt mer sällan på frågor`, body: `Ett mönster: undvikande svar, "vi återkommer", "det är komplicerat". Retoriken har blivit slöare, menar bedömare.`, tags: ['parti'], partyId: p.id, importance: 1, tone: -1 }); }
  for (const k of Object.keys(F)) { if (k === 'aggr' && (l.drift.aggressivitet || 0) < 3) delete F[k]; if (k === 'dryg' && (l.drift.karisma || 0) > -3) delete F[k]; }
  return changed.length ? `🧠 Ditt sätt att uttrycka dig formar dig: ${changed.join(', ')}.` : null;
}
export const driftSummary = (l) => Object.entries(l.drift || {}).filter(([, v]) => Math.abs(v) >= .5).map(([k, v]) => `${NAMES[k] || k} ${v > 0 ? '+' : ''}${v.toFixed(1)}`).join(', ');
