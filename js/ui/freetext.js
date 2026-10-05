// Fritext-flödena: inlägg med kommentarsfält, presskonferens, tal, enskilda samtal, utspel,
// fokusgrupp, framgrävda uttalanden och AI-inställningar.
import { G, save } from '../core/state.js';
import { h, esc, fmt, fmtDate, clamp } from '../core/util.js';
import { modal, choice, info, toast } from './modal.js';
import { ISSUES, ISSUE_BY_ID } from '../data/issues.js';
import { REGIONS } from '../data/regions.js';
import { MEDIA } from '../data/names.js';
import { PLATFORMS, FORMATS, composeFreePost, deletePost, replyToComment } from '../sim/social.js';
import { analyze, commentsFor, speechReactions } from '../ai/generate.js';
import { recordStatement, factCheck, correctClaim, statementKindLabel } from '../ai/memory.js';
import { toneLabel } from '../ai/analyze.js';
import { adviserLine } from '../scene/debate.js';
import { pressQuestions, pressAnswer, pressSummary, speechOutcome, privateTalk, focusGroup } from '../sim/talk.js';
import { llmSettings, saveLlmSettings, MODELS, llmPing, resetClient, llmEnabled } from '../ai/llm.js';
import { loadSmart, smartStatus } from '../ai/embed.js';
import { characterArt } from '../art/sprites.js';
import { activeParties } from '../sim/opinion.js';
import { MINISTRIES } from '../sim/government.js';
import { addNews } from '../sim/news.js';

const me = () => G.state.parties[G.state.player.partyId];
const leader = () => G.state.people[me().leader];
const ctxFor = (question = null, questionIssue = null) => ({ stats: G.state.sweden.stats, parties: Object.values(G.state.parties).filter((q) => q.active !== false && !q.isPlayer), question, questionIssue });

// Generell textruta med rådgivare och förslag. Returnerar { text, extra } eller null.
export function textDialog({ title, intro = '', placeholder = '', rows = 5, maxlength = 900, suggestions = [], ctx = {}, okLabel = 'Skicka', cancelLabel = 'Avbryt', before = null, wide = true, closable = true }) {
  return new Promise((resolve) => {
    const body = h('div', { class: 'composer' });
    body.innerHTML = `${intro ? `<div class="help" style="margin-bottom:8px">${intro}</div>` : ''}<div id="before"></div><textarea id="ft" rows="${rows}" maxlength="${maxlength}" placeholder="${esc(placeholder)}"></textarea><div class="adviser" id="adv">${llmEnabled() ? 'Claude läser det du skriver när du skickar.' : 'Rådgivaren läser medan du skriver – och kan ha fel.'}</div>${suggestions.length ? `<div class="sugg" id="sugg"><small>Utgå från:</small>${suggestions.map((s, i) => `<span class="chip" data-i="${i}" title="${esc(s.text)}">${esc(s.label)}</span>`).join('')}</div>` : ''}`;
    if (before) body.querySelector('#before').append(before);
    const ta = body.querySelector('#ft'); const adv = body.querySelector('#adv');
    let tmr = null; ta.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { adv.textContent = adviserLine(ta.value, ctx) || adv.textContent; }, 250); });
    body.querySelector('#sugg')?.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; ta.value = suggestions[+c.dataset.i].text; ta.dispatchEvent(new Event('input')); ta.focus(); });
    let done = false;
    const m = modal({ title, body, wide, closable, buttons: [{ label: cancelLabel, onClick: () => { done = true; resolve(null); } }, { label: okLabel, cls: 'gold', onClick: () => { const t = ta.value.trim(); if (!t) { toast('Skriv något först.', 'bad'); return false; } done = true; resolve({ text: t, body }); } }], onClose: () => { if (!done) resolve(null); } });
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); m.el.querySelector('.mf .btn.gold').click(); } });
    setTimeout(() => ta.focus(), 50);
  });
}
const busyToast = () => { if (llmEnabled()) toast('Claude läser…'); };

