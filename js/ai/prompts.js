// Prompter och svarsformat för spelets lokala språkmodell (ai/local.js). Små modeller behöver korta,
// tydliga instruktioner, slutna svarsalternativ (enum) och begränsade listor – annars fastnar de i
// upprepningar. Samma byggare används av spelet och av testlabbet (tools/llm-lab.mjs).
import { ISSUES } from '../data/issues.js';

export const SYSTEM_LOCAL = 'Du är berättarmotorn i ett realistiskt svenskt politiskt strategispel. Allt utspelar sig i dagens Sverige. Skriv alltid naturlig, korrekt och idiomatisk svenska – som en svensk journalist eller politiker skulle säga det. Hitta inte på siffror. Följ svarsformatet exakt.';

// Väljaraxlarnas poler som slutna alternativ: "ekonomi: högre skatt…" (−) / "ekonomi: lägre skatt…" (+)
export const POLES = ISSUES.flatMap((i) => [{ issue: i.id, dir: -1, label: `${i.id}: ${i.left.toLowerCase()}` }, { issue: i.id, dir: 1, label: `${i.id}: ${i.right.toLowerCase()}` }]);
const POLE_LABELS = POLES.map((p) => p.label);
const ISSUE_IDS = ISSUES.map((i) => i.id);
const LEVEL = ['nej', 'lite', 'tydligt'];
export const TONES_LOCAL = ['saklig', 'kampande', 'aggressiv', 'humor', 'kansla', 'undvikande', 'dryg'];
const TONE_HELP = 'saklig = fakta och förslag; kampande = engagerat, "nu tar vi strid"; aggressiv = angriper, anklagar, förolämpar; humor = skämt eller ironi; kansla = personligt, berättelser, värme; undvikande = svarar inte, glider undan; dryg = nedlåtande, överlägsen, "lilla vän"';

