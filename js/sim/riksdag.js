// Riksdagen: lagförslag, omröstningar, förhandlingar och partiernas röstminne.
import { ISSUES } from '../data/issues.js';
import { activeParties } from './opinion.js';
import { clamp, pick, weighted } from '../core/util.js';
import { willingness } from './government.js';

// Förslagspoolen. vec = vilken riktning förslaget drar på varje axel (-1…1), eff = effekt på Sverige.
const B = (id, title, area, vec, desc, eff, cost = 0) => ({ id, title, area, vec, desc, eff, cost });
export const BILLS = [
  B('skatt_arbete_ner', 'Sänkt skatt på arbete', 'ekonomi', { ekonomi: 1 }, 'Jobbskatteavdraget utökas med 10 miljarder.', (s) => { s.skatt_kommunal -= .4; }, -10),
  B('skatt_hog_upp', 'Höjd skatt för höginkomsttagare', 'ekonomi', { ekonomi: -1 }, 'Statlig inkomstskatt höjs med 3 procentenheter.', (s) => { s.skatt_statlig += 3; }, 12),
  B('bolagsskatt_ner', 'Sänkt bolagsskatt', 'ekonomi', { ekonomi: 1, arbete: .4 }, 'Bolagsskatten sänks till 18 procent för att locka investeringar.', (s) => { s.skatt_bolag = Math.min(s.skatt_bolag, 18); }, -8),
  B('kapitalskatt_upp', 'Höjd kapitalskatt', 'ekonomi', { ekonomi: -1 }, 'Skatten på kapitalinkomster höjs till 35 procent.', (s) => { s.skatt_kapital = 35; }, 9),
  B('moms_mat', 'Sänkt matmoms', 'ekonomi', { ekonomi: -.3, landsbygd: .3 }, 'Momsen på livsmedel halveras under två år.', (s) => { s.moms -= .6; }, -15),
  B('rut_rot_upp', 'Utökat RUT- och ROT-avdrag', 'ekonomi', { ekonomi: 1, valfard: .4 }, 'Taket höjs till 100 000 kr per år.', (s) => { s.rutrot = 100; }, -4),
  B('a_kassa_upp', 'Höjd a-kassa', 'arbete', { arbete: -1, ekonomi: -.5 }, 'Taket i a-kassan höjs till 1 400 kr per dag.', (s) => { s.a_kassa = 1400; s.utg_socialt += 12; }, 12),
  B('las_flex', 'Flexiblare anställningsskydd', 'arbete', { arbete: 1 }, 'Fler undantag i turordningsreglerna för små företag.', (s) => { s.arbetsgivaravgift -= .2; }, 0),
  B('arbetsgivaravgift_unga', 'Sänkt arbetsgivaravgift för unga', 'arbete', { arbete: 1, ekonomi: .6 }, 'Halverad arbetsgivaravgift för anställda under 23.', (s) => { s.arbetsgivaravgift -= .9; }, -9),
  B('strafftid_gang', 'Dubbla straff för gängbrott', 'kriminal', { kriminal: 1 }, 'Straffen fördubblas för brott kopplade till kriminella nätverk.', (s) => { s.straffniva += 3; s.utg_rattsvasende += 6; }, 6),
  B('visitation', 'Visitationszoner', 'kriminal', { kriminal: 1, varderingar: .3 }, 'Polisen får visitera utan konkret misstanke i utsatta områden.', (s) => { s.gang_index -= 2; s.rattssakerhet -= 1; }, 0),
  B('polis_10000', '10 000 fler polisanställda', 'kriminal', { kriminal: .8 }, 'Rekryteringsmål och utbyggd polisutbildning.', (s) => { s.utg_polis += 10; }, 10),
  B('forebyggande', 'Nationellt program mot gängrekrytering', 'kriminal', { kriminal: -1, valfard: -.4 }, 'Socialtjänst, skola och fritidsgårdar i utsatta områden.', (s) => { s.utg_socialt += 6; s.integration += 1; }, 6),
  B('avkriminalisering', 'Avkriminalisera eget bruk av narkotika', 'kriminal', { kriminal: -1, varderingar: -.6 }, 'Vård i stället för straff vid eget bruk.', (s) => { s.narkotikadodsfall -= 40; s.fangar -= 300; }, 0),
  B('asyl_strikt', 'Skärpt asyllagstiftning', 'migration', { migration: 1 }, 'Tillfälliga uppehållstillstånd blir norm, höjda försörjningskrav.', (s) => { s.asylsokande *= .7; }, -3),
  B('arbetskraft_latt', 'Lättare arbetskraftsinvandring', 'migration', { migration: -.8, ekonomi: .5 }, 'Snabbspår för bristyrken.', (s) => { s.arbetskraftsinvandring += 6; }, 0),
  B('amnesti', 'Amnesti för ensamkommande', 'migration', { migration: -1, varderingar: -.5 }, 'Permanenta tillstånd för dem som väntat över fem år.', (s) => { s.integration += 1; s.asylsokande += 2; }, 2),
  B('sprakkrav', 'Språkkrav för medborgarskap', 'migration', { migration: .8, varderingar: .5 }, 'Godkänt språktest krävs för medborgarskap.', (s) => { s.integration += .5; }, 0),
  B('klimatlag', 'Skärpt klimatlag', 'klimat', { klimat: -1 }, 'Nettonoll 2040 och bindande utsläppsbudgetar.', (s) => { s.utg_klimat += 10; s.skatt_koldioxid += 150; }, 10),
  B('bensin_ner', 'Sänkt bensinskatt', 'klimat', { klimat: 1, landsbygd: .8 }, 'Skatten på bensin och diesel sänks med två kronor.', (s) => { s.skatt_bensin -= 2; }, -12),
  B('karnkraft_ny', 'Nya kärnkraftsreaktorer', 'energi', { energi: 1 }, 'Statliga lånegarantier för fyra nya reaktorer.', (s, st) => { st.sweden.nuclearTarget = (st.sweden.nuclearTarget ?? s.el_karnkraft) + 20; s.utg_ovrigt += 8; }, 8),
  B('vind_hav', 'Storsatsning på havsbaserad vindkraft', 'energi', { energi: -1, klimat: -.5 }, 'Staten bekostar anslutning av 30 TWh vindkraft.', (s) => { s.el_vind += 6; s.utg_ovrigt += 5; }, 5),
  B('elstod', 'Elprisstöd till hushållen', 'energi', { ekonomi: -.4, landsbygd: .3 }, 'Kompensation när elpriset passerar 150 öre.', (s) => { s.utg_socialt += 8; s.konsumentfortroende += 2; }, 8),
  B('forsvar_3', 'Försvaret till 3 procent av BNP', 'forsvar', { forsvar: 1 }, 'Upptrappning över fyra år.', (s) => { s.utg_forsvar += 25; }, 25),
  B('varnplikt_alla', 'Allmän värnplikt för alla 18-åringar', 'forsvar', { forsvar: .8, varderingar: .4 }, 'Mönstring och grundutbildning för hela årskullen.', (s) => { s.varnpliktiga += 6000; s.utg_forsvar += 8; }, 8),
  B('bistand_ner', 'Halverat bistånd', 'eu', { eu: -.5, ekonomi: .6, migration: .4 }, 'Biståndet sänks till 0,5 procent av BNI.', (s) => { s.utg_bistand -= 22; }, -22),
  B('eu_forsvar', 'Svenskt stöd för EU-armé', 'eu', { eu: 1, forsvar: .5 }, 'Sverige stödjer en gemensam europeisk försvarsstyrka.', (s) => { s.sakerhetslage -= 1; }, 2),
  B('euro', 'Folkomröstning om euron', 'eu', { eu: 1 }, 'Rådgivande folkomröstning om att införa euron.', () => {}, 0),
  B('vinstforbud', 'Förbud mot vinst i välfärden', 'valfard', { valfard: -1, ekonomi: -.5 }, 'Vinstutdelning förbjuds i skattefinansierade skolor och vårdbolag.', (s) => { s.friskoleandel -= 3; }, 0),
  B('fritt_val', 'Utökat vårdval', 'valfard', { valfard: 1 }, 'Privata vårdgivare får etablera sig fritt inom specialistvården.', (s) => { s.vardkoer -= 5; s.utg_sjukvard += 4; }, 4),
  B('vardplatser', '2 000 nya vårdplatser', 'valfard', { valfard: -.5 }, 'Öronmärkt statsbidrag till regionerna.', (s) => { s.utg_sjukvard += 15; s.vardplatser += .15; }, 15),
  B('skola_statlig', 'Förstatligad skola', 'valfard', { valfard: -.6, landsbygd: -.3 }, 'Staten tar över huvudmannaskapet från kommunerna.', (s) => { s.utg_utbildning += 10; s.skolresultat += 2; }, 10),
  B('larare_lon', 'Lärarlönelyft', 'valfard', { valfard: -.4, ekonomi: -.3 }, '5 000 kr mer i månaden för behöriga lärare.', (s) => { s.utg_utbildning += 12; s.behoriga_larare += 2; }, 12),
  B('aldre_garanti', 'Äldreomsorgsgaranti', 'valfard', { valfard: -.5 }, 'Rätt till plats på äldreboende inom tre månader.', (s) => { s.utg_aldreomsorg += 10; }, 10),
  B('pension_upp', 'Höjd garantipension', 'valfard', { ekonomi: -.6 }, 'Garantipensionen höjs med 1 000 kr i månaden.', (s) => { s.utg_pensioner += 14; s.pensionsniva += 1; }, 14),
  B('barnbidrag_upp', 'Höjt barnbidrag', 'valfard', { ekonomi: -.5, varderingar: .2 }, 'Barnbidraget höjs med 300 kr.', (s) => { s.barnbidrag += 300; s.utg_socialt += 7; }, 7),
  B('hyresreglering_bort', 'Marknadshyror i nyproduktion', 'bostad', { bostad: 1 }, 'Fri hyressättning för nybyggda lägenheter.', (s) => { s.byggstarter += 4; s.hyra += 300; }, 0),
  B('bygg_snabb', 'Snabbare bygglov', 'bostad', { bostad: .6, landsbygd: .2 }, 'Maxtider för bygglov och färre överklaganden.', (s) => { s.byggstarter += 3; }, 0),
  B('bostad_allmannytta', 'Statligt byggprogram för hyresrätter', 'bostad', { bostad: -1, ekonomi: -.5 }, '30 000 hyresrätter med statliga lån.', (s) => { s.byggstarter += 6; s.utg_infrastruktur += 10; }, 10),
  B('ranteavdrag_ner', 'Avtrappat ränteavdrag', 'bostad', { bostad: .3, ekonomi: -.3 }, 'Ränteavdraget trappas ned med fem procentenheter per år.', (s) => { s.bostadspris_tillvaxt -= 1.5; }, 10),
  B('landsbygd_paket', 'Landsbygdspaket', 'landsbygd', { landsbygd: 1 }, 'Lägre skatt i glesbygd, statliga jobb flyttas ut.', (s) => { s.utg_infrastruktur += 6; s.utg_ovrigt += 3; }, 9),
  B('hogfart', 'Höghastighetsjärnväg', 'landsbygd', { landsbygd: -.3, klimat: -.5 }, 'Stockholm–Göteborg–Malmö på under tre timmar.', (s) => { s.utg_infrastruktur += 18; s.tagpunktlighet += 1; }, 18),
  B('aktenskap_trad', 'Stärkt skydd för familjen', 'varderingar', { varderingar: 1 }, 'Vårdnadsbidrag återinförs och sambeskattning utreds.', (s) => { s.utg_socialt += 4; s.jamstalldhet -= 1; }, 4),
  B('hbtq', 'Stärkta rättigheter för hbtq-personer', 'varderingar', { varderingar: -1 }, 'Ny könstillhörighetslag och hatbrottsenhet.', (s) => { s.jamstalldhet += 1; }, 1),
  B('religion_skola', 'Förbud mot religiösa friskolor', 'varderingar', { varderingar: -.3, migration: .4, valfard: -.4 }, 'Inga nya konfessionella skolor, befintliga fasas ut.', (s) => { s.friskoleandel -= 1; s.integration += 1; }, 0),
  B('media_stod', 'Utökat presstöd', 'varderingar', { varderingar: -.3, landsbygd: .4 }, 'Stöd till lokaljournalistik i hela landet.', (s) => { s.pressfrihet += 1; s.utg_kultur += 2; }, 2),
  B('public_service_ner', 'Minskad public service-avgift', 'varderingar', { varderingar: .6, ekonomi: .4 }, 'SVT och SR:s anslag minskas med 20 procent.', (s) => { s.pressfrihet -= 2; s.utg_kultur -= 2; }, -2),
  B('overvakning', 'Utökad kameraövervakning och avlyssning', 'kriminal', { kriminal: .8, varderingar: .3 }, 'Hemlig dataavläsning utan brottsmisstanke mot gängmiljöer.', (s) => { s.uppklarning += 1; s.rattssakerhet -= 2; }, 2),
  B('grundlag_val', 'Fler valdagar och lägre spärr', 'varderingar', { varderingar: -.4 }, 'Riksdagsspärren sänks till 3 procent (grundlagsändring).', (s, st) => { st.flags.threshold3 = true; }, 0),
  B('undantag_tillstand', 'Lag om undantagstillstånd', 'forsvar', { forsvar: .6, varderingar: .6 }, 'Regeringen får utökade befogenheter vid kris utan riksdagsbeslut.', (s, st) => { st.sweden.demokratiMal = (st.sweden.demokratiMal ?? 9.3) - .4; s.rattssakerhet -= 4; }, 0),
  B('demokrati_starkt', 'Stärkt författningsdomstol', 'varderingar', { varderingar: -.3, eu: .3 }, 'En fristående författningsdomstol prövar lagar mot grundlagen.', (s, st) => { st.sweden.demokratiMal = (st.sweden.demokratiMal ?? 9.3) + .2; s.rattssakerhet += 2; }, 1),
];
export const BILL_BY_ID = Object.fromEntries(BILLS.map((b) => [b.id, b]));