// ---------- INLÄGG ----------
export async function postFlow(params, ui) {
  const s = G.state;
  if (s.ap < 1) return toast('Inga handlingspoäng kvar.', 'bad');
  if (!params.text?.trim()) return toast('Skriv inlägget först.', 'bad');
  busyToast();
  const a = await analyze(s, params.text, {});
  s.ap -= 1; s.stats.posts++;
  const po = composeFreePost(s, G.rnd, { platform: params.platform, format: params.format, text: params.text, analysis: a });
  const rec = recordStatement(s, params.text, 'post', { analysis: a });
  po.statementId = rec.statement.id;
  if (rec.contradictions.length) po.contradiction = rec.contradictions[0];
  factCheck(s, rec.statement);
  save(); ui.render();
  po.comments = await commentsFor(s, G.rnd, po, a);
  save();
  await threadDialog(po, ui, { fresh: true });
  ui.render();
}
function postCard(po) {
  const s = G.state; const l = leader(); const pl = PLATFORMS.find((x) => x.id === po.platform) || PLATFORMS[0];
  const tags = [po.dominant ? `<span class="tag">${esc(toneLabel(po.dominant))}</span>` : '', ...(po.issues || []).map((id) => `<span class="tag blue">${esc(ISSUE_BY_ID[id]?.short || id)}</span>`), po.reach > 300000 ? '<span class="tag gold">viralt</span>' : '', po.landedWrong ? '<span class="tag red">landade fel</span>' : '', po.resurfaced ? '<span class="tag red">grävdes fram</span>' : '', po.deleted ? '<span class="tag red">raderat</span>' : '', po.screenshot ? '<span class="tag red">skärmdumpat</span>' : '', po.wrongClaims ? '<span class="tag red">faktafel</span>' : '', po.promises ? '<span class="tag gold">löfte</span>' : ''].join(' ');
  return `<div class="post ${po.deleted ? 'deleted' : ''}"><div class="head"><div class="av">${characterArt(l, { crop: 'face', id: 'av' + po.id })}</div><b>${esc(l.name)}</b><span class="muted">${pl.icon} ${esc(pl.name)} · ${fmtDate(po.date)}</span></div><div class="body">${esc(po.text)}</div><div class="stats"><span>👁 ${fmt(po.reach)}</span><span>❤️ ${fmt(po.likes)}</span><span>➕ ${fmt(po.newFollowers)} följare</span><span>⚠️ risk ${po.risk}</span></div><div class="row" style="margin-top:6px;gap:4px">${tags}</div>${po.contradiction ? `<div class="danger" style="font-size:12px;margin-top:6px">Motsägelse: ${esc(po.contradiction)}</div>` : ''}</div>`;
}
export function threadDialog(po, ui, { fresh = false } = {}) {
  const s = G.state;
  return new Promise((resolve) => {
    const body = h('div', {});
    const draw = () => {
      const st = (s.memory?.statements || []).find((x) => x.id === po.statementId);
      body.innerHTML = `${postCard(po)}<h3 style="margin:12px 0 6px">Kommentarer <small class="muted">${(po.comments || []).length}</small></h3><div class="thread" id="thread">${(po.comments || []).map((c, i) => `<div class="comment ${c.mine ? 'mine' : ''}"><b>${esc(c.who)}</b>${c.to ? `<small class="muted"> → ${esc(c.to)}</small>` : ''}<div>${esc(c.text)}</div><small class="muted">❤️ ${fmt(c.likes || 0)}${!c.mine && !po.deleted && (po.myReplies || 0) < 3 ? ` · <a href="#" data-r="${i}">svara</a>` : ''}</small></div>`).join('') || '<div class="empty">Inga kommentarer ännu.</div>'}</div>
        <div class="row" style="margin-top:12px;gap:8px">${!po.deleted ? '<button class="btn red ghost sm" id="del">🗑️ Radera inlägget</button>' : ''}${st?.factChecked && !st.corrected ? '<button class="btn sm" id="corr">✏️ Rätta siffran offentligt</button>' : ''}</div>`;
      body.querySelectorAll('[data-r]').forEach((el) => el.addEventListener('click', async (e) => { e.preventDefault(); const c = po.comments[+el.dataset.r]; const r = await textDialog({ title: `Svara ${c.who}`, intro: `<i>"${esc(c.text)}"</i>`, placeholder: 'Ditt svar i kommentarsfältet…', rows: 3, maxlength: 300, ctx: ctxFor(), okLabel: 'Svara', wide: false }); if (!r) return; busyToast(); const a = await analyze(s, r.text, { question: c.text }); const note = replyToComment(s, G.rnd, po, c, r.text, a); po.myReplies = (po.myReplies || 0) + 1; recordStatement(s, r.text, 'post', { question: c.text, analysis: a }); save(); toast(note, a.dominant === 'aggressiv' ? 'bad' : 'good'); draw(); }));
      body.querySelector('#del')?.addEventListener('click', async () => { const i = await choice({ title: 'Radera inlägget?', text: 'Inlägget försvinner ur flödet. Men internet glömmer inte – har många sett det kan skärmdumpar spridas, och journalisterna minns.', choices: [{ label: 'Radera', cls: 'red' }, { label: 'Låt det ligga' }] }); if (i !== 0) return; const shot = deletePost(s, G.rnd, po); save(); toast(shot ? 'Raderat – men skärmdumparna sprids redan.' : 'Raderat. Ingen verkar ha hunnit spara det.', shot ? 'bad' : 'good'); draw(); });
      body.querySelector('#corr')?.addEventListener('click', () => { correctClaim(s, st); save(); toast('Rättelsen publicerad. Förtroendet återhämtar sig något.', 'good'); draw(); });
    };
    draw();
    modal({ title: fresh ? (po.reach > 300000 ? '🚀 Viralt!' : po.landedWrong ? '😬 Det landade fel' : 'Publicerat') : 'Inlägget', body, wide: true, buttons: [{ label: 'Stäng', cls: 'gold', onClick: resolve }], onClose: resolve });
  });
}

