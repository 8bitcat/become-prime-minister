// Journalister och influerare som individer med relationer, bevakningsområden och minne.
import { JOURNALISTS, MEDIA } from '../data/names.js';
import { ISSUES } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { pick, clamp, gauss, fmt } from '../core/util.js';
import { makePerson } from './people.js';
import { addNews } from './news.js';
import { activeParties } from './opinion.js';

const BEATS = ['ekonomi', 'kriminal', 'forsvar', 'valfard', 'migration', 'klimat', 'politik', 'politik', 'politik', 'eu'];
export function initJournalists(rnd) {
  const out = {};
  JOURNALISTS.forEach((j, i) => {
    const gender = /a$|e$|n$/.test(j.name.split(' ')[0]) && !['Johan', 'Jakob', 'Oskar', 'Peter', 'Fredrik'].includes(j.name.split(' ')[0]) ? 'k' : 'm';
    const p = makePerson(rnd, { gender, age: 32 + Math.floor(rnd() * 28), role: 'journalist' });
    p.name = j.name; p.first = j.name.split(' ')[0]; p.last = j.name.split(' ')[1];
    p.persona.profession = 'journalist'; p.bg.yrke = 'Journalist';
    p.look.outfit = pick(rnd, ['kostym_gra', 'blazer_bla', 'drakt_svart', 'polo', 'kavaj_tshirt', 'skjorta']);
    out[p.id] = { id: p.id, name: j.name, outlet: j.outlet, style: j.style, beat: BEATS[i % BEATS.length], rel: Math.round(gauss(rnd, 0, 12)), memory: [], person: p, interviews: 0 };
  });
  return out;
}
export const INFLUENCER_SEED = [
  { name: 'Podden Makten', handle: '@makten', platform: 'podd', segs: ['storstad_akademiker', 'storstad_unga'], lean: { ekonomi: 10, varderingar: -40 }, followers: 180000 },
  { name: 'Lisa Lindé', handle: '@lisalinde', platform: 'tiktok', segs: ['storstad_unga', 'studenter'], lean: { klimat: -70, varderingar: -80 }, followers: 650000 },
  { name: 'Grabbarna i garaget', handle: '@garaget', platform: 'youtube', segs: ['industri', 'landsbygd', 'laginkomst'], lean: { migration: 60, landsbygd: 70, energi: 60 }, followers: 420000 },
  { name: 'Ekonomi-Erik', handle: '@ekonomierik', platform: 'youtube', segs: ['foretagare', 'hoginkomst', 'storstad_akademiker'], lean: { ekonomi: 70, arbete: 60 }, followers: 300000 },
  { name: 'Mormors kök', handle: '@mormorskok', platform: 'facebook', segs: ['pensionarer', 'landsbygd'], lean: { valfard: -30, kriminal: 50 }, followers: 520000 },
  { name: 'Samhällsbyggarna', handle: '@samhallsbyggarna', platform: 'podd', segs: ['offentlig', 'forort_familjer'], lean: { valfard: -60, ekonomi: -40 }, followers: 90000 },
  { name: 'Frihetsfronten', handle: '@frihetsfronten', platform: 'x', segs: ['foretagare', 'storstad_unga'], lean: { ekonomi: 90, eu: -40, varderingar: -30 }, followers: 140000 },
  { name: 'Nour & Amir', handle: '@nouramir', platform: 'instagram', segs: ['utrikes_fodda', 'storstad_unga', 'forort_familjer'], lean: { migration: -60, kriminal: 10 }, followers: 380000 },
  { name: 'Skogsmulle 2.0', handle: '@skogsmulle', platform: 'instagram', segs: ['miljo', 'studenter'], lean: { klimat: -95, energi: -70 }, followers: 210000 },
  { name: 'Kapten Trygg', handle: '@kaptentrygg', platform: 'x', segs: ['pensionarer', 'kristna', 'forort_familjer'], lean: { forsvar: 80, kriminal: 80, varderingar: 60 }, followers: 160000 },
];
export function initInfluencers(rnd) {
  const out = {};
  for (const s of INFLUENCER_SEED) { const id = 'inf' + Math.floor(rnd() * 1e6).toString(36); out[id] = { id, ...s, stance: 0, lastWeek: -99 }; }
  return out;
}

