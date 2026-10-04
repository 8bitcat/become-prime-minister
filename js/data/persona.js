// Personan: bakgrunder med trovärdighet per sakfråga, politisk erfarenhet, personlighetsdrag,
// röst, kroppsspråk och stil. Används både för spelarens ledare och för alla AI-politiker.

// yrke → trovärdighet i sakfrågor (+ i debatter och hos väljare som bryr sig om frågan)
export const PROFESSIONS = [
  { id: 'nationalekonom', name: 'Nationalekonom', cred: { ekonomi: 18 }, group: 'akademiker' },
  { id: 'jurist', name: 'Jurist', cred: { kriminal: 12, varderingar: 6 }, group: 'akademiker' },
  { id: 'lakare', name: 'Läkare', cred: { valfard: 16 }, group: 'akademiker' },
  { id: 'sjukskoterska', name: 'Sjuksköterska', cred: { valfard: 16 }, group: 'offentlig' },
  { id: 'larare', name: 'Lärare', cred: { valfard: 12 }, group: 'offentlig' },
  { id: 'rektor', name: 'Rektor', cred: { valfard: 10 }, group: 'offentlig' },
  { id: 'polis', name: 'Polis', cred: { kriminal: 18 }, group: 'offentlig' },
  { id: 'officer', name: 'Officer', cred: { forsvar: 20, kriminal: 4 }, group: 'offentlig' },
  { id: 'foretagare', name: 'Företagare', cred: { ekonomi: 10, arbete: 8 }, group: 'foretag' },
  { id: 'entreprenor', name: 'Tech-entreprenör', cred: { ekonomi: 8, energi: 6 }, group: 'foretag' },
  { id: 'ekonomichef', name: 'Ekonomichef', cred: { ekonomi: 12 }, group: 'foretag' },
  { id: 'restaurang', name: 'Restaurangägare', cred: { ekonomi: 6, arbete: 6, migration: 4 }, group: 'foretag' },
  { id: 'fack', name: 'Fackombudsman', cred: { arbete: 18, ekonomi: 4 }, group: 'arbetare' },
  { id: 'industri', name: 'Industriarbetare', cred: { arbete: 12, energi: 6 }, group: 'arbetare' },
  { id: 'bygg', name: 'Byggnadsarbetare', cred: { bostad: 12, arbete: 8 }, group: 'arbetare' },
  { id: 'bussforare', name: 'Bussförare', cred: { arbete: 6, landsbygd: 6 }, group: 'arbetare' },
  { id: 'underskoterska', name: 'Undersköterska', cred: { valfard: 14 }, group: 'arbetare' },
  { id: 'lantbrukare', name: 'Lantbrukare', cred: { landsbygd: 18, klimat: 6 }, group: 'landsbygd' },
  { id: 'skogsagare', name: 'Skogsägare', cred: { landsbygd: 12, klimat: 8 }, group: 'landsbygd' },
  { id: 'journalist', name: 'Journalist', cred: { varderingar: 6 }, group: 'media', media: 10 },
  { id: 'forskare', name: 'Forskare', cred: { klimat: 12, energi: 8 }, group: 'akademiker' },
  { id: 'ingenjor', name: 'Civilingenjör', cred: { energi: 14, bostad: 6 }, group: 'akademiker' },
  { id: 'programmerare', name: 'Programmerare', cred: { ekonomi: 4, energi: 4 }, group: 'akademiker' },
  { id: 'arkitekt', name: 'Arkitekt', cred: { bostad: 14 }, group: 'akademiker' },
  { id: 'socionom', name: 'Socionom', cred: { valfard: 8, migration: 8, kriminal: 6 }, group: 'offentlig' },
  { id: 'diplomat', name: 'Diplomat', cred: { eu: 16, forsvar: 6 }, group: 'offentlig' },
  { id: 'prast', name: 'Präst', cred: { varderingar: 14 }, group: 'kyrka' },
  { id: 'imam', name: 'Imam', cred: { varderingar: 10, migration: 8 }, group: 'kyrka' },
  { id: 'miljoaktivist', name: 'Miljöaktivist', cred: { klimat: 18 }, group: 'aktivist' },
  { id: 'influerare', name: 'Influerare', cred: {}, group: 'media', media: 6, some: 15 },
  { id: 'kommunalrad', name: 'Kommunalråd', cred: { landsbygd: 6, bostad: 6 }, group: 'politik', exp: 10 },
  { id: 'riksdagsledamot', name: 'Riksdagsledamot', cred: {}, group: 'politik', exp: 18 },
  { id: 'minister', name: 'Tidigare minister', cred: { ekonomi: 6 }, group: 'politik', exp: 28 },
  { id: 'student', name: 'Student', cred: {}, group: 'ung' },
  { id: 'pensionar', name: 'Pensionär', cred: { valfard: 6 }, group: 'aldre' },
  { id: 'frisor', name: 'Frisör', cred: { arbete: 4 }, group: 'foretag' },
  { id: 'brandman', name: 'Brandman', cred: { kriminal: 6, forsvar: 6 }, group: 'offentlig' },
  { id: 'konstnar', name: 'Konstnär', cred: { varderingar: 8 }, group: 'kultur' },
  { id: 'idrottare', name: 'Före detta elitidrottare', cred: {}, group: 'kultur', media: 8 },
  { id: 'lastbil', name: 'Lastbilschaufför', cred: { landsbygd: 8, arbete: 6, energi: 4 }, group: 'arbetare' },
];
export const PROFESSION_BY_ID = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]));

