// Politik med egna ord → konkreta värden i politikområdena. Steg 1: hitta kandidatområden (trigram
// mot områdenas namn, beskrivningar och alternativ). Steg 2: spelets AI-modell väljer områden och
// värden – eller, utan modell, en regelbaserad tolkning (höj/sänk/inför/förbjud/siffror).
import { POLICIES, POLICY_BY_ID, DOMAINS, policyLabel } from '../data/policies.js';
import { trigrams, dice } from './ngram.js';
import { splitSentences, wordsToDigits } from './analyze.js';
import { localReady, localJSON } from './local.js';
import { policyMessages } from './prompts.js';

// Vardagsord → ord som står i politikområdenas namn (så att "bensinskatten" hittar "Drivmedelsskatt")
const SYN = [[/bensin|diesel|soppa|drivmedel|pumppris/, 'drivmedel'], [/pensionär|pension|äldre|ålderdom/, 'pension äldre'], [/invandr|flykting|asyl|nyanländ|migrant/, 'asyl migration invandring'], [/polis|snut|ordningsmakt/, 'polis'], [/gäng|skjut|spräng|kriminell/, 'gäng straff polis'], [/lärare|elev|klassrum|skola|skolor/, 'skola'], [/friskol|skolkoncern|vinst/, 'vinst skola friskol'], [/tunnelbana|buss|pendeltåg|spårvagn|kollektiv|sl-kort|månadskort/, 'kollektivtrafik'], [/tåg|järnväg|höghastighet/, 'järnväg tåg'], [/sjukhus|akut|vård|sjuksköterska|läkare|vårdkö/, 'vård sjukvård'], [/hyra|hyror|hyresrätt|lägenhet|bostad/, 'hyra bostad bygg'], [/kärnkraft|reaktor/, 'kärnkraft'], [/vindkraft|vindkraftverk/, 'vindkraft'], [/el-pris|elpris|elräkning|elnät/, 'el energi'], [/försvar|militär|soldat|värnplikt|nato/, 'försvar värnplikt'], [/klimat|utsläpp|koldioxid/, 'klimat koldioxid utsläpp'], [/bidrag|socialbidrag|försörjningsstöd/, 'bidrag'], [/a-kassa|arbetslös/, 'a-kassa arbetslöshet'], [/las\b|anställningsskydd|turordning/, 'anställningsskydd las'], [/barnbidrag|föräldrapenning|föräldraledig|förskola|barnomsorg/, 'barn föräldra förskola'], [/eu\b|europeiska unionen|bryssel/, 'eu'], [/bistånd/, 'bistånd'], [/kultur|teater|museum|bibliotek|public service|svt|sveriges radio/, 'kultur public service'], [/alkohol|systembolag|sprit|öl\b|vin\b/, 'alkohol'], [/spel|casino|kasino|spelbolag/, 'spel'], [/narkotika|cannabis|knark/, 'narkotika'], [/kommunalskatt/, 'kommunalskatt'], [/statlig skatt|värnskatt|höginkomst|de rika|rikaste/, 'statlig inkomstskatt brytpunkt'], [/bolagsskatt|företagsskatt/, 'bolagsskatt'], [/moms/, 'moms'], [/ränteavdrag|bolån/, 'ränteavdrag'], [/arvsskatt|arv\b/, 'arvsskatt'], [/fastighetsskatt|fastighetsavgift|villa/, 'fastighet'], [/rut|rot\b|hushållsnära/, 'rut rot']];
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
const UP = /(höj|öka|mer |fler|utök|bygg|satsa|stärk|fördubbl|dubbl|större|höga|högre|\bny\b|\bnya\b|\bnytt\b)/; const DOWN = /(sänk|minsk|färre|mindre|skär|halver|avveckl|lägre|stryp|ta bort|dra ned|dra ner)/;
const numIn = (s) => { const m = wordsToDigits(s.toLowerCase()).replace(/(\d)\s(?=\d{3}\b)/g, '$1').match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(',', '.')) : null; };
function choiceFromText(p, s, minDice = .18) {
  const t = s.toLowerCase();
  const kw = [[/förbjud|förbud|stoppa|olagligt/, /förbud|stopp|förbjud|olaglig/], [/avskaffa|ta bort|slopa/, /avskaff|ingen|inget|slopa|nej\b/], [/inför|införa|ja till/, /ja\b|inför|obligator/], [/tillåt|legalis|fri |fritt|släpp/, /fri|tillåt|legal/], [/privat/, /privat|marknad/], [/statlig|förstatlig|offentlig/, /statlig|offentlig|förstatlig/], [/stäng/, /stäng/], [/hård|skärp|strän/, /hård|skärp|strän/], [/mild|förebygg|lokal/, /förebygg|lokal|mild/]];
  for (const [re, opt] of kw) if (re.test(t)) { const o = p.options.find((x) => opt.test(x.name.toLowerCase())); if (o) return o.id; }
  const g = trigrams(t); let best = null, bs = minDice;
  for (const o of p.options) { const d = dice(g, trigrams(o.name)); if (d > bs) { bs = d; best = o.id; } }
  return best;
}
// Regelbaserad tolkning: bästa område per mening + riktning/siffra/alternativ
export function heuristicPolicyMap(text, program = {}) {
  const out = new Map();
  // dela också på "och" så att "bygg ut tunnelbanan och förbjud vinster i skolan" blir två ställningstaganden
  const parts = splitSentences(text).flatMap((s) => s.split(/,\s+(?=[a-zåäö]+\s)|\s+och\s+(?=(?:inför|förbjud|sänk|höj|bygg|avskaffa|ta bort|öka|minska|satsa|stoppa|tillåt|legalisera|stäng|skrota|rusta|anställ|ge|ny|nya|fler|mer|mindre|färre)[a-zåäö]*\b)/i)).filter((x) => x.trim().length > 3);
  for (const s of parts) {
    const c = policyCandidates(s, 3).filter((x) => x.sim >= .3);
    for (const { p } of c.slice(0, 3)) {
      if (out.has(p.id)) continue;
      const cur = program[p.id] ?? p.def; const t = s.toLowerCase();
      let to = null;
      if (p.type === 'choice') to = choiceFromText(p, s, .32);
      else {
        const n = numIn(s);
        if (n != null && n >= p.min && n <= p.max) to = snap(p, n);
        else if (UP.test(t)) to = snap(p, cur + (p.max - p.min) * .15);
        else if (DOWN.test(t)) to = snap(p, cur - (p.max - p.min) * .15);
      }
      if (to != null && to !== cur) { out.set(p.id, { id: p.id, from: cur, to, why: s }); break; }
    }
  }
  return [...out.values()];
}
function parseValue(p, varde, cur) {
  const v = String(varde || '').toLowerCase();
  if (p.type === 'choice') { const exact = p.options.find((o) => o.id === v || o.name.toLowerCase() === v); if (exact) return exact.id; return choiceFromText(p, v); }
  const n = numIn(v);
  if (n != null) return snap(p, n);
  if (UP.test(v)) return snap(p, cur + (p.max - p.min) * .15);
  if (DOWN.test(v)) return snap(p, cur - (p.max - p.min) * .15);
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
