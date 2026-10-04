// Personer: partiledare, ministrar, partifolk, journalister. Vanliga människor med bakgrund,
// personlighet och utseende – slumpas per spelomgång, eller skapas av spelaren.
import { FIRST_F, FIRST_M, LAST, CITIES, EDUCATIONS, FAMILY } from '../data/names.js';
import { PROFESSIONS, PROFESSION_BY_ID, EXPERIENCE, EXPERIENCE_BY_ID, PERSONALITY, PERSONALITY_BY_ID, VOICES, BODY_LANGUAGE, STYLES, FAMILY_STATUS, WORLDVIEW, PUBLIC_IMAGE } from '../data/persona.js';
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
  { id: 'spik', name: 'Spikigt bakåt' }, { id: 'sidbena', name: 'Sidbena' }, { id: 'mittbena', name: 'Mittbena' }, { id: 'kort', name: 'Kortklippt' },
  { id: 'rakad', name: 'Snaggat' }, { id: 'hjalm', name: 'Sidkammat' }, { id: 'slick', name: 'Bakåtslickat' }, { id: 'lockigt', name: 'Lockigt' }, { id: 'afro', name: 'Afro' },
  { id: 'lang', name: 'Långt' }, { id: 'axellangt', name: 'Axellångt vågigt' }, { id: 'lugg', name: 'Rak lugg' }, { id: 'bob', name: 'Bob' }, { id: 'page', name: 'Page' },
  { id: 'knut', name: 'Uppsatt' }, { id: 'tofs', name: 'Hästsvans' }, { id: 'flator', name: 'Flätor' }, { id: 'tunn', name: 'Tunt/kal hjässa' }, { id: 'flint', name: 'Flint' },
];
export const HAIR_COLORS = ['#1b1b1b', '#3b2a1a', '#6b4423', '#a0622d', '#c8963e', '#e8c872', '#f1e3b0', '#b02e2e', '#d9534f', '#7a7a7a', '#b5b5b5', '#e6e6e6', '#2e3a6b', '#7a3b8a', '#2f8f6f'];
export const SKIN_TONES = ['#fde2c8', '#f5cfae', '#e8b68d', '#d19a6b', '#b57c50', '#8d5a3a', '#5e3b26', '#3f2a1c'];
export const EYE_COLORS = ['#3a6ea5', '#5a8fc8', '#2e8b57', '#7a9a4a', '#6b4423', '#3b2a1a', '#1b1b1b', '#7b8da0', '#a0622d'];
export const EYE_SHAPES = [{ id: 'skarp', name: 'Skarpa' }, { id: 'rund', name: 'Runda' }, { id: 'smal', name: 'Smala' }, { id: 'stora', name: 'Stora' }, { id: 'trotta', name: 'Tunga ögonlock' }];
export const NOSES = [{ id: 'normal', name: 'Normal' }, { id: 'liten', name: 'Liten' }, { id: 'stor', name: 'Stor' }, { id: 'spetsig', name: 'Spetsig' }, { id: 'bred', name: 'Bred' }];
export const BODIES = [{ id: 'smal', name: 'Smal' }, { id: 'normal', name: 'Normal' }, { id: 'kraftig', name: 'Kraftig' }, { id: 'bred', name: 'Bred & stadig' }];
export const FACES = [{ id: 'oval', name: 'Ovalt' }, { id: 'kantig', name: 'Kantigt' }, { id: 'smal', name: 'Smalt' }, { id: 'rund', name: 'Runt' }, { id: 'langt', name: 'Långsmalt' }];
export const BROWS = [{ id: 'tunna', name: 'Tunna' }, { id: 'vinklade', name: 'Vinklade' }, { id: 'tjocka', name: 'Tjocka' }, { id: 'raka', name: 'Raka' }];
export const MOUTHS = [{ id: 'smal', name: 'Smal' }, { id: 'neutral', name: 'Normal' }, { id: 'bred', name: 'Bred' }, { id: 'fyllig', name: 'Fyllig' }];
// Kläder. kind styr ritningen, style vilka stilar plagget passar. jacket/shirt/tie = standardfärger.
export const OUTFITS = [
  { id: 'kostym_navy', name: 'Mörkblå kostym', kind: 'suit', jacket: '#1f2f5a', shirt: '#ffffff', tie: '#c0282f', style: ['formell'] },
  { id: 'kostym_gra', name: 'Grå kostym', kind: 'suit', jacket: '#4a4f5a', shirt: '#ffffff', tie: '#2b4a8a', style: ['formell'] },
  { id: 'kostym_svart', name: 'Svart kostym', kind: 'suit', jacket: '#20222a', shirt: '#ffffff', tie: '#444444', style: ['formell', 'elegant'] },
  { id: 'kostym_bla_ljus', name: 'Ljusblå kostym', kind: 'suit', jacket: '#4f7fc4', shirt: '#ffffff', tie: '#e8c872', style: ['elegant'] },
  { id: 'kostym_brun', name: 'Brun kostym', kind: 'suit', jacket: '#6e5a3e', shirt: '#f4ecd8', tie: '#3b5a2a', style: ['formell', 'folklig'] },
  { id: 'kostym_fluga', name: 'Kostym med fluga', kind: 'bowtie', jacket: '#2a2d3a', shirt: '#ffffff', tie: '#7a1e2e', style: ['elegant'] },
  { id: 'kavaj_vinrod', name: 'Vinröd kavaj med krås', kind: 'cravat', jacket: '#7a1e2e', shirt: '#f6f0e4', tie: null, style: ['elegant'] },
  { id: 'blazer_bla', name: 'Blå blazer, öppen skjorta', kind: 'blazer', jacket: '#2d5fa8', shirt: '#ffffff', tie: null, style: ['avslappnad', 'formell'] },
  { id: 'kavaj_gron', name: 'Grön kavaj', kind: 'blazer', jacket: '#2f6b45', shirt: '#ffffff', tie: null, style: ['avslappnad'] },
  { id: 'kavaj_tshirt', name: 'Kavaj över t-shirt', kind: 'blazer_tee', jacket: '#2a2d3a', shirt: '#dfe3ea', tie: null, style: ['avslappnad', 'elegant'] },
  { id: 'drakt_svart', name: 'Svart dräkt', kind: 'blazer', jacket: '#1d1d22', shirt: '#f2d7d9', tie: null, style: ['formell', 'elegant'] },
  { id: 'drakt_rod', name: 'Röd dräkt', kind: 'blazer', jacket: '#b3202c', shirt: '#ffffff', tie: null, style: ['formell', 'elegant'] },
  { id: 'drakt_beige', name: 'Beige dräkt', kind: 'blazer', jacket: '#c9b48c', shirt: '#ffffff', tie: null, style: ['elegant', 'formell'] },
  { id: 'polo', name: 'Polotröja & kavaj', kind: 'polo', jacket: '#2a2d3a', shirt: '#2a2d3a', tie: null, style: ['avslappnad', 'elegant'] },
  { id: 'skjorta', name: 'Uppkavlad skjorta', kind: 'shirt', jacket: null, shirt: '#dfe8f5', tie: null, style: ['avslappnad', 'folklig'] },
  { id: 'skjorta_slips', name: 'Skjorta och slips, ingen kavaj', kind: 'shirt_tie', jacket: null, shirt: '#ffffff', tie: '#2b4a8a', style: ['avslappnad', 'formell'] },
  { id: 'rutig', name: 'Rutig flanellskjorta', kind: 'plaid', jacket: null, shirt: '#8a2f2f', tie: null, style: ['folklig'] },
  { id: 'kofta', name: 'Kofta över skjorta', kind: 'cardigan', jacket: '#7a6a55', shirt: '#ffffff', tie: null, style: ['folklig', 'avslappnad'] },
  { id: 'stickad', name: 'Stickad tröja', kind: 'knit', jacket: '#5a6f8a', shirt: null, tie: null, style: ['folklig', 'avslappnad'] },
  { id: 'troja_krage', name: 'Tröja med skjortkrage', kind: 'sweater_collar', jacket: '#3b4a6b', shirt: '#ffffff', tie: null, style: ['avslappnad', 'folklig'] },
  { id: 'vast', name: 'Väst över skjorta', kind: 'vest', jacket: '#3a3a44', shirt: '#ffffff', tie: '#8a2f2f', style: ['formell', 'elegant'] },
  { id: 'blus', name: 'Blus med knytband', kind: 'blouse', jacket: null, shirt: '#e9e2f5', tie: null, style: ['formell', 'elegant'] },
  { id: 'klanning', name: 'Klänning', kind: 'dress', jacket: '#2f4a7a', shirt: null, tie: null, style: ['elegant', 'formell'] },
  { id: 'hoodie', name: 'Hoodie', kind: 'hoodie', jacket: '#3a3a3a', shirt: null, tie: null, style: ['avslappnad'] },
  { id: 'friluft', name: 'Friluftsjacka', kind: 'outdoor', jacket: '#2f6b45', shirt: '#e8e8e8', tie: null, style: ['folklig'] },
  { id: 'tshirt', name: 'T-shirt', kind: 'tee', jacket: null, shirt: '#3b6fc0', tie: null, style: ['avslappnad', 'folklig'] },
  { id: 'arbetsjacka', name: 'Arbetsjacka', kind: 'outdoor', jacket: '#1f3a5a', shirt: '#f0c040', tie: null, style: ['folklig'] },
];
export const OUTFIT_BY_ID = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));
export const JACKET_COLORS = ['#1f2f5a', '#4a4f5a', '#20222a', '#4f7fc4', '#6e5a3e', '#7a1e2e', '#2d5fa8', '#2f6b45', '#b3202c', '#c9b48c', '#5a6f8a', '#7a6a55', '#3a3a3a', '#8a2f2f', '#e8c872', '#7a3b8a', '#1f3a5a', '#d9d9d9'];
export const SHIRT_COLORS = ['#ffffff', '#dfe8f5', '#f4ecd8', '#f2d7d9', '#e9e2f5', '#3b6fc0', '#2a2d3a', '#dfe3ea', '#f0c040', '#8a2f2f', '#2f6b45', '#1b1b1b'];
export const TIE_COLORS = ['#c0282f', '#2b4a8a', '#444444', '#e8c872', '#3b5a2a', '#7a1e2e', '#8a2f2f', '#1b1b1b', '#f08a8a', '#2e8b57'];
export const GLASSES = [{ id: 'inga', name: 'Inga' }, { id: 'runda', name: 'Runda' }, { id: 'kant', name: 'Kantiga' }, { id: 'bagle', name: 'Tunna bågar' }, { id: 'halv', name: 'Läsglasögon' }];
export const BEARDS = [{ id: 'inget', name: 'Inget' }, { id: 'stubb', name: 'Stubb' }, { id: 'skagg', name: 'Helskägg' }, { id: 'mustasch', name: 'Mustasch' }, { id: 'getskagg', name: 'Getskägg' }, { id: 'langt', name: 'Långt skägg' }];

