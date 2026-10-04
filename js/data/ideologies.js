// Ideologier. Varje ideologi har ett läge på de tolv axlarna, en familj, en extremism-grad
// (0 = etablerad, 3 = systemfientlig) och en demokratisyn (demo: -2 … +2). Extremism och
// demokratisyn påverkar hur andra partier, medierna och väljargrupperna reagerar – ideologierna
// behandlas som politiska system med konsekvenser, inte som rätt eller fel.
// Axlar: ekonomi migration kriminal klimat forsvar eu valfard landsbygd varderingar arbete bostad energi
const I = (id, name, family, desc, pos, { ext = 0, demo = 0, tags = [] } = {}) => ({
  id, name, family, desc, ext, demo, tags,
  pos: { ekonomi: pos[0], migration: pos[1], kriminal: pos[2], klimat: pos[3], forsvar: pos[4], eu: pos[5], valfard: pos[6], landsbygd: pos[7], varderingar: pos[8], arbete: pos[9], bostad: pos[10], energi: pos[11] },
});
export const FAMILIES = { vanster: 'Vänster', liberal: 'Liberal', konservativ: 'Konservativ', gron: 'Grön', mitten: 'Mitten', populist: 'Populism', nationell: 'Nationell', ovrig: 'Övrigt', auktoritar: 'Auktoritär' };
export const IDEOLOGIES = [
  // --- vänster ---
  I('socialdemokrati', 'Socialdemokrati', 'vanster', 'Stark välfärd, fackligt samarbete, pragmatisk reformism.', [-45, 15, 20, -30, 50, 30, -50, 0, -20, -70, -40, 10], { tags: ['offentlig', 'industri', 'pensionarer'] }),
  I('dem_socialism', 'Demokratisk socialism', 'vanster', 'Omfördelning, offentligt ägande, antimilitarism inom demokratins ramar.', [-85, -40, -55, -70, -40, -40, -85, 10, -70, -90, -85, -60], { tags: ['offentlig', 'laginkomst', 'studenter'] }),
  I('socialism', 'Socialism', 'vanster', 'Produktionsmedlen i gemensam ägo, planering före marknad.', [-95, -30, -50, -60, -50, -60, -95, 10, -60, -95, -95, -40], { ext: 1, tags: ['laginkomst', 'industri'] }),
  I('marknadssocialism', 'Marknadssocialism', 'vanster', 'Löntagarägda företag på en marknad, stark välfärd.', [-70, -20, -30, -50, -20, 0, -70, 10, -50, -80, -70, -20], { tags: ['offentlig', 'industri'] }),
  I('kommunism', 'Kommunism', 'vanster', 'Klasslöst samhälle, avskaffad privat äganderätt till produktionsmedlen.', [-100, -50, -40, -50, -60, -80, -100, 0, -60, -100, -100, -30], { ext: 2, demo: -1, tags: ['laginkomst'] }),
  I('marxism', 'Marxism', 'vanster', 'Klassanalys och historiematerialism som politisk grund.', [-100, -40, -40, -50, -50, -70, -100, 0, -60, -100, -100, -30], { ext: 2, tags: ['studenter', 'laginkomst'] }),
  I('marxism_leninism', 'Marxism-leninism', 'vanster', 'Avantgardeparti, demokratisk centralism, planekonomi.', [-100, -30, 20, -30, 20, -90, -100, 0, -20, -100, -100, 0], { ext: 3, demo: -2 }),
  I('trotskism', 'Trotskism', 'vanster', 'Permanent revolution, internationalism, arbetarråd.', [-100, -70, -60, -60, -70, -60, -100, 0, -80, -100, -100, -40], { ext: 3, demo: -1, tags: ['studenter'] }),
  I('radskommunism', 'Rådskommunism', 'vanster', 'Arbetarråd i stället för parti och stat.', [-100, -60, -80, -60, -80, -70, -100, 10, -80, -100, -100, -50], { ext: 3, demo: -1 }),
  I('syndikalism', 'Syndikalism', 'vanster', 'Fackföreningarna som samhällets bas, direkt aktion.', [-90, -50, -70, -60, -70, -60, -90, 10, -70, -100, -90, -50], { ext: 2, tags: ['industri', 'laginkomst'] }),
  I('anarkosyndikalism', 'Anarko-syndikalism', 'vanster', 'Statslöst samhälle organiserat genom fackliga federationer.', [-95, -80, -90, -70, -90, -80, -90, 20, -90, -100, -95, -60], { ext: 3, demo: -1, tags: ['studenter'] }),
  I('anarkokommunism', 'Anarko-kommunism', 'vanster', 'Frivilliga kommuner utan stat, pengar eller hierarki.', [-100, -90, -95, -80, -95, -90, -100, 30, -95, -100, -100, -70], { ext: 3, demo: -1 }),
  I('anarkism', 'Anarkism', 'vanster', 'Mot all tvångsmakt – stat, kapital och hierarkier.', [-80, -90, -95, -70, -95, -90, -70, 30, -95, -80, -90, -60], { ext: 3, demo: -1, tags: ['studenter', 'storstad_unga'] }),
  I('ekosocialism', 'Ekosocialism', 'gron', 'Klimatomställning kräver brott med kapitalismen.', [-85, -60, -60, -100, -50, -20, -80, 20, -80, -80, -80, -95], { ext: 1, tags: ['miljo', 'studenter'] }),
  // --- liberal ---
  I('socialliberalism', 'Socialliberalism', 'liberal', 'Individens frihet med socialt ansvar och ett skyddsnät.', [25, -20, 10, -40, 50, 75, 35, -10, -55, 20, 30, 30], { tags: ['storstad_akademiker', 'studenter'] }),
  I('klassisk_liberalism', 'Klassisk liberalism', 'liberal', 'Nattväktarstat, frihandel, rättsstat, låga skatter.', [80, -10, 30, 0, 50, 60, 80, -10, -40, 80, 85, 60], { tags: ['foretagare', 'hoginkomst'] }),
  I('liberalism', 'Liberalism', 'liberal', 'Individens frihet, marknad, öppenhet mot omvärlden.', [55, 10, 30, -15, 70, 85, 55, -20, -45, 50, 55, 60], { tags: ['storstad_akademiker', 'hoginkomst'] }),
  I('neoliberalism', 'Neoliberalism', 'liberal', 'Avreglering, privatisering, globala marknader.', [90, 10, 40, 20, 50, 70, 95, -30, -20, 90, 95, 70], { tags: ['hoginkomst', 'foretagare'] }),
  I('libertarianism', 'Libertarianism', 'liberal', 'Minimal stat, maximal frihet, platt skatt.', [100, -20, 10, 50, 20, -30, 95, 0, -40, 95, 100, 70], { ext: 1, tags: ['foretagare', 'storstad_unga'] }),
  I('minarkism', 'Minarkism', 'liberal', 'Staten begränsad till polis, domstol och försvar.', [100, -30, 20, 60, 40, -40, 100, 0, -30, 100, 100, 70], { ext: 2, tags: ['foretagare'] }),
  I('progressivism', 'Progressivism', 'liberal', 'Reformer för jämlikhet, rättigheter och modernisering.', [-20, -50, -30, -60, 20, 60, -10, -20, -90, -20, -30, -30], { tags: ['storstad_unga', 'studenter', 'storstad_akademiker'] }),
  // --- konservativ ---
  I('konservatism', 'Konservatism', 'konservativ', 'Tradition, ordning, försiktiga förändringar, starkt försvar.', [50, 55, 70, 30, 80, 20, 50, 20, 60, 50, 50, 85], { tags: ['pensionarer', 'kristna', 'forort_familjer'] }),
  I('socialkonservatism', 'Socialkonservatism', 'konservativ', 'Konservativa värden med social välfärd och sammanhållning.', [10, 60, 70, 30, 70, 0, 0, 40, 70, 0, 0, 80], { tags: ['pensionarer', 'landsbygd', 'industri'] }),
  I('nationalkonservatism', 'Nationalkonservatism', 'nationell', 'Nationen först, restriktiv migration, kulturell sammanhållning.', [0, 95, 90, 60, 55, -70, -10, 50, 80, 0, 10, 80], { ext: 1, tags: ['landsbygd', 'industri', 'laginkomst'] }),
  I('liberalkonservatism', 'Liberalkonservatism', 'konservativ', 'Marknadsekonomi, lag och ordning, måttfull värdekonservatism.', [65, 60, 70, 30, 80, 50, 60, -10, 30, 60, 60, 85], { tags: ['hoginkomst', 'foretagare', 'forort_familjer'] }),
  I('kristdemokrati', 'Kristdemokrati', 'konservativ', 'Familjen, civilsamhället, vård och omsorg, kristen etik.', [45, 55, 65, 20, 70, 20, 40, 20, 70, 40, 40, 85], { tags: ['kristna', 'pensionarer'] }),
  I('traditionalism', 'Traditionalism', 'konservativ', 'Hävdvunna institutioner, religion och familj framför modernitet.', [30, 80, 80, 50, 70, -40, 20, 60, 100, 30, 30, 80], { ext: 1, tags: ['kristna', 'landsbygd'] }),
  I('agrarianism', 'Agrarianism', 'mitten', 'Landsbygden, jordbruket och de små gemenskaperna i centrum.', [20, 30, 30, -20, 40, -20, 10, 100, 30, 20, 20, -10], { tags: ['landsbygd'] }),
  I('religios_konservatism', 'Religiös konservatism', 'konservativ', 'Trons värderingar som grund för lagstiftning och samhällsliv.', [20, 60, 70, 20, 60, -10, 20, 40, 100, 20, 20, 70], { ext: 1, tags: ['kristna'] }),
  I('kristen_nationalism', 'Kristen nationalism', 'nationell', 'Nationen som kristen gemenskap, restriktiv migration.', [10, 95, 85, 50, 70, -70, 0, 50, 100, 10, 10, 80], { ext: 2, demo: -1, tags: ['kristna'] }),
  // --- grön ---
  I('gron', 'Grön ideologi', 'gron', 'Klimatet och ekosystemen först, solidaritet, decentralisering.', [-40, -70, -50, -100, 0, 20, -30, 20, -80, -30, -40, -95], { tags: ['miljo', 'storstad_unga', 'studenter'] }),
  I('gron_liberalism', 'Grön liberalism', 'gron', 'Marknadslösningar för klimatet, småföretag, landsbygd.', [40, -30, 10, -55, 50, 50, 40, 85, -35, 55, 45, -40], { tags: ['landsbygd', 'miljo', 'foretagare'] }),
  // --- mitten & populism ---
  I('centrism', 'Centrism', 'mitten', 'Pragmatisk mitten – lite av allt, kompromissen som ideal.', [0, 0, 10, -10, 40, 30, 0, 0, -10, 0, 0, 20], { tags: ['forort_familjer', 'storstad_akademiker'] }),
  I('radikal_centrism', 'Radikal centrism', 'mitten', 'Evidensbaserade reformer, mot både vänsterns och högerns dogmer.', [20, -10, 20, -40, 50, 60, 20, -20, -40, 20, 30, 60], { tags: ['storstad_akademiker', 'studenter'] }),
  I('populism', 'Populism', 'populist', 'Folket mot eliten – pragmatisk blandning av vänster och höger.', [-20, 50, 60, 30, 30, -50, -20, 60, 30, -30, -20, 40], { ext: 1, tags: ['laginkomst', 'landsbygd', 'industri'] }),
  I('vansterpopulism', 'Vänsterpopulism', 'populist', 'Folket mot de rika och bankerna, nationell suveränitet.', [-80, 10, 20, -30, -20, -70, -80, 40, -30, -80, -80, -20], { ext: 1, tags: ['laginkomst', 'industri'] }),
  I('hogerpopulism', 'Högerpopulism', 'populist', 'Folket mot etablissemanget, restriktiv migration, låga skatter.', [30, 95, 90, 60, 40, -80, 10, 60, 60, 20, 20, 80], { ext: 1, tags: ['laginkomst', 'landsbygd', 'industri'] }),
  // --- stat & styrelseskick ---
  I('republikanism', 'Republikanism', 'ovrig', 'Avskaffad monarki, medborgarskap och dygd i centrum.', [-10, 0, 10, -20, 30, 40, 0, 0, -40, -10, 0, 20], { tags: ['storstad_akademiker'] }),
  I('konst_monarkism', 'Konstitutionell monarkism', 'konservativ', 'Monarkin som samlande symbol i en parlamentarisk demokrati.', [40, 40, 50, 20, 70, 20, 40, 20, 60, 40, 40, 70], { tags: ['pensionarer', 'kristna'] }),
  I('monarkism', 'Monarkism', 'auktoritar', 'Kungen som verklig politisk makt.', [30, 60, 70, 30, 80, -30, 30, 40, 90, 30, 30, 70], { ext: 2, demo: -2 }),
  I('teknokrati', 'Teknokrati', 'ovrig', 'Expertstyre, evidens, kärnkraft, digitalisering.', [20, 0, 20, -40, 50, 60, 20, -30, -30, 20, 40, 90], { ext: 1, demo: -1, tags: ['storstad_akademiker', 'studenter'] }),
  I('meritokrati', 'Meritokrati', 'ovrig', 'Makt och belöning efter förtjänst och kompetens.', [50, 20, 40, -10, 50, 40, 60, -20, -10, 60, 60, 70], { tags: ['hoginkomst', 'storstad_akademiker'] }),
  I('korporativism', 'Korporativism', 'auktoritar', 'Stat, arbetsgivare och fack samordnade i korporationer.', [-10, 50, 60, 20, 60, -30, -20, 30, 60, -40, -20, 60], { ext: 2, demo: -1 }),
  I('distributism', 'Distributism', 'konservativ', 'Spritt ägande – småföretag, kooperativ och familjejordbruk.', [-10, 30, 40, -30, 30, -20, 0, 80, 60, -20, -30, 0], { ext: 1, tags: ['landsbygd', 'kristna'] }),
  I('federalism', 'Federalism', 'mitten', 'Makt flyttas nedåt till regioner – och uppåt till Europa.', [20, 0, 20, -30, 50, 90, 20, 60, -20, 20, 30, 30], { tags: ['storstad_akademiker'] }),
  I('regionalism', 'Regionalism', 'mitten', 'Regionernas självstyre och identitet före Stockholm.', [10, 20, 20, -20, 30, 10, 10, 95, 20, 10, 10, 0], { tags: ['landsbygd'] }),
  I('suveranism', 'Suveränism', 'nationell', 'Nationell självbestämmanderätt, ut ur överstatliga strukturer.', [10, 70, 60, 40, 30, -100, 0, 50, 50, 0, 10, 60], { ext: 1, tags: ['landsbygd', 'laginkomst'] }),
  // --- systemfientliga ---
  I('falangism', 'Falangism', 'auktoritar', 'Nationalsyndikalism: enpartistat, korporationer, nationell enhet.', [-10, 90, 95, 50, 90, -90, 0, 40, 100, -30, 0, 70], { ext: 3, demo: -2 }),
  I('fascism', 'Fascism', 'auktoritar', 'Totalitär nationalism, ledarkult, våld som politiskt medel.', [0, 100, 100, 60, 100, -100, 0, 40, 100, -20, 0, 70], { ext: 3, demo: -2 }),
  I('nationalsocialism', 'Nationalsocialism', 'auktoritar', 'Rasideologisk totalitarism. I spelet: isolering, förbud mot samarbete och massiv motreaktion.', [-20, 100, 100, 60, 100, -100, -20, 40, 100, -30, -10, 70], { ext: 3, demo: -2 }),
];
export const IDEOLOGY_BY_ID = Object.fromEntries(IDEOLOGIES.map((i) => [i.id, i]));

