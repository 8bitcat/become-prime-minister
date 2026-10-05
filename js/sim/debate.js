// Debatter, intervjuer, utfrågningar och poddar – innehållet. Presentationen ligger i scene/debate.js.
// En debatt = rundor. Varje runda: motståndarens påstående → dina alternativ → utfall → mätaren rör sig.
import { ISSUES, ISSUE_BY_ID } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { MEDIA } from '../data/names.js';
import { STAT_BY_ID } from '../data/stats.js';
import { VOICES, BODY_LANGUAGE } from '../data/persona.js';
import { clamp, pick, fmt, weighted } from '../core/util.js';
import { activeParties, authenticity } from './opinion.js';
import { addNews } from './news.js';
import { makePerson } from './people.js';
import { pickJournalist, adjustJournalist } from './media.js';
import { BILLS } from './riksdag.js';
import { recordStatement, factCheck } from '../ai/memory.js';
import { blankMood, moodDelta, applyMoodTo, moodEffects, moodReply, moodLabel, moodExpr, audienceOnMood, recordGrudge, grudgeOf, decayMood, OUTBURST, BREAKDOWN, CONCESSION } from './emotion.js';

const me = (s) => s.parties[s.player.partyId];
const BILL_AREA = Object.fromEntries(BILLS.map((b) => [b.id, b]));

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
const KANSLA_PERSONAL = { student: 'Jag pluggade med studielån och visste exakt vad en liter mjölk kostade. Det har jag inte glömt.', lantbrukare: 'Jag har stått i ladugården klockan fem. Jag vet vad det kostar att hålla ett land vid liv.', sjukskoterska: 'Jag har jobbat nattpass på akuten. Fråga mig inte om vårdköer – fråga mig vad de gör med människor.', polis: 'Jag har knackat på dörren hos föräldrar vars barn skjutits. Det är inte statistik för mig.', larare: 'Jag har haft 32 elever i klassrummet. Jag vet vad som händer när resurserna inte räcker.', officer: 'Jag har tjänstgjort. Jag vet vad beredskap betyder när det inte längre är en budgetpost.', industri: 'Jag har stått vid bandet när varslet kom. Så jag vet hur det känns.', fack: 'Jag har förhandlat för folk som inte hade någon annan som talade för dem.' };
const ANGREPP = ['Ni har haft chansen i åratal. Vad har ni gjort? Ingenting!', 'Det där är helt enkelt inte sant, och det vet du.', 'Du kan inte ens svara på en enkel fråga. Hur ska väljarna kunna lita på dig?'];
const KOMPROMISS = ['Jag tror vi är överens om målet, även om vi ser olika på vägen dit. Låt oss hitta en lösning.', 'Det finns kloka tankar i det du säger. Men jag vill lägga till en sak.', 'Jag förstår oron. Därför föreslår vi ett steg i taget, med utvärdering.'];
const HUMOR = ['Det där lät nästan som ett förslag. Nästan. Kan vi få se det på papper också?', 'Jag hörde att ni hade en plan. Jag hörde det 2018 också.', 'Om löften vore valuta skulle ni ha betalt av statsskulden vid det här laget.'];
const REACT_WIN = ['Publiken applåderar.', 'Motståndaren tappar tråden.', 'Moderatorn höjer på ögonbrynen.', 'Det blir tyst i studion.'];
const REACT_LOSE = ['Motståndaren ler.', 'Publiken mumlar.', 'Argumentet faller platt.', 'Moderatorn går vidare.'];
let G = Math.random;

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
function pickOpponent(state, rnd) {
  const mine = me(state);
  const others = activeParties(state).filter((p) => !p.isPlayer && p.inRiksdag);
  const gov = state.government;
  if (gov.pm && gov.pm !== state.player.leaderId && rnd() < .5) return state.parties[gov.pmParty];
  return weighted(rnd, others, (p) => (state.riksdag.seats[p.id] || 1) * (1 + Math.abs(p.relations?.[mine.id] || 0) / 50) * (1 + p.attention / 50));
}
const hasTrait = (l, id) => (l.persona?.personality || []).includes(id);

