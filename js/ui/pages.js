// Spelets sidor. Varje funktion får state och returnerar ett element.
import { h, esc, fmt, pct, kr, signed, fmtDate, MONTHS_SHORT, dayDiff, clamp } from '../core/util.js';
import { ISSUES, ISSUE_BY_ID, issueLabel } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { REGIONS } from '../data/regions.js';
import { STATS, STAT_BY_ID, CATS, REGIONAL_STATS } from '../data/stats.js';
import { MEDIA, POLL_INSTITUTES } from '../data/names.js';
import { logoSVG } from '../art/logo.js';
import { characterSVG } from '../art/character.js';
import { lineChart, sparkline, hemicycle, seatBar, barRow } from './charts.js';
import { activeParties, regionalSupport } from '../sim/opinion.js';
import { ACTIONS, actionAvailable, weeklyMoney } from '../sim/turn.js';
import { BILL_BY_ID, BILLS, stance, aiVote } from '../sim/riksdag.js';
import { MINISTRIES, isPlayerPM, playerInGov, willingness } from '../sim/government.js';
import { PLATFORMS, followersOf } from '../sim/social.js';
import { TRAITS, traitLabel, personSummary, personaSummary } from '../sim/people.js';
import { structureSummary, economyLines, STRUCTURE_OPTIONS } from '../sim/party.js';
import { trustLabel } from '../sim/promises.js';
import { influencerLabel, PLATFORM_NAMES } from '../sim/media.js';
import { ideologyLabel } from '../data/ideologies.js';
import { PROFESSION_BY_ID, EXPERIENCE_BY_ID, PUBLIC_IMAGE } from '../data/persona.js';
import { authenticity } from '../sim/opinion.js';
import { TOTAL_KOMMUNER } from '../sim/election.js';
import { itemBill } from '../sim/riksdag.js';
import { ideologyDescription, effectiveLaw } from '../sim/policy.js';
import { POLICY_BY_ID, policyLabel } from '../data/policies.js';
import { compassSVG } from './politik.js';
import { outletInfo } from '../sim/news.js';
import { COUNTRIES, relationLabel } from '../sim/world.js';
import { partyRisk } from '../sim/scandals.js';
import { statFmt } from '../sim/sweden.js';

const me = (s) => s.parties[s.player.partyId];
const leader = (s) => s.people[me(s).leader];
const card = (title, inner, extra = '') => { const c = h('div', { class: 'card' }); c.innerHTML = `<h3>${title}</h3>${extra}`; if (typeof inner === 'string') c.insertAdjacentHTML('beforeend', inner); else if (inner) c.append(inner); return c; };
const partyName = (s, id) => s.parties[id]?.abbr || '?';
const dot = (c) => `<span class="pos-dot" style="background:${c}"></span>`;
const kpi = (label, value, d = '') => `<div class="kpi"><small>${label}</small><b>${value}</b>${d ? `<span class="d">${d}</span>` : ''}</div>`;
const trendOf = (s, id, n = 4) => { const t = s.opinion.trend; if (t.length < n + 1) return 0; return (t[t.length - 1].s[id] || 0) - (t[t.length - 1 - n].s[id] || 0); };
const dcls = (v, good = 'up') => (v > 0 ? (good === 'up' ? 'up' : 'down') : v < 0 ? (good === 'up' ? 'down' : 'up') : '');