const LOOK_KEYS = ['skin', 'hair', 'hairColor', 'eyes', 'eyeShape', 'glasses', 'beard', 'outfit', 'jacketColor', 'shirtColor', 'tieColor', 'brows', 'mouth', 'face', 'body', 'nose', 'freckles', 'mole', 'earrings', 'lipstick'];

export function randomLook(rnd, gender, { age = 45, style = null } = {}) {
  const fem = gender === 'k';
  const st = style || pick(rnd, ['formell', 'formell', 'avslappnad', 'folklig', 'elegant']);
  const outfits = OUTFITS.filter((o) => o.style.includes(st) && (fem ? !['kostym_fluga'].includes(o.id) : !['blus', 'klanning', 'drakt_svart', 'drakt_rod', 'drakt_beige'].includes(o.id)));
  const outfit = pick(rnd, outfits);
  const grey = age >= 60 ? rnd() < .7 : age >= 50 ? rnd() < .35 : age >= 40 ? rnd() < .1 : false;
  const r = rnd();
  const natural = r < .22 ? '#1b1b1b' : r < .50 ? '#3b2a1a' : r < .70 ? '#6b4423' : r < .80 ? '#a0622d' : r < .90 ? '#c8963e' : r < .95 ? '#e8c872' : r < .975 ? '#b02e2e' : r < .99 ? '#d9534f' : pick(rnd, ['#2e3a6b', '#7a3b8a', '#2f8f6f']);
  const hairColor = grey ? (age >= 65 ? pick(rnd, ['#7a7a7a', '#b5b5b5', '#e6e6e6']) : pick(rnd, ['#7a7a7a', '#b5b5b5'])) : natural;
  const maleHair = age >= 55 && rnd() < .35 ? pick(rnd, ['tunn', 'flint', 'rakad']) : pick(rnd, ['spik', 'sidbena', 'mittbena', 'kort', 'rakad', 'hjalm', 'slick', 'lockigt', 'afro', 'axellangt']);
  const femHair = pick(rnd, ['lang', 'axellangt', 'lugg', 'bob', 'page', 'knut', 'tofs', 'flator', 'lockigt', 'afro', 'kort', 'mittbena', 'sidbena']);
  return {
    skin: (() => { const s = rnd(); return s < .3 ? SKIN_TONES[0] : s < .62 ? SKIN_TONES[1] : s < .8 ? SKIN_TONES[2] : s < .9 ? SKIN_TONES[3] : s < .96 ? SKIN_TONES[4] : SKIN_TONES[5]; })(), hair: fem ? femHair : maleHair, hairColor,
    eyes: pick(rnd, EYE_COLORS), eyeShape: age >= 60 && rnd() < .4 ? 'trotta' : pick(rnd, ['skarp', 'rund', 'smal', 'stora']),
    glasses: rnd() < (age >= 50 ? .45 : .25) ? pick(rnd, GLASSES.slice(1)).id : 'inga',
    beard: !fem && rnd() < .4 ? pick(rnd, BEARDS.slice(1)).id : 'inget',
    outfit: outfit.id, jacketColor: outfit.jacket, shirtColor: outfit.shirt, tieColor: outfit.tie,
    brows: pick(rnd, BROWS).id, mouth: pick(rnd, MOUTHS).id, face: pick(rnd, fem ? ['oval', 'smal', 'rund', 'langt'] : ['kantig', 'oval', 'smal', 'rund', 'langt']),
    body: pick(rnd, ['smal', 'normal', 'normal', 'kraftig', 'bred']), nose: pick(rnd, NOSES).id,
    freckles: rnd() < .15, mole: rnd() < .15 ? pick(rnd, ['vanster', 'hoger']) : null, earrings: fem ? rnd() < .5 : rnd() < .05, lipstick: fem ? rnd() < .5 : false,
    style: st,
  };
}
export const fixLook = (look) => { const o = OUTFIT_BY_ID[look.outfit] || OUTFITS[0]; for (const k of LOOK_KEYS) if (look[k] === undefined) look[k] = k === 'jacketColor' ? o.jacket : k === 'shirtColor' ? o.shirt : k === 'tieColor' ? o.tie : k === 'body' ? 'normal' : k === 'nose' ? 'normal' : k === 'freckles' || k === 'earrings' || k === 'lipstick' ? false : k === 'mole' ? null : look[k]; return look; };