export function buildDebate(state, rnd, { kind = 'tv', host = null, campaign = false, name = null, issue = null, influencer = null } = {}) {
  G = rnd;
  const mine = me(state), leader = state.people[mine.leader];
  const d = { kind, host: host || (kind === 'riksdag' ? 'riksdag' : pick(rnd, ['svt', 'tv4', 'aftonbladet'])), campaign, name: name || (kind === 'riksdag' ? 'Partiledardebatt i riksdagen' : kind === 'interview' ? 'Utfrågning' : 'TV-debatt'), rounds: [], meter: 0, log: [], done: false, result: null, journalistId: null, influencerId: null };
  if (influencer && state.influencers?.[influencer]) {
    const inf = state.influencers[influencer];
    const host2 = makePerson(rnd, { age: 28 + Math.floor(rnd() * 20), role: 'journalist' }); host2.name = inf.name; host2.look.outfit = pick(rnd, ['hoodie', 'tshirt', 'kavaj_tshirt', 'stickad']);
    d.kind = 'podd'; d.opponent = host2; d.opponentParty = null; d.influencerId = inf.id; d.host = 'flashback'; d.name = `${inf.name} – ${inf.platform === 'podd' ? 'podden' : 'kanalen'}`;
    d.rounds = buildPoddRounds(state, rnd, inf);
  } else if (kind === 'interview') {
    const j = pickJournalist(state, rnd, issue);
    const jp = j ? state.people[j.personId] : makePerson(rnd, { age: 40, role: 'journalist' });
    d.opponent = jp; d.opponentParty = null; d.journalistId = j?.id || null; d.host = j?.outlet || 'svt'; d.name = `${MEDIA[d.host]?.name || 'Studion'} – utfrågning`;
    d.rounds = buildInterviewRounds(state, rnd, j, issue);
  } else {
    const op = pickOpponent(state, rnd);
    d.opponentParty = op.id; d.opponent = state.people[op.leader];
    const n = kind === 'riksdag' ? 3 : 4;
    const issues = [...ISSUES].sort((a, b) => (state.opinion.salience[b.id] * (1 + (op.profile?.[b.id] || 1) * .2)) - (state.opinion.salience[a.id] * (1 + (op.profile?.[a.id] || 1) * .2))).slice(0, 6);
    const chosen = []; for (let i = 0; i < n; i++) { const is = issues.splice(Math.floor(rnd() * Math.min(3, issues.length)), 1)[0]; chosen.push(is.id); }
    for (const isId of chosen) d.rounds.push(buildRound(state, rnd, op, isId));
  }
  // känsloläget hos den du möter: tidigare agg mot dig följer med in i studion
  const g = grudgeOf(d.opponent, state.player.leaderId);
  d.mood = { ...blankMood(), ...(d.opponent?.mood || {}) };
  d.mood.anger = clamp(d.mood.anger + Math.max(0, g) * .5, 0, 80); d.mood.joy = clamp(d.mood.joy + Math.max(0, -g) * .4, 0, 60);
  d.moodEvents = []; d.pBonus = 0; d.gaffeBoost = 0;
  state.stats.debates++;
  return d;
}
// En felaktig siffra i motståndarens påstående – och en INVÄNDNING! att avslöja den med
export function addGaffe(state, rnd, r, opLeader) {
  if (r.gaffe || !PHRASES[r.issue]) return null;
  const id = pick(rnd, PHRASES[r.issue].stat); const st = STAT_BY_ID[id]; const actual = state.sweden.stats[id];
  if (!st || !Number.isFinite(actual) || actual === 0) return null;
  const wrong = +(actual * (rnd() < .5 ? 1.6 + rnd() * .8 : .35 + rnd() * .3)).toFixed(st.d);
  r.gaffe = { stat: id, name: st.name, wrong, actual, unit: st.unit };
  r.statement += ` ${pick(rnd, ['Siffrorna talar sitt tydliga språk:', 'Och det vet alla:', 'Fakta är att'])} ${st.name.toLowerCase()} ligger på ${fmt(wrong, st.d)} ${st.unit}.`;
  r.options.push({ type: 'invandning', label: 'INVÄNDNING!', text: `Det stämmer inte. ${st.name} är ${fmt(actual, st.d)} ${st.unit} – inte ${fmt(wrong, st.d)}. Du har fel siffror, och hela ditt resonemang faller.`, evidence: `${st.name}: ${fmt(actual, st.d)} ${st.unit} enligt officiell statistik.`, gaffe: true });
  return r.gaffe;
}
// Känslorna efter en runda: hur det du sa landade hos motparten, vad publiken tycker om det, och
// hur det färgar repliken. Returnerar { eff, aud, reply }.
function moodRound(state, rnd, debate, a, { ok, caught, interrupt }, reply) {
  const opPerson = debate.opponent ? (state.people[debate.opponent.id] || debate.opponent) : null;
  const d = moodDelta(a, { ok, caught, interrupt });
  applyMoodTo(debate.mood, d, opPerson?.traits || {});
  const eff = moodEffects(debate.mood, rnd);
  const aud = audienceOnMood(debate.mood, a, eff);
  if (aud.delta) debate.meter = clamp(debate.meter + aud.delta, -100, 100);
  debate.gaffeBoost = eff.gaffe; debate.pBonus = eff.pMod;
  if (eff.outburst || eff.breakdown || eff.concede) debate.moodEvents.push({ outburst: eff.outburst, breakdown: eff.breakdown, concede: eff.concede, label: eff.label.label });
  let out = reply;
  if (eff.outburst) out = pick(rnd, OUTBURST); else if (eff.breakdown) out = pick(rnd, BREAKDOWN); else if (eff.concede) out = pick(rnd, CONCESSION); else out = moodReply(rnd, debate.mood, reply);
  const label = moodLabel(debate.mood);
  const ex = label.level >= 2 ? moodExpr(debate.mood) : null;
  return { eff, aud, reply: out, mood: label, opExpr: ex?.expr, opPose: ex?.pose };
}
function baseOptions(state, rnd, issue) {
  const leader = state.people[me(state).leader];
  const st = statLine(state, issue);
  const options = [
    { type: 'fakta', label: 'Fakta', text: st.text, stat: st.id },
    { type: 'kansla', label: 'Känsla', text: KANSLA_PERSONAL[leader.persona?.profession] && rnd() < .6 ? KANSLA_PERSONAL[leader.persona.profession] : pick(rnd, KANSLA) },
    { type: 'angrepp', label: 'Motangrepp', text: pick(rnd, ANGREPP) },
    { type: 'kompromiss', label: 'Lugn & kompromiss', text: pick(rnd, KOMPROMISS) },
  ];
  if (hasTrait(leader, 'humoristisk')) options.push({ type: 'humor', label: 'Humor', text: pick(rnd, HUMOR) });
  return options;
}
function buildRound(state, rnd, op, issue) {
  const is = ISSUE_BY_ID[issue]; const mine = me(state);
  const side = sideOf(op, issue);
  const statement = pick(rnd, PHRASES[issue][side]).replace('{parti}', mine.abbr);
  const options = baseOptions(state, rnd, issue);
  const rec = (state.riksdag.record[op.id] || []).filter((r) => { const b = BILL_AREA[r.billId]; return b && b.area === issue; });
  const contra = rec.find((r) => { const b = BILL_AREA[r.billId]; const dir = Object.values(b.vec)[0] > 0 ? 'R' : 'L'; return (r.vote === 'ja' && dir !== side) || (r.vote === 'nej' && dir === side); });
  const flip = op.posStart && Math.abs((op.posStart[issue] || 0) - op.pos[issue]) > 30;
  if (contra) options.push({ type: 'invandning', label: 'INVÄNDNING!', text: `Vänta nu. ${contra.vote === 'ja' ? 'Förslaget' : 'Motionen'} "${contra.title}" – ni röstade ${contra.vote.toUpperCase()}. Hur går det ihop med det du just sa?`, evidence: `Riksdagens protokoll: ${op.abbr} röstade ${contra.vote} om "${contra.title}".` });
  else if (flip) options.push({ type: 'invandning', label: 'INVÄNDNING!', text: `För bara några år sedan stod ${op.abbr} för raka motsatsen. Vad hände – bytte ni åsikt eller bytte ni väljare?`, evidence: `${op.name}s partiprogram har flyttat sig kraftigt i frågan om ${is.name.toLowerCase()}.` });
  const round = { issue, statement, options, opExpr: side === 'R' ? 'determined' : 'confident', resolved: false, gaffe: null };
  // AI-politiker kan också klanta sig: en felaktig siffra som går att avslöja
  const ol = state.people[op.leader];
  if (!contra && !flip && rnd() < .14 + (50 - (ol?.traits.intelligens ?? 50)) / 400) addGaffe(state, rnd, round, ol);
  return round;
}