// ---------- analys av det spelaren skriver ----------
export function analysisSchema(partyAbbrs = []) {
  return {
    type: 'object',
    properties: {
      sammanfattning: { type: 'string' },
      amnen: { type: 'array', items: { type: 'string', enum: ISSUE_IDS }, maxItems: 3 },
      vill: { type: 'array', items: { type: 'string', enum: POLE_LABELS }, maxItems: 3 },
      ton: { type: 'string', enum: TONES_LOCAL },
      forolampar: { type: 'string', enum: LEVEL }, hanar: { type: 'string', enum: LEVEL }, berommer: { type: 'string', enum: LEVEL },
      hotar: { type: 'string', enum: LEVEL }, empati: { type: 'string', enum: LEVEL }, medger: { type: 'string', enum: LEVEL },
      upprord: { type: 'string', enum: LEVEL },
      svarar: { type: 'string', enum: ['ja', 'delvis', 'nej', 'ingen fråga'] },
      ...(partyAbbrs.length ? { angriper: { type: 'array', items: { type: 'string', enum: partyAbbrs }, maxItems: 2 } } : {}),
      lofte: { type: 'array', items: { type: 'string' }, maxItems: 2 },
    },
    required: ['sammanfattning', 'amnen', 'vill', 'ton', 'forolampar', 'hanar', 'berommer', 'hotar', 'empati', 'medger', 'upprord', 'svarar', 'lofte', ...(partyAbbrs.length ? ['angriper'] : [])],
  };
}
export const ANALYSIS_LOCAL = analysisSchema(['S', 'SD', 'M', 'V', 'C', 'KD', 'MP', 'L']);
const EX_IN = 'Sammanhang: TV-debatt. Frågan var: "Hur ska ni minska arbetslösheten?" Riktat till: Per Holm (S).\nText: "Ni har haft åtta år på er och arbetslösheten har bara ökat. Vi sänker skatten på arbete och gör det billigare att anställa unga – det är så jobb skapas."';
const EX_OUT = JSON.stringify({ sammanfattning: 'Kritiserar S för ökad arbetslöshet och vill sänka skatten på arbete och göra det billigare att anställa unga.', amnen: ['arbete', 'ekonomi'], vill: ['ekonomi: lägre skatt, mindre stat', 'arbete: flexibel arbetsmarknad'], ton: 'kampande', forolampar: 'nej', hanar: 'nej', berommer: 'nej', hotar: 'nej', empati: 'nej', medger: 'nej', upprord: 'lite', svarar: 'ja', angriper: ['S'], lofte: ['sänka skatten på arbete'] });
const EX2_IN = 'Sammanhang: TV-debatt. Frågan var: "Vad vill ni göra med invandringen?" Riktat till: Lena Berg (V).\nText: "Hör du ens dig själv? Du är en löjlig pajas som aldrig har jobbat en dag i ditt liv. Skäms!"';
const EX2_OUT = JSON.stringify({ sammanfattning: 'Förolämpar och hånar Lena Berg personligt i stället för att svara på frågan om invandringen.', amnen: [], vill: [], ton: 'aggressiv', forolampar: 'tydligt', hanar: 'tydligt', berommer: 'nej', hotar: 'nej', empati: 'nej', medger: 'nej', upprord: 'tydligt', svarar: 'nej', angriper: ['V'], lofte: [] });
const EX3_IN = 'Sammanhang: TV-debatt. Frågan var: "Hur ska vården bli bättre?" Riktat till: Johan Ek (KD).\nText: "Johan, där har du faktiskt helt rätt – personalen måste få bättre villkor. Jag uppskattar att du lyfter det. Vi vill gå längre: tio procent högre lön för undersköterskor."';
const EX3_OUT = JSON.stringify({ sammanfattning: 'Håller med Johan Ek om personalens villkor och föreslår tio procent högre lön för undersköterskor.', amnen: ['valfard', 'arbete'], vill: [], ton: 'saklig', forolampar: 'nej', hanar: 'nej', berommer: 'tydligt', hotar: 'nej', empati: 'lite', medger: 'tydligt', upprord: 'nej', svarar: 'ja', angriper: [], lofte: ['tio procent högre lön för undersköterskor'] });
export function analysisMessages({ text, question = null, kind = 'uttalande', counterpart = null, parties = ['S', 'SD', 'M', 'V', 'C', 'KD', 'MP', 'L'] }) {
  const sys = `${SYSTEM_LOCAL}\n\nDin uppgift: analysera vad en partiledare säger eller skriver.\n- sammanfattning: en mening (högst 25 ord) om vad personen faktiskt menar – tolka ironi, sarkasm och underförstådda poänger.\n- amnen: de sakfrågor texten handlar om (0–3). "Folk har inte råd med maten" = ekonomi; "mormor väntade på akuten" = valfard; "skjutningarna" = kriminal; "planeten" = klimat.\n- vill: vilken riktning personen driver (0–3), bara om det framgår.\n- ton: ${TONE_HELP}.\n- forolampar/hanar/berommer/hotar/empati/medger: hur texten behandlar den som tilltalas. Okvädinsord ("clown", "pajas", "idiot", "lögnare") = forolampar tydligt. Att hålla med eller ge rätt = medger. Vänliga ord om personen = berommer.\n- upprord: hur upprörd/skrikig texten är.\n- svarar: besvaras frågan? "ingen fråga" om ingen fråga ställdes.\n- angriper: partier som kritiseras.\n- lofte: konkreta löften (kort, egna ord), annars tom lista.`;
  const user = `Sammanhang: ${kind}.${question ? ` Frågan var: "${question}"` : ''}${counterpart ? ` Riktat till: ${counterpart}.` : ''}\nText: "${String(text).slice(0, 1200)}"`;
  const fix = (j) => (parties.length ? j : JSON.stringify((({ angriper, ...rest }) => rest)(JSON.parse(j)))); // exemplen följer samma format som schemat
  const okAbbr = (j) => { const o = JSON.parse(j); if (o.angriper) o.angriper = o.angriper.filter((a) => parties.includes(a)); return JSON.stringify(o); };
  return { messages: [{ role: 'system', content: sys }, { role: 'user', content: EX_IN }, { role: 'assistant', content: fix(okAbbr(EX_OUT)) }, { role: 'user', content: EX2_IN }, { role: 'assistant', content: fix(okAbbr(EX2_OUT)) }, { role: 'user', content: EX3_IN }, { role: 'assistant', content: fix(okAbbr(EX3_OUT)) }, { role: 'user', content: user }], schema: analysisSchema(parties) };
}
// Översätt modellens svar till spelets analysformat (samma som ai/analyze.js)
const LV = { nej: 0, lite: .5, tydligt: 1 };
export function fromLocalAnalysis(r, parties = []) {
  const out = { topics: [], issues: {}, stance: {}, emotion: {}, dominant: TONES_LOCAL.includes(r.ton) ? r.ton : 'saklig', summary: r.sammanfattning || null, promisesText: [] };
  for (const id of r.amnen || []) if (ISSUE_IDS.includes(id) && !out.topics.includes(id)) { out.topics.push(id); out.issues[id] = 1; }
  for (const lab of r.vill || []) { const p = POLES.find((x) => x.label === lab); if (!p) continue; out.stance[p.issue] = p.dir; if (!out.topics.includes(p.issue)) { out.topics.push(p.issue); out.issues[p.issue] = .8; } }
  out.emotion = { insult: LV[r.forolampar] ?? 0, mock: LV[r.hanar] ?? 0, praise: LV[r.berommer] ?? 0, threat: LV[r.hotar] ?? 0, empathy: LV[r.empati] ?? 0, concede: LV[r.medger] ?? 0 };
  out.intensity = LV[r.upprord] ?? 0;
  out.answers = r.svarar === 'ja' ? .85 : r.svarar === 'delvis' ? .5 : r.svarar === 'nej' ? .15 : null;
  out.attacks = (r.angriper || []).map((ab) => parties.find((p) => p.abbr === ab)?.id).filter(Boolean);
  out.promisesText = (r.lofte || []).filter((x) => x && x.length > 3);
  out.dryg = r.ton === 'dryg' ? .8 : 0;
  return out;
}

