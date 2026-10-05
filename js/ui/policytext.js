// "Skriv er politik med egna ord" – på Politiken-sidan. Texten tolkas till konkreta ändringar i
// partiprogrammet som spelaren kan granska, bocka av och anta.
import { h, esc } from '../core/util.js';
import { POLICY_BY_ID, DOMAINS, policyLabel } from '../data/policies.js';
import { mapPolicyText } from '../ai/policymap.js';
import { localReady } from '../ai/local.js';
import { ACTIONS } from '../sim/turn.js';

export function policyTextCard(s, ui) {
  const p = s.parties[s.player.partyId];
  const card = h('div', { class: 'card', style: 'margin-bottom:14px' });
  card.innerHTML = `<h3>✍️ Skriv er politik med egna ord</h3><p class="help">Beskriv vad partiet vill – fritt, som du skulle säga det. ${localReady() ? 'Spelets AI' : 'Spelet'} översätter texten till konkreta värden i politikområdena. Du granskar och väljer vad som ska in i programmet.</p>
    <textarea id="ptext" rows="3" style="width:100%" placeholder="t.ex. "Pensionärer ska inte betala mer skatt än löntagare. Bygg ut tunnelbanan i storstäderna och förbjud vinster i skolan.""></textarea>
    <div class="row" style="margin-top:8px"><button class="btn" id="ptolka">Tolka texten</button><span class="muted" id="pstatus"></span></div><div id="pres"></div>`;
  const res = card.querySelector('#pres'); const st = card.querySelector('#pstatus');
  card.querySelector('#ptolka').addEventListener('click', async () => {
    const text = card.querySelector('#ptext').value.trim(); if (!text) return;
    st.textContent = localReady() ? 'Spelets AI läser …' : 'Tolkar …'; res.innerHTML = '';
    const { changes, via } = await mapPolicyText(text, p.program || {});
    st.textContent = changes.length ? `${changes.length} ändring${changes.length > 1 ? 'ar' : ''} hittade (${via === 'ai' ? 'tolkat av spelets AI' : 'regelbaserad tolkning'})` : 'Hittade inga konkreta ändringar – försök vara lite mer specifik (vad ska höjas, sänkas, införas eller förbjudas?).';
    if (!changes.length) return;
    const sel = new Set(changes.map((c) => c.id));
    const list = h('div', { class: 'list', style: 'margin-top:8px' });
    for (const c of changes) {
      const pol = POLICY_BY_ID[c.id];
      const row = h('label', { class: 'item', style: 'display:flex;gap:10px;align-items:flex-start;cursor:pointer' });
      row.innerHTML = `<input type="checkbox" checked style="margin-top:4px"><div><b>${esc(pol.name)}</b> <small class="muted">${esc(DOMAINS[pol.domain] || '')}</small><br>${esc(policyLabel(pol, c.from))} → <b>${esc(policyLabel(pol, c.to))}</b>${pol.konst ? ' <span class="tag gold">grundlag</span>' : ''}</div>`;
      row.querySelector('input').addEventListener('change', (e) => { if (e.target.checked) sel.add(c.id); else sel.delete(c.id); btn.disabled = !sel.size || s.ap < 1; });
      list.append(row);
    }
    const btn = h('button', { class: 'btn gold', style: 'margin-top:8px', disabled: s.ap < 1 }, 'Anta i partiprogrammet (1 AP)');
    btn.addEventListener('click', () => { const ch = {}; for (const c of changes) if (sel.has(c.id)) ch[c.id] = c.to; ui.action(ACTIONS.find((a) => a.id === 'program_policy'), { changes: ch }); });
    res.append(list, btn);
  });
  return card;
}
