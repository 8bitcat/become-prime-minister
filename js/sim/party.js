// Partiets inre liv: organisation (stadgar, makt), falanger, aktivister, partiledarstrider,
// splittringar och ekonomi. Gäller spelarens parti och AI-partierna.
import { ISSUES } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { IDEOLOGY_BY_ID } from '../data/ideologies.js';
import { pick, clamp, gauss, weighted, kr } from '../core/util.js';
import { makePerson } from './people.js';
import { addNews } from './news.js';
import { activeParties } from './opinion.js';

export const STRUCTURE_OPTIONS = {
  ledarval: { name: 'Hur partiledaren utses', options: [
    { id: 'medlem', name: 'Medlemsomröstning', desc: 'Alla medlemmar röstar. Legitimt – men utmanare kan dyka upp när som helst.' },
    { id: 'kongress', name: 'Partikongress', desc: 'Ombud väljer vart annat år. Balanserat.' },
    { id: 'styrelse', name: 'Partistyrelsen', desc: 'En liten krets avgör. Få utmaningar, men missnöje pyr.' } ] },
  kandidatval: { name: 'Hur riksdagskandidater väljs', options: [
    { id: 'primar', name: 'Primärval', desc: 'Medlemmarna rankar. Uppmärksamhet och engagemang – och interna strider.' },
    { id: 'lokal', name: 'Lokalavdelningarna', desc: 'Varje distrikt sätter sin lista. Starkt lokalt, spretigt nationellt.' },
    { id: 'styrelse', name: 'Partistyrelsen', desc: 'Ledningen sätter listorna. Kontroll – och anklagelser om toppstyre.' } ] },
  stadgar: { name: 'Stadgar', options: [
    { id: 'strikta', name: 'Strikta', desc: 'Tydliga regler, snabb uteslutning. Lägre skandalrisk, långsammare tillväxt.' },
    { id: 'losa', name: 'Lösa', desc: 'Öppet och snabbväxande. Fler medlemmar som gör som de vill.' } ] },
};
export function defaultStructure(def = null) {
  const base = { centralisering: 50, ledarmakt: 50, ledarval: 'kongress', kandidatval: 'lokal', stadgar: 'strikta', ungdom: true, lokalAutonomi: 50, bredd: 50, malgrupper: [] };
  if (!def) return base;
  const by = { s: { centralisering: 70, ledarmakt: 60, ledarval: 'kongress', kandidatval: 'lokal', ungdom: true, lokalAutonomi: 40, bredd: 70, malgrupper: ['offentlig', 'industri', 'pensionarer', 'forort_familjer'] },
    sd: { centralisering: 90, ledarmakt: 85, ledarval: 'styrelse', kandidatval: 'styrelse', stadgar: 'strikta', ungdom: true, lokalAutonomi: 20, bredd: 55, malgrupper: ['landsbygd', 'industri', 'laginkomst', 'pensionarer'] },
    m: { centralisering: 60, ledarmakt: 60, ledarval: 'kongress', kandidatval: 'lokal', ungdom: true, lokalAutonomi: 50, bredd: 65, malgrupper: ['hoginkomst', 'foretagare', 'forort_familjer'] },
    v: { centralisering: 45, ledarmakt: 45, ledarval: 'kongress', kandidatval: 'lokal', ungdom: true, lokalAutonomi: 60, bredd: 35, malgrupper: ['offentlig', 'studenter', 'laginkomst'] },
    c: { centralisering: 40, ledarmakt: 55, ledarval: 'kongress', kandidatval: 'lokal', ungdom: true, lokalAutonomi: 80, bredd: 55, malgrupper: ['landsbygd', 'foretagare'] },
    kd: { centralisering: 60, ledarmakt: 60, ledarval: 'kongress', kandidatval: 'lokal', ungdom: true, lokalAutonomi: 45, bredd: 45, malgrupper: ['kristna', 'pensionarer'] },
    mp: { centralisering: 30, ledarmakt: 30, ledarval: 'medlem', kandidatval: 'primar', stadgar: 'losa', ungdom: true, lokalAutonomi: 75, bredd: 35, malgrupper: ['miljo', 'storstad_unga', 'studenter'] },
    l: { centralisering: 55, ledarmakt: 55, ledarval: 'kongress', kandidatval: 'lokal', ungdom: true, lokalAutonomi: 50, bredd: 45, malgrupper: ['storstad_akademiker', 'hoginkomst'] } }[def.id] || {};
  return { ...base, ...by };
}
export function structureSummary(S) {
  const e = structureEffects({ structure: S });
  const line = (k, v) => `<div class="row between" style="font-size:13px;padding:2px 0"><span>${k}</span><b class="${v > 1.03 ? 'up' : v < .97 ? 'down' : ''}">${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)} %</b></div>`;
  return `<b>Konsekvenser</b>${line('Tillväxt i medlemmar', e.growth)}${line('Sammanhållning över tid', e.unityDrift)}${line('Skandalrisk', e.scandal)}${line('Risk för ledarstrid', e.challenge)}${line('Risk för splittring', e.split)}${line('Kärnväljarnas lojalitet', e.loyalty)}${line('Trovärdighet', e.cred)}<small class="muted">${S.ungdom ? 'Ungdomsförbundet rekryterar unga och kan driva partiet åt kanten.' : 'Utan ungdomsförbund tappar partiet unga väljare och framtida ledare.'}</small>`;
}
// Multiplikatorer från organisationen (1 = neutralt)
export function structureEffects(party) {
  const S = party.structure || defaultStructure();
  const c = (S.centralisering - 50) / 50, m = (S.ledarmakt - 50) / 50, l = (S.lokalAutonomi - 50) / 50, b = (S.bredd - 50) / 50;
  return {
    growth: 1 + l * .12 + (S.stadgar === 'losa' ? .12 : -.04) + (S.ungdom ? .08 : -.06) + b * .08 + (S.kandidatval === 'primar' ? .05 : 0),
    unityDrift: 1 + c * .15 - l * .05 - b * .12 + (S.stadgar === 'strikta' ? .05 : -.05) + (S.ledarval === 'styrelse' ? -.08 : 0),
    scandal: 1 - (S.stadgar === 'strikta' ? .18 : -.15) + l * .08 + (S.kandidatval === 'primar' ? .06 : 0) + m * .05,
    challenge: 1 + (S.ledarval === 'medlem' ? .35 : S.ledarval === 'styrelse' ? -.3 : 0) - m * .3 + (S.kandidatval === 'primar' ? .1 : 0),
    split: 1 - c * .15 + l * .25 + b * .15 + (S.ledarval === 'styrelse' ? .2 : 0) + (S.ungdom ? .05 : 0),
    loyalty: 1 - b * .25 + (S.ungdom ? .03 : 0),
    cred: 1 - b * .1 + (S.stadgar === 'strikta' ? .04 : -.03),
    tolerance: 1 + b * .35, // hur mycket ideologiskt avstånd väljare accepterar
  };
}

