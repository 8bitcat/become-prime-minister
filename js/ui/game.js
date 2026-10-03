// Spelskärmen: topplist, meny, sidor, handlingar och kön av beslut.
import { G, save, exportSave } from '../core/state.js';
import { h, esc, fmt, pct, kr, signed, fmtDate, weekNo, clamp } from '../core/util.js';
import { ISSUES, ISSUE_BY_ID, issueLabel } from '../data/issues.js';
import { REGIONS } from '../data/regions.js';
import { logoSVG } from '../art/logo.js';
import { characterSVG } from '../art/character.js';
import { modal, choice, info, toast } from './modal.js';
import { PAGES, pollBars, newsFeed, expectedVote } from './pages.js';
import { endWeek, doAction, ACTIONS } from '../sim/turn.js';
import { activeParties } from '../sim/opinion.js';
import { BILLS, BILL_BY_ID, stance, resolveVote, negotiationDemand, applyDeal } from '../sim/riksdag.js';
import { applyEventChoice } from '../sim/events.js';
import { RESPONSES, respondScandal } from '../sim/scandals.js';
import { composePost, PLATFORMS } from '../sim/social.js';
import { applyElection } from '../sim/election.js';
import { isPlayerPM, playerInGov, dissolveGovernment, MINISTRIES, formGovernmentAI, willingness } from '../sim/government.js';
import { addNews } from '../sim/news.js';
import { runDebate } from '../scene/debate.js';
import { runElectionNight } from './election.js';
import { runFormation, runOffer } from './formation.js';
import { runBudget } from './budget.js';
import { VERSION } from '../version.js';

const me = () => G.state.parties[G.state.player.partyId];
const leader = () => G.state.people[me().leader];
const NAV = [['oversikt', '🏠', 'Översikt'], ['partiet', '🎗️', 'Partiet'], ['sverige', '🇸🇪', 'Sverige'], ['riksdagen', '🏛️', 'Riksdagen'], ['opinion', '📊', 'Opinion'], ['nyheter', '📰', 'Nyheter'], ['some', '📱', 'Sociala medier'], ['regeringen', '👔', 'Regeringen'], ['valet', '🗳️', 'Valet'], ['varlden', '🌍', 'Världen'], ['historik', '📜', 'Historik']];

export const UI = {
  page: 'oversikt', sub: undefined, busy: false, onExit: null,
  go(page, sub) { this.page = page; this.sub = sub; this.render(); },
  render(page, sub) { if (page) { this.page = page; this.sub = sub; } renderShell(); },
  action(a, extra) { actionDialog(a, extra); },
  post(params) { postFlow(params); },
  budget() { budgetFlow(); },
  resign() { resignFlow(); },
  reshuffle() { reshuffleFlow(); },
  noConfidence() { noConfidenceFlow(); },
};