export const EXPERIENCE = [
  { id: 'ingen', name: 'Ingen politisk erfarenhet', exp: -12, outsider: 12, desc: 'Nybörjare – men "en av oss" för dem som är trötta på politiker.' },
  { id: 'lokal', name: 'Lokalpolitiker', exp: 0, outsider: 4, desc: 'Fullmäktige i hemkommunen. Kan det lokala spelet.' },
  { id: 'kommunalrad', name: 'Kommunalråd', exp: 8, outsider: 0, desc: 'Har styrt en kommun. Nätverk och vana vid medier.' },
  { id: 'region', name: 'Regionpolitiker', exp: 8, outsider: -2, desc: 'Sjukvård och kollektivtrafik i ryggraden.' },
  { id: 'riksdag', name: 'Riksdagsledamot', exp: 16, outsider: -8, desc: 'Känner riksdagen – och är en del av etablissemanget.' },
  { id: 'minister', name: 'Tidigare minister', exp: 26, outsider: -14, desc: 'Vet hur makten fungerar. Vet också vad den kostar.' },
  { id: 'fack', name: 'Facklig/organisationsledare', exp: 10, outsider: 2, desc: 'Van vid förhandlingar och mobilisering.' },
];
export const EXPERIENCE_BY_ID = Object.fromEntries(EXPERIENCE.map((e) => [e.id, e]));

// Personlighetsdrag. mod = justering av egenskaper, hooks används i debatter/händelser/opinion.
export const PERSONALITY = [
  { id: 'karismatisk', name: 'Karismatisk', excl: 'reserverad', mod: { karisma: 10 }, desc: 'Drar folk. Partiets popularitet hänger mer på dig.' },
  { id: 'reserverad', name: 'Reserverad', excl: 'karismatisk', mod: { karisma: -5, lugn: 8, integritet: 4 }, desc: 'Syns mindre, snubblar mindre. Bygger stabilt.' },
  { id: 'humoristisk', name: 'Humoristisk', excl: 'serios', mod: { social: 6 }, desc: 'Låser upp humor i debatter och sociala medier. Kan landa fel.' },
  { id: 'serios', name: 'Seriös', excl: 'humoristisk', mod: { intelligens: 4, integritet: 4 }, desc: 'Trovärdig i sakfrågor. Sällan viral.' },
  { id: 'aggressiv', name: 'Aggressiv', excl: 'lugn', mod: { aggressivitet: 14, retorik: 4 }, desc: 'Starka motangrepp. Fler konflikter och skandaler.' },
  { id: 'lugn', name: 'Lugn', excl: 'aggressiv', mod: { lugn: 14 }, desc: 'Kriser och utfrågningar biter sämre.' },
  { id: 'impulsiv', name: 'Impulsiv', excl: 'disciplinerad', mod: { lugn: -8, karisma: 4 }, desc: 'Snabba utspel, oväntade vinster – och självmål.' },
  { id: 'disciplinerad', name: 'Disciplinerad', excl: 'impulsiv', mod: { stresstalighet: 10, integritet: 4 }, desc: 'Håller linjen. Färre självmål.' },
  { id: 'ambitios', name: 'Ambitiös', excl: null, mod: { ledarskap: 6, stresstalighet: 4 }, desc: 'Snabbare karriär. Rivaler ser dig som ett hot.' },
  { id: 'pragmatisk', name: 'Pragmatisk', excl: 'ideologisk', mod: { social: 6 }, desc: 'Kompromisser kostar mindre. Kärnväljarna är mindre lojala.' },
  { id: 'ideologisk', name: 'Ideologisk', excl: 'pragmatisk', mod: { integritet: 6 }, desc: 'Lojala kärnväljare. Förhandlingar blir dyrare.' },
  { id: 'empatisk', name: 'Empatisk', excl: 'kall', mod: { social: 8, karisma: 2 }, desc: 'Känsloargument träffar. Hårda beslut sliter.' },
  { id: 'kall', name: 'Kall', excl: 'empatisk', mod: { intelligens: 6, lugn: 4, social: -6 }, desc: 'Fakta och kalkyl. Sämre med sympati.' },
  { id: 'optimistisk', name: 'Optimistisk', excl: 'pessimistisk', mod: { karisma: 4 }, desc: 'Smittar av sig i goda tider. Blind i kriser.' },
  { id: 'pessimistisk', name: 'Pessimistisk', excl: 'optimistisk', mod: { intelligens: 2, stresstalighet: 4 }, desc: 'Ser kriser komma. Entusiasmerar sällan.' },
];
export const PERSONALITY_BY_ID = Object.fromEntries(PERSONALITY.map((p) => [p.id, p]));
export const MAX_PERSONALITY = 4;

