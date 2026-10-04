// Vallöften, valmanifest, löfteskollen och förtroende (skilt från popularitet).
import { BILLS, BILL_BY_ID, stance } from './riksdag.js';
import { ISSUE_BY_ID } from '../data/issues.js';
import { clamp, pick } from '../core/util.js';
import { addNews } from './news.js';
import { playerInGov } from './government.js';

// Kandidater till manifestet: lagförslag i linje med partiets politik
export function manifestCandidates(state) {
  const me = state.parties[state.player.partyId];
  return BILLS.map((b) => ({ b, st: stance(me, b) })).filter((x) => x.st > .15).sort((a, c) => c.st - a.st).slice(0, 16);
}
export function setManifest(state, billIds) {
  const me = state.parties[state.player.partyId];
  me.manifest = { year: state.election.next.y, promises: billIds.map((id) => ({ billId: id, text: BILL_BY_ID[id].title, issue: BILL_BY_ID[id].area, kept: null })) };
  me.attention = clamp(me.attention + 6, 0, 100);
  addNews(state, { outlet: 'svt', headline: `${me.abbr} presenterar valmanifest: ${billIds.length} löften`, body: billIds.map((id) => BILL_BY_ID[id].title).join(' · ') + '.', tags: ['val', 'politik'], partyId: me.id, importance: 2 });
}
// Löfteskollen: körs när nästa valrörelse börjar (eller när partiet lämnar regeringen)
export function checkPromises(state, rnd) {
  const me = state.parties[state.player.partyId];
  const m = me.manifest; if (!m || m.checked) return null;
  m.checked = true;
  const passed = new Set((state.sweden.reforms || []).map((r) => r.billId));
  let kept = 0, broken = 0;
  for (const p of m.promises) { p.kept = passed.has(p.billId); if (p.kept) kept++; else broken++; }
  const inPower = playerInGov(state) || (state.government.history || []).some((g) => g.parties?.includes(me.id) && g.formed?.y >= m.year);
  if (!inPower) { addNews(state, { outlet: 'dn', headline: `Löfteskollen: ${me.abbr} satt i opposition – ${kept} av ${m.promises.length} löften blev ändå verklighet`, body: 'Partiet kan inte lastas för vad en annan regering gjorde, men väljarna minns vad som lovades.', tags: ['val', 'politik'], partyId: me.id, importance: 1 }); me.trust = clamp((me.trust ?? 50) + kept * 1.5, 0, 100); return { kept, broken, inPower }; }
  const dTrust = kept * 4 - broken * 5;
  me.trust = clamp((me.trust ?? 50) + dTrust, 0, 100);
  addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'aftonbladet']), headline: broken > kept ? `Löfteskollen: ${me.abbr} svek ${broken} av ${m.promises.length} vallöften` : `Löfteskollen: ${me.abbr} höll ${kept} av ${m.promises.length} vallöften`, body: `Infriat: ${m.promises.filter((p) => p.kept).map((p) => p.text).join(', ') || 'inget'}. Brutet: ${m.promises.filter((p) => !p.kept).map((p) => p.text).join(', ') || 'inget'}. ${broken > kept ? '"Väljarna förtjänar bättre", säger oppositionen.' : 'Partiet lyfter fram resultatet i valrörelsen.'}`, tags: ['val', 'politik'], partyId: me.id, importance: 3, tone: broken > kept ? -1 : 1 });
  return { kept, broken, inPower };
}
// Förtroende glider mot 50 och påverkas av skandalsvar, kappvändningar och löften (anropas veckovis)
export function updateTrust(state) {
  for (const p of Object.values(state.parties)) {
    if (p.active === false) continue;
    p.trust = clamp((p.trust ?? 50) + (50 - (p.trust ?? 50)) * .01, 0, 100);
  }
}
export const trustLabel = (v) => v >= 70 ? 'Mycket högt' : v >= 58 ? 'Högt' : v >= 42 ? 'Normalt' : v >= 30 ? 'Lågt' : 'Mycket lågt';
export const promiseIssue = (p) => ISSUE_BY_ID[p.issue]?.name || '';
