// Omvärlden: länder och organisationer med relationer till Sverige, spänning i närområdet,
// handel. Månadsvis drift + kriser som matar in i Sveriges statistik.
import { gauss, clamp, pick } from '../core/util.js';
import { addNews } from './news.js';

export const COUNTRIES = [
  { id: 'usa', name: 'USA', flag: '🇺🇸', rel: 60, power: 100, trade: 8 },
  { id: 'tyskland', name: 'Tyskland', flag: '🇩🇪', rel: 75, power: 60, trade: 11 },
  { id: 'storbritannien', name: 'Storbritannien', flag: '🇬🇧', rel: 70, power: 55, trade: 6 },
  { id: 'frankrike', name: 'Frankrike', flag: '🇫🇷', rel: 65, power: 55, trade: 4 },
  { id: 'finland', name: 'Finland', flag: '🇫🇮', rel: 90, power: 20, trade: 7 },
  { id: 'norge', name: 'Norge', flag: '🇳🇴', rel: 92, power: 25, trade: 10 },
  { id: 'danmark', name: 'Danmark', flag: '🇩🇰', rel: 88, power: 20, trade: 7 },
  { id: 'polen', name: 'Polen', flag: '🇵🇱', rel: 60, power: 35, trade: 4 },
  { id: 'ukraina', name: 'Ukraina', flag: '🇺🇦', rel: 80, power: 25, trade: 1 },
  { id: 'ryssland', name: 'Ryssland', flag: '🇷🇺', rel: -70, power: 70, trade: 0 },
  { id: 'kina', name: 'Kina', flag: '🇨🇳', rel: 10, power: 95, trade: 5 },
  { id: 'indien', name: 'Indien', flag: '🇮🇳', rel: 40, power: 50, trade: 2 },
  { id: 'turkiet', name: 'Turkiet', flag: '🇹🇷', rel: 20, power: 35, trade: 1 },
  { id: 'eu', name: 'EU', flag: '🇪🇺', rel: 70, power: 90, trade: 55, org: true },
  { id: 'nato', name: 'NATO', flag: '🛡️', rel: 75, power: 100, trade: 0, org: true },
  { id: 'fn', name: 'FN', flag: '🇺🇳', rel: 70, power: 40, trade: 0, org: true },
];

export function initWorld(rnd) {
  const countries = {};
  for (const c of COUNTRIES) countries[c.id] = { rel: c.rel + Math.round(gauss(rnd, 0, 5)) };
  return { cycle: rnd(), shock: 0, energy: 1, tension: 0, migrationPressure: 1, countries, crises: [], log: [] };
}

export function stepWorld(state, rnd) {
  const w = state.world, s = state.sweden.stats;
  // relationer glider mot ett "naturligt" läge beroende på Sveriges politik
  const gov = state.government; const pos = gov.pmParty ? state.parties[gov.pmParty].pos : null;
  for (const c of COUNTRIES) {
    const R = w.countries[c.id];
    let natural = c.rel;
    if (pos) {
      if (c.id === 'eu') natural += pos.eu * .3;
      if (c.id === 'nato' || c.id === 'usa') natural += pos.forsvar * .2 - (s.forsvar_bnp < 2 ? 10 : 0);
      if (c.id === 'ryssland') natural -= pos.forsvar * .15 + pos.eu * .1;
      if (c.id === 'kina') natural -= pos.forsvar * .1;
      if (c.id === 'ukraina') natural += pos.forsvar * .15;
      if (c.id === 'fn') natural += (s.utg_bistand - 50) * .3;
      if (state.flags.authoritarian) natural -= (c.id === 'ryssland' ? -15 : 12) * state.flags.authoritarian;
    }
    R.rel = clamp(R.rel + (natural - R.rel) * .06 + gauss(rnd, 0, 1.2), -100, 100);
  }
  // spänning
  w.tension = clamp((w.tension || 0) * .93 + gauss(rnd, 0, 1.5) + (w.countries.ryssland.rel < -80 ? .8 : 0), -20, 40);
  w.migrationPressure = clamp((w.migrationPressure || 1) + (1 - (w.migrationPressure || 1)) * .05 + gauss(rnd, 0, .03), .5, 2.5);
  // omvärldshändelser (sällsynta, stora)
  if (rnd() < .035) {
    const ev = pick(rnd, [
      { h: 'Börskrasch på Wall Street', b: 'Marknaderna faller kraftigt efter en bolånekris i USA.', f: () => { w.shock -= 2.5; } },
      { h: 'Oljepriset rusar efter konflikt i Mellanöstern', b: 'Brent över 120 dollar fatet.', f: () => { w.energy = Math.max(w.energy, 1.6); } },
      { h: 'Ryssland trappar upp i Östersjön', b: 'Nya baser på Kaliningrad och kränkningar av luftrum.', f: () => { w.tension += 12; w.countries.ryssland.rel -= 10; } },
      { h: 'Flyktingvåg efter krig i Mellanöstern', b: 'EU:s yttre gräns under press, tusentals söker sig norrut.', f: () => { w.migrationPressure = Math.max(w.migrationPressure, 2.0); } },
      { h: 'Handelsavtal mellan EU och USA klart', b: 'Tullar slopas på industrivaror.', f: () => { w.shock += 1; s.export *= 1.02; } },
      { h: 'Kina bygger ut spionverksamhet i Norden', b: 'Säpo varnar för industrispionage.', f: () => { w.countries.kina.rel -= 15; } },
      { h: 'Fredsavtal i Ukraina', b: 'Efter år av krig undertecknas ett avtal i Genève.', f: () => { w.tension -= 10; w.shock += 1; w.energy = Math.min(w.energy, .9); } },
      { h: 'Global värmebölja – rekordtemperaturer', b: 'Skogsbränder i Sydeuropa, missväxt i Afrika.', f: () => { state.opinion.boost.klimat = (state.opinion.boost.klimat || 0) + .6; } },
      { h: 'AI-boom lyfter världsekonomin', b: 'Produktivitetsvinster driver börserna.', f: () => { w.shock += 1.5; s.produktivitet += .3; } },
      { h: 'Cyberattack slår ut europeiska banker', b: 'Spår leder till en statlig aktör.', f: () => { w.tension += 5; s.cyberforsvar -= 3; } },
    ]);
    ev.f();
    addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'svd', 'ekot']), headline: ev.h, body: ev.b, tags: ['varlden'], importance: 2 });
    w.log.unshift({ week: state.week, h: ev.h });
  }
}

export const relationLabel = (v) => v > 75 ? 'Nära allierad' : v > 45 ? 'Vänskaplig' : v > 15 ? 'Korrekt' : v > -20 ? 'Sval' : v > -60 ? 'Spänd' : 'Fientlig';
