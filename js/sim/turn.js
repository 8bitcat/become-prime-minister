// Veckoloopen + spelarens handlingar. Allt som händer mellan två veckor sker i endWeek.
import { ISSUES, ISSUE_BY_ID } from '../data/issues.js';
import { REGIONS } from '../data/regions.js';
import { SEGMENTS } from '../data/segments.js';
import { addDays, cmpDate, dayDiff, clamp, pick, gauss, kr } from '../core/util.js';
import { stepMonth } from './sweden.js';
import { updateOpinion, updateSalience, makePoll, updateGovApproval, updateLeaderApproval, activeParties, growBase } from './opinion.js';
import { aiProposals, resolveVote, BILL_BY_ID, proposeBill, stance } from './riksdag.js';
import { rollEvents } from './events.js';
import { rollScandals, decayScandals } from './scandals.js';
import { weeklySocial } from './social.js';
import { stepWorld } from './world.js';
import { addNews, newsFromNotes, newsFromPoll, weeklyFlavor } from './news.js';
import { computeElection } from './election.js';
import { isPlayerPM, playerInGov, aiBudget, dissolveGovernment, formGovernmentAI } from './government.js';
import { makePerson } from './people.js';

const me = (s) => s.parties[s.player.partyId];
const leader = (s) => s.people[me(s).leader];
export const queue = (s, item) => { s.queue.push(item); };

