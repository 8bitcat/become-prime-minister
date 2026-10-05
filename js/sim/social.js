// Sociala medier: plattformar, inlägg, räckvidd, följare – och gamla inlägg som dyker upp igen.
import { ISSUE_BY_ID, ISSUES } from '../data/issues.js';
import { SEGMENTS } from '../data/segments.js';
import { clamp, pick, gauss, fmt } from '../core/util.js';
import { addNews } from './news.js';
import { activeParties } from './opinion.js';

export const PLATFORMS = [
  { id: 'x', name: 'X', icon: '𝕏', viral: 1.3, seg: { storstad_akademiker: 1.5, storstad_unga: 1.2, foretagare: 1.2, pensionarer: .5 }, scandal: 1.4 },
  { id: 'instagram', name: 'Instagram', icon: '📷', viral: 1.0, seg: { storstad_unga: 1.6, forort_familjer: 1.3, studenter: 1.4, pensionarer: .4 }, scandal: .8 },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', viral: 1.8, seg: { storstad_unga: 2.2, studenter: 2.0, utrikes_fodda: 1.3, pensionarer: .1, hoginkomst: .4 }, scandal: 1.3 },
  { id: 'facebook', name: 'Facebook', icon: '📘', viral: .8, seg: { pensionarer: 2.0, landsbygd: 1.7, industri: 1.3, storstad_unga: .3, studenter: .3 }, scandal: 1.0 },
];
export const TONES = [
  { id: 'saklig', name: 'Saklig', desc: 'Fakta och förslag. Trovärdigt men sällan viralt.', reach: .8, cred: 1.5, risk: .2 },
  { id: 'kampande', name: 'Kämpande', desc: 'Tydligt, engagerat, "vi mot problemen".', reach: 1.1, cred: .5, risk: .5 },
  { id: 'humor', name: 'Humoristisk', desc: 'Memes och ironi. Kan bli viralt – eller landa fel.', reach: 1.5, cred: -.3, risk: 1.2 },
  { id: 'provocerande', name: 'Provocerande', desc: 'Går hårt åt motståndare. Stor räckvidd, stor risk.', reach: 1.9, cred: -1, risk: 2.4 },
  { id: 'personlig', name: 'Personlig', desc: 'Om dig själv, familjen, vardagen. Bygger sympati.', reach: 1.0, cred: .4, risk: .6 },
];
export const FORMATS = [
  { id: 'text', name: 'Text', reach: 1 }, { id: 'bild', name: 'Bild', reach: 1.2 }, { id: 'video', name: 'Video', reach: 1.6 }, { id: 'meme', name: 'Meme', reach: 1.5 }, { id: 'debattklipp', name: 'Debattklipp', reach: 1.4 },
];

export function initSocial(state) {
  state.social = { followers: {}, posts: [], week: 0 };
  for (const p of activeParties(state)) {
    const l = state.people[p.leader];
    const base = p.isPlayer && !p.inRiksdag ? 120 : 15000 + (p.seats || 0) * 2500;
    state.social.followers[l.id] = {}; for (const pl of PLATFORMS) state.social.followers[l.id][pl.id] = Math.round(base * (pl.id === 'tiktok' ? .4 : pl.id === 'facebook' ? 1.3 : 1) * (.7 + Math.random() * .6));
  }
}
export const followersOf = (state, personId) => Object.values(state.social.followers[personId] || {}).reduce((a, b) => a + b, 0);

