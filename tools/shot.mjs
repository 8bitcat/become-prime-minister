// Skärmdump av en sida i spelet. node tools/shot.mjs <sökväg+query> <utfil> [bredd] [höjd]
// Kräver en server på http://localhost:8790 (node tools/serve.mjs).
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, path = 'tools/portrait-preview.html', out = 'tools/out/shot.png', w = '1400', h = '900'] = process.argv;
const PORT = process.env.PORT || '8790';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/${path}`);
await page.waitForTimeout(900);
await page.screenshot({ path: out, fullPage: true });
if (errors.length) console.log('FEL:\n' + errors.join('\n'));
console.log('→ ' + out);
await browser.close();
