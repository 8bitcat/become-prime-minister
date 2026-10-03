// Nyhetsflödet: rubriker skapas dynamiskt ur det som händer. Varje medium har sin ton.
import { MEDIA } from '../data/names.js';
import { STAT_BY_ID } from '../data/stats.js';
import { pick, fmt } from '../core/util.js';
import { activeParties } from './opinion.js';

export function addNews(state, n) {
  const item = { id: 'n' + state.week + '_' + Math.floor(Math.random() * 1e6).toString(36), week: state.week, date: { ...state.date }, outlet: n.outlet || 'svt', headline: n.headline, body: n.body || '', tags: n.tags || [], partyId: n.partyId || null, importance: n.importance || 1, tone: n.tone || 0 };
  state.news.unshift(item);
  if (state.news.length > 400) state.news.pop();
  if (n.partyId && state.parties[n.partyId]) state.parties[n.partyId].attention = Math.min(100, state.parties[n.partyId].attention + (n.importance || 1) * 3);
  return item;
}

const OUTLETS = Object.keys(MEDIA).filter((k) => k !== 'flashback');
const pickOutlet = (rnd, pref) => pref || pick(rnd, OUTLETS);

// Rubriker för statistikförändringar
export function newsFromNotes(state, rnd, notes) {
  for (const n of notes.slice(0, 3)) {
    const st = STAT_BY_ID[n.id];
    const v = fmt(state.sweden.stats[n.id], st.d);
    const outlet = pickOutlet(rnd);
    const dram = outlet === 'aftonbladet' || outlet === 'expressen';
    const h = dram ? n.text.toUpperCase().replace('STIGER', 'RUSAR').replace('SJUNKER', 'RASAR') + ` – nu ${v} ${st.unit}` : `${n.text}: ${v} ${st.unit}`;
    const gov = state.government;
    const pmParty = gov.pmParty ? state.parties[gov.pmParty] : null;
    const good = st.good === 'up' ? n.d > 0 : st.good === 'down' ? n.d < 0 : st.good === 'target2' ? Math.abs(state.sweden.stats[n.id] - 2) < Math.abs(state.sweden.stats[n.id] - n.d - 2) : null;
    const body = pmParty ? (good === false ? `Oppositionen kräver svar från regeringen ${pmParty.abbr}. "${pick(rnd, ['Det här är ett underbetyg', 'Regeringen har tappat kontrollen', 'Vanligt folk betalar priset'])}", säger en oppositionsföreträdare.` : good ? `Regeringen tar åt sig äran: "${pick(rnd, ['Vår politik fungerar', 'Det här är resultatet av hårt arbete', 'Sverige är på rätt väg'])}".` : 'Experter är oeniga om vad förändringen beror på.') : 'Sverige saknar fortfarande en regering som kan agera.';
    addNews(state, { outlet, headline: h, body, tags: ['statistik', st.cat], importance: Math.abs(n.d) > 0 ? 2 : 1, tone: good === false ? -1 : good ? 1 : 0 });
  }
}

