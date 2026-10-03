// Valtest: hoppar fram till valrörelsen, spelar igenom TV-debatt, valnatt och regeringsbildning i gränssnittet.
// node tools/val-test.mjs  (servern på http://localhost:8790)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools/out/'); fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.SMOKE_PORT || '8790';
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

await page.goto(`http://localhost:${PORT}/index.html`);
await page.evaluate(() => localStorage.clear());
await page.reload(); await sleep(400);
// ta över S (största oppositionspartiet)
await page.click('#new'); await sleep(200);
await page.locator('.pick .opt', { hasText: 'Socialdemokraterna' }).click(); await sleep(100);
await page.click('.btn.gold.big'); await sleep(200);
await page.fill('#first', 'Anna'); await page.fill('#last', 'Valberg');
await page.click('.btn.gold.big'); await sleep(200);
await page.locator('.saves .save').first().click(); await page.click('text=Starta spelet'); await sleep(800);
ok(await page.evaluate(() => window.BPM.G.state.player.partyId === 's'), 'spelar som S');
// hoppa till 9 veckor före valet
await page.evaluate(() => { const s = window.BPM.G.state; s.date = { y: 2030, m: 7, d: 1 }; s.flags.skipApWarning = true; window.BPM.save(); window.BPM.UI.render(); });
let debates = 0, electionSeen = false, formationSeen = false;
for (let w = 0; w < 14 && !formationSeen; w++) {
  try { await page.click('#next'); } catch (e) { await shot('39-fel'); console.log('FASTNADE vecka', w, await page.evaluate(() => ({ busy: window.BPM.UI.busy, q: window.BPM.G.state.queue.map((x) => x.type), modals: document.querySelectorAll('.modal .mh h2').length, aa: document.querySelectorAll('.aa').length }))); throw e; }
  await sleep(500);
  for (let k = 0; k < 200; k++) {
    await sleep(200);
    if (!(await page.evaluate(() => window.BPM.UI.busy))) break;
    if (await page.locator('.aa').count()) {
      debates++; await shot('30-tvdebatt-' + debates);
      await page.click('.aa #skip').catch(() => {});
      for (let j = 0; j < 40; j++) { await sleep(120); const c = page.locator('.aa .choices .btn'); if (await c.count()) await c.first().click().catch(() => {}); const okb = page.locator('.aa #ok'); if (await okb.count()) { await okb.click(); break; } await page.locator('.aa .textbox').click().catch(() => {}); }
      continue;
    }
    if (await page.locator('.valnatt').count()) {
      electionSeen = true; await sleep(2500); await shot('31-valnatt');
      await page.click('.valnatt #skip'); await sleep(400); await shot('32-valnatt-slut');
      await page.click('.valnatt #done'); await sleep(400);
      continue;
    }
    const m = page.locator('.modal');
    if (!(await m.count())) { console.log('   (ingen modal, busy=' + (await page.evaluate(() => window.BPM.UI.busy)) + ')'); break; }
    const title = (await m.locator('.mh h2').first().textContent()) || '';
    console.log('   modal:', title.trim().slice(0, 60));
    if (/Regeringsbildning/.test(title)) {
      formationSeen = true; await shot('33-formation');
      const tryBtn = m.locator('.choice .btn').first();
      if (await m.locator('.choice').count()) { await tryBtn.click(); await sleep(400); }
      else { await m.locator('.mf .btn').first().click(); await sleep(300); continue; }
      const f = page.locator('.modal', { hasText: 'Bilda regering' });
      if (await f.count()) {
        // bjud in alla som kan tänka sig stöd
        const chips = f.locator('.item .chip[data-k="support"]');
        const n = await chips.count();
        for (let i = 0; i < n; i++) { const st = await chips.nth(i).getAttribute('style'); if (!st || !st.includes('opacity')) await chips.nth(i).click().catch(() => {}); }
        await sleep(200); await shot('34-formation-val');
        await f.locator('.mf .btn.gold').click(); await sleep(500);
        await shot('35-formation-resultat');
        await page.locator('.modal .mf .btn').first().click().catch(() => {}); await sleep(300);
      }
      continue;
    }
    if (/^Vecka/.test(title)) { await m.locator('.mf .btn').first().click(); await sleep(200); break; }
    const ch = m.locator('.choice .btn, .mf .btn');
    await ch.first().click(); await sleep(250);
  }
}
ok(debates >= 1, `TV-debatter under valrörelsen (${debates})`);
ok(electionSeen, 'valnatten visades');
ok(formationSeen, 'regeringsbildningen visades');
const after = await page.evaluate(() => ({ hist: window.BPM.G.state.election.history.length, seats: window.BPM.G.state.riksdag.seats, gov: window.BPM.G.state.government, next: window.BPM.G.state.election.next }));
ok(after.hist === 1, 'valresultatet sparades i historiken');
ok(Object.values(after.seats).reduce((a, b) => a + b, 0) === 349, 'mandaten summerar till 349');
ok(after.next.y === 2034, 'nästa val 2034');
console.log('   regering: ' + (after.gov.pm ? after.gov.parties.join('+') + ' stöd [' + after.gov.support.join(',') + '] ' + after.gov.type : 'ingen'));
await page.locator('.sidenav button', { hasText: 'Valet' }).click(); await sleep(400); await shot('36-valet-efter');
console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
