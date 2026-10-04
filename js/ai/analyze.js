// Textanalys av det spelaren skriver – fungerar utan nätverk (regelbaserad). Med Claude-läget
// (js/ai/llm.js) ersätts/berikas analysen, men samma resultatform används överallt:
// { tone: {saklig, kampande, aggressiv, humor, kansla, undvikande}, dominant, clarity, length,
//   answers (0–1, hur väl texten svarar på frågan), issues: {issueId: vikt}, stance: {issueId: -1..1},
//   promises: [{text, number, unit, issue}], claims: [{stat, value, actual, ok}], attacks: [partyId],
//   mentions: [personIds], vague, risky (0–100), keywords: [] }
import { ISSUES } from '../data/issues.js';
import { STAT_BY_ID } from '../data/stats.js';
import { clamp } from '../core/util.js';

const ISSUE_WORDS = {
  ekonomi: ['skatt', 'skatter', 'budget', 'ekonomi', 'statsskuld', 'underskott', 'inflation', 'tillväxt', 'bnp', 'finansier', 'pengar', 'kostnad', 'räntor', 'jobbskatteavdrag', 'moms', 'bolagsskatt', 'överskott', 'välfärd'],
  migration: ['invandring', 'migration', 'asyl', 'flykting', 'integration', 'medborgarskap', 'gräns', 'utvisning', 'anhörig', 'uppehållstillstånd', 'nyanlända', 'språkkrav'],
  kriminal: ['brott', 'gäng', 'polis', 'straff', 'fängelse', 'skjutning', 'sprängning', 'trygghet', 'kriminal', 'visitation', 'domstol', 'narkotika', 'rättsväsende'],
  klimat: ['klimat', 'utsläpp', 'koldioxid', 'miljö', 'fossil', 'natur', 'skog', 'bensin', 'omställning', 'grön'],
  forsvar: ['försvar', 'militär', 'nato', 'värnplikt', 'soldat', 'beredskap', 'ryssland', 'säkerhet', 'krig', 'upprustning'],
  eu: ['eu', 'bryssel', 'europa', 'euro', 'bistånd', 'fn', 'utrikes', 'diplomati', 'internationell', 'handel', 'tullar'],
  valfard: ['sjukvård', 'vård', 'vårdkö', 'skola', 'lärare', 'elever', 'äldreomsorg', 'sjuksköterska', 'läkare', 'friskola', 'tandvård', 'omsorg', 'patienter', 'välfärd'],
  landsbygd: ['landsbygd', 'glesbygd', 'norrland', 'bönder', 'lantbruk', 'jordbruk', 'hela landet', 'storstad', 'diesel', 'avstånd'],
  varderingar: ['värderingar', 'familj', 'religion', 'kyrka', 'hbtq', 'jämställdhet', 'tradition', 'frihet', 'kultur', 'identitet', 'abort', 'yttrandefrihet', 'monarki'],
  arbete: ['arbetsmarknad', 'fack', 'las', 'anställning', 'arbetslöshet', 'lön', 'löner', 'arbetstid', 'strejk', 'a-kassa', 'arbetsgivare', 'jobb'],
  bostad: ['bostad', 'bostäder', 'hyra', 'hyror', 'bygga', 'byggande', 'bolån', 'bostadskö', 'bostadsbrist', 'hyresrätt'],
  energi: ['energi', 'el', 'elpris', 'kärnkraft', 'vindkraft', 'solkraft', 'reaktor', 'elnät', 'vattenkraft'],
};
const RIGHT_WORDS = { ekonomi: ['sänk', 'sänka', 'lägre skatt', 'skattesänkning', 'mindre stat', 'avreglera', 'privat'], migration: ['minska', 'stram', 'restriktiv', 'stoppa', 'krav', 'utvisa', 'begränsa', 'hårdare'], kriminal: ['hårdare', 'skärp', 'längre straff', 'fler poliser', 'visitation', 'krossa', 'nolltolerans'], klimat: ['tillväxt först', 'sänkt bensinskatt', 'orealistisk', 'symbolpolitik', 'bilen'], forsvar: ['rusta', 'upprust', 'starkare försvar', 'nato', 'höja försvars', 'fler soldater'], eu: ['fördjupa', 'mer eu', 'euron', 'europeisk'], valfard: ['valfrihet', 'privata', 'vårdval', 'friskol', 'konkurrens'], landsbygd: ['hela landet', 'landsbygden först', 'sänkt diesel', 'glesbygd'], varderingar: ['tradition', 'familjen', 'svenska värderingar', 'kristen', 'ordning'], arbete: ['flexib', 'lättare att anställa', 'reformera las', 'företagen'], bostad: ['marknadshyr', 'avreglera', 'bygglov', 'fri hyressättning'], energi: ['kärnkraft', 'reaktor', 'ny kärnkraft'] };
const LEFT_WORDS = { ekonomi: ['höj', 'höja skatt', 'omfördel', 'rättvis', 'de rika', 'välfärden före', 'mer resurser', 'satsa'], migration: ['human', 'öppen', 'solidar', 'asylrätt', 'välkomna', 'generös'], kriminal: ['förebygg', 'rehabilit', 'sociala', 'orsaker', 'fritidsgård', 'socialtjänst'], klimat: ['klimatkris', 'nettonoll', 'utsläppen ned', 'koldioxidskatt', 'omställning', 'fossilfri'], forsvar: ['nedrust', 'diplomati', 'fred', 'alliansfri', 'lämna nato'], eu: ['lämna eu', 'svexit', 'suverän', 'bryssel bestämmer', 'folkomröst'], valfard: ['vinstförbud', 'vinster i välfärden', 'offentlig', 'förstatliga', 'gemensam'], landsbygd: ['storstad', 'urban', 'städerna'], varderingar: ['progressiv', 'hbtq', 'jämställd', 'feminis', 'öppet samhälle', 'liberal'], arbete: ['facket', 'anställningsskydd', 'trygghet på jobbet', 'kollektivavtal', 'höjd a-kassa', 'kortare arbetstid'], bostad: ['hyresreglering', 'allmännytta', 'bostad är en rättighet', 'statligt byggande', 'hyrestak'], energi: ['vindkraft', 'förnybar', 'sol', 'avveckla kärnkraft'] };
const TONE = {
  aggressiv: ['ljuger', 'lögn', 'skäms', 'katastrof', 'svek', 'idiot', 'inkompetent', 'skandal', 'förräd', 'hyckl', 'skrattretande', 'patetisk', 'korrupt', 'ansvarslös', 'fiasko', '!!', 'borde avgå', 'vansinne', 'hot mot sverige', 'bedrägeri'],
  kampande: ['nu räcker det', 'vi kommer', 'vi ska', 'det är dags', 'kämpa', 'tillsammans', 'förändring', 'sverige förtjänar', 'vi lovar', 'på riktigt', 'framåt', 'nu', 'vi tar strid'],
  saklig: ['procent', 'miljard', 'miljoner', 'enligt', 'rapport', 'statistik', 'beräkn', 'finansier', 'analys', 'utredning', 'siffr', 'data', 'konkret', 'förslag', 'reform', 'kronor', 'budget'],
  humor: ['😂', '🤣', '😅', 'haha', 'lol', 'skämt', 'ironi', 'som ett skämt', '🧦', '🤷', 'komedi', 'cirkus', 'hahaha', 'mitt ansikte'],
  kansla: ['hjärta', 'familj', 'barn', 'träffade', 'berättade', 'tänker på', 'ledsen', 'stolt', 'människor', 'oroliga', 'vardagen', 'drömmar', 'mamma', 'pappa', 'tårar', 'kärlek', 'hopp'],
  undvikande: ['kommenterar inte', 'inga kommentarer', 'vi återkommer', 'det viktiga är', 'låt mig i stället', 'jag vill inte spekulera', 'det får vi se', 'komplicerat', 'vi får titta på', 'ingen kommentar', 'vi utreder'],
};
const STAT_ALIASES = { arbetslöshet: 'arbetsloshet', arbetslösheten: 'arbetsloshet', inflation: 'inflation', inflationen: 'inflation', statsskuld: 'statsskuld_bnp', statsskulden: 'statsskuld_bnp', skjutningar: 'skjutningar', skjutningarna: 'skjutningar', styrränta: 'styrranta', styrräntan: 'styrranta', 'bnp-tillväxt': 'bnp_tillvaxt', tillväxt: 'bnp_tillvaxt', tillväxten: 'bnp_tillvaxt', vårdköer: 'vardkoer', vårdkön: 'vardkoer', elpris: 'elpris', elpriset: 'elpris', bensinpris: 'bensinpris', bensinpriset: 'bensinpris', utsläpp: 'utslapp', utsläppen: 'utslapp', poliser: 'poliser', asylsökande: 'asylsokande', 'dödligt våld': 'dodligt_vald', medianlön: 'medianlon', medianlönen: 'medianlon', gini: 'gini', sysselsättning: 'sysselsattning', ungdomsarbetslöshet: 'ungdomsarbetsloshet', ungdomsarbetslösheten: 'ungdomsarbetsloshet', byggstarter: 'byggstarter' };