// ---------- PRESSKONFERENS ----------
export async function pressFlow(a, run, ui) {
  const s = G.state; const p = me(); const l = leader();
  const sel = h('div', { class: 'field' }); sel.innerHTML = `<label>Ämne</label><select id="pissue">${ISSUES.map((is) => `<option value="${is.id}">${esc(is.name)} (hett ${(s.opinion.salience[is.id] * 100).toFixed(0)})</option>`).join('')}</select>`;
  const hot = [...ISSUES].sort((x, y) => s.opinion.salience[y.id] - s.opinion.salience[x.id])[0];
  sel.querySelector('select').value = hot.id;
  const r = await textDialog({ title: '🎤 Presskonferens – ditt uttalande', intro: 'Skriv vad du säger inför journalisterna. Sedan ställer de frågor – i ämnet, utanför ämnet, och ibland om något du sagt förr. Löften med siffror sparas och följs upp.', placeholder: 'T.ex. "Vi föreslår att … Det kostar … och finansieras genom …"', rows: 6, maxlength: 1200, ctx: ctxFor(), okLabel: 'Håll presskonferensen (1 AP)', before: sel, suggestions: [{ label: 'Konkret förslag', text: `Vi lägger i dag fram ett konkret förslag om ${hot.name.toLowerCase()}. Det innebär tre saker: … Det kostar … miljarder och finansieras genom …` }, { label: 'Kräv svar av regeringen', text: `Regeringen har haft åratal på sig att göra något åt ${hot.name.toLowerCase()}. Ingenting har hänt. Vi kräver nu att …` }] });
  if (!r) return;
  const issue = sel.querySelector('select').value;
  busyToast();
  const an = await analyze(s, r.text, {});
  const quality = clamp(.3 + an.clarity * .5 + (an.promises?.length ? .08 : 0) + (an.dominant === 'saklig' ? .1 : an.dominant === 'kampande' ? .05 : an.dominant === 'aggressiv' ? -.1 : 0) - (an.vague ? .2 : 0) - (an.claims || []).filter((c) => c.ok === false).length * .25 + ((l.traits.retorik - 45) / 150), .05, .95);
  const rec = recordStatement(s, r.text, 'press', { analysis: an });
  factCheck(s, rec.statement);
  const good = G.rnd() < quality;
  run({ issue, text: r.text, quality, good });
  const qs = pressQuestions(s, G.rnd, issue, an);
  const answers = [];
  for (const q of qs) {
    const jp = q.journalistId ? s.people[s.journalists[q.journalistId]?.personId] : null;
    const av = h('div', { class: 'minister' }); av.innerHTML = `<div class="av">${jp ? characterArt(jp, { crop: 'face', id: 'j' + q.journalistId }) : '🎤'}</div><div><b>${esc(q.who)}</b><br><span style="font-size:15px">"${esc(q.q)}"</span></div>`;
    const ans = await new Promise((res) => {
      const body = h('div', { class: 'composer' });
      body.append(av);
      body.insertAdjacentHTML('beforeend', `<textarea id="ft" rows="4" maxlength="700" placeholder="Ditt svar…"></textarea><div class="adviser" id="adv"></div>`);
      const ta = body.querySelector('#ft'); let tmr; ta.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { body.querySelector('#adv').textContent = adviserLine(ta.value, ctxFor(q.q, q.issue)); }, 250); });
      const m = modal({ title: `Fråga ${answers.length + 1} av ${qs.length}`, body, wide: true, closable: false, buttons: [{ label: 'Ingen kommentar', onClick: () => res({ noComment: true }) }, { label: 'Svara', cls: 'gold', onClick: () => { const t = ta.value.trim(); if (!t) { toast('Skriv ett svar – eller välj "Ingen kommentar".', 'bad'); return false; } res({ text: t }); } }] });
      ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); m.el.querySelector('.mf .btn.gold').click(); } });
      setTimeout(() => ta.focus(), 50);
    });
    let out;
    if (ans.noComment) out = pressAnswer(s, G.rnd, q, '', null, true);
    else { busyToast(); const a2 = await analyze(s, ans.text, { question: q.q, questionIssue: q.issue }); out = pressAnswer(s, G.rnd, q, ans.text, a2, false); }
    answers.push({ ...out, noComment: !!ans.noComment, q: q.q });
    toast(out.note, out.delta > 0 ? 'good' : out.delta < 0 ? 'bad' : '');
  }
  const sum = pressSummary(s, G.rnd, issue, { ...an, text: r.text }, answers);
  save(); ui.render();
  await info(sum.good ? '📰 Bra genomslag' : '📰 Det blev inte som tänkt', `<p><b>Rubriken i morgon:</b> "${esc(sum.headline)}"</p><ul>${answers.map((x) => `<li><small class="muted">${esc(x.q.slice(0, 80))}</small><br>${esc(x.note)} <b class="${x.delta > 0 ? 'ok' : x.delta < 0 ? 'danger' : ''}">${x.delta > 0 ? '+' : ''}${x.delta}</b></li>`).join('')}</ul>${rec.contradictions.length ? `<p class="danger">Journalisterna noterade: ${esc(rec.contradictions[0])}</p>` : ''}${an.promises?.length ? `<p class="muted">Löften som registrerades: ${an.promises.map((x) => esc(x.text.slice(0, 80))).join(' · ')}</p>` : ''}`);
}

