// Skandaler uppstår ur det som faktiskt händer: risk byggs upp av riskabla inlägg,
// partimedlemmar med låg integritet, pengar och makt. Hur du svarar avgör storleken.
import { pick, clamp, gauss, kr } from '../core/util.js';
import { addNews } from './news.js';
import { activeParties } from './opinion.js';

export const SCANDAL_TYPES = [
  { id: 'donation', title: 'Misstänkt donation', sev: [20, 55], gov: false, text: (p, l, x) => `Medier avslöjar att ${p.name} tagit emot ${kr(x.amount)} från en givare med kopplingar till ${pick(x.rnd, ['ett skatteparadis', 'en rysk affärsman', 'en vapenhandlare', 'en dömd bedragare'])}. Pengarna har inte redovisats korrekt.` },
  { id: 'gammalt_uttalande', title: 'Gammalt uttalande', sev: [15, 45], text: (p, l, x) => `Ett ${x.rnd() < .5 ? 'inlägg' : 'klipp'} från ${2015 + Math.floor(x.rnd() * 9)} där ${l.name} ${pick(x.rnd, ['skämtar om', 'hånar', 'uttalar sig nedsättande om'])} ${pick(x.rnd, ['pensionärer', 'invandrare', 'landsbygden', 'sjuksköterskor', 'Göteborg', 'kvinnor i politiken', 'sina egna väljare'])} sprids nu i rasande takt.` },
  { id: 'medlem', title: 'Partimedlem i blåsväder', sev: [10, 40], text: (p, l, x) => `${x.member?.name || 'En ledande företrädare'} för ${p.abbr} har ${pick(x.rnd, ['kört rattfull', 'använt partiets kort privat', 'hotat en journalist', 'delat extremistiskt material', 'ljugit om sin utbildning', 'anklagats för trakasserier'])}. Kravet på uteslutning växer.` },
  { id: 'lackta_meddelanden', title: 'Läckta meddelanden', sev: [20, 60], text: (p, l, x) => `Interna chattmeddelanden från ${p.abbr}:s ledning har läckt. I dem kallar ${l.name} ${pick(x.rnd, ['väljarna "fårskallar"', 'en partikollega "en idiot"', 'ett vallöfte "bara snack"', 'journalister "parasiter"'])}.` },
  { id: 'intervju', title: 'Haveri i intervju', sev: [10, 35], text: (p, l, x) => `${l.name}s intervju i ${pick(x.rnd, ['SVT:s 30 minuter', 'Ekots lördagsintervju', 'TV4 Nyhetsmorgon'])} har blivit ett viralt fenomen – av fel anledning. Partiledaren kunde inte svara på ${pick(x.rnd, ['vad en liter mjölk kostar', 'hur partiets egen reform ska finansieras', 'vad statsskulden är', 'en enda siffra'])}.` },
  { id: 'splittring', title: 'Intern strid', sev: [15, 50], text: (p, l, x) => `${pick(x.rnd, ['Partistyrelsen', 'Ungdomsförbundet', 'Distriktet i Skåne', 'Riksdagsgruppen'])} i ${p.abbr} går öppet emot ${l.name}. ${pick(x.rnd, ['"Ledningen lyssnar inte"', '"Vi känner inte igen vårt parti"', '"Det är dags för en ny ledare"'])}, säger en källa.` },
  { id: 'ministerskandal', title: 'Minister i skandal', sev: [25, 65], gov: true, text: (p, l, x) => `${x.minister?.name || 'En minister'} har ${pick(x.rnd, ['anlitat svart städhjälp', 'låtit staten betala privata resor', 'ljugit för riksdagen', 'läckt hemliga uppgifter', 'fått sitt säkerhetsklassade mobilnummer hackat'])}. Oppositionen kräver att ministern avgår.` },
  { id: 'lofte', title: 'Svikna vallöften', sev: [10, 35], gov: true, text: (p, l) => `En granskning visar att regeringen bara infriat en bråkdel av sina vallöften. ${l.name} pressas i partiledardebatten.` },
  { id: 'ekonomi', title: 'Partiets ekonomi', sev: [15, 45], text: (p, l, x) => `${p.name} har ${pick(x.rnd, ['missat att betala arbetsgivaravgifter', 'använt partistöd till privata fester', 'ett underskott på flera miljoner', 'redovisat kampanjkostnader felaktigt'])}. Revisorn vägrar skriva under.` },
];