// ---------- VECKANS SLUT ----------
export function endWeek(state, rnd) {
  const report = { week: state.week + 1, items: [], newsFrom: state.news[0]?.id || null, pollWeek: null };
  const prevDate = state.date;
  state.week++; state.stats.weeks++;
  state.date = addDays(state.date, 7);
  state.ap = state.apMax;
  const p = me(state);
  const newMonth = state.date.m !== prevDate.m;
  const newYear = state.date.y !== prevDate.y;

  // --- pengar ---
  const { income: weeklyIncome, cost: weeklyCost } = weeklyMoney(state);
  p.money += weeklyIncome - weeklyCost;
  if (p.money < 0) { p.org = clamp(p.org - 2, 1, 100); report.items.push(`⚠️ Partikassan är tom – organisationen krymper (org ${p.org}).`); }

  // --- månadssteg ---
  if (newMonth) {
    const notes = stepMonth(state, rnd);
    newsFromNotes(state, rnd, notes);
    updateSalience(state);
    stepWorld(state, rnd);
    state.riksdag.session = ![7, 8].includes(state.date.m); // sommaruppehåll
    if (state.riksdag.session) aiProposals(state, rnd);
    if (state.date.m === 10 && state.government.pmParty) {
      if (isPlayerPM(state)) queue(state, { type: 'budget' });
      else { const ch = aiBudget(state, rnd); if (ch?.length) addNews(state, { outlet: 'svt', headline: `Regeringens budget: ${ch[0].label.toLowerCase()}`, body: ch.map((c) => c.label).join(', ') + '. Oppositionen sågar budgeten.', tags: ['politik', 'ekonomi'], importance: 2 }); }
    }
    state.riksdag.passedRecently = Math.max(0, (state.riksdag.passedRecently || 0) - 1);
    aiPartyMonth(state, rnd);
    for (const sc of notes) report.items.push(`📊 ${sc.text}.`);
  }
  if (newYear) { for (const per of Object.values(state.people)) per.age++; p.members = Math.round(p.members * (1 + (p.momentum || 0) * .05)); }

  // --- riksdagen: omröstningar ---
  for (const item of state.riksdag.bills) {
    if (item.status !== 'pending' || item.voteWeek > state.week) continue;
    if (p.inRiksdag && (state.riksdag.seats[p.id] || 0) > 0) { queue(state, { type: 'vote', billItemId: item.id }); item.status = 'voting'; }
    else { const r = resolveVote(state, rnd, item, null); billNews(state, rnd, item, r); report.items.push(`🏛️ ${r.bill.title}: ${r.passed ? 'antogs' : 'föll'} (${r.ja}–${r.nej}).`); }
  }
  // skulder från förhandlingar som aldrig löstes in bleknar
  state.riksdag.owed = (state.riksdag.owed || []).filter((o) => state.week - o.week < 40);

  // --- partierna ---
  aiPartyWeek(state, rnd);
  p.attention = clamp(p.attention * .9 + (p.inRiksdag ? 1.5 : .1), 0, 100);
  p.unity = clamp(p.unity + (65 - p.unity) * .03, 0, 100);
  p.credibility = clamp(p.credibility + (50 - p.credibility) * .02, 0, 100);
  p.risk = Math.max(0, (p.risk || 0) * .985);
  p.fundFatigue = Math.max(0, (p.fundFatigue || 0) - 1);

  // --- händelser, skandaler, sociala medier ---
  for (const ev of rollEvents(state, rnd)) queue(state, ev.kind === 'interview' ? { type: 'interview' } : ev.kind === 'debate' ? { type: 'debate', debate: ev.debate } : { type: 'event', event: ev });
  for (const sc of rollScandals(state, rnd)) queue(state, { type: 'scandal', scandalId: sc.id });
  decayScandals(state, rnd);
  for (const po of weeklySocial(state, rnd)) queue(state, { type: 'resurfaced', postId: po.id });
  weeklyFlavor(state, rnd);

  // --- opinion ---
  updateGovApproval(state);
  updateLeaderApproval(state);
  growBase(state);
  updateOpinion(state);
  const poll = makePoll(state, rnd);
  newsFromPoll(state, rnd, poll);
  report.poll = poll;

  // --- valkalendern ---
  electionCalendar(state, rnd, report);

  // --- regeringskris? ---
  if (state.government.pm && (state.government.crisis || 0) > 6 && rnd() < .15) {
    const pmP = state.parties[state.government.pmParty];
    addNews(state, { outlet: 'svt', headline: `Regeringskris: ${pmP.abbr}-regeringen faller`, body: 'Efter upprepade nederlag i riksdagen avgår regeringen. Talmannen inleder nya sonderingar.', tags: ['politik'], importance: 3 });
    dissolveGovernment(state, 'kris');
    queue(state, { type: 'formation', reason: 'kris' });
  }
  if (!state.government.pm && state.government.type === 'caretaker' && !state.queue.some((q) => q.type === 'formation') && !state.election.campaign) {
    // expeditionsministär – talmannen försöker igen efter några veckor
    state.government.weeksWithout = (state.government.weeksWithout || 0) + 1;
    if (state.government.weeksWithout % 4 === 0) queue(state, { type: 'formation', reason: 'ny_runda', round: Math.floor(state.government.weeksWithout / 4) });
  }

  // --- rapport sist i kön ---
  state.log.unshift({ week: state.week, date: { ...state.date }, items: report.items });
  if (state.log.length > 200) state.log.pop();
  queue(state, { type: 'report', report });
  return report;
}

function billNews(state, rnd, item, r) {
  const prop = state.parties[item.proposer];
  addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'ekot', 'svd']), headline: r.passed ? `Riksdagen antog: ${r.bill.title}` : `Riksdagen fällde ${prop.abbr}:s förslag om ${r.bill.title.toLowerCase()}`, body: `${r.ja} ja, ${r.nej} nej, ${r.avst} avstod. ${r.passed ? 'Förslaget träder i kraft inom kort.' : 'Förslaget faller.'}`, tags: ['riksdag', r.bill.area], importance: r.passed ? 2 : 1 });
}

