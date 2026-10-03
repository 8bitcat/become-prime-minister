// Debatter, intervjuer och utfrågningar – innehållet. Presentationen (anime-scenen) ligger i scene/debate.js.
// En debatt = rundor. Varje runda: motståndarens påstående → dina alternativ → utfall → mätaren rör sig.
import { ISSUES, ISSUE_BY_ID } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { JOURNALISTS, MEDIA } from '../data/names.js';
import { STAT_BY_ID } from '../data/stats.js';
import { clamp, pick, fmt, weighted } from '../core/util.js';
import { activeParties } from './opinion.js';
import { addNews } from './news.js';
import { makePerson } from './people.js';

const me = (s) => s.parties[s.player.partyId];

// Fraser per fråga. L = vänstersidan av axeln, R = högersidan.
const PHRASES = {
  ekonomi: { L: ['Sverige behöver en stark gemensam välfärd – inte fler skattesänkningar för de rikaste.', 'Varje skattesänkning är en nedskärning i vården och skolan. Det vet {parti}.'], R: ['Vanligt folk ska få behålla mer av sin lön. {parti} vill bara höja skatterna.', 'Tillväxt skapas av företag och arbete, inte av större offentlig sektor.'], stat: ['arbetsloshet', 'inflation', 'bnp_tillvaxt', 'statsskuld_bnp'] },
  migration: { L: ['Sverige ska vara ett land som tar ansvar och ger skydd åt människor på flykt.', 'Integrationen misslyckas inte på grund av invandrarna, utan på grund av bristande satsningar.'], R: ['Invandringen måste minska kraftigt. Vi klarar inte mer av det här.', 'Krav är inte hårt – krav är respekt. {parti} vill fortsätta som förut.'], stat: ['asylsokande', 'integration', 'andel_utrikes_fodda', 'arbetsloshet'] },
  kriminal: { L: ['Hårdare straff löser inte gängkriminaliteten. Vi måste stoppa rekryteringen.', 'Varje krona till fängelser är en krona från fritidsgårdar och skolor.'], R: ['Gängen ska krossas. Dubbla straff, visitationszoner och fler poliser.', 'Medan {parti} pratar om orsaker skjuts unga män på gatorna.'], stat: ['skjutningar', 'dodligt_vald', 'gang_index', 'poliser', 'uppklarning'] },
  klimat: { L: ['Klimatkrisen är vår tids ödesfråga. {parti} vill sänka bensinskatten – det är oansvarigt.', 'Utsläppen måste ned nu, inte om tjugo år.'], R: ['Svensk klimatpolitik ska inte slå mot dem som bor på landsbygden.', 'Sverige står för en promille av utsläppen. Symbolpolitik hjälper ingen.'], stat: ['utslapp', 'elpris', 'bensinpris', 'elbilar'] },
  forsvar: { L: ['Varje miljard till försvaret är en miljard mindre till vården.', 'Säkerhet byggs med diplomati, inte bara vapen.'], R: ['Vi lever i den farligaste tiden sedan kalla kriget. Försvaret måste rustas – nu.', '{parti} har svikit försvaret i decennier.'], stat: ['forsvar_bnp', 'militar_styrka', 'soldater', 'sakerhetslage'] },
  eu: { L: ['Beslut ska fattas i Sverige, av svenska folket – inte i Bryssel.', 'EU-avgiften skenar medan svenska pensionärer får mindre.'], R: ['Sverige är starkare i EU. {parti} vill isolera oss.', 'Alla stora frågor – klimat, säkerhet, handel – löses gemensamt i Europa.'], stat: ['export', 'handelsbalans', 'utg_bistand'] },
  valfard: { L: ['Vinstjakten i välfärden måste stoppas. Skattepengar ska gå till elever och patienter.', 'Varje privatisering är ett experiment med människors liv.'], R: ['Valfrihet är frihet. {parti} vill tvinga alla in i samma kö.', 'Det viktiga är kvaliteten, inte vem som driver sjukhuset.'], stat: ['vardkoer', 'vardkvalitet', 'skolresultat', 'behoriga_larare'] },
  landsbygd: { L: ['Satsningar ska göras där människor bor – i städerna.', 'Vi kan inte subventionera varje bensinstation i glesbygden.'], R: ['Hela Sverige ska leva. {parti} har glömt bort alla utanför tullarna.', 'Bränslepriserna krossar landsbygden medan storstadsbor cyklar till jobbet.'], stat: ['bensinpris', 'vagstandard', 'bredband'] },
  varderingar: { L: ['Sverige ska vara ett öppet, liberalt land där var och en får leva sitt liv.', '{parti} vill tillbaka till 50-talet.'], R: ['Vi måste våga stå upp för svenska värderingar och sammanhållning.', 'Familjen är samhällets grund – inte staten.'], stat: ['jamstalldhet', 'sammanhallning', 'polarisering'] },
  arbete: { L: ['Tryggheten på jobbet är inte förhandlingsbar. {parti} vill göra det lättare att sparka folk.', 'Den svenska modellen bygger på starka fack.'], R: ['Företag vågar inte anställa med dagens stela regler.', 'Fler i arbete kräver en arbetsmarknad som fungerar – inte LO:s veto.'], stat: ['arbetsloshet', 'ungdomsarbetsloshet', 'sysselsattning', 'langtidsarbetsloshet'] },
  bostad: { L: ['Marknadshyror skulle slänga ut tiotusentals ur sina hem.', 'Bostad är en rättighet, inte en spekulationsvara.'], R: ['Hyresregleringen har skapat svarta marknader och tjugoåriga köer.', 'Det byggs för lite för att {parti} älskar regler.'], stat: ['byggstarter', 'bostadsko', 'bostadspris_tillvaxt', 'boendekostnad'] },
  energi: { L: ['Kärnkraft tar femton år och kostar hundratals miljarder. Vindkraften är här nu.', '{parti} drömmer om reaktorer medan elräkningarna rusar.'], R: ['Utan ny kärnkraft får Sverige aldrig stabila elpriser.', 'Vindkraft fungerar inte när det är vindstilla i januari.'], stat: ['elpris', 'el_karnkraft', 'el_vind', 'fornybart'] },
};
const KANSLA = ['Jag har träffat människor över hela landet som berättar samma sak: det här fungerar inte. Jag tänker inte svika dem.', 'Det handlar inte om siffror. Det handlar om människor. Om familjer. Om framtiden.', 'Jag gick in i politiken för exakt det här. Och jag kommer inte att ge upp.'];
const ANGREPP = ['Ni har haft chansen i åratal. Vad har ni gjort? Ingenting!', 'Det där är helt enkelt inte sant, och det vet du.', 'Du kan inte ens svara på en enkel fråga. Hur ska väljarna kunna lita på dig?'];
const KOMPROMISS = ['Jag tror vi är överens om målet, även om vi ser olika på vägen dit. Låt oss hitta en lösning.', 'Det finns kloka tankar i det du säger. Men jag vill lägga till en sak.', 'Jag förstår oron. Därför föreslår vi ett steg i taget, med utvärdering.'];
const REACT_WIN = ['Publiken applåderar.', 'Motståndaren tappar tråden.', 'Moderatorn höjer på ögonbrynen.', 'Det blir tyst i studion.'];
const REACT_LOSE = ['Motståndaren ler.', 'Publiken mumlar.', 'Argumentet faller platt.', 'Moderatorn går vidare.'];

