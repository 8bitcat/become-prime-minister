// Sveriges 21 län. pop i tusental (ungefärlig), urban = andel i tätort/storstad,
// seg = väljargruppernas relativa vikt (1 = riksgenomsnitt), lean = grundläggande
// politisk lutning (-1 vänster … +1 höger) och lands = landsbygdsprägel.
export const REGIONS = [
  { id: 'AB', name: 'Stockholm', pop: 2480, urban: .95, lean: .15, lands: -.8, seg: { storstad_unga: 1.5, storstad_akademiker: 1.9, hoginkomst: 1.8, utrikes_fodda: 1.5, landsbygd: .15, industri: .4, pensionarer: .8, foretagare: 1.2 }, x: 62, y: 66 },
  { id: 'C', name: 'Uppsala', pop: 410, urban: .8, lean: -.05, lands: -.2, seg: { studenter: 2.2, storstad_akademiker: 1.4, miljo: 1.3 }, x: 60, y: 62 },
  { id: 'D', name: 'Södermanland', pop: 305, urban: .75, lean: -.1, lands: .2, seg: { industri: 1.3, forort_familjer: 1.2 }, x: 57, y: 70 },
  { id: 'E', name: 'Östergötland', pop: 475, urban: .78, lean: 0, lands: .1, seg: { industri: 1.2, studenter: 1.3 }, x: 55, y: 74 },
  { id: 'F', name: 'Jönköping', pop: 370, urban: .7, lean: .25, lands: .4, seg: { kristna: 2.4, foretagare: 1.4, industri: 1.2 }, x: 46, y: 80 },
  { id: 'G', name: 'Kronoberg', pop: 205, urban: .68, lean: .1, lands: .5, seg: { industri: 1.3, landsbygd: 1.3, utrikes_fodda: 1.1 }, x: 44, y: 85 },
  { id: 'H', name: 'Kalmar', pop: 250, urban: .65, lean: .05, lands: .6, seg: { pensionarer: 1.5, landsbygd: 1.5 }, x: 52, y: 86 },
  { id: 'I', name: 'Gotland', pop: 61, urban: .55, lean: -.05, lands: .8, seg: { landsbygd: 1.8, miljo: 1.3, pensionarer: 1.3 }, x: 64, y: 84 },
  { id: 'K', name: 'Blekinge', pop: 160, urban: .7, lean: .1, lands: .4, seg: { industri: 1.4, pensionarer: 1.3 }, x: 48, y: 92 },
  { id: 'M', name: 'Skåne', pop: 1430, urban: .88, lean: .15, lands: -.3, seg: { utrikes_fodda: 1.6, storstad_unga: 1.2, laginkomst: 1.3, foretagare: 1.1, landsbygd: .6 }, x: 42, y: 95 },
  { id: 'N', name: 'Halland', pop: 345, urban: .75, lean: .35, lands: .2, seg: { hoginkomst: 1.3, foretagare: 1.4, pensionarer: 1.2 }, x: 36, y: 86 },
  { id: 'O', name: 'Västra Götaland', pop: 1780, urban: .85, lean: 0, lands: -.2, seg: { industri: 1.4, storstad_unga: 1.1, storstad_akademiker: 1.1, utrikes_fodda: 1.2 }, x: 34, y: 76 },
  { id: 'S', name: 'Värmland', pop: 285, urban: .65, lean: -.2, lands: .6, seg: { industri: 1.3, landsbygd: 1.5, pensionarer: 1.3 }, x: 36, y: 64 },
  { id: 'T', name: 'Örebro', pop: 310, urban: .75, lean: -.15, lands: .2, seg: { industri: 1.3, offentlig: 1.2 }, x: 48, y: 66 },
  { id: 'U', name: 'Västmanland', pop: 285, urban: .78, lean: -.1, lands: 0, seg: { industri: 1.5, utrikes_fodda: 1.2 }, x: 54, y: 64 },
  { id: 'W', name: 'Dalarna', pop: 290, urban: .6, lean: -.1, lands: .7, seg: { landsbygd: 1.7, industri: 1.2, pensionarer: 1.3 }, x: 46, y: 56 },
  { id: 'X', name: 'Gävleborg', pop: 290, urban: .65, lean: -.3, lands: .6, seg: { industri: 1.4, landsbygd: 1.4, laginkomst: 1.2 }, x: 55, y: 54 },
  { id: 'Y', name: 'Västernorrland', pop: 245, urban: .62, lean: -.35, lands: .7, seg: { offentlig: 1.3, industri: 1.3, landsbygd: 1.5, pensionarer: 1.3 }, x: 58, y: 44 },
  { id: 'Z', name: 'Jämtland', pop: 135, urban: .5, lean: -.2, lands: .9, seg: { landsbygd: 2.0, miljo: 1.2 }, x: 46, y: 42 },
  { id: 'AC', name: 'Västerbotten', pop: 280, urban: .65, lean: -.4, lands: .7, seg: { offentlig: 1.5, studenter: 1.3, landsbygd: 1.4 }, x: 58, y: 32 },
  { id: 'BD', name: 'Norrbotten', pop: 250, urban: .62, lean: -.45, lands: .8, seg: { industri: 1.6, offentlig: 1.3, landsbygd: 1.5 }, x: 62, y: 18 },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export const TOTAL_POP = REGIONS.reduce((s, r) => s + r.pop, 0);
