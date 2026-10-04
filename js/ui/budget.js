// Budgeten (statsministern): skatter och utgifter – läggs fram i oktober och röstas i riksdagen.
import { h, esc, fmt, clamp } from '../core/util.js';
import { STAT_BY_ID } from '../data/stats.js';
import { modal, info } from './modal.js';
import { activeParties } from '../sim/opinion.js';
import { addNews } from '../sim/news.js';
import { POLICY_BY_ID, BUDGET_POLICY } from '../data/policies.js';

const SPEND = ['utg_sjukvard', 'utg_utbildning', 'utg_forsvar', 'utg_polis', 'utg_rattsvasende', 'utg_socialt', 'utg_pensioner', 'utg_aldreomsorg', 'utg_infrastruktur', 'utg_klimat', 'utg_kultur', 'utg_bistand', 'utg_migration', 'utg_ovrigt'];
const TAX = [['skatt_kommunal', 28, 36, .1], ['skatt_statlig', 0, 35, 1], ['skatt_bolag', 10, 30, .1], ['moms', 15, 30, .5], ['skatt_kapital', 15, 45, 1], ['skatt_koldioxid', 0, 3000, 10], ['skatt_bensin', 0, 12, .1], ['arbetsgivaravgift', 20, 40, .1]];

export function runBudget(state, rnd) {
  const s = state.sweden.stats; const me = state.parties[state.player.partyId];
  return new Promise((resolve) => {
    const draft = {}; for (const id of [...SPEND, ...TAX.map((t) => t[0])]) draft[id] = s[id];
    const body = h('div', { class: 'budget' });
    body.innerHTML = `<p class="help">Varje utgiftspost kan ändras ±25 % och skatterna inom rimliga gränser. Budgeten röstas i riksdagen: regerings- och stödpartier röstar ja, övriga efter sin politik. En fälld budget är en regeringskris.</p><div class="grid c2"><div><h3>Utgifter (mdkr/år)</h3><div id="sp"></div></div><div><h3>Skatter</h3><div id="tx"></div><div class="card" id="sum" style="margin-top:10px"></div></div></div>`;
    const sp = body.querySelector('#sp'), tx = body.querySelector('#tx'), sum = body.querySelector('#sum');
    const row = (id, min, max, step) => { const d = STAT_BY_ID[id]; const r = h('div', { class: 'axis' }); r.innerHTML = `<div class="name"><span style="color:var(--text)">${esc(d.name)}</span><span><b id="v-${id}">${fmt(draft[id], d.d)}</b> ${esc(d.unit)}</span></div><div class="l">${fmt(min, d.d)}</div><input type="range" min="${min}" max="${max}" step="${step}" value="${draft[id]}"><div class="r">${fmt(max, d.d)}</div>`; r.querySelector('input').addEventListener('input', (e) => { draft[id] = +e.target.value; r.querySelector('#v-' + id).textContent = fmt(draft[id], d.d); upd(); }); return r; };
    for (const id of SPEND) sp.append(row(id, Math.round(s[id] * .75), Math.round(s[id] * 1.25), 1));
    for (const [id, lo, hi, st] of TAX) tx.append(row(id, lo, hi, st));
    const calc = () => {
      const skattekvot = 42 + (draft.skatt_kommunal - 32.37) * .55 + (draft.skatt_statlig - 20) * .12 + (draft.skatt_bolag - 20.6) * .15 + (draft.moms - 25) * .35 + (draft.skatt_kapital - 30) * .05 + (draft.arbetsgivaravgift - 31.42) * .4 + (draft.skatt_koldioxid - 1330) / 1000 * .3;
      const ink = s.bnp * (skattekvot + 7) / 100; const utg = SPEND.reduce((a, id) => a + draft[id], 0) + (s.statsskuld * (s.styrranta + .6)) / 100 * .5;
      return { ink, utg, saldo: ink - utg, skattekvot };
    };
    const upd = () => { const c = calc(); sum.innerHTML = `<b>Inkomster</b> ${fmt(c.ink)} mdkr · <b>Utgifter</b> ${fmt(c.utg)} mdkr<br><b>Saldo: <span class="${c.saldo >= 0 ? 'ok' : 'danger'}">${c.saldo >= 0 ? '+' : ''}${fmt(c.saldo)} mdkr</span></b> · skattekvot ${fmt(c.skattekvot, 1)} %<br><small class="muted">Nuvarande saldo: ${fmt(s.budgetsaldo)} mdkr. Stora underskott höjer räntan och oron; stora överskott ger utrymme senare.</small>`; };
    upd();
    const m = modal({ title: `Budgetpropositionen ${state.date.y + 1}`, body, wide: true, closable: false, buttons: [{ label: 'Lägg fram budgeten', cls: 'gold', onClick: async () => {
      // omröstning
      const gov = state.government; const seats = state.riksdag.seats;
      let ja = 0, nej = 0;
      const shiftL = SPEND.reduce((a, id) => a + (draft[id] - s[id]), 0) > 0 ? 1 : -1; // expansiv = vänster-ish
      for (const q of activeParties(state)) { const n = seats[q.id] || 0; if (!n) continue; if (gov.parties.includes(q.id) || gov.support.includes(q.id)) ja += n; else if ((q.pos.ekonomi < 0 && shiftL > 0) || (q.pos.ekonomi > 0 && shiftL < 0)) { if (rnd() < .35) ja += n; else nej += n; } else nej += n; }
      const passed = ja > nej;
      if (passed) { for (const id in draft) { s[id] = draft[id]; const pid = BUDGET_POLICY[id] || (POLICY_BY_ID[id] ? id : null); if (pid) state.policy[pid] = id.startsWith('utg_') ? Math.round(draft[id] / (state.sweden.priceIndex || 1)) : draft[id]; } state.reforms = (state.reforms || []).filter((r) => !(POLICY_BY_ID[r.policyId]?.budget || POLICY_BY_ID[r.policyId]?.id in draft)); gov.budgets = (gov.budgets || 0) + 1; gov.performance = clamp((gov.performance || 0) + 1.5, -10, 10); me.credibility = clamp(me.credibility + 2, 0, 100); }
      else { gov.crisis = (gov.crisis || 0) + 3; gov.performance = clamp((gov.performance || 0) - 3, -10, 10); }
      const c = calc();
      addNews(state, { outlet: 'svt', headline: passed ? `Regeringens budget antagen – saldo ${c.saldo >= 0 ? '+' : ''}${fmt(c.saldo)} mdkr` : 'Regeringens budget föll i riksdagen', body: passed ? `${ja} ja mot ${nej} nej. ${c.saldo < -80 ? 'Ekonomer varnar för underskottet.' : c.saldo > 50 ? 'Oppositionen kallar budgeten "svältkur".' : 'Budgeten beskrivs som balanserad.'}` : `${nej} ledamöter röstade nej. Regeringen tvingas regera på oppositionens budget – en djup kris.`, tags: ['politik', 'ekonomi'], partyId: me.id, importance: 3, tone: passed ? 1 : -1 });
      await info(passed ? '✅ Budgeten antogs' : '❌ Budgeten föll', `<p>${ja} ja · ${nej} nej.</p>${passed ? '' : '<p class="danger">Regeringskrisen fördjupas. Fler nederlag kan fälla regeringen.</p>'}`);
      resolve();
    } }] });
  });
}
