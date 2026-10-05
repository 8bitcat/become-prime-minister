// Känslor hos dem du talar med: motståndare, journalister, partikamrater. Det du skriver kan göra
// dem arga, ledsna, glada, nervösa – i vilken grad som helst – och det påverkar hur de svarar, hur
// publiken reagerar, relationerna efteråt och vad de minns (agg).
import { clamp, pick } from '../core/util.js';

export const blankMood = () => ({ anger: 0, joy: 0, sad: 0, fear: 0 });
export function moodOf(person) { person.mood ||= blankMood(); return person.mood; }

// Känsloförändring utifrån analysen av det spelaren sa + hur rundan gick
export function moodDelta(a, { ok = null, caught = false, concede = false, interrupt = false } = {}) {
  const e = a.emotion || {}; const I = 1 + (a.intensity || 0);
  const d = { anger: 0, joy: 0, sad: 0, fear: 0 };
  d.anger += (e.insult || 0) * 28 * I + (e.mock || 0) * 16 * I + (e.threat || 0) * 12 + (a.tone?.dryg || 0) * 14 + (a.dominant === 'aggressiv' ? 8 * I : 0) + (a.dominant === 'dryg' ? 6 : 0);
  d.sad += (e.mock || 0) * 10 + (e.insult || 0) * 8 + (caught ? 10 : 0);
  d.fear += (e.threat || 0) * 22 + (caught ? 16 : 0) + ((a.claims || []).filter((c) => c.ok === true).length ? 4 : 0);
  d.joy += (e.praise || 0) * 18 + (e.empathy || 0) * 10 + (e.concede || 0) * 12 + (a.dominant === 'humor' && !(e.mock > 0) ? 5 : 0);
  if (e.empathy) { d.anger -= 8 * e.empathy; d.sad -= 6 * e.empathy; }
  if (ok === true) { d.anger += 4; d.sad += 3; } else if (ok === false) d.joy += 5;
  if (concede) d.joy += 8;
  if (interrupt) d.anger += 3;
  return d;
}
// Temperamentet avgör hur mycket som fastnar: lugna personer tar det med ro, aggressiva flammar upp
export function applyMood(person, d) { return applyMoodTo(moodOf(person), d, person.traits || {}); }
export function applyMoodTo(m, d, t = {}) {
  const calm = 1 - ((t.lugn ?? 45) - 45) / 110, hot = 1 + ((t.aggressivitet ?? 45) - 45) / 90, thin = 1 - ((t.stresstalighet ?? 45) - 45) / 120;
  m.anger = clamp(m.anger + d.anger * calm * hot, 0, 100);
  m.sad = clamp(m.sad + d.sad * calm * thin, 0, 100);
  m.fear = clamp(m.fear + d.fear * thin, 0, 100);
  m.joy = clamp(m.joy + d.joy, 0, 100);
  if (d.joy > 0) { m.anger = clamp(m.anger - d.joy * .4, 0, 100); m.sad = clamp(m.sad - d.joy * .3, 0, 100); }
  if (d.anger > 0) m.joy = clamp(m.joy - d.anger * .3, 0, 100);
  return m;
}
export function decayMood(person, f = .55) { const m = person.mood; if (!m) return; for (const k in m) m[k] = Math.round(m[k] * f * 10) / 10; }