// AI-partiernas vecka: uppmärksamhet, relationer, små rörelser
function aiPartyWeek(state, rnd) {
  for (const q of activeParties(state)) {
    if (q.isPlayer) continue;
    q.attention = clamp(q.attention * .95 + 1.5 + (q.seats || 0) * .02 + (rnd() < .1 ? 8 : 0), 0, 100);
    q.unity = clamp(q.unity + (68 - q.unity) * .03 + gauss(rnd, 0, .8), 0, 100);
    q.credibility = clamp(q.credibility + (55 - q.credibility) * .02, 0, 100);
    for (const k in q.relations) q.relations[k] = q.relations[k] * .99;
  }
}
// AI-partiernas månad: positionsglidning mot egna väljare, ledarbyte vid ålder
function aiPartyMonth(state, rnd) {
  for (const q of activeParties(state)) {
    if (q.isPlayer) continue;
    // glid mot de egna väljarnas ideal (viktat med hur många i gruppen som röstar på partiet)
    for (const is of ISSUES) {
      let ideal = 0, w = 0;
      for (const sg of SEGMENTS) { const sh = (state.opinion.seg[sg.id]?.[q.id] || 0) * sg.share; ideal += sg.ideal[is.id] * sh; w += sh; }
      if (w) q.pos[is.id] = clamp(q.pos[is.id] + ((ideal / w) - q.pos[is.id]) * .015, -100, 100);
    }
    const l = state.people[q.leader];
    if (l && (l.age >= 68 || l.approval < 20) && rnd() < .06) {
      l.role = 'mp';
      const next = (q.people || []).map((id) => state.people[id]).filter((x) => x && x.alive && x.age < 64).sort((a, b) => (b.traits.ledarskap + b.traits.karisma) - (a.traits.ledarskap + a.traits.karisma))[0] || (() => { const np = makePerson(rnd, { partyId: q.id, role: 'leader' }); state.people[np.id] = np; q.people.push(np.id); return np; })();
      q.leader = next.id; next.role = 'leader'; next.since = { ...state.date }; next.approval = 40;
      if (state.government.pm === l.id) state.government.pm = next.id;
      addNews(state, { outlet: 'svt', headline: `${next.name} ny partiledare för ${q.name}`, body: `${l.name} lämnar efter ${l.approval < 20 ? 'svaga opinionssiffror' : 'många år i politiken'}. ${state.government.pm === next.id ? next.name + ' blir därmed också ny statsminister.' : ''}`, tags: ['parti'], partyId: q.id, importance: 3 });
    }
  }
}

// ---------- VALKALENDERN ----------
function electionCalendar(state, rnd, report) {
  const el = state.election;
  const days = dayDiff(state.date, el.next);
  if (!el.campaign && days <= 56 && days > 0) {
    el.campaign = true; el.debatesDone = []; el.campaignNoise = 1;
    addNews(state, { outlet: 'svt', headline: `Valrörelsen drar igång – ${Math.round(days / 7)} veckor kvar till valet`, body: 'Partiledarna ger sig ut på turné. Opinionsinstituten lovar mätningar varje vecka.', tags: ['val'], importance: 3 });
    report.items.push('🗳️ Valrörelsen har börjat! Du har extra kampanjhandlingar i åtta veckor.');
    state.apMax = 5; state.ap = 5;
  }
  if (el.campaign) {
    const wk = Math.round(days / 7);
    const plan = { 6: { host: 'tv4', name: 'TV4:s partiledardebatt' }, 4: { host: 'aftonbladet', name: 'Aftonbladets partiledardebatt' }, 1: { host: 'svt', name: 'SVT:s slutdebatt' } };
    if (plan[wk] && !el.debatesDone.includes(wk) && (me(state).inRiksdag || (state.opinion.support[me(state).id] || 0) > 2.5)) { el.debatesDone.push(wk); queue(state, { type: 'debate', debate: 'tv', campaign: true, host: plan[wk].host, name: plan[wk].name }); }
  }
  if (days <= 0 && !el.pending) {
    el.pending = computeElection(state, rnd);
    queue(state, { type: 'election' });
    state.apMax = 4;
  }
}

