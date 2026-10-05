// Redaktionen: när spelets AI är igång skriver den om viktiga artiklar till riktig nyhetstext – i
// mediets egen ton (SVT sakligt, Aftonbladet och Expressen kvällstidning, DN och SvD analytiskt).
// Körs i bakgrunden med låg prioritet och ändrar bara texten, aldrig vad som hänt i spelet.
import { newsHooks } from '../sim/news.js';
import { MEDIA } from '../data/names.js';
import { localReady, localJSONLow } from './local.js';
import { SYSTEM_LOCAL } from './prompts.js';

const STYLE = { svt: 'saklig och neutral public service-ton', ekot: 'kort, saklig radioton', dn: 'analytisk morgontidningston', svd: 'analytisk, något borgerlig morgontidningston', aftonbladet: 'kvällstidningston: kort, slagkraftig, känslosam', expressen: 'kvällstidningston: dramatisk, med citat', tv4: 'snabb nyhetston', gp: 'regional morgontidningston', sydsvenskan: 'regional morgontidningston', nsd: 'norrländsk lokaltidningston', flashback: 'forumton: ironisk och spekulativ' };
const SCHEMA = { type: 'object', properties: { rubrik: { type: 'string' }, text: { type: 'string' } }, required: ['rubrik', 'text'] };
let installed = false; let perWeek = { week: -1, n: 0 };
export function installNewsroom() {
  if (installed) return; installed = true;
  newsHooks.onNews = (state, item) => {
    if (!localReady() || item.importance < 2 || !item.body) return;
    if (perWeek.week !== state.week) perWeek = { week: state.week, n: 0 };
    if (perWeek.n >= 3) return; perWeek.n++;
    const p = item.partyId ? state.parties[item.partyId] : null;
    const messages = [{ role: 'system', content: `${SYSTEM_LOCAL}\n\nDu är nyhetsredaktör på ${MEDIA[item.outlet]?.name || 'en svensk redaktion'} (${STYLE[item.outlet] || 'saklig nyhetston'}). Skriv om nyhetsunderlaget till en riktig kort nyhetsartikel på svenska: en rubrik (högst 12 ord) och 2–4 meningar brödtext. Behåll alla fakta, namn och siffror exakt – hitta inte på nya.` }, { role: 'user', content: `Underlag – rubrik: "${item.headline}". Text: "${item.body}".${p ? ` Partiet det gäller: ${p.name} (${p.abbr}).` : ''}` }];
    localJSONLow(messages, SCHEMA, { max: 220, temp: .6 }).then((r) => {
      const n = state.news.find((x) => x.id === item.id); if (!n || !r?.text) return;
      if (r.rubrik && r.rubrik.length > 8 && r.rubrik.length < 140) n.headline = r.rubrik.trim().replace(/^["“]|["”]$/g, '');
      n.body = r.text.trim(); n.ai = true;
      document.dispatchEvent(new CustomEvent('bpm:news', { detail: n.id }));
    }).catch(() => {});
  };
}
