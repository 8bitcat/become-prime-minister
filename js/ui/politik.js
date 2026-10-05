// Politiken: över trehundra områden i 26 domäner. Gällande lag, partiets program, reformförslag.
import { h, esc, fmt, kr, dayDiff } from '../core/util.js';
import { POLICIES, POLICY_BY_ID, DOMAINS, DOMAIN_GROUPS, COMPASS, norm, policyLabel, normalRange, valueMarks, hasExtreme } from '../data/policies.js';
import { ISSUE_BY_ID } from '../data/issues.js';
import { effectiveLaw, reformCost, ideologyDescription, programText, DOMAIN_ISSUE, billLike, programExtremism, compassExt, EXT_NAMES, DEMO_NAMES } from '../sim/policy.js';
const marksText = (m) => [m.ext ? EXT_NAMES[m.ext] : (m.x ? 'ytterlighet' : ''), m.demo < 0 ? DEMO_NAMES[m.demo] : ''].filter(Boolean).join(' · ');
const xmark = (p, v) => { const m = valueMarks(p, v); return m.x || m.ext || m.demo ? '⚠️ ' : ''; };
import { isPlayerPM } from '../sim/government.js';
import { activeParties } from '../sim/opinion.js';
import { aiVote } from '../sim/riksdag.js';
import { ACTIONS } from '../sim/turn.js';
import { policyTextCard } from './policytext.js';

const me = (s) => s.parties[s.player.partyId];