export function newsFromPoll(state, rnd, poll) {
  const parties = activeParties(state);
  const sorted = parties.map((p) => ({ p, v: poll.res[p.id] })).sort((a, b) => b.v - a.v);
  const prev = state.opinion.polls.find((q) => q.inst === poll.inst && q.week < poll.week);
  const movers = prev ? sorted.map((x) => ({ ...x, d: x.v - (prev.res[x.p.id] ?? x.v) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)) : [];
  const top = movers[0];
  let headline, body;
  if (top && Math.abs(top.d) >= 1.2) {
    headline = top.d > 0 ? `${top.p.abbr} ${top.d > 2.5 ? 'rusar' : 'går fram'} i ny mätning: ${fmt(top.v, 1)} %` : `${top.p.abbr} ${top.d < -2.5 ? 'rasar' : 'backar'} i ny mätning: ${fmt(top.v, 1)} %`;
    body = `${poll.inst}: ${sorted.slice(0, 4).map((x) => `${x.p.abbr} ${fmt(x.v, 1)}`).join(', ')}. ${top.d > 0 ? `"${top.p.name} har tagit initiativet i debatten", säger en opinionsanalytiker.` : `Partiet har tappat ${fmt(-top.d, 1)} procentenheter sedan förra mätningen.`}`;
  } else {
    headline = `${poll.inst}: ${sorted[0].p.abbr} störst med ${fmt(sorted[0].v, 1)} %`;
    body = `Små rörelser i veckans mätning. ${sorted.slice(0, 5).map((x) => `${x.p.abbr} ${fmt(x.v, 1)}`).join(', ')}.`;
  }
  const me = state.parties[state.player.partyId];
  const mine = poll.res[me.id];
  if (!me.inRiksdag && mine >= 3.5 && mine < 5) { headline = `${me.abbr} nära spärren – ${fmt(mine, 1)} % i ${poll.inst}`; body = `Det nya partiet ${me.name} närmar sig riksdagsspärren. "Vi är här för att stanna", säger partiledaren ${state.people[me.leader].name}.`; }
  if (!me.inRiksdag && mine >= 5 && !state.flags.overThresholdNews) { state.flags.overThresholdNews = true; headline = `GENOMBROTT: ${me.name} över spärren i ${poll.inst}`; body = `För första gången skulle ${me.abbr} ta plats i riksdagen om det vore val i dag. Etablerade partier avfärdar mätningen som en tillfällighet.`; }
  addNews(state, { outlet: pick(rnd, ['svt', 'aftonbladet', 'expressen', 'dn', 'tv4']), headline, body, tags: ['opinion'], importance: top && Math.abs(top.d) > 2 ? 2 : 1 });
}

// Vardagsnyheter som ger liv åt flödet (och ibland sätter dagordningen)
const FLAVOR = [
  { h: 'Stor brand i industrilokal i {stad}', b: 'Räddningstjänsten var på plats i över tolv timmar. Ingen person skadades.', tag: 'samhalle' },
  { h: 'Rekordmånga sökte till högskolan', b: 'Ansökningarna ökade med sju procent jämfört med i fjol.', tag: 'valfard' },
  { h: 'Skjutning i {stad} – en person till sjukhus', b: 'Polisen har spärrat av området. Händelsen kopplas till en konflikt mellan kriminella nätverk.', tag: 'brott', issue: 'kriminal' },
  { h: 'Vårdplatserna på akuten slut – patienter vårdades i korridoren', b: 'Regionen kallar läget "ansträngt men hanterbart".', tag: 'valfard', issue: 'valfard' },
  { h: 'Elräkningen chockar villaägare i {stad}', b: 'Priserna i elområde 3 och 4 har stigit kraftigt den senaste veckan.', tag: 'klimat', issue: 'energi' },
  { h: 'Rysk ubåt observerad utanför Gotland', b: 'Försvarsmakten bekräftar att man följt fartyget. "Inget ovanligt men vi är uppmärksamma."', tag: 'forsvar', issue: 'forsvar' },
  { h: 'Bostadsköerna växer i storstäderna', b: 'Unga vuxna bor kvar hemma allt längre, visar en ny rapport.', tag: 'bostad', issue: 'bostad' },
  { h: 'Lantbrukare i {stad} varnar: "Vi går på knäna"', b: 'Dieselpriser och räntor pressar jordbruket.', tag: 'landsbygd', issue: 'landsbygd' },
  { h: 'Klimatprotest stoppade trafiken i centrala {stad}', b: 'Ett trettiotal aktivister limmade fast sig på vägbanan.', tag: 'klimat', issue: 'klimat' },
  { h: 'Storvarsel på fabrik i {stad}', b: '400 anställda riskerar att förlora jobbet när produktionen flyttar.', tag: 'arbete', issue: 'arbete' },
  { h: 'Lärarbristen värst i glesbygden', b: 'Var tredje lärare saknar behörighet i vissa kommuner.', tag: 'valfard', issue: 'valfard' },
  { h: 'Asylboende i {stad} väcker debatt', b: 'Kommunen har fått ta emot fler än planerat.', tag: 'migration', issue: 'migration' },
  { h: 'Svenska landslaget vann – folkfest i {stad}', b: 'Tusentals firade på gatorna långt in på natten.', tag: 'kultur' },
  { h: 'Ny rapport: Sverige halkar efter i EU', b: 'En jämförelse av konkurrenskraft placerar Sverige på sjunde plats.', tag: 'ekonomi', issue: 'eu' },
  { h: 'Pensionär i {stad} nekas hemtjänst – "Jag klarar mig inte"', b: 'Kommunen hänvisar till besparingar.', tag: 'valfard', issue: 'valfard' },
  { h: 'Facket varslar om strejk', b: 'Avtalsrörelsen har kört fast. Strejken kan slå mot kollektivtrafiken.', tag: 'arbete', issue: 'arbete' },
];
import { CITIES } from '../data/names.js';
export function weeklyFlavor(state, rnd) {
  if (rnd() > .55) return;
  const f = pick(rnd, FLAVOR);
  const stad = pick(rnd, CITIES);
  addNews(state, { outlet: pick(rnd, OUTLETS), headline: f.h.replace('{stad}', stad), body: f.b, tags: [f.tag], importance: 1 });
  if (f.issue) state.opinion.boost[f.issue] = (state.opinion.boost[f.issue] || 0) + .08;
}

export const outletInfo = (id) => MEDIA[id] || MEDIA.svt;
