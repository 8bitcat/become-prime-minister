// Lägesbilden: en kort, saklig sammanfattning av spelets tillstånd som rådgivarna (och språkmodellen)
// använder för att svara på vad som helst spelaren frågar. Bara siffror som faktiskt finns i spelet.
import { ISSUES, ISSUE_BY_ID } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { STAT_BY_ID } from '../data/stats.js';
import { fmt, fmtDate, dayDiff, pick } from '../core/util.js';
import { activeParties } from '../sim/opinion.js';
import { isPlayerPM, playerInGov } from '../sim/government.js';
import { ideologyDescription } from '../sim/policy.js';
import { personaLabel } from './memory.js';
import { toneLabel } from './analyze.js';
import { FIRST_F, FIRST_M, LAST } from '../data/names.js';

const me = (s) => s.parties[s.player.partyId];
const stat = (s, id) => { const st = STAT_BY_ID[id]; const v = s.sweden.stats[id]; return st && v != null ? `${st.name.toLowerCase()} ${fmt(v, st.d)} ${st.unit}` : null; };
export function hotIssues(s, n = 4) { return [...ISSUES].sort((a, b) => (s.opinion.salience[b.id] || 1) - (s.opinion.salience[a.id] || 1)).slice(0, n); }
export function trend(s, id, n = 4) { const t = s.opinion.trend; if (t.length < n + 1) return 0; return (t[t.length - 1].s[id] || 0) - (t[t.length - 1 - n].s[id] || 0); }
export function roleOf(s) { const p = me(s); return isPlayerPM(s) ? 'statsministerns parti' : playerInGov(s) ? 'regeringsparti' : s.government.support?.includes(p.id) ? 'stödparti till regeringen' : p.inRiksdag ? 'oppositionsparti i riksdagen' : 'parti utanför riksdagen'; }

