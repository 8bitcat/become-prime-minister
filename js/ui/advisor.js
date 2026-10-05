// Staben: prata fritt med dina rådgivare – stabschef, pressekreterare, partisekreterare och chefsekonom.
// Med spelets AI-modell svarar de som i ett vanligt samtal, utifrån det faktiska läget i spelet.
import { G, save } from '../core/state.js';
import { h, esc } from '../core/util.js';
import { ADVISOR_ROLES, ensureAdvisors, gameBrief, fallbackAdvice } from '../ai/brief.js';
import { advisorMessages } from '../ai/prompts.js';
import { localReady, localJSON, localStatus, tidy } from '../ai/local.js';
import { claudeOn, llmReplies } from '../ai/llm.js';
import { analyzeText } from '../ai/analyze.js';

export function pageAdvisor(s, ui, sub) {
  ensureAdvisors(s);
  const roleId = ADVISOR_ROLES.some((r) => r.id === sub) ? sub : 'stab';
  const role = ADVISOR_ROLES.find((r) => r.id === roleId); const adv = s.advisors[roleId];
  const chat = (s.chats[roleId] ||= []);
  const el = h('div', {});
  const ai = localReady() ? `<span class="tag green">spelets AI svarar</span>` : claudeOn() ? '<span class="tag blue">Claude svarar</span>' : localStatus().state === 'laddar' ? `<span class="tag gold">AI laddas ${localStatus().progress} %</span>` : '<span class="tag">enkla svar – starta spelets AI under ☰ Meny</span>';
  el.innerHTML = `<div class="page-title"><div><h2>Staben</h2><small class="muted">Prata fritt med dina närmaste medarbetare. Det kostar inga handlingspoäng. ${ai}</small></div></div>`;
  const tabs = h('div', { class: 'tabs' });
  for (const r of ADVISOR_ROLES) tabs.append(h('button', { class: r.id === roleId ? 'on' : '', onclick: () => ui.render('stab', r.id) }, `${r.ic} ${r.title}`));
  el.append(tabs);
  const card = h('div', { class: 'card chatcard' });
  card.innerHTML = `<div class="row" style="gap:10px;margin-bottom:8px"><div style="font-size:30px">${role.ic}</div><div><b>${esc(adv.name)}</b>, ${esc(role.role)}<br><small class="muted">${esc(role.persona)}</small></div></div><div class="chatlog" id="log"></div><div class="chatin"><textarea id="q" rows="2" placeholder="Skriv vad du vill – fråga om läget, be om råd, testa en formulering, diskutera en strategi …"></textarea><button class="btn gold" id="send">Skicka</button></div><div class="sugg" id="sugg" style="margin-top:6px"></div>`;
  el.append(card);
  const log = card.querySelector('#log'); const q = card.querySelector('#q'); const send = card.querySelector('#send');
  const draw = () => { log.innerHTML = chat.length ? chat.map((m) => `<div class="msg ${m.mine ? 'mine' : ''}"><b>${esc(m.mine ? 'Du' : adv.name)}</b><div>${esc(m.text)}</div></div>`).join('') : `<div class="empty">${esc(adv.name)} väntar på dig.</div>`; log.scrollTop = log.scrollHeight; };
  const SUGG = { stab: ['Hur ligger vi till inför valet?', 'Vilken fråga ska vi äga?', 'Vilka kan vi samarbeta med efter valet?'], press: ['Hur uppfattas jag i medierna?', 'Hur ska jag svara om skandalen?', 'Skriv om det här så det låter bättre: '], parti: ['Hur mår partiet internt?', 'Har vi råd med en stor kampanj?', 'Vilken falang är mest missnöjd?'], ekonom: ['Vad skulle det kosta att sänka skatten på arbete?', 'Hur går ekonomin just nu?', 'Är våra löften finansierade?'] };
  card.querySelector('#sugg').innerHTML = `<small>Förslag:</small>${SUGG[roleId].map((x) => `<span class="chip">${esc(x)}</span>`).join('')}`;
  card.querySelector('#sugg').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; q.value = c.textContent; q.focus(); });
  const ask = async () => {
    const text = q.value.trim(); if (!text) return;
    q.value = ''; send.disabled = true;
    chat.push({ mine: true, text, week: s.week }); draw();
    log.insertAdjacentHTML('beforeend', `<div class="msg typing"><b>${esc(adv.name)}</b><div>skriver …</div></div>`); log.scrollTop = log.scrollHeight;
    let answer = null;
    try { answer = await advisorAnswer(s, roleId, text, chat.slice(0, -1)); } catch (e) { console.warn('staben', e.message); }
    if (!answer) answer = fallbackAdvice(s, roleId, text, analyzeText(text, { stats: s.sweden.stats }));
    chat.push({ mine: false, text: answer, week: s.week });
    if (chat.length > 60) chat.splice(0, chat.length - 60);
    save(); draw(); send.disabled = false; q.focus();
  };
  send.addEventListener('click', ask);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });
  draw();
  setTimeout(() => q.focus(), 50);
  return el;
}

export async function advisorAnswer(s, roleId, question, history) {
  ensureAdvisors(s);
  const role = ADVISOR_ROLES.find((r) => r.id === roleId); const adv = s.advisors[roleId];
  const a = analyzeText(question, { stats: s.sweden.stats });
  const state = gameBrief(s, { focus: a.topics?.[0] });
  if (localReady()) {
    const { messages, schema } = advisorMessages({ advisor: adv.name, role: role.role, persona: role.persona, state, history: history.slice(-8), question });
    const r = await localJSON(messages, schema, { max: 300, temp: .7, penalty: .5 });
    return tidy(String(r.svar || '')) || null;
  }
  if (claudeOn()) {
    const r = await llmReplies({ situation: `Ett förtroligt samtal i partiets kansli. Lägesbild:\n${state}\n\nSamtalet hittills:\n${history.slice(-6).map((m) => `${m.mine ? 'Partiledaren' : adv.name}: ${m.text}`).join('\n')}`, playerText: question, playerName: 'Partiledaren', abbr: '', speakers: [{ who: adv.name, desc: `${role.role}. ${role.persona} Svara rakt och konkret, 2–6 meningar.` }], count: 1 });
    return r[0]?.text || null;
  }
  return null;
}
