// Debattscenen – visual novel-läge i rättegångsspelens anda: två figurer, textruta med
// skrivmaskinstext, fritt svar i egen text (med förslag att utgå från), "INVÄNDNING!" med
// skakning och blixt, följdfrågor, avbrott och mätare över publiken.
import { h, esc, fmt } from '../core/util.js';
import { characterArt } from '../art/sprites.js';
import { backgroundSVG } from '../art/backgrounds.js';
import { buildDebate, resolveOption, resolveFree, finishDebate, addGaffe } from '../sim/debate.js';
import { moodLabel, moodExpr } from '../sim/emotion.js';
import { ISSUE_BY_ID } from '../data/issues.js';
import { MEDIA } from '../data/names.js';
import { save } from '../core/state.js';
import { analyze, followUp, opponentReply } from '../ai/generate.js';
import { analyzeText, toneLabel } from '../ai/analyze.js';
import { llmEnabled } from '../ai/llm.js';

// --- ljud (syntetiserat, inga filer) ---
let actx = null;
function beep(freq = 440, dur = .05, type = 'square', gain = .05) {
  try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = gain; o.connect(g); g.connect(actx.destination); o.start(); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + dur); o.stop(actx.currentTime + dur); } catch { /* ljud av */ }
}
function sting(kind) {
  if (kind === 'objection') { beep(180, .25, 'sawtooth', .12); setTimeout(() => beep(120, .35, 'sawtooth', .12), 80); }
  else if (kind === 'win') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .18, 'triangle', .08), i * 90)); }
  else if (kind === 'lose') { [392, 349, 311, 262].forEach((f, i) => setTimeout(() => beep(f, .22, 'triangle', .07), i * 120)); }
  else if (kind === 'slam') { beep(90, .2, 'square', .14); }
}
// Rådgivarens förhandsbedömning av det du skrivit (kan ha fel – den regelbaserade analysen är grov)
export function adviserLine(text, ctx = {}) {
  if (!text.trim()) return '';
  const a = analyzeText(text, ctx);
  const bits = [`låter ${toneLabel(a.dominant)}`];
  if (a.keywords.length) bits.push(a.keywords.slice(0, 3).join(', '));
  if (a.promises.length) bits.push(`${a.promises.length} löfte${a.promises.length > 1 ? 'n' : ''}${a.promises.some((p) => p.number != null) ? ' med siffror' : ''}`);
  if (a.claims.length) bits.push(a.claims.some((c) => c.ok === false) ? '⚠️ en siffra ser fel ut' : 'siffror som stämmer');
  if (a.attacks.length) bits.push('angrepp');
  if (a.vague) bits.push('vagt');
  if (ctx.question) bits.push(a.answers > .6 ? 'svarar på frågan' : a.answers < .35 ? 'svarar inte på frågan' : 'svarar delvis');
  bits.push(`risk ${a.risky} %`);
  return 'Rådgivaren: ' + bits.join(' · ');
}

