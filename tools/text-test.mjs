// Huvudlöst test av fritextlagret: analysen, det politiska minnet, fria inlägg, fria debattsvar,
// tal, presskonferens, samtal, förhandlingsbud, erbjudanden, fokusgrupp. node tools/text-test.mjs
import { newGame } from '../js/sim/newgame.js';
import { endWeek } from '../js/sim/turn.js';
import { analyzeText } from '../js/ai/analyze.js';
import { recordStatement, factCheck, checkTextPromises, digOldStatement, personaLabel, initMemory } from '../js/ai/memory.js';
import { composeFreePost, deletePost, replyToComment } from '../js/sim/social.js';
import { buildDebate, resolveFree, finishDebate } from '../js/sim/debate.js';
import { speechReactions, commentsFor, opponentReply, followUp, analyze } from '../js/ai/generate.js';
import { pressQuestions, pressAnswer, pressSummary, speechOutcome, privateTalk, negotiationCounter, formationOffer, clearOffers, focusGroup, utspelEffect, leakSecretDeals } from '../js/sim/talk.js';
import { willingness, monthlyMinisters } from '../js/sim/government.js';
import { migrate } from '../js/sim/migrate.js';
import { IDEOLOGIES } from '../js/data/ideologies.js';
import { makeRng } from '../js/core/util.js';
import { randomLook, randomTraits } from '../js/sim/people.js';
import { activeParties } from '../js/sim/opinion.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('✓', msg); } else { fail++; console.log('✗', msg); } };
const r0 = makeRng(7);
const leaderDef = { name: 'Eva Fritext', first: 'Eva', last: 'Fritext', gender: 'k', age: 44, look: randomLook(r0, 'k'), traits: randomTraits(r0), bg: { utbildning: 'Jurist', yrke: 'Advokat', hemstad: 'Umeå', familj: 'Medelklass' } };
const partyDef = { name: 'Textpartiet', abbr: 'TX', color: '#8e44ad', color2: '#fff', logo: { shape: 'star', glyph: 'TX' }, slogan: 'Ord!', pos: { ...IDEOLOGIES.find((i) => i.id === 'socialliberalism').pos }, profile: {}, ideology: { primary: 'socialliberalism', secondary: [] }, manifesto: 'Vi lovar 100 000 nya bostäder till 2030 och att aldrig höja skatten på arbete. Vården ska bli bättre.', ideologyName: 'Nordisk pragmatism' };
const { state, rnd } = newGame({ seed: 7, mode: 'new', party: partyDef, leader: leaderDef });
const me = state.parties[state.player.partyId]; const l = state.people[me.leader];
const parties = activeParties(state).filter((p) => !p.isPlayer);
const ctx = { stats: state.sweden.stats, parties };

