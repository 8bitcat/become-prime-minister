// Partiskaparens politiksteg. Hela skalan – från anarkism till totalitarism, från inga gränser till
// storskalig återvandring – via kompassen, sakfrågorna, alla politikområden med egna värden och politik
// skriven med egna ord. Programmet (P.program) är sanningen; axlarna och ideologin räknas ut ur det.
import { h, esc } from '../core/util.js';
import { POLICIES, DOMAINS, DOMAIN_GROUPS, COMPASS, policyLabel, normalRange, valueMarks, isExtremeValue, hasExtreme } from '../data/policies.js';
import { ISSUES } from '../data/issues.js';
import { axesFromProgram, ideologyDescription, programExtremism, compassExt, axesExt, extremeAxes, steerProgram, EXT_NAMES, DEMO_NAMES } from '../sim/policy.js';
import { compassSVG } from './politik.js';
import { mapPolicyText } from '../ai/policymap.js';

// Ytterlighetsändarna på kompassen och sakfrågorna (bortom ±100)
export const COMPASS_X = {
  ek: ['planekonomi', 'anarkokapitalism'], auk: ['anarkism', 'totalitarism'], glob: ['inga gränser, världsstat', 'stängda gränser, isolationism'],
  prog: ['radikal omvälvning', 'reaktionär'], cent: ['statslöst, fria kommuner', 'total centralstyrning'], mil: ['total nedrustning', 'militarism, krigsekonomi'],
  sek: ['statsateism', 'teokrati'], mark: ['allt förstatligat', 'allt på marknaden'], miljo: ['planerad nerväxt', 'tillväxt till varje pris'],
};
export const ISSUE_X = {
  ekonomi: ['planekonomi, konfiskatorisk skatt', 'ingen inkomstskatt, nattväktarstat'], migration: ['inga gränser', 'storskalig återvandring'], kriminal: ['polis och fängelser avskaffas', 'polisstat, arbetsläger'],
  klimat: ['planerad nerväxt, ransonering', 'tillväxt till varje pris'], forsvar: ['försvaret avvecklas', 'total mobilisering'], eu: ['isolering, ut ur allt samarbete', 'Europas förenta stater'],
  valfard: ['allt i statlig regi', 'allt privatiserat'], landsbygd: ['allt till storstäderna', 'avveckla storstadsfokus helt'], varderingar: ['radikal omvälvning', 'religiös lag, reaktion'],
  arbete: ['statsstyrd arbetsmarknad', 'strejkförbud, arbetsplikt'], bostad: ['alla bostäder förstatligade', 'helt fri marknad'], energi: ['all kärnkraft och fossilt bort', 'energi till varje pris'],
};
const scaleLabel = (v, left, right, xl, xr) => {
  const a = Math.abs(v);
  if (a > 100) return '⚠️ ' + (v < 0 ? xl : xr);
  if (a < 15) return 'mitten';
  return (a > 60 ? 'tydligt ' : 'lutar ') + (v < 0 ? left : right).split(',')[0].toLowerCase();
};
const marksText = (m) => [m.ext ? EXT_NAMES[m.ext] : (m.x ? 'ytterlighet' : ''), m.demo < 0 ? DEMO_NAMES[m.demo] : ''].filter(Boolean).join(' · ');

