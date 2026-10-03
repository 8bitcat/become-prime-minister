// Släpper en ny version: höjer versionsnumret, skriver nyheten överst i CHANGELOG.md,
// committar BARA de filer du anger plus versionsfilerna och sätter en git-tagg vX.Y.Z.
//
//   node tools/release.mjs minor --title "Valnatten" --scope val --notes n.md -- js/ui/election.js
//   node tools/release.mjs patch --title "Fixad mätare" --scope debatt --notes n.md -- js/scene/debate.js
//
//   minor = ny funktion, patch = buggfix, major = 1.0 och framåt.
//   --notes FIL   punkter "- …" på svenska (blir nyheten och commit-texten)
//   --type        feat | fix | chore | docs  (standard: fix för patch, annars feat)
//   --scope       t.ex. val, riksdag, debatt, opinion, sverige
//   --dry         visa vad som skulle hända, ändra ingenting
//   --push        git push origin main + taggen direkt (gör det först efter tools/verify.mjs)
//   --no-claude   utan Co-Authored-By-raden
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARK = '<!-- släpp:';
const COAUTHOR = 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>';

const argv = process.argv.slice(2);
const dd = argv.indexOf('--');
const paths = dd >= 0 ? argv.slice(dd + 1) : [];
const opts = dd >= 0 ? argv.slice(0, dd) : argv;
const flag = (n) => opts.includes('--' + n);
const val = (n) => { const i = opts.indexOf('--' + n); return i >= 0 ? opts[i + 1] : undefined; };
const bump = opts[0];
const die = (msg) => { console.error('✗ ' + msg); process.exit(1); };
const git = (args, o = {}) => (execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...o }) ?? '').trim();
const gitOk = (args) => { try { git(args); return true; } catch { return false; } };

if (!['major', 'minor', 'patch'].includes(bump)) die('första argumentet ska vara major, minor eller patch');
const title = val('title'); if (!title) die('--title "Kort rubrik" saknas');
const notesFile = val('notes'); if (!notesFile) die('--notes FIL saknas');
const notes = fs.readFileSync(path.resolve(notesFile), 'utf8').split(/\r?\n/).filter((l) => /^\s*[-*]\s+\S/.test(l)).map((l) => '- ' + l.replace(/^\s*[-*]\s+/, '').trim());
if (!notes.length) die(`inga punkter ("- …") i ${notesFile}`);
if (!paths.length) die('ange filerna som ska med efter "--"');
const type = val('type') || (bump === 'patch' ? 'fix' : 'feat');
const scope = val('scope');
const dry = flag('dry');

const branch = git(['branch', '--show-current']);
if (branch !== 'main' && !flag('any-branch')) die(`du står på "${branch}" – släpp görs från main (--any-branch för undantag)`);
if (git(['diff', '--cached', '--name-only'])) die('något ligger redan köat i git – töm kön först');
for (const p of paths) if (!fs.existsSync(path.join(ROOT, p)) && !gitOk(['cat-file', '-e', 'HEAD:' + p.replace(/\\/g, '/')])) die(`filen finns inte: ${p}`);

const verFile = path.join(ROOT, 'js/version.js');
const cur = (fs.readFileSync(verFile, 'utf8').match(/VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'/) || die('hittar inte VERSION i js/version.js')).slice(1).map(Number);
const next = bump === 'major' ? [cur[0] + 1, 0, 0] : bump === 'minor' ? [cur[0], cur[1] + 1, 0] : [cur[0], cur[1], cur[2] + 1];
const V = next.join('.');
if (gitOk(['rev-parse', '-q', '--verify', 'refs/tags/v' + V])) die(`taggen v${V} finns redan`);
const d = new Date();
const DATE = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

git(['add', '-A', '--', ...paths]);
const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean);
if (!staged.length) die('inga ändringar i de angivna filerna');
// importkontroll: en köad JS-fil får inte importera något som inte finns i committen
const WRITTEN_HERE = new Set(['js/version.js', 'CHANGELOG.md']);
const inIndex = (p) => WRITTEN_HERE.has(p) || gitOk(['cat-file', '-e', ':' + p]);
const missing = [];
for (const f of staged) {
  const isJs = /\.m?js$/.test(f), isHtml = /\.html$/.test(f);
  if (!isJs && !isHtml) continue;
  const src = git(['show', ':' + f]);
  const refs = [];
  if (isJs) for (const m of src.matchAll(/(?:^|[\s;])(?:import|export)\s[^'"`;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|[\s;])import\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/gm)) refs.push(m[1] || m[2] || m[3]);
  if (isHtml) for (const m of src.matchAll(/<script[^>]+src="(?!https?:)([^"]+)"/g)) refs.push('./' + m[1]);
  for (const r of refs) { const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), r.split('?')[0])); if (target.startsWith('tools/') || /^(node:|https?:)/.test(r)) continue; if (!inIndex(target)) missing.push(`${f} → ${target}`); }
}
if (missing.length) { git(['reset', '-q']); die('importer pekar på filer som inte kommer med:\n    ' + missing.join('\n    ')); }

const section = `## [${V}] – ${DATE} – ${title}\n${notes.join('\n')}\n`;
const clPath = path.join(ROOT, 'CHANGELOG.md');
const cl = fs.readFileSync(clPath, 'utf8');
const at = cl.indexOf(MARK); if (at < 0) { git(['reset', '-q']); die(`hittar inte markören "${MARK}" i CHANGELOG.md`); }
const lineEnd = cl.indexOf('\n', at) + 1;
const newCl = cl.slice(0, lineEnd) + '\n' + section + cl.slice(lineEnd).replace(/^\n*/, '\n');
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const verJs = `// Skrivs av tools/release.mjs vid varje släpp – ändra inte för hand.\nexport const VERSION = '${V}';\nexport const DATE = '${DATE}';\nexport const TITLE = '${esc(title)}';\n`;
const subject = `${type}${scope ? `(${scope})` : ''}: ${title}`;
const body = `${subject}\n\n${notes.join('\n')}\n\nVersion ${V}.${flag('no-claude') ? '' : `\n\n${COAUTHOR}`}\n`;

console.log(`${dry ? '[prov] ' : ''}v${cur.join('.')} → v${V}  (${subject})`);
console.log('  filer: ' + staged.join(', '));
if (dry) { git(['reset', '-q']); console.log('\n' + section); process.exit(0); }
fs.writeFileSync(verFile, verJs); fs.writeFileSync(clPath, newCl);
git(['add', '--', 'js/version.js', 'CHANGELOG.md']);
const tmp = path.join(os.tmpdir(), `bpm-release-${process.pid}.txt`);
fs.writeFileSync(tmp, body); git(['commit', '-q', '-F', tmp]);
fs.writeFileSync(tmp, `v${V} – ${title}\n\n${notes.join('\n')}\n`); git(['tag', '-a', 'v' + V, '-F', tmp]);
fs.rmSync(tmp, { force: true });
const sha = git(['rev-parse', '--short', 'HEAD']);
console.log(`✓ v${V} släppt lokalt som ${sha} med taggen v${V}.`);
if (flag('push')) { git(['push', '-q', 'origin', 'main', '--follow-tags'], { stdio: ['ignore', 'inherit', 'inherit'] }); console.log('✓ publicerad (GitHub Pages bygger om på någon minut).'); }
else console.log('  Provkör: node tools/verify.mjs   Publicera: git push origin main --follow-tags');