const TEXTS = {
  issue: {
    saklig: ['Vi har ett konkret förslag om {frågan}: {förslag}. Läs mer på vår sida.', 'Tre punkter om {frågan} som vi går till val på: {förslag}. Det är så vi gör skillnad.'],
    kampande: ['Nu räcker det. {frågan} kan inte vänta längre. {förslag} – det är vårt löfte till Sverige.', 'Medan andra pratar levererar vi. {förslag}. Det är dags att ta {frågan} på allvar.'],
    humor: ['Regeringens plan för {frågan}: 🤷. Vår plan: {förslag}. 😎', 'Breaking: politiker löser {frågan} genom att tillsätta en utredning om utredningar. Vi föreslår i stället: {förslag}.'],
    provocerande: ['De andra partierna har svikit er i frågan om {frågan}. De ljuger. Vi säger som det är: {förslag}.', 'Eliten bryr sig inte om {frågan}. Vi gör det. {förslag} – och vi ber inte om ursäkt.'],
    personlig: ['Jag växte upp i {hemstad}. Där lärde jag mig varför {frågan} spelar roll. {förslag}.', 'Satt vid köksbordet i kväll och tänkte på {frågan}. Det är därför jag gör det här. {förslag}.'],
  },
  attack: {
    saklig: ['{parti} röstade {röst} om "{lag}". Väljarna förtjänar att veta vad det betyder.', 'Faktakoll: {parti} lovade en sak och gjorde en annan. Vi håller vad vi lovar.'],
    kampande: ['{parti} står i vägen för förändring. Sverige förtjänar bättre.', 'Varje dag som {parti} styr debatten är en förlorad dag för vanligt folk.'],
    humor: ['{parti} har nu bytt åsikt fler gånger än jag bytt strumpor. 🧦', 'Kan någon skicka en GPS till {parti}? De verkar ha tappat bort sin egen politik.'],
    provocerande: ['{parti} är ett hot mot Sverige. Punkt.', '{partiledare} borde skämmas. Hela {parti} borde skämmas.'],
    personlig: ['Jag blev uppriktigt ledsen när jag såg vad {parti} sa i dag. Vi måste kunna bättre.', 'Min mamma frågade varför {parti} gör så här. Jag hade inget bra svar.'],
  },
  news: {
    saklig: ['Om dagens nyhet: {rubrik}. Vår linje är tydlig: {förslag}.', 'Kommentar till "{rubrik}": det här bekräftar behovet av {förslag}.'],
    kampande: ['"{rubrik}" – det här är precis det vi varnat för. {förslag}, nu.', 'Läs rubriken: "{rubrik}". Så här kan vi inte ha det. {förslag}.'],
    humor: ['"{rubrik}". Jag har inga ord. Jo, tre: {förslag}.', 'Rubriken i dag: "{rubrik}". Mitt ansikte: 😐. Lösningen: {förslag}.'],
    provocerande: ['"{rubrik}" – och de ansvariga sitter kvar. Skandal. {förslag}!', 'Vakna! "{rubrik}". Makthavarna skrattar åt er. {förslag}.'],
    personlig: ['Läste "{rubrik}" i morse och tänkte på alla jag mött som drabbas. {förslag}.', '"{rubrik}". Det här berör mig personligen. {förslag}.'],
  },
};
const PROPOSALS = {
  ekonomi: ['sänkta skatter på arbete', 'en rättvis skattepolitik', 'ordning i statsfinanserna'], migration: ['en migrationspolitik som fungerar', 'krav och möjligheter för nyanlända', 'en human och ordnad asylpolitik'],
  kriminal: ['fler poliser och tydligare straff', 'förebyggande insatser som faktiskt fungerar', 'att bryta gängens makt'], klimat: ['en klimatpolitik som levererar', 'tillväxt och klimat hand i hand', 'bindande utsläppsmål'],
  forsvar: ['ett försvar som avskräcker', 'ett tryggt Sverige i en orolig tid', 'ett starkt totalförsvar'], eu: ['ett Sverige som tar plats i Europa', 'svensk självbestämmande', 'ett bättre EU'],
  valfard: ['kortare vårdköer', 'en skola där alla lär sig', 'en välfärd att lita på'], landsbygd: ['att hela Sverige ska leva', 'service och vägar på landsbygden', 'lägre bränslepriser'],
  varderingar: ['frihet för varje människa', 'sammanhållning och trygghet', 'respekt för varandra'], arbete: ['fler i arbete', 'trygga jobb', 'en arbetsmarknad som fungerar'],
  bostad: ['att det byggs mer', 'rimliga boendekostnader', 'bostäder för unga'], energi: ['stabila elpriser', 'ny kärnkraft', 'mer förnybar el'],
};

