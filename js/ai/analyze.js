// Textförståelsen – fungerar utan nätverk. Tre lager som alla ger samma resultatform:
//  1. kunskapsbasen (ai/kb.js) matchad med teckentrigram, mening för mening (böjningar, stavfel, fria formuleringar)
//  2. ordlistor och mönster (siffror, löften, faktapåståenden, negationer, intensitet)
//  3. valfritt: inbäddningar på enheten (ai/embed.js, ctx.extraHits) eller Claude (ai/llm.js) som berikar
// Resultat: { tone: {saklig, kampande, aggressiv, humor, kansla, undvikande, dryg}, dominant, clarity, length,
//   answers (0–1), issues: {issueId: vikt}, stance: {issueId: -1..1}, promises, claims, attacks, mentions, vague,
//   risky (0–100), keywords, emotion: {insult, mock, praise, empathy, threat, concede}, intensity (0–1), dryg (0–1),
//   topics (sorterade frågor), policies (träffade politikområden), sentences }
import { ISSUES, ISSUE_BY_ID } from '../data/issues.js';
import { STAT_BY_ID } from '../data/stats.js';
import { clamp } from '../core/util.js';
import { kbEntries } from './kb.js';
import { Index, trigrams, dice } from './ngram.js';

let IDX = null;
export const kbIndex = () => IDX || (IDX = new Index(kbEntries()));
export const TONES = ['saklig', 'kampande', 'aggressiv', 'humor', 'kansla', 'undvikande', 'dryg'];

