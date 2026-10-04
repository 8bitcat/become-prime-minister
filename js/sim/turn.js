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
import { monthlyParty, installLeader, structureEffects, defaultStructure } from './party.js';
import { weeklyMedia } from './media.js';
import { updateTrust, checkPromises, setManifest } from './promises.js';
import { IDEOLOGIES, IDEOLOGY_BY_ID } from '../data/ideologies.js';
import { stepReforms, capitalRegen, aiGovernmentReforms, aiProgramDrift, syncAxes, programFromAxes, axesFromProgram, proposeReform, reformCost, POLICY_BY_ID, policyLabel, reformTitle } from './policy.js';

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
    stepReforms(state, rnd);
    capitalRegen(state);
    const notes = stepMonth(state, rnd);
    newsFromNotes(state, rnd, notes);
    updateSalience(state);
    stepWorld(state, rnd);
    state.riksdag.session = ![7, 8].includes(state.date.m); // sommaruppehåll
    if (state.riksdag.session) { aiProposals(state, rnd); aiGovernmentReforms(state, rnd); }
    if (state.date.m === 10 && state.government.pmParty) {
      if (isPlayerPM(state)) queue(state, { type: 'budget' });
      else { const ch = aiBudget(state, rnd); if (ch?.length) addNews(state, { outlet: 'svt', headline: `Regeringens budget: ${ch[0].label.toLowerCase()}`, body: ch.map((c) => c.label).join(', ') + '. Oppositionen sågar budgeten.', tags: ['politik', 'ekonomi'], importance: 2 }); }
    }
    state.riksdag.passedRecently = Math.max(0, (state.riksdag.passedRecently || 0) - 1);
    aiPartyMonth(state, rnd);
    for (const it of monthlyParty(state, rnd)) queue(state, it);
    for (const sc of notes) report.items.push(`📊 ${sc.text}.`);
  }
  if (newYear) { for (const per of Object.values(state.people)) per.age++; p.members = Math.round(p.members * (1 + (p.momentum || 0) * .05)); yearlyParties(state, rnd); const lead = leader(state); if (lead.age >= 68 && rnd() < .35) queue(state, { type: 'retire' }); }

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
  for (const it of weeklyMedia(state, rnd)) queue(state, it);
  updateTrust(state);

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
    // glid mot de egna väljarnas ideal – genom att nudga programmet (ideologin härleds ur politiken)
    const delta = {};
    for (const is of ISSUES) {
      let ideal = 0, w = 0;
      for (const sg of SEGMENTS) { const sh = (state.opinion.seg[sg.id]?.[q.id] || 0) * sg.share; ideal += sg.ideal[is.id] * sh; w += sh; }
      if (w) delta[is.id] = ((ideal / w) - q.pos[is.id]) * .015;
    }
    if (q.program) aiProgramDrift(state, rnd, q, delta); else for (const k in delta) q.pos[k] = clamp(q.pos[k] + delta[k], -100, 100);
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
    const pc = checkPromises(state, rnd); if (pc) report.items.push(`📋 Löfteskollen: ${pc.kept} hållna, ${pc.broken} brutna${pc.inPower ? '' : ' (ni satt i opposition)'}.`);
    if (!me(state).manifest || me(state).manifest.year !== el.next.y) queue(state, { type: 'manifest' });
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
  { id: 'program_policy', name: 'Ändra partiprogrammet', ic: '📜', ap: 1, desc: 'Ställ in partiets ståndpunkt i över hundra politikområden. Ideologin och axlarna räknas ut ur politiken. Många ändringar på en gång kostar trovärdighet.', needs: 'program' },
  { id: 'reform', name: 'Föreslå reform', ic: '⚖️', ap: 1, desc: 'Föreslå att en lag ändras – skatter, migration, välfärd, försvar, vad som helst i politiken. Omröstning om tre veckor. Som statsminister kostar det politiskt kapital.', needs: 'reform', cond: (s) => me(s).inRiksdag && (s.riksdag.seats[me(s).id] || 0) > 0 && s.riksdag.session },
  { id: 'motion', name: 'Lägg fram lagförslag', ic: '🏛️', ap: 1, desc: 'Lägg en motion i riksdagen. Omröstning om tre veckor. Förhandla med andra partier för att få stöd.', needs: 'bill', cond: (s) => me(s).inRiksdag && (s.riksdag.seats[me(s).id] || 0) > 0 && s.riksdag.session },
  { id: 'forhandla', name: 'Förhandla om ett förslag', ic: '🤝', ap: 1, desc: 'Sök stöd från ett annat parti för ditt liggande förslag. De kommer att ställa krav.', needs: 'negotiate', cond: (s) => s.riksdag.bills.some((b) => b.status === 'pending' && b.byPlayer) },
  { id: 'samtal', name: 'Bygg relationer', ic: '☕', ap: 1, desc: 'Ät lunch med en annan partiledare. Bättre relationer gör samarbete och regeringsbildning möjlig.', needs: 'party' },
  { id: 'reklam', name: 'Reklamkampanj', ic: '📺', ap: 1, money: (s) => me(s).inRiksdag ? 2000000 : 200000, desc: 'Köp annonser i TV, tidningar och sociala medier. Kännedom och stöd ökar brett.', cond: (s) => s.election.campaign },
  { id: 'dorr', name: 'Dörrknackning', ic: '🚪', ap: 1, desc: 'Mobilisera medlemmarna att knacka dörr. Effekten beror på organisationens styrka.', cond: (s) => s.election.campaign },
  { id: 'kongress', name: 'Partikongress', ic: '🏟️', ap: 2, desc: 'Ändra stadgar, maktfördelning och målgrupper. Kostar sammanhållning – men formar partiet för lång tid.', needs: 'structure', cond: (s) => !s.election.campaign },
  { id: 'manifest', name: 'Valmanifest', ic: '📋', ap: 1, desc: 'Välj 3–5 vallöften inför nästa val. Medierna granskar dem efteråt – svikna löften kostar förtroende.', needs: 'manifest', cond: (s) => dayDiff(s.date, s.election.next) < 420 && (!me(s).manifest || me(s).manifest.year !== s.election.next.y) },
  { id: 'avga', name: 'Lämna partiledarposten', ic: '🚪', ap: 0, desc: 'Avgå som partiledare. Världen fortsätter – du fortsätter med en efterträdare, befintlig eller ny.', needs: 'succession' },
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
    case 'medlem': { const cap = 1500 + (state.opinion.support[p.id] || 0) * 7000 + aw() * 2500 + (p.localBase?.kommuner || 0) * 120; const raw = Math.round((40 + p.attention * 6 + Math.min(p.members, 20000) * .01) * (1 + soc * .5) * (1 + aw() * .5) * structureEffects(p).growth); const n = Math.max(5, Math.min(raw, Math.round(Math.max(0, cap - p.members) * .3) + 5)); p.members += n; p.org = clamp(p.org + 1, 0, 100); text = `${n} nya medlemmar (nu ${p.members}).${n < raw * .5 ? ' Intresset är mättat – väx i opinionen först.' : ''}`; break; }
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
    case 'kongress': {
      const S = p.structure || (p.structure = defaultStructure()); const N = params.structure || {};
      let changed = 0; for (const k of ['centralisering', 'ledarmakt', 'lokalAutonomi', 'bredd']) { if (N[k] != null && Math.abs(N[k] - S[k]) >= 5) changed++; if (N[k] != null) S[k] = N[k]; }
      for (const k of ['ledarval', 'kandidatval', 'stadgar']) { if (N[k] && N[k] !== S[k]) changed++; if (N[k]) S[k] = N[k]; }
      if (N.ungdom != null && N.ungdom !== S.ungdom) { changed++; S.ungdom = N.ungdom; }
      if (N.malgrupper) { const a = new Set(S.malgrupper || []), b = new Set(N.malgrupper); if ([...a].some((x) => !b.has(x)) || [...b].some((x) => !a.has(x))) changed++; S.malgrupper = [...N.malgrupper]; }
      p.unity = clamp(p.unity - 4 - changed * 3 + (l.traits.ledarskap - 45) / 10, 0, 100); att(5);
      for (const f of p.factions || []) f.mood = clamp(f.mood + (changed ? -8 : 4), -100, 100);
      addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'ekot']), headline: changed ? `${p.abbr}:s kongress: ${changed} stora förändringar i stadgar och organisation` : `${p.abbr} höll kongress – inga stora förändringar`, body: changed ? `${l.name} fick igenom sin linje. ${pick(rnd, ['Delar av partiet muttrar om toppstyre.', 'Gräsrötterna är splittrade.', 'Kommentatorer talar om ett nytt kapitel för partiet.'])}` : 'Ledningen fick förnyat förtroende.', tags: ['parti'], partyId: p.id, importance: changed ? 2 : 1 });
      text = changed ? `Kongressen antog ${changed} förändring${changed > 1 ? 'ar' : ''} (sammanhållning ${p.unity.toFixed(0)}).` : 'Kongressen genomförd utan större förändringar.';
      break;
    }
    case 'manifest': { setManifest(state, params.billIds || []); text = `Valmanifestet med ${(params.billIds || []).length} löften är presenterat.`; break; }
    case 'reform': {
      const pol = POLICY_BY_ID[params.policyId]; const to = params.to;
      if (isPlayerPM(state)) { const cost = reformCost(pol, state.policy[pol.id], to); state.government.capital = Math.max(0, (state.government.capital ?? 50) - cost); }
      const item = proposeReform(state, rnd, p.id, pol.id, to, { byPlayer: true });
      att(4);
      addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'ekot']), headline: `${p.abbr} föreslår: ${reformTitle(pol, to).toLowerCase()}`, body: `${pol.desc || ''} Gällande lag: ${policyLabel(pol, state.policy[pol.id])}. Omröstning om tre veckor.`, tags: ['riksdag'], partyId: p.id, importance: 2 });
      text = `Reformförslaget "${reformTitle(pol, to)}" är inlämnat (omröstning vecka ${item.voteWeek}).`;
      break;
    }
    case 'program_policy': {
      const changes = params.changes || {}; let nChanged = 0;
      p.program ||= programFromAxes(p.pos);
      for (const id in changes) { if (p.program[id] !== changes[id]) { p.program[id] = changes[id]; nChanged++; } }
      syncAxes(p);
      const cost = Math.min(6, nChanged * .6) * (p.inRiksdag ? 1.3 : 1);
      p.credibility = clamp(p.credibility - cost, 0, 100); p.unity = clamp(p.unity - Math.min(5, nChanged * .4), 0, 100);
      for (const f of p.factions || []) f.mood = clamp(f.mood - nChanged * .5, -100, 100);
      if (nChanged >= 3) addNews(state, { outlet: pick(rnd, ['dn', 'svd', 'svt']), headline: `${p.abbr} skriver om partiprogrammet på ${nChanged} punkter`, body: `${pick(rnd, ['Kritiker talar om kappvändning.', 'Partiet säger sig lyssna på väljarna.', 'Gräsrötterna är delade.'])}`, tags: ['parti'], partyId: p.id, importance: 1 });
      text = nChanged ? `${nChanged} punkter i programmet ändrade (trovärdighet −${cost.toFixed(1)}).` : 'Inga ändringar.';
      break;
    }
    case 'avga': {
      const next = state.people[params.successorId]; if (!next) { text = 'Ingen efterträdare vald.'; break; }
      installLeader(state, p, next, 'avgång'); state.player.leaderId = next.id; next.ambition = 80; next.loyalty = 99;
      p.unity = clamp(p.unity + 4, 0, 100); att(10); p.momentum = (p.momentum || 0) - .2;
      state.history.timeline.push({ date: { ...state.date }, week: state.week, kind: 'ledare', text: `${next.name} ny partiledare för ${p.name} efter ${l.name}.` });
      addNews(state, { outlet: 'svt', headline: `${l.name} avgår – ${next.name} ny partiledare för ${p.name}`, body: `${l.name} lämnar efter ${Math.max(0, state.date.y - (l.since?.y || state.date.y))} år. ${next.name}, ${next.age}, ${next.bg.yrke.toLowerCase()}, tar över${state.government.pm === next.id ? ' – och blir ny statsminister' : ''}.`, tags: ['parti'], partyId: p.id, importance: 3 });
      text = `${next.name} är ny partiledare.`;
      break;
    }
    case 'vila': { p.unity = clamp(p.unity + 2, 0, 100); state.ap = 0; text = 'Veckan avslutas i lugn och ro.'; break; }
  }
  (state.log[0] ||= { week: state.week, date: { ...state.date }, items: [] }).items.push(`${a.ic} ${a.name}: ${text}`);
  return { ok: true, text };
}