export function randomTraits(rnd, bias = {}) {
  const t = {};
  for (const tr of TRAITS) t[tr.id] = clamp(Math.round(gauss(rnd, 42 + (bias[tr.id] || 0), 14)), 8, 92);
  return t;
}
// Slumpa en persona (bakgrund, personlighet m.m.) som passar åldern
export function randomPersona(rnd, { age = 45, gender = 'k', role = 'member' } = {}) {
  const prof = age < 27 ? pick(rnd, PROFESSIONS.filter((p) => ['student', 'influerare', 'programmerare', 'underskoterska', 'bygg'].includes(p.id))) : age >= 66 ? pick(rnd, PROFESSIONS.filter((p) => !['student'].includes(p.id))) : pick(rnd, PROFESSIONS.filter((p) => p.id !== 'student' && p.id !== 'pensionar'));
  const exp = role === 'leader' ? pick(rnd, ['kommunalrad', 'riksdag', 'riksdag', 'minister', 'fack', 'region']) : pick(rnd, ['ingen', 'lokal', 'lokal', 'kommunalrad', 'region', 'riksdag', 'fack']);
  const pers = [];
  const pool = PERSONALITY.slice();
  const n = 2 + Math.floor(rnd() * 3);
  while (pers.length < n && pool.length) { const p = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; if (pers.some((x) => PERSONALITY_BY_ID[x].excl === p.id || p.excl === x)) continue; pers.push(p.id); }
  return {
    profession: prof.id, experience: exp, personality: pers,
    voice: pick(rnd, VOICES).id, bodyLanguage: pick(rnd, BODY_LANGUAGE).id, style: null,
    family: pick(rnd, FAMILY_STATUS), children: age < 30 ? (rnd() < .2 ? 1 : 0) : Math.floor(rnd() * 4), worldview: pick(rnd, ['sekular', 'sekular', 'sekular', 'kristen', 'kristen', 'muslim', 'annan', 'privat']),
    image: pick(rnd, PUBLIC_IMAGE).id,
  };
}
// Personlighetsdrag + erfarenhet → justerade egenskaper
export function applyPersona(traits, persona) {
  const t = { ...traits };
  for (const id of persona.personality || []) { const p = PERSONALITY_BY_ID[id]; if (!p) continue; for (const k in p.mod) t[k] = clamp((t[k] || 42) + p.mod[k], 5, 99); }
  const ex = EXPERIENCE_BY_ID[persona.experience]; if (ex) t.erfarenhet = clamp((t.erfarenhet || 42) + ex.exp, 5, 99);
  const pr = PROFESSION_BY_ID[persona.profession]; if (pr?.exp) t.erfarenhet = clamp(t.erfarenhet + pr.exp / 2, 5, 99);
  return t;
}
export const credOf = (persona) => ({ ...(PROFESSION_BY_ID[persona?.profession]?.cred || {}) });

