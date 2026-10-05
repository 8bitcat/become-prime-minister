// Röktest: klickar igenom start → nytt parti → ledare → spelet → några veckor, tar skärmdumpar till tools/out/.
// Kör: node tools/smoke.mjs   (servern på http://localhost:8790; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools/out/'); fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.SMOKE_PORT || '8790';
const URL = `http://localhost:${PORT}/index.html`;
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
page.setDefaultTimeout(8000);
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: OUT + name + '.png' });
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(500);
ok(await page.locator('.start').count() === 1, 'startskärmen visas');
await shot('01-start');

// Ny spelomgång: nytt parti
await page.click('#new'); await sleep(300);
await shot('02-vagval');
await page.locator('.panel >> text=Starta ett nytt parti').first().locator('..').locator('button').click(); await sleep(200);
await page.click('.btn.gold.big'); await sleep(300);
ok(await page.locator('#pname').count() === 1, 'partiskaparen visas');
await page.fill('#pname', 'Framtidspartiet'); await page.fill('#pabbr', 'FP'); await page.fill('#pslogan', 'Ett Sverige som vågar');
await shot('03a-parti-identitet');
await page.click('.btn.gold.big'); await sleep(250); // → ideologi
ok(await page.locator('#ideo .opt').count() > 0, 'ideologifliken visas');
await page.locator('#fam button', { hasText: 'Övrigt' }).click(); await sleep(150);
await page.locator('#ideo .opt', { hasText: 'Teknokrati' }).click(); await sleep(150);
await page.locator('#sec .chip', { hasText: 'Socialliberalism' }).click(); await sleep(150);
await shot('03b-parti-ideologi');
await page.click('.btn.gold.big'); await sleep(250); // → politik
ok(await page.locator('.polsum').count() === 1 && await page.locator('.axis.xaxis').count() === 9, 'politiksteget: sammanfattning och kompass');
await shot('03c-parti-politik');
await page.locator('.tabs button', { hasText: 'Profil' }).click(); await sleep(250);
await page.locator('#profile .chip').nth(11).click(); await page.locator('#profile .chip').nth(6).click();
await page.click('.btn.gold.big'); await sleep(250); // → organisation
await page.locator('#ledarval .opt').nth(0).click(); await sleep(100);
await shot('03d-parti-organisation');
await page.click('.btn.gold.big'); await sleep(250); // → målgrupper
await page.locator('#segs .opt').nth(1).click(); await page.locator('#segs .opt').nth(10).click();
await shot('03e-parti-malgrupper');
await page.click('.btn.gold.big'); await sleep(400); // → ledaren
ok(await page.locator('#portrait svg, #portrait img').count() === 1, 'ledarskaparen med porträtt visas');
await page.fill('#first', 'Elin'); await page.fill('#last', 'Westerberg');
await page.selectOption('#profession', 'sjukskoterska'); await sleep(150);
await shot('04a-ledaren-person');
await page.locator('.tabs button', { hasText: 'Utseende' }).click(); await sleep(250);
await page.locator('#hair .chip').nth(10).click(); await sleep(150);
await shot('04b-ledaren-utseende');
await page.locator('.tabs button', { hasText: 'Kläder' }).click(); await sleep(250);
await page.locator('#style .opt').nth(2).click(); await sleep(250);
await shot('04c-ledaren-klader');
await page.locator('.tabs button', { hasText: 'Personlighet' }).click(); await sleep(250);
await page.locator('#pers .opt', { hasText: 'Humoristisk' }).click(); await page.locator('#pers .opt', { hasText: 'Empatisk' }).click(); await sleep(150);
await shot('04d-ledaren-personlighet');
ok(await page.evaluate(() => document.querySelector('#personaHint')?.textContent.includes('Elin')), 'personasammanfattningen uppdateras');
await page.click('.btn.gold.big'); await sleep(300);
ok(await page.locator('.saves .save').count() === 3, 'sparplatser visas');
await page.locator('.saves .save').first().click(); await sleep(100);
await shot('05-starta');
await page.click('text=Starta spelet'); await sleep(900);
ok(await page.locator('.game').count() === 1, 'spelet startade');
ok(await page.evaluate(() => window.BPM.G.state.parties.ny.name) === 'Framtidspartiet', 'partiet finns i tillståndet');
ok(await page.evaluate(() => window.BPM.G.state.parties.ny.ideology.primary === 'teknokrati' && window.BPM.G.state.parties.ny.structure.ledarval === 'medlem' && window.BPM.G.state.parties.ny.structure.malgrupper.length === 2), 'ideologi, stadgar och målgrupper sparades');
ok(await page.evaluate(() => { const l = window.BPM.G.state.people.player; return l.persona.profession === 'sjukskoterska' && l.persona.personality.includes('humoristisk') && l.cred.valfard > 0; }), 'ledarens persona och trovärdighet sparades');
ok(await page.evaluate(() => !!localStorage.getItem('bpm_save_1')), 'sparades automatiskt på plats 1');
await shot('06-oversikt');