// --- analysen ---
let a = analyzeText('Vi sänker skatten på arbete med 10 procent och bygger 200 000 nya bostäder till 2030. Det finansieras genom lägre bidrag.', ctx);
ok(a.issues.ekonomi && a.issues.bostad, 'analys: frågor (ekonomi, bostad) känns igen');
ok(a.stance.ekonomi > 0, 'analys: "sänker skatten" = höger på ekonomi');
ok(a.promises.length >= 1 && a.promises.some((p) => p.number === 10 || p.number === 200000), `analys: löften med siffror (${a.promises.map((p) => p.number).join(',')})`);
ok(a.dominant === 'saklig', 'analys: saklig ton');
a = analyzeText('Socialdemokraterna ljuger och sviker Sverige! Skäms! Katastrof!', ctx);
ok(a.dominant === 'aggressiv', 'analys: konfrontativ ton');
ok(a.attacks.includes('s'), 'analys: angrepp på S känns igen');
ok(a.risky > 40, `analys: hög risk (${a.risky})`);
a = analyzeText('Arbetslösheten är 25 procent och det är regeringens fel.', ctx);
ok(a.claims.length === 1 && a.claims[0].stat === 'arbetsloshet' && a.claims[0].ok === false, 'analys: felaktigt faktapåstående upptäcks');
a = analyzeText(`Arbetslösheten är ${state.sweden.stats.arbetsloshet.toFixed(1)} procent.`, ctx);
ok(a.claims[0]?.ok === true, 'analys: korrekt siffra godkänns');
a = analyzeText('Vi återkommer om det. Det viktiga är inte exakt hur, utan att vi gör det.', { ...ctx, question: 'Hur ska skattesänkningen finansieras?', questionIssue: 'ekonomi' });
ok(a.dominant === 'undvikande' && a.answers < .45, `analys: undvikande svar (answers ${a.answers.toFixed(2)})`);
a = analyzeText('haha nej, regeringens plan är ett skämt 😂 vi föreslår riktiga reformer', ctx);
ok(a.dominant === 'humor', 'analys: humor');
a = analyzeText('', ctx); ok(a.vague && a.clarity === 0, 'analys: tom text är vag');
a = analyzeText('Vi inför gratis tandvård för alla under 30 år. Det kostar 4 miljarder.', ctx);
ok(!a.promises.some((p) => p.unit === 'år'), 'analys: "under 30 år" är en ålder, inte ett löfte');
a = analyzeText('Kära vänner! Ni är inte bortglömda. Vi lovar 3 miljarder till vägarna här uppe. Tack.', ctx);
ok(a.promises.length === 1 && a.promises[0].text.startsWith('Vi lovar 3 miljarder'), `analys: löftestexten är hela meningen ("${a.promises[0]?.text}")`);

// --- v0.5: fria formuleringar, känslor, dryghet, räkneord ---
a = analyzeText('Folk har inte råd med maten längre, priserna skenar.', ctx); ok(a.topics[0] === 'ekonomi', 'förståelse: "inte råd med maten" = ekonomi');
a = analyzeText('Mormor fick vänta i åtta timmar på akuten.', ctx); ok(a.topics[0] === 'valfard', 'förståelse: "mormor på akuten" = vård');
a = analyzeText('Vi måste ta hand om planeten för våra barnbarn.', ctx); ok(a.topics.includes('klimat') && a.stance.klimat < 0, 'förståelse: "planeten" = klimat, grön riktning');
a = analyzeText('Stäng gränsen nu, vi har tagit emot för många.', ctx); ok(a.topics[0] === 'migration' && a.stance.migration > 0, 'förståelse: "stäng gränsen" = stram migration');
a = analyzeText('Vi lovar femtiotusen nya bostäder och tio procent lägre skatt.', ctx); ok(a.promises.some((p) => p.number === 50000) && a.promises.some((p) => p.number === 10), 'räkneord: femtiotusen och tio procent');
a = analyzeText('Du är en idiot och en lögnare!!! Skäms!', { ...ctx, opponentPartyId: 's' }); ok(a.emotion.insult > .6 && a.intensity > 0 && a.attacks.includes('s'), `känsla: förolämpning (insult ${a.emotion.insult}, intensitet ${a.intensity})`);
a = analyzeText('Haha, var det allt? Patetiskt försök.', ctx); ok(a.emotion.mock > .6, 'känsla: hån');
a = analyzeText('Det är en bra poäng, jag håller med dig och respekterar dig.', ctx); ok(a.emotion.praise > .5 && a.dominant !== 'aggressiv', 'känsla: beröm (och inte konfrontativ)');
a = analyzeText('Som alla begriper förstår du inte det här, lilla vän. Läs på.', ctx); ok(a.dryg > .5 && a.dominant === 'dryg', 'attityd: dryg');
const { moodDelta, applyMoodTo, moodLabel, moodEffects, blankMood } = await import('../js/sim/emotion.js');
{ const m = blankMood(); applyMoodTo(m, moodDelta(analyzeText('Du är en idiot och en lögnare!!! Skäms!', ctx), { ok: true }), { lugn: 30, aggressivitet: 70 }); ok(m.anger > 35 && moodLabel(m).key === 'anger', `humör: förolämpning gör motståndaren arg (${moodLabel(m).label}, ${m.anger.toFixed(0)})`); const m2 = blankMood(); applyMoodTo(m2, moodDelta(analyzeText('Det var klokt sagt, jag respekterar dig verkligen.', ctx), { ok: false }), { lugn: 50 }); ok(m2.joy > 10 && moodLabel(m2).key === 'joy', `humör: beröm gör motståndaren glad (${m2.joy.toFixed(0)})`); const m3 = blankMood(); m3.anger = 90; let ob = 0; for (let i = 0; i < 40; i++) if (moodEffects(m3, rnd).outburst) ob++; ok(ob > 5, `humör: rasande motståndare får utbrott (${ob}/40)`); }
// --- manifestet registrerades vid start ---
ok(state.memory.statements.length === 1 && state.memory.statements[0].kind === 'program', 'programförklaringen sparades i minnet');
ok(state.memory.promises.length >= 1 && state.memory.promises.some((p) => p.number === 100000), 'manifestets löfte med siffra sparades');
ok(me.manifesto && me.ideologyName === 'Nordisk pragmatism', 'egen ideologi och programförklaring finns på partiet');