const lower = (s) => (s || '').toLowerCase();
const count = (text, words) => words.reduce((a, w) => a + (text.includes(w) ? 1 : 0), 0);
const parseNumber = (s) => { const m = s.replace(/\s/g, '').replace(',', '.'); const v = parseFloat(m); return Number.isFinite(v) ? v : null; };

export function analyzeText(text, ctx = {}) {
  const t = lower(text).replace(/\s+/g, ' ').trim();
  const words = t.split(' ').filter(Boolean);
  const len = words.length;
  const out = { tone: {}, dominant: 'saklig', clarity: .5, length: len, answers: .5, issues: {}, stance: {}, promises: [], claims: [], attacks: [], mentions: [], vague: false, risky: 0, keywords: [], questionsBack: 0 };
  if (!len) { out.vague = true; out.clarity = 0; out.answers = 0; return out; }
  // ton
  for (const k in TONE) out.tone[k] = count(t, TONE[k]);
  out.tone.aggressiv += (t.match(/!/g) || []).length > 2 ? 1 : 0 + (text !== text.toLowerCase() && text === text.toUpperCase() ? 2 : 0);
  if (/\d/.test(t)) out.tone.saklig += 1;
  const tot = Object.values(out.tone).reduce((a, b) => a + b, 0);
  const maxTone = Math.max(...Object.values(out.tone));
  for (const k in out.tone) out.tone[k] = tot ? Math.round((out.tone[k] / tot) * 100) / 100 : 0;
  // utan tydliga signaler är texten neutral/saklig; mycket kort text utan innehåll är undvikande
  out.dominant = maxTone > 0 ? Object.entries(out.tone).sort((a, b) => b[1] - a[1])[0][0] : 'saklig';
  if (tot <= 1 && len < 8) out.dominant = 'undvikande';
  // frågor
  for (const is of ISSUES) {
    const n = count(t, ISSUE_WORDS[is.id] || []);
    if (n) out.issues[is.id] = n;
    const r = count(t, RIGHT_WORDS[is.id] || []), l = count(t, LEFT_WORDS[is.id] || []);
    if (r || l) out.stance[is.id] = clamp((r - l) / Math.max(1, r + l), -1, 1);
  }
  // löften med siffror: "200 000 nya bostäder", "sänka skatten med 10 procent", "inom fyra år"
  const promiseRe = /(ska|kommer att|lovar|garanterar|inför|införa|bygga|sänka|höja|halvera|fördubbla|avskaffa)[^.!?]{0,80}?(\d[\d\s]{0,8}(?:[.,]\d+)?)\s*(procent|%|miljarder|miljoner|tusen|kronor|kr|nya bostäder|bostäder|poliser|platser|år|mdkr)/g;
  let m;
  while ((m = promiseRe.exec(t))) { const num = parseNumber(m[2]); if (num == null) continue; const sentence = text.slice(Math.max(0, m.index - 10), m.index + m[0].length + 20).trim(); out.promises.push({ text: sentence, number: num, unit: m[3], issue: Object.keys(out.issues)[0] || null }); }
  if (/(ska|kommer att|lovar|garanterar)/.test(t) && !out.promises.length && (/(aldrig|alltid|inom|senast)/.test(t))) out.promises.push({ text: text.slice(0, 140), number: null, unit: null, issue: Object.keys(out.issues)[0] || null, absolute: /aldrig|alltid/.test(t) });
  // faktapåståenden: "arbetslösheten är 3 %"
  const stats = ctx.stats || {};
  const claimRe = /([a-zåäö\-]+(?: [a-zåäö]+)?)\s+(?:är|ligger på|uppgår till|var)\s+(\d[\d\s]{0,6}(?:[.,]\d+)?)\s*(procent|%|miljarder|per år|kronor|kr)?/g;
  while ((m = claimRe.exec(t))) {
    const key = Object.keys(STAT_ALIASES).find((k) => m[1].endsWith(k) || m[1].includes(k)); if (!key) continue;
    const id = STAT_ALIASES[key]; const val = parseNumber(m[2]); if (val == null) continue;
    const actual = stats[id]; const st = STAT_BY_ID[id];
    const ok = actual == null ? null : Math.abs(val - actual) <= Math.max(Math.abs(actual) * .15, st?.d === 0 ? 1 : .3);
    out.claims.push({ stat: id, name: st?.name || key, value: val, actual, ok });
  }
  // angrepp & omnämnanden
  for (const p of ctx.parties || []) { const names = [lower(p.name), lower(p.abbr)].filter((x) => x.length > 1); if (names.some((n) => new RegExp(`(^|[^a-zåäö])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zåäö]|$)`).test(t))) { const neg = out.tone.aggressiv > .2 || /(sviker|ljuger|misslyck|ansvarslös|kaos|skäms|hot mot|katastrof)/.test(t); if (neg || /mot |kritiserar|angriper/.test(t)) out.attacks.push(p.id); else out.mentions.push(p.id); } }
  for (const per of ctx.people || []) if (per.name && t.includes(lower(per.name))) out.mentions.push(per.id);
  // tydlighet & svar
  out.vague = !Object.keys(out.issues).length && !out.promises.length && !out.claims.length && !/\d/.test(t) && len < 25;
  out.clarity = clamp(.2 + (Object.keys(out.issues).length ? .25 : 0) + (out.claims.length || out.promises.length ? .25 : 0) + (/\d/.test(t) ? .15 : 0) + (len > 15 ? .1 : 0) + (len > 60 ? .05 : 0) - out.tone.undvikande * .6, 0, 1);
  if (ctx.question) {
    const q = lower(ctx.question).split(/[^a-zåäö0-9]+/).filter((w) => w.length > 4);
    const hit = q.filter((w) => t.includes(w.slice(0, 5))).length;
    out.answers = clamp((q.length ? hit / q.length : .5) * .8 + (out.tone.undvikande ? -.3 : 0) + (ctx.questionIssue && out.issues[ctx.questionIssue] ? .3 : 0) + (len > 12 ? .1 : -.2), 0, 1);
  }
  if (/\?/.test(text)) out.questionsBack = (text.match(/\?/g) || []).length;
  // risk för att det landar fel
  out.risky = Math.round(clamp(out.tone.aggressiv * 60 + out.tone.humor * 30 + (out.attacks.length ? 15 : 0) + ((out.issues.migration || out.issues.varderingar) && out.dominant !== 'saklig' ? 15 : 0) + (text === text.toUpperCase() && len > 3 ? 20 : 0) + out.promises.filter((p) => p.absolute).length * 10, 0, 100));
  out.keywords = Object.keys(out.issues).map((id) => ISSUES.find((i) => i.id === id)?.short.toLowerCase()).filter(Boolean);
  return out;
}

// Tonetikett på svenska
export const toneLabel = (d) => ({ aggressiv: 'konfrontativ', kampande: 'kämpande', saklig: 'saklig', humor: 'humoristisk', kansla: 'personlig', undvikande: 'undvikande' })[d] || d;
