// Regeringsbildningen: talmansrundor, koalitioner, stödpartier, tolerans-omröstning.
import { h, esc, fmt } from '../core/util.js';
import { activeParties } from '../sim/opinion.js';
import { willingness, toleranceVote, buildGovernment, formGovernmentAI, ideologicalDistance, MINISTRIES } from '../sim/government.js';
import { addNews } from '../sim/news.js';
import { modal, choice, info } from './modal.js';
import { seatBar } from './charts.js';
import { clamp } from '../core/util.js';
import { textDialog } from './freetext.js';
import { analyze } from '../ai/generate.js';
import { formationOffer, clearOffers } from '../sim/talk.js';
import { llmEnabled } from '../ai/llm.js';
import { toast } from './modal.js';

export async function runFormation(state, rnd, item) {
  const me = state.parties[state.player.partyId];
  const seats = state.riksdag.seats;
  const round = item.round || 1;
  const mySeats = seats[me.id] || 0;
  const bySize = activeParties(state).filter((p) => seats[p.id] > 0).sort((a, b) => seats[b.id] - seats[a.id]);
  const canTry = mySeats > 0 && (bySize.indexOf(me) < 3 || round >= 2);
  const intro = `<p>${item.reason === 'val' ? 'Valet är över och talmannen inleder sonderingar.' : item.reason === 'kris' ? 'Regeringen har fallit. Talmannen inleder nya sonderingar.' : 'Talmannen fortsätter sonderingarna.'} <b>Runda ${round}</b> av högst 4 – därefter blir det extraval.</p>${seatBar(seats, state.parties)}<p class="muted" style="margin-top:6px">${bySize.map((p) => `${esc(p.abbr)} ${seats[p.id]}`).join(' · ')}</p>`;
  if (canTry) {
    const i = await choice({ title: `Regeringsbildning – runda ${round}`, text: intro, choices: [{ label: 'Jag försöker bilda regering', desc: `Som ${bySize.indexOf(me) === 0 ? 'största parti' : 'ett av de större partierna'} kan du be talmannen om uppdraget.`, cls: 'gold' }, { label: 'Låt andra försöka', desc: 'Talmannen vänder sig till ett annat parti. Du kan bli erbjuden en plats i deras regering.' }] });
    if (i === 0) { const ok = await playerFormation(state, rnd, round); if (ok) return; }
  } else {
    await info(`Regeringsbildning – runda ${round}`, intro + `<p>${mySeats ? 'Ditt parti är för litet för att få talmannens uppdrag i den här rundan.' : 'Ditt parti sitter inte i riksdagen och deltar inte i regeringsbildningen.'}</p>`, 'Följ förhandlingarna');
  }
  // AI försöker – kan bjuda in spelaren
  const ai = formGovernmentAI(state, rnd, { round, exclude: [] });
  if (ai) {
    const wantsMe = mySeats > 0 && !ai.parties.includes(me.id) && !ai.support.includes(me.id) && willingness(state, state.parties[ai.pmParty], me) > 30 && ai.type !== 'majority';
    if (ai.parties.includes(me.id) || ai.support.includes(me.id) || wantsMe) {
      const pmP = state.parties[ai.pmParty];
      const asCoalition = ai.parties.includes(me.id) || (wantsMe && ideologicalDistance(pmP, me) < 32);
      const j = await choice({ title: `Erbjudande från ${pmP.name}`, text: `<p>${esc(state.people[pmP.leader].name)} vill bilda regering ${ai.parties.filter((id) => id !== me.id).length > 1 ? 'tillsammans med ' + esc(ai.parties.filter((id) => id !== me.id && id !== pmP.id).map((id) => state.parties[id].abbr).join(', ')) : ''} och erbjuder ${esc(me.name)} ${asCoalition ? 'plats i regeringen med ministerposter' : 'en roll som stödparti med inflytande över budgeten'}.</p>`, choices: [{ label: asCoalition ? 'Gå med i regeringen' : 'Bli stödparti', cls: 'gold', desc: asCoalition ? 'Ministerposter, men ni delar ansvaret för allt som går fel.' : 'Inflytande utan regeringsansvar.' }, { label: 'Tacka nej – vi går i opposition', desc: 'Friare händer, men ingen makt.' }] });
      if (j === 0) {
        if (!ai.parties.includes(me.id) && !ai.support.includes(me.id)) { if (asCoalition) ai.parties.push(me.id); else ai.support.push(me.id); }
        const gov = buildGovernment(state, rnd, ai.pmParty, ai.parties.filter((id) => id !== ai.pmParty), ai.support, ai.vote);
        state.government = gov;
        addNews(state, { outlet: 'svt', headline: `Ny regering: ${gov.parties.map((id) => state.parties[id].abbr).join('+')}${gov.support.length ? ' med stöd av ' + gov.support.map((id) => state.parties[id].abbr).join(', ') : ''}`, body: `${state.people[gov.pm].name} vald till statsminister med ${gov.vote.yes} ja, ${gov.vote.no} nej och ${gov.vote.abst} nedlagda röster.`, tags: ['politik'], importance: 3 });
        me.credibility = clamp(me.credibility + (asCoalition ? 2 : 1), 0, 100);
        return info('Regering bildad', `<p>${esc(me.name)} ${asCoalition ? 'ingår i regeringen' : 'är stödparti till regeringen'} ${esc(gov.parties.map((id) => state.parties[id].abbr).join('+'))}. ${asCoalition ? 'Era ministrar: ' + esc(Object.entries(gov.ministers).filter(([, pid]) => state.people[pid]?.partyId === me.id).map(([mid, pid]) => `${state.people[pid].name} (${MINISTRIES.find((m) => m.id === mid).name})`).join(', ') || 'inga') : ''}</p>`);
      }
      // nej: AI försöker utan oss
      const ai2 = formGovernmentAI(state, rnd, { round, exclude: [] });
      if (ai2 && !ai2.parties.includes(me.id)) { ai2.support = ai2.support.filter((id) => id !== me.id); const tv = toleranceVote(state, state.parties[ai2.pmParty], ai2.parties.filter((id) => id !== ai2.pmParty), ai2.support, round); if (tv.passed) { state.government = buildGovernment(state, rnd, ai2.pmParty, ai2.parties.filter((id) => id !== ai2.pmParty), ai2.support, tv); return announce(state, state.government, 'Ny regering utan ' + me.abbr); } }
      return noGov(state, round);
    }
    state.government = ai;
    return announce(state, ai, '');
  }
  return noGov(state, round);
}
async function announce(state, gov, extra) {
  const names = gov.parties.map((id) => state.parties[id].abbr).join('+');
  addNews(state, { outlet: 'svt', headline: `Ny regering: ${names}${gov.support.length ? ' med stöd av ' + gov.support.map((id) => state.parties[id].abbr).join(', ') : ''}`, body: `${state.people[gov.pm].name} (${state.parties[gov.pmParty].abbr}) vald till statsminister med ${gov.vote.yes} ja, ${gov.vote.no} nej och ${gov.vote.abst} nedlagda röster.`, tags: ['politik'], importance: 3 });
  await info('Ny regering', `<p><b>${esc(state.people[gov.pm].name)}</b> (${esc(state.parties[gov.pmParty].abbr)}) är Sveriges nya statsminister. Regering: ${esc(names)}${gov.support.length ? ', stödpartier: ' + esc(gov.support.map((id) => state.parties[id].abbr).join(', ')) : ''}.</p><p class="muted">Omröstningen: ${gov.vote.yes} ja · ${gov.vote.no} nej · ${gov.vote.abst} avstod. ${extra}</p>`);
}
async function noGov(state, round) {
  if (round >= 4) {
    addNews(state, { outlet: 'svt', headline: 'Talmannen: Extraval utlyses', body: 'Efter fyra misslyckade försök att bilda regering går Sverige till extraval om tre månader.', tags: ['politik', 'val'], importance: 3 });
    const d = new Date(Date.UTC(state.date.y, state.date.m - 1, state.date.d + 91));
    state.election.next = { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
    state.government.weeksWithout = 0;
    return info('Extraval', '<p>Fyra talmansrundor har misslyckats. Sverige går till extraval om tre månader. Expeditionsministären sitter kvar till dess.</p>');
  }
  addNews(state, { outlet: 'svt', headline: `Regeringsbildningen har kört fast – runda ${round} misslyckades`, body: 'Talmannen tar nya samtal med partiledarna. Nästa försök om några veckor.', tags: ['politik'], importance: 2 });
  state.government.weeksWithout = round * 4;
  return info('Ingen regering', `<p>Ingen kandidat klarade omröstningen i runda ${round}. Talmannen fortsätter sondera; ett nytt försök görs om fyra veckor. Sverige styrs av en expeditionsministär tills dess.</p>`);
}

function playerFormation(state, rnd, round) {
  const me = state.parties[state.player.partyId]; const seats = state.riksdag.seats;
  return new Promise((resolve) => {
    const others = activeParties(state).filter((p) => !p.isPlayer && seats[p.id] > 0).sort((a, b) => willingness(state, b, me) - willingness(state, a, me));
    const sel = {}; // id → 'coalition' | 'support' | null
    const body = h('div', {});
    const list = h('div', { class: 'list' });
    const status = h('div', { class: 'card', style: 'margin-top:10px' });
    const draw = () => {
      list.innerHTML = '';
      for (const q of others) {
        const w = willingness(state, q, me); const d = ideologicalDistance(q, me);
        const accCo = w > 45 && d < 32, accSu = w > 25;
        const row = h('div', { class: 'item' });
        row.innerHTML = `<div class="top"><b><span class="pos-dot" style="background:${q.color}"></span>${esc(q.name)} · ${seats[q.id]} mandat</b><span class="tag ${w > 45 ? 'green' : w > 25 ? 'gold' : 'red'}">${w > 45 ? 'vill samarbeta' : w > 25 ? 'kan tänka sig stöd' : w > 0 ? 'avvaktande' : 'avvisar'}</span></div><small class="muted">${esc(state.people[q.leader].name)} · avstånd ${fmt(d, 0)} · relation ${q.relations?.[me.id] || 0}${q.offerBonus ? ` · ert erbjudande: <b class="${q.offerBonus > 0 ? 'ok' : 'danger'}">${q.offerBonus > 0 ? '+' : ''}${q.offerBonus}</b>` : ''}${(q.cordon || []).includes(me.id) ? ' · <b class="danger">vägrar samarbeta med er</b>' : ''}</small><div class="chips" style="margin-top:6px"><span class="chip ${sel[q.id] === 'coalition' ? 'on' : ''} ${accCo ? '' : 'static'}" data-k="coalition" style="${accCo ? '' : 'opacity:.4'}">I regeringen</span><span class="chip ${sel[q.id] === 'support' ? 'on' : ''}" data-k="support" style="${accSu ? '' : 'opacity:.4'}">Stödparti</span><span class="chip ${!sel[q.id] ? 'on' : ''}" data-k="none">Utanför</span><span class="chip" data-k="offer" style="margin-left:auto">✉️ ${q.offerBonus ? 'Nytt erbjudande' : 'Skriv ett erbjudande'}</span></div>`;
        row.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', async () => { const k = c.dataset.k; if (k === 'offer') { const r = await textDialog({ title: `Erbjudande till ${state.people[q.leader].name} (${q.abbr})`, intro: `Vad erbjuder ni ${esc(q.abbr)} för att gå med? Ministerposter (nämn dem), politik de vill ha, löften. Det här stannar mellan er – om det inte läcker.`, placeholder: 'Vi erbjuder er finansministerposten och …', rows: 4, maxlength: 600, okLabel: 'Skicka erbjudandet' }); if (!r) return; if (llmEnabled()) toast('Claude läser…'); const an = await analyze(state, r.text, {}); const out = formationOffer(state, q, r.text, an); toast(out.bonus > 8 ? `${q.abbr} lyssnar intresserat (+${out.bonus}).` : out.bonus > 0 ? `${q.abbr} noterar erbjudandet (+${out.bonus}).` : `${q.abbr} är inte imponerade (${out.bonus}).`, out.bonus > 0 ? 'good' : 'bad'); draw(); return; } if (k === 'coalition' && !accCo) return; if (k === 'support' && !accSu) return; sel[q.id] = k === 'none' ? null : k; draw(); }));
        list.append(row);
      }
      const co = Object.keys(sel).filter((id) => sel[id] === 'coalition'), su = Object.keys(sel).filter((id) => sel[id] === 'support');
      const tv = toleranceVote(state, me, co, su, round);
      const govSeats = seats[me.id] + co.reduce((a, id) => a + seats[id], 0), withSup = govSeats + su.reduce((a, id) => a + seats[id], 0);
      status.innerHTML = `<b>Regeringsunderlag:</b> ${govSeats} mandat i regeringen, ${withSup} med stödpartier. <br><b>Väntad omröstning:</b> <span class="up">${tv.yes} ja</span> · <span class="down">${tv.no} nej</span> · ${tv.abst} avstår → <b class="${tv.passed ? 'ok' : 'danger'}">${tv.passed ? 'TOLERERAS (färre än 175 nej)' : 'FÄLLS (175 eller fler nej)'}</b><br><small class="muted">${Object.entries(tv.detail).map(([id, v]) => `${esc(state.parties[id].abbr)}: ${v}`).join(' · ')}</small>`;
      btnVote.disabled = false;
    };
    body.innerHTML = `<p class="help">Välj vilka partier du bjuder in i regeringen och vilka du ber om stöd. Partier som avvisar er kan inte väljas. Statsministern tolereras om färre än 175 ledamöter röstar nej.</p>`;
    body.append(list, status);
    const btnVote = h('button', { class: 'btn gold' }, 'Gå till omröstning i riksdagen');
    btnVote.addEventListener('click', async () => {
      const co = Object.keys(sel).filter((id) => sel[id] === 'coalition'), su = Object.keys(sel).filter((id) => sel[id] === 'support');
      const tv = toleranceVote(state, me, co, su, round);
      m.close(); clearOffers(state);
      if (tv.passed) {
        const gov = buildGovernment(state, rnd, me.id, co, su, tv);
        state.government = gov;
        me.credibility = clamp(me.credibility + 5, 0, 100);
        addNews(state, { outlet: 'svt', headline: `${state.people[me.leader].name} vald till statsminister`, body: `Riksdagen tolererade regeringen ${gov.parties.map((id) => state.parties[id].abbr).join('+')} med ${tv.yes} ja, ${tv.no} nej och ${tv.abst} nedlagda röster.`, tags: ['politik'], partyId: me.id, importance: 3 });
        await info('🎉 Du är statsminister!', `<p>Riksdagen tolererade din regering: <b>${tv.yes}</b> ja · <b>${tv.no}</b> nej · ${tv.abst} avstod.</p><p>Regering: ${esc(gov.parties.map((id) => state.parties[id].abbr).join('+'))}${su.length ? ' · stödpartier: ' + esc(su.map((id) => state.parties[id].abbr).join(', ')) : ''} (${gov.type === 'majority' ? 'majoritet' : 'minoritet'}).</p><p>Ministrarna är utsedda – ombilda under Regeringen. Budgeten läggs i oktober.</p>`);
        resolve(true);
      } else {
        addNews(state, { outlet: 'svt', headline: `${me.abbr}:s regeringsförsök föll i riksdagen`, body: `${tv.no} ledamöter röstade nej mot ${state.people[me.leader].name} som statsminister.`, tags: ['politik'], partyId: me.id, importance: 3, tone: -1 });
        me.credibility = clamp(me.credibility - 3, 0, 100);
        await info('Omröstningen föll', `<p><b>${tv.no}</b> röstade nej (175 krävs för att fälla). Talmannen vänder sig till andra partier.</p>`);
        resolve(false);
      }
    });
    const m = modal({ title: `Bilda regering – ${esc(me.name)}`, body, wide: true, closable: false, buttons: [{ label: 'Avbryt – låt andra försöka', onClick: () => { clearOffers(state); resolve(false); } }] });
    m.el.querySelector('.mf').prepend(btnVote);
    draw();
  });
}

export async function runOffer(state, rnd, item) { /* reserverad för framtida AI-erbjudanden mitt i mandatperioden */ }