// --- minne & motsägelser ---
let rec = recordStatement(state, 'Vi måste minska invandringen kraftigt och ställa hårdare krav.', 'post');
ok(rec.contradictions.length >= 0 && rec.statement.stance.migration > 0, 'minne: uttalande sparas med ståndpunkt');
rec = recordStatement(state, 'Sverige ska vara ett öppet, humant land som välkomnar människor på flykt.', 'debate', { question: 'Vad vill ni med migrationen?' });
ok(rec.contradictions.length >= 1, `minne: motsägelse mot tidigare uttalande hittas (${rec.contradictions[0]?.slice(0, 50)})`);
ok(personaLabel(state) !== undefined, 'minne: persona-etikett beräknas');
rec = recordStatement(state, 'Arbetslösheten är 25 procent.', 'press');
const fc = factCheck(state, rec.statement);
ok(fc && state.news[0].tags.includes('faktakoll'), 'faktakoll: nyhet skapas vid fel siffra');

// --- fria inlägg ---
a = analyzeText('Nu räcker det. Vi bygger 50 000 nya bostäder per år – på riktigt. #bostad', ctx);
const po = composeFreePost(state, rnd, { platform: 'x', format: 'text', text: 'Nu räcker det. Vi bygger 50 000 nya bostäder per år – på riktigt. #bostad', analysis: a });
ok(po.reach > 0 && state.social.posts[0] === po && po.free, `inlägg: fritt inlägg publicerat (räckvidd ${po.reach})`);
const comments = await commentsFor(state, rnd, po, a);
ok(comments.length >= 3 && comments.every((c) => c.who && c.text), `inlägg: ${comments.length} kommentarer genererade`);
po.comments = comments;
const note = replyToComment(state, rnd, po, comments[0], 'Tack! Precis så.', analyzeText('Tack! Precis så.', ctx));
ok(typeof note === 'string' && po.comments.some((c) => c.mine), 'inlägg: svar i kommentarsfältet');
const shot = deletePost(state, rnd, po);
ok(po.deleted && typeof shot === 'boolean', 'inlägg: radering fungerar');

