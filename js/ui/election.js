// Valnatten: länen rapporterar ett efter ett, staplarna rör sig, mandaten räknas om.
import { h, esc, fmt, signed } from '../core/util.js';
import { REGIONS, REGION_BY_ID } from '../data/regions.js';
import { activeParties } from '../sim/opinion.js';
import { sainteLague } from '../sim/election.js';
import { RIKSDAG_SEATS } from '../data/parties.js';

export function runElectionNight(state, el) {
  return new Promise((resolve) => {
    const parties = activeParties(state);
    const me = state.parties[state.player.partyId];
    const root = document.getElementById('scene');
    const v = h('div', { class: 'valnatt' });
    v.innerHTML = `<div class="head"><div><h1>VALNATT ${el.year}</h1><small class="muted">Riksdagsvalet · ${REGIONS.length} län · 349 mandat</small></div><div class="row"><span class="live">● DIREKT</span><button class="btn sm" id="skip">Hoppa fram ⏩</button></div></div>
      <div class="body"><div><div class="ticker" id="ticker">Vallokalerna har stängt. Första prognosen kommer strax…</div><div class="bars" id="bars" style="margin-top:14px"></div><div class="row" style="margin-top:14px;justify-content:center"><button class="btn gold big" id="done" style="display:none">Fortsätt → regeringsbildningen</button></div></div>
      <div><h3>Län som rapporterat</h3><div class="regs" id="regs">${REGIONS.map((r) => `<div class="r" id="reg-${r.id}"><b>${esc(r.name)}</b><span class="muted">väntar…</span></div>`).join('')}</div><div style="margin-top:14px" id="seatsBox"></div></div></div>`;
    root.append(v);
    const bars = v.querySelector('#bars'), ticker = v.querySelector('#ticker');
    const prev = el.prev || Object.fromEntries(parties.map((p) => [p.id, (state.riksdag.seats[p.id] || 0) / 3.49]));
    let reported = [], timer = null, finished = false;
    const draw = (res, seats, final = false) => {
      const sorted = parties.map((p) => ({ p, v: res[p.id] || 0 })).sort((a, b) => b.v - a.v);
      const mx = Math.max(10, ...sorted.map((x) => x.v));
      bars.innerHTML = sorted.map(({ p, v }) => `<div class="pb"><b><span class="pos-dot" style="background:${p.color}"></span>${esc(p.abbr)}</b><div class="bar"><i style="width:${(v / mx) * 100}%;background:${p.color}"></i></div><b class="pct">${fmt(v, 1)} %</b><span class="seat">${seats ? (seats[p.id] || 0) + ' m' : ''}<br><span class="prev ${v - (prev[p.id] || 0) > 0 ? 'up' : 'down'}">${signed(v - (prev[p.id] || 0), 1)}</span></span></div>`).join('');
      v.querySelector('#seatsBox').innerHTML = seats ? `<div class="card"><b>Mandatfördelning${final ? '' : ' (prognos)'}</b><div class="seats" style="margin-top:6px">${sorted.filter((x) => seats[x.p.id]).map((x) => `<i style="width:${(seats[x.p.id] / RIKSDAG_SEATS) * 100}%;background:${x.p.color}"></i>`).join('')}</div><small class="muted">${sorted.filter((x) => seats[x.p.id]).map((x) => `${esc(x.p.abbr)} ${seats[x.p.id]}`).join(' · ')}</small></div>` : '';
    };
    const step = () => {
      if (reported.length >= el.order.length) return finish();
      const id = el.order[reported.length]; reported.push(id);
      const r = REGION_BY_ID[id]; const reg = el.regions[id];
      const re = v.querySelector('#reg-' + id); re.classList.add('in');
      const top = parties.map((p) => ({ p, v: reg.res[p.id] })).sort((a, b) => b.v - a.v)[0];
      re.innerHTML = `<b>${esc(r.name)}</b><span style="color:${top.p.color}">${esc(top.p.abbr)} ${fmt(top.v, 1)} %</span> <small class="muted">· ${esc(me.abbr)} ${fmt(reg.res[me.id] || 0, 1)}</small>`;
      // ackumulerat
      const acc = {}; let pop = 0;
      for (const rid of reported) { const rr = REGION_BY_ID[rid]; pop += rr.pop; for (const p of parties) acc[p.id] = (acc[p.id] || 0) + el.regions[rid].res[p.id] * rr.pop; }
      for (const k in acc) acc[k] /= pop;
      const seats = sainteLague(acc, RIKSDAG_SEATS, { threshold: state.flags.threshold3 ? 3 : 4 });
      draw(acc, seats);
      const share = Math.round((pop / REGIONS.reduce((a, x) => a + x.pop, 0)) * 100);
      const mine = acc[me.id] || 0;
      const msgs = [`${r.name} räknat: ${top.p.abbr} störst med ${fmt(top.v, 1)} %. ${share} % av rösterna räknade.`];
      if (reported.length === 1) msgs.push(`Första länet inne. ${me.abbr} ligger på ${fmt(mine, 1)} %.`);
      if (reported.length === Math.floor(el.order.length / 2)) msgs.push(`Halva Sverige räknat. ${mine >= 4 ? me.abbr + ' ser ut att klara spärren!' : mine >= 3 ? 'Det blir en rysare för ' + me.abbr + '…' : me.abbr + ' ligger under spärren.'}`);
      ticker.textContent = msgs[msgs.length - 1];
      timer = setTimeout(step, 650);
    };
    const finish = () => {
      if (finished) return; finished = true; clearTimeout(timer);
      for (const id of el.order) { if (!reported.includes(id)) { const r = REGION_BY_ID[id]; const reg = el.regions[id]; const re = v.querySelector('#reg-' + id); re.classList.add('in'); const top = parties.map((p) => ({ p, v: reg.res[p.id] })).sort((a, b) => b.v - a.v)[0]; re.innerHTML = `<b>${esc(r.name)}</b><span style="color:${top.p.color}">${esc(top.p.abbr)} ${fmt(top.v, 1)} %</span>`; } }
      draw(el.result, el.seats, true);
      const mine = el.result[me.id] || 0; const seats = el.seats[me.id] || 0;
      const sorted = parties.map((p) => ({ p, v: el.result[p.id] })).sort((a, b) => b.v - a.v);
      ticker.innerHTML = `<b>SLUTRESULTAT.</b> ${sorted[0].p.name} störst med ${fmt(sorted[0].v, 1)} %. Valdeltagande ${fmt(el.turnout, 1)} %. <br>${seats ? `<b style="color:${me.color}">${esc(me.name)} får ${seats} mandat (${fmt(mine, 1)} %).</b>` : `<b class="danger">${esc(me.name)} nådde inte riksdagen (${fmt(mine, 1)} %).</b>`}`;
      v.querySelector('.live').style.display = 'none'; v.querySelector('#skip').style.display = 'none';
      const done = v.querySelector('#done'); done.style.display = ''; done.addEventListener('click', () => { v.remove(); resolve(); });
    };
    v.querySelector('#skip').addEventListener('click', finish);
    setTimeout(step, 1200);
  });
}