function renderShell() {
  const s = G.state; const app = document.getElementById('app');
  app.innerHTML = '';
  const p = me(), l = leader();
  const game = h('div', { class: 'game' });
  const top = h('div', { class: 'topbar' });
  const sup = s.opinion.support[p.id] || 0;
  const tr = s.opinion.trend.length > 4 ? sup - (s.opinion.trend[s.opinion.trend.length - 5].s[p.id] || 0) : 0;
  top.innerHTML = `<div class="brand">Become PM</div>
    <div class="date">Vecka ${s.week} · v${weekNo(s.date)}<small>${fmtDate(s.date, true)}</small></div>
    <div class="pchip"><div class="logo">${logoSVG(p, 28)}</div><div class="stat"><b>${esc(p.abbr)} ${fmt(sup, 1)} %</b><small class="${tr > 0 ? 'up' : tr < 0 ? 'down' : ''}">${signed(tr, 1)} · ${s.riksdag.seats[p.id] || 0} mandat</small></div></div>
    <div class="stat"><small>Kassa</small><b>${kr(p.money)}</b></div>
    <div class="stat"><small>Ledare</small><b>${pct(l.approval, 0)}</b></div>
    <div class="stat"><small>Handlingspoäng</small><b class="ap">${Array.from({ length: s.apMax }, (_, i) => `<i class="${i < s.ap ? '' : 'off'}"></i>`).join('')}</b></div>
    <div class="spacer"></div>
    ${isPlayerPM(s) ? '<span class="tag gold">STATSMINISTER</span>' : ''}${s.election.campaign ? '<span class="tag red">VALRÖRELSE</span>' : ''}
    <button class="btn" id="menu">☰</button>
    <button class="btn gold" id="next" ${UI.busy ? 'disabled' : ''}>Nästa vecka ▶</button>`;
  top.querySelector('#next').addEventListener('click', nextWeek);
  top.querySelector('#menu').addEventListener('click', menuDialog);
  const nav = h('div', { class: 'sidenav' });
  for (const [id, ic, name] of NAV) {
    const b = h('button', { class: UI.page === id ? 'on' : '', onclick: () => UI.go(id) }, h('span', { class: 'ic' }, ic), name);
    if (id === 'riksdagen') { const n = s.riksdag.bills.filter((x) => x.status === 'pending' && x.byPlayer).length; if (n) b.append(h('span', { class: 'badge' }, String(n))); }
    if (id === 'nyheter') { const n = s.news.filter((x) => x.week === s.week).length; if (n) b.append(h('span', { class: 'badge', style: 'background:var(--blue)' }, String(n))); }
    nav.append(b);
  }
  nav.append(h('div', { class: 'sep' }), h('button', { onclick: helpDialog }, h('span', { class: 'ic' }, '❓'), 'Hjälp'), h('div', { style: 'flex:1' }), h('small', { class: 'muted', style: 'padding:6px 10px' }, `v${VERSION} · autosparat ${new Date(s.updated).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`));
  const content = h('div', { class: 'content' });
  const inner = h('div', { class: 'inner' });
  try { inner.append((PAGES[UI.page] || PAGES.oversikt)(s, UI, UI.sub)); } catch (e) { console.error(e); inner.append(h('div', { class: 'card' }, 'Kunde inte rita sidan: ' + e.message)); }
  content.append(inner);
  game.append(top, nav, content);
  app.append(game);
}

// ---------- VECKA ----------
async function nextWeek() {
  if (UI.busy) return;
  const s = G.state;
  if (s.ap > 0 && !s.flags.skipApWarning) {
    const i = await choice({ title: 'Handlingspoäng kvar', text: `Du har ${s.ap} handlingspoäng kvar den här veckan. Vill du ändå gå vidare?`, choices: [{ label: 'Gå vidare till nästa vecka' }, { label: 'Gå vidare och fråga inte igen' }, { label: 'Stanna kvar' }] });
    if (i === 2) return; if (i === 1) s.flags.skipApWarning = true;
  }
  UI.busy = true;
  endWeek(s, G.rnd);
  save();
  renderShell();
  await processQueue();
  UI.busy = false; renderShell();
}

export async function processQueue() {
  const s = G.state;
  while (s.queue.length) {
    const item = s.queue[0];
    try { await handleQueueItem(item); } catch (e) { console.error('Köfel', e); toast('Något gick fel: ' + e.message, 'bad'); }
    s.queue.shift(); save();
  }
}
async function handleQueueItem(item) {
  const s = G.state, rnd = G.rnd;
  switch (item.type) {
    case 'report': return reportDialog(item.report);
    case 'event': return eventDialog(item.event);
    case 'interview': return runDebate(s, rnd, { kind: 'interview', issue: item.issue });
    case 'debate': return runDebate(s, rnd, { kind: item.debate || 'tv', campaign: item.campaign, host: item.host, name: item.name });
    case 'scandal': return scandalDialog(s.scandals.find((x) => x.id === item.scandalId));
    case 'vote': return voteDialog(s.riksdag.bills.find((b) => b.id === item.billItemId));
    case 'resurfaced': return resurfacedDialog(s.social.posts.find((x) => x.id === item.postId));
    case 'election': { const el = s.election.pending; if (!el) return; await runElectionNight(s, el); applyElection(s, el); s.election.pending = null; save(); s.queue.splice(1, 0, { type: 'formation', reason: 'val', round: 1 }); return; }
    case 'formation': { if (!s.government.pm || item.reason === 'val') { if (s.government.pm) dissolveGovernment(s, 'val'); await runFormation(s, rnd, item); } return; }
    case 'offer': return runOffer(s, rnd, item);
    case 'budget': return runBudget(s, rnd);
  }
}