function sideOf(party, issue) { return (party.pos[issue] || 0) < 0 ? 'L' : 'R'; }
function statLine(state, issue) {
  const id = pick(G, PHRASES[issue].stat);
  const st = STAT_BY_ID[id]; const v = state.sweden.stats[id];
  const hist = state.sweden.hist[id] || [];
  const old = hist.length > 12 ? hist[hist.length - 13] : null;
  const trend = old != null ? (v > old ? 'stigit' : 'sjunkit') : null;
  const unit = st.unit.replace(/^antal\/år$/, 'per år').replace(/^tusen\/år$/, 'tusen per år').replace(/^mdkr\/år$/, 'miljarder per år');
  return { id, text: `Fakta: ${st.name.toLowerCase()} ligger på ${fmt(v, st.d)} ${unit}${trend ? ` och har ${trend} det senaste året` : ''}. ${trend ? 'Det är resultatet av den förda politiken.' : 'Det är verkligheten vi måste utgå från.'}` };
}
let G = Math.random;

// Välj motståndare: i riksdagsdebatt statsministern/oppositionsledaren, i TV den som är hetast
function pickOpponent(state, rnd) {
  const mine = me(state);
  const others = activeParties(state).filter((p) => !p.isPlayer && p.inRiksdag);
  const gov = state.government;
  if (gov.pm && gov.pm !== state.player.leaderId && rnd() < .5) return state.parties[gov.pmParty];
  return weighted(rnd, others, (p) => (state.riksdag.seats[p.id] || 1) * (1 + Math.abs(p.relations?.[mine.id] || 0) / 50) * (1 + p.attention / 50));
}