// Hur en influerare ser på ett parti: ideologiskt avstånd på deras frågor
function affinity(inf, party) { let d = 0, n = 0; for (const k in inf.lean) { d += Math.abs(inf.lean[k] - (party.pos[k] || 0)); n++; } return n ? clamp(60 - (d / n) * .9, -60, 60) : 0; }

// Välj journalist för en intervju – bevakningsområde och relation styr
export function pickJournalist(state, rnd, issue) {
  const list = Object.values(state.journalists || {});
  if (!list.length) return null;
  const beatFor = { ekonomi: 'ekonomi', arbete: 'ekonomi', bostad: 'ekonomi', kriminal: 'kriminal', forsvar: 'forsvar', eu: 'eu', valfard: 'valfard', migration: 'migration', klimat: 'klimat', energi: 'klimat' }[issue] || 'politik';
  const weights = list.map((j) => (j.beat === beatFor ? 3 : j.beat === 'politik' ? 1.5 : .5) * (1 + j.interviews * .1));
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
export function adjustJournalist(state, id, delta, memo = null) { const j = state.journalists?.[id]; if (!j) return; j.rel = clamp(j.rel + delta, -100, 100); if (memo) { j.memory.unshift({ week: state.week, memo }); if (j.memory.length > 12) j.memory.pop(); } }

// Varje vecka: influerare kommenterar, bjuder in, vänder sig emot
export function weeklyMedia(state, rnd) {
  const out = [];
  const me = state.parties[state.player.partyId]; const lead = state.people[me.leader];
  for (const inf of Object.values(state.influencers || {})) {
    const aff = affinity(inf, me);
    inf.stance = clamp(inf.stance * .9 + aff * .1 + (me.attention / 100) * (aff > 0 ? 2 : -2) + gauss(rnd, 0, 2), -100, 100);
    inf.followers = Math.round(inf.followers * (1 + gauss(rnd, .001, .004)));
    if (state.week - inf.lastWeek < 6) continue;
    const p = .03 + (me.attention / 100) * .05 + Math.abs(inf.stance) / 100 * .04;
    if (rnd() < p) {
      inf.lastWeek = state.week;
      const positive = inf.stance > 10 ? true : inf.stance < -10 ? false : rnd() < .5;
      // inbjudan till podd/intervju
      if (positive && (inf.platform === 'podd' || inf.platform === 'youtube') && rnd() < .5 && me.attention > 12) { out.push({ type: 'interview', influencer: inf.id }); continue; }
      const reach = Math.round(inf.followers * (.3 + rnd() * .5));
      const swing = (reach / 1e6) * (positive ? 1 : -1) * .9;
      for (const sid of inf.segs) { const seg = state.opinion.seg[sid]; if (seg) seg[me.id] = Math.max(.01, (seg[me.id] || .1) + swing); }
      me.attention = clamp(me.attention + 2, 0, 100);
      const aw = state.opinion.awareness[me.id] ?? 1; if (aw < 1) state.opinion.awareness[me.id] = clamp(aw + reach / 8e6, 0, 1);
      addNews(state, { outlet: 'flashback', headline: positive ? `${inf.name} hyllar ${lead.name}: "${pick(rnd, ['Äntligen någon som fattar', 'Lyssna på det här', 'Jag röstar på dem'])}"` : `${inf.name} sågar ${me.abbr}: "${pick(rnd, ['Rena skämtet', 'Snacka om att vara ute och cykla', 'Lita inte på dem'])}"`, body: `${fmt(reach)} följare på ${inf.platform === 'podd' ? 'podden' : inf.platform} hörde ${positive ? 'hyllningen' : 'sågningen'}. ${inf.segs.map((s) => SEGMENTS.find((x) => x.id === s)?.name).join(', ')} påverkas mest.`, tags: ['some', 'influerare'], partyId: me.id, importance: reach > 300000 ? 2 : 1, tone: positive ? 1 : -1 });
    }
  }
  // journalisternas relationer glider mot noll; skandaler sänker
  for (const j of Object.values(state.journalists || {})) j.rel = j.rel * .995;
  return out;
}
export const influencerLabel = (inf) => inf.stance > 30 ? 'anhängare' : inf.stance > 10 ? 'välvillig' : inf.stance > -10 ? 'neutral' : inf.stance > -30 ? 'kritisk' : 'motståndare';
export const PLATFORM_NAMES = { podd: 'Podd', youtube: 'YouTube', tiktok: 'TikTok', x: 'X', instagram: 'Instagram', facebook: 'Facebook' };
export const outletName = (id) => MEDIA[id]?.name || id;