const ISSUE_WORDS = {
  ekonomi: ['skatt', 'skatter', 'budget', 'ekonomi', 'statsskuld', 'underskott', 'inflation', 'tillväxt', 'bnp', 'finansier', 'pengar', 'kostnad', 'räntor', 'räntan', 'jobbskatteavdrag', 'moms', 'bolagsskatt', 'överskott', 'priser', 'plånbok', 'miljard'],
  migration: ['invandring', 'invandrare', 'migration', 'asyl', 'flykting', 'integration', 'medborgarskap', 'gräns', 'utvisning', 'anhörig', 'uppehållstillstånd', 'nyanlända', 'språkkrav', 'förort'],
  kriminal: ['brott', 'gäng', 'polis', 'straff', 'fängelse', 'skjutning', 'sprängning', 'trygghet', 'kriminal', 'visitation', 'domstol', 'narkotika', 'rättsväsende', 'mord', 'våld'],
  klimat: ['klimat', 'utsläpp', 'koldioxid', 'miljö', 'fossil', 'natur', 'skog', 'bensin', 'omställning', 'grön', 'planeten'],
  forsvar: ['försvar', 'militär', 'nato', 'värnplikt', 'soldat', 'beredskap', 'ryssland', 'säkerhet', 'krig', 'upprustning'],
  eu: ['eu', 'bryssel', 'europa', 'euro', 'bistånd', 'fn', 'utrikes', 'diplomati', 'internationell', 'handel', 'tullar'],
  valfard: ['sjukvård', 'vård', 'vårdkö', 'skola', 'lärare', 'elever', 'äldreomsorg', 'sjuksköterska', 'läkare', 'friskola', 'tandvård', 'omsorg', 'patienter', 'välfärd', 'akuten', 'sjukhus', 'förskola'],
  landsbygd: ['landsbygd', 'glesbygd', 'norrland', 'bönder', 'lantbruk', 'jordbruk', 'hela landet', 'storstad', 'diesel', 'avstånd', 'byn'],
  varderingar: ['värderingar', 'familj', 'religion', 'kyrka', 'hbtq', 'jämställdhet', 'tradition', 'frihet', 'kultur', 'identitet', 'abort', 'yttrandefrihet', 'monarki'],
  arbete: ['arbetsmarknad', 'fack', 'las', 'anställning', 'arbetslöshet', 'lön', 'löner', 'arbetstid', 'strejk', 'a-kassa', 'arbetsgivare', 'jobb', 'pension'],
  bostad: ['bostad', 'bostäder', 'hyra', 'hyror', 'bygga', 'byggande', 'bolån', 'bostadskö', 'bostadsbrist', 'hyresrätt', 'lägenhet'],
  energi: ['energi', 'el', 'elpris', 'kärnkraft', 'vindkraft', 'solkraft', 'reaktor', 'elnät', 'vattenkraft', 'elräkning'],
};
const RIGHT_WORDS = { ekonomi: ['sänk', 'sänka', 'lägre skatt', 'skattesänkning', 'mindre stat', 'avreglera', 'privat'], migration: ['minska', 'stram', 'restriktiv', 'stoppa', 'krav', 'utvisa', 'begränsa', 'hårdare', 'stäng'], kriminal: ['hårdare', 'skärp', 'längre straff', 'fler poliser', 'visitation', 'krossa', 'nolltolerans'], klimat: ['tillväxt först', 'sänkt bensinskatt', 'orealistisk', 'symbolpolitik', 'bilen'], forsvar: ['rusta', 'upprust', 'starkare försvar', 'nato', 'höja försvars', 'fler soldater'], eu: ['fördjupa', 'mer eu', 'euron', 'europeisk'], valfard: ['valfrihet', 'privata', 'vårdval', 'friskol', 'konkurrens'], landsbygd: ['hela landet', 'landsbygden först', 'sänkt diesel', 'glesbygd'], varderingar: ['tradition', 'familjen', 'svenska värderingar', 'kristen', 'ordning'], arbete: ['flexib', 'lättare att anställa', 'reformera las', 'företagen'], bostad: ['marknadshyr', 'avreglera', 'bygglov', 'fri hyressättning'], energi: ['kärnkraft', 'reaktor', 'ny kärnkraft'] };
const LEFT_WORDS = { ekonomi: ['höj', 'höja skatt', 'omfördel', 'rättvis', 'de rika', 'välfärden före', 'mer resurser', 'satsa'], migration: ['human', 'öppen', 'solidar', 'asylrätt', 'välkomna', 'generös'], kriminal: ['förebygg', 'rehabilit', 'sociala', 'orsaker', 'fritidsgård', 'socialtjänst'], klimat: ['klimatkris', 'nettonoll', 'utsläppen ned', 'koldioxidskatt', 'omställning', 'fossilfri'], forsvar: ['nedrust', 'diplomati', 'fred', 'alliansfri', 'lämna nato'], eu: ['lämna eu', 'svexit', 'suverän', 'bryssel bestämmer', 'folkomröst'], valfard: ['vinstförbud', 'vinster i välfärden', 'offentlig', 'förstatliga', 'gemensam'], landsbygd: ['storstad', 'urban', 'städerna'], varderingar: ['progressiv', 'hbtq', 'jämställd', 'feminis', 'öppet samhälle', 'liberal'], arbete: ['facket', 'anställningsskydd', 'trygghet på jobbet', 'kollektivavtal', 'höjd a-kassa', 'kortare arbetstid'], bostad: ['hyresreglering', 'allmännytta', 'bostad är en rättighet', 'statligt byggande', 'hyrestak'], energi: ['vindkraft', 'förnybar', 'sol', 'avveckla kärnkraft'] };
const TONE_WORDS = {
  aggressiv: ['ljuger', 'lögn', 'skäms', 'katastrof', 'svek', 'idiot', 'inkompetent', 'skandal', 'förräd', 'hyckl', 'patetisk', 'korrupt', 'ansvarslös', 'fiasko', 'borde avgå', 'vansinne', 'hot mot sverige', 'bedrägeri', 'skit', 'jävla', 'fan '],
  kampande: ['nu räcker det', 'vi kommer', 'vi ska', 'det är dags', 'kämpa', 'tillsammans', 'förändring', 'sverige förtjänar', 'vi lovar', 'på riktigt', 'framåt', 'vi tar strid', 'vi står upp'],
  saklig: ['procent', 'miljard', 'miljoner', 'enligt', 'rapport', 'statistik', 'beräkn', 'finansier', 'analys', 'utredning', 'siffr', 'data', 'konkret', 'förslag', 'reform', 'kronor', 'budget', 'innebär'],
  humor: ['😂', '🤣', '😅', 'haha', 'lol', 'skämt', 'ironi', '🧦', '🤷', 'komedi', 'cirkus', 'hahaha', 'mitt ansikte', 'lustigt', 'roligt'],
  kansla: ['hjärta', 'familj', 'barn', 'träffade', 'berättade', 'tänker på', 'ledsen', 'stolt', 'människor', 'oroliga', 'vardagen', 'drömmar', 'mamma', 'pappa', 'tårar', 'kärlek', 'hopp', 'mormor', 'farfar'],
  undvikande: ['kommenterar inte', 'inga kommentarer', 'vi återkommer', 'det viktiga är', 'låt mig i stället', 'jag vill inte spekulera', 'det får vi se', 'komplicerat', 'vi får titta på', 'ingen kommentar', 'vi utreder', 'för tidigt att säga'],
  dryg: ['lilla vän', 'uppenbarligen', 'som alla begriper', 'förstår du inte', 'försök hänga med', 'läs på', 'fattar ingenting', 'under min nivå', 'jag vet bättre', 'pinsamt att du', 'den vuxna i rummet', 'inte så svårt'],
};
const INSULTS = ['idiot', 'dum i huvudet', 'korkad', 'inkompetent', 'lögnare', 'patetisk', 'clown', 'värdelös', 'ynklig', 'feg', 'ful', 'tjock', 'skäms', 'håll käften', 'förrädare', 'marionett', 'ryggrad', 'skitstövel', 'pajas', 'nolla'];
const INTENSIFIERS = ['helt', 'totalt', 'fullständigt', 'extremt', 'jävla', 'sjukt', 'otroligt', 'vansinnigt', 'fruktansvärt', 'absolut', 'verkligen'];
const STAT_ALIASES = { arbetslöshet: 'arbetsloshet', arbetslösheten: 'arbetsloshet', inflation: 'inflation', inflationen: 'inflation', statsskuld: 'statsskuld_bnp', statsskulden: 'statsskuld_bnp', skjutningar: 'skjutningar', skjutningarna: 'skjutningar', styrränta: 'styrranta', styrräntan: 'styrranta', 'bnp-tillväxt': 'bnp_tillvaxt', tillväxt: 'bnp_tillvaxt', tillväxten: 'bnp_tillvaxt', vårdköer: 'vardkoer', vårdkön: 'vardkoer', elpris: 'elpris', elpriset: 'elpris', bensinpris: 'bensinpris', bensinpriset: 'bensinpris', utsläpp: 'utslapp', utsläppen: 'utslapp', poliser: 'poliser', asylsökande: 'asylsokande', 'dödligt våld': 'dodligt_vald', medianlön: 'medianlon', medianlönen: 'medianlon', gini: 'gini', sysselsättning: 'sysselsattning', ungdomsarbetslöshet: 'ungdomsarbetsloshet', ungdomsarbetslösheten: 'ungdomsarbetsloshet', byggstarter: 'byggstarter' };