// Hur ställer sig ett parti till ett förslag? (-1…1)
export function stance(party, bill) {
  let s = 0, w = 0;
  for (const k in bill.vec) { s += bill.vec[k] * (party.pos[k] || 0) / 100; w += Math.abs(bill.vec[k]); }
  return w ? s / w : 0;
}
export function aiVote(state, party, bill, proposerId) {
  const st = stance(party, bill);
  const gov = state.government;
  const proposerIsGov = gov.parties.includes(proposerId);
  const partyIsGov = gov.parties.includes(party.id);
  const partyIsSupport = gov.support.includes(party.id);
  let score = st;
  if (partyIsGov && proposerIsGov) score += .45; // regeringssammanhållning
  if (partyIsGov && !proposerIsGov && bill.cost > 0) score -= .25; // regeringen vaktar budgeten
  if (partyIsSupport && proposerIsGov) score += .2;
  if (!partyIsGov && proposerIsGov && st < .15) score -= .15; // oppositionsreflex
  if (bill.deals?.[party.id]) score += 1; // förhandlad överenskommelse
  if (party.cordon?.includes(proposerId) && st < .4) score -= .3;
  const rel = party.relations?.[proposerId] || 0; score += rel / 400;
  return score > .12 ? 'ja' : score < -.12 ? 'nej' : 'avstår';
}