// ---------- SPELARENS HANDLINGAR ----------
export const ACTIONS = [
  { id: 'press', name: 'Presskonferens', ic: '🎤', ap: 1, desc: 'Håll presskonferens i en fråga. Ger uppmärksamhet och sätter dagordningen. Journalister kan vilja intervjua dig.', needs: 'issue' },
  { id: 'turne', name: 'Turné & tal', ic: '🚌', ap: 2, money: (s) => me(s).inRiksdag ? 150000 : 15000, desc: 'Res till ett län, håll tal och möt väljare. Kännedom och stöd i regionen ökar.', needs: 'region' },
  { id: 'utspel', name: 'Politiskt utspel', ic: '📣', ap: 1, desc: 'Lansera ett konkret förslag i en fråga. Sätter frågan på dagordningen och profilerar partiet.', needs: 'issue' },
  { id: 'angrepp', name: 'Angrip motståndare', ic: '⚔️', ap: 1, desc: 'Gå till angrepp mot ett annat parti i en fråga. Uppmärksamhet – men relationerna surnar och risken ökar.', needs: 'party_issue' },
  { id: 'medlem', name: 'Medlemsvärvning', ic: '👥', ap: 1, desc: 'Kampanj för nya medlemmar. Fler medlemmar = mer pengar och starkare organisation.' },
  { id: 'insamling', name: 'Insamling', ic: '💰', ap: 1, desc: 'Ring givare och samla in pengar. Beloppet beror på medlemmar, uppmärksamhet och ledarens sociala förmåga.' },
  { id: 'org', name: 'Bygg organisationen', ic: '🏗️', ap: 1, money: (s) => 20000 + me(s).org * 3000, desc: 'Anställ, öppna lokalavdelningar, utbilda. Organisationen ger kraft i valrörelsen.' },
  { id: 'program', name: 'Ändra partiprogrammet', ic: '📜', ap: 1, desc: 'Flytta partiets position i en fråga. Nya väljare kan lockas – men trovärdigheten tar stryk om ni vinglar.', needs: 'issue_shift' },
  { id: 'motion', name: 'Lägg fram lagförslag', ic: '🏛️', ap: 1, desc: 'Lägg en motion i riksdagen. Omröstning om tre veckor. Förhandla med andra partier för att få stöd.', needs: 'bill', cond: (s) => me(s).inRiksdag && (s.riksdag.seats[me(s).id] || 0) > 0 && s.riksdag.session },
  { id: 'forhandla', name: 'Förhandla om ett förslag', ic: '🤝', ap: 1, desc: 'Sök stöd från ett annat parti för ditt liggande förslag. De kommer att ställa krav.', needs: 'negotiate', cond: (s) => s.riksdag.bills.some((b) => b.status === 'pending' && b.byPlayer) },
  { id: 'samtal', name: 'Bygg relationer', ic: '☕', ap: 1, desc: 'Ät lunch med en annan partiledare. Bättre relationer gör samarbete och regeringsbildning möjlig.', needs: 'party' },
  { id: 'reklam', name: 'Reklamkampanj', ic: '📺', ap: 1, money: (s) => me(s).inRiksdag ? 2000000 : 200000, desc: 'Köp annonser i TV, tidningar och sociala medier. Kännedom och stöd ökar brett.', cond: (s) => s.election.campaign },
  { id: 'dorr', name: 'Dörrknackning', ic: '🚪', ap: 1, desc: 'Mobilisera medlemmarna att knacka dörr. Effekten beror på organisationens styrka.', cond: (s) => s.election.campaign },
  { id: 'vila', name: 'Strategimöte / vila', ic: '🧘', ap: 0, desc: 'Avsluta veckan i lugn och ro. Partiets sammanhållning stärks något.' },
];
export const actionAvailable = (s, a) => (!a.cond || a.cond(s)) && s.ap >= a.ap && (!a.money || me(s).money >= a.money(s));