const lower = (s) => (s || '').toLowerCase();
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (t, w) => (w.length <= 4 && !/[^a-zåäö]/.test(w) ? new RegExp(`(^|[^a-zåäö])${esc(w)}([^a-zåäö]|$)`).test(t) : t.includes(w));
const count = (t, words) => words.reduce((a, w) => a + (hasWord(t, w) ? 1 : 0), 0);
const parseNumber = (s) => { const m = s.replace(/\s/g, '').replace(',', '.'); const v = parseFloat(m); return Number.isFinite(v) ? v : null; };

// ---- svenska räkneord → siffror ("tio procent", "femtiotusen", "tjugofem miljarder", "två hundra") ----
const ONES = { noll: 0, en: 1, ett: 1, två: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, åtta: 8, nio: 9, tio: 10, elva: 11, tolv: 12, tretton: 13, fjorton: 14, femton: 15, sexton: 16, sjutton: 17, arton: 18, nitton: 19 };
const TENS = { tjugo: 20, trettio: 30, fyrtio: 40, femtio: 50, sextio: 60, sjuttio: 70, åttio: 80, nittio: 90 };
function numWord(w) {
  if (w in ONES) return ONES[w]; if (w in TENS) return TENS[w];
  if (w.endsWith('tusen')) { const p = w.slice(0, -5); const v = p ? numWord(p) : 1; return v == null ? null : v * 1000; }
  if (w.endsWith('hundra')) { const p = w.slice(0, -6); const v = p ? numWord(p) : 1; return v == null ? null : v * 100; }
  for (const t in TENS) if (w.startsWith(t) && w.length > t.length) { const r = ONES[w.slice(t.length)]; if (r != null && r < 10) return TENS[t] + r; }
  if (w === 'halv' || w === 'halva') return .5;
  return null;
}
export function wordsToDigits(t) {
  // enstaka räkneord ("tio procent"); "en/ett" bara framför enhet
  let s = t.replace(/\b([a-zåäö]+)\b(?=\s*(procent|%|miljard|miljon|tusen|kronor|kr\b|bostäder|poliser|platser|lärare|år\b|mdkr))/g, (m, w) => { const v = numWord(w); return v == null ? m : String(v); });
  s = s.replace(/\b(tjugo|trettio|fyrtio|femtio|sextio|sjuttio|åttio|nittio|hundra|tusen|tio|tolv|femton|arton|tjugofem|femtiotusen|hundratusen|tiotusen|tusentals)\b/g, (m) => { const v = numWord(m); return v == null ? m : String(v); });
  s = s.replace(/\b(\d+)\s+(hundra|tusen)\b/g, (m, n, u) => String(+n * (u === 'hundra' ? 100 : 1000)));
  return s;
}