export function proposeBill(state, rnd, proposerId, billId, { byPlayer = false } = {}) {
  const bill = BILL_BY_ID[billId];
  const item = { id: 'b' + state.week + '_' + billId + '_' + Math.floor(rnd() * 1e4), billId, proposer: proposerId, week: state.week, date: { ...state.date }, status: 'pending', deals: {}, byPlayer, voteWeek: state.week + 3 };
  state.riksdag.bills.unshift(item);
  return item;
}

export function resolveVote(state, rnd, item, playerVote) {
  const bill = BILL_BY_ID[item.billId];
  const seats = state.riksdag.seats;
  const votes = {}; let ja = 0, nej = 0, avst = 0;
  for (const p of activeParties(state)) {
    const n = seats[p.id] || 0; if (!n) continue;
    const v = p.isPlayer && playerVote ? playerVote : aiVote(state, p, { ...bill, deals: item.deals }, item.proposer);
    votes[p.id] = v;
    if (v === 'ja') ja += n; else if (v === 'nej') nej += n; else avst += n;
    (state.riksdag.record[p.id] ||= []).push({ billId: bill.id, vote: v, week: state.week, title: bill.title });
    if (state.riksdag.record[p.id].length > 40) state.riksdag.record[p.id].shift();
  }
  const passed = ja > nej;
  item.status = passed ? 'passed' : 'failed'; item.votes = votes; item.ja = ja; item.nej = nej; item.avst = avst; item.resolvedWeek = state.week;
  if (passed) {
    bill.eff(state.sweden.stats, state);
    state.sweden.reformBoost = (state.sweden.reformBoost || 0) + (bill.cost < 0 ? .05 : 0);
    (state.sweden.reforms ||= []).push({ billId: bill.id, title: bill.title, date: { ...state.date }, proposer: item.proposer });
    state.riksdag.passedRecently = (state.riksdag.passedRecently || 0) + 1;
    state.opinion.boost[bill.area] = (state.opinion.boost[bill.area] || 0) + .15;
    const prop = state.parties[item.proposer];
    if (prop) { prop.credibility = clamp(prop.credibility + (item.byPlayer ? 3 : 1), 0, 100); prop.attention = clamp(prop.attention + 6, 0, 100); }
    if (state.government.parties.includes(item.proposer)) state.government.performance = clamp((state.government.performance || 0) + 1, -10, 10);
  } else {
    const prop = state.parties[item.proposer];
    if (prop && item.byPlayer) prop.credibility = clamp(prop.credibility - 1, 0, 100);
    if (state.government.parties.includes(item.proposer)) { state.government.performance = clamp((state.government.performance || 0) - 1.5, -10, 10); state.government.crisis = (state.government.crisis || 0) + .5; }
  }
  // infriade/svikna löften: spelarens egna partiprogram
  return { passed, ja, nej, avst, votes, bill };
}