// ---------- TAL ----------
export async function speechFlow(a, run, ui) {
  const s = G.state; const p = me(); const l = leader();
  const ri = await choice({ title: a.name, text: 'Vart reser du?', choices: REGIONS.map((r) => ({ label: r.name, desc: `${r.pop} tusen inv.` })), wide: true });
  const region = REGIONS[ri];
  const hot = [...ISSUES].sort((x, y) => s.opinion.salience[y.id] - s.opinion.salience[x.id]).slice(0, 2);
  const r = await textDialog({ title: `🚌 Tal i ${region.name}`, intro: `Skriv talet. Publiken reagerar mening för mening: kämpaglöd, känsla och konkreta löften lyfter – långa meningar, floskler och felaktiga siffror sänker. Att nämna <b>${esc(region.name)}</b> hjälper.`, placeholder: `Kära vänner i ${region.name}! …`, rows: 9, maxlength: 2400, ctx: ctxFor(), okLabel: `Håll talet (${a.ap} AP)`, suggestions: [{ label: 'Hemma hos er', text: `Kära vänner i ${region.name}! Det är här, inte i Stockholm, som Sverige avgörs. Jag har lyssnat på er. Ni är trötta på ${hot[0].name.toLowerCase()} som ingen gör något åt. Vi ska ändra på det. Vi lovar att … Och vi börjar här.` }, { label: 'Vi mot dem', text: `De andra partierna har haft sin chans. Vad fick ni? Ingenting. Nu räcker det. Vi tar strid för ${hot[1].name.toLowerCase()} och för ${region.name}. Tillsammans vinner vi.` }] });
  if (!r) return;
  busyToast();
  const an = await analyze(s, r.text, {});
  const reactions = speechReactions(s, G.rnd, r.text, an, region);
  // uppspelning: meningarna visas en i taget med publikens reaktion
  await new Promise((res) => {
    const body = h('div', {}); body.innerHTML = `<div class="speech" id="sp"></div><div class="meterline"><span>Publiken</span><div class="bar"><i id="smeter" style="width:50%"></i></div><b id="sval">0</b></div>`;
    const m = modal({ title: `Talet i ${region.name}`, body, wide: true, closable: false, buttons: [{ label: 'Fortsätt', cls: 'gold', onClick: res, disabled: true }] });
    const sp = body.querySelector('#sp'); let acc = 0; let i = 0;
    const step = () => { if (i >= reactions.lines.length) { m.el.querySelector('.mf .btn').disabled = false; return; } const ln = reactions.lines[i++]; acc += ln.v; const cls = ln.v > 1 ? 'good' : ln.v < -.5 ? 'bad' : ''; sp.insertAdjacentHTML('beforeend', `<div class="line ${cls}"><div>${esc(ln.s)}</div><small>${ln.v > 1 ? '👏' : ln.v < -.5 ? '😐' : '…'} ${esc(ln.react)}</small></div>`); sp.scrollTop = sp.scrollHeight; const v = clamp(acc * 4, -50, 50); body.querySelector('#smeter').style.width = `${50 + v}%`; body.querySelector('#sval').textContent = fmt(acc, 1); setTimeout(step, 650); };
    step();
  });
  const out = speechOutcome(s, G.rnd, region.id, r.text, reactions);
  run({ region: region.id, text: r.text, mult: out.mult });
  save(); ui.render();
  await info(reactions.score > 20 ? '🔥 Publiken jublade' : reactions.score < -15 ? '😬 Talet föll platt' : 'Talet är hållet', `<p>${fmt(out.crowd)} personer kom. Publikens betyg: <b>${fmt(reactions.score, 0)}</b> (−60…60). Effekten i ${esc(region.name)} ${out.mult > 1.2 ? 'förstärks' : out.mult < .8 ? 'försvagas' : 'är normal'} (×${out.mult.toFixed(2)}).</p>${out.contradictions.length ? `<p class="danger">${esc(out.contradictions[0])}</p>` : ''}${an.promises?.length ? `<p class="muted">Löften i talet registrerades: ${an.promises.map((x) => esc(x.text.slice(0, 70))).join(' · ')}</p>` : ''}`);
}