export const weeklyMoney = (s) => { const p = me(s); const seats = s.riksdag.seats[p.id] || 0; const local = Math.round((p.localBase?.kommuner || 0) * 900 + Object.values(p.localBase?.regionSeats || {}).reduce((a, b) => a + b, 0) * 1500); return { income: p.members * 14 + seats * 12000 + (p.inRiksdag ? 80000 : 0) + local, cost: 500 + p.org * p.org * 15 + seats * 14000 + (p.inRiksdag ? 150000 : 0) }; };

// Varje år: nya AI-partier där stora väljargrupper saknar företrädare
function yearlyParties(state, rnd) {
  const parties = activeParties(state);
  if (parties.length >= 14 || rnd() > .4) return;
  const dist = (pos, sg) => { let d = 0, w = 0; for (const is of ISSUES) { const ww = sg.w[is.id] || 1; d += ww * Math.abs((pos[is.id] || 0) - (sg.ideal[is.id] || 0)); w += ww; } return d / w; };
  let worst = null;
  for (const sg of SEGMENTS) { const d = Math.min(...parties.map((p) => dist(p.pos, sg))); const score = d * sg.share; if (!worst || score > worst.score) worst = { sg, d, score }; }
  if (!worst || worst.d < 32) return;
  const sg = worst.sg;
  const ideo = IDEOLOGIES.filter((i) => i.ext <= 1 && i.tags.includes(sg.id))[0] || IDEOLOGIES.find((i) => i.id === 'populism');
  const pos = {}; for (const is of ISSUES) pos[is.id] = clamp(Math.round(sg.ideal[is.id] * .7 + (ideo.pos[is.id] || 0) * .3 + gauss(rnd, 0, 8)), -100, 100);
  const theme = pick(rnd, ['Folk', 'Framtids', 'Medborgar', 'Frihets', 'Rättvise', 'Sverige', 'Trygghets', 'Välfärds', 'Landsbygds', 'Klimat']);
  const core = pick(rnd, ['partiet', 'listan', 'alliansen', 'rörelsen', 'initiativet']);
  const name = theme + core; const abbr = (theme.slice(0, 2) + core[0]).toUpperCase();
  if (parties.some((p) => p.name === name || p.abbr === abbr)) return;
  const id = 'ai' + Math.floor(rnd() * 1e6).toString(36);
  const lead = makePerson(rnd, { partyId: id, role: 'leader', age: 30 + Math.floor(rnd() * 30) }); state.people[lead.id] = lead;
  const np = { id, name, abbr, color: pick(rnd, ['#8e44ad', '#ff7f0e', '#17becf', '#e377c2', '#1abc9c', '#d35400', '#27ae60', '#c0392b', '#2c3e50']), color2: '#ffffff', logo: { shape: pick(rnd, ['star', 'shield', 'wave', 'hex', 'bolt', 'torch', 'tree', 'leaf']), glyph: abbr }, slogan: pick(rnd, ['Nu räcker det', 'För vanligt folk', 'En ny väg', 'På riktigt']),
    pos, profile: {}, bloc: (pos.ekonomi + pos.valfard) / 2 < -20 ? 'left' : (pos.ekonomi + pos.valfard) / 2 > 20 ? 'right' : 'center', cordon: [], founded: state.date.y, members: 300 + Math.floor(rnd() * 2500), money: 100000 + rnd() * 900000, seats: 0, inRiksdag: false,
    org: 10 + Math.floor(rnd() * 15), unity: 80, credibility: 42, attention: 10, momentum: .2, base: Math.min(...parties.map((p) => p.base || 0)) - 1.4, isPlayer: false, people: [], relations: {}, risk: 0, active: true, lastResult: null, results: [], program: {}, promises: [], trust: 50, activists: 50, factions: [], localBase: { kommuner: 0, regionSeats: {} }, manifest: null,
    structure: { ...defaultStructure(), malgrupper: [sg.id] }, ideology: { primary: ideo.id, secondary: [] }, ext: ideo.ext, demo: ideo.demo, leader: lead.id, posStart: { ...pos } };
  for (let i = 0; i < 3; i++) { const q = makePerson(rnd, { partyId: id, role: 'mp' }); state.people[q.id] = q; np.people.push(q.id); }
  for (const q of parties) { q.relations[id] = -5; np.relations[q.id] = 0; }
  state.parties[id] = np; state.riksdag.seats[id] = 0; state.opinion.awareness[id] = .03;
  for (const s2 of SEGMENTS) { const seg = state.opinion.seg[s2.id]; if (seg) seg[id] = .05; }
  state.social.followers[lead.id] = { x: 1500, instagram: 1200, tiktok: 900, facebook: 2500 };
  state.history.leaders.push({ personId: lead.id, partyId: id, name: lead.name, from: { ...state.date }, to: null, reason: null });
  state.history.timeline.push({ date: { ...state.date }, week: state.week, kind: 'parti', text: `${np.name} bildas – ett nytt parti riktat till ${sg.name.toLowerCase()}.` });
  addNews(state, { outlet: pick(rnd, ['svt', 'dn', 'expressen']), headline: `Nytt parti: ${np.name} vill fånga ${sg.name.toLowerCase()}`, body: `${lead.name}, ${lead.age}, ${lead.bg.yrke.toLowerCase()}, leder det nya partiet. "${np.slogan}", lyder parollen. Kommentatorer: ${pick(rnd, ['ett hål i det politiska landskapet fylls', 'svårt att nå spärren', 'etablerade partier bör vara oroliga'])}.`, tags: ['parti'], importance: 2 });
}