export function gameBrief(s, { focus = null } = {}) {
  const p = me(s); const l = s.people[p.leader];
  const sup = s.opinion.support[p.id] || 0; const tr = trend(s, p.id);
  const days = dayDiff(s.date, s.election.next);
  const ranked = activeParties(s).sort((a, b) => (s.opinion.support[b.id] || 0) - (s.opinion.support[a.id] || 0));
  const gov = s.government; const pm = gov.pm ? s.people[gov.pm] : null;
  const segs = SEGMENTS.map((g) => ({ g, v: s.opinion.seg[g.id]?.[p.id] || 0 })).sort((a, b) => b.v - a.v);
  const idd = ideologyDescription(p.program || {});
  const heart = ISSUES.filter((i) => (p.profile?.[i.id] || 1) > 1.1).map((i) => i.name.toLowerCase());
  const traits = Object.entries(l.traits || {}).sort((a, b) => b[1] - a[1]);
  const lines = [
    `Datum: ${fmtDate(s.date, true)} (vecka ${s.week}). ${days > 0 ? `Riksdagsval om ${Math.round(days / 7)} veckor (${fmtDate(s.election.next)})` : 'Valet är nu'}${s.election.campaign ? ', valrörelsen pågår' : ''}.`,
    `Vårt parti: ${p.name} (${p.abbr}), ${roleOf(s)}. Ideologi enligt programmet: ${idd.label}${idd.tags.length ? ' (' + idd.tags.slice(0, 4).join(', ') + ')' : ''}.${heart.length ? ' Hjärtefrågor: ' + heart.join(', ') + '.' : ''}`,
    `Opinion: ${fmt(sup, 1)} % (${tr >= 0 ? '+' : ''}${fmt(tr, 1)} på fyra veckor), ${s.riksdag.seats[p.id] || 0} mandat. Spärren är ${fmt(s.policy?.sparr ?? 4, 0)} %.${(s.opinion.awareness[p.id] ?? 1) < .6 ? ` Bara ${fmt((s.opinion.awareness[p.id] ?? 0) * 100, 0)} % av väljarna känner till oss.` : ''}`,
    `Mätningen: ${ranked.slice(0, 9).map((q) => `${q.abbr} ${fmt(s.opinion.support[q.id] || 0, 1)}`).join(', ')}.`,
    `Regeringen: ${pm ? `${pm.name} (${s.parties[gov.pmParty].abbr}) är statsminister, regering ${gov.parties.map((id) => s.parties[id].abbr).join('+')}${gov.support?.length ? ' med stöd av ' + gov.support.map((id) => s.parties[id].abbr).join(', ') : ''}, förtroende ${fmt(gov.approval, 0)} %` : 'Ingen regering, expeditionsministär'}.`,
    `Hetast för väljarna just nu: ${hotIssues(s).map((i) => i.name.toLowerCase()).join(', ')}.`,
    `Starkast hos: ${segs.slice(0, 2).map((x) => x.g.name.toLowerCase()).join(' och ')}; svagast hos: ${segs.slice(-2).map((x) => x.g.name.toLowerCase()).join(' och ')}.`,
    `Partiet: ${fmt(p.members)} medlemmar, kassa ${fmt(p.money / 1e6, 1)} mkr, trovärdighet ${fmt(p.credibility, 0)}/100, förtroende ${fmt(p.trust ?? 50, 0)}/100, sammanhållning ${fmt(p.unity, 0)}/100, organisation ${fmt(p.org, 0)}/100.${(p.factions || []).filter((f) => f.mood < -20).length ? ' Missnöjda falanger: ' + p.factions.filter((f) => f.mood < -20).map((f) => f.name).join(', ') + '.' : ''}`,
    `Partiledaren ${l.name}, ${l.age} år: starkast i ${traits.slice(0, 2).map(([k]) => k).join(' och ')}, svagast i ${traits.slice(-2).map(([k]) => k).join(' och ')}. Stöd ${fmt(l.approval, 0)} %.${(l.fatigue || 0) > 50 ? ' Är märkbart trött.' : ''}${personaLabel(s) ? ` Uppfattas som ${personaLabel(s)}.` : ''}`,
    `Sverige: ${['arbetsloshet', 'inflation', 'bnp_tillvaxt', 'styrranta', 'skjutningar', 'vardkoer', 'elpris', 'statsskuld_bnp'].map((id) => stat(s, id)).filter(Boolean).join('; ')}.`,
  ];
  const sc = (s.scandals || []).filter((x) => x.active && x.partyId === p.id);
  if (sc.length) lines.push(`Pågående skandal: ${sc.map((x) => x.title).join(', ')}.`);
  const rel = activeParties(s).filter((q) => !q.isPlayer).map((q) => ({ q, r: q.relations?.[p.id] || 0 })).sort((a, b) => b.r - a.r);
  if (rel.length) lines.push(`Relationer: bäst med ${rel.slice(0, 2).map((x) => x.q.abbr).join(' och ')}, sämst med ${rel.slice(-2).map((x) => x.q.abbr).join(' och ')}.`);
  lines.push(`Senaste rubrikerna: ${s.news.slice(0, 5).map((n) => `"${n.headline}"`).join(' · ')}.`);
  const st = (s.memory?.statements || []).slice(-3);
  if (st.length) lines.push(`Det partiledaren senast sagt: ${st.map((x) => `"${x.text.slice(0, 110)}"`).join(' · ')}.`);
  if (focus && ISSUE_BY_ID[focus]) { const is = ISSUE_BY_ID[focus]; lines.push(`Om ${is.name.toLowerCase()}: vårt läge ${p.pos[focus] > 0 ? 'åt "' + is.right.toLowerCase() + '"' : 'åt "' + is.left.toLowerCase() + '"'} (${p.pos[focus]}), hetta ${fmt((s.opinion.salience[focus] || 1) * 100, 0)}.`); }
  return lines.join('\n');
}