export function partyPoliticsStep(P, { tab = 'kompass', setTab, ideologyName = '' } = {}) {
  const el = h('div', {});
  const sync = () => { P.pos = axesFromProgram(P.program); };
  // ---- sammanfattningen överst: ideologi ur programmet, kompassen, ytterlighetsgraden ----
  const sum = h('div', { class: 'panel polsum' });
  const drawSum = () => {
    const d = ideologyDescription(P.program); const pe = programExtremism(P.program); const c = compassExt(P.program);
    const lvl = pe.demo <= -2 || pe.ext >= 3 ? 'red' : pe.ext >= 2 || pe.demo < 0 ? 'orange' : pe.ext ? 'gold' : '';
    const cons = pe.demo <= -2 || pe.ext >= 3 ? 'Systemfientligt program: samtliga partier tar avstånd, medierna granskar varje steg och motdemonstrationer följer er. Om politiken genomförs: sanktioner, kapitalflykt, utvandring och rasande demokratiindex.'
      : pe.ext >= 2 ? 'Extremt program: riksdagspartierna drar upp en cordon sanitaire – inga samarbeten. Många väljare skräms bort, en del lockas.'
      : pe.ext ? 'Radikala enskildheter: medierna lyfter dem, vissa väljargrupper skräms bort.' : '';
    sum.innerHTML = `<div class="row between" style="align-items:flex-start;gap:16px;flex-wrap:wrap"><div style="flex:1;min-width:240px"><h3 style="margin:0">Ert program: ${esc(d.label)}</h3>
      <small class="muted">${ideologyName ? 'Utgångspunkt: ' + esc(ideologyName) + '. ' : ''}${d.tags.length ? 'Profil: ' + d.tags.map(esc).join(', ') + '.' : ''} Ideologin räknas ut ur programmet – ändra vad ni vill.</small>
      ${pe.items.length ? `<div class="xbanner ${lvl}"><b>⚠️ ${esc(EXT_NAMES[pe.ext] || 'radikal')}${pe.demo < 0 ? ' · ' + esc(DEMO_NAMES[pe.demo]) : ''}</b><br><small>${esc(cons)}</small><div class="chips" style="margin-top:6px">${pe.items.slice(0, 8).map((i) => `<span class="chip static" title="${esc(marksText(i))}">${esc(i.name)}: ${esc(i.label)}</span>`).join('')}${pe.items.length > 8 ? `<span class="chip static">+${pe.items.length - 8} till</span>` : ''}</div></div>` : '<p class="help" style="margin:8px 0 0">Inga ytterlighetskrav i programmet. Dra ett reglage förbi den röda markeringen eller välj ett ⚠️-alternativ för att gå längre.</p>'}</div>
      <div style="flex:0 0 auto">${compassSVG(c, 380)}</div></div>`;
  };
  el.append(sum);
  // ---- flikarna ----
  const tabs = h('div', { class: 'tabs' });
  for (const [id, nm] of [['kompass', '🧭 Kompassen'], ['sakfragor', '⚖️ Sakfrågorna'], ['omraden', `📚 Alla ${POLICIES.length} områden`], ['ord', '✍️ Med egna ord'], ['profil', '🎯 Profil']]) tabs.append(h('button', { class: id === tab ? 'on' : '', onclick: () => setTab?.(id) }, nm));
  el.append(tabs);
  const body = h('div', {});
  el.append(body);
  const changed = () => { P.tuned = true; sync(); drawSum(); };
  if (tab === 'kompass' || tab === 'sakfragor') body.append(scalesPanel(P, tab === 'kompass' ? 'comp' : 'axes', () => { changed(); setTab?.(tab); }));
  else if (tab === 'omraden') body.append(policyEditor(P, changed));
  else if (tab === 'ord') body.append(freeTextPanel(P, () => { changed(); setTab?.('omraden'); }));
  else body.append(profilePanel(P));
  drawSum();
  return el;
}

// Kompassen (9 axlar) eller sakfrågorna (12 axlar): reglage −150…150, bortom ±100 = ytterlighetsområdet
function scalesPanel(P, key, onDone) {
  const panel = h('div', { class: 'panel' });
  const list = key === 'comp' ? COMPASS : ISSUES;
  const X = key === 'comp' ? COMPASS_X : ISSUE_X;
  const read = key === 'comp' ? compassExt(P.program) : axesExt(P.program);
  const xa = extremeAxes()[key];
  panel.append(h('p', { class: 'help' }, key === 'comp'
    ? 'Nio ideologiska dimensioner. Dra ett reglage och partiprogrammet skrivs om på alla områden som hör till axeln. Förbi den röda markeringen öppnas ytterlighetsalternativen – från anarkism till totalitarism.'
    : 'De tolv frågorna väljarna bryr sig om. Reglaget skriver om programmet på alla områden som hör till frågan. Förbi den röda markeringen: ytterligheter – t.ex. från inga gränser alls till storskalig återvandring.'));
  for (const it of list) {
    const left = key === 'comp' ? it.left : it.left.split(',')[0], right = key === 'comp' ? it.right : it.right.split(',')[0];
    const [xl, xr] = X[it.id] || ['', ''];
    const allowX = !!xa[it.id];
    const v = read[it.id] || 0;
    const row = h('div', { class: 'axis xaxis' });
    const lab = h('span', { class: Math.abs(v) > 100 ? 'danger' : '' }, scaleLabel(v, left, right, xl, xr));
    const lim = allowX ? 150 : 100;
    const inp = h('input', { type: 'range', min: -lim, max: lim, value: v, 'aria-label': it.name });
    inp.addEventListener('input', () => { const x = +inp.value; lab.textContent = scaleLabel(x, left, right, xl, xr); lab.className = Math.abs(x) > 100 ? 'danger' : ''; });
    inp.addEventListener('change', () => { const x = +inp.value; if (Math.abs(x - v) < 2) return; steerProgram(P.program, key, it.id, x); onDone(); });
    const zone = allowX ? h('div', { class: 'zbar', style: 'background:linear-gradient(to right,var(--xred) 0 16.67%,var(--line) 16.67% 83.33%,var(--xred) 83.33% 100%)' }) : h('div', { class: 'zbar' });
    row.append(h('div', { class: 'name' }, h('span', { style: 'color:var(--text)' }, it.name), lab),
      h('div', { class: 'l' }, left, allowX && xl ? h('small', { class: 'xl' }, '⚠️ ' + xl) : ''),
      h('div', { class: 'xin' }, inp, zone),
      h('div', { class: 'r' }, right, allowX && xr ? h('small', { class: 'xl' }, '⚠️ ' + xr) : ''));
    panel.append(row);
  }
  return panel;
}

