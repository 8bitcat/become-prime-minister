// Spelets AI på riktigt: kör spelet i Chromium med WebGPU, startar den lokala språkmodellen och spelar
// igenom staben, en debattreplik, ett inlägg och politik med egna ord. Kräver grafikkort.
//   node tools/ai-test.mjs [modell-id]   (servern på http://localhost:8790; annan port: SMOKE_PORT)
//   node tools/ai-test.mjs ollama:gemma4:12b   (modellen i Ollama på den här datorn i stället för WebGPU)
// Modellen cachas i tools/out/llm-profile (laddas ned första gången).
import { createRequire } from 'node:module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || '8790';
const MODEL = process.argv[2] || 'Qwen3.5-4B-q4f16_1-MLC';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
const ctx = await chromium.launchPersistentContext('tools/out/llm-profile', { channel: 'chromium', headless: true, viewport: { width: 1400, height: 860 }, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await ctx.newPage(); page.setDefaultTimeout(20000);
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 200)); if (m.type() === 'warning') console.log('    [varning]', m.text().slice(0, 300)); });
const shot = (n) => page.screenshot({ path: 'tools/out/ai-' + n + '.png' });
await page.goto(`http://localhost:${PORT}/?noai`); await sleep(800);
await page.evaluate(async () => {
  const people = await import('/js/sim/people.js'); const util = await import('/js/core/util.js'); const ideo = await import('/js/data/ideologies.js');
  const r0 = util.makeRng(5);
  const leaderDef = { name: 'Sara Lind', first: 'Sara', last: 'Lind', gender: 'k', age: 44, look: people.randomLook(r0, 'k'), traits: people.randomTraits(r0), bg: { utbildning: 'Jurist', yrke: 'Advokat', hemstad: 'Umeå', familj: 'Medelklass' } };
  const partyDef = { name: 'Framtidspartiet', abbr: 'FP', color: '#8e44ad', color2: '#fff', logo: { shape: 'star', glyph: 'FP' }, slogan: 'Framåt', pos: { ...ideo.IDEOLOGIES.find((i) => i.id === 'socialliberalism').pos }, profile: {}, ideology: { primary: 'socialliberalism', secondary: [] } };
  const { state, rnd } = window.BPM.newGame({ seed: 5, mode: 'new', party: partyDef, leader: leaderDef, slot: 1 });
  window.BPM.G.state = state; window.BPM.G.rnd = rnd; window.BPM.G.slot = 1; window.BPM.save();
});
await page.goto(`http://localhost:${PORT}/?slot=1&noai`); await sleep(1200);
console.log(`Startar ${MODEL} …`);
const t0 = Date.now();
if (MODEL.startsWith('ollama:')) await page.evaluate((m) => window.BPM_AI.connectServer('http://localhost:11434', m), MODEL.slice(7));
else await page.evaluate((m) => window.BPM_AI.loadLocal(m), MODEL);
ok(await page.evaluate(() => window.BPM_AI.localReady()), `spelets AI igång på ${((Date.now() - t0) / 1000).toFixed(0)} s`);
ok((await page.locator('#aichip').textContent()).includes('AI'), 'AI-indikatorn i toppraden');
// --- staben ---
await page.evaluate(() => window.BPM.UI.go('stab')); await sleep(400);
await page.fill('.chatin textarea', 'Ärligt talat – hur ska vi ta oss över spärren innan valet? Vad är vår bästa fråga?');
await page.click('.chatin .btn.gold');
await page.waitForFunction(() => window.BPM.G.state.chats?.stab?.length >= 2, null, { timeout: 90000 });
const ans = await page.evaluate(() => window.BPM.G.state.chats.stab.at(-1).text);
console.log('    stabschefen:', ans.slice(0, 300));
ok(ans.length > 40 && !ans.includes('Starta spelets AI'), 'stabschefen svarar fritt med spelets AI');
await shot('01-staben');
await page.fill('.chatin textarea', 'Och om vi går hårt på gängvåldet – tappar vi inte våra klimatväljare då?');
await page.click('.chatin .btn.gold');
await page.waitForFunction(() => window.BPM.G.state.chats.stab.length >= 4, null, { timeout: 90000 });
const ans2 = await page.evaluate(() => window.BPM.G.state.chats.stab.at(-1).text);
console.log('    följdfråga:', ans2.slice(0, 300));
ok(ans2.length > 30 && ans2 !== ans, 'stabschefen minns samtalet och svarar på följdfrågan');
// --- politik med egna ord ---
const pm = await page.evaluate(async () => { const { mapPolicyText } = await import('/js/ai/policymap.js'); return mapPolicyText('Sänk skatten på drivmedel med en krona och bygg ny kärnkraft. Förbjud vinster i skolan.', window.BPM.G.state.parties.ny.program || {}); });
console.log('    politik:', pm.via, pm.changes.map((c) => `${c.id} ${c.from}→${c.to}`).join(' | '));
ok(pm.changes.length >= 2, `politik med egna ord tolkas (${pm.via})`);
// --- inlägg med kommentarsfält ---
await page.evaluate(() => window.BPM.UI.go('some')); await sleep(400);
await page.fill('#postText', 'Mormor fick ligga nio timmar i en korridor på akuten. Det är inte värdigt Sverige. Vi anställer 5 000 sjuksköterskor – betalt av skattesänkningarna för de rikaste.');
await page.click('#send');
await page.waitForFunction(() => (window.BPM.G.state.social.posts[0]?.comments || []).length >= 3, null, { timeout: 120000 });
const post = await page.evaluate(() => { const s = window.BPM.G.state; const st = s.memory.statements.at(-1); return { comments: s.social.posts[0].comments.map((c) => `${c.who}: ${c.text}`), tone: s.social.posts[0].dominant, issues: s.social.posts[0].issues, summary: st.summary }; });
console.log('    ton:', post.tone, '· frågor:', post.issues.join(','), '· sammanfattning:', post.summary);
for (const c of post.comments.slice(0, 4)) console.log('    💬', c.slice(0, 200));
ok(post.issues.includes('valfard') && post.summary, 'inlägget förstås (vård) och sammanfattas');
ok(post.comments.some((c) => c.length > 30), 'kommentarsfältet skrivs av spelets AI');
await shot('02-inlagg');
await page.locator('.modal .mf .btn.gold').click().catch(() => {}); await sleep(300);
// --- debatt: förolämpa motståndaren ---
await page.evaluate(() => { window.BPM.G.state.queue.push({ type: 'debate', debate: 'tv' }); });
await page.evaluate(() => { window.BPM.processQueue(); }); await sleep(1500);
for (let k = 0; k < 15 && !(await page.locator('.aa #reply').count()); k++) { await page.locator('.aa .textbox').click().catch(() => {}); await sleep(500); }
await page.fill('.aa #reply', 'Du är ju en clown, din pajas. Ni har inte fattat någonting på tjugo år och nu sitter du där och spelar förvånad!');
await page.click('.aa #send');
await page.waitForFunction(() => window.BPM.G.state.memory.statements.at(-1)?.kind === 'debate', null, { timeout: 120000 });
for (let k = 0; k < 60; k++) { await sleep(1000); const t = await page.locator('.aa #txt').textContent().catch(() => ''); const vis = await page.locator('.aa #nm').isVisible().catch(() => false); const nm = await page.locator('.aa #nm').textContent().catch(() => ''); const mine = await page.evaluate(() => window.BPM.G.state.people.player.name); if (vis && nm && nm !== mine && t && !t.startsWith('💭')) break; if (vis && nm === mine) await page.locator('.aa .textbox').click().catch(() => {}); }
await sleep(2500);
const deb = await page.evaluate(() => { const s = window.BPM.G.state; const st = s.memory.statements.at(-1); return { dominant: st.dominant, summary: st.summary, mood: document.querySelector('.aa #mood')?.textContent || '', reply: document.querySelector('.aa #txt')?.textContent || '' }; });
console.log('    analys:', deb.dominant, '·', deb.summary, '· humör:', deb.mood);
console.log('    motståndaren:', deb.reply.slice(0, 300));
ok(/aggressiv|dryg|humor/.test(deb.dominant), 'förolämpningen uppfattas som konfrontativ');
ok(/arg|irriterad|rasande|ledsen|besviken/.test(deb.mood), `motståndaren blir upprörd (${deb.mood})`);
await shot('03-debatt');
console.log(errs.length ? 'FEL:\n' + errs.join('\n') : 'Inga konsolfel.');
console.log(`${pass} gröna, ${fail} röda`);
await ctx.close();
process.exit(fail ? 1 : 0);