// handling: presskonferens (fritext + journalisternas frågor)
await page.locator('.action', { hasText: 'Presskonferens' }).click(); await sleep(300);
await page.fill('.modal #ft', 'Vi föreslår 10 000 fler lärare till 2030, finansierat genom slopade ränteavdrag. Skolan är vår viktigaste fråga.'); await sleep(350);
await shot('06b-press');
await page.locator('.modal .mf .btn.gold').click(); await sleep(500);
for (let k = 0; k < 8; k++) { const ta = page.locator('.modal #ft'); if (await ta.count()) { await ta.fill('Det finansieras genom slopat ränteavdrag, 12 miljarder per år. Vi står för det.'); if (k === 0) await shot('06c-press-fraga'); await page.locator('.modal .mf .btn.gold').click(); await sleep(400); continue; } const m = page.locator('.modal'); if (!(await m.count())) break; await shot('06d-press-resultat'); await m.locator('.mf .btn.gold').first().click(); await sleep(300); }
ok(await page.evaluate(() => window.BPM.G.state.ap) === 3, 'presskonferensen kostade 1 AP');
ok(await page.evaluate(() => window.BPM.G.state.memory.statements.length) >= 2, 'uttalandena hamnade i det politiska minnet');
// sociala medier: fritt inlägg med kommentarsfält
await page.locator('.sidenav button', { hasText: 'Sociala medier' }).click(); await sleep(400);
await page.fill('#postText', 'Nu räcker det. Vi bygger 50 000 nya bostäder per år – på riktigt. Arbetslösheten är 25 procent och regeringen gör ingenting. #bostad'); await sleep(400);
await shot('07-some');
await page.click('#send'); await sleep(900);
ok(await page.evaluate(() => window.BPM.G.state.social.posts.length) === 1, 'inlägget publicerades');
ok(await page.evaluate(() => window.BPM.G.state.social.posts[0].comments.length) >= 3, 'kommentarsfältet fylldes');
ok(await page.evaluate(() => window.BPM.G.state.news.some((n) => n.tags.includes('faktakoll'))), 'felaktig siffra faktakollades');
await shot('07c-kommentarer');
await page.locator('.modal .mf .btn.gold').click(); await sleep(200);
// sidor
for (const [name, file] of [['Politiken', '07b-politiken'], ['Partiet', '08-partiet'], ['Sverige', '09-sverige'], ['Riksdagen', '10-riksdagen'], ['Opinion', '11-opinion'], ['Nyheter', '12-nyheter'], ['Regeringen', '13-regeringen'], ['Valet', '14-valet'], ['Världen', '15-varlden'], ['Historik', '16-historik']]) {
  await page.locator('.sidenav button', { hasText: name }).first().click(); await sleep(350);
  ok((await page.locator('.content .card, .content .nitem').count()) > 0, `sidan ${name} ritas`);
  await shot(file);
}
// kongressdialogen
await page.locator('.sidenav button', { hasText: 'Partiet' }).click(); await sleep(300);
await page.click('#kongress'); await sleep(300);
ok(await page.locator('.modal #cent').count() === 1, 'kongressdialogen öppnas');
await shot('08b-kongress');
await page.locator('.modal .mf .btn').first().click(); await sleep(200);
// nästa vecka ×3 med rapporter/händelser
await page.locator('.sidenav button', { hasText: 'Översikt' }).click(); await sleep(200);
for (let w = 0; w < 6; w++) {
  await page.click('#next'); await sleep(400);
  // hantera dialoger tills rapporten stängts
  for (let k = 0; k < 20; k++) {
    const aa = await page.locator('.aa').count();
    if (aa) { // debatt/intervju: hoppa över och välj alternativ
      await page.click('.aa #skip').catch(() => {});
      for (let j = 0; j < 12; j++) { await sleep(150); const c = page.locator('.aa .choices .btn'); if (await c.count()) await c.first().click().catch(() => {}); const okb = page.locator('.aa #ok'); if (await okb.count()) { await shot('17-debatt'); await okb.click(); break; } await page.locator('.aa .textbox').click().catch(() => {}); }
      continue;
    }
    const m = page.locator('.modal');
    if (!(await m.count())) break;
    const title = await m.locator('.mh h2').first().textContent();
    if (/^Vecka/.test(title)) { if (w === 0) await shot('18-rapport'); await m.locator('.mf .btn').first().click(); await sleep(200); break; }
    const ch = m.locator('.choice .btn, .mf .btn');
    await ch.first().click(); await sleep(250);
  }
  await sleep(200);
}
const wk = await page.evaluate(() => window.BPM.G.state.week);
ok(wk >= 6, `sex veckor spelade (vecka ${wk})`);
ok(await page.evaluate(() => window.BPM.G.state.opinion.polls.length) >= 9, 'mätningar har kommit');
ok(await page.evaluate(() => window.BPM.G.state.news.length) > 10, 'nyheter har genererats');
await shot('19-efter-veckor');

// omladdning: progress överlever
await page.reload(); await sleep(700);
ok(await page.locator('.start').count() === 1, 'startskärmen visar sparningen');
ok((await page.locator('.save').first().textContent())?.includes('Framtidspartiet'), 'sparningen listas');
await page.locator('.save .btn.gold').first().click(); await sleep(700);
ok(await page.evaluate(() => window.BPM.G.state.week) === wk, 'veckan överlevde omladdning');

