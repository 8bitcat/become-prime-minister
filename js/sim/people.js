// Personer: partiledare, ministrar, partifolk, journalister. Slumpas per spelomgång.
import { FIRST_F, FIRST_M, LAST, CITIES, EDUCATIONS, JOBS, FAMILY } from '../data/names.js';
import { pick, clamp, gauss } from '../core/util.js';

export const TRAITS = [
  { id: 'karisma', name: 'Karisma', desc: 'Drar folk, lyfter tal och debatter.' },
  { id: 'retorik', name: 'Retorik', desc: 'Formulerar argument som träffar.' },
  { id: 'intelligens', name: 'Intelligens', desc: 'Förstår sakfrågor och siffror.' },
  { id: 'lugn', name: 'Lugn', desc: 'Håller huvudet kallt i kriser och förhör.' },
  { id: 'aggressivitet', name: 'Aggressivitet', desc: 'Går till angrepp – syns, men skapar konflikter.' },
  { id: 'integritet', name: 'Integritet', desc: 'Lägre risk för skandaler och vingliga besked.' },
  { id: 'stresstalighet', name: 'Stresstålighet', desc: 'Orkar långa förhandlingar och valrörelser.' },
  { id: 'social', name: 'Social förmåga', desc: 'Bygger relationer med andra partier och medier.' },
  { id: 'ledarskap', name: 'Ledarskap', desc: 'Håller ihop partiet och ministrarna.' },
  { id: 'erfarenhet', name: 'Politisk erfarenhet', desc: 'Känner spelet, undviker nybörjarmisstag.' },
];
export const TRAIT_POINTS = 420; // summa vid skapande (snitt 42 per egenskap)

export const HAIR_STYLES = [
  { id: 'spik', name: 'Spikig bakåt' }, { id: 'sidbena', name: 'Sidbena' }, { id: 'kort', name: 'Kortklippt' }, { id: 'lang', name: 'Långt' },
  { id: 'bob', name: 'Bob' }, { id: 'knut', name: 'Uppsatt' }, { id: 'slick', name: 'Bakåtslickat' }, { id: 'lockigt', name: 'Lockigt' },
  { id: 'flint', name: 'Flint' }, { id: 'page', name: 'Page' }, { id: 'tofs', name: 'Hästsvans' }, { id: 'tunn', name: 'Tunt/grånat' },
];
export const HAIR_COLORS = ['#1b1b1b', '#3b2a1a', '#6b4423', '#a0622d', '#c8963e', '#e8c872', '#b02e2e', '#7a7a7a', '#d9d9d9', '#2e3a6b', '#f1f1f1'];
export const SKIN_TONES = ['#fde2c8', '#f5cfae', '#e8b68d', '#d19a6b', '#b57c50', '#8d5a3a', '#5e3b26'];
export const EYE_COLORS = ['#3a6ea5', '#2e8b57', '#6b4423', '#1b1b1b', '#7b8da0', '#a0622d'];
export const OUTFITS = [
  { id: 'kostym_navy', name: 'Mörkblå kostym', jacket: '#1f2f5a', shirt: '#ffffff', tie: '#c0282f' },
  { id: 'kostym_gra', name: 'Grå kostym', jacket: '#4a4f5a', shirt: '#ffffff', tie: '#2b4a8a' },
  { id: 'kostym_svart', name: 'Svart kostym', jacket: '#20222a', shirt: '#ffffff', tie: '#444' },
  { id: 'kavaj_vinrod', name: 'Vinröd kavaj', jacket: '#7a1e2e', shirt: '#f6f0e4', tie: null, cravat: true },
  { id: 'blazer_bla', name: 'Blå blazer', jacket: '#2d5fa8', shirt: '#ffffff', tie: null },
  { id: 'drakt_svart', name: 'Svart dräkt', jacket: '#1d1d22', shirt: '#f2d7d9', tie: null },
  { id: 'drakt_rod', name: 'Röd dräkt', jacket: '#b3202c', shirt: '#ffffff', tie: null },
  { id: 'kavaj_gron', name: 'Grön kavaj', jacket: '#2f6b45', shirt: '#ffffff', tie: null },
  { id: 'polo', name: 'Polotröja & kavaj', jacket: '#2a2d3a', shirt: '#2a2d3a', tie: null, polo: true },
  { id: 'skjorta', name: 'Uppkavlad skjorta', jacket: null, shirt: '#dfe8f5', tie: null },
  { id: 'tweed', name: 'Tweedkavaj', jacket: '#6e5a3e', shirt: '#f4ecd8', tie: '#3b5a2a' },
  { id: 'kostym_bla_ljus', name: 'Ljusblå kostym', jacket: '#4f7fc4', shirt: '#ffffff', tie: '#e8c872' },
];
export const GLASSES = [{ id: 'inga', name: 'Inga' }, { id: 'runda', name: 'Runda' }, { id: 'kant', name: 'Kantiga' }, { id: 'bagle', name: 'Tunna bågar' }];
export const BEARDS = [{ id: 'inget', name: 'Inget' }, { id: 'stubb', name: 'Stubb' }, { id: 'skagg', name: 'Helskägg' }, { id: 'mustasch', name: 'Mustasch' }, { id: 'getskagg', name: 'Getskägg' }];