export function makePerson(rnd, opts = {}) {
  const gender = opts.gender || (rnd() < 0.5 ? 'k' : 'm');
  const first = opts.first || pick(rnd, gender === 'k' ? FIRST_F : FIRST_M);
  const last = opts.last || pick(rnd, LAST);
  const age = opts.age || clamp(Math.round(gauss(rnd, 47, 11)), 22, 76);
  const persona = opts.persona || randomPersona(rnd, { age, gender, role: opts.role });
  const baseTraits = opts.traits || randomTraits(rnd, opts.bias);
  return {
    id: opts.id || 'p' + Math.floor(rnd() * 1e9).toString(36),
    name: `${first} ${last}`, first, last, gender, age,
    look: fixLook(opts.look || randomLook(rnd, gender, { age, style: persona.style })),
    baseTraits, traits: applyPersona(baseTraits, persona), persona, cred: credOf(persona),
    bg: opts.bg || { utbildning: pick(rnd, EDUCATIONS), yrke: PROFESSION_BY_ID[persona.profession]?.name || 'Politiker', hemstad: pick(rnd, CITIES), familj: pick(rnd, FAMILY) },
    partyId: opts.partyId || null, role: opts.role || 'member',
    approval: opts.approval ?? 40, popularity: opts.popularity ?? 30,
    scandalRisk: opts.scandalRisk ?? Math.round(10 + rnd() * 25),
    ambition: Math.round(clamp(gauss(rnd, 50, 20), 5, 99)), loyalty: Math.round(clamp(gauss(rnd, 60, 18), 5, 99)),
    posDelta: {}, // egen avvikelse från partilinjen (falanger)
    secrets: [], since: opts.since || null, alive: true, career: [],
  };
}

export const traitLabel = (v) => v >= 80 ? 'Exceptionell' : v >= 65 ? 'Stark' : v >= 50 ? 'God' : v >= 35 ? 'Medel' : v >= 20 ? 'Svag' : 'Mycket svag';
export const personSummary = (p) => `${p.age} år · ${p.bg.utbildning} · ${p.bg.yrke} · ${p.bg.hemstad}`;
export const personaSummary = (p) => { const pe = p.persona || {}; return [EXPERIENCE_BY_ID[pe.experience]?.name, (pe.personality || []).map((id) => PERSONALITY_BY_ID[id]?.name.toLowerCase()).join(', ')].filter(Boolean).join(' · '); };