// ---------- ENSKILDA SAMTAL ----------
export async function talkFlow(a, run, ui) {
  const s = G.state; const p = me(); const l = leader();
  const leaders = activeParties(s).filter((q) => !q.isPlayer).map((q) => ({ kind: 'leader', party: q, label: `${s.people[q.leader].name} (${q.abbr})`, desc: `partiledare · relation ${q.relations?.[p.id] || 0}` }));
  const own = (p.people || []).map((id) => s.people[id]).filter((x) => x && x.alive).map((per) => ({ kind: 'person', person: per, label: per.name, desc: `${per.ministry ? MINISTRIES.find((m) => m.id === per.ministry)?.name : 'partikamrat'} · lojalitet ${fmt(per.loyalty ?? 60, 0)} · ambition ${per.ambition}` }));
  const journ = Object.values(s.journalists || {}).slice(0, 6).map((j) => ({ kind: 'journalist', journalist: j, label: `${j.name}`, desc: `${MEDIA[j.outlet]?.name || j.outlet} · off record · relation ${fmt(j.rel, 0)}` }));
  const all = [...leaders, ...own, ...journ];
  const i = await choice({ title: '☕ Vem pratar du med?', text: 'Ett enskilt samtal. Det du säger stannar oftast i rummet. Oftast.', choices: all.map((x) => ({ label: x.label, desc: x.desc })), wide: true });
  const target = all[i];
  const other = target.kind === 'leader' ? s.people[target.party.leader] : target.kind === 'person' ? target.person : s.people[target.journalist.personId];
  const transcript = [];
  let totalDelta = 0, lastNote = '', leaked = false;
  for (let round = 1; round <= 2; round++) {
    const tr = h('div', { class: 'chat' }); tr.innerHTML = `<div class="minister"><div class="av">${other ? characterArt(other, { crop: 'face', id: 'talk' }) : ''}</div><div><b>${esc(target.label)}</b><br><small class="muted">${esc(target.desc)}</small></div></div>${transcript.map((t) => `<div class="msg ${t.mine ? 'mine' : ''}"><b>${esc(t.who)}</b><div>${esc(t.text)}</div></div>`).join('')}`;
    const r = await textDialog({ title: round === 1 ? 'Samtalet börjar' : 'Samtalet fortsätter', placeholder: round === 1 ? 'Vad säger du?' : 'Och sedan?', rows: 3, maxlength: 600, ctx: ctxFor(), okLabel: round === 1 ? 'Säg det' : 'Säg det och avsluta', cancelLabel: round === 1 ? 'Avbryt' : 'Avsluta samtalet', before: tr });
    if (!r) { if (round === 1) return; break; }
    busyToast();
    const an = await analyze(s, r.text, {});
    transcript.push({ who: l.name, text: r.text, mine: true });
    const out = await privateTalk(s, G.rnd, target, r.text, an, round);
    transcript.push({ who: other?.name || target.label, text: out.reply });
    totalDelta += out.delta; lastNote = out.note; if (out.leak) leaked = true;
    if (round === 2) { const tr2 = h('div', { class: 'chat' }); tr2.innerHTML = transcript.map((t) => `<div class="msg ${t.mine ? 'mine' : ''}"><b>${esc(t.who)}</b><div>${esc(t.text)}</div></div>`).join(''); await info('Samtalet', tr2.outerHTML); }
  }
  run({ party: target.kind === 'leader' ? target.party.id : null, note: `${lastNote}${leaked ? ' Något av det du sa läckte.' : ''}` });
  save(); ui.render();
}

