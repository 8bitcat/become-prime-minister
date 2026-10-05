// Provkör en commit isolerat innan den publiceras: checkar ut den i en tillfällig worktree,
// startar en egen server där och kör röktestet + valtestet + den huvudlösa simuleringen.
//   node tools/verify.mjs            (HEAD, port 8791)
//   node tools/verify.mjs v0.2.0 --port 8792
// Loggen hamnar i tools/out/verify-<ref>.log. Slutkod 0 = allt grönt.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const ref = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--port') || 'HEAD';
const port = argv.includes('--port') ? argv[argv.indexOf('--port') + 1] : '8791';
const dir = path.resolve(ROOT, '..', `become-prime-minister-verify-${port}`);
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function removeWorktree() { try { git(['worktree', 'remove', '--force', dir]); } catch { /* fanns inte */ } fs.rmSync(dir, { recursive: true, force: true }); try { git(['worktree', 'prune']); } catch { /* ok */ } }

const sha = git(['rev-parse', '--short', ref]);
removeWorktree();
git(['worktree', 'add', '--detach', dir, ref]);
console.log(`Provkör ${ref} (${sha}) i ${dir} på port ${port} …`);
const server = spawn('node', ['tools/serve.mjs', port], { cwd: dir, stdio: 'ignore' });
let code = 1;
try {
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${port}/index.html`)).ok; } catch { await sleep(250); } }
  if (!up) throw new Error('servern startade inte');
  const out = [];
  const run = (args) => new Promise((resolve) => { out.push(`\n=== ${args.join(' ')} ===\n`); const p = spawn('node', args, { cwd: dir, env: { ...process.env, SMOKE_PORT: port }, stdio: ['ignore', 'pipe', 'pipe'] }); p.stdout.on('data', (b) => out.push(b.toString())); p.stderr.on('data', (b) => out.push(b.toString())); p.on('close', (c) => resolve(c ?? 1)); });
  code = await run(['tools/sim-test.mjs', '160', 'new', '3']);
  const c1 = await run(['tools/text-test.mjs']); if (c1) code = code || c1;
  const c2 = await run(['tools/smoke.mjs']); if (c2) code = code || c2;
  const c3 = await run(['tools/val-test.mjs']); if (c3) code = code || c3;
  const c4 = await run(['tools/ui-test.mjs']); if (c4) code = code || c4;
  const log = out.join('');
  const logFile = path.join(ROOT, 'tools/out', `verify-${ref.replace(/[^\w.-]/g, '_')}.log`);
  fs.mkdirSync(path.dirname(logFile), { recursive: true }); fs.writeFileSync(logFile, log);
  const lines = log.split(/\r?\n/); const passed = lines.filter((l) => l.includes('✓')).length; const failed = lines.filter((l) => l.includes('✗'));
  if (code === 0 && !failed.length) console.log(`✓ ${sha}: ALLT GRÖNT (${passed} kontroller). Logg: ${logFile}`);
  else { console.log(`✗ ${sha}: ${failed.length} fel av ${passed + failed.length} (slutkod ${code}). Logg: ${logFile}`); for (const l of failed) console.log('   ' + l.trim()); if (code === 0) code = 1; }
} catch (e) { console.error('✗ ' + e.message); code = 1; }
finally { server.kill(); removeWorktree(); }
process.exit(code);