// --- fria debattsvar ---
const d = buildDebate(state, rnd, { kind: 'tv' });
const r0i = 0; const rr = d.rounds[r0i];
a = analyzeText(`Det stämmer inte. Ni har fel om siffrorna. Vi föreslår konkret: 5 miljarder till polisen och 2 000 nya poliser till 2030.`, { ...ctx, question: rr.statement, questionIssue: rr.issue });
const out = resolveFree(state, rnd, d, r0i, 'Det stämmer inte. Ni har fel om siffrorna. Vi föreslår konkret: 5 miljarder till polisen och 2 000 nya poliser till 2030.', a);
ok(Number.isFinite(out.delta) && rr.resolved && rr.type, `debatt: fritt svar löst (ok=${out.ok}, delta ${out.delta.toFixed(0)}, typ ${rr.type})`);
const rep = await opponentReply(state, rnd, { opponentParty: state.parties[d.opponentParty], opponent: d.opponent, playerText: 'x', analysis: a, issue: rr.issue, statement: rr.statement });
ok(typeof rep === 'string' && rep.length > 5, 'debatt: motståndarens replik genereras');
for (let i = 1; i < d.rounds.length; i++) { const rx = d.rounds[i]; const ax = analyzeText('Jag tror vi är överens om målet. Låt oss hitta en lösning.', { ...ctx, question: rx.statement, questionIssue: rx.issue }); resolveFree(state, rnd, d, i, 'Jag tror vi är överens om målet.', ax); }
const fin = finishDebate(state, rnd, d);
ok(['vann', 'förlorade', 'oavgjort'].includes(fin.verdict), `debatt: avslutad (${fin.verdict}, mätare ${fin.meter.toFixed(0)})`);
const gaffes = Array.from({ length: 30 }, () => buildDebate(state, rnd, { kind: 'tv' })).flatMap((x) => x.rounds).filter((x) => x.gaffe);
ok(gaffes.length > 0, `debatt: AI-motståndare gör ibland faktafel (${gaffes.length} av ${30 * 4} rundor)`);
const iv = buildDebate(state, rnd, { kind: 'interview' });
const ivr = iv.rounds[0];
a = analyzeText('Det viktiga är inte exakt hur. Vi återkommer.', { ...ctx, question: ivr.statement, questionIssue: ivr.issue });
const ivo = resolveFree(state, rnd, iv, 0, 'Det viktiga är inte exakt hur. Vi återkommer.', a);
ok(ivo.followUp === true, 'intervju: undvikande svar ger följdfråga');
const fu = await followUp(state, rnd, { question: ivr.statement, answer: 'x', analysis: a, journalist: state.journalists[iv.journalistId], issue: ivr.issue, kind: 'interview' });
ok(typeof fu === 'string' && fu.length > 5, 'intervju: följdfråga formuleras');

// --- tal ---
const speech = 'Kära vänner i Norrbotten! Ni är inte bortglömda. Vi lovar 3 miljarder till vägarna här uppe. Tillsammans tar vi strid. Det här handlar om människor, om familjer, om framtiden. Nu räcker det!';
a = analyzeText(speech, ctx);
const reac = speechReactions(state, rnd, speech, a, { id: 'BD', name: 'Norrbotten' });
ok(reac.lines.length >= 4 && Number.isFinite(reac.score), `tal: ${reac.lines.length} meningar bedömda, betyg ${reac.score.toFixed(0)}`);
const so = speechOutcome(state, rnd, 'BD', speech, reac);
ok(so.crowd > 0 && so.mult > 0, 'tal: utfall, publik och multiplikator');

// --- presskonferens ---
a = analyzeText('Vi föreslår en ny skolreform: 10 000 fler lärare till 2030, finansierat genom slopade skatteavdrag.', ctx);
const qs = pressQuestions(state, rnd, 'valfard', a);
ok(qs.length >= 2 && qs.every((q) => q.q), `press: ${qs.length} frågor från journalister`);
const pa = pressAnswer(state, rnd, qs[0], 'Det finansieras genom slopat ränteavdrag, 12 miljarder per år.', analyzeText('Det finansieras genom slopat ränteavdrag, 12 miljarder per år.', { ...ctx, question: qs[0].q, questionIssue: qs[0].issue }));
ok(Number.isFinite(pa.delta) && pa.note, `press: svar bedömt (${pa.delta})`);
const pn = pressAnswer(state, rnd, qs[1], '', null, true);
ok(pn.delta < 0, 'press: "ingen kommentar" kostar');
const ps = pressSummary(state, rnd, 'valfard', { ...a, text: 'Vi föreslår…' }, [pa, pn]);
ok(ps.headline && state.news[0].headline === ps.headline, 'press: rubrik och nyhet');