// Etikett + emoji + grad (för scenen och för texter)
export function moodLabel(m) {
  if (!m) return { key: 'neutral', label: 'samlad', emoji: '😐', level: 0 };
  const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
  const [k, v] = top;
  if (v < 18) return { key: 'neutral', label: 'samlad', emoji: '😐', level: 0 };
  const L = v >= 75 ? 3 : v >= 45 ? 2 : 1;
  const T = { anger: [['irriterad', '😒'], ['arg', '😠'], ['rasande', '🤬']], sad: [['besviken', '😕'], ['ledsen', '😢'], ['förkrossad', '😭']], fear: [['pressad', '😬'], ['nervös', '😰'], ['skärrad', '😱']], joy: [['road', '🙂'], ['glad', '😊'], ['lycklig', '😄']] };
  const [label, emoji] = T[k][L - 1];
  return { key: k, label, emoji, level: L, value: v };
}
// Uttryck och pose för figuren
export function moodExpr(m, fallbackExpr = 'neutral', fallbackPose = 'stand') {
  const l = moodLabel(m);
  if (l.level === 0) return { expr: fallbackExpr, pose: fallbackPose };
  const M = { anger: [['determined', 'cross'], ['angry', 'cross'], ['angry', 'slam']], sad: [['nervous', 'think'], ['sad', 'think'], ['sad', 'think']], fear: [['nervous', 'think'], ['nervous', 'think'], ['shocked', 'think']], joy: [['confident', 'open'], ['happy', 'open'], ['happy', 'open']] };
  const [expr, pose] = M[l.key][l.level - 1];
  return { expr, pose };
}
// Hur känslan påverkar motståndarens insats: p-modifierare för SPELAREN, gaffe-risk, utbrott, sammanbrott
export function moodEffects(m, rnd) {
  const l = moodLabel(m);
  const out = { pMod: 0, gaffe: 0, outburst: false, breakdown: false, concede: false, charmed: false, label: l };
  if (!m) return out;
  if (m.anger >= 45) { out.gaffe += (m.anger - 30) / 150; out.pMod += (m.anger - 40) / 400; }
  if (m.anger >= 70 && rnd() < (m.anger - 60) / 60) out.outburst = true;
  if (m.sad >= 45) out.pMod += (m.sad - 40) / 300;
  if (m.sad >= 70 && rnd() < (m.sad - 60) / 50) out.breakdown = true;
  if (m.fear >= 40) { out.pMod += (m.fear - 30) / 350; out.gaffe += (m.fear - 30) / 200; }
  if (m.joy >= 40 && rnd() < (m.joy - 30) / 120) out.concede = true;
  if (m.joy >= 60) out.charmed = true;
  return out;
}
// Repliker färgade av känslan (används när Claude inte är på)
export function moodReply(rnd, m, base, who = 'Motståndaren') {
  const l = moodLabel(m);
  if (l.level === 0) return base;
  const A = { anger: { 1: ['Jag ber dig hålla en anständig ton.', 'Det där var onödigt.', 'Ska vi hålla oss till sakfrågan?'], 2: ['Nu får du faktiskt ge dig!', 'Jag tänker inte stå här och bli förolämpad.', 'Det där är under all kritik – och det vet du.'], 3: ['NU RÄCKER DET! Du har ingen aning om vad du pratar om!', 'Jag har fått nog av det här! Moderatorn, är det här en debatt eller ett skämt?!', 'Säg det igen. SÄG DET IGEN!'] },
    sad: { 1: ['…Okej. Jag hör vad du säger.', 'Det var… inte snällt.', 'Jag trodde vi kunde ha en ärlig debatt.'], 2: ['Jag vet inte varför jag ens ställer upp på det här.', 'Du behöver inte vara elak för att vinna en debatt.', 'Det där sårade faktiskt.'], 3: ['…Förlåt, jag behöver en sekund.', '(rösten brister) Jag… kan vi ta en paus?', 'Jag orkar inte mer av det här.'] },
    fear: { 1: ['Eh… ja, alltså, det… vi får titta på siffrorna.', 'Jag… jag ska inte sväva på målet.', 'Det… det är en bra fråga.'], 2: ['Jag har inte exakt den siffran här, men… vi återkommer.', 'Det… det kan vara så, ja. Vi måste kontrollera.', 'Jag vill inte spekulera om det just nu.'], 3: ['(tystnad) …Jag har inget svar på det.', 'Jag… jag erkänner att jag inte är förberedd på det här.', 'Kan vi… kan vi gå vidare?'] },
    joy: { 1: ['Ha! Okej, den var bra.', 'Det där kan jag faktiskt köpa.', 'Vi är nog mer överens än det låter.'], 2: ['Det där håller jag med om – och det säger jag inte ofta till en motståndare.', 'Tack. Det uppskattar jag.', 'Ser ni? Vi kan faktiskt prata med varandra.'], 3: ['Det här är den bästa debatt jag haft på länge. Tack!', 'Jag skulle kunna rösta på dig själv efter det där.', 'Kom hit – vi borde regera ihop!'] } };
  const opts = A[l.key][l.level];
  return rnd() < .7 ? pick(rnd, opts) : base;
}
export const OUTBURST = ['NU RÄCKER DET! Du har ingen aning om vad du pratar om, och jag tänker inte stå här och ta emot det!', 'Vet du vad? Jag har fått NOG. Moderatorn – är det här en debatt eller ett skämt?!', 'Säg det igen. SÄG DET IGEN så ska du få se!', 'Jag… det här är det mest ohederliga jag hört i hela mitt politiska liv! Skäms!', 'Det är SÅNA SOM DU som förstör det här landet!'];
export const BREAKDOWN = ['…Förlåt. Jag behöver en sekund. (tar av sig mikrofonen)', '(rösten brister) Jag… jag orkar inte det här just nu.', 'Varför gör du så här? Vi… vi är ju människor, båda två.', '(tystnad, tittar ned) …Fortsätt ni. Jag har inget mer att säga.'];
export const CONCESSION = ['Det där… håller jag faktiskt med om. Och det säger jag inte ofta till en motståndare.', 'Okej. Där har du en poäng. Vi kunde ha gjort det bättre.', 'Jag tänker inte låtsas – det där var klokt sagt.', 'Vi är nog mer överens än det låter. Låt oss bygga på det.'];
// Publikens syn på hur du behandlar motståndaren: mobbning straffas, utbrott belönar dig
export function audienceOnMood(m, a, effects) {
  let delta = 0; let note = null;
  const e = a.emotion || {};
  if (effects.outburst) { delta += 12; note = 'Motståndaren tappade fattningen – publiken drar efter andan.'; }
  if (effects.breakdown) { delta -= 14; note = 'Motståndaren bryter ihop. Publiken tycker synd om hen – och tittar på dig.'; }
  else if (m.sad >= 45 && (e.insult || e.mock)) { delta -= 8; note = 'Publiken buar – du sparkar på någon som ligger.'; }
  if (effects.concede) { delta += 6; note = 'Motståndaren håller med dig. Poäng.'; }
  if (effects.charmed && !note) { delta += 3; note = 'Stämningen i studion är god.'; }
  return { delta, note };
}
// Agg: känslor som fastnar långsiktigt på personen gentemot spelaren
export function recordGrudge(person, m, playerLeaderId) {
  person.grudge ||= {};
  const g = Math.max(0, (m.anger - 35) * .6 + (m.sad - 35) * .3);
  const warm = Math.max(0, (m.joy - 35) * .5);
  person.grudge[playerLeaderId] = clamp((person.grudge[playerLeaderId] || 0) + g - warm, -60, 100);
  return person.grudge[playerLeaderId];
}
export const grudgeOf = (person, playerLeaderId) => person?.grudge?.[playerLeaderId] || 0;
export function monthlyGrudges(state) { for (const p of Object.values(state.people)) { if (p.grudge) for (const k in p.grudge) p.grudge[k] = Math.round(p.grudge[k] * .94 * 10) / 10; if (p.mood) decayMood(p, .5); } }
