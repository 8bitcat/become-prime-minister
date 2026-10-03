// Händelser med val. Villkor avgör när de kan hända; vikt avgör hur ofta.
// Effekterna skriver direkt i state (statistik, parti, regering, opinion, omvärld).
import { clamp, pick, kr, fmt } from '../core/util.js';
import { addNews } from './news.js';
import { activeParties } from './opinion.js';
import { isPlayerPM, playerInGov, govAction } from './government.js';

const me = (s) => s.parties[s.player.partyId];
const leader = (s) => s.people[me(s).leader];
const boost = (s, issue, v) => { s.opinion.boost[issue] = (s.opinion.boost[issue] || 0) + v; };

export const EVENTS = [
  // --- för alla ---
  { id: 'intervju_forfragan', title: 'Intervjuförfrågan', weight: 2.5, cond: (s) => me(s).attention > 8, kind: 'interview' },
  { id: 'medlemsmote', title: 'Stormigt medlemsmöte', weight: 1.2, cond: (s) => me(s).unity < 60,
    text: (s) => `Partiets medlemmar är splittrade. På ett välbesökt möte kräver en falang att partiet ${pick(G, ['går längre åt kanten', 'blir mer pragmatiskt', 'byter strategi helt'])}. Stämningen är hätsk.`,
    choices: [
      { text: 'Lyssna och lova förändring', eff: (s) => { me(s).unity = clamp(me(s).unity + 10, 0, 100); me(s).credibility = clamp(me(s).credibility - 2, 0, 100); return 'Mötet lugnar ner sig. Vissa väljare undrar dock vad partiet egentligen vill.'; } },
      { text: 'Sätt ner foten: "Det är jag som leder"', eff: (s) => { const ok = leader(s).traits.ledarskap > 50; me(s).unity = clamp(me(s).unity + (ok ? 14 : -10), 0, 100); return ok ? 'Ditt ledarskap imponerar. Falangen tystnar.' : 'Falangen hånar dig öppet. Flera medlemmar lämnar mötet i protest.'; } },
      { text: 'Utlys ett rådslag om partiets framtid', eff: (s) => { me(s).unity = clamp(me(s).unity + 5, 0, 100); s.ap = Math.max(0, s.ap - 1); return 'Rådslaget tar tid men kyler ner konflikten.'; } },
    ] },
  { id: 'donator', title: 'En generös givare', weight: 1.0, cond: (s) => true,
    text: (s) => `En förmögen ${pick(G, ['fastighetsmagnat', 'techentreprenör', 'skogsägare', 'riskkapitalist'])} erbjuder ${me(s).name} en donation på ${kr(me(s).inRiksdag ? 5e6 : 8e5)}. Givaren "förväntar sig inget" – men vill gärna träffa dig regelbundet.`,
    choices: [
      { text: 'Ta emot pengarna', eff: (s) => { me(s).money += me(s).inRiksdag ? 5e6 : 8e5; me(s).risk = (me(s).risk || 0) + 12; return 'Pengarna landar på kontot. Du hoppas att ingen gräver i var de kom ifrån.'; } },
      { text: 'Tacka nej – offentligt', eff: (s) => { me(s).credibility = clamp(me(s).credibility + 4, 0, 100); me(s).attention = clamp(me(s).attention + 3, 0, 100); return '"Vi köps inte", säger du i en intervju. Medierna gillar det.'; } },
      { text: 'Ta emot men redovisa öppet', eff: (s) => { me(s).money += (me(s).inRiksdag ? 5e6 : 8e5) * .8; me(s).risk = (me(s).risk || 0) + 3; return 'Donationen redovisas. Vissa väljare rynkar på näsan, men inget bränner.'; } },
    ] },
  { id: 'debattinbjudan', title: 'Inbjudan till TV-debatt', weight: 1.2, cond: (s) => me(s).attention > 20 && !s.election.campaign, kind: 'debate', debate: 'tv' },
  { id: 'partiledardebatt', title: 'Partiledardebatt i riksdagen', weight: 1.0, cond: (s) => me(s).inRiksdag && !s.election.campaign, kind: 'debate', debate: 'riksdag' },
  { id: 'fackligt_stod', title: 'Facket vill träffa dig', weight: .8, cond: (s) => me(s).pos.arbete < 0,
    text: () => 'LO:s ledning erbjuder stöd i valrörelsen – i utbyte mot att partiet lovar att inte röra anställningsskyddet.',
    choices: [
      { text: 'Acceptera', eff: (s) => { me(s).pos.arbete = clamp(me(s).pos.arbete - 10, -100, 100); me(s).money += 2e6; me(s).org = clamp(me(s).org + 5, 0, 100); return 'Facket ställer upp med resurser och folk. Företagarna muttrar.'; } },
      { text: 'Avböj – partiet bestämmer sin egen politik', eff: (s) => { me(s).credibility = clamp(me(s).credibility + 2, 0, 100); return 'Du håller på ditt oberoende.'; } },
    ] },
  { id: 'naringsliv', title: 'Näringslivet bjuder in', weight: .8, cond: (s) => me(s).pos.ekonomi > 0,
    text: () => 'Svenskt Näringsliv erbjuder en gemensam kampanj om sänkta skatter – och ett ordentligt kampanjbidrag.',
    choices: [
      { text: 'Tacka ja', eff: (s) => { me(s).pos.ekonomi = clamp(me(s).pos.ekonomi + 8, -100, 100); me(s).money += 3e6; return 'Kampanjen rullar. Vänstern kallar er "näringslivets knähund".'; } },
      { text: 'Tacka nej', eff: (s) => { me(s).credibility = clamp(me(s).credibility + 1, 0, 100); return 'Du håller distans.'; } },
    ] },
  { id: 'lokal_skandal_kommun', title: 'Lokal kris i en kommun', weight: 1.0, cond: (s) => me(s).inRiksdag,
    text: (s) => `I ${pick(G, ['Sundsvall', 'Borås', 'Kristianstad', 'Luleå', 'Växjö'])} har ert lokala parti hamnat i konflikt med kommunledningen om ${pick(G, ['en nedlagd skola', 'ett vindkraftsbygge', 'ett asylboende', 'ett nytt badhus'])}. Lokalpressen vill ha din linje.`,
    choices: [
      { text: 'Stöd lokalavdelningen', eff: (s) => { me(s).unity = clamp(me(s).unity + 4, 0, 100); boost(s, 'landsbygd', .1); return 'Lokalavdelningen jublar. Rikspolitiskt märks det knappt.'; } },
      { text: 'Håll dig utanför', eff: () => 'Du överlåter frågan till kommunen. Vissa lokalpolitiker känner sig svikna.' },
    ] },
  { id: 'hot', title: 'Hot mot partiledaren', weight: .6, cond: (s) => me(s).attention > 30,
    text: (s) => `Säkerhetspolisen informerar om att hoten mot ${leader(s).name} ökat markant. De rekommenderar personskydd.`,
    choices: [
      { text: 'Acceptera personskydd', eff: (s) => { s.sweden.stats.oro += 1; return 'Du får livvakter. Vardagen förändras.'; } },
      { text: 'Avböj: "Jag låter mig inte skrämmas"', eff: (s) => { me(s).attention = clamp(me(s).attention + 4, 0, 100); leader(s).approval = clamp(leader(s).approval + 3, 0, 100); me(s).risk = (me(s).risk || 0) + 4; return 'Modigt, säger många. Dumdristigt, säger Säpo.'; } },
    ] },
  // --- nya partier ---
  { id: 'kandisstod', title: 'Kändis vill engagera sig', weight: 1.0, cond: (s) => !me(s).inRiksdag,
    text: (s) => `En känd ${pick(G, ['artist', 'fotbollsspelare', 'youtuber', 'skådespelare', 'författare'])} med miljontals följare säger att hen "gillar det ni gör" och vill ställa upp i en kampanjfilm.`,
    choices: [
      { text: 'Gör filmen', eff: (s) => { s.opinion.awareness[me(s).id] = clamp((s.opinion.awareness[me(s).id] ?? 1) + .08, 0, 1); me(s).attention = clamp(me(s).attention + 10, 0, 100); me(s).risk = (me(s).risk || 0) + 5; return 'Filmen får miljontals visningar. Kändisens gamla uttalanden granskas nu också.'; } },
      { text: 'Tacka nej – politik ska handla om politik', eff: (s) => { me(s).credibility = clamp(me(s).credibility + 2, 0, 100); return 'Principfast, men få märker att ni finns.'; } },
    ] },
  { id: 'avhoppare', title: 'Riksdagsledamot vill hoppa av till er', weight: .8, cond: (s) => !me(s).inRiksdag && (s.opinion.support[me(s).id] || 0) > 2.5,
    text: (s) => { const p = pick(G, activeParties(s).filter((q) => !q.isPlayer && q.seats > 0)); s._tmp = p.id; return `En riksdagsledamot från ${p.name} är missnöjd och erbjuder sig att gå över till ${me(s).abbr}. Ni skulle få ert första mandat i riksdagen – som "politisk vilde".`; },
    choices: [
      { text: 'Välkomna avhopparen', eff: (s) => { const from = s.parties[s._tmp]; if (from && s.riksdag.seats[from.id] > 0) { s.riksdag.seats[from.id]--; from.seats--; s.riksdag.seats[me(s).id] = (s.riksdag.seats[me(s).id] || 0) + 1; me(s).seats = 1; me(s).inRiksdag = true; from.relations ||= {}; from.relations[me(s).id] = -30; } me(s).attention = clamp(me(s).attention + 15, 0, 100); s.opinion.awareness[me(s).id] = clamp((s.opinion.awareness[me(s).id] ?? 1) + .1, 0, 1); return 'Ni har nu en röst i riksdagen! Men ett avhopp ses av många som ett svek mot väljarna.'; } },
      { text: 'Tacka nej – vi vill vinna våra mandat', eff: (s) => { me(s).credibility = clamp(me(s).credibility + 3, 0, 100); return 'Beslutet imponerar på kommentatorerna.'; } },
    ] },
  // --- regeringen ---
  { id: 'kris_bank', title: 'Bankkris', weight: .25, cond: (s) => s.sweden.stats.bostadspris_tillvaxt < -3 || s.world.shock < -1.5, once: true,
    text: () => 'En av storbankerna har akuta problem efter kraftiga kreditförluster. Finansinspektionen varnar för spridning till hela systemet.',
    choices: [
      { text: 'Rädda banken med statliga garantier', only: 'pm', eff: (s) => { s.sweden.stats.statsskuld += 150; s.world.shock = (s.world.shock || 0) + 1; govAction(s, 2); return 'Krisen stoppas – till ett pris av 150 miljarder i garantier.'; } },
      { text: 'Låt banken falla, skydda insättarna', only: 'pm', eff: (s) => { s.world.shock = (s.world.shock || 0) - 2.5; s.sweden.stats.konsumentfortroende -= 10; govAction(s, -3); return 'Banken går omkull. Marknaden skakar i månader.'; } },
      { text: 'Kräv att regeringen agerar', eff: (s) => { me(s).attention = clamp(me(s).attention + 5, 0, 100); boost(s, 'ekonomi', .4); return 'Du sätter dagordningen i oppositionen.'; } },
    ] },
  { id: 'kris_pandemi', title: 'Nytt virus sprids', weight: .15, cond: (s) => true, once: true,
    text: () => 'WHO klassar ett nytt luftvägsvirus som internationellt hot. De första fallen har nått Sverige.',
    choices: [
      { text: 'Hårda restriktioner tidigt', only: 'pm', eff: (s) => { s.world.shock = (s.world.shock || 0) - 2; s.sweden.stats.dodstal -= .2; s.sweden.stats.konsumentfortroende -= 8; govAction(s, 1); boost(s, 'valfard', .5); return 'Smittan hålls nere, ekonomin tar stryk.'; } },
      { text: 'Rekommendationer och eget ansvar', only: 'pm', eff: (s) => { s.world.shock = (s.world.shock || 0) - .8; s.sweden.stats.dodstal += .5; s.sweden.stats.vardkoer += 20; govAction(s, -1); boost(s, 'valfard', .6); return 'Ekonomin klarar sig bättre än grannländernas, men dödstalen stiger.'; } },
      { text: 'Kräv tydliga besked', eff: (s) => { boost(s, 'valfard', .5); me(s).attention = clamp(me(s).attention + 4, 0, 100); return 'Oppositionen pressar regeringen.'; } },
    ] },
  { id: 'kris_energi', title: 'Energikris', weight: .3, cond: (s) => s.world.energy < 1.4 && s.sweden.stats.sakerhetslage > 60, once: false,
    text: () => 'Gasleveranserna till Europa stryps efter en internationell kris. Elpriserna rusar över hela kontinenten.',
    choices: [
      { text: 'Elprisstöd till hushållen', only: 'pm', eff: (s) => { s.world.energy = Math.max(s.world.energy, 1.8); s.sweden.stats.utg_socialt += 15; govAction(s, 1); boost(s, 'energi', .8); return 'Hushållen får stöd. Statskassan blöder.'; } },
      { text: 'Låt marknaden verka', only: 'pm', eff: (s) => { s.world.energy = Math.max(s.world.energy, 1.8); s.sweden.stats.konsumentfortroende -= 8; govAction(s, -2); boost(s, 'energi', 1); return 'Räkningarna chockar. Protesterna växer.'; } },
      { text: 'Kräv kärnkraft/förnybart – sätt agendan', eff: (s) => { s.world.energy = Math.max(s.world.energy, 1.8); boost(s, 'energi', 1); me(s).attention = clamp(me(s).attention + 6, 0, 100); return 'Energifrågan dominerar debatten.'; } },
    ] },
  { id: 'kris_balt', title: 'Kris i Östersjön', weight: .3, cond: (s) => s.sweden.stats.sakerhetslage > 55,
    text: () => 'Ryska styrkor genomför en storövning nära Gotland. Ett svenskt handelsfartyg har bordats. NATO höjer beredskapen.',
    choices: [
      { text: 'Höj beredskapen och sänd förstärkningar till Gotland', only: 'pm', eff: (s) => { s.world.tension = (s.world.tension || 0) + 8; s.sweden.stats.utg_forsvar += 5; govAction(s, 2); boost(s, 'forsvar', 1); return 'Beslutsamt. Spänningen stiger, men väljarna ser handlingskraft.'; } },
      { text: 'Diplomati och lugn', only: 'pm', eff: (s) => { s.world.tension = (s.world.tension || 0) + 3; govAction(s, -1); boost(s, 'forsvar', .8); return 'Läget lugnar sig långsamt. Oppositionen kallar dig naiv.'; } },
      { text: 'Kräv kraftfulla åtgärder', eff: (s) => { s.world.tension = (s.world.tension || 0) + 5; boost(s, 'forsvar', 1); me(s).attention = clamp(me(s).attention + 5, 0, 100); return 'Försvaret hamnar överst på dagordningen.'; } },
    ] },
  { id: 'oversvamning', title: 'Översvämningar', weight: .5, cond: (s) => true,
    text: () => `Skyfall har slagit ut vägar och översvämmat tusentals hem i ${pick(G, ['Gävleborg', 'Västra Götaland', 'Värmland', 'Skåne'])}. Kommunerna ber om statlig hjälp.`,
    choices: [
      { text: 'Krispaket till drabbade kommuner', only: 'gov', eff: (s) => { s.sweden.stats.utg_ovrigt += 6; govAction(s, 2); boost(s, 'klimat', .5); return 'Hjälpen uppskattas.'; } },
      { text: 'Besök området och lova klimatanpassning', eff: (s) => { boost(s, 'klimat', .5); me(s).attention = clamp(me(s).attention + 4, 0, 100); s.ap = Math.max(0, s.ap - 1); return 'Bilderna från besöket sprids.'; } },
      { text: 'Ingen särskild åtgärd', eff: (s) => { if (playerInGov(s)) govAction(s, -2); return 'Drabbade känner sig övergivna.'; } },
    ] },
  { id: 'terror', title: 'Terrordåd', weight: .12, cond: (s) => s.sweden.stats.terrorhot >= 4, once: false,
    text: () => `En attack i centrala ${pick(G, ['Stockholm', 'Göteborg', 'Malmö'])} har krävt flera liv. Gärningsmannen greps på plats. Landet är i chock.`,
    choices: [
      { text: 'Nationell samling – tal till nationen', eff: (s) => { s.sweden.stats.oro += 6; s.sweden.stats.sammanhallning += 3; boost(s, 'kriminal', .6); boost(s, 'forsvar', .4); if (isPlayerPM(s)) govAction(s, 3); leader(s).approval = clamp(leader(s).approval + 4, 0, 100); return 'Talet berör. Hela landet samlas.'; } },
      { text: 'Kräv hårdare tag omedelbart', eff: (s) => { s.sweden.stats.oro += 8; s.sweden.stats.polarisering += 3; boost(s, 'kriminal', 1); boost(s, 'migration', .6); me(s).attention = clamp(me(s).attention + 6, 0, 100); return 'Debatten blir hätsk. Dina väljare håller med.'; } },
    ] },
  { id: 'strejk', title: 'Storstrejk', weight: .4, cond: (s) => s.sweden.stats.strejkdagar > 12 || s.sweden.stats.inflation > 4.5,
    text: () => 'Avtalsrörelsen har havererat. Transport, vård och skola står inför omfattande strejker nästa vecka.',
    choices: [
      { text: 'Medla – kalla parterna till regeringen', only: 'pm', eff: (s) => { s.sweden.stats.strejkdagar = 5; s.sweden.stats.medianlon *= 1.01; govAction(s, 2); return 'En uppgörelse nås. Lönerna höjs något.'; } },
      { text: 'Ställ dig på fackets sida', eff: (s) => { me(s).pos.arbete = clamp(me(s).pos.arbete - 8, -100, 100); boost(s, 'arbete', .8); return 'Facket tackar. Företagarna rasar.'; } },
      { text: 'Ställ dig på arbetsgivarnas sida', eff: (s) => { me(s).pos.arbete = clamp(me(s).pos.arbete + 8, -100, 100); boost(s, 'arbete', .8); return 'Näringslivet tackar. LO rasar.'; } },
    ] },
  { id: 'eu_toppmote', title: 'EU-toppmöte', weight: .6, cond: (s) => isPlayerPM(s),
    text: () => 'På toppmötet i Bryssel krävs Sveriges ställningstagande om ett nytt gemensamt EU-lån för försvar och klimat.',
    choices: [
      { text: 'Rösta ja', eff: (s) => { s.world.countries.eu.rel += 10; s.sweden.stats.utg_ovrigt += 4; me(s).pos.eu = clamp(me(s).pos.eu + 5, -100, 100); return 'Sverige framstår som en konstruktiv partner.'; } },
      { text: 'Rösta nej', eff: (s) => { s.world.countries.eu.rel -= 10; me(s).pos.eu = clamp(me(s).pos.eu - 5, -100, 100); return 'Sverige isolerat i Bryssel – men hemma gillar EU-skeptikerna det.'; } },
    ] },
  { id: 'nato_krav', title: 'NATO kräver mer', weight: .5, cond: (s) => isPlayerPM(s) && s.sweden.stats.forsvar_bnp < 2.5,
    text: () => 'NATO:s generalsekreterare pekar ut Sverige: försvarsutgifterna måste upp till 2,5 procent av BNP.',
    choices: [
      { text: 'Lova upptrappning', eff: (s) => { s.sweden.stats.utg_forsvar += 20; s.world.countries.nato.rel += 10; s.world.countries.usa.rel += 5; return 'Alliansen nöjd. Finansministern svettas.'; } },
      { text: 'Avvakta', eff: (s) => { s.world.countries.nato.rel -= 8; s.world.countries.usa.rel -= 6; return 'Kritiken från Washington är skarp.'; } },
    ] },
  { id: 'budget_hal', title: 'Hål i budgeten', weight: .7, cond: (s) => isPlayerPM(s) && s.sweden.stats.budgetsaldo < -120,
    text: (s) => `Finansdepartementet varnar: underskottet är ${fmt(-s.sweden.stats.budgetsaldo)} miljarder. Utan åtgärder sänks kreditbetyget.`,
    choices: [
      { text: 'Spara: dra ner på bidrag och förvaltning', eff: (s) => { s.sweden.stats.utg_socialt -= 30; s.sweden.stats.utg_ovrigt -= 20; govAction(s, -2); boost(s, 'ekonomi', .5); return 'Nedskärningarna svider.'; } },
      { text: 'Höj skatterna', eff: (s) => { s.sweden.stats.skatt_kommunal += .8; s.sweden.stats.moms += .5; govAction(s, -2); boost(s, 'ekonomi', .5); return 'Skattehöjningen är impopulär men stoppar underskottet.'; } },
      { text: 'Låna – tillväxten löser det', eff: (s) => { s.sweden.stats.statsskuld += 50; s.sweden.stats.styrranta += .25; govAction(s, 0); return 'Räntorna stiger något. Kritiken växer.'; } },
    ] },
  { id: 'ledarutmaning', title: 'Utmanare om partiledarposten', weight: .5, cond: (s) => me(s).unity < 45 || ((me(s).momentum || 0) < -.6 && me(s).inRiksdag),
    text: (s) => { const c = pick(G, (me(s).people || []).map((id) => s.people[id]).filter((x) => x && x.alive)); s._tmp = c?.id; return `${c ? c.name : 'En partikollega'} meddelar att hen ställer upp mot dig som partiledare på nästa kongress. Riksdagsgruppen är splittrad.`; },
    choices: [
      { text: 'Ta striden på kongressen', eff: (s) => { const c = s.people[s._tmp]; const ok = G() < .45 + (leader(s).traits.ledarskap - 45) / 100 + (me(s).unity - 50) / 200; if (ok) { me(s).unity = clamp(me(s).unity + 12, 0, 100); return 'Du vinner omröstningen klart. Partiet sluter upp.'; } me(s).unity = clamp(me(s).unity - 10, 0, 100); me(s).credibility = clamp(me(s).credibility - 5, 0, 100); return `Du vinner knappt. ${c ? c.name : 'Utmanaren'} stannar kvar som en nagel i ögat.`; } },
      { text: 'Erbjud utmanaren posten som vice partiledare', eff: (s) => { me(s).unity = clamp(me(s).unity + 6, 0, 100); return 'Kompromissen håller ihop partiet – för nu.'; } },
    ] },
  { id: 'intern_lacka', title: 'Partiets strategidokument läcker', weight: .5, cond: (s) => me(s).attention > 25,
    text: () => 'Ett internt dokument om partiets valstrategi har hamnat hos Expressen. I det beskrivs väljargrupper i krassa ordalag.',
    choices: [
      { text: 'Avfärda som "ett arbetsmaterial"', eff: (s) => { me(s).credibility = clamp(me(s).credibility - 3, 0, 100); me(s).risk = (me(s).risk || 0) + 8; return 'Storyn lever några dagar.'; } },
      { text: 'Starta läckjakt internt', eff: (s) => { me(s).unity = clamp(me(s).unity - 6, 0, 100); return 'Misstron i partiet växer.'; } },
    ] },
  { id: 'vald_stad', title: 'Upplopp efter skjutning', weight: .35, cond: (s) => s.sweden.stats.gang_index > 75,
    text: () => `Efter en dödsskjutning i ${pick(G, ['Rinkeby', 'Rosengård', 'Biskopsgården', 'Vivalla'])} har upplopp brutit ut. Bilar brinner och polisen attackeras.`,
    choices: [
      { text: 'Besök området och tala med boende', eff: (s) => { boost(s, 'kriminal', .8); leader(s).approval = clamp(leader(s).approval + 2, 0, 100); s.ap = Math.max(0, s.ap - 1); return 'Besöket ger bilder och respekt – men kritiker kallar det en fototillfälle.'; } },
      { text: 'Kräv militär hjälp till polisen', eff: (s) => { boost(s, 'kriminal', 1.2); s.sweden.stats.polarisering += 3; me(s).pos.kriminal = clamp(me(s).pos.kriminal + 6, -100, 100); return 'Utspelet delar landet.'; } },
      { text: 'Peka på de sociala orsakerna', eff: (s) => { boost(s, 'kriminal', .8); me(s).pos.kriminal = clamp(me(s).pos.kriminal - 6, -100, 100); return 'Vänsterväljare nickar. Andra tycker du bagatelliserar.'; } },
    ] },
  { id: 'grundlag', title: 'Förslag att ändra grundlagen', weight: .3, cond: (s) => isPlayerPM(s) && s.government.type === 'majority',
    text: () => 'Dina strateger föreslår att regeringen ska kunna utse domare och chefer för public service utan riksdagens inblandning. "Effektivare styre", heter det.',
    choices: [
      { text: 'Driv igenom förslaget', eff: (s) => { s.sweden.demokratiMal = (s.sweden.demokratiMal ?? 9.3) - .8; s.sweden.pressfrihetMal = (s.sweden.pressfrihetMal ?? 90) - 10; s.sweden.rattssakerhetMal = (s.sweden.rattssakerhetMal ?? 88) - 10; s.sweden.stats.protester += 20; s.sweden.stats.polarisering += 8; s.world.countries.eu.rel -= 25; s.world.countries.usa.rel -= 10; govAction(s, -2); s.flags.authoritarian = (s.flags.authoritarian || 0) + 1; return 'Protester på gatorna, varningar från EU – men makten koncentreras.'; } },
      { text: 'Avvisa förslaget', eff: (s) => { s.sweden.demokratiMal = (s.sweden.demokratiMal ?? 9.3) + .1; me(s).credibility = clamp(me(s).credibility + 2, 0, 100); return 'Institutionerna lämnas ifred.'; } },
    ] },
];
let G = Math.random; // sätts till spelets rng i rollEvents