// ---------- FALANGER ----------
const FACTION_NAMES = { left: ['Vänsterfalangen', 'Reformisterna', 'Fackföreningsflygeln', 'Förnyarna'], right: ['Marknadsliberalerna', 'De konservativa', 'Nationalkonservativa', 'Mittenflygeln'], center: ['Landsbygdsflygeln', 'Storstadsliberalerna', 'Pragmatikerna'], none: ['Grundarna', 'Pragmatikerna', 'Hardliners', 'Mittenfolket'] };
export function initFactions(state, rnd, party) {
  party.factions = [];
  if (!party.inRiksdag && party.members < 1500) return;
  const n = party.members > 30000 ? 3 : 2;
  const names = pick(rnd, [FACTION_NAMES[party.bloc] || FACTION_NAMES.none]);
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const name = names.filter((x) => !used.has(x))[Math.floor(rnd() * names.filter((x) => !used.has(x)).length)] || 'Falang ' + (i + 1); used.add(name);
    const pos = {}; const dir = i === 0 ? -1 : i === 1 ? 1 : 0;
    for (const is of ISSUES) pos[is.id] = Math.round(dir * (10 + rnd() * 25) * (rnd() < .5 ? 1 : .3) + gauss(rnd, 0, 6));
    const people = (party.people || []).map((id) => state.people[id]).filter((x) => x && x.alive && x.id !== party.leader);
    const leaderP = people[i] || null;
    party.factions.push({ id: 'f' + i + Math.floor(rnd() * 1e4), name, pos, strength: Math.round(20 + rnd() * 25), mood: Math.round(gauss(rnd, 10, 15)), leaderId: leaderP?.id || null });
    if (leaderP) { leaderP.posDelta = { ...pos }; leaderP.faction = party.factions[i].id; }
  }
}
function factionDistance(party, f) { let d = 0; for (const is of ISSUES) d += Math.abs(f.pos[is.id] || 0); return d / ISSUES.length; }