// Fritt svar: spelaren skrev själv. Analysen (ai/analyze.js eller Claude) avgör utfallet.
const WINLOSE = { saklig: [14, -6], kansla: [15, -8], aggressiv: [20, -14], humor: [16, -12], kampande: [14, -8], undvikande: [4, -12], dryg: [10, -14] };
export function resolveFree(state, rnd, debate, roundIdx, text, a) {
  G = rnd;
  const r = debate.rounds[roundIdx];
  const mine = me(state); const l = state.people[mine.leader];
  const t = l.traits; const pe = l.persona || {};
  const sal = state.opinion.salience[r.issue] || 1;
  const voice = VOICES.find((v) => v.id === pe.voice) || {};
  const body = BODY_LANGUAGE.find((b) => b.id === pe.bodyLanguage) || {};
  const kind = debate.kind === 'podd' ? 'podd' : debate.kind === 'interview' ? 'interview' : debate.kind === 'riksdag' ? 'riksdag' : 'debate';
  const rec = recordStatement(state, text, kind, { question: r.statement, questionIssue: r.issue, analysis: a });
  if (!r.podd) factCheck(state, rec.statement);
  const dom = a.dominant;
  const nWords = a.length || text.split(/\s+/).filter(Boolean).length;
  let p = .3 + a.clarity * .25 + ((r.interview || r.podd) ? (a.answers - .5) * .4 : 0);
  p += a.issues?.[r.issue] ? .1 : Object.keys(a.issues || {}).length ? -.08 : -.04;
  const credFit = (mine.profile?.[r.issue] || 1) > 1.1 ? .08 : 0;
  switch (dom) {
    case 'saklig': p += (t.intelligens - 45) / 150 + (mine.credibility - 50) / 300 + (l.cred?.[r.issue] || 0) / 100 * .5 + credFit; break;
    case 'kansla': p += (t.karisma - 45) / 120 + (hasTrait(l, 'empatisk') ? .08 : 0) + (voice.kansla || 0) / 100 + (hasTrait(l, 'kall') ? -.08 : 0) + credFit; break;
    case 'aggressiv': p += (t.retorik - 45) / 130 + (t.aggressivitet - 45) / 250 + (voice.angrepp || 0) / 100 - (r.interview || r.podd ? .12 : 0) - (r.scandal ? .15 : 0); break;
    case 'humor': p += (t.karisma - 45) / 120 + (t.social - 45) / 200 + (debate.kind === 'podd' ? .15 : debate.kind === 'riksdag' ? -.12 : 0) + (hasTrait(l, 'humoristisk') ? .08 : -.05); break;
    case 'kampande': p += (t.retorik - 45) / 120 + (t.karisma - 45) / 200 + credFit; break;
    case 'undvikande': p += -.15 + (t.retorik - 45) / 250 - (r.gotcha ? .1 : 0); break;
    case 'dryg': p += -.08 + (t.intelligens - 45) / 200 - (r.interview || r.podd ? .1 : 0); break;
  }
  p += debate.pBonus || 0; // en upprörd eller nervös motståndare är lättare att slå
  if ((a.emotion?.insult || 0) > .3 && (r.interview || r.podd)) p -= .15; // att förolämpa journalisten går sällan hem
  if ((a.emotion?.praise || 0) > .4 && !(r.interview || r.podd)) p -= .05; // beröm vinner inga poäng – men gör motståndaren mjuk
  const okClaims = (a.claims || []).filter((c) => c.ok === true).length, wrongClaims = (a.claims || []).filter((c) => c.ok === false).length;
  p += okClaims * .08 - wrongClaims * .25;
  const caught = !!(r.gaffe && !r.resolved && ((a.claims || []).some((c) => c.stat === r.gaffe.stat && c.ok) || (/stämmer inte|fel siffr|inte sant|felaktig|faktiskt är|i själva verket|är fel/.test(text.toLowerCase()) && text.toLowerCase().includes(r.gaffe.name.toLowerCase().slice(0, 6)))));
  if (caught) p += .3;
  p -= Math.min(2, rec.contradictions.length) * .12;
  if (a.promises?.length) p += .03;
  if (nWords < 6) p -= .15; else if (nWords > 140) p -= .08;
  if (debate.kind === 'riksdag') p += (t.erfarenhet - 45) / 300 + (voice.riksdag || 0) / 100;
  if (debate.kind === 'interview' || debate.kind === 'podd') { p += (voice.folk || 0) / 100 * (debate.kind === 'podd' ? 1 : .5); const auth = authenticity(l); if (auth < .5) p -= (0.5 - auth) * .2; }
  p += (body.debate || 0) / 100 - (l.fatigue || 0) / 400;
  if (r.interrupt) p += .05;
  p = clamp(p, .05, .95);
  const ok = rnd() < p;
  let [win, lose] = WINLOSE[dom] || WINLOSE.saklig;
  if (caught) win = 30; if (wrongClaims) lose -= 6; if (r.gotcha && okClaims) win += 4;
  if (r.interrupt) { win *= .5; lose *= .5; }
  const delta = (ok ? win : lose) * (1 + (sal - 1) * .3);
  debate.meter = clamp(debate.meter + delta, -100, 100);
  r.resolved = true; r.choice = null; r.type = caught ? 'invandning' : dom; r.free = text; r.ok = ok; r.delta = delta; r.analysis = { dominant: dom, clarity: a.clarity, answers: a.answers, risky: a.risky, promises: (a.promises || []).length, wrongClaims, contradictions: rec.contradictions.length };
  let reply;
  if (debate.kind === 'podd') reply = ok ? pick(rnd, ['Haha, älskar det. Lyssnare, hörde ni?', 'Bra svar. Det där klipper vi.', 'Okej, det köper jag.']) : pick(rnd, ['Mm. Det lät lite som en pressrelease.', 'Du låter som alla andra politiker nu.', 'Mina lyssnare kommer inte gilla det där.']);
  else if (debate.kind === 'interview') reply = ok ? pick(rnd, ['Tack, det var ett tydligt svar.', 'Okej. Vi går vidare.', 'Intressant. Nästa fråga.']) : pick(rnd, ['Det var inget svar på min fråga.', 'Tittarna hör nog att du undviker frågan.', 'Jag tolkar det som att du inte vet.']);
  else reply = ok ? (caught ? pick(rnd, ['…Det… jag hade en annan siffra framför mig.', 'Du rycker siffran ur sitt sammanhang!', 'Vi… vi får återkomma om exakta tal.']) : dom === 'humor' ? pick(rnd, ['Mycket roligt. Men svara på frågan.', 'Publiken skrattar – jag gör det inte.']) : pick(rnd, ['Det är inte så enkelt som du låter påskina.', 'Jag känner inte igen den beskrivningen.', 'Vi kan väl vara överens om att det är komplicerat.'])) : pick(rnd, ['Där hör ni – inga svar, bara ord.', `Det här är typiskt ${mine.abbr}. Mycket snack.`, 'Du har uppenbarligen inte läst siffrorna.', 'Publiken förtjänar bättre än det där.']);
  if (rec.contradictions.length && !ok) reply = pick(rnd, ['Det där är inte vad ni sa för ett tag sedan. Vilken linje gäller?', 'Ni byter fot i den här frågan varje gång det blåser.', 'Väljarna hör att ni säger en sak i dag och en annan i morgon.']);
  if (wrongClaims && !ok && debate.kind !== 'podd') { const c = a.claims.find((x) => x.ok === false); reply = `Nej. ${c.name} är ${fmt(c.actual, STAT_BY_ID[c.stat]?.d ?? 1)}, inte ${fmt(c.value)}. Om ni inte kan siffrorna, hur ska ni styra landet?`; }
  const mr = moodRound(state, rnd, debate, a, { ok, caught, interrupt: !!r.interrupt }, reply);
  reply = mr.reply;
  const narration = ok ? pick(rnd, REACT_WIN) : pick(rnd, REACT_LOSE);
  const poses = body.poses || ['stand', 'open'];
  const myPose = caught ? 'point' : dom === 'aggressiv' ? 'slam' : dom === 'saklig' ? (poses.includes('open') ? 'open' : 'stand') : dom === 'undvikande' ? 'think' : dom === 'humor' ? 'hips' : dom === 'kampande' ? 'point' : dom === 'dryg' ? 'hips' : poses[0];
  const followUp = (r.interview || r.podd) && !r.followed && !r.interrupt && (a.answers < .4 || wrongClaims > 0 || (a.promises?.length > 0 && rnd() < .5) || (debate.mood.anger > 45 && rnd() < .5));
  const interrupt = !r.interview && !r.podd && !r.interrupt && !r.followed && !mr.eff.outburst && !mr.eff.breakdown && ((!ok && rnd() < .25 + ((state.people[debate.opponentParty ? state.parties[debate.opponentParty].leader : ''] || {}).traits?.aggressivitet - 45 || 0) / 200) || (debate.mood.anger > 55 && rnd() < .35));
  return { ok, delta, reply, narration, myExpr: ok ? (caught ? 'objection' : dom === 'aggressiv' ? 'angry' : dom === 'humor' ? 'happy' : 'confident') : 'nervous', myPose, opExpr: mr.opExpr || (ok ? (caught ? 'shocked' : 'nervous') : 'smug'), opPose: mr.opPose || (ok ? 'stand' : 'cross'), evidence: caught ? `${r.gaffe.name}: ${fmt(r.gaffe.actual, STAT_BY_ID[r.gaffe.stat]?.d ?? 1)} ${r.gaffe.unit} – inte ${fmt(r.gaffe.wrong, STAT_BY_ID[r.gaffe.stat]?.d ?? 1)}.` : null, caught, followUp, interrupt, contradictions: rec.contradictions, wrongClaims, analysis: a, mood: mr.mood, moodNote: mr.aud.note, audienceDelta: mr.aud.delta, moodEff: mr.eff };
}
function buildInterviewRounds(state, rnd, j, issue) {
  const mine = me(state); const leader = state.people[mine.leader];
  const rounds = [];
  const hostile = (j?.rel ?? 0) < -25, friendly = (j?.rel ?? 0) > 25;
  const hot = issue || (j?.beat && ISSUE_BY_ID[j.beat] ? j.beat : [...ISSUES].sort((a, b) => state.opinion.salience[b.id] - state.opinion.salience[a.id])[0].id);
  const is = ISSUE_BY_ID[hot];
  const q1 = `${friendly ? 'Trevligt att ha dig här. ' : hostile ? 'Vi har mycket att reda ut. ' : ''}${pick(rnd, ['Låt oss börja med', 'Först:', 'Många väljare undrar:'])} ${is.name.toLowerCase()}. Ert parti vill ${(mine.pos[hot] || 0) < 0 ? is.left.toLowerCase() : is.right.toLowerCase()}. Hur ska det betalas?`;
  rounds.push({ issue: hot, statement: q1, interview: true, options: [...baseOptions(state, rnd, hot).filter((o) => o.type !== 'angrepp'), { type: 'undvik', label: 'Undvik frågan', text: 'Det viktiga är inte exakt hur, utan att vi gör det. Låt mig i stället berätta om…' }] });
  const got = pick(rnd, [
    { q: 'Vad kostar ett paket mjölk i dag?', a: `Ungefär ${fmt(14 + state.sweden.stats.inflation * .8, 0)} kronor för en liter.`, bad: 'Eh… det beror på var man handlar… tio kronor?' },
    { q: 'Hur stor är statsskulden i andel av BNP?', a: `Runt ${fmt(state.sweden.stats.statsskuld_bnp, 0)} procent – lågt i ett europeiskt perspektiv.`, bad: 'Alldeles för hög. Flera tusen miljarder.' },
    { q: 'Hur många skjutningar hade Sverige förra året?', a: `Drygt ${fmt(state.sweden.stats.skjutningar, 0)}. Varje enskild är en för mycket.`, bad: 'Många. Alldeles för många. Jag har inte siffran framför mig.' },
    { q: 'Vad är Riksbankens styrränta just nu?', a: `${fmt(state.sweden.stats.styrranta, 2)} procent.`, bad: 'Runt fyra, fem procent? Den ändras ju hela tiden.' },
  ]);
  if (!friendly || rnd() < .5) rounds.push({ issue: 'ekonomi', statement: got.q, interview: true, gotcha: true, options: [
    { type: 'fakta', label: 'Svara exakt', text: got.a, gotchaOk: true },
    { type: 'undvik', label: 'Glid undan', text: got.bad },
    { type: 'angrepp', label: 'Avfärda frågan', text: 'Är det här verkligen vad era tittare vill veta? Jag är här för att prata politik.' },
    ...(hasTrait(leader, 'humoristisk') ? [{ type: 'humor', label: 'Skämta bort', text: 'Jag kan priset på en kaffe på riksdagens kafé. Det är skandalöst nog.' }] : []),
  ] });
  const sc = (state.scandals || []).find((x) => x.active && x.partyId === mine.id);
  const rec = (state.riksdag.record[mine.id] || []).slice(-1)[0];
  const memo = j?.memory?.[0];
  if (sc) rounds.push({ issue: 'varderingar', statement: `Vi måste prata om ${sc.title.toLowerCase()}en. ${sc.text.split('.')[0]}. Hur kan väljarna lita på er?`, interview: true, scandal: true, options: [
    { type: 'kompromiss', label: 'Ta ansvar', text: 'Jag tar fullt ansvar. Vi har gjort fel, vi har rättat till det, och vi går vidare med lärdomen.' },
    { type: 'angrepp', label: 'Angrip medierna', text: 'Det här är en drevkampanj. Ni borde granska de riktiga problemen i Sverige.' },
    { type: 'undvik', label: 'Byt ämne', text: 'Jag förstår frågan, men det svenska folket bryr sig mer om…' },
  ] });
  else if (hostile && memo) rounds.push({ issue: 'varderingar', statement: `Jag har följt er länge. ${memo.memo} Har ni ändrat er?`, interview: true, options: [
    { type: 'fakta', label: 'Förklara', text: 'Det var då. Vi har lärt oss, och vi står för det vi gör i dag.' },
    { type: 'angrepp', label: 'Avfärda', text: 'Du gräver i gamla saker för att du inte har något nytt.' },
    { type: 'kompromiss', label: 'Erkänn', text: 'Du har rätt i att vi kunde ha gjort bättre. Det är därför vi ändrat kurs.' },
  ] });
  else if (rec) rounds.push({ issue: BILL_AREA[rec.billId]?.area || 'ekonomi', statement: `Ni röstade ${rec.vote} om "${rec.title}". Förklara för tittarna varför.`, interview: true, options: [
    { type: 'fakta', label: 'Förklara sakligt', text: `Därför att ${rec.vote === 'ja' ? 'förslaget stämde med vår politik' : 'förslaget var ofinansierat och slog mot vanligt folk'}. Vi står för det.` },
    { type: 'kansla', label: 'Med patos', text: pick(rnd, KANSLA) },
    { type: 'undvik', label: 'Undvik', text: 'Den omröstningen var komplicerad. Låt oss prata om framtiden.' },
  ] });
  else rounds.push({ issue: 'varderingar', statement: `Sista frågan: varför ska någon rösta på just ${mine.name}?`, interview: true, options: [
    { type: 'kansla', label: 'Från hjärtat', text: KANSLA_PERSONAL[leader.persona?.profession] || pick(rnd, KANSLA) },
    { type: 'fakta', label: 'Programmet', text: `Därför att vi har ett konkret program: ${ISSUES.filter((i) => (mine.profile?.[i.id] || 1) > 1.1).slice(0, 3).map((i) => i.name.toLowerCase()).join(', ') || 'ett bättre Sverige'}.` },
    { type: 'angrepp', label: 'Mot de andra', text: pick(rnd, ANGREPP) },
  ] });
  return rounds;
}
function buildPoddRounds(state, rnd, inf) {
  const mine = me(state); const leader = state.people[mine.leader];
  const issues = Object.keys(inf.lean).filter((k) => ISSUE_BY_ID[k]);
  const rounds = [];
  rounds.push({ issue: 'varderingar', statement: `Välkommen! Mina lyssnare vill veta vem du är. Vad gör du en vanlig söndag?`, interview: true, podd: true, options: [
    { type: 'kansla', label: 'Personligt', text: `${leader.persona?.children ? 'Barnen' : 'Hunden'} och ${pick(rnd, ['en lång promenad', 'söndagsmiddag med familjen', 'en runda i skogen', 'fotboll på TV'])}. Och så läser jag ikapp allt jag missat under veckan.` },
    { type: 'humor', label: 'Skämta', text: 'Jag svarar på mejl från folk som är arga på mig. Det är min hobby.' },
    { type: 'fakta', label: 'Politiken', text: 'Jag förbereder veckan. Politik tar aldrig ledigt.' },
  ] });
  for (const isId of issues.slice(0, 2)) { const is = ISSUE_BY_ID[isId]; const side = inf.lean[isId] < 0 ? 'L' : 'R'; rounds.push({ issue: isId, statement: `Mina lyssnare bryr sig mycket om ${is.name.toLowerCase()}. ${pick(rnd, PHRASES[isId][side]).replace('{parti}', 'många partier')} Vad säger du?`, interview: true, podd: true, options: baseOptions(state, rnd, isId).filter((o) => o.type !== 'angrepp') }); }
  return rounds;
}