// debattscen direkt (skärmdump av anime-läget)
await page.evaluate(() => { window.BPM.G.state.queue.push({ type: 'debate', debate: 'tv' }); });
await page.evaluate(() => { window.BPM.processQueue(); });
await sleep(1500);
ok(await page.locator('.aa').count() === 1, 'debattscenen öppnas');
await page.locator('.aa .textbox').click(); await sleep(1200); await page.locator('.aa .textbox').click(); await sleep(1500);
await shot('20-debattscen');
for (let k = 0; k < 12 && !(await page.locator('.aa #reply').count()); k++) { await page.locator('.aa .textbox').click().catch(() => {}); await sleep(500); }
const ta = page.locator('.aa #reply');
if (await ta.count()) { await ta.fill('Det stämmer inte. Vi föreslår 5 miljarder till polisen och 2 000 nya poliser till 2030 – fullt finansierat.'); await sleep(400); await shot('21-debatt-val'); await page.click('.aa #send'); await sleep(2200); await shot('22-debatt-svar'); }
ok(await page.evaluate(() => window.BPM.G.state.memory.statements.some((s) => s.kind === 'debate')), 'debattsvaret sparades i minnet');
await page.click('.aa #skip'); await sleep(300);
for (let j = 0; j < 30; j++) { await sleep(200); const c = page.locator('.aa .choices .btn'); if (await c.count()) { const n = await c.count(); await c.nth(n - 1).click(); } const okb = page.locator('.aa #ok'); if (await okb.count()) { await shot('23-debatt-resultat'); await okb.click(); break; } await page.locator('.aa .textbox').click().catch(() => {}); }
ok(await page.locator('.aa').count() === 0, 'debatten avslutades');

// ta över ett parti: statsminister direkt (M)
await page.evaluate(() => window.BPM.showStart()); await sleep(300);
await page.click('#new'); await sleep(300);
await page.locator('.pick .opt', { hasText: 'Moderaterna' }).click(); await sleep(200);
await page.click('.btn.gold.big'); await sleep(400);
await page.fill('#first', 'Karl'); await page.fill('#last', 'Testare');
await page.click('.btn.gold.big'); await sleep(300);
await page.locator('.saves .save').nth(1).click(); await sleep(100);
await page.click('text=Starta spelet'); await sleep(900);
ok(await page.evaluate(() => window.BPM.G.state.government.pm === 'player'), 'M-ledaren är statsminister vid start');
await page.locator('.sidenav button', { hasText: 'Regeringen' }).click(); await sleep(400);
await shot('24-regeringen-pm');
// politiken: ändra programmet och föreslå en reform som statsminister
await page.locator('.sidenav button', { hasText: 'Politiken' }).click(); await sleep(400);
await page.locator('.tabs button', { hasText: 'Skatter' }).click(); await sleep(300);
await shot('26-politiken-skatter');
const firstRange = page.locator('.item .prog input[type=range]').first();
await firstRange.fill(String(+(await firstRange.getAttribute('max')))); await sleep(200);
ok(!(await page.locator('.content .btn.gold', { hasText: 'Anta ändringarna' }).isDisabled()), 'programändring aktiverar knappen');
await page.locator('.content .btn.gold', { hasText: 'Anta ändringarna' }).click(); await sleep(400);
ok(await page.evaluate(() => { const p = window.BPM.G.state.parties.m; return p.program.skatt_kommunal === 40; }), 'programmet uppdaterades (kommunalskatt 40)');
await page.click('#reformBtn'); await sleep(300);
await page.locator('.choice .btn', { hasText: 'Skatter' }).click(); await sleep(300);
await page.locator('.choice .btn').first().click(); await sleep(400);
await shot('27-reform');
const reformBtn = page.locator('.modal .btn.gold', { hasText: 'Lägg fram' });
ok(await reformBtn.count() === 1, 'reformdialogen visas');
const rangeR = page.locator('.modal input[type=range]'); if (await rangeR.count()) { await rangeR.fill(String(+(await rangeR.getAttribute('min')))); await sleep(200); }
if (!(await reformBtn.isDisabled())) { await reformBtn.click(); await sleep(400); ok(await page.evaluate(() => window.BPM.G.state.riksdag.bills.some((b) => b.kind === 'reform' && b.byPlayer)), 'reformförslaget ligger i riksdagen'); } else { await page.locator('.modal .mf .btn').first().click(); console.log('  (reformknappen avstängd – kapital eller oförändrat värde)'); }
await page.locator('.sidenav button', { hasText: 'Regeringen' }).click(); await sleep(400);
await page.click('#budget'); await sleep(400);
ok(await page.locator('.budget').count() === 1, 'budgetdialogen öppnas');
await shot('25-budget');
await page.locator('.modal .mf .btn.gold').click(); await sleep(400);
await page.locator('.modal .mf .btn').first().click().catch(() => {}); await sleep(200);

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
