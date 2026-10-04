// Sverige som levande simulering. Körs en gång per månad. Alla ekvationer är
// medvetet "mjuka": värden glider mot ett målvärde som beror på gällande lag (politiken),
// konjunktur och slump – så att reformer märks med fördröjning, som i verkligheten.
import { STATS, STAT_BY_ID, REGIONAL_STATS } from '../data/stats.js';
import { REGIONS } from '../data/regions.js';
import { clamp, gauss } from '../core/util.js';
import { policyEffects } from './policy.js';

export function initSweden(rnd) {
  const stats = {};
  for (const s of STATS) stats[s.id] = s.init;
  const regions = {};
  for (const r of REGIONS) {
    const urbanF = r.urban, lands = r.lands;
    regions[r.id] = {
      befolkning: r.pop,
      arbetsloshet: clamp(8.2 + lands * 1.2 - (urbanF - .75) * 2 + gauss(rnd, 0, .6), 3.5, 14),
      medianlon: Math.round(34500 * (1 + (urbanF - .75) * .35 + (r.id === 'AB' ? .08 : 0) + gauss(rnd, 0, .02))),
      bostadspriser: Math.round(100 * (1 + (urbanF - .75) * 1.6 + (r.id === 'AB' ? .5 : 0) + gauss(rnd, 0, .05))),
      brott: Math.round(135 * (1 + (urbanF - .75) * .8 + (['M', 'AB', 'O'].includes(r.id) ? .15 : 0) + gauss(rnd, 0, .06))),
      vardkoer: Math.round(95 * (1 + lands * .35 + gauss(rnd, 0, .1))),
      skolresultat: Math.round(490 + (urbanF - .75) * 25 - lands * 8 + gauss(rnd, 0, 5)),
      tillvaxt: 1.8 + (urbanF - .75) * 1.5 + gauss(rnd, 0, .4),
      trygghet: Math.round(60 + lands * 10 - (urbanF - .75) * 15 + gauss(rnd, 0, 4)),
      fortroende: Math.round(45 - Math.abs(r.lean) * 6 + gauss(rnd, 0, 4)),
    };
  }
  return { stats, hist: {}, regions, months: 0, year: {}, reforms: [], priceIndex: 1 };
}

// Regeringens samlade politiska läge per axel (mandatviktat snitt av regeringspartierna)
export function govPosition(state) {
  const gov = state.government;
  const ids = gov.parties?.length ? gov.parties : [];
  if (!ids.length) return null;
  const out = {}; let tot = 0;
  for (const id of ids) { const p = state.parties[id]; const w = state.riksdag.seats[id] || 1; tot += w; for (const k in p.pos) out[k] = (out[k] || 0) + p.pos[k] * w; }
  for (const k in out) out[k] /= tot;
  return out;
}

function pushHist(sw, id, v) {
  (sw.hist[id] ||= []).push(Math.round(v * 1000) / 1000);
  if (sw.hist[id].length > 360) sw.hist[id].shift();
}