// --- samtal ---
const tgt = parties[0];
const relBefore = tgt.relations[me.id] || 0;
const talk = await privateTalk(state, rnd, { kind: 'leader', party: tgt }, 'Jag tror vi kan samarbeta om skolan. Tillsammans kan vi få igenom en bra reform.', analyzeText('Jag tror vi kan samarbeta om skolan.', ctx), 1);
ok(typeof talk.reply === 'string' && talk.delta > 0 && (tgt.relations[me.id] || 0) > relBefore, `samtal: partiledaren svarar, relation ${relBefore.toFixed(0)} → ${(tgt.relations[me.id] || 0).toFixed(0)}`);
const per = state.people[me.people[0]];
const talk2 = await privateTalk(state, rnd, { kind: 'person', person: per }, 'Du gör ett fantastiskt jobb. Jag räknar med dig.', analyzeText('Du gör ett fantastiskt jobb. Jag räknar med dig.', ctx), 1);
ok(typeof talk2.reply === 'string', 'samtal: partikamrat svarar');
const j = Object.values(state.journalists)[0];
const talk3 = await privateTalk(state, rnd, { kind: 'journalist', journalist: j }, 'Off record: Moderaterna ljuger om allt. De är korrupta idioter.', analyzeText('Off record: Moderaterna ljuger om allt. De är korrupta idioter.', ctx), 1);
ok(typeof talk3.reply === 'string' && typeof talk3.leak === 'object', `samtal: journalist off record (läcka: ${talk3.leak ? 'ja' : 'nej'})`);

// --- förhandlingsbud ---
const demand = { text: 'Vi vill ha 2 miljarder extra till landsbygden i budgeten.', cost: '2 mdkr' };
const nc1 = await negotiationCounter(state, rnd, tgt, { title: 'Testförslag' }, demand, 'Okej, vi går med på 2 miljarder till landsbygden.', analyzeText('Okej, vi går med på 2 miljarder till landsbygden.', ctx));
ok(nc1.decision === 'accept', 'förhandling: tydligt ja accepteras');
const nc2 = await negotiationCounter(state, rnd, tgt, { title: 'Testförslag' }, demand, 'Ni är idioter. Aldrig.', analyzeText('Ni är idioter. Aldrig.', ctx));
ok(nc2.decision === 'reject', 'förhandling: angrepp avvisas');
const nc3 = await negotiationCounter(state, rnd, tgt, { title: 'Testförslag' }, demand, 'Vi erbjuder 1 miljard i utbyte mot ert stöd, och en utredning om resten.', analyzeText('Vi erbjuder 1 miljard i utbyte mot ert stöd.', ctx));
ok(['counter', 'reject'].includes(nc3.decision) && nc3.reply, `förhandling: motbud hanteras (${nc3.decision})`);

// --- erbjudande i regeringsbildning ---
const wBefore = willingness(state, tgt, me);
const fo = formationOffer(state, tgt, 'Vi erbjuder er finansministerposten och utrikesministerposten, och vi sänker skatten på arbete som ni vill.', analyzeText('Vi erbjuder er finansministerposten och utrikesministerposten, och vi sänker skatten på arbete som ni vill.', ctx));
ok(fo.ministries.length === 2 && fo.bonus > 0 && willingness(state, tgt, me) > wBefore, `erbjudande: +${fo.bonus} i vilja, ${fo.ministries.join('+')}`);
ok(state.secretDeals.length === 1, 'erbjudande: hemlig uppgörelse sparad');
clearOffers(state); ok(!tgt.offerBonus, 'erbjudande: nollställs efter rundan');
for (let i = 0; i < 60 && !state.secretDeals[0].leaked; i++) leakSecretDeals(state, rnd);
ok(state.secretDeals[0].leaked, 'läcka: hemlig uppgörelse läcker förr eller senare');

