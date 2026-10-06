// Politik med egna ord → konkreta värden i politikområdena. Steg 1: hitta kandidatområden (trigram
// mot områdenas namn, beskrivningar och alternativ). Steg 2: spelets AI-modell väljer områden och
// värden – eller, utan modell, en regelbaserad tolkning (höj/sänk/inför/förbjud/siffror).
import { POLICIES, POLICY_BY_ID, DOMAINS, policyLabel } from '../data/policies.js';
import { trigrams, dice } from './ngram.js';
import { splitSentences, wordsToDigits } from './analyze.js';
import { localReady, localJSON } from './local.js';
import { policyMessages } from './prompts.js';

// Vardagsord → ord som står i politikområdenas namn (så att "bensinskatten" hittar "Drivmedelsskatt")
const SYN = [[/bensin|diesel|soppa|drivmedel|pumppris/, 'drivmedel'], [/pensionär|pension|äldre|ålderdom/, 'pension äldre'], [/invandr|flykting|asyl|nyanländ|migrant/, 'asyl migration invandring'], [/asylsök|ta emot .*(flykting|asyl)|flyktingar per år|kvotflykting/, 'asylmottagande'], [/polis|snut|ordningsmakt/, 'polis'], [/gäng|skjut|spräng|kriminell/, 'gäng straff polis'], [/lärare|elev|klassrum|skola|skolor/, 'skola'], [/friskol|skolkoncern|vinst/, 'vinst skola friskol'], [/tunnelbana|buss|pendeltåg|spårvagn|kollektiv|sl-kort|månadskort/, 'kollektivtrafik'], [/tåg|järnväg|höghastighet/, 'järnväg tåg'], [/sjukhus|akut|vård|sjuksköterska|läkare|vårdkö/, 'vård sjukvård'], [/hyra|hyror|hyresrätt|lägenhet|bostad/, 'hyra bostad bygg'], [/kärnkraft|reaktor/, 'kärnkraft'], [/vindkraft|vindkraftverk/, 'vindkraft'], [/el-pris|elpris|elräkning|elnät/, 'el energi'], [/försvar|militär|soldat|värnplikt|nato/, 'försvar värnplikt'], [/klimat|utsläpp|koldioxid/, 'klimat koldioxid utsläpp'], [/bidrag|socialbidrag|försörjningsstöd/, 'bidrag'], [/a-kassa|arbetslös/, 'a-kassa arbetslöshet'], [/las\b|anställningsskydd|turordning/, 'anställningsskydd las'], [/barnbidrag|föräldrapenning|föräldraledig|förskola|barnomsorg/, 'barn föräldra förskola'], [/eu\b|europeiska unionen|bryssel/, 'eu'], [/bistånd/, 'bistånd'], [/kultur|teater|museum|bibliotek|public service|svt|sveriges radio/, 'kultur public service'], [/alkohol|systembolag|sprit|öl\b|vin\b/, 'alkohol'], [/spel|casino|kasino|spelbolag/, 'spel'], [/narkotika|cannabis|knark/, 'narkotika'], [/kommunalskatt/, 'kommunalskatt'], [/statlig skatt|värnskatt|höginkomst|de rika|rikaste/, 'statlig inkomstskatt brytpunkt'], [/bolagsskatt|företagsskatt/, 'bolagsskatt'], [/moms/, 'moms'], [/ränteavdrag|bolån/, 'ränteavdrag'], [/arvsskatt|arv\b/, 'arvsskatt'], [/fastighetsskatt|fastighetsavgift|villa/, 'fastighet'], [/rut|rot\b|hushållsnära/, 'rut rot'], [/återvandr|deporter|utvis|skicka hem|repatri/, 'återvandring'], [/anarki|statslös|ingen stat/, 'styrelseform statsskick'], [/diktatur|enpartistat|junta|auktoritärt styre|envälde|presidentstyre|direktdemokrati|folkomröstning/, 'styrelseform statsskick'], [/valen|allmänna val|skjuta upp valet|rösträtt/, 'allmänna val rösträtt'], [/oppositionen|opposition|partiförbud|förbjuda partier/, 'oppositionspartier'], [/gränsmur|mur\b|gränsen|gränser/, 'gränskontroll'], [/invandringsstopp|stoppa invandring|stoppa all invandring/, 'invandringsstopp'], [/planekonomi|förstatliga|nationalisera|expropri/, 'ägande industri privat egendom'], [/censur|propaganda|statliga medier/, 'yttrandefrihet press'], [/teokrati|religiös lag|sharia|statsateism|förbjuda religion/, 'religion'], [/strejk/, 'strejkrätt'], [/arbetsplikt|tvångsarbete/, 'arbetsplikt'], [/nerväxt|tillväxt/, 'tillväxtpolitik'], [/privatbil|bilförbud|förbjuda bilar/, 'privatbilism'], [/hemlig polis|säkerhetspolis|politiska fångar/, 'polis'], [/arbetsläger|avskaffa fängelser|fängelserna/, 'fängelse'], [/kreditsystem|massövervakning|övervakning/, 'övervakning'], [/centralbank|riksbank/, 'centralbank'], [/inkomstskatt|platt skatt|marginalskatt/, 'skattesystem inkomstskatt']];
const STOP = new Set('och eller att det den detta dessa som för från till med utan inte ska skall vill kan måste alla allt mer mindre fler färre över under efter före vara blir varje andra annan också bara även ännu inom mot genom sverige svenska staten statens'.split(' '));
const words = (t) => String(t || '').toLowerCase().replace(/[^a-zåäöé0-9\- ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w));
const stem = (w) => w.slice(0, 5);
let IDXW = null;
function policyIndex() {
  if (IDXW) return IDXW;
  const df = new Map(); const docs = [];
  for (const p of POLICIES) {
    const name = [...new Set(words(p.name).map(stem))]; const rest = [...new Set([...words(p.desc), ...(p.type === 'choice' ? p.options.flatMap((o) => words(o.name)) : []), ...words(DOMAINS[p.domain])].map(stem))].filter((x) => !name.includes(x));
    docs.push({ p, name, rest });
    for (const s of new Set([...name, ...rest])) df.set(s, (df.get(s) || 0) + 1);
  }
  const idf = (s) => Math.log(1 + POLICIES.length / (df.get(s) || 1));
  IDXW = { docs, idf };
  return IDXW;
}
const expand = (t) => { let x = String(t || '').toLowerCase(); for (const [re, add] of SYN) if (re.test(x)) x += ' ' + add; return x; };
function scoreSentence(sent) {
  const { docs, idf } = policyIndex();
  const t = expand(sent); const out = [];
  for (const d of docs) {
    let nm = 0, nt = 0; for (const s of d.name) { const w = idf(s); nt += w; if (t.includes(s)) nm += w; }
    let rm = 0; for (const s of d.rest) if (t.includes(s)) rm += idf(s);
    const sc = (nt ? nm / nt : 0) * .8 + Math.min(.35, rm * .05);
    if (sc > .2) out.push({ p: d.p, sim: Math.round(sc * 100) / 100 });
  }
  return out.sort((a, b) => b.sim - a.sim);
}
export function policyCandidates(text, max = 14) {
  const score = new Map();
  for (const s of splitSentences(text).concat(splitSentences(text).length > 1 ? [] : [text])) for (const hit of scoreSentence(s).slice(0, 8)) score.set(hit.p.id, Math.max(score.get(hit.p.id) || 0, hit.sim));
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([id, sim]) => ({ p: POLICY_BY_ID[id], sim }));
}
const snap = (p, v) => { v = Math.max(p.min, Math.min(p.max, v)); const r = Math.round(v / p.step) * p.step; return Number.isInteger(p.step) ? Math.round(r) : Math.round(r * 100) / 100; };
// Riktning: höj/skärp/hårdare = upp, sänk/minska/mildare = ned. "skär ned" är ned men "skärp" är upp.
const UP = /(höj|öka|utök|stärk|fördubbl|dubbl|större|högre|hårdare|strängare|skärp|tuffare|förläng|bygg|satsa|\bfler\b|\bmer\b|\bny\b|\bnya\b|\bnytt\b)/;
const UP_HARD = /(höj|öka|utök|fördubbl|dubbl|större|högre|hårdare|strängare|skärp|tuffare|förläng)/; // skatter och avgifter: "satsa på" betyder inte "höj avgiften"
const DOWN = /(sänk|minsk|färre|mindre|halver|avveckl|lägre|mildare|kortare|förkort|stryp|ta bort|dra ned|dra ner|skär ned|skär ner|skära ned|skära ner|nedskär)/;
const isTaxLike = (p) => !p.budget && /skatt|avgift|moms/i.test(p.name);
export function dirOf(text, strict = false) {
  const t = String(text || '').toLowerCase();
  if (/för (låg|lite\b|få\b|svag|mild|kort)/.test(t)) return 1;
  if (/för (hög|mycket|många|hård|sträng|lång)/.test(t)) return -1;
  const u = t.search(strict ? UP_HARD : UP), d = t.search(DOWN);
  if (u < 0 && d < 0) return 0;
  let dir = d < 0 || (u >= 0 && u < d) ? 1 : -1; // det första riktningsordet gäller ("sänk straffen, fängelser gör folk mer kriminella")
  const at = dir > 0 ? u : d;
  if (/\b(inte|ej|aldrig)\s+(\S+\s+){0,2}$/.test(t.slice(Math.max(0, at - 30), at))) dir = -dir; // "vi ska inte skärpa straffen"
  return dir;
}
const numIn = (s) => { const m = wordsToDigits(s.toLowerCase()).replace(/(\d)\s(?=\d{3}\b)/g, '$1').match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(',', '.')) : null; };
// Nyckelord i meningen → nyckelord i alternativets namn; tredje ledet = motsatsord som diskvalificerar
const KW = [
  [/förstatlig|nationalis|socialiser|expropri/, /förstatlig|nationalis|expropri|socialis|planekonomi/, /privat/],
  [/förbjud|förbud|stoppa|olagligt/, /förbud|stopp|förbjud|olaglig/, /tillåt|fri\b|fritt/],
  [/avskaffa|ta bort|slopa|skrota/, /avskaff|ingen|inget|slopa|nej\b|avveckl/, /inför|utök/],
  [/gränsmur|\bmur\b|stängsel/, /mur\b|stängsel|militär gräns/, /fri\b|öppn/],
  [/\binför|ja till/, /\bja\b|\binför|obligator/, /avskaff|ingen\b/],
  [/tillåt|legalis|fri |fritt|släpp|öppna/, /fri|tillåt|legal|öppn/, /förbud|förbjud|stäng/],
  [/privat|avreglera|marknad/, /privat|marknad|avreglera/, /statlig|förstatlig|nationalis/],
  [/statlig|offentlig/, /statlig|offentlig|förstatlig/, /privat/],
  [/stäng/, /stäng|stopp/, /öppn|fri/], [/hård|skärp|strän/, /hård|skärp|strän/, /mild/], [/mild|förebygg|lokal/, /förebygg|lokal|mild/, /hård/],
];
function choiceFromText(p, s, minDice = .18) {
  const t = s.toLowerCase(); const g = trigrams(t);
  for (const [re, opt, anti] of KW) if (re.test(t)) {
    // alla alternativ som matchar – bäst är det där nyckelordet kommer tidigt och som liknar meningen mest
    const c = p.options.map((o) => { const nm = o.name.toLowerCase(); const m = nm.search(opt); return { o, sc: m < 0 ? -9 : dice(g, trigrams(nm)) + .4 * (1 - m / Math.max(1, nm.length)) - (anti.test(nm) ? .6 : 0) }; }).filter((x) => x.sc > -1).sort((a, b) => b.sc - a.sc);
    if (c.length && c[0].sc > 0) return c[0].o.id;
  }
  // ord som bara finns i ett av alternativen ("teokrati", "enpartistat", "junta") avgör – men ett
  // ytterlighetsalternativ väljs bara när meningen faktiskt kräver något ("inför", "avskaffa" …), inte när
  // ordet bara nämns ("fängelser gör folk mer kriminella" ≠ "avskaffa fängelserna")
  const demands = /inför|avskaffa|förbjud|stoppa|tillåt|bygg|kräv|ersätt|gör om|ska bli|vill ha|ja till/.test(t);
  const st = (w) => w.slice(0, 6); const sw = new Set(t.replace(/[^a-zåäöé ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 5).map(st));
  const ow = p.options.map((o) => new Set(o.name.toLowerCase().replace(/[^a-zåäöé ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 5).map(st)));
  let bo = null, bn = 0;
  p.options.forEach((o, i) => { if ((o.x || (o.ext || 0) >= 2) && !demands) return; let n = 0; for (const w of ow[i]) if (sw.has(w) && ow.filter((x) => x.has(w)).length === 1) n++; if (n > bn) { bn = n; bo = o.id; } });
  if (bo) return bo;
  let best = null, bs = minDice;
  for (const o of p.options) { const d = dice(g, trigrams(o.name)); if (d > bs) { bs = d; best = o.id; } }
  return best;
}
// Regelbaserad tolkning: bästa område per mening + riktning/siffra/alternativ
export function heuristicPolicyMap(text, program = {}) {
  const out = new Map();
  // dela också på "och" så att "bygg ut tunnelbanan och förbjud vinster i skolan" blir två ställningstaganden
  const parts = splitSentences(text).flatMap((s) => s.split(/,\s+(?=[a-zåäö]+\s)|\s+och\s+(?=(?:inför|förbjud|sänk|höj|bygg|avskaffa|ta bort|öka|minska|satsa|stoppa|tillåt|legalisera|stäng|skrota|rusta|anställ|ge|ny|nya|fler|mer|mindre|färre|förstatlig|nationalis|privatiser|exproprier|återinför|skjut|lägg ned|lägg ner)[a-zåäö]*\b)/i)).filter((x) => x.trim().length > 3);
  for (const s of parts) {
    const c = policyCandidates(s, 3).filter((x) => x.sim >= .3);
    for (const { p } of c.slice(0, 3)) {
      if (out.has(p.id)) continue;
      const cur = program[p.id] ?? p.def; const t = s.toLowerCase();
      let to = null;
      if (p.type === 'choice') to = choiceFromText(p, s, .32);
      else {
        const n = numIn(s);
        const nn = n != null && p.unit === 'tusen' && n > p.max && n >= 1000 ? n / 1000 : n;
        if (nn != null && nn >= p.min && nn <= p.max) to = snap(p, nn);
        else if (/fördubbl|dubbla|dubblera/.test(t) && cur > 0) to = snap(p, cur * 2);
        else if (/halver/.test(t) && cur > 0) to = snap(p, cur / 2);
        else { const d = dirOf(t, isTaxLike(p)); if (d) to = snap(p, cur + d * (p.max - p.min) * .15); }
      }
      if (to != null) { if (to !== cur) out.set(p.id, { id: p.id, from: cur, to, why: s }); break; } // redan så i programmet = träff, gå inte vidare till sämre kandidater
    }
  }
  return [...out.values()];
}
function parseValue(p, varde, cur) {
  const v = String(varde || '').toLowerCase();
  if (p.type === 'choice') { const exact = p.options.find((o) => o.id === v || o.name.toLowerCase() === v); if (exact) return exact.id; return choiceFromText(p, v); }
  const n0 = numIn(v); const n = n0 != null && p.unit === 'tusen' && n0 > p.max && n0 >= 1000 ? n0 / 1000 : n0;
  if (n != null) return snap(p, n);
  const d = dirOf(v, isTaxLike(p)); if (d) return snap(p, cur + d * (p.max - p.min) * .15);
  return null;
}
// Huvudfunktionen. Returnerar [{ id, from, to, why }] och vilken metod som användes.
export async function mapPolicyText(text, program = {}) {
  if (!String(text || '').trim()) return { changes: [], via: 'tom' };
  const cands = policyCandidates(text, 14);
  if (localReady() && cands.length) {
    try {
      const list = cands.map(({ p }) => ({ id: p.id, name: `${p.name} (${DOMAINS[p.domain] || p.domain})`, cur: policyLabel(p, program[p.id] ?? p.def), ...(p.type === 'choice' ? { options: p.options.map((o) => o.name) } : { range: `${policyLabel(p, p.min)}–${policyLabel(p, p.max)}` }) }));
      const { messages, schema } = policyMessages({ text, candidates: list });
      const r = await localJSON(messages, schema, { max: 260, temp: .1, penalty: .2 });
      const changes = [];
      for (const ch of r.andringar || []) { const p = POLICY_BY_ID[ch.id]; if (!p || changes.some((x) => x.id === p.id)) continue; const cur = program[p.id] ?? p.def; const to = parseValue(p, ch.varde, cur); if (to != null && to !== cur) changes.push({ id: p.id, from: cur, to, why: ch.varde }); }
      if (changes.length) return { changes, via: 'ai' };
    } catch (e) { console.warn('politik-tolkning', e.message); }
  }
  return { changes: heuristicPolicyMap(text, program), via: 'regler' };
}