// ---------- UTSPEL ----------
export async function utspelFlow(a, run, ui) {
  const s = G.state;
  const sel = h('div', { class: 'field' }); sel.innerHTML = `<label>Fråga (eller låt spelet avgöra av texten)</label><select id="uissue"><option value="">Avgörs av texten</option>${ISSUES.map((is) => `<option value="${is.id}">${esc(is.name)}</option>`).join('')}</select>`;
  const r = await textDialog({ title: '📣 Politiskt utspel', intro: 'Skriv förslaget med egna ord. Konkreta siffror ("200 000 nya bostäder", "sänk skatten med 5 procent") blir löften som spelet följer upp. Vaga formuleringar flaggas av medierna.', placeholder: 'Vi föreslår att …', rows: 5, maxlength: 900, ctx: ctxFor(), okLabel: 'Gör utspelet (1 AP)', before: sel });
  if (!r) return;
  busyToast();
  const an = await analyze(s, r.text, {});
  run({ text: r.text, analysis: an, issue: sel.querySelector('select').value || null });
}

// ---------- FOKUSGRUPP ----------
export async function fokusFlow(a, run, ui) {
  const s = G.state;
  const r = run({});
  if (r && r.ok === false) return;
  const fg = focusGroup(s, G.rnd);
  await info('🧪 Fokusgruppen', `<p class="help">Rådgivaren samlade några väljare i ett rum. Så här uppfattar de er${fg.persona ? ` – och ${esc(leader().first)} framstår som <b>${esc(fg.persona)}</b>` : ''}.</p>${fg.groups.map((g) => `<div class="item"><div class="top"><b>${esc(g.seg.name)}</b><span class="tag ${g.like > .2 ? 'green' : g.like < -.2 ? 'red' : ''}">stöd ${fmt(g.support, 1)} %</span></div>${g.lines.map((x) => `<div style="font-size:13px">${esc(x)}</div>`).join('')}<div class="meta">bryr sig om: ${g.care.map(esc).join(', ')}</div></div>`).join('')}<h4 style="margin-top:10px">Rådgivarens slutsatser</h4><ul>${fg.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`);
}