export function pagePolitik(s, ui, tab = 'migration') {
  const p = me(s);
  const el = h('div', {});
  const law = effectiveLaw(s);
  const desc = ideologyDescription(p.program || {});
  el.innerHTML = `<div class="page-title"><div><h2>Politiken</h2><small class="muted">${POLICIES.length} områden i ${Object.keys(DOMAINS).length} domäner. Vänster: gällande lag i Sverige. Höger: ert partiprogram. Ideologin räknas ut ur programmet – just nu: <b>${esc(desc.label)}</b>.</small></div><div class="row"><button class="btn" id="progTxt">📜 Partiprogrammet</button>${p.inRiksdag ? '<button class="btn gold" id="reformBtn">⚖️ Föreslå reform</button>' : ''}</div></div>`;
  // domänflikarna i grupper; siffran = antal områden, punkten = reformer på gång i domänen
  const tabs = h('div', { class: 'tabs domtabs' });
  for (const g of DOMAIN_GROUPS) {
    const row = h('div', { class: 'dgb' });
    for (const id of g.ids) {
      const pols = POLICIES.filter((x) => x.domain === id);
      const diff = pols.filter((x) => Math.abs(norm(x, p.program?.[x.id] ?? x.def) - norm(x, law[x.id] ?? x.def)) > .15).length;
      const busy = pols.some((x) => (s.reforms || []).some((r) => r.policyId === x.id && r.progress < 1) || s.riksdag.bills.some((b) => b.kind === 'reform' && b.policyId === x.id && b.status === 'pending'));
      row.append(h('button', { class: id === tab ? 'on' : '', title: `${pols.length} områden · ert program skiljer sig från lagen i ${diff}${busy ? ' · reformer på gång' : ''}`, onclick: () => ui.render('politik', id) }, DOMAINS[id], h('small', {}, ' ' + pols.length), busy ? h('i', { class: 'dgd' }) : ''));
    }
    tabs.append(h('div', { class: 'dgl' }, g.name), row);
  }
  const pe = programExtremism(p.program || {});
  if (pe.items.length) el.append(h('div', { class: 'xbanner ' + (pe.demo <= -2 || pe.ext >= 3 ? 'red' : pe.ext >= 2 || pe.demo < 0 ? 'orange' : 'gold'), style: 'margin-bottom:12px', html: `<b>⚠️ Programmet är ${esc(EXT_NAMES[pe.ext])}${pe.demo < 0 ? ' · ' + esc(DEMO_NAMES[pe.demo]) : ''}</b> <small class="muted">– ${pe.ext >= 2 || pe.demo <= -2 ? 'övriga partier vägrar samarbete, medierna granskar hårt.' : 'medierna lyfter de radikala punkterna.'}</small><div class="chips" style="margin-top:6px">${pe.items.slice(0, 10).map((i) => `<span class="chip static">${esc(i.name)}: ${esc(i.label)}</span>`).join('')}</div>` }));
  el.append(policyTextCard(s, ui));
  el.append(tabs);
  const changes = {};
  const list = h('div', { class: 'list' });
  for (const pol of POLICIES.filter((x) => x.domain === tab)) list.append(policyRow(s, ui, pol, law, changes));
  el.append(list);
  const bar = h('div', { class: 'row between', style: 'position:sticky;bottom:0;background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin-top:14px' });
  const cnt = h('span', { class: 'muted' }, 'Inga ändringar i programmet');
  const btn = h('button', { class: 'btn gold', disabled: true }, 'Anta ändringarna i programmet (1 AP)');
  btn.addEventListener('click', () => ui.action(ACTIONS.find((a) => a.id === 'program_policy'), { changes: { ...changes } }));
  el._touch = () => { const n = Object.keys(changes).length; cnt.textContent = n ? `${n} ändring${n > 1 ? 'ar' : ''} i programmet – trovärdighet −${Math.min(6, n * .6 * (p.inRiksdag ? 1.3 : 1)).toFixed(1)}` : 'Inga ändringar i programmet'; btn.disabled = !n || s.ap < 1; };
  bar.append(cnt, btn); el.append(bar);
  el.querySelector('#progTxt').addEventListener('click', () => ui.programModal());
  el.querySelector('#reformBtn')?.addEventListener('click', () => ui.action(ACTIONS.find((a) => a.id === 'reform')));
  return el;
}
function policyRow(s, ui, pol, law, changes) {
  const p = me(s);
  const cur = law[pol.id], lawTarget = s.policy[pol.id];
  const prog = p.program?.[pol.id] ?? pol.def;
  const active = (s.reforms || []).find((r) => r.policyId === pol.id && r.progress < 1);
  const pending = s.riksdag.bills.find((b) => b.kind === 'reform' && b.policyId === pol.id && (b.status === 'pending' || b.status === 'voting'));
  const vilande = (s.riksdag.vilande || []).find((v) => v.policyId === pol.id);
  const row = h('div', { class: 'item' });
  const axes = Object.keys(pol.axes || {}).map((a) => ISSUE_BY_ID[a]?.short).filter(Boolean).join(', ');
  { const m = valueMarks(pol, prog); if (m.x || m.ext || m.demo) row.classList.add('xitem'); }
  row.innerHTML = `<div class="top"><b>${esc(pol.name)}${pol.konst ? ' <span class="tag gold">grundlag</span>' : ''}${hasExtreme(pol) ? ' <span class="tag red" title="Området har ytterlighetsalternativ">⚠️</span>' : ''}</b><small class="muted">${axes ? 'påverkar ' + esc(axes) + ' · ' : ''}${pol.lag} mån genomförande</small></div>${pol.desc ? `<small class="muted">${esc(pol.desc)}</small>` : ''}
    <div class="grid c2" style="margin-top:8px;gap:10px">
      <div class="card" style="padding:10px"><small class="muted">GÄLLANDE LAG</small><br><b>${xmark(pol, lawTarget)}${esc(policyLabel(pol, lawTarget))}</b>${active ? `<br><small class="muted">genomförs: ${fmt(active.progress * 100, 0)} % · nu ${esc(policyLabel(pol, pol.type === 'choice' ? cur : Math.round(cur * 100) / 100))}</small>` : ''}${pending ? `<br><small class="tag blue">omröstning v${pending.voteWeek}: ${esc(policyLabel(pol, pending.to))}</small>` : ''}${vilande ? `<br><small class="tag gold">vilande till efter valet ${vilande.year}: ${esc(policyLabel(pol, vilande.to))}</small>` : ''}</div>
      <div class="card" style="padding:10px"><small class="muted">VÅRT PROGRAM</small><div class="prog"></div></div>
    </div>`;
  const slot = row.querySelector('.prog');
  const warn = h('div', { class: 'xwarn' });
  const setWarn = (v) => { const t = marksText(valueMarks(pol, v)); warn.textContent = t ? '⚠️ Ytterlighet: ' + t : ''; };
  if (pol.type === 'choice') {
    const sel = h('select', {}); for (const o of pol.options) sel.append(h('option', { value: o.id, selected: o.id === prog || false, title: o.desc || '' }, xmark(pol, o.id) + o.name));
    sel.addEventListener('change', () => { if (sel.value === (p.program?.[pol.id] ?? pol.def)) delete changes[pol.id]; else changes[pol.id] = sel.value; row.style.borderColor = changes[pol.id] != null ? 'var(--gold)' : ''; hint.textContent = pol.options.find((o) => o.id === sel.value)?.desc || ''; setWarn(sel.value); ui.currentPage?._touch?.(); });
    const hint = h('div', { class: 'hint' }, pol.options.find((o) => o.id === prog)?.desc || '');
    slot.append(sel, hint);
  } else {
    const inp = h('input', { type: 'range', min: pol.min, max: pol.max, step: pol.step, value: prog });
    const num = h('input', { type: 'number', min: pol.min, max: pol.max, step: pol.step, value: prog, class: 'pnum', title: 'Skriv ett exakt värde' });
    const val = h('b', {}, policyLabel(pol, prog));
    const diff = h('small', { class: 'muted' }, '');
    const snap = (v) => { v = Math.max(pol.min, Math.min(pol.max, v)); const r = Math.round(v / pol.step) * pol.step; return Number.isInteger(pol.step) ? Math.round(r) : Math.round(r * 100) / 100; };
    const upd = (v) => { val.textContent = policyLabel(pol, v); const base = p.program?.[pol.id] ?? pol.def; if (v === base) delete changes[pol.id]; else changes[pol.id] = v; row.style.borderColor = changes[pol.id] != null ? 'var(--gold)' : ''; const c = (pol.cost(v) || 0) - (pol.cost(lawTarget) || 0); diff.textContent = pol.budget || !pol.cost ? '' : `jämfört med lagen: ${c > 0 ? '+' : ''}${fmt(c, 0)} mdkr/år`; setWarn(v); ui.currentPage?._touch?.(); };
    inp.addEventListener('input', () => { const v = snap(+inp.value); num.value = v; upd(v); });
    num.addEventListener('change', () => { const v = snap(+String(num.value).replace(',', '.') || 0); num.value = v; inp.value = v; upd(v); });
    const [lo, hi] = normalRange(pol); const span = pol.max - pol.min || 1; const a = ((lo - pol.min) / span) * 100, b = ((hi - pol.min) / span) * 100;
    const zone = h('div', { class: 'zbar', style: lo > pol.min || hi < pol.max ? `background:linear-gradient(to right,var(--xred) 0 ${a}%,var(--line) ${a}% ${b}%,var(--xred) ${b}% 100%)` : '' });
    slot.append(h('div', { class: 'row between', style: 'align-items:center;gap:6px' }, val, h('span', { class: 'row', style: 'gap:6px;align-items:center' }, num, pol.unit ? h('small', { class: 'muted' }, pol.unit) : '')), h('div', { class: 'xin' }, inp, zone), h('div', { class: 'row between', style: 'font-size:11px;color:var(--muted)' }, h('span', {}, policyLabel(pol, pol.min)), diff, h('span', {}, policyLabel(pol, pol.max))));
  }
  setWarn(prog); slot.append(warn);
  return row;
}