export function composePost(state, rnd, { platform, kind, issue, tone, format, target, newsItem }) {
  const me = state.parties[state.player.partyId];
  const leader = state.people[me.leader];
  const pl = PLATFORMS.find((p) => p.id === platform), tn = TONES.find((t) => t.id === tone), fm = FORMATS.find((f) => f.id === format);
  const iss = issue ? ISSUE_BY_ID[issue] : null;
  const tgt = target ? state.parties[target] : null;
  const tmpl = pick(rnd, TEXTS[kind][tone]);
  const lastVote = tgt ? (state.riksdag.record[tgt.id] || []).slice(-1)[0] : null;
  const text = tmpl.replace('{frågan}', iss ? iss.name.toLowerCase() : 'det som spelar roll').replace('{förslag}', iss ? pick(rnd, PROPOSALS[iss.id]) : 'en ny politik').replace('{hemstad}', leader.bg.hemstad)
    .replace('{parti}', tgt ? tgt.name : 'de andra').replace('{partiledare}', tgt ? state.people[tgt.leader].name : 'partiledaren').replace('{röst}', lastVote ? lastVote.vote : 'nej').replace('{lag}', lastVote ? lastVote.title : 'ett viktigt förslag')
    .replace('{rubrik}', newsItem ? newsItem.headline : 'dagens nyhet');
  // räckvidd (en ny partiledare börjar med små konton)
  const acct = (state.social.followers[leader.id] ||= Object.fromEntries(PLATFORMS.map((p) => [p.id, 300])));
  const fol = acct[platform] || 10;
  const sal = iss ? state.opinion.salience[iss.id] || 1 : 1;
  const charisma = (leader.traits.karisma - 45) / 100, retorik = (leader.traits.retorik - 45) / 100;
  const viralRoll = Math.exp(gauss(rnd, 0, .9)); // tung svans: ibland går det viralt
  const reach = Math.round((fol * 1.4 + 400) * pl.viral * tn.reach * fm.reach * (1 + sal * .3) * (1 + charisma * .8 + retorik * .3) * viralRoll * (kind === 'attack' ? 1.2 : 1));
  const engagement = clamp(.03 + charisma * .03 + (tone === 'provocerande' ? .03 : 0) + (format === 'video' || format === 'meme' ? .02 : 0), .01, .2);
  const likes = Math.round(reach * engagement);
  const newFollowers = Math.round(reach * .004 * (1 + charisma));
  acct[platform] += newFollowers;
  // effekt på kännedom & uppmärksamhet & opinion
  const aw = state.opinion.awareness[me.id] ?? 1;
  if (aw < 1) state.opinion.awareness[me.id] = clamp(aw + reach / 3.5e6, 0, 1);
  me.attention = clamp(me.attention + reach / 40000, 0, 100);
  me.credibility = clamp(me.credibility + tn.cred * .3, 0, 100);
  // opinion: plattformens grupper rör sig lite mot oss (eller från oss om det landar fel)
  const landedWrong = rnd() < tn.risk * .06 * (1 - leader.traits.retorik / 150);
  let swing = (reach / 400000) * (landedWrong ? -1.2 : 1) * (kind === 'attack' ? .8 : 1);
  swing = clamp(swing, -.6, .6);
  for (const sg of SEGMENTS) {
    const f = pl.seg[sg.id] || 1;
    const seg = state.opinion.seg[sg.id]; if (!seg) continue;
    const fit = iss ? 1 - Math.abs((me.pos[iss.id] || 0) - (sg.ideal[iss.id] || 0)) / 200 : .6;
    seg[me.id] = Math.max(.01, (seg[me.id] || .1) + swing * f * (fit * 2 - .8));
  }
  if (tgt) { tgt.relations ||= {}; tgt.relations[me.id] = clamp((tgt.relations[me.id] || 0) - (tone === 'provocerande' ? 12 : 5), -100, 100); if (reach > 60000) tgt.attention = clamp(tgt.attention + 2, 0, 100); }
  // risk: inlägget sparas med en "sprängkraft" som kan utlösas senare
  const risk = Math.round(tn.risk * pl.scandal * (kind === 'attack' ? 1.5 : 1) * (landedWrong ? 3 : 1) * 10 + (iss && ['migration', 'varderingar'].includes(iss.id) && tone !== 'saklig' ? 8 : 0));
  const post = { id: 'po' + state.week + '_' + Math.floor(rnd() * 1e5), week: state.week, date: { ...state.date }, platform, kind, issue, tone, format, target: target || null, text, reach, likes, newFollowers, risk, resurfaced: false, landedWrong };
  state.social.posts.unshift(post);
  if (state.social.posts.length > 200) state.social.posts.pop();
  (state.social.week ||= 0);
  // nyheter om det gick viralt eller landade fel
  if (reach > 400000) addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen', 'tv4']), headline: `${leader.name}s ${fm.name.toLowerCase()} sprids som en löpeld – ${fmt(reach)} visningar`, body: `"${text.slice(0, 90)}…" Inlägget på ${pl.name} delas av både anhängare och kritiker.`, tags: ['some'], partyId: me.id, importance: 2 });
  if (landedWrong) addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen']), headline: `Kritikstorm mot ${leader.name} efter inlägg på ${pl.name}`, body: `"${text.slice(0, 80)}…" – inlägget beskrivs som ${pick(rnd, ['tondövt', 'osmakligt', 'ett självmål', 'ett lågvattenmärke'])}. ${me.abbr} vill inte kommentera.`, tags: ['some', 'skandal'], partyId: me.id, importance: 2, tone: -1 });
  return post;
}