// --- fokusgrupp & utspel ---
const fg = focusGroup(state, rnd);
ok(fg.groups.length >= 2 && fg.tips.length >= 1, `fokusgrupp: ${fg.groups.length} grupper, ${fg.tips.length} tips`);
const ue = utspelEffect(state, rnd, 'Vi inför gratis tandvård för alla under 30 år. Det kostar 4 miljarder.', analyzeText('Vi inför gratis tandvård för alla under 30 år. Det kostar 4 miljarder.', ctx), null);
ok(ue.issue && state.news[0].tags.includes(ue.issue), `utspel: fråga härledd (${ue.issue})`);

// --- framgrävt + löfteskoll + ministrar ---
state.memory.statements[1].week = -40; state.memory.statements[1].risky = 60;
const dug = digOldStatement(state, rnd);
ok(dug && dug.resurfaced, 'minne: gammalt riskabelt uttalande grävs fram');
state.date.y += 4;
const tp = checkTextPromises(state);
ok(tp.length >= 1 && tp.every((p) => p.checked), `löfteskoll: ${tp.length} fritextlöften bedömda (${tp.map((p) => p.checked).join(',')})`);
state.date.y -= 4;
const mm = monthlyMinisters(state, rnd); ok(Array.isArray(mm), 'ministrar: månadssteget körs');

// --- v0.5: följare växer med opinionen, personligheten formas av beteendet ---
{ const { driftTraits } = await import('../js/sim/drift.js'); for (let i = 0; i < 12; i++) recordStatement(state, 'Ni ljuger och sviker Sverige! Skäms! Katastrof! Idioter!', 'post'); const before = l.traits.aggressivitet; const line = driftTraits(state, rnd); ok(l.traits.aggressivitet > before && typeof line === 'string', `drift: ofta aggressiv → aggressivitet ${before.toFixed(1)} → ${l.traits.aggressivitet.toFixed(1)}`); for (let i = 0; i < 12; i++) recordStatement(state, 'Som alla begriper förstår du inte det här, lilla vän. Läs på innan du uttalar dig.', 'post'); const kar = l.traits.karisma; driftTraits(state, rnd); ok(l.traits.karisma < kar, `drift: ofta dryg → karisma ${kar.toFixed(1)} → ${l.traits.karisma.toFixed(1)}`); }
{ const { weeklySocial } = await import('../js/sim/social.js'); const f0 = state.social.followers[l.id].x; state.opinion.support[me.id] = 12; state.opinion.awareness[me.id] = 1; for (let i = 0; i < 20; i++) weeklySocial(state, rnd); ok(state.social.followers[l.id].x > f0 * 3, `följare: växer med opinionen (${f0} → ${state.social.followers[l.id].x})`); }
// --- några veckor med allt på ---
let errors = 0;
for (let w = 0; w < 30; w++) { try { endWeek(state, rnd); state.queue.length = 0; } catch (e) { errors++; console.error(e.stack); break; } }
ok(errors === 0, '30 veckor utan fel med minne, läckor och trötthet');
ok(Number.isFinite(l.fatigue), `trötthet spåras (${l.fatigue})`);
// migrering av gammal sparning
const old = JSON.parse(JSON.stringify(state)); delete old.memory; delete old.secretDeals; old.v = 3;
migrate(old); ok(old.memory && old.secretDeals && old.v === 4, 'migrering: v3 → v4 lägger till minne');
console.log(`\n${pass} gröna, ${fail} röda`);
process.exit(fail ? 1 : 0);