// ---------- FRAMGRÄVT UTTALANDE ----------
export async function statementDialog(item, ui) {
  const s = G.state; const p = me(); const l = leader();
  const st = (s.memory?.statements || []).find((x) => x.id === item.id); if (!st) return;
  const j = Object.values(s.journalists || {})[0];
  const i = await choice({ title: '🗞️ Ett gammalt uttalande dyker upp', text: `<p>${esc(j?.name || 'En journalist')} ringer: "Vecka ${st.week} ${st.kind === 'post' ? 'skrev' : 'sa'} ni i ${esc(statementKindLabel(st.kind))}: <i>"${esc(st.text.slice(0, 220))}"</i>. ${st.deleted ? 'Inlägget är raderat men vi har skärmdumpen. ' : ''}Står ni fast vid det?"</p>`, choices: [{ label: 'Svara – skriv vad du säger', cls: 'gold' }, { label: 'Ingen kommentar', desc: 'Tystnad tolkas som att du skäms. Liten skandal.' }] });
  if (i === 1) { p.risk = (p.risk || 0) + 4; p.trust = clamp((p.trust ?? 50) - 2, 0, 100); addNews(s, { outlet: 'expressen', headline: `${l.name} vägrar kommentera gammalt uttalande: "${st.text.slice(0, 40)}…"`, body: `${p.abbr} svarar inte på frågor om uttalandet från vecka ${st.week}.`, tags: ['skandal'], partyId: p.id, importance: 2, tone: -1 }); save(); return; }
  const r = await textDialog({ title: 'Ditt svar till journalisten', intro: `Står du fast, nyanserar du, eller tar du tillbaka? Spelet jämför med vad du sa då.`, placeholder: 'Jag står fast vid … / Jag uttryckte mig olyckligt …', rows: 4, maxlength: 600, ctx: ctxFor(st.text), okLabel: 'Svara', closable: false, cancelLabel: 'Ingen kommentar' });
  if (!r) { p.risk = (p.risk || 0) + 3; save(); return; }
  busyToast();
  const an = await analyze(s, r.text, { question: st.text });
  const rec = recordStatement(s, r.text, 'press', { question: st.text, analysis: an });
  const retract = /tar tillbaka|ber om ursäkt|olyckligt|hade fel|ångrar|förlåt|uttryckte mig/.test(r.text.toLowerCase());
  const flipped = Object.keys(an.stance || {}).some((id) => st.stance?.[id] != null && Math.sign(st.stance[id]) !== Math.sign(an.stance[id]));
  let head, body, tone = 0;
  if (retract) { p.trust = clamp((p.trust ?? 50) + 1, 0, 100); p.credibility = clamp(p.credibility - 1.5, 0, 100); head = `${l.name} tar tillbaka: "${r.text.slice(0, 50)}…"`; body = `Uttalandet från vecka ${st.week} dras tillbaka. ${an.dominant === 'kansla' ? 'Ursäkten uppfattas som uppriktig.' : 'Kritiker: "Bara för att det blev avslöjat."'}`; }
  else if (flipped && !retract) { p.credibility = clamp(p.credibility - 4, 0, 100); p.trust = clamp((p.trust ?? 50) - 3, 0, 100); head = `${l.name} byter fot – igen`; body = `Vecka ${st.week} ett, i dag något annat. "Vilken ${l.first} ska väljarna tro på?", frågar ledarsidorna.`; tone = -1; }
  else if (an.dominant === 'aggressiv') { p.risk = (p.risk || 0) + 6; head = `${l.name} rasar mot journalist: "${r.text.slice(0, 50)}…"`; body = `Frågan gällde ett gammalt uttalande. Svaret blev ett angrepp på medierna.`; tone = -1; }
  else { p.trust = clamp((p.trust ?? 50) + 2, 0, 100); p.credibility = clamp(p.credibility + 1, 0, 100); head = `${l.name} står fast: "${r.text.slice(0, 50)}…"`; body = `Uttalandet från vecka ${st.week} står kvar. ${an.clarity > .6 ? 'Ett tydligt besked, enligt kommentatorer.' : 'Svaret var svävande, men linjen är densamma.'}`; tone = 1; }
  addNews(s, { outlet: j?.outlet || 'svt', headline: head, body, tags: ['politik'], partyId: p.id, importance: 2, tone });
  save();
  await info('Så blev det', `<p>${esc(body)}</p>${rec.contradictions.length ? `<p class="danger">${esc(rec.contradictions[0])}</p>` : ''}`);
}