export function runDebate(state, rnd, opts) {
  return new Promise((resolve) => {
    const d = buildDebate(state, rnd, opts);
    const me = state.parties[state.player.partyId]; const ml = state.people[me.leader];
    const opP = d.opponentParty ? state.parties[d.opponentParty] : null;
    const op = d.opponent;
    const myPitch = ({ ljus: 1.25, mork: .7, hes: .85, mjuk: 1.0, skarp: 1.1 })[ml.persona?.voice] || 1;
    const bg = d.kind === 'riksdag' ? 'riksdag' : d.kind === 'interview' ? 'intervju' : d.kind === 'podd' ? 'kansli' : 'tv';
    const root = document.getElementById('scene');
    const aa = h('div', { class: 'aa' });
    aa.innerHTML = `<div class="stage"><div class="view">
      <div class="bg">${backgroundSVG(bg)}</div>
      <div class="char left" id="cl"></div>
      <div class="char right" id="cr"></div>
      <div class="topic" id="topic"></div>
      <div class="meter"><div class="lbl"><span>${esc(opP ? opP.abbr : d.kind === 'podd' ? 'Lyssnarna' : 'Journalisten')}</span><span>${d.kind === 'podd' ? 'LYSSNARNA' : 'PUBLIKEN'}</span><span>${esc(me.abbr)}</span></div><div class="track"><i id="meter"></i></div></div>
      <button class="btn sm skip" id="skip">Hoppa över ⏩</button>
      <div class="moodchip" id="mood" style="display:none"></div>
      <div class="textbox" id="tb"><div class="name" id="nm"></div><div class="txt" id="txt"></div><div class="next" id="nx">▼</div></div>
      <div class="choices" id="ch" style="display:none"></div>
    </div></div>`;
    root.append(aa);
    const view = aa.querySelector('.view'), cl = aa.querySelector('#cl'), cr = aa.querySelector('#cr'), tb = aa.querySelector('#tb'), nm = aa.querySelector('#nm'), txt = aa.querySelector('#txt'), nx = aa.querySelector('#nx'), ch = aa.querySelector('#ch'), meterEl = aa.querySelector('#meter'), topicEl = aa.querySelector('#topic');
    const setChar = (side, person, expr, pose, talking = false) => { const el = side === 'left' ? cl : cr; el.innerHTML = characterArt(person, { expr, pose, talking, id: side }); if (side === 'right') el.firstElementChild.style.transform = 'scaleX(-1)'; };
    const setMeter = () => { const m = d.meter; meterEl.className = m < 0 ? 'neg' : ''; meterEl.style.left = m < 0 ? `${50 + m / 2}%` : '50%'; meterEl.style.width = `${Math.abs(m) / 2}%`; };
    const moodEl = aa.querySelector('#mood');
    const updateMood = () => { const l = moodLabel(d.mood); moodEl.style.display = l.level ? '' : 'none'; moodEl.textContent = l.level ? `${l.emoji} ${op.first || op.name}: ${l.label}` : ''; };
    setMeter(); updateMood();
    let skipAll = false, typing = null, waiting = null;
    aa.querySelector('#skip').addEventListener('click', () => { skipAll = true; if (waiting) waiting(); });
    // skrivmaskin
    const say = (side, person, text, { expr = 'neutral', pose = 'stand', dim = true } = {}) => new Promise((res) => {
      nm.textContent = person ? person.name : ''; nm.className = 'name ' + side; nm.style.display = person ? '' : 'none';
      if (side === 'left') { setChar('left', person, expr, pose, true); cr.classList.toggle('dim', dim); cl.classList.remove('dim'); }
      else if (side === 'right') { setChar('right', person, expr, pose, true); cl.classList.toggle('dim', dim); cr.classList.remove('dim'); }
      txt.textContent = ''; nx.style.display = 'none';
      let i = 0; const full = text;
      const finishTyping = () => { clearInterval(typing); typing = null; txt.textContent = full; nx.style.display = ''; if (side === 'left') setChar('left', person, expr, pose, false); else if (side === 'right') setChar('right', person, expr, pose, false); };
      if (skipAll) { finishTyping(); return res(); }
      typing = setInterval(() => { i += 2; txt.textContent = full.slice(0, i); if (i % 6 === 0 && full[i] !== ' ') beep((side === 'left' ? 440 * (myPitch) : 330), .025, 'square', .02); if (i >= full.length) { finishTyping(); } }, 22);
      const onClick = () => { if (typing) { finishTyping(); return; } tb.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); waiting = null; res(); };
      const onKey = (e) => { if (e.target && e.target.tagName === 'TEXTAREA') return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onClick(); } };
      waiting = () => { tb.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); if (typing) finishTyping(); waiting = null; res(); };
      tb.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
    });
    const burst = (text, cls = '') => new Promise((res) => { const b = h('div', { class: 'burst' }, h('span', { class: cls }, text)); view.append(b); aa.classList.add('shake'); sting(cls === 'blue' ? 'slam' : 'objection'); setTimeout(() => { aa.classList.remove('shake'); }, 500); setTimeout(() => { b.remove(); res(); }, skipAll ? 50 : 1100); });
    const flash = () => { const f = h('div', { class: 'whiteflash' }); view.append(f); setTimeout(() => f.remove(), 400); };
    // Fritt svar: textruta + förslag att utgå från + särskilda knappar (INVÄNDNING!, Ingen kommentar)
    const compose = (r, { prompt = 'Ditt svar', short = false } = {}) => new Promise((res) => {
      ch.innerHTML = ''; ch.style.display = '';
      const inv = (r.options || []).filter((o) => o.type === 'invandning');
      const sugg = (r.options || []).filter((o) => o.type !== 'invandning');
      const box = h('div', { class: 'composer' });
      box.innerHTML = `<div class="ctitle">${esc(prompt)} <small>${llmEnabled() ? 'Claude läser det du skriver' : 'spelet läser det du skriver'} · Ctrl+Enter skickar</small></div>
        <textarea id="reply" rows="${short ? 2 : 4}" maxlength="${short ? 220 : 900}" placeholder="${short ? 'Kort replik…' : 'Skriv med egna ord – fakta, känsla, angrepp, skämt, löften… allt räknas.'}"></textarea>
        <div class="adviser" id="adv"></div>
        <div class="sugg" id="sugg">${sugg.length ? '<small>Förslag att utgå från:</small>' : ''}${sugg.map((o, i) => `<span class="chip" data-i="${i}" title="${esc(o.text)}">${esc(o.label)}</span>`).join('')}</div>
        <div class="row" style="justify-content:flex-end;gap:8px">${inv.length ? `<button class="btn obj" id="objBtn">INVÄNDNING!</button>` : ''}${(r.interview || r.podd) ? '<button class="btn" id="noc">Ingen kommentar</button>' : ''}<button class="btn gold" id="send">Svara ▶</button></div>`;
      ch.append(box);
      const ta = box.querySelector('#reply'); const adv = box.querySelector('#adv');
      const ctx = { stats: state.sweden.stats, parties: Object.values(state.parties).filter((q) => q.active !== false && !q.isPlayer), question: r.statement, questionIssue: r.issue };
      let tmr = null;
      ta.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { adv.textContent = adviserLine(ta.value, ctx); }, 250); });
      ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send(); } e.stopPropagation(); });
      box.querySelector('#sugg').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; ta.value = sugg[+c.dataset.i].text; ta.dispatchEvent(new Event('input')); ta.focus(); });
      const finish = (v) => { ch.style.display = 'none'; ch.innerHTML = ''; res(v); };
      const send = () => { const t = ta.value.trim() || 'Eh… ja. Alltså. Det är en bra fråga, och vi återkommer om det.'; box.querySelector('#send').disabled = true; box.querySelector('#send').textContent = 'Läser…'; finish({ text: t }); };
      box.querySelector('#send').addEventListener('click', send);
      if (inv.length) box.querySelector('#objBtn').addEventListener('click', () => finish({ option: (r.options || []).indexOf(inv[0]) }));
      if (r.interview || r.podd) box.querySelector('#noc').addEventListener('click', () => finish({ text: 'Ingen kommentar. Nästa fråga.', noComment: true }));
      setTimeout(() => ta.focus(), 50);
    });
    const showEvidence = (text) => { const e = h('div', { class: 'evidence' }); e.innerHTML = `<b>Bevis</b>${esc(text)}`; view.append(e); setTimeout(() => e.remove(), skipAll ? 100 : 4000); };
    const expFor = (dom) => ({ aggressiv: 'angry', kansla: 'determined', humor: 'happy', undvikande: 'nervous', kampande: 'confident', saklig: 'confident' })[dom] || 'confident';

    (async () => {
      setChar('left', ml, 'neutral', 'stand'); setChar('right', op, 'neutral', d.kind === 'interview' ? 'think' : d.kind === 'podd' ? 'open' : 'cross');
      cl.classList.add('enter-left'); cr.classList.add('enter-right');
      topicEl.innerHTML = `${esc(d.name)}<small>${d.campaign ? 'VALRÖRELSE · ' : ''}${esc(d.kind === 'podd' ? 'Inspelning' : d.host === 'riksdag' ? 'Riksdagens kammare' : MEDIA[d.host]?.name || 'TV-studion')}</small>`;
      const mod = d.kind === 'interview' || d.kind === 'podd' ? op : { name: d.kind === 'riksdag' ? 'Talmannen' : 'Programledaren' };
      await say(null, mod, d.kind === 'podd' ? `Hej hej, välkomna till ${op.name}! I dag har vi med oss ${ml.name} från ${me.name}. Luta er tillbaka.` : d.kind === 'interview' ? `Välkommen till ${MEDIA[d.host]?.name || 'studion'}. I kväll frågar vi ut ${ml.name}, partiledare för ${me.name}.` : d.kind === 'riksdag' ? `Kammaren inleder partiledardebatten. Ordet går till ${op.name}, ${opP.name}.` : `Välkomna till ${d.name}! I kväll möts ${ml.name} (${me.abbr}) och ${op.name} (${opP.abbr}).`, { dim: false });
      const j = d.journalistId ? state.journalists[d.journalistId] : null;
      // En runda: motståndaren talar → du skriver → utfall → ev. följdfråga/avbrott
      const playRound = async (r, i, total, label) => {
        const is = ISSUE_BY_ID[r.issue];
        topicEl.innerHTML = `${label || `Runda ${i + 1}/${total}`}: ${esc(is.name)}<small>${esc(d.name)}</small>`;
        // en upprörd eller nervös motståndare gör fler misstag – ibland en siffra som går att avslöja
        if (!r.gaffe && !r.interview && !r.podd && !r.interrupt && !r.followed && d.gaffeBoost && rnd() < d.gaffeBoost) addGaffe(state, rnd, r, op);
        const mx = moodExpr(d.mood, r.podd ? 'happy' : r.interrupt ? 'angry' : r.interview ? 'neutral' : r.opExpr, r.podd ? 'open' : r.interrupt ? 'point' : r.interview ? 'think' : i % 2 ? 'point' : 'cross');
        await say('right', op, r.statement, { expr: mx.expr, pose: mx.pose });
        const ans = await compose(r, { prompt: r.interrupt ? 'Snabb replik' : r.followed ? 'Följdfrågan' : 'Ditt svar', short: !!r.interrupt });
        let out;
        if (ans.option != null) {
          const o = r.options[ans.option];
          await burst('INVÄNDNING!'); flash(); if (o.evidence) showEvidence(o.evidence);
          out = resolveOption(state, rnd, d, d.rounds.indexOf(r), ans.option);
          await say('left', ml, o.text, { expr: 'objection', pose: out.myPose });
        } else {
          const a = await analyze(state, ans.text, { question: r.statement, questionIssue: r.issue, opponentPartyId: opP?.id || null, counterpart: op.name });
          if (ans.noComment) { a.dominant = 'undvikande'; a.answers = 0; }
          out = resolveFree(state, rnd, d, d.rounds.indexOf(r), ans.text, a);
          if (out.caught) { await burst('INVÄNDNING!'); flash(); if (out.evidence) showEvidence(out.evidence); }
          else if (a.dominant === 'aggressiv') await burst('VÄNTA LITE!', 'blue');
          await say('left', ml, ans.text, { expr: out.caught ? 'objection' : expFor(a.dominant), pose: out.myPose });
          // motståndarens/journalistens svar skrivs utifrån vad du faktiskt sa
          if (!r.interview && !r.podd && opP && !out.moodEff?.outburst && !out.moodEff?.breakdown && !out.moodEff?.concede) { const rep = await opponentReply(state, rnd, { opponentParty: opP, opponent: op, playerText: ans.text, analysis: { ...a, contradictions: out.contradictions }, issue: r.issue, statement: r.statement, mood: out.mood, moodRaw: d.mood }); if (rep) out.reply = rep; }
          else { const fu = await followUp(state, rnd, { question: r.statement, answer: ans.text, analysis: { ...a, contradictions: out.contradictions }, journalist: j, issue: r.issue, kind: d.kind }); if (fu) out.reply = fu; }
        }
        setMeter(); updateMood();
        if (out.ok && out.delta > 15) { flash(); sting('win'); } else if (!out.ok) sting('lose');
        if (out.moodEff?.outburst) { await burst('UTBROTT!', 'blue'); } else if (out.moodEff?.breakdown) sting('lose');
        await say('right', op, out.reply, { expr: out.opExpr, pose: out.opPose });
        const extra = (out.contradictions?.length ? ` Motsägelse noterad: ${out.contradictions[0]}` : out.wrongClaims ? ' En siffra var fel – det blir en faktakoll.' : '') + (out.moodNote ? ` ${out.moodNote}` : '') + (out.audienceDelta ? ` (publiken ${out.audienceDelta > 0 ? '+' : ''}${fmt(out.audienceDelta, 0)})` : '');
        await say(null, { name: out.ok ? '✓ ' + out.narration : '✗ ' + out.narration }, (out.ok ? `Poäng till ${me.abbr}. (${out.delta > 0 ? '+' : ''}${fmt(out.delta, 0)})` : `Det där gick inte hem. (${fmt(out.delta, 0)})`) + extra, { dim: false });
        // följdfråga (intervju/podd) eller avbrott (debatt)
        if (out.followUp && !skipAll) {
          const fr = { issue: r.issue, statement: out.reply, interview: r.interview, podd: r.podd, options: (r.options || []).filter((o) => o.type !== 'invandning').slice(0, 3), followed: true, resolved: false };
          d.rounds.splice(d.rounds.indexOf(r) + 1, 0, fr);
          await playRound(fr, i, total, `Följdfråga`);
        } else if (out.interrupt && !skipAll) {
          const ir = { issue: r.issue, statement: pick(rnd, [`Nej, nu får du ge dig! ${out.reply}`, `Får jag avbryta? Svara bara ja eller nej: är ni för eller emot?`, `Ursäkta – men vad är ert KONKRETA förslag? En mening.`]), interrupt: true, options: [], resolved: false };
          d.rounds.splice(d.rounds.indexOf(r) + 1, 0, ir);
          await playRound(ir, i, total, 'Avbrott');
        }
      };
      const base = d.rounds.slice();
      for (let i = 0; i < base.length; i++) await playRound(base[i], i, base.length);
      const res = finishDebate(state, rnd, d);
      save();
      sting(res.verdict === 'vann' ? 'win' : res.verdict === 'förlorade' ? 'lose' : 'slam');
      setChar('left', ml, res.verdict === 'vann' ? 'happy' : res.verdict === 'förlorade' ? 'sad' : 'neutral', res.verdict === 'vann' ? 'point' : 'stand'); cl.classList.remove('dim');
      setChar('right', op, res.verdict === 'vann' ? 'nervous' : res.verdict === 'förlorade' ? 'smug' : 'neutral', 'stand'); cr.classList.remove('dim');
      const tones = d.rounds.filter((r) => r.analysis).map((r) => r.analysis.dominant);
      const box = h('div', { class: 'result' });
      box.innerHTML = `<div class="box"><h2>${res.verdict === 'vann' ? '🏆 Du vann debatten!' : res.verdict === 'förlorade' ? '😓 Du förlorade debatten' : '🤝 Oavgjort'}</h2><p>Publikmätaren slutade på <b>${res.meter > 0 ? '+' : ''}${fmt(res.meter, 0)}</b>.${res.inv ? ` Du avslöjade ${res.inv} motsägelse${res.inv > 1 ? 'r' : ''} eller felaktig${res.inv > 1 ? 'a' : ''} siffr${res.inv > 1 ? 'or' : 'a'}!` : ''}</p>${res.opponentName && res.mood ? `<p>${esc(res.opponentName)} lämnade ${d.kind === 'interview' || d.kind === 'podd' ? 'studion' : 'debatten'} <b>${esc(res.mood.label)}</b> ${res.mood.emoji}.${res.moodEvents.some((e) => e.outburst) ? ' Utbrottet blir ett klipp – och ett agg.' : ''}${res.moodEvents.some((e) => e.breakdown) ? ' Sammanbrottet slår tillbaka mot dig.' : ''}${res.moodEvents.some((e) => e.concede) ? ' Hen gav dig rätt på en punkt.' : ''}</p>` : ''}${tones.length ? `<p class="muted">Din ton: ${tones.map(toneLabel).join(', ')}.${d.rounds.some((r) => r.analysis?.contradictions) ? ' Journalisterna noterade motsägelser mot vad du sagt tidigare.' : ''}${d.rounds.some((r) => r.analysis?.promises) ? ' Nya löften har registrerats – de följs upp.' : ''}</p>` : ''}<p class="muted">${res.verdict === 'vann' ? 'Partiledarens stöd, partiets uppmärksamhet och opinionen bland dem som bryr sig om frågorna stärks.' : res.verdict === 'förlorade' ? 'Medierna skriver om en svag insats. Opinionen tappar något.' : 'Ingen avgörande effekt – men du syntes.'}</p><button class="btn gold big" id="ok">Fortsätt</button></div>`;
      view.append(box);
      box.querySelector('#ok').addEventListener('click', () => { aa.remove(); resolve(res); });
    })();
  });
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