// Varje månad: falangernas humör, partiledarstrider, splittringar. Returnerar köposter för spelaren.
export function monthlyParty(state, rnd) {
  const out = [];
  for (const party of activeParties(state)) {
    const eff = structureEffects(party);
    party.factions ||= [];
    // nya falanger i växande partier
    if (!party.factions.length && (party.inRiksdag || party.members > 1500) && rnd() < .3) { initFactions(state, rnd, party); if (party.isPlayer && party.factions.length) out.push({ type: 'note', title: 'Falanger växer fram', text: `${party.name} har blivit stort nog för att rymma olika viljor. Två falanger har bildats: ${party.factions.map((f) => f.name).join(' och ')}. Håll dem nöjda – eller håll dem kort.` }); }
    const momentum = party.momentum || 0;
    for (const f of party.factions) {
      const dist = factionDistance(party, f);
      const target = 20 - dist * 1.2 + (party.unity - 60) * .4 + momentum * 15 + (party.inRiksdag ? 5 : -5) - (party.factions.length - 2) * 5;
      f.mood = clamp(f.mood + (target - f.mood) * .2 + gauss(rnd, 0, 4), -100, 100);
      f.strength = clamp(f.strength + (f.mood < -20 ? .8 : -.3) + gauss(rnd, 0, 1), 5, 70);
    }
    const unhappy = party.factions.filter((f) => f.mood < -40 && f.strength > 25);
    // krav från en missnöjd falang (spelaren får välja; AI hanterar själv)
    for (const f of unhappy) {
      if (f.demandedWeek && state.week - f.demandedWeek < 26) continue;
      if (rnd() < .25) {
        f.demandedWeek = state.week;
        const is = ISSUES.slice().sort((a, b) => Math.abs(f.pos[b.id] || 0) - Math.abs(f.pos[a.id] || 0))[0];
        if (party.isPlayer) out.push({ type: 'faction', partyId: party.id, factionId: f.id, issue: is.id, shift: Math.sign(f.pos[is.id] || 1) * 12 });
        else if (rnd() < .5) { party.pos[is.id] = clamp(party.pos[is.id] + Math.sign(f.pos[is.id] || 1) * 8, -100, 100); f.mood += 25; }
        else f.mood -= 10;
      }
    }
    // partiledarstrid
    const lead = state.people[party.leader];
    const pChallenge = (.012 + (party.unity < 45 ? .03 : 0) + (lead?.approval < 25 ? .03 : 0) + (momentum < -.5 ? .02 : 0) + unhappy.length * .02) * eff.challenge;
    if (lead && rnd() < pChallenge && !(party.challengeWeek && state.week - party.challengeWeek < 40)) {
      party.challengeWeek = state.week;
      const cands = (party.people || []).map((id) => state.people[id]).filter((x) => x && x.alive && x.id !== party.leader).sort((a, b) => (b.ambition + b.traits.ledarskap) - (a.ambition + a.traits.ledarskap));
      const ch = cands[0];
      if (ch) { if (party.isPlayer) out.push({ type: 'challenge', partyId: party.id, challengerId: ch.id }); else resolveChallengeAI(state, rnd, party, ch); }
    }
    // splittring
    const pSplit = unhappy.reduce((a, f) => a + (f.mood < -60 ? .02 : .006) * (f.strength / 40), 0) * eff.split;
    if (party.factions.length && rnd() < pSplit) {
      const f = unhappy.sort((a, b) => a.mood - b.mood)[0];
      if (f) { const np = splitParty(state, rnd, party, f); if (np) out.push({ type: 'note', title: party.isPlayer ? '💥 Partiet har splittrats' : 'Partisplittring', text: `${f.name} har lämnat ${party.name} och bildat ${np.name} (${np.abbr}) under ${state.people[np.leader].name}. ${np.seats ? np.seats + ' riksdagsledamöter följde med.' : ''} Det nya partiet jagar samma väljare.` }); }
    }
    // aktivister
    party.activists = Math.round(party.members * (0.06 + (party.structure?.ungdom ? .02 : 0) + (party.unity - 50) / 1000 + Math.max(0, momentum) * .02) * eff.growth);
  }
  return out;
}
export function resolveChallengeAI(state, rnd, party, ch) {
  const lead = state.people[party.leader];
  const win = rnd() < .5 + (lead.traits.ledarskap - ch.traits.ledarskap) / 150 + (party.unity - 50) / 200;
  if (win) { party.unity = clamp(party.unity + 6, 0, 100); ch.loyalty = Math.max(5, ch.loyalty - 20); addNews(state, { outlet: 'svt', headline: `${lead.name} slog tillbaka utmaningen i ${party.abbr}`, body: `${ch.name} fick inte majoritet. "Nu lägger vi det bakom oss", säger partiledaren.`, tags: ['parti'], partyId: party.id, importance: 2 }); }
  else { installLeader(state, party, ch, 'utmanad'); addNews(state, { outlet: 'svt', headline: `${ch.name} ny partiledare för ${party.name} efter intern strid`, body: `${lead.name} förlorade omröstningen och lämnar. ${state.government.pm === ch.id ? ch.name + ' blir därmed också statsminister.' : ''}`, tags: ['parti'], partyId: party.id, importance: 3 }); }
}
export function installLeader(state, party, person, reason) {
  const old = state.people[party.leader];
  if (old) { old.role = 'mp'; old.career.push({ what: 'Avgick som partiledare', date: { ...state.date }, reason }); if (!party.people.includes(old.id)) party.people.push(old.id); }
  (state.history ||= { leaders: [], timeline: [], bios: [] });
  const rec = state.history.leaders.find((l) => l.personId === party.leader && !l.to); if (rec) { rec.to = { ...state.date }; rec.reason = reason; }
  party.leader = person.id; person.role = 'leader'; person.since = { ...state.date }; person.approval = 40;
  // nya ledarens konton i sociala medier: ärver en del av partiets publik
  if (state.social) { const oldF = (old && state.social.followers[old.id]) || {}; state.social.followers[person.id] ||= Object.fromEntries(['x', 'instagram', 'tiktok', 'facebook'].map((k) => [k, Math.round((oldF[k] || 0) * .4 + 300)])); }
  party.people = (party.people || []).filter((id) => id !== person.id);
  state.history.leaders.push({ personId: person.id, partyId: party.id, name: person.name, from: { ...state.date }, to: null, reason: null });
  if (state.government.pm === old?.id) state.government.pm = person.id;
  for (const f of party.factions || []) if (f.leaderId === person.id) f.leaderId = null;
  if (old) writeBio(state, old, party);
}
export function writeBio(state, person, party) {
  const rec = (state.history?.leaders || []).filter((l) => l.personId === person.id);
  const from = rec[0]?.from || person.since; const to = rec[rec.length - 1]?.to || { ...state.date };
  const years = from ? Math.max(0, to.y - from.y) : 0;
  const pmYears = (state.government.history || []).filter((g) => g.pm === person.id).length;
  const wins = (party.results || []).length;
  const text = `${person.name} ledde ${party.name} ${from ? 'från ' + from.y : ''} till ${to.y}${years ? ` (${years} år)` : ''}. ${pmYears ? `Statsminister i ${pmYears} regering${pmYears > 1 ? 'ar' : ''}. ` : ''}${wins ? `Ledde partiet i ${wins} val; bästa resultat ${Math.max(...party.results.map((r) => r.pct)).toFixed(1).replace('.', ',')} %. ` : ''}${person.career.filter((c) => c.what !== 'Avgick som partiledare').length ? person.career.map((c) => c.what).slice(0, 4).join('. ') + '. ' : ''}Eftermäle: ${person.approval > 55 ? 'en folkkär ledare' : person.approval > 38 ? 'en respekterad men omstridd politiker' : 'en ledare som lämnade i motvind'}.`;
  (state.history.bios ||= []).unshift({ personId: person.id, name: person.name, partyId: party.id, text, from, to });
}