// AI föreslår lagar utifrån sin profil (regeringen oftare).
export function aiProposals(state, rnd) {
  const out = [];
  const parties = activeParties(state).filter((p) => !p.isPlayer && (state.riksdag.seats[p.id] || 0) > 0);
  const gov = state.government;
  const pending = state.riksdag.bills.filter((b) => b.status === 'pending');
  if (pending.length >= 4) return out;
  const n = 1 + (rnd() < .5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const p = weighted(rnd, parties, (q) => (gov.parties.includes(q.id) ? 3 : 1) * Math.sqrt(state.riksdag.seats[q.id] || 1));
    const recent = new Set(state.riksdag.bills.slice(0, 12).map((b) => b.billId));
    const cands = BILLS.filter((b) => !recent.has(b.id) && stance(p, b) > .35);
    if (!cands.length) continue;
    const bill = weighted(rnd, cands, (b) => stance(p, b) * (p.profile?.[b.area] || 1) * (state.opinion.salience[b.area] || 1));
    out.push(proposeBill(state, rnd, p.id, bill.id));
  }
  return out;
}

// Förhandling: vad kräver parti q för att rösta ja på spelarens förslag?
export function negotiationDemand(state, rnd, q, item) {
  const me = state.parties[state.player.partyId];
  const bill = BILL_BY_ID[item.billId];
  const st = stance(q, bill);
  const w = willingness(state, q, me);
  if (st < -.5 || w < -20) return { possible: false, reason: `${q.name} säger blankt nej – förslaget går tvärs emot deras politik.` };
  // kräver en eftergift på sin viktigaste axel där vi står långt ifrån
  const axes = ISSUES.map((is) => ({ is, gap: ((q.pos[is.id] || 0) - (me.pos[is.id] || 0)), w: q.profile?.[is.id] || 1 })).sort((a, b) => Math.abs(b.gap) * b.w - Math.abs(a.gap) * a.w);
  const ax = axes[0];
  const kinds = [];
  if (Math.abs(ax.gap) > 25) kinds.push({ type: 'shift', issue: ax.is.id, amount: Math.sign(ax.gap) * 12, text: `Ni närmar er oss i frågan om ${ax.is.name.toLowerCase()} (flytta er position ${Math.sign(ax.gap) > 0 ? 'åt höger' : 'åt vänster'}).`, cost: 'Trovärdighet −4, egna väljare kan reagera' });
  kinds.push({ type: 'support', text: `Ni lovar att rösta ja på vårt nästa förslag, vad det än blir.`, cost: 'Ett bundet ja i en kommande omröstning' });
  if (state.government.pmParty === me.id) kinds.push({ type: 'ministry', text: `Vi vill ha en ministerpost i er regering.`, cost: 'En ministerpost går till ' + q.abbr });
  if (st > .2 && w > 40) kinds.push({ type: 'free', text: `Vi gillar förslaget – vi röstar ja utan motkrav, men vill synas i presskonferensen.`, cost: 'Uppmärksamheten delas med ' + q.abbr });
  const demand = pick(rnd, kinds);
  return { possible: true, demand, stance: st, willingness: w };
}
export function applyDeal(state, q, item, demand) {
  const me = state.parties[state.player.partyId];
  item.deals[q.id] = demand.type;
  q.relations ||= {}; q.relations[me.id] = clamp((q.relations[me.id] || 0) + 10, -100, 100);
  me.relations ||= {}; me.relations[q.id] = clamp((me.relations[q.id] || 0) + 6, -100, 100);
  if (demand.type === 'shift') { me.pos[demand.issue] = clamp(me.pos[demand.issue] + demand.amount, -100, 100); me.credibility = clamp(me.credibility - 4, 0, 100); }
  if (demand.type === 'support') (state.riksdag.owed ||= []).push({ to: q.id, week: state.week });
  if (demand.type === 'ministry') (state.government.owedMinistry ||= []).push(q.id);
  if (demand.type === 'free') me.attention = clamp(me.attention - 2, 0, 100);
}