// ---- fritext: spelaren skriver inlägget själv, analysen avgör hur världen reagerar ----
const TONE_MULT = { saklig: { reach: .8, cred: .45, risk: .15 }, kampande: { reach: 1.1, cred: .15, risk: .4 }, humor: { reach: 1.5, cred: -.1, risk: 1.0 }, aggressiv: { reach: 1.9, cred: -.35, risk: 2.2 }, kansla: { reach: 1.0, cred: .15, risk: .5 }, undvikande: { reach: .55, cred: -.1, risk: .3 } };
export function composeFreePost(state, rnd, { platform, format, text, analysis: a }) {
  const me = state.parties[state.player.partyId];
  const leader = state.people[me.leader];
  const pl = PLATFORMS.find((p) => p.id === platform) || PLATFORMS[0]; const fm = FORMATS.find((f) => f.id === format) || FORMATS[0];
  const tn = TONE_MULT[a.dominant] || TONE_MULT.saklig;
  const issues = Object.keys(a.issues || {});
  const sal = issues.length ? Math.max(...issues.map((id) => state.opinion.salience[id] || 1)) : .9;
  const acct = (state.social.followers[leader.id] ||= Object.fromEntries(PLATFORMS.map((p) => [p.id, 300])));
  const fol = acct[platform] || 10;
  const charisma = (leader.traits.karisma - 45) / 100, retorik = (leader.traits.retorik - 45) / 100;
  const viralRoll = Math.exp(gauss(rnd, 0, .9));
  const len = text.length;
  const lenMult = len < 30 ? .75 : len > 700 ? .8 : 1;
  const hooks = (/[!?]/.test(text) ? .05 : 0) + (/#\w/.test(text) ? .05 : 0) + (/[\u{1F300}-\u{1FAFF}]/u.test(text) ? .05 : 0);
  const reach = Math.round((fol * 1.4 + 400) * pl.viral * tn.reach * fm.reach * lenMult * (1 + hooks) * (1 + (sal - 1) * .3) * (1 + a.clarity * .25) * (1 + charisma * .8 + retorik * .3) * viralRoll * ((a.attacks || []).length ? 1.2 : 1));
  const engagement = clamp(.03 + charisma * .03 + (a.dominant === 'aggressiv' ? .03 : 0) + (format === 'video' || format === 'meme' ? .02 : 0) + a.clarity * .01, .01, .2);
  const likes = Math.round(reach * engagement);
  const newFollowers = Math.round(reach * .004 * (1 + charisma) * (a.vague ? .5 : 1));
  acct[platform] += newFollowers;
  const aw = state.opinion.awareness[me.id] ?? 1;
  if (aw < 1) state.opinion.awareness[me.id] = clamp(aw + reach / 3.5e6, 0, 1);
  me.attention = clamp(me.attention + reach / 40000, 0, 100);
  const wrongClaims = (a.claims || []).filter((c) => c.ok === false).length, okClaims = (a.claims || []).filter((c) => c.ok === true).length;
  me.credibility = clamp(me.credibility + tn.cred * .3 + okClaims * .4 - wrongClaims * 1.2, 0, 100);
  const landedWrong = rnd() < clamp((a.risky / 100) * .35 * (1 - leader.traits.retorik / 150) + wrongClaims * .25 + (a.vague ? .04 : 0), 0, .9);
  let swing = (reach / 400000) * (landedWrong ? -1.2 : 1) * ((a.attacks || []).length ? .8 : 1);
  swing = clamp(swing, -.6, .6);
  for (const sg of SEGMENTS) {
    const f = pl.seg[sg.id] || 1;
    const seg = state.opinion.seg[sg.id]; if (!seg) continue;
    let fit = .6, n = 0;
    for (const id in a.stance || {}) { const ideal = sg.ideal[id] || 0; fit += (Math.sign(ideal) === Math.sign(a.stance[id]) ? 1 : -1) * Math.min(1, Math.abs(ideal) / 60); n++; }
    if (n) fit = .5 + fit / (n + 1) * .5;
    seg[me.id] = Math.max(.01, (seg[me.id] || .1) + swing * f * (fit * 2 - .8));
  }
  for (const id of a.attacks || []) { const tgt = state.parties[id]; if (!tgt) continue; tgt.relations ||= {}; tgt.relations[me.id] = clamp((tgt.relations[me.id] || 0) - (a.dominant === 'aggressiv' ? 12 : 5), -100, 100); if (reach > 60000) tgt.attention = clamp(tgt.attention + 2, 0, 100); }
  const risk = Math.round(clamp(tn.risk * pl.scandal * 10 + (a.risky / 100) * 30 + (landedWrong ? 20 : 0) + ((issues.includes('migration') || issues.includes('varderingar')) && a.dominant !== 'saklig' ? 8 : 0) + wrongClaims * 8, 0, 100));
  const post = { id: 'po' + state.week + '_' + Math.floor(rnd() * 1e5), week: state.week, date: { ...state.date }, platform, kind: (a.attacks || []).length ? 'attack' : 'issue', issue: issues[0] || null, tone: a.dominant, format, target: (a.attacks || [])[0] || null, text, reach, likes, newFollowers, risk, resurfaced: false, landedWrong, free: true, dominant: a.dominant, issues, comments: [], deleted: false, wrongClaims, promises: (a.promises || []).length };
  state.social.posts.unshift(post);
  if (state.social.posts.length > 200) state.social.posts.pop();
  if (reach > 400000) addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen', 'tv4']), headline: `${leader.name}s ${format === 'meme' ? 'meme' : fm.name.toLowerCase()} sprids som en löpeld – ${fmt(reach)} visningar`, body: `"${text.slice(0, 90)}…" Inlägget på ${pl.name} delas av både anhängare och kritiker.${a.dominant === 'humor' ? ' Memen har redan fått egna varianter.' : ''}`, tags: ['some'], partyId: me.id, importance: 2 });
  if (landedWrong) addNews(state, { outlet: pick(rnd, ['aftonbladet', 'expressen']), headline: `Kritikstorm mot ${leader.name} efter inlägg på ${pl.name}`, body: `"${text.slice(0, 80)}…" – inlägget beskrivs som ${a.dominant === 'aggressiv' ? 'hatiskt' : a.dominant === 'humor' ? 'omdömeslöst' : wrongClaims ? 'faktamässigt fel' : 'tondövt'}. ${me.abbr} vill inte kommentera.`, tags: ['some', 'skandal'], partyId: me.id, importance: 2, tone: -1 });
  return post;
}
// Radera: inlägget försvinner ur flödet – men inte ur minnet. Skärmdumpar kan spridas.
export function deletePost(state, rnd, post) {
  const me = state.parties[state.player.partyId]; const leader = state.people[me.leader];
  post.deleted = true;
  const screenshot = post.reach > 15000 && rnd() < .3 + post.risk / 150 + me.attention / 300;
  if (screenshot) {
    post.screenshot = true; me.risk = (me.risk || 0) + 4; me.trust = clamp((me.trust ?? 50) - 2, 0, 100);
    addNews(state, { outlet: pick(rnd, ['expressen', 'aftonbladet', 'flashback']), headline: `${leader.name} raderade inlägget – skärmdumparna sprids`, body: `"${post.text.slice(0, 100)}…" Inlägget togs bort efter ${pick(rnd, ['några timmar', 'en dag', 'tre dagar'])}, men internet glömmer inte. ${me.abbr}: "Formuleringen blev olycklig."`, tags: ['some'], partyId: me.id, importance: 2, tone: -1 });
  } else post.risk = Math.round(post.risk * .3);
  const st = (state.memory?.statements || []).find((s) => s.kind === 'post' && s.text === post.text.slice(0, 600)); if (st) st.deleted = true;
  return screenshot;
}
// Svara i det egna kommentarsfältet
export function replyToComment(state, rnd, post, comment, text, a) {
  const me = state.parties[state.player.partyId]; const leader = state.people[me.leader];
  post.comments.push({ who: leader.name, text, mine: true, to: comment.who, likes: Math.round(post.reach / 900 * (a.dominant === 'humor' ? 2 : 1)) });
  let note;
  if (a.dominant === 'aggressiv') { me.risk = (me.risk || 0) + 5; post.risk += 10; note = 'Du bråkar med en väljare i kommentarsfältet. Skärmdumpen är redan tagen.'; if (rnd() < .4) addNews(state, { outlet: 'flashback', headline: `${leader.name} i gräl med väljare på ${PLATFORMS.find((x) => x.id === post.platform)?.name}: "${text.slice(0, 50)}…"`, body: 'Kommentarstråden sprids med hånfulla kommentarer.', tags: ['some'], partyId: me.id, importance: 1, tone: -1 }); }
  else if (a.dominant === 'humor') { note = 'Svaret får fler likes än inlägget.'; me.attention = clamp(me.attention + 1, 0, 100); }
  else if (a.dominant === 'saklig' || a.dominant === 'kansla') { note = 'Ett vänligt, konkret svar. Folk noterar att du svarar.'; const acct = state.social.followers[leader.id]; if (acct) acct[post.platform] = Math.round((acct[post.platform] || 0) + post.reach * .0005); }
  else note = 'Du svarade.';
  return note;
}

// Veckovis: följarna växer sakta med uppmärksamheten; AI-ledare postar; gamla inlägg grävs fram
export function weeklySocial(state, rnd) {
  const out = [];
  for (const p of activeParties(state)) {
    const l = state.people[p.leader]; if (!l) continue;
    const f = state.social.followers[l.id] ||= Object.fromEntries(PLATFORMS.map((pl) => [pl.id, 50]));
    // följarna glider mot en nivå som opinionen, kännedomen och uppmärksamheten motiverar
    const sup = state.opinion.support[p.id] || 0; const aw = state.opinion.awareness[p.id] ?? 1;
    for (const pl of PLATFORMS) { const mult = pl.id === 'tiktok' ? .45 : pl.id === 'facebook' ? 1.3 : 1; const target = (p.inRiksdag ? 12000 : 300) + sup * 26000 * mult * (.4 + aw * .6) + p.attention * 400 * mult; const cur = f[pl.id] || 50; const glide = cur + (target - cur) * (target > cur ? .07 : .02); f[pl.id] = Math.round(glide * (1 + (p.momentum || 0) * .003) + (p.isPlayer ? 0 : rnd() * 30)); }
  }
  // AI-partiledare som gör utspel
  if (rnd() < .5) {
    const ai = activeParties(state).filter((p) => !p.isPlayer);
    const p = pick(rnd, ai); const l = state.people[p.leader];
    const iss = ISSUES.slice().sort((a, b) => (p.profile?.[b.id] || 1) * state.opinion.salience[b.id] - (p.profile?.[a.id] || 1) * state.opinion.salience[a.id])[0];
    const me = state.parties[state.player.partyId];
    const attackMe = me.attention > 35 && rnd() < .3;
    const h = attackMe ? `${l.name} (${p.abbr}) går till angrepp mot ${me.abbr}: "${pick(rnd, ['Oseriöst', 'Ett hot mot Sverige', 'De vet inte vad de pratar om', 'Populism av värsta sort'])}"` : `${l.name} (${p.abbr}) i utspel om ${iss.name.toLowerCase()}: "${pick(rnd, PROPOSALS[iss.id])}"`;
    addNews(state, { outlet: 'flashback', headline: h, body: attackMe ? `Inlägget har fått tusentals delningar. ${me.abbr}:s anhängare svarar i kommentarsfälten.` : `Inlägget på X och Facebook sprids i partiets kanaler.`, tags: ['some'], partyId: attackMe ? me.id : p.id, importance: attackMe ? 2 : 1 });
    p.attention = clamp(p.attention + 3, 0, 100);
    if (attackMe) { me.attention = clamp(me.attention + 2, 0, 100); state.opinion.awareness[me.id] = clamp((state.opinion.awareness[me.id] ?? 1) + .01, 0, 1); }
  }
  // gamla inlägg grävs fram – sannolikheten ökar med risk, uppmärksamhet och valrörelse
  const me = state.parties[state.player.partyId];
  const old = state.social.posts.filter((po) => !po.resurfaced && state.week - po.week > 6 && po.risk > 12 && (!po.deleted || po.screenshot));
  for (const po of old) {
    const pr = (po.risk / 100) * .035 * (1 + me.attention / 60) * (state.election.campaign ? 2.5 : 1);
    if (rnd() < pr) { po.resurfaced = true; out.push(po); break; }
  }
  return out;
}