// Huvudsteget. Returnerar lista med "anmärkningsvärda förändringar" (för nyheterna).
export function stepMonth(state, rnd) {
  const sw = state.sweden, s = sw.stats, w = state.world;
  const prev = { ...s };
  const fx = policyEffects(state); // politiken i kraft
  const f = (k) => fx[k] || 0;
  const notes = [];
  const n = (ms) => gauss(rnd, 0, ms);
  const glide = (id, target, rate, noise = 0) => { s[id] = s[id] + (target - s[id]) * rate + (noise ? n(noise) : 0); };
  sw.priceIndex ||= 1;

  // --- omvärlden: konjunkturcykel + chocker (energi, finans) ---
  w.cycle = (w.cycle + 1 / 84) % 1;
  const worldGrowth = 2.2 + 1.4 * Math.sin(w.cycle * Math.PI * 2) + (w.shock || 0);
  w.shock = (w.shock || 0) * 0.93;
  w.energy = clamp((w.energy || 1) + (1 - (w.energy || 1)) * .05 + n(.03), .6, 2.5);
  w.tension = clamp((w.tension || 0) + f('tension') * .08, -20, 50);
  const tension = s.sakerhetslage;

  // --- gällande lag → skatter och utgifter (budgetposter i fasta priser × prisindex) ---
  const demo = 1 + (s.andel_65plus - 20.6) * .02;
  for (const k in fx.set) {
    if (k.startsWith('utg_')) s[k] = fx.set[k] * sw.priceIndex * (['utg_sjukvard', 'utg_pensioner', 'utg_aldreomsorg'].includes(k) ? demo : 1);
    else s[k] = fx.set[k];
  }
  const skattekvot = 42 + (s.skatt_kommunal - 32.37) * .55 + (s.skatt_statlig - 20) * .12 + (s.skatt_bolag - 20.6) * .15 + (s.moms - 25) * .35 + (s.skatt_kapital - 30) * .05 + (s.arbetsgivaravgift - 31.42) * .4 + (s.skatt_koldioxid - 1330) / 1000 * .3 - (s.rutrot - 75) / 100 * .1;
  glide('skattekvot', skattekvot, .25);

  // --- tillväxt ---
  const ran = s.styrranta;
  const gTarget = worldGrowth * .65 + .6 - (s.skattekvot - 42) * .035 + (s.investeringar - 25) * .04 - (ran - 2.25) * .3 - (w.energy - 1) * 1.6 + (s.konsumentfortroende - 95) * .01 + (s.utg_infrastruktur / sw.priceIndex - 110) * .004 + (s.produktivitet - 1.2) * .5 - (s.gang_index - 70) * .004 - (tension - 65) * .006 + (s.skolresultat - 490) * .004 + (sw.reformBoost || 0) + f('growth');
  glide('bnp_tillvaxt', gTarget, .12, .15);
  sw.reformBoost = (sw.reformBoost || 0) * .9;
  const g = s.bnp_tillvaxt;
  s.bnp *= 1 + (g + s.inflation) / 100 / 12;
  glide('produktivitet', 1.2 + (s.utg_utbildning / sw.priceIndex - 420) * .002 + (s.digitalisering - 78) * .01 + (s.hogskoleutbildade - 45) * .01 + f('produktivitet'), .05, .05);
  glide('investeringar', 25 + (g - 1.5) * .6 - (ran - 2.25) * .8 + f('investeringar'), .06, .1);
  glide('konjunktur', 100 + (g - 1.8) * 6 - (s.inflation - 2) * 2, .15, 1.2);
  glide('konsumentfortroende', 95 + (g - 1.8) * 4 - (s.inflation - 2) * 3 - (s.arbetsloshet - 8.2) * 2 + (s.reallon) * 2 - (s.oro - 50) * .2, .15, 1.5);
  glide('borsindex', s.borsindex * (1 + (g - 1.5) * .003 + (worldGrowth - 2) * .002 - (ran - 2.25) * .003), .5, s.borsindex * .02);
  glide('export', s.export * (1 + (worldGrowth - 1) / 100 / 12 + (11.2 - s.kronkurs_eur) * .003) * (1 + f('export') / 12), .5, s.export * .004);
  glide('import', s.import * (1 + g / 100 / 12), .5, s.import * .004);
  glide('nystartade_foretag', 70 + (g - 1.8) * 3 + f('nystart'), .08, 1);
  glide('konkurser', 8 - (g - 1.8) * .8 + (ran - 2.25) * .5 + f('konkurser'), .1, .15);

  // --- inflation & Riksbanken ---
  const infTarget = 2 + (g - 1.5) * .35 + (w.energy - 1) * 3 + (s.kronkurs_eur - 11.2) * .4 - (ran - 2.25) * .45 + (s.budgetsaldo < -100 ? .3 : 0) + f('inflation');
  glide('inflation', infTarget, .12, .12);
  const rateTarget = clamp(2 + (s.inflation - 2) * 1.4 + (g - 1.5) * .25 + f('ranta'), 0, 9);
  s.styrranta = Math.round(clamp(s.styrranta + clamp((rateTarget - s.styrranta) * .15, -.25, .25), 0, 9) * 4) / 4;
  glide('kronkurs_eur', 11.2 - (ran - 2.25) * .25 + (tension - 65) * .01 - (g - 1.8) * .1 + (w.shock < -1 ? .4 : 0) + f('kronkurs'), .1, .05);
  s.kronkurs_usd = s.kronkurs_eur * .93 + n(.03);
  sw.priceIndex *= 1 + s.inflation / 100 / 12;

  // --- arbetsmarknad ---
  const uTarget = 7.6 - (g - 1.5) * .7 + (s.skattekvot - 42) * .05 + (s.asylsokande - 11.5) * .03 - (s.utg_utbildning / sw.priceIndex - 420) * .002 + (s.integration < 50 ? (50 - s.integration) * .03 : 0) + f('arbetsloshet');
  glide('arbetsloshet', uTarget, .09, .06);
  glide('ungdomsarbetsloshet', s.arbetsloshet * 2.6 + f('ungdomsarb'), .15, .3);
  glide('langtidsarbetsloshet', 170 + (s.arbetsloshet - 8.2) * 22 + f('langtid'), .08, 2);
  glide('sysselsattning', 77.2 - s.arbetsloshet + (s.forskoleplatser - 86) * .05 + f('sysselsattning'), .15, .05);
  const wageGrowth = (s.inflation + s.produktivitet + (s.fackanslutning - 68) * .01) / 100 / 12;
  s.medianlon *= 1 + wageGrowth; s.medellon *= 1 + wageGrowth * 1.05;
  glide('reallon', s.produktivitet + (s.fackanslutning - 68) * .01 - (s.inflation - 2) * .2, .1, .08);
  glide('lonegap', 9.5 - (s.jamstalldhet - 85) * .15 + f('lonegap'), .05, .03);
  glide('fackanslutning', 68 + f('fackanslutning'), .02, .1);
  glide('strejkdagar', 5 + (s.inflation > 4 ? 10 : 0) + f('strejk'), .1, .8);
  glide('arbetskraftsinvandring', (18 + (g - 1.8) * 1.5) * (fx.arbetskraftMult || 1), .08, .4);
  glide('sjukskrivning', 5 + (s.psykisk_ohalsa - 60) * .03 - (s.vardkvalitet - 72) * .01 + f('sjukskrivning'), .05, .03);

  // --- offentliga finanser ---
  s.utg_socialt *= 1 + (s.arbetsloshet - prev.arbetsloshet) * .01;
  s.utg_migration *= 1 + (s.asylsokande - prev.asylsokande) * .01;
  const utg = ['utg_sjukvard', 'utg_utbildning', 'utg_forsvar', 'utg_polis', 'utg_rattsvasende', 'utg_socialt', 'utg_pensioner', 'utg_aldreomsorg', 'utg_infrastruktur', 'utg_klimat', 'utg_kultur', 'utg_bistand', 'utg_migration', 'utg_ovrigt'].reduce((a, k) => a + s[k], 0) + (s.statsskuld * (s.styrranta + .6)) / 100 * .5 + f('utg') * sw.priceIndex;
  const ink = s.bnp * (s.skattekvot + 7) / 100 * (1 - (s.arbetsloshet - 8.2) * .01);
  s.statens_inkomster = ink; s.statens_utgifter = utg; s.budgetsaldo = ink - utg;
  s.statsskuld = Math.max(0, s.statsskuld - s.budgetsaldo / 12);
  glide('hushallsskuld', 185 + (s.bostadspriser - 100) * .3 - (ran - 2.25) * 4 + f('hushallsskuld'), .05, .5);

  // --- fördelning ---
  glide('gini', .31 + (s.skattekvot < 42 ? (42 - s.skattekvot) * .003 : -(s.skattekvot - 42) * .002) - (s.utg_socialt / sw.priceIndex - 700) * .00008 + (s.arbetsloshet - 8.2) * .002 + f('gini'), .04, .0005);
  glide('fattigdom', 14 + (s.gini - .31) * 60 + (s.arbetsloshet - 8.2) * .4 - (s.utg_socialt / sw.priceIndex - 700) * .006 + f('fattigdom'), .06, .05);
  glide('barnfattigdom', s.fattigdom * .62 + f('barnfattigdom'), .08, .05);
  glide('hemloshet', 33 + (s.fattigdom - 14) * 1.5 + (s.bostadsbrist - 200) * .05 + f('hemloshet'), .04, .2);

  // --- befolkning ---
  glide('fruktsamhet', 1.45 + (s.konsumentfortroende - 95) * .003 + (s.forskoleplatser - 86) * .004 - (s.boendekostnad - 24) * .01 + f('fruktsamhet'), .03, .005);
  glide('fodelsetal', 10.2 * s.fruktsamhet / 1.45, .1, .05);
  glide('dodstal', 8.9 + (s.andel_65plus - 20.6) * .25 - (s.vardkvalitet - 72) * .02, .05, .03);
  glide('asylsokande', clamp(11.5 * (fx.asylMult || 1) * (1 + (tension - 65) * .02) * (w.migrationPressure || 1), 0, 200), .12, .3);
  glide('invandring', 40 + s.asylsokande * 1.2 + s.arbetskraftsinvandring * 1.5 + (g - 1.8) * 3 + f('invandring'), .1, 1);
  glide('utvandring', 62 - (g - 1.8) * 2 + (s.oro - 50) * .2 + f('utvandring'), .05, 1);
  s.befolkning += ((s.fodelsetal - s.dodstal) / 1000 * s.befolkning + (s.invandring - s.utvandring)) / 12;
  glide('andel_utrikes_fodda', s.andel_utrikes_fodda + ((s.invandring - s.utvandring) / 12) / s.befolkning * 100 * .8, 1);
  glide('andel_65plus', s.andel_65plus + .012 - (s.fodelsetal - 10.2) * .002, 1);
  glide('medianalder', 41.3 + (s.andel_65plus - 20.6) * .5, .05);
  glide('medellivslangd', 83.4 + (s.vardkvalitet - 72) * .03 - (s.fattigdom - 14) * .02 + (sw.months / 12) * .08 + f('medellivslangd'), .03, .01);
  glide('urbanisering', 88 + .01 + f('urban'), .05);

  // --- välfärd ---
  const vardReal = s.utg_sjukvard / sw.priceIndex / demo;
  glide('vardkoer', 95 * Math.pow(560 / Math.max(300, vardReal), 1.3) + (s.lakare < 4.3 ? 20 : 0) - (s.digitalisering - 78) * .5 + f('vardkoer'), .06, 1.5);
  glide('vardkvalitet', 72 + (vardReal - 560) * .04 + (s.sjukskoterskor - 10.9) * 2 - (s.vardkoer - 95) * .05 + f('vardkvalitet'), .05, .4);
  glide('vardplatser', 2 + (vardReal - 560) * .002, .04, .01);
  glide('lakare', 4.3 + (vardReal - 560) * .002 + (s.hogskoleutbildade - 45) * .01, .03, .01);
  glide('sjukskoterskor', 10.9 + (vardReal - 560) * .006 + (s.medianlon / (34500 * sw.priceIndex) - 1) * 2 + f('sjukskoterskor'), .03, .02);
  glide('psykisk_ohalsa', 60 + (s.arbetsloshet - 8.2) * 1.5 + (s.oro - 50) * .3 - (vardReal - 560) * .03 + (s.ungdomsarbetsloshet - 22) * .3 + f('psykisk'), .04, .4);
  const utbReal = s.utg_utbildning / sw.priceIndex;
  glide('larartathet', 12 - (utbReal - 420) * .01 + f('larartathet'), .04, .03);
  glide('behoriga_larare', 70 + (utbReal - 420) * .05 + f('behoriga'), .03, .2);
  glide('skolresultat', 490 + (utbReal - 420) * .12 + (s.behoriga_larare - 70) * .6 - (s.larartathet - 12) * 3 - (s.integration < 55 ? (55 - s.integration) * .4 : 0) + (s.friskoleandel - 17) * -.1 + f('skola'), .025, .5);
  glide('gymnasiebehorighet', 85 + (s.skolresultat - 490) * .15, .05, .1);
  glide('hogskoleutbildade', 45 + (s.skolresultat - 490) * .05 + .03 * (sw.months / 12) + f('hogskola'), .03, .03);
  glide('friskoleandel', 17 + f('friskole'), .02, .05);
  glide('forskoleplatser', 86 + (utbReal - 420) * .02, .03, .05);
  glide('aldreomsorg_kvalitet', 68 + (s.utg_aldreomsorg / sw.priceIndex / demo - 180) * .3 + (s.sjukskoterskor - 10.9) * 2 + f('aldre'), .05, .4);
  glide('pensionsniva', 55 + (s.utg_pensioner / sw.priceIndex / demo - 480) * .05 + f('pensionsniva'), .05, .1);

  // --- brott ---
  const polReal = s.utg_polis / sw.priceIndex;
  glide('poliser', 23000 + (polReal - 50) * 700, .04, 60);
  const gangTarget = 70 + (s.arbetsloshet - 8.2) * 2 + (s.gini - .31) * 120 + (s.ungdomsarbetsloshet - 22) * .5 - (s.poliser - 23000) / 400 - (s.integration - 55) * .4 - (s.uppklarning - 15) * .8 - (s.utg_socialt / sw.priceIndex - 700) * .01 - (s.skolresultat - 490) * .15 + f('gang') + f('aterfall') * 2;
  glide('gang_index', gangTarget, .04, 1);
  glide('skjutningar', 320 * s.gang_index / 70, .1, 12);
  glide('dodligt_vald', 110 * Math.pow(s.gang_index / 70, 1.2), .1, 5);
  glide('sprangningar', 90 * Math.pow(s.gang_index / 70, 1.5), .1, 6);
  glide('valdsbrott', 95 * (.7 + .3 * s.gang_index / 70) + f('valdsbrott'), .08, 1.5);
  glide('anmalda_brott', 1500 + (s.gang_index - 70) * 4 + (s.arbetsloshet - 8.2) * 15 - (s.poliser - 23000) / 100, .08, 12);
  glide('bedragerier', 250 + .3 * (sw.months) - (s.digitalisering - 78) * 2 - (s.poliser - 23000) / 200, .08, 5);
  glide('narkotikadodsfall', 600 + (s.gang_index - 70) * 3 + (s.psykisk_ohalsa - 60) * 4 + f('narko'), .06, 12);
  glide('uppklarning', 15 + (s.poliser - 23000) / 800 + (s.digitalisering - 78) * .05 + (s.utg_rattsvasende / sw.priceIndex - 60) * .05 + f('uppklarning'), .05, .15);
  glide('straffniva', 14 + f('straff'), .05, .1);
  glide('fangar', 8400 * (s.straffniva / 14) * (1 + (s.uppklarning - 15) * .03) + f('fangar'), .06, 50);
  glide('fangelseplatser', 8000 + (s.utg_rattsvasende / sw.priceIndex - 60) * 60, .03, 10);
  glide('handlaggningstid', 7 + (s.fangar - s.fangelseplatser) / 2000 + (s.anmalda_brott - 1500) / 300 - (s.utg_rattsvasende / sw.priceIndex - 60) * .03 + f('handlaggning'), .05, .1);
  glide('trygghet', 100 - s.gang_index * .5 - (s.skjutningar - 320) * .03 + (s.poliser - 23000) / 1000 - (s.oro - 50) * .2 + f('trygghet'), .07, .8);

  // --- klimat & energi ---
  const klimReal = s.utg_klimat / sw.priceIndex;
  const redAnnual = 2.2 + (klimReal - 30) * .05 + (s.elbilar - 60) * .02 + f('utslappRed');
  s.utslapp *= 1 - clamp(redAnnual, -4, 10) / 100 / 12;
  glide('elbilar', 60 + (s.elpris < 100 ? 3 : -3) + sw.months * .08 + f('elbilar'), .05, .5);
  glide('elanvandning', 140 + (g - 1.5) * 2 + (s.elbilar - 60) * .15 + (sw.months / 12) * 2.5, .05, .4);
  const nucT = fx.nuclearTarget ?? 48;
  glide('el_karnkraft', nucT, nucT > s.el_karnkraft ? .008 : .015, .1);
  glide('el_vind', s.el_vind + .35 + f('vind') / 12, .5, .3);
  glide('el_sol', s.el_sol + .12 + f('sol') / 12, .5, .05);
  glide('el_vatten', 70, .05, .8);
  const elBalance = s.el_vatten + s.el_karnkraft + s.el_vind + s.el_sol + s.el_ovrigt - s.elanvandning;
  glide('elpris', 85 * (w.energy) - elBalance * 1.2 + (s.skatt_koldioxid - 1330) * .01 + f('elpris'), .15, 2.5);
  glide('bensinpris', 17.5 * (.6 + .4 * w.energy) + (s.skatt_bensin - 6.9) + (s.kronkurs_usd - 10.4) * .4 + f('bensin') * .3, .2, .1);
  glide('luftkvalitet', 80 + (45 - s.utslapp) * .3 + (s.elbilar - 60) * .05 + f('luft'), .04, .3);
  glide('skyddad_natur', 15 + (klimReal - 30) * .02 + f('natur'), .02, .01);
  glide('skogsavverkning', 90 + f('avverkning'), .03, .5);
  glide('klimatanpassning', 50 + (klimReal - 30) * .3 + (s.utg_infrastruktur / sw.priceIndex - 110) * .1 + f('klimatanp'), .03, .3);

  // --- försvar ---
  const forsReal = s.utg_forsvar / sw.priceIndex;
  glide('soldater', 25000 + (forsReal - 130) * 90 + f('soldater'), .02, 40);
  glide('varnpliktiga', 8000 + (forsReal - 130) * 60 + f('varnpliktiga'), .03, 30);
  glide('hemvarn', 22000 + (forsReal - 130) * 40, .02, 30);
  glide('stridsflyg', 95 + (forsReal - 130) * .15, .01, 0);
  glide('militar_styrka', 62 + (forsReal - 130) * .18 + (s.soldater - 25000) / 500 + f('militar'), .025, .3);
  glide('beredskap', 55 + (forsReal - 130) * .1 + (s.klimatanpassning - 50) * .2 + (s.civilsamhalle - 70) * .1 + f('beredskap'), .03, .3);
  glide('cyberforsvar', 60 + (forsReal - 130) * .08 + (s.digitalisering - 78) * .3 + f('cyber'), .03, .3);
  glide('sakerhetslage', 65 + (w.tension || 0) + f('sakerhet'), .05, 1);
  glide('terrorhot', clamp(Math.round(4 + (s.extremism - 20) / 15 + f('terror')), 1, 5), .2);

  // --- bostäder & infrastruktur ---
  const priceG = 3 + (g - 1.5) * .6 - (ran - 2.25) * 2.2 + (s.invandring - 85) * .02 - (s.byggstarter - 35) * .08 + f('prisG');
  glide('bostadspris_tillvaxt', priceG, .15, .3);
  s.bostadspriser *= 1 + s.bostadspris_tillvaxt / 100 / 12;
  glide('byggstarter', 35 + (s.bostadspris_tillvaxt - 3) * 1.5 - (ran - 2.25) * 4 + (s.utg_infrastruktur / sw.priceIndex - 110) * .05 + f('bygg'), .06, .6);
  glide('bostadsbrist', 200 - (s.byggstarter - 35) * 2 + (s.invandring - 85) * .5, .04, 1.5);
  glide('hyra', (8500 + f('hyra')) * sw.priceIndex, .08, 20);
  glide('boendekostnad', 24 + (s.bolanranta - 3.6) * 1.5 + (s.hyra / (8500 * sw.priceIndex) - 1) * 10 - (s.medianlon / (34500 * sw.priceIndex) - 1) * 10, .1, .1);
  glide('bostadsko', 9 + (s.bostadsbrist - 200) * .02 + f('bostadsko'), .04, .05);
  const infReal = s.utg_infrastruktur / sw.priceIndex;
  glide('tagpunktlighet', 90 + (infReal - 110) * .05 + f('tag'), .05, .4);
  glide('vagstandard', 65 + (infReal - 110) * .15 + f('vag'), .03, .3);
  glide('bredband', 95 + (infReal - 110) * .01 + .02, .05, .02);
  glide('kollektivtrafik', 70 + (infReal - 110) * .1 + f('kollektiv'), .03, .3);
  glide('digitalisering', 78 + (sw.months / 12) * 1.2 + f('digital'), .03, .2);

  // --- samhälle ---
  const scandalLoad = (state.scandals || []).filter((x) => x.active).reduce((a, x) => a + x.severity, 0);
  glide('fortroende_regering', 42 + (state.government.approval - 45) * .6 - scandalLoad * .3, .15, .8);
  glide('fortroende_riksdag', 48 - (s.polarisering - 45) * .3 - scandalLoad * .15 + (state.riksdag.passedRecently || 0) * .5 + f('fortroendeRiksdag'), .08, .6);
  glide('fortroende_polis', 66 + (s.trygghet - 60) * .4 - (s.gang_index - 70) * .2 + f('fortroendePolis'), .06, .5);
  glide('fortroende_medier', 52 - (s.polarisering - 45) * .3 + f('fortroendeMedier'), .04, .4);
  glide('korruption', 83 - scandalLoad * .2 + (s.rattssakerhet - 88) * .3 + f('korruption'), .05, .3);
  glide('polarisering', 45 + (state.opinion.polarization || 0) + (s.gini - .31) * 40 + (s.oro - 50) * .2 + f('polarisering'), .06, .6);
  glide('extremism', 20 + (s.polarisering - 45) * .4 + (s.ungdomsarbetsloshet - 22) * .3 - (s.integration - 55) * .2 + f('extremism'), .05, .5);
  glide('protester', 10 + (s.polarisering - 45) * .3 + Math.max(0, s.inflation - 4) * 3 + (sw.protestBoost || 0) + f('protester'), .15, 1);
  sw.protestBoost = (sw.protestBoost || 0) * .8;
  glide('oro', 50 + (s.inflation - 2) * 3 + (s.arbetsloshet - 8.2) * 2 + (s.skjutningar - 320) * .05 + (tension - 65) * .3 - (s.konsumentfortroende - 95) * .2 + f('oro') + f('landsbygdOro') * .3, .1, .8);
  glide('integration', 55 - (s.asylsokande - 11.5) * .15 + (s.sysselsattning - 69) * .5 + (s.skolresultat - 490) * .1 + f('integration'), .03, .3);
  glide('jamstalldhet', 85 + (s.forskoleplatser - 86) * .1 + f('jamstalldhet'), .03, .2);
  glide('sammanhallning', 62 - (s.polarisering - 45) * .4 + (s.integration - 55) * .2 - (s.gini - .31) * 50 + (s.civilsamhalle - 70) * .1 + f('sammanhallning'), .04, .4);
  glide('civilsamhalle', 70 + (s.utg_kultur / sw.priceIndex - 25) * .3 - (s.arbetsloshet - 8.2) * .5, .03, .3);
  glide('rattssakerhet', 88 + f('rattssakerhet') + (sw.rattssakerhetMal != null ? sw.rattssakerhetMal - 88 : 0), .04, .2);
  glide('yttrandefrihet', 92 + f('yttrande') + (sw.yttrandefrihetMal != null ? sw.yttrandefrihetMal - 92 : 0), .04, .2);
  glide('pressfrihet', 90 + f('press') - (s.polarisering - 45) * .1 + (sw.pressfrihetMal != null ? sw.pressfrihetMal - 90 : 0), .04, .2);
  glide('demokratiindex', 9.3 + f('demokrati') + (sw.demokratiMal != null ? sw.demokratiMal - 9.3 : 0) - (s.korruption < 75 ? .2 : 0) - (s.pressfrihet < 80 ? .3 : 0) - (s.rattssakerhet < 80 ? .3 : 0) - (s.extremism > 35 ? .2 : 0), .04, .01);
  glide('hdi', .952 + (s.medellivslangd - 83.4) * .004 + (s.hogskoleutbildade - 45) * .0006 + (s.bnp / sw.priceIndex / s.befolkning * 1000 / 601 - 1) * .02, .04, .0003);
  glide('lycka', 7.3 + (s.konsumentfortroende - 95) * .01 - (s.arbetsloshet - 8.2) * .05 + (s.trygghet - 60) * .01 + (s.vardkvalitet - 72) * .01 - (s.oro - 50) * .01 + (s.sammanhallning - 62) * .008 + f('lycka'), .06, .02);
  glide('integritet', 75 + f('integritet'), .05, .3);

  // --- regioner ---
  for (const r of REGIONS) {
    const R = sw.regions[r.id];
    const lands = r.lands;
    glide2(R, 'arbetsloshet', s.arbetsloshet + lands * 1.2 - (r.urban - .75) * 2 - f('regional') * lands * .1, .15, .08, rnd);
    glide2(R, 'tillvaxt', g + (r.urban - .75) * 1.2 + f('regional') * lands * .15, .15, .25, rnd);
    R.medianlon *= 1 + wageGrowth + (R.tillvaxt - g) * .0003;
    R.bostadspriser *= 1 + (s.bostadspris_tillvaxt + (r.urban - .75) * 2) / 100 / 12;
    glide2(R, 'brott', 135 * (s.anmalda_brott / 1500) * (1 + (r.urban - .75) * .8) * (1 + (s.gang_index - 70) / 200 * (r.urban > .85 ? 1.5 : .5)), .1, 1.5, rnd);
    glide2(R, 'vardkoer', s.vardkoer * (1 + lands * .35), .1, 2, rnd);
    glide2(R, 'skolresultat', s.skolresultat + (r.urban - .75) * 25 - lands * 8, .05, .8, rnd);
    glide2(R, 'trygghet', s.trygghet + lands * 10 - (r.urban - .75) * 15, .1, 1, rnd);
    glide2(R, 'fortroende', s.fortroende_riksdag - 3 - Math.abs(r.lean) * 6 + f('regional') * lands * .5, .1, 1, rnd);
    R.befolkning = s.befolkning * (r.pop / 10650) * (1 + (R.tillvaxt - g) * .002 * sw.months / 12);
  }

  // --- härledda & historik ---
  for (const st of STATS) if (st.derived) s[st.id] = st.derived(s);
  for (const st of STATS) pushHist(sw, st.id, s[st.id]);
  sw.months++;

  const chk = (id, thr, upText, downText) => { const d = s[id] - prev[id]; if (Math.abs(d) >= thr) notes.push({ id, d, text: d > 0 ? upText : downText }); };
  chk('arbetsloshet', .25, 'Arbetslösheten stiger', 'Arbetslösheten sjunker');
  chk('inflation', .35, 'Inflationen tar fart', 'Inflationen faller');
  chk('styrranta', .25, 'Riksbanken höjer räntan', 'Riksbanken sänker räntan');
  chk('skjutningar', 20, 'Skjutningarna ökar kraftigt', 'Färre skjutningar');
  chk('elpris', 18, 'Elpriset rusar', 'Elpriset faller');
  chk('bostadspris_tillvaxt', 1.5, 'Bostadspriserna tar fart', 'Bostadspriserna faller');
  chk('vardkoer', 8, 'Vårdköerna växer', 'Vårdköerna kortas');
  chk('bnp_tillvaxt', .5, 'Ekonomin växlar upp', 'Ekonomin bromsar in');
  chk('asylsokande', 3, 'Fler söker asyl i Sverige', 'Asylsökandet minskar');
  return notes;
}

function glide2(R, id, target, rate, noise, rnd) { R[id] = R[id] + (target - R[id]) * rate + (noise ? gauss(rnd, 0, noise) : 0); }

export function economyMood(state) { const s = state.sweden.stats; return clamp((s.bnp_tillvaxt - 1.5) * .25 - (s.arbetsloshet - 8.2) * .2 - Math.abs(s.inflation - 2) * .2 + (s.reallon) * .2 + (s.konsumentfortroende - 95) * .02, -1.5, 1.5); }
export function securityMood(state) { const s = state.sweden.stats; return clamp(-(s.gang_index - 70) * .03 - (s.skjutningar - 320) * .003 + (s.trygghet - 60) * .02, -1.5, 1.5); }
export function welfareMood(state) { const s = state.sweden.stats; return clamp(-(s.vardkoer - 95) * .01 + (s.vardkvalitet - 72) * .03 + (s.skolresultat - 490) * .02, -1.5, 1.5); }

export const statFmt = (id, v) => { const st = STAT_BY_ID[id]; if (!st) return String(v); return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: st.d, minimumFractionDigits: st.d }).format(v) + ' ' + st.unit; };
export const regStatDef = (id) => REGIONAL_STATS.find((r) => r.id === id);