export function resolveOption(state, rnd, debate, roundIdx, optIdx) {
  G = rnd;
  const r = debate.rounds[roundIdx]; const o = r.options[optIdx];
  const mine = me(state); const l = state.people[mine.leader];
  const t = l.traits; const pe = l.persona || {};
  const sal = state.opinion.salience[r.issue] || 1;
  const credFit = (mine.profile?.[r.issue] || 1) > 1.1 ? .1 : 0;
  const voice = VOICES.find((v) => v.id === pe.voice) || {};
  const body = BODY_LANGUAGE.find((b) => b.id === pe.bodyLanguage) || {};
  let p, win, lose;
  switch (o.type) {
    case 'fakta': p = .35 + (t.intelligens - 45) / 120 + (mine.credibility - 50) / 250 + credFit + (l.cred?.[r.issue] || 0) / 100 * .6 + (hasTrait(l, 'kall') ? .05 : 0); win = 14; lose = -6; break;
    case 'kansla': p = .35 + (t.karisma - 45) / 110 + credFit + (hasTrait(l, 'empatisk') ? .1 : 0) + (voice.kansla || 0) / 100 + (hasTrait(l, 'kall') ? -.08 : 0); win = 15; lose = -8; break;
    case 'angrepp': p = .3 + (t.retorik - 45) / 130 + (t.aggressivitet - 45) / 200 + (voice.angrepp || 0) / 100; win = 20; lose = -14; break;
    case 'kompromiss': p = .5 + (t.lugn - 45) / 150 + (t.social - 45) / 250 + (hasTrait(l, 'pragmatisk') ? .08 : 0) + (hasTrait(l, 'ideologisk') ? -.06 : 0); win = 8; lose = -3; break;
    case 'humor': p = .38 + (t.karisma - 45) / 120 + (t.social - 45) / 200 + (debate.kind === 'podd' ? .15 : debate.kind === 'riksdag' ? -.12 : 0); win = debate.kind === 'podd' ? 14 : 16; lose = -12; break;
    case 'undvik': p = .25 + (t.retorik - 45) / 200; win = 4; lose = -12; break;
    case 'invandning': p = .55 + (t.retorik - 45) / 110 + (t.intelligens - 45) / 200; win = 32; lose = -10; break;
  }
  if (r.gotcha) { if (o.gotchaOk) { p = .5 + (t.intelligens - 45) / 80; win = 12; lose = -10; } else if (o.type === 'undvik') { p = .15; win = 2; lose = -14; } }
  if (r.scandal && o.type === 'angrepp') { p -= .15; lose -= 6; }
  if (debate.kind === 'riksdag') p += (t.erfarenhet - 45) / 300 + (voice.riksdag || 0) / 100;
  if (debate.kind === 'interview' || debate.kind === 'podd') { p += (voice.folk || 0) / 100 * (debate.kind === 'podd' ? 1 : .5); const auth = authenticity(l); if (auth < .5) p -= (0.5 - auth) * .2; }
  p += (body.debate || 0) / 100;
  if (hasTrait(l, 'pessimistisk') && r.scandal) p += .05;
  p = clamp(p, .05, .95);
  const ok = rnd() < p;
  const delta = (ok ? win : lose) * (1 + (sal - 1) * .3);
  debate.meter = clamp(debate.meter + delta, -100, 100);
  r.resolved = true; r.choice = optIdx; r.ok = ok; r.delta = delta;
  let reply;
  if (o.type === 'invandning') { const kind = debate.kind === 'podd' ? 'podd' : debate.kind === 'interview' ? 'interview' : debate.kind === 'riksdag' ? 'riksdag' : 'debate'; recordStatement(state, o.text, kind, { question: r.statement, questionIssue: r.issue }); }
  if (debate.kind === 'podd') reply = ok ? pick(rnd, ['Haha, älskar det. Lyssnare, hörde ni?', 'Bra svar. Det där klipper vi.', 'Okej, det köper jag.']) : pick(rnd, ['Mm. Det lät lite som en pressrelease.', 'Du låter som alla andra politiker nu.', 'Mina lyssnare kommer inte gilla det där.']);
  else if (debate.kind === 'interview') reply = ok ? pick(rnd, ['Tack, det var ett tydligt svar.', 'Okej. Vi går vidare.', 'Intressant. Nästa fråga.']) : pick(rnd, ['Det var inget svar på min fråga.', 'Tittarna hör nog att du undviker frågan.', 'Jag tolkar det som att du inte vet.']);
  else reply = ok ? (o.type === 'invandning' ? pick(rnd, ['…Det… det var ett annat läge då.', 'Du rycker det ur sitt sammanhang!', 'Jag… vi har omprövat den frågan.']) : o.type === 'humor' ? pick(rnd, ['Mycket roligt. Men svara på frågan.', 'Publiken skrattar – jag gör det inte.']) : pick(rnd, ['Det är inte så enkelt som du låter påskina.', 'Jag känner inte igen den beskrivningen.', 'Vi kan väl vara överens om att det är komplicerat.'])) : pick(rnd, ['Där hör ni – inga svar, bara ord.', `Det här är typiskt ${mine.abbr}. Mycket snack.`, 'Du har uppenbarligen inte läst siffrorna.', 'Publiken förtjänar bättre än det där.']);
  const synth = { emotion: { insult: o.type === 'angrepp' ? .5 : 0, mock: o.type === 'humor' ? .3 : 0, praise: o.type === 'kompromiss' ? .3 : 0, empathy: o.type === 'kompromiss' ? .2 : 0, threat: 0, concede: 0 }, tone: {}, dominant: o.type === 'angrepp' ? 'aggressiv' : o.type === 'humor' ? 'humor' : o.type === 'kansla' ? 'kansla' : 'saklig', intensity: 0, claims: [] };
  const mr = debate.mood ? moodRound(state, rnd, debate, synth, { ok, caught: o.type === 'invandning' && ok, interrupt: false }, reply) : null;
  if (mr) reply = mr.reply;
  const narration = ok ? pick(rnd, REACT_WIN) : pick(rnd, REACT_LOSE);
  const poses = body.poses || ['stand', 'open'];
  const myPose = o.type === 'invandning' ? 'point' : o.type === 'angrepp' ? 'slam' : o.type === 'fakta' ? (poses.includes('open') ? 'open' : 'stand') : o.type === 'kompromiss' ? 'think' : o.type === 'humor' ? 'hips' : poses[0];
  return { ok, delta, reply, narration, myExpr: ok ? (o.type === 'invandning' ? 'objection' : o.type === 'angrepp' ? 'angry' : o.type === 'humor' ? 'happy' : 'confident') : 'nervous', myPose, opExpr: mr?.opExpr || (ok ? (o.type === 'invandning' ? 'shocked' : 'nervous') : 'smug'), opPose: mr?.opPose || (ok ? 'stand' : 'cross'), evidence: o.evidence || null, mood: mr?.mood, moodNote: mr?.aud.note, audienceDelta: mr?.aud.delta || 0, moodEff: mr?.eff };
}

