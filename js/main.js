// Startpunkt: startskärm → uppsättning → spelet. Allt sparas automatiskt.
import { G, save, load, listSaves } from './core/state.js';
import { renderStart } from './ui/start.js';
import { renderSetup } from './ui/setup.js';
import { UI, processQueue } from './ui/game.js';
import { newGame } from './sim/newgame.js';
import { toast } from './ui/modal.js';

function showStart() { G.state = null; renderStart({ onNew: showSetup, onLoad: startSlot }); }
function showSetup() { renderSetup({ onDone: (def) => { const { state, rnd } = newGame(def); G.state = state; G.rnd = rnd; G.slot = def.slot; save(); enterGame(); }, onCancel: showStart }); }
function startSlot(slot) { try { if (!load(slot)) return toast('Sparningen kunde inte läsas.', 'bad'); enterGame(); } catch (e) { console.error(e); toast('Sparningen är skadad: ' + e.message, 'bad'); } }
async function enterGame() {
  UI.onExit = showStart;
  UI.page = 'oversikt';
  UI.render();
  if (G.state.queue?.length) { UI.busy = true; UI.render(); await processQueue(); UI.busy = false; UI.render(); }
}

// För tester: window.BPM ger åtkomst till tillståndet
window.BPM = { G, UI, showStart, newGame, save, load, listSaves, processQueue };

const params = new URLSearchParams(location.search);
const saves = listSaves();
if (params.get('slot') && !saves[+params.get('slot') - 1]?.empty) startSlot(+params.get('slot'));
else showStart();