// Alla politikområden: sök, domäner, filter. Reglage med eget exakt värde, val med ⚠️-alternativ.
function policyEditor(P, onChange) {
  const panel = h('div', { class: 'panel' });
  let q = '', dom = 'migration', filter = 'alla';
  const search = h('input', { type: 'search', id: 'polsok', placeholder: 'Sök bland alla områden – t.ex. återvandring, val, polis, skatt, EU …', style: 'width:100%' });
  const fchips = h('div', { class: 'chips', style: 'margin:8px 0' });
  const FILTERS = [['alla', 'Alla'], ['andrat', 'Skiljer sig från dagens lag'], ['x', '⚠️ Har ytterligheter'], ['valt', '⚠️ Valda ytterligheter'], ['konst', 'Grundlag']];
  const drawChips = () => { fchips.innerHTML = ''; for (const [id, nm] of FILTERS) fchips.append(h('span', { class: 'chip ' + (filter === id ? 'on' : ''), onclick: () => { filter = id; drawChips(); draw(); } }, nm)); };
  const tabs = h('div', { class: 'tabs domtabs' });
  const drawTabs = () => {
    tabs.innerHTML = '';
    for (const g of DOMAIN_GROUPS) {
      const row = h('div', { class: 'dgb' });
      for (const id of g.ids) { const n = POLICIES.filter((x) => x.domain === id).length; const nx = POLICIES.filter((x) => x.domain === id && isExtremeValue(x, P.program[x.id] ?? x.def)).length; row.append(h('button', { class: id === dom && !q ? 'on' : '', onclick: () => { dom = id; q = ''; search.value = ''; drawTabs(); draw(); } }, DOMAINS[id], h('small', {}, ' ' + n), nx ? h('i', { class: 'dgd', style: 'background:var(--red)' }) : '')); }
      tabs.append(h('div', { class: 'dgl' }, g.name), row);
    }
  };
  const list = h('div', { class: 'list', id: 'pollist' });
  const match = (p, t) => (p.name + ' ' + (p.desc || '') + ' ' + DOMAINS[p.domain] + ' ' + (p.type === 'choice' ? p.options.map((o) => o.name).join(' ') : '')).toLowerCase().includes(t);
  const draw = () => {
    list.innerHTML = '';
    const t = q.trim().toLowerCase();
    let pols = t ? POLICIES.filter((p) => match(p, t)) : filter === 'alla' ? POLICIES.filter((p) => p.domain === dom) : POLICIES.slice();
    if (filter === 'andrat') pols = pols.filter((p) => (P.program[p.id] ?? p.def) !== p.def);
    else if (filter === 'x') pols = pols.filter(hasExtreme);
    else if (filter === 'valt') pols = pols.filter((p) => isExtremeValue(p, P.program[p.id] ?? p.def));
    else if (filter === 'konst') pols = pols.filter((p) => p.konst);
    const shown = pols.slice(0, 60);
    for (const p of shown) list.append(policyRow(P, p, !!(t || filter !== 'alla'), () => { onChange(); drawTabs(); }));
    if (!pols.length) list.append(h('p', { class: 'empty' }, 'Inga områden matchar.'));
    if (pols.length > shown.length) list.append(h('p', { class: 'help' }, `Visar ${shown.length} av ${pols.length} – förfina sökningen.`));
  };
  let tmr = null;
  search.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { q = search.value; drawTabs(); draw(); }, 160); });
  panel.append(h('p', { class: 'help' }, 'Varje område går att ställa in exakt – skriv en egen siffra i rutan om reglaget inte räcker. ⚠️ markerar ytterlighetsalternativ: de är spelbara, men samhället och de andra partierna reagerar därefter.'), search, fchips, tabs, list);
  drawChips(); drawTabs(); draw();
  return panel;
}
function policyRow(P, p, showDomain, onChange) {
  const cur = P.program[p.id] ?? p.def;
  const row = h('div', { class: 'item' + (isExtremeValue(p, cur) ? ' xitem' : '') });
  const warn = h('div', { class: 'xwarn' });
  const setWarn = (v) => { const m = valueMarks(p, v); const t = marksText(m); warn.textContent = t ? '⚠️ Ytterlighet: ' + t : ''; row.classList.toggle('xitem', !!t); };
  row.innerHTML = `<div class="top"><b>${esc(p.name)}${p.konst ? ' <span class="tag gold">grundlag</span>' : ''}${hasExtreme(p) ? ' <span class="tag red" title="Området har ytterlighetsalternativ">⚠️</span>' : ''}</b><small class="muted">${showDomain ? esc(DOMAINS[p.domain]) + ' · ' : ''}idag: ${esc(policyLabel(p, p.def))}</small></div>${p.desc ? `<small class="muted">${esc(p.desc)}</small>` : ''}<div class="pctl"></div>`;
  const slot = row.querySelector('.pctl');
  const set = (v) => { P.program[p.id] = v; setWarn(v); onChange(); };
  if (p.type === 'choice') {
    const sel = h('select', { 'aria-label': p.name });
    for (const o of p.options) { const m = valueMarks(p, o.id); sel.append(h('option', { value: o.id, selected: o.id === cur || false, title: o.desc || '' }, (m.x || m.ext || m.demo ? '⚠️ ' : '') + o.name + (o.id === p.def ? ' (idag)' : ''))); }
    const hint = h('div', { class: 'hint' }, p.options.find((o) => o.id === cur)?.desc || '');
    sel.addEventListener('change', () => { hint.textContent = p.options.find((o) => o.id === sel.value)?.desc || ''; set(sel.value); });
    slot.append(sel, hint);
  } else {
    const [lo, hi] = normalRange(p); const span = p.max - p.min || 1;
    const a = ((lo - p.min) / span) * 100, b = ((hi - p.min) / span) * 100;
    const rng = h('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: cur, 'aria-label': p.name });
    const num = h('input', { type: 'number', min: p.min, max: p.max, step: p.step, value: cur, class: 'pnum' });
    const lab = h('b', {}, policyLabel(p, cur));
    const zone = h('div', { class: 'zbar', style: lo > p.min || hi < p.max ? `background:linear-gradient(to right,var(--xred) 0 ${a}%,var(--line) ${a}% ${b}%,var(--xred) ${b}% 100%)` : '' });
    const snap = (v) => { v = Math.max(p.min, Math.min(p.max, v)); const s = Math.round(v / p.step) * p.step; return Number.isInteger(p.step) ? Math.round(s) : Math.round(s * 100) / 100; };
    rng.addEventListener('input', () => { const v = snap(+rng.value); num.value = v; lab.textContent = policyLabel(p, v); setWarn(v); });
    rng.addEventListener('change', () => set(snap(+rng.value)));
    num.addEventListener('change', () => { const v = snap(+String(num.value).replace(',', '.') || 0); num.value = v; rng.value = v; lab.textContent = policyLabel(p, v); set(v); });
    slot.append(h('div', { class: 'row between', style: 'align-items:center;gap:8px' }, lab, h('span', { class: 'row', style: 'gap:6px;align-items:center' }, num, p.unit ? h('small', { class: 'muted' }, p.unit) : '')),
      h('div', { class: 'xin' }, rng, zone),
      h('div', { class: 'row between', style: 'font-size:11px;color:var(--muted)' }, h('span', {}, policyLabel(p, p.min)), h('span', {}, policyLabel(p, p.max))));
  }
  setWarn(cur);
  slot.append(warn);
  return row;
}

// Politik med egna ord → konkreta områden (spelets AI-modell om den är laddad, annars regler)
function freeTextPanel(P, onApplied) {
  const panel = h('div', { class: 'panel' });
  panel.innerHTML = `<p class="help">Skriv vad partiet vill, med egna ord och egna siffror – "inför 300 000 i återvandring per år", "avskaffa monarkin", "förstatliga bankerna", "inga gränser alls". Spelet letar upp områdena och föreslår värden. Inget kostar något här.</p>
    <textarea id="pptext" rows="4" style="width:100%" maxlength="1500" placeholder="t.ex. Sänk skatten kraftigt, avskaffa Arbetsförmedlingen och inför direktdemokrati."></textarea>
    <div class="row" style="margin-top:8px"><button class="btn gold" id="pptolka">Tolka</button><small class="muted" id="ppvia"></small></div><div class="list" id="ppres" style="margin-top:10px"></div>`;
  const res = panel.querySelector('#ppres');
  panel.querySelector('#pptolka').addEventListener('click', async () => {
    const txt = panel.querySelector('#pptext').value; const btn = panel.querySelector('#pptolka');
    btn.disabled = true; btn.textContent = 'Tolkar …';
    try {
      const { changes, via } = await mapPolicyText(txt, P.program);
      panel.querySelector('#ppvia').textContent = changes.length ? (via === 'ai' ? 'tolkat av spelets AI-modell' : 'tolkat med regler (ladda spelets AI för bättre förståelse)') : '';
      res.innerHTML = '';
      if (!changes.length) { res.append(h('p', { class: 'empty' }, 'Hittade inga områden att ändra – försök vara mer konkret, eller ställ in dem under "Alla områden".')); return; }
      const sel = new Set(changes.map((c) => c.id));
      for (const c of changes) {
        const p = POLICIES.find((x) => x.id === c.id); const m = valueMarks(p, c.to); const t = marksText(m);
        const it = h('label', { class: 'item' + (t ? ' xitem' : ''), style: 'display:flex;gap:10px;align-items:flex-start;cursor:pointer' });
        const cb = h('input', { type: 'checkbox', checked: true }); cb.addEventListener('change', () => { if (cb.checked) sel.add(c.id); else sel.delete(c.id); });
        it.append(cb, h('div', {}, h('b', {}, p.name), h('br'), h('small', {}, `${policyLabel(p, c.from)} → `, h('b', {}, policyLabel(p, c.to)), t ? h('span', { class: 'danger' }, ' ⚠️ ' + t) : '')));
        res.append(it);
      }
      res.append(h('button', { class: 'btn gold', onclick: () => { for (const c of changes) if (sel.has(c.id)) P.program[c.id] = c.to; onApplied(); } }, 'Lägg in i programmet'));
    } finally { btn.disabled = false; btn.textContent = 'Tolka'; }
  });
  return panel;
}

// Hjärtefrågor och bredd
function profilePanel(P) {
  const el = h('div', { class: 'grid c2' });
  const a = h('div', { class: 'panel' });
  a.innerHTML = `<h3>Hjärtefrågor <small class="muted">(välj upp till 3)</small></h3><p class="help">Frågor ni profilerar er på. Väljare som bryr sig om dem lyssnar extra på er, och ni får bonus i debatter om dem.</p><div class="chips" id="profile"></div>`;
  const prof = a.querySelector('#profile');
  for (const is of ISSUES) { const c = h('span', { class: 'chip ' + (P.profile[is.id] ? 'on' : ''), onclick: () => { if (P.profile[is.id]) delete P.profile[is.id]; else if (Object.keys(P.profile).length < 3) P.profile[is.id] = 1.6; else return; c.classList.toggle('on', !!P.profile[is.id]); } }, is.name); prof.append(c); }
  const b = h('div', { class: 'panel' });
  b.innerHTML = `<h3>Bredd eller skärpa</h3><p class="help">Ett brett, pragmatiskt parti tolererar att väljare står en bit ifrån – men kärnväljarna är mindre lojala och trovärdigheten lägre. Ett smalt, ideologiskt parti har lojala kärnväljare men svårare att växa.</p><div class="axis" id="bredd"></div>`;
  const br = b.querySelector('#bredd');
  const bl = (v) => v < 25 ? 'Smalt ideologiskt parti' : v < 45 ? 'Tydlig profil' : v < 60 ? 'Balanserat' : v < 80 ? 'Brett folkparti' : 'Catch-all-parti';
  br.innerHTML = `<div class="name"><span style="color:var(--text)">Partiets karaktär</span><span id="bv">${bl(P.structure.bredd)}</span></div><div class="l">Smalt & ideologiskt</div><input type="range" min="0" max="100" value="${P.structure.bredd}"><div class="r">Brett & pragmatiskt</div>`;
  br.querySelector('input').addEventListener('input', (e) => { P.structure.bredd = +e.target.value; br.querySelector('#bv').textContent = bl(P.structure.bredd); });
  el.append(a, b);
  return el;
}