// Kombinera primär + sekundära ideologier till ett läge
export function combinePositions(primaryId, secondaryIds = []) {
  const p = IDEOLOGY_BY_ID[primaryId]; if (!p) return null;
  const secs = secondaryIds.map((id) => IDEOLOGY_BY_ID[id]).filter(Boolean);
  const wP = secs.length ? .6 : 1, wS = secs.length ? .4 / secs.length : 0;
  const pos = {};
  for (const k in p.pos) pos[k] = Math.round(p.pos[k] * wP + secs.reduce((a, s) => a + s.pos[k] * wS, 0));
  return pos;
}
export const extremismOf = (primaryId, secondaryIds = []) => Math.max(IDEOLOGY_BY_ID[primaryId]?.ext || 0, ...secondaryIds.map((id) => IDEOLOGY_BY_ID[id]?.ext || 0));
export const demoOf = (primaryId, secondaryIds = []) => Math.min(IDEOLOGY_BY_ID[primaryId]?.demo || 0, ...secondaryIds.map((id) => IDEOLOGY_BY_ID[id]?.demo ?? 0));
export const ideologyLabel = (primaryId, secondaryIds = []) => { const p = IDEOLOGY_BY_ID[primaryId]; if (!p) return 'Pragmatisk'; const s = secondaryIds.map((id) => IDEOLOGY_BY_ID[id]?.name.toLowerCase()).filter(Boolean); return s.length ? `${p.name} med inslag av ${s.join(' och ')}` : p.name; };