// ---------- repliker: motståndare, journalister, väljare, partikamrater ----------
export function repliesSchema(names) { return { type: 'object', properties: { repliker: { type: 'array', minItems: names.length, maxItems: names.length, items: { type: 'object', properties: { vem: { type: 'string', enum: names }, text: { type: 'string' } }, required: ['vem', 'text'] } } }, required: ['repliker'] }; }
export const REPLIES_LOCAL = repliesSchema(['Karin Lund']);
export function repliesMessages({ situation, playerName = 'partiledaren', playerText, speakers, history = [], extra = '' }) {
  const names = speakers.map((s) => s.who);
  const sys = `${SYSTEM_LOCAL}\n\nDu skriver repliker åt figurer i spelet. Varje replik ska låta som en riktig människa i Sverige i dag: konkret, i figurens egen röst, 1–3 meningar, och den ska reagera på exakt det som sades – citera eller bemöt gärna en detalj. Upprepa inte dig själv. Inga hashtaggar utom i sociala medier.`;
  const hist = history.length ? `\nSamtalet hittills:\n${history.slice(-6).map((h) => `${h.who}: ${String(h.text).slice(0, 240)}`).join('\n')}` : '';
  const user = `Situation: ${situation}${hist}\n\n${playerName} sa nyss: "${String(playerText).slice(0, 900)}"\n${extra}\nSkriv en replik var för:\n${speakers.map((s) => `- ${s.who}: ${s.desc}`).join('\n')}`;
  return { messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], schema: repliesSchema(names) };
}

// ---------- fritt samtal med rådgivare (stabschefen m.fl.) ----------
export const ADVISOR_LOCAL = { type: 'object', properties: { svar: { type: 'string' } }, required: ['svar'] };
export function advisorMessages({ advisor, role, persona = '', state, history = [], question }) {
  const sys = `${SYSTEM_LOCAL}\n\nDu är ${advisor}, ${role} åt partiledaren. ${persona} Du pratar som i ett vanligt, förtroligt samtal mellan två kollegor: rakt, konkret, gärna med en egen åsikt och ett tydligt råd. Använd fakta från lägesbilden nedan när det passar, men hitta inte på nya siffror. Svara på det som faktiskt frågas, 2–6 meningar, och upprepa dig inte.\n\nLÄGESBILD:\n${state}`;
  const msgs = [{ role: 'system', content: sys }];
  for (const h of history.slice(-8)) msgs.push({ role: h.mine ? 'user' : 'assistant', content: h.mine ? h.text : JSON.stringify({ svar: h.text }) });
  msgs.push({ role: 'user', content: question });
  return { messages: msgs, schema: ADVISOR_LOCAL };
}

// ---------- fri text → politiska beslut ----------
export function policySchema(ids) { return { type: 'object', properties: { andringar: { type: 'array', maxItems: 8, items: { type: 'object', properties: { id: { type: 'string', enum: ids }, varde: { type: 'string' } }, required: ['id', 'varde'] } } }, required: ['andringar'] }; }
export function policyMessages({ text, candidates }) {
  const sys = `${SYSTEM_LOCAL}\n\nDu översätter en partiledares politik, skriven med egna ord, till konkreta värden i spelets politikområden. Ta BARA med områden som texten faktiskt tar ställning till. För reglage: ange ett tal inom intervallet (om texten bara säger "höj" eller "sänk", välj en rimlig förändring). För val: ange exakt ett av alternativen.`;
  const list = candidates.map((c) => `${c.id}: ${c.name} – nu ${c.cur}${c.range ? `, intervall ${c.range}` : ''}${c.options ? `, alternativ: ${c.options.join(' | ')}` : ''}`).join('\n');
  return { messages: [{ role: 'system', content: sys }, { role: 'user', content: `Politikområden:\n${list}\n\nPartiledaren skrev: "${String(text).slice(0, 1200)}"\n\nVilka ändringar innebär texten?` }], schema: policySchema(candidates.map((c) => c.id)) };
}

// ---------- förhandling: accepterar motparten? ----------
export const DEAL_LOCAL = { type: 'object', properties: { beslut: { type: 'string', enum: ['ja', 'motbud', 'nej'] }, replik: { type: 'string' } }, required: ['beslut', 'replik'] };
export function dealMessages({ who, party, demand, offer, relation, history = [] }) {
  const sys = `${SYSTEM_LOCAL}\n\nDu spelar ${who}, partiledare för ${party}, i en förhandling bakom stängda dörrar. Du förhandlar hårt men rationellt: accepterar om budet ger ditt parti något verkligt och konkret, ger ett motbud om det nästan räcker, och säger nej om budet är tomt, otrevligt eller strider mot din politik. Relationen till motparten: ${relation}.`;
  const hist = history.length ? `\nTidigare i förhandlingen:\n${history.slice(-4).map((h) => `${h.who}: ${h.text}`).join('\n')}` : '';
  return { messages: [{ role: 'system', content: sys }, { role: 'user', content: `Ditt krav var: "${demand}".${hist}\nMotpartens bud: "${String(offer).slice(0, 700)}"\nBesluta och svara i 1–3 meningar.` }], schema: DEAL_LOCAL };
}