export function buildDebate(state, rnd, { kind = 'tv', host = null, campaign = false, name = null, issue = null } = {}) {
  G = rnd;
  const mine = me(state), leader = state.people[mine.leader];
  const d = { kind, host: host || (kind === 'riksdag' ? 'riksdag' : pick(rnd, ['svt', 'tv4', 'aftonbladet'])), campaign, name: name || (kind === 'riksdag' ? 'Partiledardebatt i riksdagen' : kind === 'interview' ? 'Utfrågning' : 'TV-debatt'), rounds: [], meter: 0, log: [], done: false, result: null };
  if (kind === 'interview') {
    const j = pick(rnd, JOURNALISTS);
    const jp = makePerson(rnd, { gender: /a$|e$|n$/.test(j.name.split(' ')[0]) && !['Johan', 'Jakob', 'Oskar', 'Peter', 'Fredrik'].includes(j.name.split(' ')[0]) ? 'k' : 'm', age: 35 + Math.floor(rnd() * 25) });
    jp.name = j.name; jp.first = j.name.split(' ')[0];
    jp.look.outfit = pick(rnd, ['kostym_gra', 'blazer_bla', 'drakt_svart', 'polo']);
    d.opponent = jp; d.opponentParty = null; d.journalist = j; d.host = j.outlet; d.name = `${MEDIA[j.outlet].name} – utfrågning`;
    d.rounds = buildInterviewRounds(state, rnd, j, issue);
  } else {
    const op = pickOpponent(state, rnd);
    d.opponentParty = op.id; d.opponent = state.people[op.leader];
    const n = kind === 'riksdag' ? 3 : 4;
    const issues = [...ISSUES].sort((a, b) => (state.opinion.salience[b.id] * (1 + (op.profile?.[b.id] || 1) * .2)) - (state.opinion.salience[a.id] * (1 + (op.profile?.[a.id] || 1) * .2))).slice(0, 6);
    const chosen = []; for (let i = 0; i < n; i++) { const is = issues.splice(Math.floor(rnd() * Math.min(3, issues.length)), 1)[0]; chosen.push(is.id); }
    for (const isId of chosen) d.rounds.push(buildRound(state, rnd, op, isId));
  }
  state.stats.debates++;
  return d;
}

function buildRound(state, rnd, op, issue) {
  const is = ISSUE_BY_ID[issue]; const mine = me(state);
  const side = sideOf(op, issue);
  const statement = pick(rnd, PHRASES[issue][side]).replace('{parti}', mine.abbr);
  const options = [];
  const st = statLine(state, issue);
  options.push({ type: 'fakta', label: 'Fakta', text: st.text, stat: st.id });
  options.push({ type: 'kansla', label: 'Känsla', text: pick(rnd, KANSLA) });
  options.push({ type: 'angrepp', label: 'Motangrepp', text: pick(rnd, ANGREPP) });
  options.push({ type: 'kompromiss', label: 'Lugn & kompromiss', text: pick(rnd, KOMPROMISS) });
  // INVÄNDNING: har motståndaren röstat tvärtemot det de just sa?
  const rec = (state.riksdag.record[op.id] || []).filter((r) => { const b = BILL_AREA[r.billId]; return b && b.area === issue; });
  const contra = rec.find((r) => { const b = BILL_AREA[r.billId]; const dir = Object.values(b.vec)[0] > 0 ? 'R' : 'L'; return (r.vote === 'ja' && dir !== side) || (r.vote === 'nej' && dir === side); });
  // eller: motståndaren har ändrat sig kraftigt i frågan (jämfört med startposition)
  const flip = op.posStart && Math.abs((op.posStart[issue] || 0) - op.pos[issue]) > 30;
  if (contra) options.push({ type: 'invandning', label: 'INVÄNDNING!', text: `Vänta nu. Den ${contra.vote === 'ja' ? 'förslaget' : 'motionen'} "${contra.title}" – ni röstade ${contra.vote.toUpperCase()}. Hur går det ihop med det du just sa?`, evidence: `Riksdagens protokoll: ${op.abbr} röstade ${contra.vote} om "${contra.title}".` });
  else if (flip) options.push({ type: 'invandning', label: 'INVÄNDNING!', text: `För bara några år sedan stod ${op.abbr} för raka motsatsen. Vad hände – bytte ni åsikt eller bytte ni väljare?`, evidence: `${op.name}s partiprogram har flyttat sig kraftigt i frågan om ${is.name.toLowerCase()}.` });
  return { issue, statement, options, opExpr: side === 'R' ? 'determined' : 'confident', resolved: false };
}
import { BILLS } from './riksdag.js';
const BILL_AREA = Object.fromEntries(BILLS.map((b) => [b.id, b]));

