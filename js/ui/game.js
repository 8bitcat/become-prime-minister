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
import { applyFactionChoice, installLeader, STRUCTURE_OPTIONS, structureSummary, defaultStructure } from '../sim/party.js';
import { manifestCandidates } from '../sim/promises.js';
import { SEGMENTS } from '../data/segments.js';
import { renderLeaderCreator, blankLeader, finalizeLeader } from './leader-creator.js';
import { makePerson, applyPersona, credOf, personSummary, personaSummary } from '../sim/people.js';

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
    case 'interview': return item.influencer ? runDebate(s, rnd, { kind: 'podd', influencer: item.influencer }) : runDebate(s, rnd, { kind: 'interview', issue: item.issue });
    case 'note': return info(item.title, `<p>${esc(item.text)}</p>`);
    case 'faction': return factionDialog(item);
    case 'challenge': return challengeDialog(item);
    case 'manifest': return manifestDialog(true);
    case 'retire': return retireDialog();
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
  if (a.needs === 'structure') return kongressDialog(run);
  if (a.needs === 'manifest') return manifestDialog(false, run);
  if (a.needs === 'succession') return successionFlow(false, run);
}

// ---------- PARTIETS INRE LIV ----------
async function factionDialog(item) {
  const s = G.state; const p = s.parties[item.partyId]; const f = p?.factions?.find((x) => x.id === item.factionId); if (!f) return;
  const is = ISSUE_BY_ID[item.issue]; const fl = f.leaderId ? s.people[f.leaderId] : null;
  const i = await choice({ title: `${f.name} ställer krav`, text: `<p>${fl ? esc(fl.name) + ' talar för ' : ''}<b>${esc(f.name)}</b> (${fmt(f.strength, 0)} % av partiet, humör ${fmt(f.mood, 0)}): "Partiet måste ${item.shift > 0 ? 'gå åt höger' : 'gå åt vänster'} i frågan om ${esc(is.name.toLowerCase())}. Annars vet vi inte om vi hör hemma här längre."</p>`, choices: [{ label: `Ge efter: flytta partiet ${item.shift > 0 ? '+' : ''}${item.shift} i ${is.name.toLowerCase()}`, desc: 'Falangen lugnas. Trovärdighet −3, andra falanger muttrar.' }, { label: 'Stå fast', desc: 'Falangens humör sjunker. Risk för splittring ökar.', cls: 'red' }, { label: 'Bjud in till samtal', desc: 'Ledarskap och social förmåga avgör om det hjälper.' }] });
  const txt = applyFactionChoice(s, G.rnd, item, i);
  await info(f.name, `<p>${esc(txt)}</p>`);
}
async function challengeDialog(item) {
  const s = G.state; const p = s.parties[item.partyId]; const ch = s.people[item.challengerId]; const l = leader(); if (!ch) return;
  const pWin = clamp(.5 + (l.traits.ledarskap - ch.traits.ledarskap) / 150 + (p.unity - 50) / 200 + (l.approval - 40) / 200 + (p.structure?.ledarmakt - 50) / 400, .1, .9);
  const i = await choice({ title: '⚔️ Partiledarstrid', text: `<div class="minister"><div class="av">${characterSVG(ch, { crop: 'face', id: 'ch' })}</div><div><b>${esc(ch.name)}</b>, ${ch.age}<br><small class="muted">${esc(personSummary(ch))}<br>${esc(personaSummary(ch))} · ambition ${ch.ambition} · ledarskap ${ch.traits.ledarskap}</small></div></div><p style="margin-top:10px">${esc(ch.first)} meddelar att hen utmanar dig om partiledarposten ${p.structure?.ledarval === 'medlem' ? 'i en medlemsomröstning' : p.structure?.ledarval === 'styrelse' ? 'inför partistyrelsen' : 'på en extrakongress'}. Partiets sammanhållning är ${fmt(p.unity, 0)}. Din chans att vinna bedöms till <b>${fmt(pWin * 100, 0)} %</b>.</p>`, choices: [{ label: 'Ta striden', desc: 'Vinner du stärks partiet. Förlorar du lämnar du posten.', cls: 'gold' }, { label: 'Erbjud utmanaren posten som vice partiledare', desc: 'Chans att striden ställs in. Utmanaren växer sig starkare.' }, { label: 'Avgå frivilligt', desc: 'Du väljer själv efterträdare – eller skapar en ny ledare.' }] });
  if (i === 1) { const ok = G.rnd() < .45 + (l.traits.social - 45) / 150; if (ok) { ch.ambition = Math.max(10, ch.ambition - 15); p.unity = clamp(p.unity + 2, 0, 100); addNews(s, { outlet: 'svt', headline: `${ch.name} blir vice partiledare – ledarstriden i ${p.abbr} avblåst`, body: 'Kompromissen håller ihop partiet, för nu.', tags: ['parti'], partyId: p.id, importance: 2 }); return info('Striden avblåst', `<p>${esc(ch.name)} accepterar vice-posten. Striden är över – för nu.</p>`); } await info('Avvisat', `<p>${esc(ch.name)} tackar nej. Striden blir av.</p>`); }
  if (i === 2) { addNews(s, { outlet: 'svt', headline: `${l.name} avgår som partiledare för ${p.name}`, body: `Efter en intern utmaning väljer ${l.name} att lämna. Efterträdare utses inom kort.`, tags: ['parti'], partyId: p.id, importance: 3 }); return successionFlow(true); }
  const win = G.rnd() < pWin;
  if (win) { p.unity = clamp(p.unity + 8, 0, 100); ch.loyalty = Math.max(5, ch.loyalty - 25); l.approval = clamp(l.approval + 3, 0, 100); addNews(s, { outlet: 'svt', headline: `${l.name} vann partiledarstriden i ${p.abbr}`, body: `${ch.name} fick inte majoritet. "Nu går vi vidare tillsammans", säger ${l.first}.`, tags: ['parti'], partyId: p.id, importance: 3 }); return info('🏆 Du vann!', `<p>Partiet slöt upp bakom dig. Sammanhållningen stärks, ${esc(ch.name)} slickar såren.</p>`); }
  addNews(s, { outlet: 'svt', headline: `${ch.name} ny partiledare för ${p.name} – ${l.name} förlorade striden`, body: `${l.name} lämnar efter omröstningen. ${s.government.pm === l.id ? 'Regeringen leds nu av ' + ch.name + '.' : ''}`, tags: ['parti'], partyId: p.id, importance: 3 });
  installLeader(s, p, ch, 'förlorade ledarstrid'); s.player.leaderId = ch.id; ch.ambition = 80; ch.loyalty = 99;
  save();
  await info('Du förlorade partiledarstriden', `<p><b>${esc(ch.name)}</b> är ny partiledare. Du fortsätter spela som ${esc(ch.first)} – världen och partiet går vidare.</p>`);
}
async function retireDialog() {
  const s = G.state; const l = leader();
  const i = await choice({ title: 'Dags att lämna?', text: `<p>${esc(l.name)} fyller ${l.age}. Partivänner – och medier – börjar fråga om det inte är dags att lämna över. Vill du avgå nu, med gott eftermäle, eller fortsätta?</p>`, choices: [{ label: 'Fortsätt som partiledare', desc: 'Frågan återkommer.' }, { label: 'Avgå och utse en efterträdare', desc: 'Du väljer vem som tar över – eller skapar en ny ledare.' }] });
  if (i === 1) return successionFlow(true);
}
// Efterträdare: välj bland partiets profiler eller skapa en ny ledare
async function successionFlow(forced, run = null) {
  const s = G.state; const p = me(); const l = leader();
  if (!forced) { const ok = await choice({ title: 'Lämna partiledarposten?', text: `<p>${esc(l.name)} avgår som partiledare för ${esc(p.name)}${isPlayerPM(s) ? ' och som statsminister' : ''}. Partiet behåller allt – mandat, pengar, organisation – och du fortsätter spela som efterträdaren. ${esc(l.first)}s karriär sammanfattas i historiken.</p>`, choices: [{ label: 'Ja, utse efterträdare', cls: 'red' }, { label: 'Nej, stanna kvar' }] }); if (ok !== 0) return; }
  const cands = (p.people || []).map((id) => s.people[id]).filter((x) => x && x.alive);
  const i = await choice({ title: 'Vem tar över?', wide: true, text: '<p>Välj en av partiets profiler – eller skapa en helt ny ledare.</p>', choices: [...cands.map((c) => ({ label: `${c.name}, ${c.age}`, desc: `${personSummary(c)} · ${personaSummary(c)} · ledarskap ${c.traits.ledarskap}, karisma ${c.traits.karisma}` })), { label: '＋ Skapa en ny ledare', cls: 'gold', desc: 'Öppnar ledarskaparen.' }] });
  let next;
  if (i < cands.length) next = cands[i];
  else {
    next = await createLeaderModal();
    if (!next) { if (forced) return successionFlow(true); return; }
    s.people[next.id] = next; p.people.push(next.id);
  }
  if (run) run({ successorId: next.id });
  else { const { doAction } = await import('../sim/turn.js'); doAction(s, G.rnd, 'avga', { successorId: next.id }); save(); renderShell(); }
}
function createLeaderModal() {
  return new Promise((resolve) => {
    const L = blankLeader(G.rnd, G.rnd() < .5 ? 'k' : 'm');
    const body = h('div', {});
    const cr = renderLeaderCreator(body, L, { rnd: G.rnd });
    const m = modal({ title: 'Skapa ny partiledare', body, wide: true, closable: false, buttons: [{ label: 'Avbryt', onClick: () => resolve(null) }, { label: 'Tillträd som partiledare', cls: 'gold', onClick: () => { const err = cr.validate(); if (err) { toast(err, 'bad'); return false; } const def = finalizeLeader(L); const per = makePerson(G.rnd, { partyId: me().id, role: 'leader', gender: def.gender, age: def.age, first: def.first, last: def.last, persona: def.persona, look: def.look, traits: def.traits }); per.name = def.name; per.bg = { ...def.bg }; per.baseTraits = { ...def.traits }; per.traits = applyPersona(def.traits, def.persona); per.cred = credOf(def.persona); per.approval = 35; resolve(per); } }] });
    m.el.style.width = 'min(1240px, 98vw)';
  });
}
function kongressDialog(run) {
  const s = G.state; const p = me();
  return new Promise((resolve) => {
    const S = { ...(p.structure || defaultStructure()), malgrupper: [...(p.structure?.malgrupper || [])] };
    const body = h('div', { class: 'grid c2' });
    const left = h('div', {}); const right = h('div', {});
    left.innerHTML = `<p class="help">Varje större förändring kostar sammanhållning (−3 per ändring, −4 i grundavgift, mildras av ledarskap). Falanger som förlorar inflytande blir missnöjda.</p><div class="axis" id="cent"></div><div class="axis" id="makt"></div><div class="axis" id="lokal"></div><div class="axis" id="bredd"></div>`;
    const slider = (id, name, l, r, key) => { const a = left.querySelector('#' + id); a.innerHTML = `<div class="name"><span style="color:var(--text)">${name}</span><span class="v">${S[key]}</span></div><div class="l">${l}</div><input type="range" min="0" max="100" value="${S[key]}"><div class="r">${r}</div>`; a.querySelector('input').addEventListener('input', (e) => { S[key] = +e.target.value; a.querySelector('.v').textContent = S[key]; sum.innerHTML = structureSummary(S); }); };
    slider('cent', 'Centralisering', 'Medlemmarna', 'Ledningen', 'centralisering'); slider('makt', 'Partiledarens makt', 'Kollektivt', 'Stark ledare', 'ledarmakt'); slider('lokal', 'Lokal självständighet', 'Kansliet styr', 'Fria avdelningar', 'lokalAutonomi'); slider('bredd', 'Bredd', 'Smalt & ideologiskt', 'Brett & pragmatiskt', 'bredd');
    right.innerHTML = ['ledarval', 'kandidatval', 'stadgar'].map((k) => `<div class="field"><label>${esc(STRUCTURE_OPTIONS[k].name)}</label><div class="chips" id="${k}">${STRUCTURE_OPTIONS[k].options.map((o) => `<span class="chip ${S[k] === o.id ? 'on' : ''}" data-v="${o.id}" title="${esc(o.desc)}">${esc(o.name)}</span>`).join('')}</div></div>`).join('') + `<div class="field"><label>Ungdomsförbund</label><div class="chips" id="ung"><span class="chip ${S.ungdom ? 'on' : ''}" data-v="1">Ja</span><span class="chip ${!S.ungdom ? 'on' : ''}" data-v="0">Nej</span></div></div><div class="field"><label>Målgrupper (max 4)</label><div class="chips" id="mg">${SEGMENTS.map((sg) => `<span class="chip ${S.malgrupper.includes(sg.id) ? 'on' : ''}" data-v="${sg.id}">${esc(sg.name)}</span>`).join('')}</div></div><div class="card" id="sum"></div>`;
    const sum = right.querySelector('#sum'); sum.innerHTML = structureSummary(S);
    for (const k of ['ledarval', 'kandidatval', 'stadgar']) right.querySelector('#' + k).addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; S[k] = c.dataset.v; right.querySelectorAll(`#${k} .chip`).forEach((x) => x.classList.toggle('on', x.dataset.v === S[k])); sum.innerHTML = structureSummary(S); });
    right.querySelector('#ung').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; S.ungdom = c.dataset.v === '1'; right.querySelectorAll('#ung .chip').forEach((x) => x.classList.toggle('on', (x.dataset.v === '1') === S.ungdom)); sum.innerHTML = structureSummary(S); });
    right.querySelector('#mg').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; const v = c.dataset.v; if (S.malgrupper.includes(v)) S.malgrupper = S.malgrupper.filter((x) => x !== v); else if (S.malgrupper.length < 4) S.malgrupper.push(v); else return; c.classList.toggle('on', S.malgrupper.includes(v)); });
    body.append(left, right);
    modal({ title: 'Partikongress', body, wide: true, buttons: [{ label: 'Avbryt', onClick: resolve }, { label: 'Klubba besluten (2 AP)', cls: 'gold', onClick: () => { run({ structure: S }); resolve(); } }] });
  });
}
function manifestDialog(fromQueue, run = null) {
  const s = G.state; const p = me();
  return new Promise((resolve) => {
    const cands = manifestCandidates(s); const sel = new Set();
    const body = h('div', {});
    body.innerHTML = `<p class="help">${fromQueue ? 'Valrörelsen har börjat. ' : ''}Välj 3–5 vallöften. Efter valet granskar medierna vilka som infriats – i regeringsställning kostar brutna löften förtroende, hållna ger. ${fromQueue ? '(Kostar inga handlingspoäng nu.)' : ''}</p><div class="list" id="list"></div>`;
    const list = body.querySelector('#list');
    for (const { b, st } of cands) { const d = h('div', { class: 'item clickable' }); d.innerHTML = `<div class="top"><b>${esc(b.title)}</b><span class="tag ${st > .5 ? 'green' : ''}">${esc(ISSUE_BY_ID[b.area].short)}</span></div><small>${esc(b.desc)}</small>`; d.addEventListener('click', () => { if (sel.has(b.id)) sel.delete(b.id); else if (sel.size < 5) sel.add(b.id); d.style.borderColor = sel.has(b.id) ? 'var(--gold)' : ''; cnt.textContent = `${sel.size} valda`; }); list.append(d); }
    const cnt = h('span', { class: 'muted' }, '0 valda');
    const m = modal({ title: `Valmanifest ${s.election.next.y}`, body, wide: true, closable: !fromQueue, buttons: [{ label: fromQueue ? 'Inget manifest' : 'Avbryt', onClick: resolve }, { label: 'Presentera manifestet', cls: 'gold', onClick: () => { if (sel.size < 3) { toast('Välj minst tre löften.', 'bad'); return false; } if (run) run({ billIds: [...sel] }); else { import('../sim/promises.js').then(({ setManifest }) => { setManifest(s, [...sel]); save(); renderShell(); }); } resolve(); } }] });
    m.el.querySelector('.mf').prepend(cnt);
  });
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