export function partyRisk(state, p) {
  const l = state.people[p.leader];
  const members = (p.people || []).map((id) => state.people[id]).filter(Boolean);
  const lowInteg = members.filter((m) => m.traits.integritet < 35).length;
  let r = 6 + (100 - (l?.traits.integritet ?? 50)) * .08 + lowInteg * 2.5 + ((p.risk || 0)) + (p.attention / 100) * 4 + (p.unity < 50 ? (50 - p.unity) * .15 : 0);
  if (state.government.parties.includes(p.id)) r += 4;
  if (state.election.campaign) r *= 1.5;
  if (l?.traits.aggressivitet > 65) r += 2;
  if (l?.persona?.personality?.includes('impulsiv')) r += 2;
  if (l?.persona?.personality?.includes('disciplinerad')) r -= 1.5;
  r *= structureEffects(p).scandal;
  return Math.max(1, r); // "risk per vecka" i promille ≈ r/1000 … skalas nedan
}
import { structureEffects } from './party.js';

export function rollScandals(state, rnd) {
  const out = [];
  for (const p of activeParties(state)) {
    const active = (state.scandals || []).filter((x) => x.active && x.partyId === p.id).length;
    if (active >= 2) continue;
    const r = partyRisk(state, p) / 1000 * (p.isPlayer ? 1 : .7);
    if (rnd() < r) {
      const inGov = state.government.parties.includes(p.id);
      const types = SCANDAL_TYPES.filter((t) => t.gov == null || t.gov === inGov || (t.gov === false));
      const t = pick(rnd, types.filter((t) => !(t.gov && !inGov)));
      const l = state.people[p.leader];
      const member = pick(rnd, (p.people || []).map((id) => state.people[id]).filter(Boolean)) || null;
      const minister = inGov ? pick(rnd, Object.values(state.government.ministers).map((id) => state.people[id]).filter((m) => m && m.partyId === p.id)) || member : null;
      const sev = Math.round(t.sev[0] + rnd() * (t.sev[1] - t.sev[0]) + (p.attention / 100) * 10);
      const sc = { id: 'sc' + state.week + '_' + Math.floor(rnd() * 1e5), type: t.id, title: t.title, partyId: p.id, severity: sev, peak: sev, week: state.week, date: { ...state.date }, active: true, responded: !p.isPlayer, text: t.text(p, l, { rnd, amount: Math.round(2e5 + rnd() * 3e6), member, minister }), memberId: member?.id || null, ministerId: minister?.id || null };
      (state.scandals ||= []).unshift(sc);
      p.risk = Math.max(0, (p.risk || 0) * .5);
      addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen', 'svt', 'dn']), headline: sev > 45 ? `AVSLÖJAR: ${t.title} skakar ${p.abbr}` : `${t.title} – ${p.abbr} pressas`, body: sc.text, tags: ['skandal'], partyId: p.id, importance: sev > 40 ? 3 : 2, tone: -1 });
      if (!p.isPlayer) aiRespond(state, rnd, sc);
      else out.push(sc);
    }
  }
  return out;
}