function buildInterviewRounds(state, rnd, j, issue) {
  const mine = me(state); const leader = state.people[mine.leader];
  const rounds = [];
  const hot = issue || [...ISSUES].sort((a, b) => state.opinion.salience[b.id] - state.opinion.salience[a.id])[0].id;
  const is = ISSUE_BY_ID[hot];
  const q1 = `${pick(rnd, ['Låt oss börja med', 'Först:', 'Många väljare undrar:'])} ${is.name.toLowerCase()}. Ert parti vill ${(mine.pos[hot] || 0) < 0 ? is.left.toLowerCase() : is.right.toLowerCase()}. Hur ska det betalas?`;
  rounds.push({ issue: hot, statement: q1, interview: true, options: [
    { type: 'fakta', label: 'Siffror', text: statLine(state, hot).text },
    { type: 'kansla', label: 'Berättelse', text: pick(rnd, KANSLA) },
    { type: 'kompromiss', label: 'Resonera', text: pick(rnd, KOMPROMISS) },
    { type: 'undvik', label: 'Undvik frågan', text: 'Det viktiga är inte exakt hur, utan att vi gör det. Låt mig i stället berätta om…' },
  ] });
  // gotcha-fråga
  const got = pick(rnd, [
    { q: 'Vad kostar ett paket mjölk i dag?', a: `Ungefär ${fmt(14 + state.sweden.stats.inflation * .8, 0)} kronor för en liter.`, bad: 'Eh… det beror på var man handlar… tio kronor?' },
    { q: 'Hur stor är statsskulden i andel av BNP?', a: `Runt ${fmt(state.sweden.stats.statsskuld_bnp, 0)} procent – lågt i ett europeiskt perspektiv.`, bad: 'Alldeles för hög. Flera tusen miljarder.' },
    { q: 'Hur många skjutningar hade Sverige förra året?', a: `Drygt ${fmt(state.sweden.stats.skjutningar, 0)}. Varje enskild är en för mycket.`, bad: 'Många. Alldeles för många. Jag har inte siffran framför mig.' },
    { q: 'Vad är Riksbankens styrränta just nu?', a: `${fmt(state.sweden.stats.styrranta, 2)} procent.`, bad: 'Runt fyra, fem procent? Den ändras ju hela tiden.' },
  ]);
  rounds.push({ issue: 'ekonomi', statement: got.q, interview: true, gotcha: true, options: [
    { type: 'fakta', label: 'Svara exakt', text: got.a, gotchaOk: true },
    { type: 'undvik', label: 'Glid undan', text: got.bad },
    { type: 'angrepp', label: 'Avfärda frågan', text: 'Är det här verkligen vad era tittare vill veta? Jag är här för att prata politik.' },
  ] });
  // skandal eller röstminne
  const sc = (state.scandals || []).find((x) => x.active && x.partyId === mine.id);
  const rec = (state.riksdag.record[mine.id] || []).slice(-1)[0];
  if (sc) rounds.push({ issue: 'varderingar', statement: `Vi måste prata om ${sc.title.toLowerCase()}en. ${sc.text.split('.')[0]}. Hur kan väljarna lita på er?`, interview: true, scandal: true, options: [
    { type: 'kompromiss', label: 'Ta ansvar', text: 'Jag tar fullt ansvar. Vi har gjort fel, vi har rättat till det, och vi går vidare med lärdomen.' },
    { type: 'angrepp', label: 'Angrip medierna', text: 'Det här är en drevkampanj. Ni borde granska de riktiga problemen i Sverige.' },
    { type: 'undvik', label: 'Byt ämne', text: 'Jag förstår frågan, men det svenska folket bryr sig mer om…' },
  ] });
  else if (rec) rounds.push({ issue: BILL_AREA[rec.billId]?.area || 'ekonomi', statement: `Ni röstade ${rec.vote} om "${rec.title}". Förklara för tittarna varför.`, interview: true, options: [
    { type: 'fakta', label: 'Förklara sakligt', text: `Därför att ${rec.vote === 'ja' ? 'förslaget stämde med vår politik' : 'förslaget var ofinansierat och slog mot vanligt folk'}. Vi står för det.` },
    { type: 'kansla', label: 'Med patos', text: pick(rnd, KANSLA) },
    { type: 'undvik', label: 'Undvik', text: 'Den omröstningen var komplicerad. Låt oss prata om framtiden.' },
  ] });
  else rounds.push({ issue: 'varderingar', statement: `Sista frågan: varför ska någon rösta på just ${mine.name}?`, interview: true, options: [
    { type: 'kansla', label: 'Från hjärtat', text: pick(rnd, KANSLA) },
    { type: 'fakta', label: 'Programmet', text: `Därför att vi har ett konkret program: ${ISSUES.filter((i) => (mine.profile?.[i.id] || 1) > 1.1).slice(0, 3).map((i) => i.name.toLowerCase()).join(', ') || 'ett bättre Sverige'}.` },
    { type: 'angrepp', label: 'Mot de andra', text: pick(rnd, ANGREPP) },
  ] });
  return rounds;
}