// Splittring: falangen bildar ett nytt AI-parti, tar med sig medlemmar, mandat och väljare.
export function splitParty(state, rnd, party, f) {
  const leaderP = state.people[f.leaderId] || (() => { const np = makePerson(rnd, { partyId: null, role: 'leader' }); state.people[np.id] = np; return np; })();
  const prefix = pick(rnd, ['Nya ', 'Fria ', 'Folkets ', 'Det nya ', '']);
  const core = pick(rnd, ['Alliansen', 'Partiet', 'Rörelsen', 'Listan', 'Initiativet', 'Fronten', 'Samling']);
  const theme = pick(rnd, ['Framtids', 'Frihets', 'Rättvise', 'Medborgar', 'Sverige', 'Folk', 'Demokrati', 'Reform']);
  const name = `${prefix}${theme}${core.toLowerCase()}`.replace(/^(.)/, (c) => c.toUpperCase());
  const abbr = (theme[0] + core[0]).toUpperCase() + (Object.values(state.parties).some((p) => p.abbr === (theme[0] + core[0]).toUpperCase()) ? '2' : '');
  const id = 'ai' + Math.floor(rnd() * 1e6).toString(36);
  const pos = {}; for (const is of ISSUES) pos[is.id] = clamp(party.pos[is.id] + (f.pos[is.id] || 0) * 1.5, -100, 100);
  const share = f.strength / 100;
  const seatsTaken = Math.floor((party.seats || 0) * share * .6);
  const np = {
    id, name, abbr, color: pick(rnd, ['#8e44ad', '#ff7f0e', '#17becf', '#e377c2', '#2c3e50', '#1abc9c', '#d35400', '#27ae60', '#c0392b']), color2: '#ffffff', logo: { shape: pick(rnd, ['star', 'shield', 'wave', 'hex', 'bolt', 'torch']), glyph: abbr }, slogan: pick(rnd, ['Tid för förändring', 'På riktigt', 'Vi håller vad vi lovar', 'För hela Sverige']),
    pos, profile: { ...party.profile }, bloc: party.bloc, cordon: [...(party.cordon || [])], founded: state.date.y, members: Math.round(party.members * share), money: party.money * share * .3,
    seats: seatsTaken, inRiksdag: seatsTaken > 0, org: Math.round(party.org * .5), unity: 75, credibility: 45, attention: 40, momentum: .3, base: (party.base || 0) - 1.0, isPlayer: false, people: [], relations: { ...party.relations }, risk: 0, active: true, lastResult: null, results: [], program: {}, promises: [], factions: [], activists: 0, trust: 50,
    structure: { ...(party.structure || defaultStructure()), malgrupper: [...(party.structure?.malgrupper || [])] }, ideology: party.ideology ? { ...party.ideology } : null, origin: { from: party.id, faction: f.name, date: { ...state.date } },
  };
  leaderP.partyId = id; leaderP.role = 'leader'; leaderP.since = { ...state.date }; np.leader = leaderP.id;
  // följer med: några av partiets profiler
  const movers = (party.people || []).map((pid) => state.people[pid]).filter((x) => x && x.alive && x.id !== leaderP.id && x.faction === f.id);
  for (const m of movers) { m.partyId = id; np.people.push(m.id); }
  party.people = (party.people || []).filter((pid) => !movers.some((m) => m.id === pid) && pid !== leaderP.id);
  if (!np.people.length) for (let i = 0; i < 3; i++) { const p = makePerson(rnd, { partyId: id, role: 'mp' }); state.people[p.id] = p; np.people.push(p.id); }
  party.members -= np.members; party.money -= np.money; party.seats -= seatsTaken; party.inRiksdag = party.seats > 0;
  state.riksdag.seats[party.id] = party.seats; state.riksdag.seats[id] = seatsTaken;
  party.factions = party.factions.filter((x) => x.id !== f.id); party.unity = clamp(party.unity + 10, 0, 100);
  state.parties[id] = np;
  for (const q of activeParties(state)) { if (q.id !== id) { q.relations[id] = q.id === party.id ? -40 : (q.relations[party.id] || 0) * .5; np.relations[q.id] = q.id === party.id ? -40 : (party.relations[q.id] || 0) * .5; } }
  state.opinion.awareness[id] = party.inRiksdag ? .6 : .2;
  // väljarna: falangens andel av partiets stöd flyttar
  for (const sg of SEGMENTS) { const seg = state.opinion.seg[sg.id]; if (!seg) continue; const v = (seg[party.id] || 0) * share * .7; seg[party.id] = Math.max(.01, (seg[party.id] || 0) - v); seg[id] = v + .05; }
  state.opinion.support[id] = (state.opinion.support[party.id] || 0) * share * .7;
  state.opinion.support[party.id] = (state.opinion.support[party.id] || 0) * (1 - share * .7);
  state.social.followers[leaderP.id] ||= { x: 2000, instagram: 1500, tiktok: 800, facebook: 3000 };
  (state.history ||= { leaders: [], timeline: [], bios: [] }).leaders.push({ personId: leaderP.id, partyId: id, name: leaderP.name, from: { ...state.date }, to: null, reason: null });
  state.history.timeline.push({ date: { ...state.date }, week: state.week, kind: 'parti', text: `${np.name} bildades genom utbrytning ur ${party.name}.` });
  addNews(state, { outlet: 'svt', headline: `${party.abbr} splittras – ${f.name} bildar ${np.name}`, body: `${leaderP.name} leder det nya partiet. ${seatsTaken ? seatsTaken + ' ledamöter lämnar riksdagsgruppen.' : 'Partiet saknar riksdagsmandat men tar med sig ' + np.members + ' medlemmar.'}`, tags: ['parti'], partyId: party.id, importance: 3 });
  return np;
}