export function finishDebate(state, rnd, debate) {
  const mine = me(state); const l = state.people[mine.leader];
  const m = debate.meter;
  const verdict = m > 25 ? 'vann' : m < -25 ? 'förlorade' : 'oavgjort';
  const op = debate.opponentParty ? state.parties[debate.opponentParty] : null;
  const scale = (debate.campaign ? 1.6 : 1) * (debate.kind === 'interview' ? .6 : debate.kind === 'podd' ? .5 : 1);
  l.debateBonus = (l.debateBonus || 0) + (m / 100) * 8 * scale;
  mine.attention = clamp(mine.attention + 6 + Math.abs(m) / 10, 0, 100);
  const aw = state.opinion.awareness[mine.id] ?? 1; if (aw < 1) state.opinion.awareness[mine.id] = clamp(aw + .03 + Math.max(0, m) / 500, 0, 1);
  mine.credibility = clamp(mine.credibility + (m / 100) * 3, 0, 100);
  const issues = debate.rounds.map((r) => r.issue);
  const inf = debate.influencerId ? state.influencers[debate.influencerId] : null;
  for (const sg of SEGMENTS) {
    const seg = state.opinion.seg[sg.id]; if (!seg) continue;
    const care = issues.reduce((a, i) => a + (sg.w[i] || 1), 0) / issues.length;
    let swing = (m / 100) * .9 * care * sg.leader * scale;
    if (inf) swing = inf.segs.includes(sg.id) ? (m / 100) * 1.2 : (m / 100) * .1;
    seg[mine.id] = Math.max(.01, (seg[mine.id] || .1) + swing);
    if (op && seg[op.id] != null) seg[op.id] = Math.max(.01, seg[op.id] - swing * .6);
  }
  if (op) { op.attention = clamp(op.attention + 3, 0, 100); const ol = state.people[op.leader]; ol.debateBonus = (ol.debateBonus || 0) - (m / 100) * 4 * scale; }
  if (inf) { inf.stance = clamp(inf.stance + m * .4, -100, 100); inf.lastWeek = state.week; }
  const typeOf = (r) => r.type || r.options[r.choice]?.type;
  if (debate.journalistId) { const attacked = debate.rounds.some((r) => ['angrepp', 'aggressiv'].includes(typeOf(r))); adjustJournalist(state, debate.journalistId, attacked ? -12 : verdict === 'vann' ? 6 : verdict === 'förlorade' ? -3 : 2, verdict === 'förlorade' ? `${l.name} kunde inte svara om ${ISSUE_BY_ID[issues[0]]?.name.toLowerCase()} i min utfrågning.` : attacked ? `${l.name} gick till angrepp mot mig i studion.` : null); const j = state.journalists[debate.journalistId]; if (j) j.interviews++; }
  if (verdict === 'vann') state.stats.debatesWon++;
  l.fatigue = clamp((l.fatigue || 0) + (debate.kind === 'podd' ? 3 : 6), 0, 100);
  // känslorna följer med ut ur studion: humör, agg, relationer – och ibland rubriker
  const opPerson = debate.opponent ? (state.people[debate.opponent.id] || null) : null;
  const mood = debate.mood || blankMood(); const ev = debate.moodEvents || [];
  let moodNews = '';
  if (opPerson) {
    opPerson.mood = { ...mood }; decayMood(opPerson, .7);
    recordGrudge(opPerson, mood, state.player.leaderId);
    if (op) op.relations[mine.id] = clamp((op.relations[mine.id] || 0) - Math.max(0, mood.anger - 30) / 6 - Math.max(0, mood.sad - 40) / 10 + Math.max(0, mood.joy - 30) / 8, -100, 100);
    if (debate.journalistId) adjustJournalist(state, debate.journalistId, -Math.max(0, mood.anger - 30) / 8 + Math.max(0, mood.joy - 30) / 10, mood.anger > 60 ? `${l.name} gjorde mig rasande i studion.` : mood.joy > 60 ? `${l.name} var genuint trevlig i studion.` : null);
  }
  if (ev.some((e) => e.outburst)) { mine.attention = clamp(mine.attention + 8, 0, 100); if (op) { op.credibility = clamp(op.credibility - 3, 0, 100); const ol = state.people[op.leader]; if (ol) ol.debateBonus = (ol.debateBonus || 0) - 3; } moodNews = ` ${opPerson?.name || 'Motståndaren'} tappade fattningen – klippet sprids redan.`; }
  if (ev.some((e) => e.breakdown)) { mine.trust = clamp((mine.trust ?? 50) - 3, 0, 100); mine.risk = (mine.risk || 0) + 6; moodNews += ` ${opPerson?.name || 'Motståndaren'} bröt ihop, och många tycker att ${l.first} gick för långt.`; }
  if (ev.some((e) => e.concede)) moodNews += ` Ovanligt nog gav ${opPerson?.name || 'motståndaren'} ${l.first} rätt på en punkt.`;
  const outlet = debate.host === 'riksdag' ? 'svt' : debate.host in MEDIA ? debate.host : 'svt';
  let h = debate.kind === 'podd' ? (verdict === 'vann' ? `${l.name} charmade ${inf?.name}s lyssnare` : verdict === 'förlorade' ? `${l.name} floppade i ${inf?.name} – "som en pressrelease"` : `${l.name} gästade ${inf?.name}`) : debate.kind === 'interview' ? (verdict === 'vann' ? `${l.name} stod pall i tuff utfrågning` : verdict === 'förlorade' ? `${l.name} i blåsväder efter utfrågning: "Kunde inte svara"` : `Jämn utfrågning av ${l.name}`) : verdict === 'vann' ? `${l.name} vann ${debate.name.toLowerCase()} – ${op?.abbr} pressad` : verdict === 'förlorade' ? `${state.people[op.leader].name} (${op.abbr}) dominerade ${debate.name.toLowerCase()}` : `Oavgjort i ${debate.name.toLowerCase()}`;
  if (ev.some((e) => e.outburst) && opPerson) h = `${opPerson.name} tappade fattningen mot ${l.name}: "${pick(rnd, ['NU RÄCKER DET', 'Skäms', 'Säg det igen'])}"`;
  else if (ev.some((e) => e.breakdown) && opPerson) h = `${opPerson.name} bröt ihop i ${debate.kind === 'interview' || debate.kind === 'podd' ? 'studion' : 'debatten'} – kritik mot ${l.name}s ton`;
  const inv = debate.rounds.filter((r) => typeOf(r) === 'invandning' && r.ok).length;
  addNews(state, { outlet, headline: h, body: `${inv ? `Kvällens ögonblick: ${l.name} avslöjade en motsägelse i ${op?.abbr}:s politik – "${pick(rnd, ['Ni röstade ju tvärtom!', 'Hur går det ihop?'])}". ` : ''}${verdict === 'vann' ? `"${pick(rnd, ['Bästa insatsen på länge', 'Ett genombrott', 'Skarp och påläst'])}", säger kommentatorerna.` : verdict === 'förlorade' ? `${pick(rnd, ['Osäker', 'Svävande', 'Illa förberedd'])} – så beskrivs insatsen.` : 'Ingen av deltagarna lyckades sticka ut.'}${moodNews}`, tags: ['debatt'], partyId: mine.id, importance: debate.campaign || ev.length ? 3 : 2, tone: verdict === 'vann' ? 1 : verdict === 'förlorade' ? -1 : 0 });
  debate.done = true; debate.result = verdict;
  return { verdict, meter: m, inv, mood: moodLabel(mood), moodEvents: ev, opponentName: opPerson?.name || null };
}