// Spelaren väljer ett alternativ i en runda. Returnerar utfallet (text, delta, uttryck).
export function resolveOption(state, rnd, debate, roundIdx, optIdx) {
  G = rnd;
  const r = debate.rounds[roundIdx]; const o = r.options[optIdx];
  const mine = me(state); const l = state.people[mine.leader];
  const t = l.traits;
  const sal = state.opinion.salience[r.issue] || 1;
  const credFit = (mine.profile?.[r.issue] || 1) > 1.1 ? .1 : 0; // profilfråga
  let p, win, lose;
  switch (o.type) {
    case 'fakta': p = .35 + (t.intelligens - 45) / 120 + (mine.credibility - 50) / 250 + credFit; win = 14; lose = -6; break;
    case 'kansla': p = .35 + (t.karisma - 45) / 110 + credFit; win = 15; lose = -8; break;
    case 'angrepp': p = .3 + (t.retorik - 45) / 130 + (t.aggressivitet - 45) / 200; win = 20; lose = -14; break;
    case 'kompromiss': p = .5 + (t.lugn - 45) / 150 + (t.social - 45) / 250; win = 8; lose = -3; break;
    case 'undvik': p = .25 + (t.retorik - 45) / 200; win = 4; lose = -12; break;
    case 'invandning': p = .55 + (t.retorik - 45) / 110 + (t.intelligens - 45) / 200; win = 32; lose = -10; break;
  }
  if (r.gotcha) { if (o.gotchaOk) { p = .5 + (t.intelligens - 45) / 80; win = 12; lose = -10; } else if (o.type === 'undvik') { p = .15; win = 2; lose = -14; } }
  if (r.scandal && o.type === 'angrepp') { p -= .15; lose -= 6; }
  if (debate.kind === 'riksdag') p += (t.erfarenhet - 45) / 300;
  p = clamp(p, .05, .95);
  const ok = rnd() < p;
  const delta = (ok ? win : lose) * (1 + (sal - 1) * .3);
  debate.meter = clamp(debate.meter + delta, -100, 100);
  r.resolved = true; r.choice = optIdx; r.ok = ok; r.delta = delta;
  const op = debate.opponentParty ? state.parties[debate.opponentParty] : null;
  let reply;
  if (debate.kind === 'interview') reply = ok ? pick(rnd, ['Tack, det var ett tydligt svar.', 'Okej. Vi går vidare.', 'Intressant. Nästa fråga.']) : pick(rnd, ['Det var inget svar på min fråga.', 'Tittarna hör nog att du undviker frågan.', 'Jag tolkar det som att du inte vet.']);
  else reply = ok ? (o.type === 'invandning' ? pick(rnd, ['…Det… det var ett annat läge då.', 'Du rycker det ur sitt sammanhang!', 'Jag… vi har omprövat den frågan.']) : pick(rnd, ['Det är inte så enkelt som du låter påskina.', 'Jag känner inte igen den beskrivningen.', 'Vi kan väl vara överens om att det är komplicerat.'])) : pick(rnd, ['Där hör ni – inga svar, bara ord.', `Det här är typiskt ${mine.abbr}. Mycket snack.`, 'Du har uppenbarligen inte läst siffrorna.', 'Publiken förtjänar bättre än det där.']);
  const narration = ok ? pick(rnd, REACT_WIN) : pick(rnd, REACT_LOSE);
  return { ok, delta, reply, narration, myExpr: ok ? (o.type === 'invandning' ? 'objection' : o.type === 'angrepp' ? 'angry' : 'confident') : 'nervous', myPose: o.type === 'invandning' ? 'point' : o.type === 'angrepp' ? 'slam' : o.type === 'fakta' ? 'open' : o.type === 'kompromiss' ? 'think' : 'stand', opExpr: ok ? (o.type === 'invandning' ? 'shocked' : 'nervous') : 'smug', opPose: ok ? 'stand' : 'cross', evidence: o.evidence || null };
}