// ---------- ÖVERSIKT ----------
export function pageOverview(s, ui) {
  const p = me(s), l = leader(s);
  const el = h('div', {});
  const sup = s.opinion.support[p.id] || 0, tr = trendOf(s, p.id);
  const seats = s.riksdag.seats[p.id] || 0;
  const days = dayDiff(s.date, s.election.next);
  const gov = s.government;
  const role = isPlayerPM(s) ? 'Statsminister' : playerInGov(s) ? 'Regeringsparti' : gov.support.includes(p.id) ? 'Stödparti' : p.inRiksdag ? 'Opposition' : 'Utanför riksdagen';
  el.innerHTML = `<div class="page-title"><div><h2>${esc(p.name)}</h2><small class="muted">${esc(role)} · ${esc(l.name)} · vecka ${s.week} · ${fmtDate(s.date, true)}</small></div><div class="row"><span class="tag gold">${s.election.campaign ? '🗳️ VALRÖRELSE' : `${Math.max(0, Math.round(days / 7))} veckor till valet`}</span></div></div>`;
  const kp = h('div', { class: 'kpis', style: 'margin-bottom:14px' });
  kp.innerHTML = kpi('Opinionsstöd', pct(sup), `<span class="${dcls(tr)}">${signed(tr, 1, ' p')} på 4 v</span>`) + kpi('Mandat', seats, p.inRiksdag ? 'av 349' : 'utanför riksdagen') + kpi('Partiledarens stöd', pct(l.approval, 0)) + kpi('Partikassa', kr(p.money), `<span class="${dcls(weeklyMoney(s).income - weeklyMoney(s).cost)}">${signed((weeklyMoney(s).income - weeklyMoney(s).cost) / 1000, 0, ' tkr/v')}</span>`) + kpi('Medlemmar', fmt(p.members)) + kpi('Uppmärksamhet', fmt(p.attention, 0) + '/100') + kpi('Trovärdighet', fmt(p.credibility, 0) + '/100') + kpi('Förtroende', fmt(p.trust ?? 50, 0) + '/100', esc(trustLabel(p.trust ?? 50))) + kpi('Sammanhållning', fmt(p.unity, 0) + '/100') + (s.opinion.awareness[p.id] < 1 ? kpi('Kännedom', pct(s.opinion.awareness[p.id] * 100, 0), 'hur många vet att ni finns') : '') + (gov.pm ? kpi('Regeringens stöd', pct(gov.approval, 0), esc(gov.parties.map((id) => partyName(s, id)).join('+'))) : kpi('Regering', 'Saknas', 'expeditionsministär'));
  el.append(kp);
  const g = h('div', { class: 'grid c2' });
  // handlingar
  const act = card(`<span><span class="ic">⚡</span>Veckans handlingar</span><span class="ap">${Array.from({ length: s.apMax }, (_, i) => `<i class="${i < s.ap ? '' : 'off'}"></i>`).join('')} ${s.ap}/${s.apMax}</span>`, actionsGrid(s, ui));
  g.append(act);
  // senaste mätning
  const poll = s.opinion.polls[0];
  const pc = card(`<span><span class="ic">📊</span>Senaste mätningen</span><small class="muted">${poll ? esc(poll.inst) + ' · ' + fmtDate(poll.date) : ''}</small>`, poll ? pollBars(s, poll) : '<div class="empty">Ingen mätning ännu</div>');
  g.append(pc);
  // nyheter
  const nw = card(`<span><span class="ic">📰</span>Nyheter</span><button class="btn sm ghost" data-go="nyheter">Alla →</button>`, newsFeed(s, s.news.slice(0, 4), ui));
  g.append(nw);
  // Sverige just nu + regeringen
  const st = s.sweden.stats;
  const sv = card(`<span><span class="ic">🇸🇪</span>Sverige just nu</span><button class="btn sm ghost" data-go="sverige">Statistik →</button>`, `<div class="kpis">${['bnp_tillvaxt', 'inflation', 'arbetsloshet', 'skjutningar', 'vardkoer', 'elpris'].map((id) => { const d = STAT_BY_ID[id]; const hist = s.sweden.hist[id] || []; const delta = hist.length > 1 ? st[id] - hist[hist.length - 2] : 0; return kpi(d.name, fmt(st[id], d.d) + ' ' + d.unit, `<span class="${dcls(delta, d.good === 'target2' ? 'none' : d.good || 'none')}">${signed(delta, d.d)}</span> sen förra månaden`); }).join('')}</div>
    <div style="margin-top:10px"><b>Hetast i debatten:</b> ${Object.entries(s.opinion.salience).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, v]) => `<span class="tag ${v > 1.3 ? 'red' : v > 1.1 ? 'gold' : ''}">${esc(ISSUE_BY_ID[id].short)}</span>`).join(' ')}</div>`);
  g.append(sv);
  el.append(g);
  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
  return el;
}
export function actionsGrid(s, ui) {
  const grid = h('div', { class: 'actions' });
  for (const a of ACTIONS) {
    if (a.cond && !a.cond(s) && !['motion', 'forhandla', 'reklam', 'dorr'].includes(a.id)) continue;
    if (a.cond && !a.cond(s)) continue;
    const ok = actionAvailable(s, a);
    const d = h('div', { class: 'action ' + (ok ? '' : 'off') });
    d.innerHTML = `<div class="t"><span>${a.ic} ${esc(a.name)}</span><span class="cost">${a.ap ? a.ap + ' AP' : 'gratis'}${a.money ? ' · ' + kr(a.money(s)) : ''}</span></div><small>${esc(a.desc)}</small>`;
    if (ok) d.addEventListener('click', () => ui.action(a));
    grid.append(d);
  }
  const some = h('div', { class: 'action ' + (s.ap >= 1 ? '' : 'off') });
  some.innerHTML = `<div class="t"><span>📱 Sociala medier</span><span class="cost">1 AP</span></div><small>Publicera ett inlägg på X, Instagram, TikTok eller Facebook. Räckvidd, följare – och risk.</small>`;
  if (s.ap >= 1) some.addEventListener('click', () => ui.go('some'));
  grid.append(some);
  return grid;
}
export function pollBars(s, poll, { prev = null } = {}) {
  const parties = activeParties(s).map((p) => ({ p, v: poll.res[p.id] ?? 0 })).sort((a, b) => b.v - a.v);
  const mx = Math.max(10, ...parties.map((x) => x.v));
  return `<div>${parties.map(({ p, v }) => { const pv = prev ? prev.res[p.id] : null; return `<div class="pbar" style="margin:4px 0"><span style="width:34px;font-weight:700">${esc(p.abbr)}</span><div class="bar" style="height:14px"><i style="width:${(v / mx) * 100}%;background:${p.color}"></i></div><b style="width:52px;text-align:right">${fmt(v, 1)}</b><small style="width:50px;text-align:right" class="${pv != null ? dcls(v - pv) : ''}">${pv != null ? signed(v - pv, 1) : ''}</small>${v < 4 && p.inRiksdag ? '<span class="tag red">spärr</span>' : ''}</div>`; }).join('')}</div>`;
}
export function newsFeed(s, items, ui) {
  if (!items.length) return '<div class="empty">Inga nyheter</div>';
  const el = h('div', { class: 'news' });
  for (const n of items) {
    const o = outletInfo(n.outlet);
    const d = h('div', { class: 'nitem' });
    d.innerHTML = `<div class="outlet" style="background:${o.color};color:${o.fg}">${esc(o.short)}</div><div><h4>${esc(n.headline)}</h4><p>${esc(n.body)}</p><div class="meta">${fmtDate(n.date)} · ${esc(o.name)}${n.partyId ? ' · ' + esc(partyName(s, n.partyId)) : ''}${n.tags.includes('skandal') ? ' · <span class="tag red">skandal</span>' : ''}</div></div>`;
    el.append(d);
  }
  return el;
}

