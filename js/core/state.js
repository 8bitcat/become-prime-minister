// Spelets tillstånd + sparning. ALLT sparas automatiskt i localStorage efter varje
// förändring (autosave) – tre platser, plus export/import som fil.
import { makeRng } from './util.js';

export const SAVE_PREFIX = 'bpm_save_';
export const SLOTS = [1, 2, 3];
export const SAVE_VERSION = 1;

export const G = { state: null, slot: 1, rnd: null, dirty: false, listeners: new Set() };

export function listSaves() {
  return SLOTS.map((slot) => {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + slot);
      if (!raw) return { slot, empty: true };
      const s = JSON.parse(raw);
      const party = s.parties?.[s.player?.partyId];
      const leader = s.people?.[s.player?.leaderId];
      return { slot, empty: false, party: party?.name, abbr: party?.abbr, color: party?.color, leader: leader?.name, date: s.date, week: s.week, updated: s.updated, role: s.government?.pm === s.player?.leaderId ? 'Statsminister' : s.riksdag?.seats?.[s.player?.partyId] ? 'Riksdagsparti' : 'Utanför riksdagen', support: s.opinion?.support?.[s.player?.partyId] };
    } catch { return { slot, empty: true, broken: true }; }
  });
}

export function save() {
  if (!G.state) return;
  G.state.updated = Date.now();
  G.state.rngState = G.rnd.state();
  try {
    localStorage.setItem(SAVE_PREFIX + G.slot, JSON.stringify(G.state));
    G.dirty = false;
  } catch (e) {
    console.warn('Kunde inte spara', e);
  }
}

export function load(slot) {
  const raw = localStorage.getItem(SAVE_PREFIX + slot);
  if (!raw) return null;
  const s = JSON.parse(raw);
  G.state = s; G.slot = slot;
  G.rnd = makeRng(s.rngState ?? s.seed);
  return s;
}

export function deleteSave(slot) { localStorage.removeItem(SAVE_PREFIX + slot); }

export function exportSave() {
  const blob = new Blob([JSON.stringify(G.state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const p = G.state.parties[G.state.player.partyId];
  a.download = `bpm-${p.abbr}-${G.state.date.y}-${String(G.state.date.m).padStart(2, '0')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function importSave(file, slot) {
  return file.text().then((txt) => {
    const s = JSON.parse(txt);
    if (!s.parties || !s.player) throw new Error('Inte en BPM-sparning');
    localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(s));
    return s;
  });
}

// Spara alltid vid flikbyte/stängning – progress får aldrig gå förlorad.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { if (G.state) save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state) save(); });
}