// Debatten är slut: effekter på opinion, ledare, nyheter
export function finishDebate(state, rnd, debate) {
  const mine = me(state); const l = state.people[mine.leader];
  const m = debate.meter;
  const verdict = m > 25 ? 'vann' : m < -25 ? 'förlorade' : 'oavgjort';
  const op = debate.opponentParty ? state.parties[debate.opponentParty] : null;
  const scale = (debate.campaign ? 1.6 : 1) * (debate.kind === 'interview' ? .6 : 1);
  l.debateBonus = (l.debateBonus || 0) + (m / 100) * 8 * scale;
  mine.attention = clamp(mine.attention + 6 + Math.abs(m) / 10, 0, 100);
  const aw = state.opinion.awareness[mine.id] ?? 1; if (aw < 1) state.opinion.awareness[mine.id] = clamp(aw + .03 + Math.max(0, m) / 500, 0, 1);
  mine.credibility = clamp(mine.credibility + (m / 100) * 3, 0, 100);
  // opinionen: grupper som bryr sig om debattens frågor rör sig
  const issues = debate.rounds.map((r) => r.issue);
  for (const sg of SEGMENTS) {
    const seg = state.opinion.seg[sg.id]; if (!seg) continue;
    const care = issues.reduce((a, i) => a + (sg.w[i] || 1), 0) / issues.length;
    const swing = (m / 100) * .9 * care * sg.leader * scale;
    seg[mine.id] = Math.max(.01, (seg[mine.id] || .1) + swing);
    if (op && seg[op.id] != null) seg[op.id] = Math.max(.01, seg[op.id] - swing * .6);
  }
  if (op) { op.attention = clamp(op.attention + 3, 0, 100); const ol = state.people[op.leader]; ol.debateBonus = (ol.debateBonus || 0) - (m / 100) * 4 * scale; }
  if (verdict === 'vann') state.stats.debatesWon++;
  const outlet = debate.host === 'riksdag' ? 'svt' : debate.host in MEDIA ? debate.host : 'svt';
  const h = debate.kind === 'interview' ? (verdict === 'vann' ? `${l.name} stod pall i tuff utfrågning` : verdict === 'förlorade' ? `${l.name} i blåsväder efter utfrågning: "Kunde inte svara"` : `Jämn utfrågning av ${l.name}`) : verdict === 'vann' ? `${l.name} vann ${debate.name.toLowerCase()} – ${op?.abbr} pressad` : verdict === 'förlorade' ? `${state.people[op.leader].name} (${op.abbr}) dominerade ${debate.name.toLowerCase()}` : `Oavgjort i ${debate.name.toLowerCase()}`;
  const inv = debate.rounds.filter((r) => r.options[r.choice]?.type === 'invandning' && r.ok).length;
  addNews(state, { outlet, headline: h, body: `${inv ? `Kvällens ögonblick: ${l.name} avslöjade en motsägelse i ${op?.abbr}:s politik – "${pick(rnd, ['Ni röstade ju tvärtom!', 'Hur går det ihop?'])}". ` : ''}${verdict === 'vann' ? `"${pick(rnd, ['Bästa insatsen på länge', 'Ett genombrott', 'Skarp och påläst'])}", säger kommentatorerna.` : verdict === 'förlorade' ? `${pick(rnd, ['Osäker', 'Svävande', 'Illa förberedd'])} – så beskrivs insatsen.` : 'Ingen av deltagarna lyckades sticka ut.'}`, tags: ['debatt'], partyId: mine.id, importance: debate.campaign ? 3 : 2, tone: verdict === 'vann' ? 1 : verdict === 'förlorade' ? -1 : 0 });
  debate.done = true; debate.result = verdict;
  return { verdict, meter: m, inv };
}