export const VOICES = [
  { id: 'ljus', name: 'Ljus', pitch: 1.25, desc: 'Lätt och snabb.' }, { id: 'mork', name: 'Mörk', pitch: .7, desc: 'Tyngd i riksdagen.', riksdag: 3 },
  { id: 'hes', name: 'Hes', pitch: .85, desc: 'Karaktär. Folklig.', folk: 3 }, { id: 'mjuk', name: 'Mjuk', pitch: 1.0, desc: 'Lugnande. Bra i intervjuer.', kansla: 3 },
  { id: 'skarp', name: 'Skarp', pitch: 1.1, desc: 'Skär igenom. Bra i angrepp.', angrepp: 3 },
];
export const BODY_LANGUAGE = [
  { id: 'livligt', name: 'Livligt', desc: 'Gester, pekar, rör sig. Engagerar – kan se nervöst ut.', poses: ['point', 'open', 'hips'] },
  { id: 'kontrollerat', name: 'Kontrollerat', desc: 'Lugnt och avvägt. Statsmannamässigt.', poses: ['stand', 'open', 'think'] },
  { id: 'stelt', name: 'Stelt', desc: 'Står still, armarna i kors. Säkert men distanserat.', poses: ['cross', 'stand'] },
  { id: 'nervost', name: 'Nervöst', desc: 'Fingrar, blickar. Mänskligt – men syns i TV.', poses: ['think', 'stand'], debate: -3 },
];
export const STYLES = [
  { id: 'formell', name: 'Formell', desc: 'Kostym/dräkt, slips, statsmannaskap.', seg: { hoginkomst: 1.05, pensionarer: 1.05, storstad_unga: .95 } },
  { id: 'avslappnad', name: 'Avslappnad', desc: 'Kavaj och jeans, uppkavlade ärmar.', seg: { storstad_unga: 1.05, studenter: 1.05, foretagare: 1.02, pensionarer: .97 } },
  { id: 'folklig', name: 'Folklig', desc: 'Tröja, friluftsjacka – som grannen.', seg: { landsbygd: 1.06, industri: 1.04, laginkomst: 1.04, hoginkomst: .95 } },
  { id: 'elegant', name: 'Elegant', desc: 'Designat, välklätt, kontrollerat.', seg: { hoginkomst: 1.06, storstad_akademiker: 1.03, laginkomst: .96, landsbygd: .97 } },
];
export const FAMILY_STATUS = ['Ensamstående', 'Gift', 'Sambo', 'Skild', 'Änka/änkling'];
export const WORLDVIEW = [{ id: 'sekular', name: 'Sekulär' }, { id: 'kristen', name: 'Kristen' }, { id: 'muslim', name: 'Muslim' }, { id: 'judisk', name: 'Judisk' }, { id: 'annan', name: 'Annan tro' }, { id: 'privat', name: 'Vill inte uppge' }];

// Offentlig image – vad du försöker vara i mediernas ögon. Krockar med personligheten → "äkthetsrisk".
export const PUBLIC_IMAGE = [
  { id: 'statsman', name: 'Statsmannen', fits: ['lugn', 'serios', 'disciplinerad', 'kontrollerat'], desc: 'Ansvar, erfarenhet, lugn.' },
  { id: 'folklig', name: 'En av folket', fits: ['humoristisk', 'empatisk', 'folklig', 'hes'], desc: 'Vardaglig, nära, begriplig.' },
  { id: 'rebell', name: 'Rebellen', fits: ['aggressiv', 'impulsiv', 'ideologisk', 'livligt'], desc: 'Mot systemet, mot eliten.' },
  { id: 'expert', name: 'Experten', fits: ['serios', 'kall', 'disciplinerad'], desc: 'Siffror, analys, kompetens.' },
  { id: 'varme', name: 'Den varma', fits: ['empatisk', 'optimistisk', 'mjuk'], desc: 'Omsorg, lyssnande, hopp.' },
  { id: 'kampen', name: 'Kämpen', fits: ['ambitios', 'aggressiv', 'disciplinerad', 'livligt'], desc: 'Ger aldrig upp, slåss för er.' },
];