// Spelaren svarar på ett falangkrav
export function applyFactionChoice(state, rnd, item, choice) {
  const party = state.parties[item.partyId]; const f = party.factions.find((x) => x.id === item.factionId); if (!f) return '';
  const is = ISSUES.find((x) => x.id === item.issue);
  if (choice === 0) { party.pos[is.id] = clamp(party.pos[is.id] + item.shift, -100, 100); f.mood = clamp(f.mood + 40, -100, 100); party.credibility = clamp(party.credibility - 3, 0, 100); for (const g of party.factions) if (g !== f) g.mood -= 10; return `Partiet flyttar sig i frågan om ${is.name.toLowerCase()}. ${f.name} är nöjda – andra falanger muttrar, och medierna skriver om "eftergifter".`; }
  if (choice === 1) { f.mood = clamp(f.mood - 15, -100, 100); party.unity = clamp(party.unity - 4, 0, 100); return `Du står fast. ${f.name} tar det som ett nederlag; risken för splittring ökar något.`; }
  const lead = state.people[party.leader];
  const ok = rnd() < .4 + (lead.traits.ledarskap - 45) / 120 + (lead.traits.social - 45) / 200;
  if (ok) { f.mood = clamp(f.mood + 20, -100, 100); party.unity = clamp(party.unity + 3, 0, 100); return `Samtalen lugnar ner läget. ${f.name} känner sig lyssnade på utan att politiken ändras.`; }
  f.mood = clamp(f.mood - 5, -100, 100); return `Samtalen leder ingenstans. ${f.name} kräver fortfarande besked.`;
}

// Partiekonomins rader (för Partiet-sidan)
// Samma summor som weeklyMoney i turn.js – bara uppdelade i rader
export function economyLines(state, party) {
  const seats = state.riksdag.seats[party.id] || 0;
  const orgCost = party.org * party.org * 15;
  const personal = Math.round(seats * 14000 + (party.inRiksdag ? 150000 : 0) + orgCost * .6);
  const staff = Math.max(1, Math.round(personal / 11000));
  return {
    income: [['Medlemsavgifter', party.members * 14], ['Partistöd (riksdagen)', seats * 12000 + (party.inRiksdag ? 80000 : 0)], ['Kommunalt/regionalt partistöd', Math.round((party.localBase?.kommuner || 0) * 900 + Object.values(party.localBase?.regionSeats || {}).reduce((a, b) => a + b, 0) * 1500)]],
    cost: [['Personal (' + staff + ' anställda)', personal], ['Lokaler & IT', Math.round(500 + orgCost * .25)], ['Kampanjreserv & opinionsmätningar', Math.round(orgCost * .15)]],
    staff,
  };
}
export const kr2 = kr;