export function randomLook(rnd, gender) {
  const fem = gender === 'k';
  return {
    skin: pick(rnd, SKIN_TONES.slice(0, 5)),
    hair: pick(rnd, fem ? ['lang', 'bob', 'knut', 'page', 'tofs', 'lockigt', 'kort', 'sidbena'] : ['spik', 'sidbena', 'kort', 'slick', 'lockigt', 'flint', 'tunn', 'bob']),
    hairColor: pick(rnd, HAIR_COLORS),
    eyes: pick(rnd, EYE_COLORS),
    eyeShape: pick(rnd, ['skarp', 'rund', 'smal']),
    glasses: rnd() < 0.3 ? pick(rnd, GLASSES.slice(1)).id : 'inga',
    beard: !fem && rnd() < 0.35 ? pick(rnd, BEARDS.slice(1)).id : 'inget',
    outfit: pick(rnd, fem ? ['drakt_svart', 'drakt_rod', 'blazer_bla', 'kavaj_gron', 'kostym_navy', 'polo', 'kostym_gra'] : ['kostym_navy', 'kostym_gra', 'kostym_svart', 'kavaj_vinrod', 'blazer_bla', 'tweed', 'kostym_bla_ljus', 'polo']),
    brows: pick(rnd, ['tunna', 'tjocka', 'vinklade']),
    mouth: pick(rnd, ['neutral', 'smal', 'bred']),
    face: pick(rnd, fem ? ['oval', 'smal', 'rund'] : ['kantig', 'oval', 'smal', 'rund']),
  };
}

export function randomTraits(rnd, bias = {}) {
  const t = {};
  for (const tr of TRAITS) t[tr.id] = clamp(Math.round(gauss(rnd, 42 + (bias[tr.id] || 0), 14)), 8, 92);
  return t;
}

export function makePerson(rnd, opts = {}) {
  const gender = opts.gender || (rnd() < 0.5 ? 'k' : 'm');
  const first = opts.first || pick(rnd, gender === 'k' ? FIRST_F : FIRST_M);
  const last = opts.last || pick(rnd, LAST);
  const age = opts.age || clamp(Math.round(gauss(rnd, 48, 9)), 25, 74);
  return {
    id: opts.id || 'p' + Math.floor(rnd() * 1e9).toString(36),
    name: `${first} ${last}`, first, last, gender, age,
    look: opts.look || randomLook(rnd, gender),
    traits: opts.traits || randomTraits(rnd, opts.bias),
    bg: opts.bg || { utbildning: pick(rnd, EDUCATIONS), yrke: pick(rnd, JOBS), hemstad: pick(rnd, CITIES), familj: pick(rnd, FAMILY) },
    partyId: opts.partyId || null,
    role: opts.role || 'member',
    approval: opts.approval ?? 40,
    popularity: opts.popularity ?? 30,
    scandalRisk: opts.scandalRisk ?? Math.round(10 + rnd() * 25),
    secrets: [],
    since: opts.since || null,
    alive: true,
  };
}

export const traitLabel = (v) => v >= 80 ? 'Exceptionell' : v >= 65 ? 'Stark' : v >= 50 ? 'God' : v >= 35 ? 'Medel' : v >= 20 ? 'Svag' : 'Mycket svag';
export const personSummary = (p) => `${p.age} år · ${p.bg.utbildning} · ${p.bg.yrke} · ${p.bg.hemstad}`;