// Reformdialogen: välj område och målvärde, se kapital, kostnad och väntad omröstning
export function reformPicker(s, run, modal, choice) {
  const p = me(s);
  return new Promise(async (resolve) => {
    const pm = isPlayerPM(s);
    const doms = DOMAIN_GROUPS.flatMap((g) => g.ids.map((id) => ({ id, group: g.name })));
    const domIdx = await choice({ title: 'Föreslå reform – område', text: 'Vilken domän?', choices: doms.map((d) => ({ label: DOMAINS[d.id], desc: `${d.group} · ${POLICIES.filter((x) => x.domain === d.id).length} områden` })), wide: true });
    if (domIdx == null || !doms[domIdx]) { resolve(); return; }
    const dom = doms[domIdx].id;
    const pols = POLICIES.filter((x) => x.domain === dom && !(s.reforms || []).some((r) => r.policyId === x.id && r.progress < 1) && !s.riksdag.bills.some((b) => b.kind === 'reform' && b.policyId === x.id && b.status === 'pending'));
    if (!pols.length) { resolve(); return; }
    const pi = await choice({ title: 'Föreslå reform – område', text: 'Vilket område?', choices: pols.map((x) => ({ label: x.name, desc: `lag: ${policyLabel(x, s.policy[x.id])} · vårt program: ${policyLabel(x, p.program?.[x.id] ?? x.def)}${x.konst ? ' · grundlag' : ''}` })), wide: true });
    const pol = pols[pi];
    const from = s.policy[pol.id];
    let to = p.program?.[pol.id] ?? pol.def;
    const body = h('div', {});
    const info = h('div', { class: 'card', style: 'margin-top:10px' });
    const draw = () => {
      const bl = billLike(s, { policyId: pol.id, from, to });
      let ja = 0, nej = 0, avst = 0; const detail = [];
      for (const q of activeParties(s)) { const n = s.riksdag.seats[q.id] || 0; if (!n) continue; const v = q.isPlayer ? 'ja' : aiVote(s, q, bl, p.id); if (v === 'ja') ja += n; else if (v === 'nej') nej += n; else avst += n; detail.push(`${q.abbr}: ${v}`); }
      const cost = reformCost(pol, from, to);
      info.innerHTML = `<b>${esc(bl.title)}</b><br><small>${esc(bl.desc)}</small><br><div style="margin-top:6px">Budgeteffekt: <b>${bl.cost > 0 ? '+' : ''}${fmt(bl.cost, 0)} mdkr/år</b> · genomförande ${pol.lag} mån${pm ? ` · politiskt kapital <b class="${cost > (s.government.capital ?? 0) ? 'danger' : ''}">${cost}</b> (ni har ${fmt(s.government.capital ?? 0, 0)})` : ''}</div><div style="margin-top:6px">Väntad omröstning: <span class="up">${ja} ja</span> · <span class="down">${nej} nej</span> · ${avst} avstår → <b class="${ja > nej ? 'ok' : 'danger'}">${ja > nej ? 'går igenom' : 'faller'}</b><br><small class="muted">${detail.join(' · ')}</small></div>`;
      btn.disabled = (pm && cost > (s.government.capital ?? 0)) || to === from;
    };
    body.innerHTML = `<p class="help">Gällande lag: <b>${esc(policyLabel(pol, from))}</b>. Välj vad lagen ska ändras till. Partierna röstar efter sina egna program – ett förslag nära motståndarnas program går lättare igenom.</p>`;
    if (pol.type === 'choice') { const sel = h('select', {}); for (const o of pol.options) sel.append(h('option', { value: o.id, selected: o.id === to || false }, xmark(pol, o.id) + o.name)); sel.addEventListener('change', () => { to = sel.value; draw(); }); body.append(sel); }
    else { const inp = h('input', { type: 'range', min: pol.min, max: pol.max, step: pol.step, value: to }); const val = h('b', {}, policyLabel(pol, to)); inp.addEventListener('input', () => { to = +inp.value; val.textContent = policyLabel(pol, to); draw(); }); body.append(h('div', { class: 'row between' }, h('span', {}, 'Nytt värde'), val), inp); }
    body.append(info);
    const btn = h('button', { class: 'btn gold' }, 'Lägg fram förslaget (1 AP)');
    btn.addEventListener('click', () => { m.close(); run({ policyId: pol.id, to }); resolve(); });
    const m = modal({ title: `Reform: ${pol.name}`, body, wide: true, buttons: [{ label: 'Avbryt', onClick: resolve }] });
    m.el.querySelector('.mf').prepend(btn);
    draw();
  });
}