export function rollEvents(state, rnd) {
  G = rnd;
  const out = [];
  const pm = isPlayerPM(state), inGov = playerInGov(state);
  const recent = new Set(state.events.log.slice(0, 10).map((e) => e.id));
  const cands = EVENTS.filter((e) => !recent.has(e.id) && (!e.once || !state.events.done?.includes(e.id)) && e.cond(state));
  if (!cands.length) return out;
  const base = .32 + (state.election.campaign ? .15 : 0);
  if (rnd() < base) {
    const tot = cands.reduce((a, e) => a + e.weight, 0);
    let r = rnd() * tot; let ev = cands[cands.length - 1];
    for (const e of cands) { r -= e.weight; if (r <= 0) { ev = e; break; } }
    const choices = (ev.choices || []).filter((c) => !c.only || (c.only === 'pm' && pm) || (c.only === 'gov' && inGov));
    const item = { id: ev.id, title: ev.title, kind: ev.kind || 'event', text: ev.text ? ev.text(state) : '', choices: choices.map((c, i) => ({ i: (ev.choices || []).indexOf(c), text: c.text })), debate: ev.debate, week: state.week };
    state.events.log.unshift({ id: ev.id, week: state.week, date: { ...state.date }, title: ev.title });
    if (state.events.log.length > 100) state.events.log.pop();
    if (ev.once) (state.events.done ||= []).push(ev.id);
    out.push(item);
  }
  return out;
}
export function applyEventChoice(state, rnd, item, choiceIndex) {
  G = rnd;
  const ev = EVENTS.find((e) => e.id === item.id);
  const c = ev?.choices?.[choiceIndex];
  if (!c) return '';
  const text = c.eff(state, rnd) || '';
  return text;
}
