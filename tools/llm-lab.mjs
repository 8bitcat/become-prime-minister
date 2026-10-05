// Jämför lokala språkmodeller (WebLLM i Chromium med WebGPU) på spelets riktiga uppgifter, på svenska.
//   node tools/llm-lab.mjs Qwen3.5-4B-q4f16_1-MLC [fler modell-id …]
// Modellerna cachas i tools/out/llm-profile så att de bara laddas ned en gång.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || '8790';
const models = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext('tools/out/llm-profile', { channel: 'chromium', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('  [konsol]', m.text().slice(0, 200)); });
await page.goto(`http://localhost:${PORT}/tools/llm-lab.html`);
await page.waitForFunction(() => window.labReady, null, { timeout: 60000 });

const { analysisMessages, repliesMessages, advisorMessages, policyMessages } = await import('../js/ai/prompts.js');
const POL = [
  { id: 'skatt_pension', name: 'Skatt på pension', cur: '32 %', range: '20–45 %' }, { id: 'utg_kollektivtrafik', name: 'Statligt stöd till kollektivtrafik', cur: '12 mdkr', range: '0–40 mdkr' },
  { id: 'tunnelbana', name: 'Tunnelbaneutbyggnad i storstäderna', cur: 'nuvarande plan', options: ['stopp', 'nuvarande plan', 'kraftig utbyggnad'] }, { id: 'skatt_statlig', name: 'Statlig inkomstskatt', cur: '20 %', range: '0–40 %' },
  { id: 'polis_antal', name: 'Antal poliser', cur: '36000', range: '25000–50000' }, { id: 'karnkraft_mal', name: 'Kärnkraftsmål', cur: '48 TWh', range: '0–150 TWh' }, { id: 'vinst_valfard', name: 'Vinster i välfärden', cur: 'tillåtet', options: ['tillåtet', 'vinsttak', 'förbud'] },
];
const cases = [
  { name: 'analys: mormor/akuten', ...analysisMessages({ text: 'Min mormor fick ligga på en brits i korridoren i nio timmar. Det är ovärdigt. Vi anställer 5 000 sjuksköterskor och betalar dem ordentligt – och det tar vi från skattesänkningarna för de rikaste.', question: 'Hur ska ni korta vårdköerna?', kind: 'TV-debatt' }), max: 320, temp: .2 },
  { name: 'analys: förolämpning', ...analysisMessages({ text: 'Du är ju en clown, din pajas. Ni har inte fattat någonting på tjugo år och nu sitter du där och spelar förvånad.', question: 'Vad gör ni åt gängvåldet?', kind: 'TV-debatt', counterpart: 'Karin Lund (M)' }), max: 320, temp: .2 },
  { name: 'analys: ironi', ...analysisMessages({ text: 'Regeringens energipolitik i ett nötskal: stäng reaktorer, köp kolkraft från Tyskland och kalla det grönt. Snyggt jobbat 👏', kind: 'inlägg på X' }), max: 320, temp: .2 },
  { name: 'analys: beröm', ...analysisMessages({ text: 'Där har du faktiskt en poäng, Karin. Jag respekterar att du står upp för polisen, även om vi ser olika på vägen dit.', question: 'Vad gör ni åt gängvåldet?', kind: 'TV-debatt', counterpart: 'Karin Lund (M)' }), max: 320, temp: .2 },
  { name: 'replik: arg motståndare', ...repliesMessages({ situation: 'TV-debatt om gängvåldet. Karin Lund (Moderaterna) är just nu rasande (ilska 85 av 100).', playerName: 'Eva Berg', playerText: 'Du är ju en clown, din pajas. Ni har inte fattat någonting på tjugo år.', speakers: [{ who: 'Karin Lund', desc: 'partiledare för Moderaterna, 54 år, skarp och erfaren; svarar i 1–3 meningar, låt ilskan synas' }] }), max: 200, temp: .8 },
  { name: 'replik: journalistens följdfråga', ...repliesMessages({ situation: 'TV-utfrågning i SVT. Journalisten frågade: "Hur ska ni finansiera 5 000 nya sjuksköterskor?" Svaret besvarade inte frågan.', playerName: 'Eva Berg', playerText: 'Det viktiga är att vi gör det. Vården är för viktig för att räkna kronor.', speakers: [{ who: 'Anna Ek', desc: 'skarp, påläst politisk journalist på SVT; ställ EN följdfråga' }] }), max: 200, temp: .7 },
  { name: 'kommentarer', ...repliesMessages({ situation: 'Ett inlägg på Facebook av partiledaren. Skriv kommentarer som i ett riktigt kommentarsfält – korta, olika ton, någon ironisk.', playerName: 'Eva Berg', playerText: 'Vi lovar 50 000 nya hyresrätter på fyra år. Unga ska kunna flytta hemifrån!', speakers: [{ who: 'Göran, 71, pensionär', desc: 'orolig för kostnaderna, ogillar partiet' }, { who: 'Elin, 28, Stockholm', desc: 'ironisk men sympatisk' }, { who: 'Mats, 45, industriarbetare', desc: 'rak, skeptisk' }, { who: 'Fatima, 34, sjuksköterska', desc: 'gillar partiet' }] }), max: 360, temp: .9 },
  { name: 'stabschefen', ...advisorMessages({ advisor: 'Jonas Ek', role: 'stabschef', state: 'Partiet har 3,8 % i senaste mätningen (spärren är 4 %). Valet är om 31 veckor. Väljarna tycker att vården (hett) och gängvåldet (hett) är viktigast. Partiet är starkt på klimat men svagt på brott. Kassa 1,2 mkr. Partiledaren har på sistone låtit kämpande.', history: [], question: 'Ärligt talat, vad ska vi göra för att klara spärren? Ska jag börja prata mer om brott eller hålla fast vid klimatet?' }), max: 260, temp: .7 },
  { name: 'politik: fri text → beslut', ...policyMessages({ text: 'Pensionärer ska inte betala mer skatt än löntagare – sänk till 29 procent. Och bygg ut tunnelbanan, betala med högre statlig skatt på de högsta inkomsterna, säg 25 procent.', candidates: POL }), max: 220, temp: .1 },
];
const report = [];
for (const id of models) {
  console.log(`\n=== ${id} ===`);
  const tl = Date.now();
  let ld;
  try { ld = await page.evaluate((m) => window.lab.load(m), id); } catch (e) { console.log('  LADDNING MISSLYCKADES:', e.message.split('\n')[0]); continue; }
  console.log(`  laddad på ${((Date.now() - tl) / 1000).toFixed(0)} s`);
  for (const c of cases) {
    try {
      const r = await page.evaluate(([m, o]) => window.lab.chat(m, o), [c.messages, { schema: c.schema, max: c.max, temp: c.temp }]);
      const tok = r.usage?.completion_tokens; const tps = tok ? (tok / (r.ms / 1000)).toFixed(0) : '?';
      console.log(`  [${c.name}] ${r.ms} ms, ${tok} tok, ${tps} tok/s\n    ${r.text.replace(/\s+/g, ' ').slice(0, 700)}`);
      report.push({ model: id, case: c.name, ms: r.ms, tok, text: r.text });
    } catch (e) { console.log(`  [${c.name}] FEL ${e.message.split('\n')[0]}`); }
  }
}
fs.writeFileSync('tools/out/llm-lab-' + Date.now() + '.json', JSON.stringify(report, null, 1));
await ctx.close();