export const splitSentences = (text) => String(text || '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 2);
export function analyzeText(text, ctx = {}) {
  const raw = String(text || '');
  const t = lower(raw).replace(/\s+/g, ' ').trim();
  const words = t.split(' ').filter(Boolean);
  const len = words.length;
  const out = { tone: Object.fromEntries(TONES.map((k) => [k, 0])), dominant: 'saklig', clarity: .5, length: len, answers: .5, issues: {}, stance: {}, promises: [], claims: [], attacks: [], mentions: [], vague: false, risky: 0, keywords: [], questionsBack: 0, emotion: { insult: 0, mock: 0, praise: 0, empathy: 0, threat: 0, concede: 0 }, intensity: 0, dryg: 0, topics: [], policies: [], sentences: 0, hits: [] };
  if (!len) { out.vague = true; out.clarity = 0; out.answers = 0; return out; }
  const sentences = splitSentences(raw);
  out.sentences = sentences.length;
  // ---- 1. kunskapsbasen, mening för mening ----
  const issueW = {}, stanceSum = {}, stanceW = {}, toneS = Object.fromEntries(TONES.map((k) => [k, 0])), emo = { ...out.emotion };
  const idx = kbIndex();
  const addHit = (hit, negated, src) => {
    const e = hit.entry; const w = hit.sim * hit.sim * (src === 'embed' ? 1.3 : 1);
    if (e.kind === 'issue') { issueW[e.issue] = (issueW[e.issue] || 0) + w; if (e.dir && hit.sim >= .45) { stanceSum[e.issue] = (stanceSum[e.issue] || 0) + e.dir * w * (negated ? -.7 : 1); stanceW[e.issue] = (stanceW[e.issue] || 0) + w; } if (e.policy && !out.policies.includes(e.policy)) out.policies.push(e.policy); }
    else if (e.kind === 'tone') { if (hit.sim >= .4) toneS[e.tone] += w * 2; }
    else if (e.kind === 'emo') { if (hit.sim >= .4) emo[e.emo] += w * (negated && e.emo !== 'insult' ? .5 : 1); }
    out.hits.push({ t: e.t, sim: Math.round(hit.sim * 100) / 100, kind: e.kind, issue: e.issue, dir: e.dir, tone: e.tone, emo: e.emo });
  };
  sentences.forEach((s, i) => {
    const ls = lower(s); const negated = /(^|[^a-zåäö])(inte|aldrig|ej|icke|knappast)([^a-zåäö]|$)/.test(ls);
    for (const h of idx.search(s, { top: 10, min: .3 })) addHit(h, negated, 'kb');
    for (const h of (ctx.extraHits || []).filter((x) => x.sentence === i)) addHit(h, negated, 'embed');
  });
  // ---- 2. ordlistor ----
  for (const is of ISSUES) {
    const n = count(t, ISSUE_WORDS[is.id] || []); if (n) issueW[is.id] = (issueW[is.id] || 0) + n * .6;
    const r = count(t, RIGHT_WORDS[is.id] || []), l = count(t, LEFT_WORDS[is.id] || []);
    if (r || l) { const neg = /(^|[^a-zåäö])(inte|aldrig)([^a-zåäö]|$)/.test(t) && len < 14; stanceSum[is.id] = (stanceSum[is.id] || 0) + (r - l) * .6 * (neg ? -.7 : 1); stanceW[is.id] = (stanceW[is.id] || 0) + (r + l) * .6; }
  }
  for (const k in TONE_WORDS) toneS[k] += count(t, TONE_WORDS[k]);
  const capsLetters = (raw.match(/[A-ZÅÄÖ]/g) || []).length, letters = (raw.match(/[A-Za-zÅÄÖåäö]/g) || []).length;
  const capsRatio = letters > 6 ? capsLetters / letters : 0;
  const bangs = (raw.match(/!/g) || []).length;
  toneS.aggressiv += (bangs > 2 ? 1 : 0) + (capsRatio > .6 ? 2 : 0);
  if (/\d/.test(t)) toneS.saklig += 1;
  for (const w of INSULTS) if (hasWord(t, w)) emo.insult += .35;
  // tydligt beröm/medhåll utan förolämpningar → svaga träffar på aggressiva fraser är falsklarm
  if ((emo.praise || 0) + (emo.concede || 0) + (emo.empathy || 0) > .8 && (emo.insult || 0) < .3 && count(t, TONE_WORDS.aggressiv) === 0) { toneS.aggressiv *= .25; toneS.dryg *= .5; }
  out.intensity = clamp((capsRatio > .6 ? .5 : capsRatio > .3 ? .2 : 0) + (bangs >= 4 ? .4 : bangs >= 2 ? .2 : 0) + count(t, INTENSIFIERS) * .15, 0, 1);
  // ---- sammanvägning ----
  const issuesSorted = Object.entries(issueW).filter(([, w]) => w >= .3).sort((a, b) => b[1] - a[1]);
  for (const [id, w] of issuesSorted) out.issues[id] = Math.round(w * 100) / 100;
  out.topics = issuesSorted.map(([id]) => id);
  for (const id in stanceW) if (stanceW[id] > 0) { const v = stanceSum[id] / stanceW[id]; if (Math.abs(v) > .15) out.stance[id] = clamp(Math.round(v * 100) / 100, -1, 1); }
  const tot = Object.values(toneS).reduce((a, b) => a + b, 0), maxTone = Math.max(...Object.values(toneS));
  for (const k of TONES) out.tone[k] = tot ? Math.round((toneS[k] / tot) * 100) / 100 : 0;
  out.dominant = maxTone > 0 ? TONES.slice().sort((a, b) => toneS[b] - toneS[a])[0] : 'saklig';
  if (tot <= .5 && len < 8) out.dominant = 'undvikande';
  for (const k in emo) out.emotion[k] = clamp(Math.round(Math.min(1, emo[k] / 1.1) * 100) / 100, 0, 1);
  out.dryg = clamp(Math.round(Math.min(1, toneS.dryg / 1.4) * 100) / 100, 0, 1);
  // ---- löften med siffror ----
  const tn = wordsToDigits(t);
  const promiseRe = /(ska|kommer att|lovar|garanterar|inför|införa|bygga|bygger|sänka|sänker|höja|höjer|halvera|fördubbla|avskaffa|anställa|satsa|satsar)[^.!?]{0,80}?(\d[\d\s]{0,8}(?:[.,]\d+)?)\s*(procent|%|miljarder|miljard|miljoner|miljon|tusen|kronor|kr|nya bostäder|bostäder|poliser|lärare|platser|år|mdkr)/g;
  let m;
  const sentenceAt = (idx2) => { let s = 0; for (const seg of raw.split(/(?<=[.!?])\s+/)) { if (idx2 < s + seg.length + 1) return seg.trim(); s += seg.length + 1; } return raw.slice(0, 160); };
  while ((m = promiseRe.exec(tn))) {
    const num = parseNumber(m[2]); if (num == null) continue;
    const before = tn.slice(Math.max(0, m.index + m[0].length - m[2].length - m[3].length - 12), m.index + m[0].length - m[2].length - m[3].length);
    if (m[3] === 'år' && (/(under|över|äldre än|yngre än|fyllt|vid|från)\s*$/.test(before) || num > 60)) continue;
    const ratio = raw.length / tn.length;
    out.promises.push({ text: sentenceAt(Math.round(m.index * ratio)).slice(0, 200), number: num, unit: m[3].replace(/^miljard$/, 'miljarder').replace(/^miljon$/, 'miljoner'), issue: out.topics[0] || null });
  }
  // "10 procent lägre skatt", "50 000 fler poliser" – utan löftesverb
  const promiseRe2 = /(\d[\d\s]{0,8}(?:[.,]\d+)?)\s*(procent|%|miljarder|miljoner|tusen|kronor|kr)\s+(lägre|högre|fler|färre|mer|mindre|billigare|dyrare)/g;
  while ((m = promiseRe2.exec(tn))) { const num = parseNumber(m[1]); if (num == null || out.promises.some((p) => p.number === num)) continue; const ratio = raw.length / tn.length; out.promises.push({ text: sentenceAt(Math.round(m.index * ratio)).slice(0, 200), number: num, unit: m[2], issue: out.topics[0] || null }); }
  if (/(ska|kommer att|lovar|garanterar)/.test(t) && !out.promises.length && (/(aldrig|alltid|inom|senast)/.test(t))) out.promises.push({ text: raw.slice(0, 140), number: null, unit: null, issue: out.topics[0] || null, absolute: /aldrig|alltid/.test(t) });
  // ---- faktapåståenden ----
  const stats = ctx.stats || {};
  const claimRe = /([a-zåäö\-]+(?: [a-zåäö]+)?)\s+(?:är|ligger på|uppgår till|var|är nu|är i dag)\s+(?:bara |hela |över |under |nästan |runt |cirka |ca )?(\d[\d\s]{0,6}(?:[.,]\d+)?)\s*(procent|%|miljarder|per år|kronor|kr)?/g;
  while ((m = claimRe.exec(tn))) {
    const key = Object.keys(STAT_ALIASES).find((k) => m[1].endsWith(k) || m[1].includes(k)); if (!key) continue;
    const id = STAT_ALIASES[key]; const val = parseNumber(m[2]); if (val == null) continue;
    const actual = stats[id]; const st = STAT_BY_ID[id];
    const ok = actual == null ? null : Math.abs(val - actual) <= Math.max(Math.abs(actual) * .15, st?.d === 0 ? 1 : .3);
    out.claims.push({ stat: id, name: st?.name || key, value: val, actual, ok });
  }
  // ---- angrepp & omnämnanden ----
  const hostile = out.tone.aggressiv > .2 || out.emotion.insult > 0 || /(sviker|ljuger|misslyck|ansvarslös|kaos|skäms|hot mot|katastrof)/.test(t);
  for (const p of ctx.parties || []) { const names = [lower(p.name), lower(p.abbr)].filter((x) => x.length > 1); if (names.some((n) => new RegExp(`(^|[^a-zåäö])${esc(n)}([^a-zåäö]|$)`).test(t))) { if (hostile || /mot |kritiserar|angriper/.test(t)) out.attacks.push(p.id); else out.mentions.push(p.id); } }
  for (const per of ctx.people || []) if (per.name && t.includes(lower(per.name))) out.mentions.push(per.id);
  if (ctx.opponentPartyId && (out.emotion.insult > .3 || out.emotion.mock > .5) && !out.attacks.includes(ctx.opponentPartyId)) out.attacks.push(ctx.opponentPartyId);
  // ---- tydlighet & svar på frågan ----
  out.vague = !out.topics.length && !out.promises.length && !out.claims.length && !/\d/.test(t) && len < 25;
  out.clarity = clamp(.2 + (out.topics.length ? .25 : 0) + (out.claims.length || out.promises.length ? .25 : 0) + (/\d/.test(tn) ? .15 : 0) + (len > 15 ? .1 : 0) + (len > 60 ? .05 : 0) - out.tone.undvikande * .6 - (out.topics.length > 4 ? .1 : 0), 0, 1);
  if (ctx.question) {
    const q = lower(ctx.question);
    const qWords = q.split(/[^a-zåäö0-9]+/).filter((w) => w.length > 4);
    const overlap = qWords.length ? qWords.filter((w) => t.includes(w.slice(0, 5))).length / qWords.length : 0;
    const qSim = dice(trigrams(q), trigrams(t));
    const qIssues = new Set(idx.search(q, { top: 6, min: .3 }).filter((h) => h.entry.kind === 'issue').map((h) => h.entry.issue));
    if (ctx.questionIssue) qIssues.add(ctx.questionIssue);
    const shared = out.topics.some((id) => qIssues.has(id));
    out.answers = clamp(.1 + qSim * 1.4 + (shared ? .3 : 0) + overlap * .3 + (len > 12 ? .1 : -.15) - (out.dominant === 'undvikande' ? .35 : 0) - (out.dominant === 'humor' ? .1 : 0) + (out.claims.length || out.promises.length ? .08 : 0), 0, 1);
  }
  if (/\?/.test(raw)) out.questionsBack = (raw.match(/\?/g) || []).length;
  // ---- risk ----
  out.risky = Math.round(clamp(out.tone.aggressiv * 55 + out.tone.humor * 25 + out.dryg * 25 + out.emotion.insult * 35 + out.emotion.mock * 15 + out.emotion.threat * 40 + out.intensity * 15 + (out.attacks.length ? 12 : 0) + ((out.issues.migration || out.issues.varderingar) && out.dominant !== 'saklig' ? 12 : 0) + out.promises.filter((p) => p.absolute).length * 10, 0, 100));
  out.keywords = out.topics.slice(0, 3).map((id) => ISSUE_BY_ID[id]?.short.toLowerCase()).filter(Boolean);
  return out;
}

// Tonetikett på svenska
export const toneLabel = (d) => ({ aggressiv: 'konfrontativ', kampande: 'kämpande', saklig: 'saklig', humor: 'humoristisk', kansla: 'personlig', undvikande: 'undvikande', dryg: 'dryg' })[d] || d;
export const emotionLabel = (a) => { const e = a?.emotion || {}; const top = Object.entries(e).sort((x, y) => y[1] - x[1])[0]; if (!top || top[1] < .25) return null; return { insult: 'förolämpar', mock: 'hånar', praise: 'berömmer', empathy: 'visar empati', threat: 'hotar', concede: 'ger efter' }[top[0]]; };
