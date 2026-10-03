// Debattscenen – visual novel-läge i rättegångsspelens anda: två figurer, textruta med
// skrivmaskinstext, argumentval, "INVÄNDNING!" med skakning och blixt, mätare över publiken.
import { h, esc, fmt } from '../core/util.js';
import { characterSVG } from '../art/character.js';
import { backgroundSVG } from '../art/backgrounds.js';
import { buildDebate, resolveOption, finishDebate } from '../sim/debate.js';
import { ISSUE_BY_ID } from '../data/issues.js';
import { MEDIA } from '../data/names.js';
import { save } from '../core/state.js';

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

export function runDebate(state, rnd, opts) {
  return new Promise((resolve) => {
    const d = buildDebate(state, rnd, opts);
    const me = state.parties[state.player.partyId]; const ml = state.people[me.leader];
    const opP = d.opponentParty ? state.parties[d.opponentParty] : null;
    const op = d.opponent;
    const bg = d.kind === 'riksdag' ? 'riksdag' : d.kind === 'interview' ? 'intervju' : 'tv';
    const root = document.getElementById('scene');
    const aa = h('div', { class: 'aa' });
    aa.innerHTML = `<div class="stage"><div class="view">
      <div class="bg">${backgroundSVG(bg)}</div>
      <div class="char left" id="cl"></div>
      <div class="char right" id="cr"></div>
      <div class="topic" id="topic"></div>
      <div class="meter"><div class="lbl"><span>${esc(opP ? opP.abbr : 'Journalisten')}</span><span>PUBLIKEN</span><span>${esc(me.abbr)}</span></div><div class="track"><i id="meter"></i></div></div>
      <button class="btn sm skip" id="skip">Hoppa över ⏩</button>
      <div class="textbox" id="tb"><div class="name" id="nm"></div><div class="txt" id="txt"></div><div class="next" id="nx">▼</div></div>
      <div class="choices" id="ch" style="display:none"></div>
    </div></div>`;
    root.append(aa);
    const view = aa.querySelector('.view'), cl = aa.querySelector('#cl'), cr = aa.querySelector('#cr'), tb = aa.querySelector('#tb'), nm = aa.querySelector('#nm'), txt = aa.querySelector('#txt'), nx = aa.querySelector('#nx'), ch = aa.querySelector('#ch'), meterEl = aa.querySelector('#meter'), topicEl = aa.querySelector('#topic');
    const setChar = (side, person, expr, pose, talking = false) => { const el = side === 'left' ? cl : cr; el.innerHTML = characterSVG(person, { expr, pose, talking, id: side }); if (side === 'right') el.firstElementChild.style.transform = 'scaleX(-1)'; };
    const setMeter = () => { const m = d.meter; meterEl.className = m < 0 ? 'neg' : ''; meterEl.style.left = m < 0 ? `${50 + m / 2}%` : '50%'; meterEl.style.width = `${Math.abs(m) / 2}%`; };
    setMeter();
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
      typing = setInterval(() => { i += 2; txt.textContent = full.slice(0, i); if (i % 6 === 0 && full[i] !== ' ') beep(side === 'left' ? 520 : 330, .025, 'square', .02); if (i >= full.length) { finishTyping(); } }, 22);
      const onClick = () => { if (typing) { finishTyping(); return; } tb.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); waiting = null; res(); };
      const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onClick(); } };
      waiting = () => { tb.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); if (typing) finishTyping(); waiting = null; res(); };
      tb.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
    });
    const burst = (text, cls = '') => new Promise((res) => { const b = h('div', { class: 'burst' }, h('span', { class: cls }, text)); view.append(b); aa.classList.add('shake'); sting(cls === 'blue' ? 'slam' : 'objection'); setTimeout(() => { aa.classList.remove('shake'); }, 500); setTimeout(() => { b.remove(); res(); }, skipAll ? 50 : 1100); });
    const flash = () => { const f = h('div', { class: 'whiteflash' }); view.append(f); setTimeout(() => f.remove(), 400); };
    const choose = (options) => new Promise((res) => {
      ch.innerHTML = ''; ch.style.display = '';
      options.forEach((o, i) => { const b = h('button', { class: 'btn ' + (o.type === 'invandning' ? 'obj' : '') }); b.innerHTML = `<span><span class="kind">${esc(o.label)}</span>${esc(o.text)}</span>`; b.addEventListener('click', () => { ch.style.display = 'none'; res(i); }); ch.append(b); });
    });
    const showEvidence = (text) => { const e = h('div', { class: 'evidence' }); e.innerHTML = `<b>Bevis</b>${esc(text)}`; view.append(e); setTimeout(() => e.remove(), skipAll ? 100 : 4000); };

    (async () => {
      setChar('left', ml, 'neutral', 'stand'); setChar('right', op, 'neutral', d.kind === 'interview' ? 'think' : 'cross');
      cl.classList.add('enter-left'); cr.classList.add('enter-right');
      topicEl.innerHTML = `${esc(d.name)}<small>${d.campaign ? 'VALRÖRELSE · ' : ''}${esc(d.host === 'riksdag' ? 'Riksdagens kammare' : MEDIA[d.host]?.name || 'TV-studion')}</small>`;
      const mod = d.kind === 'interview' ? op : { name: d.kind === 'riksdag' ? 'Talmannen' : 'Programledaren' };
      await say(null, mod, d.kind === 'interview' ? `Välkommen till ${MEDIA[d.host]?.name || 'studion'}. I kväll frågar vi ut ${ml.name}, partiledare för ${me.name}.` : d.kind === 'riksdag' ? `Kammaren inleder partiledardebatten. Ordet går till ${op.name}, ${opP.name}.` : `Välkomna till ${d.name}! I kväll möts ${ml.name} (${me.abbr}) och ${op.name} (${opP.abbr}).`, { dim: false });
      for (let i = 0; i < d.rounds.length; i++) {
        const r = d.rounds[i]; const is = ISSUE_BY_ID[r.issue];
        topicEl.innerHTML = `Runda ${i + 1}/${d.rounds.length}: ${esc(is.name)}<small>${esc(d.name)}</small>`;
        await say('right', op, r.statement, { expr: r.interview ? 'neutral' : r.opExpr, pose: r.interview ? 'think' : i % 2 ? 'point' : 'cross' });
        const idx = await choose(r.options);
        const o = r.options[idx];
        if (o.type === 'invandning') { await burst('INVÄNDNING!'); flash(); if (o.evidence) showEvidence(o.evidence); }
        else if (o.type === 'angrepp') await burst('VÄNTA LITE!', 'blue');
        const out = resolveOption(state, rnd, d, i, idx);
        await say('left', ml, o.text, { expr: o.type === 'invandning' ? 'objection' : o.type === 'angrepp' ? 'angry' : o.type === 'kansla' ? 'determined' : 'confident', pose: out.myPose });
        setMeter();
        if (out.ok && out.delta > 15) { flash(); sting('win'); } else if (!out.ok) sting('lose');
        await say('right', op, out.reply, { expr: out.opExpr, pose: out.opPose });
        await say(null, { name: out.ok ? '✓ ' + out.narration : '✗ ' + out.narration }, out.ok ? `Poäng till ${me.abbr}. (${out.delta > 0 ? '+' : ''}${fmt(out.delta, 0)})` : `Det där gick inte hem. (${fmt(out.delta, 0)})`, { dim: false });
      }
      const res = finishDebate(state, rnd, d);
      save();
      sting(res.verdict === 'vann' ? 'win' : res.verdict === 'förlorade' ? 'lose' : 'slam');
      setChar('left', ml, res.verdict === 'vann' ? 'happy' : res.verdict === 'förlorade' ? 'sad' : 'neutral', res.verdict === 'vann' ? 'point' : 'stand'); cl.classList.remove('dim');
      setChar('right', op, res.verdict === 'vann' ? 'nervous' : res.verdict === 'förlorade' ? 'smug' : 'neutral', 'stand'); cr.classList.remove('dim');
      const box = h('div', { class: 'result' });
      box.innerHTML = `<div class="box"><h2>${res.verdict === 'vann' ? '🏆 Du vann debatten!' : res.verdict === 'förlorade' ? '😓 Du förlorade debatten' : '🤝 Oavgjort'}</h2><p>Publikmätaren slutade på <b>${res.meter > 0 ? '+' : ''}${fmt(res.meter, 0)}</b>.${res.inv ? ` Du avslöjade ${res.inv} motsägelse${res.inv > 1 ? 'r' : ''} med en INVÄNDNING!` : ''}</p><p class="muted">${res.verdict === 'vann' ? 'Partiledarens stöd, partiets uppmärksamhet och opinionen bland dem som bryr sig om frågorna stärks.' : res.verdict === 'förlorade' ? 'Medierna skriver om en svag insats. Opinionen tappar något.' : 'Ingen avgörande effekt – men du syntes.'}</p><button class="btn gold big" id="ok">Fortsätt</button></div>`;
      view.append(box);
      box.querySelector('#ok').addEventListener('click', () => { aa.remove(); resolve(res); });
    })();
  });
}