export function doAction(state, rnd, id, params = {}) {
  const a = ACTIONS.find((x) => x.id === id);
  const p = me(state), l = leader(state);
  if (!actionAvailable(state, a)) return { ok: false, text: 'Inte möjligt just nu.' };
  state.ap -= a.ap;
  if (a.money) p.money -= a.money(state);
  const aw = () => state.opinion.awareness[p.id] ?? 1;
  const bumpAw = (v) => { if (aw() < 1) state.opinion.awareness[p.id] = clamp(aw() + v, 0, 1); };
  const kar = (l.traits.karisma - 45) / 100, ret = (l.traits.retorik - 45) / 100, soc = (l.traits.social - 45) / 100;
  const att = (v) => { p.attention = clamp(p.attention + v * (1 - p.attention / 130), 0, 100); }; // avtagande
  let text = '';
  switch (id) {
    case 'press': {
      const is = ISSUE_BY_ID[params.issue];
      const hit = clamp(.35 + ret * .6 + (p.credibility - 50) / 200 + (state.opinion.salience[is.id] - 1) * .3, .05, .95);
      att(4 + hit * 6); bumpAw(.01 + hit * .02);
      state.opinion.boost[is.id] = (state.opinion.boost[is.id] || 0) + .15;
      const good = rnd() < hit;
      addNews(state, { outlet: pick(rnd, ['svt', 'tv4', 'dn', 'ekot']), headline: good ? `${p.abbr} kräver nytag om ${is.name.toLowerCase()}` : `${p.abbr}:s presskonferens om ${is.name.toLowerCase()} – "inget nytt"`, body: good ? `${l.name} presenterade partiets linje: ${is.name.toLowerCase()} ska ${p.pos[is.id] < 0 ? is.left.toLowerCase() : is.right.toLowerCase()}. "Äntligen ett tydligt besked", säger en kommentator.` : `Journalisterna var fåtaliga och frågorna kritiska. ${l.name} svarade undvikande.`, tags: ['politik', is.id], partyId: p.id, importance: good ? 2 : 1 });
      if (good) { p.credibility = clamp(p.credibility + 1.5, 0, 100); if (rnd() < .4) queue(state, { type: 'interview', issue: is.id }); }
      text = good ? 'Presskonferensen fick bra genomslag.' : 'Presskonferensen blev ingen succé.';
      break;
    }
    case 'turne': {
      const r = REGIONS.find((x) => x.id === params.region);
      const eff = (.6 + kar) * (1 + (p.org / 100) * .5);
      bumpAw(.02 * eff); att(3);
      for (const sg of SEGMENTS) { const w = (r.seg[sg.id] || 1); const seg = state.opinion.seg[sg.id]; if (seg) seg[p.id] = Math.max(.01, (seg[p.id] || .1) + .12 * eff * w * (r.pop / 10650) * 8); }
      (state.opinion.regionBoost ||= {})[r.id] = (state.opinion.regionBoost[r.id] || 0) + 1.5 * eff;
      addNews(state, { outlet: pick(rnd, ['svt', 'tv4', r.id === 'O' ? 'gp' : r.id === 'M' ? 'sydsvenskan' : r.id === 'BD' ? 'nsd' : 'svt']), headline: `${l.name} på turné i ${r.name}: "${pick(rnd, ['Ni är inte bortglömda', 'Hela landet ska leva', 'Vi hör er', 'Det här är Sveriges hjärta'])}"`, body: `${pick(rnd, ['Flera hundra', 'Ett femtiotal', 'Över tusen', 'Några dussin'])} personer kom för att lyssna. ${kar > .1 ? 'Stämningen var elektrisk.' : 'Mottagandet var artigt.'}`, tags: ['kampanj'], partyId: p.id, importance: 1 });
      text = `Turnén i ${r.name} genomförd.`;
      break;
    }
    case 'utspel': {
      const is = ISSUE_BY_ID[params.issue];
      state.opinion.boost[is.id] = (state.opinion.boost[is.id] || 0) + .3;
      att(6); bumpAw(.02); p.profile[is.id] = Math.min(2.5, (p.profile[is.id] || 1) + .15);
      (p.promises ||= []).push({ issue: is.id, week: state.week, text: `${is.name}: ${p.pos[is.id] < 0 ? is.left : is.right}` });
      addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen', 'dn', 'svt']), headline: `${p.abbr}:s nya förslag om ${is.name.toLowerCase()}`, body: `${l.name} lovar att ${p.pos[is.id] < 0 ? is.left.toLowerCase() : is.right.toLowerCase()} blir partiets viktigaste fråga. ${pick(rnd, ['Motståndarna kallar det ofinansierat.', 'Förslaget välkomnas av intresseorganisationer.', 'Experter är skeptiska till genomförbarheten.', 'Utspelet dominerar dagens nyhetsflöde.'])}`, tags: ['politik', is.id], partyId: p.id, importance: 2 });
      text = `Utspelet om ${is.name.toLowerCase()} gjordes – frågan är nu hetare.`;
      break;
    }
    case 'angrepp': {
      const tgt = state.parties[params.party]; const is = ISSUE_BY_ID[params.issue];
      const ok = rnd() < clamp(.4 + ret * .5 + (l.traits.aggressivitet - 45) / 300, .1, .9);
      att(5); bumpAw(.015);
      tgt.relations[p.id] = clamp((tgt.relations[p.id] || 0) - 10, -100, 100);
      p.risk = (p.risk || 0) + 3;
      if (ok) { tgt.credibility = clamp(tgt.credibility - 2, 0, 100); tgt.attention = clamp(tgt.attention + 3, 0, 100); }
      else p.credibility = clamp(p.credibility - 2, 0, 100);
      addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen', 'tv4']), headline: ok ? `${l.name} sågar ${tgt.abbr}: "${pick(rnd, ['De har svikit', 'Ansvarslöst', 'Ett hot mot Sverige', 'Rena fantasier'])}"` : `${l.name}s angrepp på ${tgt.abbr} slår tillbaka`, body: ok ? `Angreppet gäller ${tgt.abbr}:s linje om ${is.name.toLowerCase()}. ${state.people[tgt.leader].name} svarar: "${pick(rnd, ['Lågt', 'Vi svarar inte på smutskastning', 'Sakpolitik, tack'])}".` : `Kritiker menar att ${p.abbr} ägnar sig åt personangrepp i stället för politik.`, tags: ['politik', is.id], partyId: p.id, importance: 2, tone: ok ? 0 : -1 });
      text = ok ? 'Angreppet träffade.' : 'Angreppet slog tillbaka mot dig själv.';
      break;
    }
    case 'medlem': { const n = Math.round((40 + p.attention * 12 + p.members * .02) * (1 + soc * .5) * (1 + aw() * .5)); p.members += n; p.org = clamp(p.org + 1, 0, 100); text = `${n} nya medlemmar (nu ${p.members}).`; break; }
    case 'insamling': { const fatigue = 1 / (1 + (p.fundFatigue || 0) * .5); const sum = Math.round((p.members * 30 + p.attention * 1500 + (p.inRiksdag ? 150000 : 10000)) * (1 + soc * .8) * (.7 + rnd() * .6) * fatigue); p.money += sum; p.fundFatigue = (p.fundFatigue || 0) + 4; if (rnd() < .08) p.risk = (p.risk || 0) + 8; text = `Insamlingen gav ${kr(sum)}${fatigue < .7 ? ' – givarna börjar tröttna' : ''}.`; break; }
    case 'org': { const d = Math.round(4 + (l.traits.ledarskap - 45) / 15); p.org = clamp(p.org + d, 0, 100); text = `Organisationen växer (org ${p.org}).`; break; }
    case 'program': {
      const is = ISSUE_BY_ID[params.issue]; const amount = clamp(params.amount || 0, -20, 20);
      const old = p.pos[is.id]; p.pos[is.id] = clamp(old + amount, -100, 100);
      const cost = Math.abs(amount) / 10 * (1.5 + (p.inRiksdag ? 1 : 0));
      p.credibility = clamp(p.credibility - cost, 0, 100); p.unity = clamp(p.unity - Math.abs(amount) / 5, 0, 100);
      addNews(state, { outlet: pick(rnd, ['dn', 'svd', 'svt']), headline: `${p.abbr} byter fot om ${is.name.toLowerCase()}`, body: `Partiet ${amount > 0 ? 'rör sig åt höger' : 'rör sig åt vänster'} i frågan. ${pick(rnd, ['"Ett naturligt steg", säger partiledningen.', 'Gräsrötter protesterar.', 'Motståndarna talar om "politisk kappvändning".'])}`, tags: ['parti', is.id], partyId: p.id, importance: 1 });
      text = `Positionen i ${is.name.toLowerCase()} ändrad (${old} → ${p.pos[is.id]}). Trovärdighet −${cost.toFixed(1)}.`;
      break;
    }
    case 'motion': { const bill = BILL_BY_ID[params.bill]; const item = proposeBill(state, rnd, p.id, bill.id, { byPlayer: true }); addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'ekot']), headline: `${p.abbr} lägger fram: ${bill.title}`, body: `${bill.desc} Omröstning i riksdagen om tre veckor. ${activeParties(state).filter((q) => !q.isPlayer && q.inRiksdag && stance(q, bill) > .3).map((q) => q.abbr).join(', ') || 'Inget parti'} väntas ge stöd.`, tags: ['riksdag', bill.area], partyId: p.id, importance: 2 }); att(3); text = `Motionen "${bill.title}" är inlämnad (omröstning vecka ${item.voteWeek}).`; break; }
    case 'samtal': { const q = state.parties[params.party]; const d = Math.round(6 + soc * 10 + (rnd() * 6 - 2)); q.relations[p.id] = clamp((q.relations[p.id] || 0) + d, -100, 100); p.relations[q.id] = clamp((p.relations[q.id] || 0) + d, -100, 100); text = `Lunchen med ${state.people[q.leader].name} (${q.abbr}) gick ${d > 8 ? 'utmärkt' : d > 3 ? 'bra' : 'sådär'} (relation ${q.relations[p.id]}).`; break; }
    case 'reklam': { const eff = p.inRiksdag ? 1 : 1.6; bumpAw(.04 * eff); att(6); for (const sg of SEGMENTS) { const seg = state.opinion.seg[sg.id]; if (seg) seg[p.id] = Math.max(.01, (seg[p.id] || .1) * (1 + .03 * eff * sg.media)); } text = 'Reklamkampanjen rullar i hela landet.'; break; }
    case 'dorr': { const eff = (p.org / 100) * (p.members / 20000 + .3); for (const sg of SEGMENTS) { const seg = state.opinion.seg[sg.id]; if (seg) seg[p.id] = Math.max(.01, (seg[p.id] || .1) + .25 * eff); } bumpAw(.02 * eff); text = `Dörrknackningen nådde ${Math.round(p.members * 8 * eff)} hushåll.`; break; }
    case 'vila': { p.unity = clamp(p.unity + 2, 0, 100); state.ap = 0; text = 'Veckan avslutas i lugn och ro.'; break; }
  }
  (state.log[0] ||= { week: state.week, date: { ...state.date }, items: [] }).items.push(`${a.ic} ${a.name}: ${text}`);
  return { ok: true, text };
}

export const weeklyMoney = (s) => { const p = me(s); const seats = s.riksdag.seats[p.id] || 0; return { income: p.members * 14 + seats * 12000 + (p.inRiksdag ? 80000 : 0), cost: 500 + p.org * p.org * 15 + seats * 14000 + (p.inRiksdag ? 150000 : 0) }; };