// ---------- PARTIET ----------
export function pageParty(s, ui) {
  const p = me(s), l = leader(s);
  const el = h('div', {});
  el.innerHTML = `<div class="page-title"><h2>Partiet</h2></div>`;
  const g = h('div', { class: 'grid c3' });
  const idc = card('Identitet', `<div class="row" style="align-items:flex-start"><div class="hero-logo">${logoSVG(p, 100)}</div><div><b style="font-size:20px">${esc(p.name)}</b> (${esc(p.abbr)})<br><small class="muted">"${esc(p.slogan)}"</small><br><small>Grundat ${p.founded} · ${fmt(p.members)} medlemmar</small></div></div>
    <div style="margin-top:6px"><small class="muted">${esc(ideologyLabel(p.ideology?.primary, p.ideology?.secondary))}${p.ext >= 2 ? ' · <span class="danger">' + (p.ext >= 3 ? 'systemfientligt' : 'radikalt') + '</span>' : ''}</small></div>
    <div style="margin-top:12px">${barRow('Organisation', p.org, 100)}${barRow('Sammanhållning', p.unity, 100, p.unity < 45 ? 'var(--red)' : 'var(--green)')}${barRow('Trovärdighet', p.credibility, 100, 'var(--blue)')}${barRow('Förtroende', p.trust ?? 50, 100, 'var(--green)', trustLabel(p.trust ?? 50))}${barRow('Uppmärksamhet', p.attention, 100, 'var(--orange)')}${barRow('Skandalrisk', Math.min(100, partyRisk(s, p) * 2.5), 100, 'var(--red)', fmt(partyRisk(s, p), 1) + '‰/v')}${barRow('Aktivister', p.activists || 0, Math.max(100, p.members * .15), 'var(--gold)', fmt(p.activists || 0))}</div>
    <div style="margin-top:12px"><b>Ekonomi</b> <small class="muted">kassa ${kr(p.money)}</small><table>${economyLines(s, p).income.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num up">+${kr(v)}/v</td></tr>`).join('')}${economyLines(s, p).cost.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num down">−${kr(v)}/v</td></tr>`).join('')}<tr><td><b>Netto</b></td><td class="num ${weeklyMoney(s).income - weeklyMoney(s).cost >= 0 ? 'up' : 'down'}"><b>${signed((weeklyMoney(s).income - weeklyMoney(s).cost) / 1000, 0, ' tkr/v')}</b></td></tr></table></div>`);
  const lc = card('Partiledaren', `<div class="row" style="align-items:flex-start"><div class="face lg" style="width:96px;height:120px">${characterSVG(l, { crop: 'head', expr: 'confident', id: 'pl' })}</div><div><b style="font-size:18px">${esc(l.name)}</b><br><small class="muted">${esc(personSummary(l))}</small><br><small>Partiledare sedan ${fmtDate(l.since || s.date)} · stöd ${pct(l.approval, 0)}</small></div></div>
    <div style="margin:8px 0"><small>${esc(personaSummary(l))}${l.persona?.image ? ' · image: <b>' + esc(PUBLIC_IMAGE.find((x) => x.id === l.persona.image)?.name || '') + '</b> (' + (authenticity(l) >= .55 ? '<span class="ok">äkta</span>' : authenticity(l) >= .4 ? 'delvis trovärdig' : '<span class="danger">spelad</span>') + ')' : ''}${Object.keys(l.cred || {}).length ? '<br>Trovärdig i: ' + Object.keys(l.cred).map((k) => esc(ISSUE_BY_ID[k].short.toLowerCase())).join(', ') : ''}</small></div>
    <div style="margin-top:10px">${TRAITS.map((t) => barRow(t.name, l.traits[t.id], 100, l.traits[t.id] >= 65 ? 'var(--green)' : l.traits[t.id] < 35 ? 'var(--red)' : 'var(--gold)', traitLabel(l.traits[t.id]))).join('')}</div><button class="btn sm ghost" id="avga" style="margin-top:8px">🚪 Lämna partiledarposten</button>`);
  lc.querySelector('#avga').addEventListener('click', () => ui.action(ACTIONS.find((a) => a.id === 'avga')));
  const idd = ideologyDescription(p.program || {});
  const pos = card(`<span>Politiken</span><button class="btn sm" id="chg">Ändra program</button>`, `<p style="margin:0 0 6px"><b>${esc(idd.label)}</b><br><small class="muted">${idd.tags.map(esc).join(' · ') || 'nära mitten'}</small></p>${compassSVG(idd.compass, 380)}<table>${ISSUES.map((is) => `<tr><td>${esc(is.name)}</td><td class="num" style="width:70px"><span class="${p.pos[is.id] < 0 ? 'down' : 'up'}" style="font-variant-numeric:tabular-nums">${p.pos[is.id] > 0 ? '+' : ''}${p.pos[is.id]}</span></td><td><small class="muted">${esc(issueLabel(is.id, p.pos[is.id]))}${p.profile?.[is.id] > 1.1 ? ' · <span class="tag gold">hjärtefråga</span>' : ''}</small></td></tr>`).join('')}</table>`);
  pos.querySelector('#chg').addEventListener('click', () => ui.go('politik'));
  g.append(idc, lc, pos);
  const people = card('Partiets profiler', (p.people || []).map((id) => s.people[id]).filter((x) => x && x.alive).map((m) => `<div class="minister"><div class="av">${characterSVG(m, { crop: 'face', id: 'm' + m.id })}</div><div><b>${esc(m.name)}</b> ${m.ministry ? `<span class="tag gold">${esc(MINISTRIES.find((x) => x.id === m.ministry)?.name || 'minister')}</span>` : ''}<br><small class="muted">${esc(personSummary(m))} · integritet ${m.traits.integritet} · ledarskap ${m.traits.ledarskap}</small></div></div>`).join('') || '<div class="empty">Inga</div>');
  const rel = card('Relationer till andra partier', activeParties(s).filter((q) => q.id !== p.id).map((q) => { const v = q.relations?.[p.id] || 0; const w = willingness(s, q, p); return `<div class="relbar">${dot(q.color)}<span style="width:36px;font-weight:700">${esc(q.abbr)}</span><div class="bar"><i style="left:${50 + v / 2}%"></i></div><small style="width:150px;text-align:right">${v > 30 ? 'Vänligt' : v > 0 ? 'Neutralt' : v > -30 ? 'Svalt' : 'Fientligt'} · samarbete ${w > 45 ? '✓' : w > 20 ? '~' : '✗'}</small></div>`; }).join(''));
  const prom = card('Löften & utspel', (p.manifest ? `<div class="item"><div class="top"><b>Valmanifest ${p.manifest.year}</b>${p.manifest.checked ? '<span class="tag">granskat</span>' : ''}</div>${p.manifest.promises.map((x) => `<div style="font-size:13px">${x.kept === true ? '✅' : x.kept === false ? '❌' : '⬜'} ${esc(x.text)}</div>`).join('')}</div>` : '') + ((p.promises || []).slice(-6).reverse().map((x) => `<div class="item"><b>${esc(x.text)}</b><div class="meta">vecka ${x.week}</div></div>`).join('') || (p.manifest ? '' : '<div class="empty">Inga utspel ännu – använd "Politiskt utspel" eller lägg ett valmanifest.</div>')));
  const fac = card('Falanger', (p.factions || []).length ? p.factions.map((f) => { const fl = f.leaderId ? s.people[f.leaderId] : null; const top = ISSUES.slice().sort((a, b) => Math.abs(f.pos[b.id] || 0) - Math.abs(f.pos[a.id] || 0)).slice(0, 2); return `<div class="item"><div class="top"><b>${esc(f.name)}</b><span class="tag ${f.mood < -40 ? 'red' : f.mood > 20 ? 'green' : ''}">${f.mood < -40 ? 'uppror' : f.mood < -10 ? 'missnöjd' : f.mood > 20 ? 'nöjd' : 'avvaktande'}</span></div><small class="muted">${fl ? esc(fl.name) + ' · ' : ''}${fmt(f.strength, 0)} % av partiet · vill: ${top.map((is) => esc(is.short.toLowerCase()) + ' ' + ((f.pos[is.id] || 0) > 0 ? 'åt höger' : 'åt vänster')).join(', ')}</small>${barRow('Humör', f.mood + 100, 200, f.mood < -20 ? 'var(--red)' : 'var(--green)', fmt(f.mood, 0))}</div>`; }).join('') : '<div class="empty">Inga falanger ännu – de uppstår när partiet växer.</div>');
  const org = card(`<span>Organisation & stadgar</span><button class="btn sm" id="kongress">🏟️ Kongress</button>`, `<small class="muted">${esc(STRUCTURE_OPTIONS.ledarval.options.find((o) => o.id === p.structure?.ledarval)?.name || '')} · ${esc(STRUCTURE_OPTIONS.kandidatval.options.find((o) => o.id === p.structure?.kandidatval)?.name || '')} · ${esc(STRUCTURE_OPTIONS.stadgar.options.find((o) => o.id === p.structure?.stadgar)?.name || '')} stadgar · ${p.structure?.ungdom ? 'ungdomsförbund' : 'inget ungdomsförbund'}<br>Centralisering ${p.structure?.centralisering} · ledarmakt ${p.structure?.ledarmakt} · lokal autonomi ${p.structure?.lokalAutonomi} · bredd ${p.structure?.bredd}<br>Målgrupper: ${(p.structure?.malgrupper || []).map((id) => esc(SEGMENTS.find((x) => x.id === id)?.name)).join(', ') || 'inga valda'}</small><div style="margin-top:8px">${structureSummary(p.structure || {})}</div><div style="margin-top:8px;font-size:13px">Lokal bas: <b>${p.localBase?.kommuner || 0}</b> av ${TOTAL_KOMMUNER} kommuner · <b>${Object.values(p.localBase?.regionSeats || {}).reduce((a, b) => a + b, 0)}</b> regionmandat</div>`);
  org.querySelector('#kongress').addEventListener('click', () => ui.action(ACTIONS.find((a) => a.id === 'kongress')));
  const g2 = h('div', { class: 'grid c3', style: 'margin-top:14px' }); g2.append(fac, org, prom);
  const g3 = h('div', { class: 'grid c2', style: 'margin-top:14px' }); g3.append(people, rel);
  el.append(g, g2, g3);
  return el;
}