// Kompassen: den vanliga skalan (±100) och ytterlighetszonerna (till ±150) i rött
export function compassSVG(c, w = 420) {
  const rowH = 26; const hgt = COMPASS.length * rowH + 10; const cx = w / 2;
  const X = Math.max(60, cx - 112), N = X * 100 / 150;
  return `<svg viewBox="0 0 ${w} ${hgt}" class="chart">${COMPASS.map((ax, i) => { const y = i * rowH + 16; const v = Math.max(-150, Math.min(150, c[ax.id] || 0)); const x = cx + (v / 150) * X; return `<text x="${cx - X - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#93a3bd">${esc(ax.left)}</text><text x="${cx + X + 6}" y="${y + 4}" font-size="10" fill="#93a3bd">${esc(ax.right)}</text><line x1="${cx - X}" x2="${cx - N}" y1="${y}" y2="${y}" stroke="rgba(229,72,77,.35)" stroke-width="3"/><line x1="${cx + N}" x2="${cx + X}" y1="${y}" y2="${y}" stroke="rgba(229,72,77,.35)" stroke-width="3"/><line x1="${cx - N}" x2="${cx + N}" y1="${y}" y2="${y}" stroke="#27395a" stroke-width="4" stroke-linecap="round"/><line x1="${cx}" x2="${cx}" y1="${y - 6}" y2="${y + 6}" stroke="#3b5380"/><circle cx="${x}" cy="${y}" r="6" fill="${Math.abs(v) > 100 ? '#e5484d' : Math.abs(v) > 40 ? '#f2c14e' : '#4f8ff7'}"/>`; }).join('')}</svg>`;
}
export function programModalBody(s) {
  const p = me(s); const d = ideologyDescription(p.program || {});
  const txt = programText(p);
  const pe = programExtremism(p.program || {});
  return `<p><b>${esc(p.name)}</b> – ${esc(d.label)}.${d.tags.length ? ' Profil: ' + d.tags.map(esc).join(', ') + '.' : ''}${pe.items.length ? ` <span class="danger">⚠️ ${esc(EXT_NAMES[pe.ext])}${pe.demo < 0 ? ' · ' + esc(DEMO_NAMES[pe.demo]) : ''}</span>` : ''}</p>${compassSVG(compassExt(p.program || {}))}<p class="help">Närmast: ${d.near.map((n) => esc(n.name) + ' (' + fmt(n.d, 0) + ')').join(' · ')}</p>${txt.map((t) => `<h4 style="margin:10px 0 4px;color:var(--gold)">${esc(t.domain)}</h4><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5">${t.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`).join('') || '<p class="empty">Programmet ligger nära dagens lagar på alla områden.</p>'}`;
}