// Rådgivarna i staben
export const ADVISOR_ROLES = [
  { id: 'stab', role: 'stabschef', title: 'Stabschefen', ic: '🧭', persona: 'Du ansvarar för strategin och valvinsten. Lojal men ärlig – säger emot när partiledaren är på väg att göra fel.' },
  { id: 'press', role: 'pressekreterare', title: 'Pressekreteraren', ic: '🎙️', persona: 'Du kan medierna, journalisterna och sociala medier utan och innan. Du tänker i rubriker, klipp och ton, och varnar för formuleringar som kan slå tillbaka.' },
  { id: 'parti', role: 'partisekreterare', title: 'Partisekreteraren', ic: '🏛️', persona: 'Du håller ihop partiorganisationen: medlemmar, pengar, falanger, lokalavdelningar och kongressen. Du märker direkt när gräsrötterna är missnöjda.' },
  { id: 'ekonom', role: 'chefsekonom', title: 'Chefsekonomen', ic: '📈', persona: 'Du räknar på allt: statsbudgeten, vad förslag kostar, hur de påverkar jobb, inflation och skulder. Torr humor, ogillar ofinansierade löften.' },
];
export function ensureAdvisors(s, rnd = Math.random) {
  s.advisors ||= {};
  for (const r of ADVISOR_ROLES) if (!s.advisors[r.id]) { const f = rnd() < .5; s.advisors[r.id] = { name: `${pick(rnd, f ? FIRST_F : FIRST_M)} ${pick(rnd, LAST)}`, gender: f ? 'k' : 'm' }; }
  s.chats ||= {};
  return s.advisors;
}

// Svar utan språkmodell: regelbaserat men byggt på det faktiska läget
export function fallbackAdvice(s, roleId, question, a) {
  const p = me(s); const t = String(question || '').toLowerCase();
  const sup = s.opinion.support[p.id] || 0; const sparr = s.policy?.sparr ?? 4;
  const hot = hotIssues(s, 3); const topic = a.topics?.[0] ? ISSUE_BY_ID[a.topics[0]] : null;
  const out = [];
  if (/spärr|mätning|opinion|procent|väljar|vinna|valet/.test(t) || roleId === 'stab' && !topic) {
    out.push(sup < sparr ? `Vi ligger på ${fmt(sup, 1)} % – under spärren på ${fmt(sparr, 0)} %. Vi måste synas mer och äga en fråga som väljarna bryr sig om.` : `Vi ligger på ${fmt(sup, 1)} %, ${fmt(trend(s, p.id), 1)} på fyra veckor.`);
    out.push(`Väljarna bryr sig mest om ${hot.map((i) => i.name.toLowerCase()).join(', ')} just nu.`);
  }
  if (topic) {
    const pos = p.pos[topic.id] || 0; const hotRank = hot.findIndex((i) => i.id === topic.id);
    out.push(`${topic.name}: vår linje är ${pos < 0 ? topic.left.toLowerCase() : topic.right.toLowerCase()}. ${hotRank >= 0 ? `Det är en av de hetaste frågorna just nu – bra läge att göra ett utspel.` : `Det är inte det väljarna pratar mest om just nu; koppla det gärna till ${hot[0].name.toLowerCase()}.`}`);
  }
  if (/pengar|kassa|insamling|ekonomi i partiet|budget för partiet/.test(t) || roleId === 'parti') out.push(`Kassan är ${fmt(p.money / 1e6, 1)} mkr, vi har ${fmt(p.members)} medlemmar och sammanhållningen ligger på ${fmt(p.unity, 0)}.`);
  if (roleId === 'press' || /medier|journalist|inlägg|ton|twitter|x\b|tiktok/.test(t)) { const per = personaLabel(s); out.push(per ? `Medierna beskriver dig som ${per}. ${/aggressiv|konfrontativ|dryg/.test(per) ? 'Det börjar kosta i mitten – skruva ned tonen.' : 'Det fungerar, fortsätt så.'}` : 'Du har inte satt någon tydlig ton i medierna ännu – bestäm vad du vill vara känd för.'); }
  if (roleId === 'ekonom' || /kosta|finansier|skatt|budget|inflation|ränta/.test(t)) out.push(`Arbetslösheten är ${fmt(s.sweden.stats.arbetsloshet, 1)} %, inflationen ${fmt(s.sweden.stats.inflation, 1)} % och styrräntan ${fmt(s.sweden.stats.styrranta, 2)} %. Varje löfte måste ha en finansiering – annars blir det första följdfrågan.`);
  if (!out.length) out.push(`Bra fråga. Utifrån läget skulle jag prioritera ${hot[0].name.toLowerCase()} – där finns väljarna just nu.`);
  out.push('(Starta spelets AI-modell under ☰ Meny → Spelets AI så kan vi prata helt fritt.)');
  return out.join(' ');
}