// ---------- SVERIGE ----------
export function pageSweden(s, ui, tab = 'ekonomi') {
  const el = h('div', {});
  el.innerHTML = `<div class="page-title"><h2>Sverige</h2><small class="muted">${STATS.length} nationella och ${REGIONS.length * REGIONAL_STATS.length} regionala mätserier · uppdateras varje månad</small></div>`;
  const tabs = h('div', { class: 'tabs' });
  const all = [...Object.keys(CATS), 'regioner', 'reformer'];
  for (const t of all) tabs.append(h('button', { class: t === tab ? 'on' : '', onclick: () => ui.render('sverige', t) }, t === 'regioner' ? 'Regioner' : t === 'reformer' ? 'Reformer' : CATS[t]));
  el.append(tabs);
  if (tab === 'regioner') { el.append(regionsView(s)); return el; }
  if (tab === 'reformer') { el.append(card('Genomförda reformer', (s.sweden.reforms || []).slice().reverse().map((r) => `<div class="item"><div class="top"><b>${esc(r.title)}</b><span class="tag">${esc(partyName(s, r.proposer))}</span></div><div class="meta">${fmtDate(r.date)}</div></div>`).join('') || '<div class="empty">Inga reformer har antagits ännu.</div>')); return el; }
  const list = STATS.filter((x) => x.cat === tab);
  const table = h('table', { class: 'stat-table' });
  table.innerHTML = `<tr><th>Mått</th><th class="num">Värde</th><th class="num">1 mån</th><th class="num">12 mån</th><th>Trend</th></tr>` + list.map((d) => {
    const v = s.sweden.stats[d.id]; const hist = s.sweden.hist[d.id] || [];
    const d1 = hist.length > 1 ? v - hist[hist.length - 2] : 0; const d12 = hist.length > 12 ? v - hist[hist.length - 13] : hist.length > 1 ? v - hist[0] : 0;
    const good = d.good === 'target2' ? (Math.abs(v - 2) < Math.abs(v - d1 - 2) ? 'up' : 'down') : d.good;
    const cl = (x) => (good && good !== 'none' ? dcls(x, good === 'target2' ? 'up' : good) : '');
    return `<tr><td class="name">${esc(d.name)}</td><td class="num"><b>${fmt(v, d.d)}</b> <small class="muted">${esc(d.unit)}</small></td><td class="num ${cl(d1)}">${signed(d1, d.d)}</td><td class="num ${cl(d12)}">${signed(d12, d.d)}</td><td>${sparkline(hist.slice(-24), '#8ab4ff')}</td></tr>`;
  }).join('');
  const c = h('div', { class: 'card' }); c.append(table); el.append(c);
  return el;
}
function regionsView(s) {
  const p = me(s);
  const wrap = h('div', { class: 'reg' });
  for (const r of REGIONS) {
    const R = s.sweden.regions[r.id];
    const sup = regionalSupport(s, r.id);
    const top = activeParties(s).map((q) => ({ q, v: sup[q.id] })).sort((a, b) => b.v - a.v).slice(0, 3);
    const d = h('div', { class: 'r' });
    d.innerHTML = `<b>${esc(r.name)}</b><small class="muted">${fmt(R.befolkning, 0)} tusen inv.</small><div style="margin:4px 0">${top.map((x) => `${dot(x.q.color)}${esc(x.q.abbr)} ${fmt(x.v, 1)}`).join(' · ')}</div><small>${dot(p.color)}<b>${esc(p.abbr)} ${fmt(sup[p.id] || 0, 1)} %</b></small><hr style="border:0;border-top:1px solid var(--line);margin:6px 0">
      <small>Arbetslöshet ${fmt(R.arbetsloshet, 1)} % · Medianlön ${fmt(R.medianlon)} kr<br>Brott ${fmt(R.brott)}/1 000 · Vårdkö ${fmt(R.vardkoer)} d<br>Skola ${fmt(R.skolresultat)} · Trygghet ${fmt(R.trygghet)} · Tillväxt ${fmt(R.tillvaxt, 1)} %<br>Bostadspriser ${fmt(R.bostadspriser)} · Förtroende ${fmt(R.fortroende)} %</small>`;
    wrap.append(d);
  }
  return wrap;
}

