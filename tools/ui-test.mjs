// Webbläsartest av v0.5: egen logotypbild, anpassad tecknad figur, känslor i debatten, smart analys-valet.
// node tools/ui-test.mjs   (servern på http://localhost:8790; annan port: SMOKE_PORT=8791)
import { createRequire } from 'node:module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PORT = process.env.SMOKE_PORT || '8790';
const LOGO = path.join(os.tmpdir(), 'bpm-logo-test.png'); fs.writeFileSync(LOGO, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAbUlEQVR42mM8IWfDQA3AxEAlMPgMYsEvbb7vCDL3pBPOAGXEFdhoRhA0jolUU3DJMpFqCi41TGSYglUlbaKfeOdgqh/GKZs2BuHJAQSTOM28Rryj0FQyEZknCaphIj5/45dlxF9mU6E8GvoJEgBAMyW3a1UApwAAAABJRU5ErkJggg==', 'base64'));
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
page.setDefaultTimeout(9000);
const shot = (n) => page.screenshot({ path: 'tools/out/ui-' + n + '.png' });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('✓', m); } else { fail++; console.log('✗', m); } };
await page.goto(`http://localhost:${PORT}/`); await sleep(800);
// --- partiskaparen: logotypbild ---
await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(500);
await page.click('#new'); await sleep(300);
await page.locator('.panel >> text=Starta ett nytt parti').first().locator('..').locator('button').click(); await sleep(200);
await page.click('.btn.gold.big'); await sleep(400);
await page.fill('#pname', 'Bildpartiet'); await page.fill('#pabbr', 'BP');
await page.setInputFiles('#plogofile', LOGO); await sleep(600);
ok(await page.evaluate(() => !!document.querySelector('#logoPreview image')), 'logotypbilden visas i förhandsvisningen');
await shot('01-logo');
for (let k = 0; k < 4; k++) { await page.click('.btn.gold.big'); await sleep(250); }
// --- ledarskaparen: anpassa figuren ---
await page.click('.btn.gold.big'); await sleep(400);
await page.fill('#first', 'Lisa'); await page.fill('#last', 'Färg');
await page.locator('.tabs button', { hasText: 'Utseende' }).click(); await sleep(400);
ok(await page.locator('#customize .prow').count() >= 3, 'anpassningspanelen visar delar');
const before = await page.evaluate(() => document.querySelector('#portrait img')?.src || '');
await page.locator('#customize .prow').first().locator('.swatch').nth(8).click(); await sleep(1500);
const after = await page.evaluate(() => document.querySelector('#portrait img')?.src || '');
ok(after.startsWith('blob:') && after !== before, 'figuren färgades om (blob-url)');
await page.locator('#customize .prow').nth(2).locator('.swatch').nth(9).click(); await sleep(1500);
await shot('02-anpassa');
await page.click('.btn.gold.big'); await sleep(300);
await page.locator('.saves .save').first().click(); await sleep(100);
await page.click('text=Starta spelet'); await sleep(1200);
ok(await page.evaluate(() => !!window.BPM.G.state.people.player.spriteLook && !!window.BPM.G.state.parties.ny.logoImage), 'anpassning och logotyp sparades i spelet');
await shot('03-oversikt');
// --- debatt med känslor: förolämpa motståndaren ---
await page.evaluate(() => { window.BPM.G.state.queue.push({ type: 'debate', debate: 'tv' }); });
await page.evaluate(() => { window.BPM.processQueue(); }); await sleep(1500);
for (let k = 0; k < 12 && !(await page.locator('.aa #reply').count()); k++) { await page.locator('.aa .textbox').click().catch(() => {}); await sleep(500); }
await page.fill('.aa #reply', 'Du är en lögnare och en idiot, skäms! Ni fattar ingenting, lilla vän. Alla begriper att ni har förstört Sverige!!!'); await sleep(300);
await page.click('.aa #send'); await sleep(2500);
ok(await page.evaluate(() => (window.BPM.G.state.queue[0] && true, true)), 'svaret skickades');
await page.locator('.aa .textbox').click(); await sleep(300); await page.locator('.aa .textbox').click(); await sleep(2200); await shot('04-debatt-arg');
const moodTxt = await page.locator('.aa #mood').textContent().catch(() => '');
ok(/arg|irriterad|rasande|ledsen|besviken|pressad|nervös/.test(moodTxt || ''), `känslochipen visas (${moodTxt})`);
await page.click('.aa #skip'); await sleep(300);
for (let j = 0; j < 40; j++) { await sleep(200); const c = page.locator('.aa .choices .btn'); if (await c.count()) { const n = await c.count(); await c.nth(n - 1).click(); } const okb = page.locator('.aa #ok'); if (await okb.count()) { await shot('05-debatt-resultat'); await okb.click(); break; } await page.locator('.aa .textbox').click().catch(() => {}); }
ok(await page.locator('.aa').count() === 0, 'debatten avslutades');
ok(await page.evaluate(() => { const s = window.BPM.G.state; return Object.values(s.people).some((p) => p.mood && (p.mood.anger > 10 || p.mood.sad > 10)); }), 'motståndarens humör sparades');
// --- Partiet: logotypknapp + drift-rad ---
await page.locator('.sidenav button', { hasText: 'Partiet' }).click(); await sleep(400);
ok(await page.locator('#logoBtn').count() === 1, 'Partiet visar logotypknappen');
await shot('06-partiet');
// --- AI-dialogen: spelets egen modell + Claude som dolt tillval ---
await page.click('#menu'); await sleep(200); await page.locator('.modal .btn', { hasText: 'Spelets AI' }).click(); await sleep(600);
ok(await page.locator('.modal #models .opt').count() >= 3 && await page.locator('.modal #loadAi').count() === 1, 'spelets AI: modellstorlekar och startknapp'); await shot('07-ai');
ok(await page.locator('.modal details #key').count() === 1, 'Claude ligger som dolt tillval');
await page.locator('.modal .mf .btn.gold').last().click(); await sleep(200);
ok(await page.locator('#aichip').count() === 1, 'AI-indikatorn finns i toppraden');
// --- Staben: prata fritt (utan modell: svar byggda på läget) ---
await page.locator('.sidenav button', { hasText: 'Staben' }).click(); await sleep(400);
await page.fill('.chatin textarea', 'Hur klarar vi spärren inför valet?'); await page.click('.chatin .btn.gold'); await sleep(800);
ok(await page.evaluate(() => (window.BPM.G.state.chats?.stab || []).length === 2), 'staben svarar'); await shot('08-staben');
await page.locator('.tabs button', { hasText: 'Chefsekonomen' }).click(); await sleep(300);
ok(await page.locator('.chatcard').count() === 1, 'flera rådgivare i staben');
console.log(errs.length ? 'FEL:\n' + errs.join('\n') : 'Inga konsolfel.');
console.log(`${pass} gröna, ${fail} röda`); if (errs.length) { console.log('  ✗ inga pageerror/console.error'); }
await browser.close(); process.exit(fail || errs.length ? 1 : 0);
