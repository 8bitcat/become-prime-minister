// Startskärmen: fortsätt, ny spelomgång, importera.
import { h, esc, fmtDate, pct } from '../core/util.js';
import { listSaves, deleteSave, importSave } from '../core/state.js';
import { VERSION, DATE } from '../version.js';
import { modal, toast } from './modal.js';

export function renderStart({ onNew, onLoad }) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const saves = listSaves();
  const card = h('div', { class: 'card' });
  card.innerHTML = `
    <h1><small>En politisk simulering av Sverige</small>Become Prime Minister</h1>
    <p class="lead">Ta över ett riksdagsparti eller starta ett eget från noll. Vinn val, bilda regering, styr landet – eller se allt rasa. Ingenting är förutbestämt. Allt sparas automatiskt.</p>
    <div class="saves"></div>
    <div class="row">
      <button class="btn gold big" id="new">＋ Ny spelomgång</button>
      <button class="btn" id="import">Importera sparfil</button>
      <input type="file" id="importFile" accept="application/json" style="display:none">
    </div>
    <p class="help" style="margin-top:16px">Tips: spelet är svårt på riktigt. Ett nytt parti behöver flera år för att nå riksdagen. Ta över ett etablerat parti om du vill in i hetluften direkt.</p>`;
  const list = card.querySelector('.saves');
  for (const s of saves) {
    if (s.empty) { list.append(h('div', { class: 'save' }, h('div', { class: 'who' }, h('span', { class: 'dot', style: 'background:var(--line)' }), h('div', {}, h('b', {}, `Plats ${s.slot}`), h('small', {}, s.broken ? 'Skadad sparning' : 'Tom'))))); continue; }
    const row = h('div', { class: 'save' });
    const who = h('div', { class: 'who' }, h('span', { class: 'dot', style: `background:${s.color}` }), h('div', {}, h('b', {}, `${s.party} (${s.abbr}) – ${s.leader}`), h('small', {}, `${s.role} · ${s.support != null ? pct(s.support) : ''} · ${fmtDate(s.date)} · vecka ${s.week} · sparad ${new Date(s.updated).toLocaleString('sv-SE')}`)));
    const btns = h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: () => onLoad(s.slot) }, '▶ Fortsätt'), h('button', { class: 'btn ghost sm', onclick: () => { modal({ title: 'Radera sparning?', body: `<p>Plats ${s.slot}: ${esc(s.party)} – ${esc(s.leader)}. Detta går inte att ångra.</p>`, buttons: [{ label: 'Avbryt' }, { label: 'Radera', cls: 'red', onClick: () => { deleteSave(s.slot); renderStart({ onNew, onLoad }); } }] }); } }, 'Radera'));
    row.append(who, btns); list.append(row);
  }
  card.querySelector('#new').addEventListener('click', onNew);
  const fileInput = card.querySelector('#importFile');
  card.querySelector('#import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0]; if (!f) return;
    const free = saves.find((s) => s.empty)?.slot || 3;
    try { await importSave(f, free); toast(`Importerad till plats ${free}.`, 'good'); renderStart({ onNew, onLoad }); } catch (e) { toast('Kunde inte läsa filen: ' + e.message, 'bad'); }
  });
  const wrap = h('div', { class: 'start' }, card, h('div', { class: 'ver' }, `v${VERSION} · ${DATE}`));
  app.append(wrap);
}