// ---------- AI-INSTÄLLNINGAR ----------
export function aiSettingsDialog() {
  const st = llmSettings();
  const body = h('div', {});
  body.innerHTML = `<p class="help">Spelet läser det du skriver med en inbyggd, regelbaserad analys som fungerar utan nätverk. Lägger du in en egen Anthropic-nyckel analyserar <b>Claude</b> dina texter i stället och skriver repliker åt journalister, motståndare och väljare – betydligt vassare. Nyckeln sparas bara i din webbläsare och anropen går direkt till Anthropic från din dator; du betalar själv för användningen (några ören per replik).</p>
    <div class="field"><label><input type="checkbox" id="en" ${st.enabled ? 'checked' : ''}> Använd Claude</label></div>
    <div class="field"><label>API-nyckel</label><input type="password" id="key" value="${esc(st.key || '')}" placeholder="sk-ant-…"></div>
    <div class="field"><label>Modell</label><select id="model">${MODELS.map((m) => `<option value="${m.id}" ${st.model === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
    <div id="res" class="help"></div>
    <hr style="border:0;border-top:1px solid var(--line);margin:12px 0">
    <p class="help"><b>Smart analys på enheten</b> – utan nyckel och utan kostnad: en liten språkmodell (multilingual-e5-small, ~118 MB, laddas en gång och cachas av webbläsaren) körs lokalt och förstår fria formuleringar betydligt bättre än den inbyggda matchningen. Fungerar på dator och nyare mobiler.</p>
    <div class="field"><label><input type="checkbox" id="smart" ${st.smart ? 'checked' : ''}> Använd smart analys på enheten</label></div>
    <div id="smartRes" class="help">${smartStatus().state === 'klar' ? '<span class="ok">Modellen är laddad.</span>' : smartStatus().state === 'laddar' ? `Laddar… ${smartStatus().progress || 0} %` : ''}</div>`;
  const readIn = () => ({ enabled: body.querySelector('#en').checked, key: body.querySelector('#key').value.trim(), model: body.querySelector('#model').value, smart: body.querySelector('#smart').checked });
  body.querySelector('#smart').addEventListener('change', (e) => { if (!e.target.checked) return; saveLlmSettings({ ...llmSettings(), ...readIn() }); const res = body.querySelector('#smartRes'); loadSmart((s) => { res.innerHTML = s.state === 'klar' ? '<span class="ok">Modellen är laddad – smart analys används.</span>' : s.state === 'fel' ? `<span class="danger">Kunde inte ladda: ${esc(s.error || '')}</span>` : `Laddar… ${s.progress || 0} %${s.file ? ' (' + esc(s.file) + ')' : ''}`; }).catch(() => {}); });
  modal({ title: '🤖 AI-läge (Claude)', body, buttons: [{ label: 'Testa nyckeln', close: false, onClick: async (btn) => { saveLlmSettings({ ...readIn(), enabled: true }); resetClient(); btn.disabled = true; body.querySelector('#res').textContent = 'Testar…'; try { await llmPing(); body.querySelector('#res').innerHTML = '<span class="ok">Fungerar!</span>'; } catch (e) { body.querySelector('#res').innerHTML = `<span class="danger">Misslyckades: ${esc(e.message)}</span>`; } btn.disabled = false; return false; } }, { label: 'Spara', cls: 'gold', onClick: () => { saveLlmSettings(readIn()); resetClient(); toast(readIn().enabled && readIn().key ? 'Claude-läget är på.' : 'Inbyggd analys används.'); } }] });
}