export const RESPONSES = [
  { id: 'forneka', name: 'Förneka allt', desc: 'Kalla det en smutskastningskampanj. Fungerar om det inte finns mer att gräva fram.' },
  { id: 'erkann', name: 'Erkänn och be om ursäkt', desc: 'Tar udden av skandalen snabbt men kostar lite trovärdighet.' },
  { id: 'avskeda', name: 'Avskeda/utesluta den ansvarige', desc: 'Visar handlingskraft. Skakar partiet internt.' },
  { id: 'utredning', name: 'Tillsätt intern utredning', desc: 'Köper tid. Skandalen klingar långsamt av – om inget nytt läcker.' },
  { id: 'tyst', name: 'Ligg lågt', desc: 'Säg ingenting och hoppas att nyhetscykeln går vidare.' },
  { id: 'motattack', name: 'Gå till motattack', desc: 'Vänd uppmärksamheten mot motståndarna. Högrisk.' },
];
export function respondScandal(state, rnd, sc, choice) {
  const p = state.parties[sc.partyId]; const l = state.people[p.leader];
  const lugn = l.traits.lugn / 100, retorik = l.traits.retorik / 100, integ = l.traits.integritet / 100;
  let mult = 1, text = '', unity = 0, cred = 0;
  const personal = ['gammalt_uttalande', 'lackta_meddelanden', 'intervju'].includes(sc.type);
  switch (choice) {
    case 'forneka': { const ok = rnd() < .35 + integ * .3 - (sc.severity / 200); if (ok) { mult = .5; text = 'Förnekandet håller – inga nya uppgifter kommer fram och storyn dör.'; } else { mult = 1.6; cred = -6; text = 'Nya uppgifter bekräftar anklagelserna. Förnekandet gör allt värre.'; } break; }
    case 'erkann': mult = .55; cred = -2 + retorik * 2; text = 'Ursäkten tas emot blandat, men medierna går vidare. "Ansvarsfullt", säger kommentatorerna.'; break;
    case 'avskeda': { if (sc.memberId || sc.ministerId) { mult = .4; unity = -8; text = 'Den ansvarige lämnar. Partiet visar handlingskraft, men internt mullrar det.'; const id = sc.ministerId || sc.memberId; const m = state.people[id]; if (m) { m.alive = false; p.people = (p.people || []).filter((x) => x !== id); for (const k in state.government.ministers) if (state.government.ministers[k] === id) delete state.government.ministers[k]; } } else { mult = 1.1; unity = -10; text = 'Det finns ingen att avskeda – det är du själv som är ansvarig. Partiet uppfattar beslutet som panik.'; } break; }
    case 'utredning': mult = .8; sc.slow = true; text = 'Utredningen tillsätts. Medierna tappar intresset långsamt – om inget nytt läcker.'; break;
    case 'tyst': { const ok = rnd() < .3 + lugn * .3; if (ok) { mult = .7; text = 'Nyhetscykeln går vidare. Tystnaden fungerade.'; } else { mult = 1.3; text = '"Partiledaren vägrar svara" blir nästa rubrik. Tystnaden tolkas som skuld.'; } break; }
    case 'motattack': { const ok = rnd() < .25 + retorik * .4 + (l.traits.aggressivitet / 100) * .2; if (ok) { mult = .45; text = 'Motattacken fungerar – debatten handlar nu om motståndarna i stället.'; const tgt = pick(rnd, activeParties(state).filter((q) => q.id !== p.id)); tgt.attention = clamp(tgt.attention + 5, 0, 100); tgt.risk = (tgt.risk || 0) + 6; } else { mult = 1.5; cred = -5; text = 'Motattacken uppfattas som desperat. Skandalen växer.'; } break; }
  }
  if (personal && choice === 'avskeda') mult = 1.2;
  sc.severity = Math.round(sc.severity * mult); sc.peak = Math.max(sc.peak, sc.severity); sc.responded = true; sc.response = choice;
  p.unity = clamp(p.unity + unity, 0, 100); p.credibility = clamp(p.credibility + cred, 0, 100);
  // förtroende: ärlighet belönas, avslöjade lögner straffas hårt
  p.trust = clamp((p.trust ?? 50) + (choice === 'erkann' ? 2 : choice === 'forneka' && mult > 1 ? -8 : choice === 'forneka' ? 1 : choice === 'motattack' && mult > 1 ? -4 : 0), 0, 100);
  return { text, severity: sc.severity };
}
function aiRespond(state, rnd, sc) { const c = pick(rnd, ['erkann', 'utredning', 'avskeda', 'forneka', 'tyst']); respondScandal(state, rnd, sc, c); }

export function decayScandals(state, rnd) {
  for (const sc of state.scandals || []) {
    if (!sc.active) continue;
    const p = state.parties[sc.partyId];
    const decay = sc.slow ? .9 : sc.responded ? .82 : .95;
    sc.severity = sc.severity * decay;
    if (sc.severity > 30 && rnd() < .08) { sc.severity *= 1.25; addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen', 'dn']), headline: `Nya uppgifter i ${sc.title.toLowerCase()}en kring ${p.abbr}`, body: pick(rnd, ['Fler dokument har läckt till redaktionen.', 'Ytterligare personer träder fram.', 'Partiet ändrar sin version av händelseförloppet.']), tags: ['skandal'], partyId: p.id, importance: 2, tone: -1 }); }
    if (sc.severity < 4) { sc.active = false; sc.ended = state.week; }
    // partiledaren tvingas avgå? (bara AI – spelaren får ett val i händelsesystemet)
    if (!p.isPlayer && sc.peak > 60 && sc.severity > 40 && rnd() < .05) {
      const old = state.people[p.leader];
      old.role = 'mp';
      const next = (p.people || []).map((id) => state.people[id]).filter((x) => x && x.alive).sort((a, b) => b.traits.ledarskap - a.traits.ledarskap)[0];
      if (next) { p.leader = next.id; next.role = 'leader'; next.since = { ...state.date }; sc.severity *= .5; addNews(state, { outlet: 'svt', headline: `${old.name} avgår som partiledare för ${p.abbr}`, body: `${next.name} tar över med omedelbar verkan. "Partiet behöver en nystart", säger den nya partiledaren.`, tags: ['parti'], partyId: p.id, importance: 3 }); if (state.government.pm === old.id) state.government.pm = next.id; }
    }
  }
}