// ---------- RIKSDAGEN ----------
export function pageRiksdag(s, ui) {
  const p = me(s);
  const el = h('div', {});
  const gov = s.government;
  el.innerHTML = `<div class="page-title"><h2>Riksdagen</h2><small class="muted">${s.riksdag.session ? 'Riksmötet pågår' : 'Sommaruppehåll – inga omröstningar'} · ${gov.pm ? `Regering: ${esc(gov.parties.map((id) => partyName(s, id)).join('+'))}${gov.support.length ? ' med stöd av ' + esc(gov.support.map((id) => partyName(s, id)).join(', ')) : ''} (${gov.type === 'majority' ? 'majoritet' : gov.type === 'minority-support' ? 'minoritet med stödavtal' : 'minoritet'})` : 'Ingen regering'}</small></div>`;
  const g = h('div', { class: 'grid c2' });
  const sortP = activeParties(s).filter((q) => (s.riksdag.seats[q.id] || 0) > 0).sort((a, b) => s.riksdag.seats[b.id] - s.riksdag.seats[a.id]);
  const hc = card('Mandatfördelning', hemicycle(s.riksdag.seats, s.parties, { highlight: p.inRiksdag ? p.id : null }) + `<table>${sortP.map((q) => `<tr class="${q.isPlayer ? 'me' : ''}"><td>${dot(q.color)}${esc(q.name)}</td><td class="num">${s.riksdag.seats[q.id]}</td><td><small class="muted">${gov.parties.includes(q.id) ? 'regering' : gov.support.includes(q.id) ? 'stödparti' : 'opposition'} · ${esc(s.people[q.leader].name)}</small></td></tr>`).join('')}</table>`);
  g.append(hc);
  const pending = s.riksdag.bills.filter((b) => b.status === 'pending' || b.status === 'voting');
  const pc = card(`<span>Liggande förslag</span>${p.inRiksdag ? '<button class="btn sm" id="newBill">+ Lägg motion</button>' : ''}`, pending.length ? pending.map((item) => { const b = itemBill(s, item); const prop = s.parties[item.proposer]; const exp = expectedVote(s, item); return `<div class="item"><div class="top"><b>${esc(b.title)}</b><span class="tag ${item.byPlayer ? 'gold' : ''}">${esc(prop.abbr)}</span></div><small>${esc(b.desc)}</small><div class="meta">Omröstning vecka ${item.voteWeek} · väntat: <span class="up">${exp.ja} ja</span> / <span class="down">${exp.nej} nej</span> / ${exp.avst} avstår · kostnad ${b.cost > 0 ? b.cost + ' mdkr/år' : b.cost < 0 ? 'sparar ' + -b.cost + ' mdkr/år' : 'ingen'} ${Object.keys(item.deals || {}).length ? '· uppgörelser: ' + Object.keys(item.deals).map((id) => partyName(s, id)).join(', ') : ''}</div>${item.byPlayer ? `<button class="btn sm" data-neg="${item.id}" style="margin-top:6px">🤝 Förhandla om stöd</button>` : ''}</div>`; }).join('') : '<div class="empty">Inga förslag ligger på bordet.</div>');
  pc.querySelector('#newBill')?.addEventListener('click', () => ui.action(ACTIONS.find((a) => a.id === 'motion')));
  pc.querySelectorAll('[data-neg]').forEach((b) => b.addEventListener('click', () => ui.action(ACTIONS.find((a) => a.id === 'forhandla'), { itemId: b.dataset.neg })));
  g.append(pc);
  el.append(g);
  const hist = s.riksdag.bills.filter((b) => b.status === 'passed' || b.status === 'failed').slice(0, 20);
  el.append(h('div', { style: 'margin-top:14px' }, card('Senaste omröstningarna', `<table><tr><th>Förslag</th><th>Förslagsställare</th><th class="num">Ja</th><th class="num">Nej</th><th class="num">Avstod</th><th>Utfall</th><th>${esc(p.abbr)}</th></tr>${hist.map((item) => `<tr><td>${esc(itemBill(s, item).title)}</td><td>${esc(partyName(s, item.proposer))}</td><td class="num">${item.ja}</td><td class="num">${item.nej}</td><td class="num">${item.avst}</td><td>${item.status === 'passed' ? '<span class="tag green">antogs</span>' : '<span class="tag red">föll</span>'}</td><td>${esc(item.votes?.[p.id] || '–')}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Inga omröstningar ännu</td></tr>'}</table>`)));
  return el;
}
export function expectedVote(s, item) {
  const b = itemBill(s, item); let ja = 0, nej = 0, avst = 0;
  for (const q of activeParties(s)) { const n = s.riksdag.seats[q.id] || 0; if (!n) continue; const v = q.isPlayer ? 'avstår' : aiVote(s, q, { ...b, deals: item.deals }, item.proposer); if (v === 'ja') ja += n; else if (v === 'nej') nej += n; else avst += n; }
  return { ja, nej, avst };
}

// ---------- OPINION ----------
export function pageOpinion(s, ui) {
  const p = me(s);
  const el = h('div', {});
  el.innerHTML = `<div class="page-title"><h2>Opinionen</h2><small class="muted">Mätningar varje vecka från ${POLL_INSTITUTES.join(', ')} – med husfel och brus. Valresultatet kan bli något annat.</small></div>`;
  const parties = activeParties(s);
  const trend = s.opinion.trend.slice(-104);
  const labels = trend.map((t, i) => (i % 13 === 0 ? `v${t.week}` : ''));
  const chart = lineChart(parties.map((q) => ({ color: q.color, values: trend.map((t) => t.s[q.id] ?? null), width: q.isPlayer ? 4 : 2 })), { h: 300, min: 0, yfmt: (v) => v.toFixed(0) + '%', labels, hline: 4 });
  const g = h('div', { class: 'grid c2' });
  g.append(card('Utveckling (2 år)', (trend.length > 2 ? chart : '<div class="empty">Trendkurvan växer fram efter några veckor.</div>') + `<div class="legend">${parties.map((q) => `<span style="--c:${q.color}">${esc(q.abbr)} ${fmt(s.opinion.support[q.id] || 0, 1)}</span>`).join('')}</div>`));
  const polls = s.opinion.polls.slice(0, 8);
  g.append(card('Senaste mätningarna', `<table><tr><th>Institut</th><th>Datum</th>${parties.map((q) => `<th class="num">${esc(q.abbr)}</th>`).join('')}</tr>${polls.map((po) => `<tr><td>${esc(po.inst)}</td><td><small>${fmtDate(po.date)}</small></td>${parties.map((q) => `<td class="num ${q.isPlayer ? 'me' : ''}">${fmt(po.res[q.id] ?? 0, 1)}</td>`).join('')}</tr>`).join('')}</table>`));
  el.append(g);
  const g2 = h('div', { class: 'grid c3', style: 'margin-top:14px' });
  const segs = SEGMENTS.map((sg) => ({ sg, v: s.opinion.seg[sg.id]?.[p.id] || 0 })).sort((a, b) => b.v - a.v);
  g2.append(card(`Vilka röstar på ${esc(p.abbr)}?`, segs.map((x) => barRow(x.sg.name, x.v, Math.max(10, segs[0].v), p.color, fmt(x.v, 1) + ' %')).join('')));
  const sal = Object.entries(s.opinion.salience).sort((a, b) => b[1] - a[1]);
  g2.append(card('Vad väljarna bryr sig om', sal.map(([id, v]) => barRow(ISSUE_BY_ID[id].name, v, 2.2, v > 1.3 ? 'var(--red)' : v > 1.05 ? 'var(--orange)' : 'var(--line)', (v * 100).toFixed(0))).join('')));
  const regs = REGIONS.map((r) => ({ r, v: regionalSupport(s, r.id)[p.id] || 0 })).sort((a, b) => b.v - a.v);
  g2.append(card('Starkast i', regs.slice(0, 8).map((x) => barRow(x.r.name, x.v, Math.max(10, regs[0].v), p.color, fmt(x.v, 1) + ' %')).join('') + `<small class="muted">Svagast: ${regs.slice(-3).map((x) => `${esc(x.r.name)} ${fmt(x.v, 1)}`).join(', ')}</small>`));
  el.append(g2);
  return el;
}

// ---------- NYHETER ----------
export function pageNews(s, ui, filter = 'alla') {
  const el = h('div', {});
  el.innerHTML = `<div class="page-title"><h2>Nyheter</h2></div>`;
  const tabs = h('div', { class: 'tabs' });
  for (const [id, name] of [['alla', 'Alla'], ['mig', me(s).abbr], ['skandal', 'Skandaler'], ['opinion', 'Opinion'], ['riksdag', 'Riksdagen'], ['varlden', 'Världen'], ['some', 'Sociala medier']]) tabs.append(h('button', { class: id === filter ? 'on' : '', onclick: () => ui.render('nyheter', id) }, name));
  el.append(tabs);
  const items = s.news.filter((n) => filter === 'alla' || (filter === 'mig' ? n.partyId === me(s).id : n.tags.includes(filter))).slice(0, 60);
  el.append(newsFeed(s, items, ui));
  return el;
}

// ---------- SOCIALA MEDIER ----------
export function pageSocial(s, ui) {
  const p = me(s), l = leader(s);
  const el = h('div', {});
  el.innerHTML = `<div class="page-title"><div><h2>Sociala medier</h2><small class="muted">${esc(l.name)} · ${fmt(followersOf(s, l.id))} följare totalt</small></div></div>`;
  const g = h('div', { class: 'grid c2' });
  const f = s.social.followers[l.id] || {};
  const comp = card('Nytt inlägg <small class="muted">1 AP</small>', composeForm(s, ui));
  g.append(comp);
  g.append(card('Konton', `<div class="kpis">${PLATFORMS.map((pl) => kpi(pl.icon + ' ' + pl.name, fmt(f[pl.id] || 0), 'följare')).join('')}</div><p class="help" style="margin-top:10px">Räckvidden beror på följare, plattform, ton, format, hur het frågan är – och lite tur. Provocerande och humoristiska inlägg kan gå viralt men sparas med en "sprängkraft" som kan dyka upp igen år senare.</p>
    <h3 style="margin-top:10px">Andra partiledare</h3>${activeParties(s).filter((q) => !q.isPlayer).map((q) => `<div class="row between" style="font-size:13px;padding:3px 0">${dot(q.color)}${esc(s.people[q.leader].name)} (${esc(q.abbr)})<span>${fmt(followersOf(s, q.leader))}</span></div>`).join('')}`));
  el.append(g);
  const gi = h('div', { class: 'grid c2', style: 'margin-top:14px' });
  gi.append(card('Politiska influerare & poddar', Object.values(s.influencers || {}).sort((a, b) => b.followers - a.followers).map((inf) => `<div class="row between" style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--line)"><span><b>${esc(inf.name)}</b> <span class="muted">${esc(PLATFORM_NAMES[inf.platform] || inf.platform)} · ${fmt(inf.followers)} följare</span><br><small class="muted">når ${inf.segs.map((id) => esc(SEGMENTS.find((x) => x.id === id)?.name)).join(', ')}</small></span><span class="tag ${inf.stance > 10 ? 'green' : inf.stance < -10 ? 'red' : ''}">${esc(influencerLabel(inf))}</span></div>`).join('')));
  gi.append(card('Journalister', Object.values(s.journalists || {}).map((j) => `<div class="row between" style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--line)"><span><b>${esc(j.name)}</b> <span class="muted">${esc(MEDIA[j.outlet]?.name || j.outlet)} · bevakar ${esc(ISSUE_BY_ID[j.beat]?.short || 'politik')} · ${esc(j.style)}</span>${j.memory?.[0] ? `<br><small class="muted">minns: ${esc(j.memory[0].memo)}</small>` : ''}</span><span class="tag ${j.rel > 20 ? 'green' : j.rel < -20 ? 'red' : ''}">${j.rel > 20 ? 'välvillig' : j.rel < -20 ? 'fientlig' : 'neutral'} (${fmt(j.rel, 0)})</span></div>`).join('')));
  el.append(gi);
  const posts = s.social.posts.slice(0, 20);
  const feed = h('div', { class: 'grid c2', style: 'margin-top:14px' });
  for (const po of posts) {
    const pl = PLATFORMS.find((x) => x.id === po.platform);
    const d = h('div', { class: 'post' });
    d.innerHTML = `<div class="head"><div class="av">${characterSVG(l, { crop: 'face', id: 'av' + po.id })}</div><b>${esc(l.name)}</b><span class="muted">${pl.icon} ${esc(pl.name)} · ${fmtDate(po.date)}</span>${po.resurfaced ? '<span class="tag red">grävdes fram</span>' : ''}${po.landedWrong ? '<span class="tag red">landade fel</span>' : ''}</div><div class="body">${esc(po.text)}</div><div class="stats"><span>👁 ${fmt(po.reach)}</span><span>❤️ ${fmt(po.likes)}</span><span>➕ ${fmt(po.newFollowers)} följare</span><span>⚠️ risk ${po.risk}</span></div>`;
    feed.append(d);
  }
  if (!posts.length) feed.append(h('div', { class: 'empty' }, 'Inga inlägg ännu.'));
  el.append(feed);
  return el;
}
function composeForm(s, ui) {
  const p = me(s);
  const f = h('div', {});
  f.innerHTML = `<div class="field"><label>Plattform</label><div class="chips" id="pl">${PLATFORMS.map((x, i) => `<span class="chip ${i === 0 ? 'on' : ''}" data-v="${x.id}">${x.icon} ${x.name}</span>`).join('')}</div></div>
    <div class="field"><label>Typ</label><div class="chips" id="kind"><span class="chip on" data-v="issue">Politisk fråga</span><span class="chip" data-v="news">Reagera på nyhet</span><span class="chip" data-v="attack">Angrip parti</span></div></div>
    <div class="field" id="issueF"><label>Fråga</label><select id="issue">${ISSUES.map((i) => `<option value="${i.id}">${i.name}</option>`).join('')}</select></div>
    <div class="field" id="newsF" style="display:none"><label>Nyhet</label><select id="news">${s.news.slice(0, 12).map((n) => `<option value="${n.id}">${esc(n.headline.slice(0, 70))}</option>`).join('')}</select></div>
    <div class="field" id="targetF" style="display:none"><label>Parti</label><select id="target">${activeParties(s).filter((q) => !q.isPlayer).map((q) => `<option value="${q.id}">${esc(q.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Ton</label><div class="chips" id="tone"></div><div class="hint" id="toneHint"></div></div>
    <div class="field"><label>Format</label><div class="chips" id="fmt"></div></div>
    <button class="btn gold block" id="send" ${s.ap < 1 ? 'disabled' : ''}>Publicera (1 AP)</button>`;
  import('../sim/social.js').then(({ TONES, FORMATS }) => {
    f.querySelector('#tone').innerHTML = TONES.map((t, i) => `<span class="chip ${i === 0 ? 'on' : ''}" data-v="${t.id}" title="${esc(t.desc)}">${t.name}</span>`).join('');
    f.querySelector('#fmt').innerHTML = FORMATS.map((t, i) => `<span class="chip ${i === 0 ? 'on' : ''}" data-v="${t.id}">${t.name}</span>`).join('');
    f.querySelector('#toneHint').textContent = TONES[0].desc;
    f.querySelectorAll('.chips').forEach((ch) => ch.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; ch.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); if (ch.id === 'tone') f.querySelector('#toneHint').textContent = TONES.find((t) => t.id === c.dataset.v).desc; if (ch.id === 'kind') { f.querySelector('#issueF').style.display = c.dataset.v === 'attack' ? 'none' : ''; f.querySelector('#newsF').style.display = c.dataset.v === 'news' ? '' : 'none'; f.querySelector('#targetF').style.display = c.dataset.v === 'attack' ? '' : 'none'; } }));
  });
  const sel = (id) => f.querySelector('#' + id + ' .chip.on')?.dataset.v;
  f.querySelector('#send').addEventListener('click', () => { const kind = sel('kind'); ui.post({ platform: sel('pl'), kind, issue: kind === 'attack' ? ISSUES[0].id : f.querySelector('#issue').value, tone: sel('tone'), format: sel('fmt'), target: kind === 'attack' ? f.querySelector('#target').value : null, newsItem: kind === 'news' ? s.news.find((n) => n.id === f.querySelector('#news').value) : null }); });
  return f;
}

// ---------- REGERINGEN ----------
export function pageGovernment(s, ui) {
  const p = me(s); const gov = s.government;
  const el = h('div', {});
  const pm = gov.pm ? s.people[gov.pm] : null;
  el.innerHTML = `<div class="page-title"><div><h2>Regeringen</h2><small class="muted">${pm ? `Statsminister ${esc(pm.name)} (${esc(partyName(s, gov.pmParty))}) · tillträdde ${fmtDate(gov.formed)} · ${gov.type === 'majority' ? 'majoritetsregering' : gov.type === 'minority-support' ? 'minoritetsregering med stödpartier' : 'minoritetsregering'}` : 'Sverige saknar regering – expeditionsministär'}</small></div>${isPlayerPM(s) ? '<div class="row"><button class="btn" id="budget">📊 Budgeten</button><button class="btn red ghost sm" id="resign">Avgå</button></div>' : ''}</div>`;
  const g = h('div', { class: 'grid c2' });
  if (gov.pm) {
    g.append(card('Stöd & läge', `<div class="kpis">${kpi('Förtroende', pct(gov.approval, 0))}${kpi('Politiskt kapital', fmt(gov.capital ?? 0, 0) + '/100', 'reformer kostar kapital')}${kpi('Riksdagsstöd', gov.parties.reduce((a, id) => a + (s.riksdag.seats[id] || 0), 0) + ' + ' + gov.support.reduce((a, id) => a + (s.riksdag.seats[id] || 0), 0), 'regering + stödpartier')}${kpi('Kris', fmt(gov.crisis || 0, 1), gov.crisis > 4 ? '<span class="down">regeringen vacklar</span>' : 'stabilt')}${kpi('Budgetar', gov.budgets || 0)}</div>
      <div style="margin-top:10px"><b>Regeringspartier:</b> ${gov.parties.map((id) => `${dot(s.parties[id].color)}${esc(s.parties[id].name)}`).join(', ')}<br><b>Stödpartier:</b> ${gov.support.map((id) => `${dot(s.parties[id].color)}${esc(s.parties[id].name)}`).join(', ') || '–'}</div>
      ${seatBar(Object.fromEntries([...gov.parties, ...gov.support].map((id) => [id, s.riksdag.seats[id] || 0])), s.parties)}
      ${!playerInGov(s) && p.inRiksdag && gov.approval < 38 ? '<button class="btn red" id="misstro" style="margin-top:10px">⚡ Väck misstroendeförklaring (1 AP)</button>' : ''}`));
    const mins = card(`<span>Ministrarna</span>${isPlayerPM(s) ? '<button class="btn sm" id="reshuffle">Ombilda</button>' : ''}`, `<div class="minister"><div class="av">${characterSVG(pm, { crop: 'face', id: 'pm' })}</div><div><b>${esc(pm.name)}</b> <span class="tag gold">Statsminister</span><br><small class="muted">${esc(partyName(s, gov.pmParty))}</small></div></div>` + MINISTRIES.map((m) => { const per = s.people[gov.ministers[m.id]]; return `<div class="minister"><div class="av">${per ? characterSVG(per, { crop: 'face', id: 'mi' + m.id }) : ''}</div><div><b>${per ? esc(per.name) : '<i class="muted">vakant</i>'}</b> <span class="tag">${esc(m.name)}</span><br><small class="muted">${per ? esc(partyName(s, per.partyId)) + ' · kompetens ' + Math.round((per.traits.intelligens + per.traits.ledarskap + per.traits.erfarenhet) / 3) + ' · integritet ' + per.traits.integritet : ''}</small></div></div>`; }).join(''));
    g.append(mins);
    mins.querySelector('#reshuffle')?.addEventListener('click', () => ui.reshuffle());
    g.querySelector('#misstro')?.addEventListener('click', () => ui.noConfidence());
  } else {
    g.append(card('Ingen regering', `<p>Talmannen sonderar. Utan regering kan ingen budget läggas och Sverige styrs av en expeditionsministär${gov.caretakerOf ? ' ledd av ' + esc(partyName(s, gov.caretakerOf)) : ''}.</p>`));
  }
  el.append(g);
  const act = (s.reforms || []).filter((r) => r.progress < 1);
  el.append(h('div', { style: 'margin-top:14px' }, card(`<span>Reformer under genomförande</span><small class="muted">belastning ${fmt(s.sweden.adminLoad || 0, 1)} / kapacitet ${fmt(s.sweden.adminCap || 5, 1)}</small>`, (act.length ? act.map((r) => { const pol = POLICY_BY_ID[r.policyId]; return `<div class="item"><div class="top"><b>${esc(pol.name)}: ${esc(policyLabel(pol, r.to))}</b><span class="tag">${fmt(r.progress * 100, 0)} %</span></div>${barRow('Genomfört', r.progress * 100, 100, 'var(--green)', fmt(r.progress * 100, 0) + ' %')}<small class="muted">från ${esc(policyLabel(pol, r.from))} · ${r.months} månader${r.side ? ' · ' + esc(r.side.text) : ''}</small></div>`; }).join('') : '<div class="empty">Inga reformer genomförs just nu.</div>') + ((s.riksdag.vilande || []).length ? '<h4 style="margin:10px 0 4px">Vilande grundlagsändringar</h4>' + s.riksdag.vilande.map((v) => { const pol = POLICY_BY_ID[v.policyId]; return `<div class="item"><b>${esc(pol.name)}: ${esc(policyLabel(pol, v.to))}</b><div class="meta">andra beslutet efter valet ${v.year}</div></div>`; }).join('') : ''))));
  el.querySelector('#budget')?.addEventListener('click', () => ui.budget());
  el.querySelector('#resign')?.addEventListener('click', () => ui.resign());
  const hist = gov.history || s.government.history || [];
  if (hist.length) el.append(h('div', { style: 'margin-top:14px' }, card('Tidigare regeringar', hist.slice().reverse().map((g2) => `<div class="item"><b>${esc(g2.parties.map((id) => partyName(s, id)).join('+'))}</b> <small class="muted">${fmtDate(g2.formed)} – ${fmtDate(g2.ended)} · ${esc(g2.reason)}</small></div>`).join(''))));
  return el;
}

// ---------- VALET ----------
export function pageElection(s, ui) {
  const p = me(s);
  const el = h('div', {});
  const days = dayDiff(s.date, s.election.next);
  el.innerHTML = `<div class="page-title"><div><h2>Valet</h2><small class="muted">Nästa riksdagsval: ${fmtDate(s.election.next, true)} · ${Math.max(0, Math.round(days / 7))} veckor kvar</small></div></div>`;
  const g = h('div', { class: 'grid c2' });
  g.append(card(s.election.campaign ? '🗳️ Valrörelsen pågår' : 'Inför valet', s.election.campaign ? `<p>Du har 5 handlingspoäng per vecka och tillgång till reklam och dörrknackning. TV-debatterna sänds sex, fyra och en vecka före valet. Opinionen rör sig snabbare – och skandaler slår hårdare.</p>${actionsGridSmall(s, ui)}` : `<p>Valrörelsen börjar åtta veckor före valdagen. Fram till dess bygger du kännedom, organisation och trovärdighet. Partier under 4 % i opinionen riskerar "bortkastad röst"-effekten på valdagen.</p><div class="kpis">${kpi('Organisation', p.org + '/100')}${kpi('Kännedom', pct((s.opinion.awareness[p.id] ?? 1) * 100, 0))}${kpi('Kassa', kr(p.money))}${kpi('Medlemmar', fmt(p.members))}</div>`));
  const hist = s.election.history || [];
  g.append(card('Valresultat', hist.length ? hist.slice().reverse().map((e) => `<h4 style="margin:8px 0 4px">${e.year} <small class="muted">valdeltagande ${fmt(e.turnout, 1)} %</small></h4>${activeParties(s).map((q) => ({ q, v: e.result[q.id] || 0 })).sort((a, b) => b.v - a.v).map((x) => barRow(x.q.abbr, x.v, 45, x.q.color, `${fmt(x.v, 1)} % · ${e.seats[x.q.id] || 0}${e.local?.kommuner ? ' · ' + (e.local.kommuner[x.q.id] || 0) + ' kommuner' : ''}`)).join('')}`).join('') : '<div class="empty">Inget val har hållits ännu i den här spelomgången. Startmandaten speglar 2026 års val.</div>'));
  g.append(card('Kommun & region', `<p class="help">Kommun- och regionvalen hålls samma dag som riksdagsvalet. En lokal bas ger partistöd, organisation och kännedom – vägen in i riksdagen går ofta via kommunerna.</p><div class="kpis">${kpi('Kommuner med mandat', (p.localBase?.kommuner || 0) + ' / ' + TOTAL_KOMMUNER)}${kpi('Regionmandat', Object.values(p.localBase?.regionSeats || {}).reduce((a, b) => a + b, 0))}${kpi('Regioner med mandat', Object.keys(p.localBase?.regionSeats || {}).length + ' / 21')}</div>${Object.keys(p.localBase?.regionSeats || {}).length ? '<div class="chips" style="margin-top:8px">' + Object.entries(p.localBase.regionSeats).map(([rid, n]) => `<span class="chip static">${esc(REGIONS.find((r) => r.id === rid)?.name || rid)} ${n}</span>`).join('') + '</div>' : ''}`));
  el.append(g);
  return el;
}
function actionsGridSmall(s, ui) { const g = actionsGrid(s, ui); return g.outerHTML ? (() => { const d = h('div', {}); d.append(g); return d.innerHTML; })() : ''; }

// ---------- VÄRLDEN ----------
export function pageWorld(s, ui) {
  const el = h('div', {});
  const w = s.world;
  el.innerHTML = `<div class="page-title"><div><h2>Världen</h2><small class="muted">Säkerhetsläge ${fmt(s.sweden.stats.sakerhetslage, 0)}/100 · spänning ${fmt(w.tension || 0, 0)} · global energiprisnivå ${fmt((w.energy || 1) * 100, 0)} · konjunkturchock ${signed(w.shock || 0, 1)}</small></div></div>`;
  const g = h('div', { class: 'grid c2' });
  g.append(card('Relationer', COUNTRIES.map((c) => { const v = w.countries[c.id]?.rel || 0; return `<div class="relbar"><span style="width:26px">${c.flag}</span><span style="width:130px">${esc(c.name)}</span><div class="bar"><i style="left:${50 + v / 2}%"></i></div><small style="width:110px;text-align:right">${relationLabel(v)} (${fmt(v, 0)})</small></div>`; }).join('')));
  g.append(card('Omvärldshändelser', (w.log || []).slice(0, 15).map((x) => `<div class="item"><b>${esc(x.h)}</b><div class="meta">vecka ${x.week}</div></div>`).join('') || '<div class="empty">Lugnt i världen – än så länge.</div>'));
  el.append(g);
  return el;
}

// ---------- HISTORIK ----------
export function pageHistory(s, ui) {
  const el = h('div', {});
  el.innerHTML = `<div class="page-title"><h2>Historik</h2></div>`;
  const g = h('div', { class: 'grid c2' });
  g.append(card('Veckologg', `<div class="timeline">${s.log.slice(0, 30).map((w) => `<div class="ev"><small>v${w.week} · ${fmtDate(w.date)}</small><div>${w.items.map((i) => esc(i)).join('<br>') || '<span class="muted">–</span>'}</div></div>`).join('')}</div>`));
  g.append(card('Skandaler', (s.scandals || []).slice(0, 15).map((sc) => `<div class="item"><div class="top"><b>${esc(sc.title)}</b><span class="tag ${sc.active ? 'red' : ''}">${esc(partyName(s, sc.partyId))} · ${sc.active ? 'pågår' : 'över'}</span></div><small>${esc(sc.text)}</small><div class="meta">${fmtDate(sc.date)} · styrka ${fmt(sc.severity, 0)} (topp ${fmt(sc.peak, 0)})${sc.response ? ' · svar: ' + esc(sc.response) : ''}</div></div>`).join('') || '<div class="empty">Inga skandaler – ännu.</div>'));
  el.append(g);
  const tl = (s.history?.timeline || []).slice().reverse();
  const g2 = h('div', { class: 'grid c2', style: 'margin-top:14px' });
  g2.append(card('Politisk tidslinje', tl.length ? `<div class="timeline">${tl.slice(0, 40).map((t) => `<div class="ev"><small>${fmtDate(t.date)}</small><div><span class="tag ${t.kind === 'val' ? 'gold' : t.kind === 'regering' ? 'blue' : t.kind === 'parti' ? 'red' : ''}">${esc(t.kind)}</span> ${esc(t.text)}</div></div>`).join('')}</div>` : '<div class="empty">Historien skrivs medan du spelar.</div>'));
  g2.append(card('Partiledare genom tiderna', `<table><tr><th>Namn</th><th>Parti</th><th>Period</th><th>Avgick</th></tr>${(s.history?.leaders || []).slice().reverse().slice(0, 30).map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(partyName(s, l.partyId))}</td><td>${l.from ? l.from.y : '?'}–${l.to ? l.to.y : ''}</td><td><small class="muted">${esc(l.reason || (l.to ? '' : 'sitter'))}</small></td></tr>`).join('')}</table>`));
  el.append(g2);
  if ((s.history?.bios || []).length) el.append(h('div', { style: 'margin-top:14px' }, card('Politiska biografier', s.history.bios.slice(0, 10).map((b) => `<div class="item"><div class="top"><b>${esc(b.name)}</b><span class="tag">${esc(partyName(s, b.partyId))}</span></div><small>${esc(b.text)}</small></div>`).join(''))));
  el.append(h('div', { style: 'margin-top:14px' }, card('Händelser', `<div class="timeline">${s.events.log.slice(0, 30).map((e) => `<div class="ev"><small>v${e.week}</small><div>${esc(e.title)}</div></div>`).join('') || '<div class="empty">Inga</div>'}</div>`)));
  return el;
}

export const PAGES = { oversikt: pageOverview, partiet: pageParty, sverige: pageSweden, riksdagen: pageRiksdag, opinion: pageOpinion, nyheter: pageNews, some: pageSocial, regeringen: pageGovernment, valet: pageElection, varlden: pageWorld, historik: pageHistory };