function reportDialog(r) {
  const s = G.state;
  return new Promise((resolve) => {
    const body = h('div', { class: 'report' });
    const idx = r.newsFrom ? s.news.findIndex((n) => n.id === r.newsFrom) : s.news.length;
    const fresh = s.news.slice(0, idx < 0 ? 6 : idx).slice(0, 6);
    body.innerHTML = `<div class="sec"><h4>Hände under veckan</h4>${r.items.length ? `<ul>${r.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<span class="muted">En lugn vecka.</span>'}</div>`;
    if (r.poll) { const sec = h('div', { class: 'sec' }); sec.innerHTML = `<h4>Veckans mätning · ${esc(r.poll.inst)}</h4>` + pollBars(s, r.poll, { prev: s.opinion.polls.find((q) => q.inst === r.poll.inst && q.week < r.poll.week) }); body.append(sec); }
    if (fresh.length) { const sec = h('div', { class: 'sec' }); sec.innerHTML = '<h4>Rubriker</h4>'; sec.append(newsFeed(s, fresh, UI)); body.append(sec); }
    modal({ title: `Vecka ${s.week} · ${fmtDate(s.date, true)}`, body, closable: false, buttons: [{ label: 'Fortsätt', cls: 'gold', onClick: resolve }] });
  });
}
async function eventDialog(ev) {
  const s = G.state;
  const i = await choice({ title: ev.title, text: esc(ev.text), choices: ev.choices.map((c) => ({ label: c.text })) });
  const txt = applyEventChoice(s, G.rnd, ev, ev.choices[i].i);
  if (txt) await info(ev.title, `<p>${esc(txt)}</p>`);
}
async function scandalDialog(sc) {
  if (!sc) return;
  const s = G.state;
  const i = await choice({ title: `🔥 ${sc.title}`, text: `<p>${esc(sc.text)}</p><p><b>Styrka: ${fmt(sc.severity, 0)}/100.</b> Hur svarar du?</p>`, choices: RESPONSES.map((r) => ({ label: r.name, desc: r.desc })) });
  const out = respondScandal(s, G.rnd, sc, RESPONSES[i].id);
  await info('Utfall', `<p>${esc(out.text)}</p><p class="muted">Skandalens styrka nu: ${fmt(out.severity, 0)}.</p>`);
}
async function resurfacedDialog(po) {
  if (!po) return;
  const s = G.state; const pl = PLATFORMS.find((x) => x.id === po.platform);
  const sev = clamp(Math.round(po.risk * 1.2 + me().attention / 5), 10, 70);
  const sc = { id: 'sc' + s.week + '_' + Math.floor(G.rnd() * 1e5), type: 'gammalt_uttalande', title: 'Gammalt inlägg', partyId: me().id, severity: sev, peak: sev, week: s.week, date: { ...s.date }, active: true, responded: false, text: `Ett inlägg som ${leader().name} publicerade på ${pl.name} ${fmtDate(po.date)} sprids nu på nytt: "${po.text.slice(0, 120)}…" Kritiker kallar det ${po.tone === 'provocerande' ? 'hatiskt' : po.tone === 'humor' ? 'omdömeslöst' : 'pinsamt'}.` };
  s.scandals.unshift(sc);
  addNews(s, { outlet: 'expressen', headline: `Gammalt inlägg av ${leader().name} sprids – "${po.text.slice(0, 40)}…"`, body: sc.text, tags: ['skandal', 'some'], partyId: me().id, importance: 2, tone: -1 });
  await scandalDialog(sc);
}
async function voteDialog(item) {
  if (!item) return;
  const s = G.state; const b = BILL_BY_ID[item.billId]; const prop = s.parties[item.proposer];
  const exp = expectedVote(s, item); const mine = s.riksdag.seats[me().id] || 0; const st = stance(me(), b);
  const owed = (s.riksdag.owed || []).find((o) => o.to === item.proposer);
  const i = await choice({ title: `Omröstning: ${b.title}`, text: `<p>${esc(b.desc)}</p><p>Föreslaget av <b>${esc(prop.name)}</b>. Kostnad: ${b.cost > 0 ? b.cost + ' mdkr/år' : b.cost < 0 ? 'sparar ' + -b.cost + ' mdkr/år' : 'ingen'}.</p><p>Övriga partier väntas rösta: <span class="up">${exp.ja} ja</span>, <span class="down">${exp.nej} nej</span>, ${exp.avst} avstår. Ni har <b>${mine}</b> mandat. ${mine >= Math.abs(exp.ja - exp.nej) ? '<b>Er röst avgör.</b>' : ''}</p><p class="muted">Partiets politik ${st > .3 ? 'talar för' : st < -.3 ? 'talar emot' : 'är kluven om'} förslaget.${owed ? ` <b>Ni har lovat ${esc(prop.abbr)} ert stöd i en tidigare uppgörelse – ett nej skadar relationen svårt.</b>` : ''}</p>`, choices: [{ label: 'Rösta JA', cls: 'green' }, { label: 'Rösta NEJ', cls: 'red' }, { label: 'Avstå' }] });
  const v = ['ja', 'nej', 'avstår'][i];
  if (owed && v !== 'ja') { prop.relations[me().id] = clamp((prop.relations[me().id] || 0) - 30, -100, 100); me().credibility = clamp(me().credibility - 4, 0, 100); }
  if (owed && v === 'ja') s.riksdag.owed = s.riksdag.owed.filter((o) => o !== owed);
  // politiken: att rösta emot sin egen linje kostar trovärdighet
  if ((st > .4 && v === 'nej') || (st < -.4 && v === 'ja')) me().credibility = clamp(me().credibility - 3, 0, 100);
  const r = resolveVote(s, G.rnd, item, v);
  if (r.passed && item.byPlayer) s.stats.billsPassed++;
  addNews(s, { outlet: 'svt', headline: r.passed ? `Riksdagen antog: ${b.title}` : `Riksdagen fällde: ${b.title}`, body: `${r.ja} ja, ${r.nej} nej, ${r.avst} avstod. ${esc(me().abbr)} röstade ${v}.`, tags: ['riksdag', b.area], partyId: item.byPlayer ? me().id : null, importance: 2 });
  await info(r.passed ? '✅ Förslaget antogs' : '❌ Förslaget föll', `<p><b>${r.ja}</b> ja · <b>${r.nej}</b> nej · ${r.avst} avstod.</p><table>${activeParties(s).filter((q) => s.riksdag.seats[q.id]).map((q) => `<tr><td>${esc(q.abbr)}</td><td>${esc(r.votes[q.id])}</td></tr>`).join('')}</table>`);
}

// ---------- HANDLINGAR ----------
async function actionDialog(a, extra = {}) {
  const s = G.state;
  const run = async (params) => { const r = doAction(s, G.rnd, a.id, params); toast(r.text, r.ok ? 'good' : 'bad'); save(); renderShell(); };
  if (!a.needs) return run({});
  if (a.needs === 'issue') { const i = await pickIssue(a.name); if (i == null) return; return run({ issue: i }); }
  if (a.needs === 'region') { const i = await choice({ title: a.name, text: 'Vart reser du?', choices: REGIONS.map((r) => ({ label: r.name, desc: `${r.pop} tusen inv.` })), wide: true }); return run({ region: REGIONS[i].id }); }
  if (a.needs === 'party') { const list = activeParties(s).filter((q) => !q.isPlayer); const i = await choice({ title: a.name, text: 'Vem träffar du?', choices: list.map((q) => ({ label: `${q.name}`, desc: `${s.people[q.leader].name} · relation ${q.relations?.[me().id] || 0}` })) }); return run({ party: list[i].id }); }
  if (a.needs === 'party_issue') { const list = activeParties(s).filter((q) => !q.isPlayer); const i = await choice({ title: a.name, text: 'Vilket parti angriper du?', choices: list.map((q) => ({ label: q.name, desc: `${fmt(s.opinion.support[q.id] || 0, 1)} % · ${s.people[q.leader].name}` })) }); const is = await pickIssue('I vilken fråga?'); if (is == null) return; return run({ party: list[i].id, issue: is }); }
  if (a.needs === 'issue_shift') return programDialog(run);
  if (a.needs === 'bill') return billDialog(run);
  if (a.needs === 'negotiate') return negotiateDialog(extra.itemId);
}
async function pickIssue(title) {
  const s = G.state;
  const i = await choice({ title, text: 'Välj fråga.', choices: ISSUES.map((is) => ({ label: is.name, desc: `hett: ${(s.opinion.salience[is.id] * 100).toFixed(0)} · er linje: ${issueLabel(is.id, me().pos[is.id])}` })), wide: true });
  return ISSUES[i].id;
}
function programDialog(run) {
  const s = G.state; const p = me();
  return new Promise((resolve) => {
    const body = h('div', {});
    body.innerHTML = `<p class="help">Flytta en position högst 20 steg per vecka. Trovärdigheten tar stryk (−1,5 per 10 steg, mer för riksdagspartier) och sammanhållningen också. Nya väljare kan lockas – gamla kan lämna.</p><div class="field"><label>Fråga</label><select id="is">${ISSUES.map((is) => `<option value="${is.id}">${is.name} (nu ${p.pos[is.id]})</option>`).join('')}</select></div><div class="axis" id="ax"></div>`;
    const sel = body.querySelector('#is'); const ax = body.querySelector('#ax');
    let amount = 0;
    const draw = () => { const is = ISSUE_BY_ID[sel.value]; const cur = p.pos[is.id]; ax.innerHTML = `<div class="name"><span style="color:var(--text)">${esc(is.name)}</span><span>${cur} → <b id="nv">${cur + amount}</b> · ${esc(issueLabel(is.id, cur + amount))}</span></div><div class="l">${esc(is.left)}</div><input type="range" id="rg" min="${Math.max(-100, cur - 20)}" max="${Math.min(100, cur + 20)}" value="${cur + amount}"><div class="r">${esc(is.right)}</div>`; ax.querySelector('#rg').addEventListener('input', (e) => { amount = +e.target.value - cur; ax.querySelector('#nv').textContent = cur + amount; }); };
    sel.addEventListener('change', () => { amount = 0; draw(); }); draw();
    modal({ title: 'Ändra partiprogrammet', body, buttons: [{ label: 'Avbryt', onClick: resolve }, { label: 'Genomför (1 AP)', cls: 'gold', onClick: () => { if (amount === 0) { toast('Ingen förändring vald.'); return false; } run({ issue: sel.value, amount }); resolve(); } }] });
  });
}
function billDialog(run) {
  const s = G.state; const p = me();
  return new Promise((resolve) => {
    const recent = new Set(s.riksdag.bills.slice(0, 15).map((b) => b.billId));
    const list = BILLS.filter((b) => !recent.has(b.id)).map((b) => ({ b, st: stance(p, b) })).sort((a, c) => c.st - a.st);
    const body = h('div', { class: 'list' });
    for (const { b, st } of list) {
      const exp = { ja: 0, nej: 0 }; for (const q of activeParties(s)) { if (q.isPlayer) continue; const n = s.riksdag.seats[q.id] || 0; const v = stance(q, b); if (v > .12) exp.ja += n; else if (v < -.12) exp.nej += n; }
      const d = h('div', { class: 'item clickable' });
      d.innerHTML = `<div class="top"><b>${esc(b.title)}</b><span class="tag ${st > .3 ? 'green' : st < -.3 ? 'red' : ''}">${st > .3 ? 'i linje med er politik' : st < -.3 ? 'emot er politik' : 'neutral'}</span></div><small>${esc(b.desc)}</small><div class="meta">${esc(ISSUE_BY_ID[b.area].name)} · kostnad ${b.cost > 0 ? b.cost + ' mdkr' : b.cost < 0 ? 'sparar ' + -b.cost + ' mdkr' : 'ingen'} · trolig uppslutning: ${exp.ja + (s.riksdag.seats[p.id] || 0)} ja / ${exp.nej} nej (utan förhandling)</div>`;
      d.addEventListener('click', () => { m.close(); run({ bill: b.id }); resolve(); });
      body.append(d);
    }
    const m = modal({ title: 'Lägg fram lagförslag', body, wide: true, buttons: [{ label: 'Avbryt', onClick: resolve }] });
  });
}
async function negotiateDialog(itemId) {
  const s = G.state; const p = me();
  const mine = s.riksdag.bills.filter((b) => b.status === 'pending' && b.byPlayer);
  if (!mine.length) return toast('Du har inget liggande förslag att förhandla om.');
  let item = mine.find((b) => b.id === itemId) || mine[0];
  if (mine.length > 1 && !itemId) { const i = await choice({ title: 'Vilket förslag?', choices: mine.map((b) => ({ label: BILL_BY_ID[b.billId].title })) }); item = mine[i]; }
  const others = activeParties(s).filter((q) => !q.isPlayer && (s.riksdag.seats[q.id] || 0) > 0 && !item.deals[q.id]);
  const i = await choice({ title: `Förhandla: ${BILL_BY_ID[item.billId].title}`, text: 'Vem vänder du dig till?', choices: others.map((q) => ({ label: `${q.name} (${s.riksdag.seats[q.id]} mandat)`, desc: `inställning ${stance(q, BILL_BY_ID[item.billId]) > .2 ? 'positiv' : stance(q, BILL_BY_ID[item.billId]) < -.2 ? 'negativ' : 'avvaktande'} · relation ${q.relations?.[p.id] || 0}` })) });
  const q = others[i];
  s.ap -= 1;
  const d = negotiationDemand(s, G.rnd, q, item);
  if (!d.possible) { save(); renderShell(); return info('Förhandlingen', `<p>${esc(d.reason)}</p>`); }
  const j = await choice({ title: `${s.people[q.leader].name} (${q.abbr}) svarar`, text: `<p>"${esc(d.demand.text)}"</p><p class="muted">Pris: ${esc(d.demand.cost)}</p>`, choices: [{ label: 'Acceptera – vi har en uppgörelse', cls: 'green' }, { label: 'Tacka nej' }] });
  if (j === 0) { applyDeal(s, q, item, d.demand); addNews(s, { outlet: 'svt', headline: `${p.abbr} och ${q.abbr} överens om ${BILL_BY_ID[item.billId].title.toLowerCase()}`, body: `Uppgörelsen ger förslaget ${s.riksdag.seats[q.id]} nya ja-röster.`, tags: ['riksdag'], partyId: p.id, importance: 2 }); toast(`${q.abbr} röstar ja.`, 'good'); } else { q.relations[p.id] = clamp((q.relations[p.id] || 0) - 3, -100, 100); toast('Ingen uppgörelse.'); }
  save(); renderShell();
}
async function postFlow(params) {
  const s = G.state;
  if (s.ap < 1) return toast('Inga handlingspoäng kvar.', 'bad');
  s.ap -= 1; s.stats.posts++;
  const po = composePost(s, G.rnd, params);
  save();
  await info(po.reach > 300000 ? '🚀 Viralt!' : po.landedWrong ? '😬 Det landade fel' : 'Publicerat', `<div class="post"><div class="body">${esc(po.text)}</div><div class="stats"><span>👁 ${fmt(po.reach)} visningar</span><span>❤️ ${fmt(po.likes)}</span><span>➕ ${fmt(po.newFollowers)} följare</span><span>⚠️ risk ${po.risk}</span></div></div>${po.landedWrong ? '<p class="danger" style="margin-top:10px">Inlägget tolkades illa och kritiken växer.</p>' : ''}`);
  renderShell();
}
async function budgetFlow() { await runBudget(G.state, G.rnd); save(); renderShell(); }
async function resignFlow() {
  const s = G.state;
  const i = await choice({ title: 'Avgå som statsminister?', text: 'Regeringen avgår och talmannen inleder nya sonderingar. Ditt parti förlorar trovärdighet.', choices: [{ label: 'Ja, regeringen avgår', cls: 'red' }, { label: 'Nej' }] });
  if (i !== 0) return;
  addNews(s, { outlet: 'svt', headline: `${leader().name} avgår – regeringen faller`, body: 'Statsministern lämnade in sin avskedsansökan till talmannen i dag.', tags: ['politik'], partyId: me().id, importance: 3 });
  me().credibility = clamp(me().credibility - 8, 0, 100);
  dissolveGovernment(s, 'avgång');
  s.queue.push({ type: 'formation', reason: 'avgang', round: 1 });
  save(); await processQueue(); renderShell();
}
async function reshuffleFlow() {
  const s = G.state; const gov = s.government;
  const pool = gov.parties.flatMap((id) => (s.parties[id].people || []).map((pid) => s.people[pid]).filter((x) => x && x.alive && x.id !== gov.pm));
  const mi = await choice({ title: 'Ombilda regeringen', text: 'Vilken post?', choices: MINISTRIES.map((m) => ({ label: m.name, desc: s.people[gov.ministers[m.id]]?.name || 'vakant' })), wide: true });
  const m = MINISTRIES[mi];
  const pi = await choice({ title: m.name, text: 'Vem får posten?', choices: pool.map((x) => ({ label: x.name, desc: `${s.parties[x.partyId].abbr} · kompetens ${Math.round((x.traits.intelligens + x.traits.ledarskap + x.traits.erfarenhet) / 3)} · integritet ${x.traits.integritet}${x.ministry ? ' · nu ' + MINISTRIES.find((y) => y.id === x.ministry)?.name : ''}` })), wide: true });
  const per = pool[pi];
  const old = s.people[gov.ministers[m.id]]; if (old) { old.role = 'mp'; delete old.ministry; }
  if (per.ministry) delete gov.ministers[per.ministry];
  gov.ministers[m.id] = per.id; per.role = 'minister'; per.ministry = m.id;
  addNews(s, { outlet: 'svt', headline: `${per.name} ny ${m.name.toLowerCase()}`, body: old ? `${old.name} lämnar posten.` : 'Posten har varit vakant.', tags: ['politik'], partyId: me().id, importance: 2 });
  if (old) me().unity = clamp(me().unity - 3, 0, 100);
  save(); renderShell();
}
async function noConfidenceFlow() {
  const s = G.state; if (s.ap < 1) return toast('Inga handlingspoäng.', 'bad');
  const gov = s.government; const pmP = s.parties[gov.pmParty];
  let yes = s.riksdag.seats[me().id] || 0;
  const detail = {};
  for (const q of activeParties(s)) { if (q.isPlayer || gov.parties.includes(q.id)) continue; const n = s.riksdag.seats[q.id] || 0; if (!n) continue; const w = willingness(s, q, pmP); const v = gov.support.includes(q.id) ? (gov.approval < 30 && G.rnd() < .3 ? 'ja' : 'nej') : w < 15 || (gov.approval < 35 && G.rnd() < .5) ? 'ja' : 'avstår'; detail[q.id] = v; if (v === 'ja') yes += n; }
  s.ap -= 1;
  const ok = yes >= 175;
  addNews(s, { outlet: 'svt', headline: ok ? `Regeringen fälld i misstroendeomröstning` : `Misstroendeförklaringen föll – ${yes} röstade för`, body: ok ? `${me().abbr}:s misstroendeförklaring samlade ${yes} röster. Regeringen avgår.` : `Det krävdes 175 röster. ${me().abbr} fick inte med sig tillräckligt många.`, tags: ['politik'], partyId: me().id, importance: 3 });
  if (ok) { dissolveGovernment(s, 'misstroende'); s.queue.push({ type: 'formation', reason: 'misstroende', round: 1 }); me().attention = clamp(me().attention + 15, 0, 100); }
  else { me().credibility = clamp(me().credibility - 3, 0, 100); for (const id of gov.parties) s.parties[id].relations[me().id] = clamp((s.parties[id].relations[me().id] || 0) - 15, -100, 100); }
  await info(ok ? '⚡ Regeringen föll!' : 'Misstroendeförklaringen föll', `<p>${yes} röstade för (175 krävs).</p><table>${Object.entries(detail).map(([id, v]) => `<tr><td>${esc(s.parties[id].abbr)}</td><td>${v}</td></tr>`).join('')}</table>`);
  save(); await processQueue(); renderShell();
}

function menuDialog() {
  modal({ title: 'Meny', body: `<p class="help">Spelet sparas automatiskt efter varje handling och vecka. Här kan du dessutom exportera sparfilen eller gå tillbaka till startskärmen.</p>`, buttons: [{ label: 'Exportera sparfil', onClick: () => exportSave() }, { label: 'Till startskärmen', onClick: () => { save(); UI.onExit?.(); } }, { label: 'Stäng', cls: 'gold' }], stack: true });
}
function helpDialog() {
  modal({ title: 'Så spelar du', wide: true, body: `
    <p><b>Varje vecka</b> har du handlingspoäng (AP). Använd dem på presskonferenser, turnéer, sociala medier, riksdagsarbete, partibygge – och tryck sedan <b>Nästa vecka</b>. Då händer allt annat: statistiken uppdateras, opinionen rör sig, medierna rapporterar, händelser och skandaler inträffar.</p>
    <p><b>Opinionen</b> styrs av hur nära din politik ligger varje väljargrupp i de frågor som är heta just nu, av partiledarens personlighet och stöd, trovärdighet, uppmärksamhet, skandaler, regeringens leverans – och kännedom. Ett nytt parti måste först bli känt.</p>
    <p><b>Riksdagen</b>: lagförslag kommer till omröstning efter tre veckor. Förhandla med andra partier för att få igenom dina egna – de ställer krav. Omröstningar sparas i partiernas röstminne och kan användas i debatter ("INVÄNDNING!").</p>
    <p><b>Debatter</b> spelas som scener: välj argument (fakta, känsla, motangrepp, kompromiss) utifrån din ledares egenskaper. Hittar du en motsägelse mellan vad motståndaren säger och hur de röstat – invänd!</p>
    <p><b>Valet</b> hålls andra söndagen i september vart fjärde år. Valrörelsen börjar åtta veckor innan. Efter valet bildas regering: statsministern tolereras om färre än 175 röstar nej.</p>
    <p><b>Sverige</b> simuleras månad för månad: ekonomi, välfärd, brott, klimat, försvar, demokrati, regioner. Reformer märks med fördröjning.</p>
    <p class="muted">Spelet är svårt med avsikt. Ett nytt parti behöver flera år. Lycka till.</p>`, buttons: [{ label: 'OK', cls: 'gold' }] });
}
