// Politikens tolv axlar. Varje parti, väljargrupp och förslag har ett läge -100…100 på var och en.
export const ISSUES = [
  { id: 'ekonomi', name: 'Skatter & stat', short: 'Ekonomi', left: 'Högre skatt, större offentlig sektor', right: 'Lägre skatt, mindre stat', desc: 'Hur stor del av ekonomin som ska gå via det offentliga.' },
  { id: 'migration', name: 'Migration', short: 'Migration', left: 'Generös invandring & asyl', right: 'Restriktiv invandring', desc: 'Asylpolitik, arbetskraftsinvandring, integrationskrav.' },
  { id: 'kriminal', name: 'Kriminalpolitik', short: 'Brott', left: 'Förebyggande & rehabilitering', right: 'Hårdare straff & fler poliser', desc: 'Hur samhället ska bemöta brottslighet.' },
  { id: 'klimat', name: 'Klimat & miljö', short: 'Klimat', left: 'Kraftfull klimatomställning', right: 'Tillväxt och jobb först', desc: 'Utsläppsmål, koldioxidskatt, naturskydd.' },
  { id: 'forsvar', name: 'Försvar & säkerhet', short: 'Försvar', left: 'Nedrustning, diplomati', right: 'Starkt försvar, NATO', desc: 'Försvarsanslag och säkerhetspolitik.' },
  { id: 'eu', name: 'EU & omvärld', short: 'EU', left: 'EU-skeptisk, nationell suveränitet', right: 'Fördjupat EU-samarbete', desc: 'Sveriges roll i EU och internationellt.' },
  { id: 'valfard', name: 'Välfärdens utförare', short: 'Välfärd', left: 'Offentligt driven välfärd', right: 'Privata alternativ & valfrihet', desc: 'Friskolor, privata vårdgivare, vinster i välfärden.' },
  { id: 'landsbygd', name: 'Stad & land', short: 'Landsbygd', left: 'Storstadsfokus', right: 'Hela landet ska leva', desc: 'Regionalpolitik, bränsleskatter, service på landsbygden.' },
  { id: 'varderingar', name: 'Värderingar', short: 'Värderingar', left: 'Liberal & progressiv', right: 'Traditionell & konservativ', desc: 'Familj, kultur, identitet och individens frihet.' },
  { id: 'arbete', name: 'Arbetsmarknad', short: 'Arbete', left: 'Starka fack & anställningsskydd', right: 'Flexibel arbetsmarknad', desc: 'LAS, a-kassa, lönebildning.' },
  { id: 'bostad', name: 'Bostäder', short: 'Bostäder', left: 'Reglerade hyror & subventioner', right: 'Fri marknad & avreglering', desc: 'Hyresreglering, byggregler, bostadsbidrag.' },
  { id: 'energi', name: 'Energi', short: 'Energi', left: 'Bara förnybart', right: 'Ny kärnkraft', desc: 'Energimix och elpriser.' },
];
export const ISSUE_BY_ID = Object.fromEntries(ISSUES.map((i) => [i.id, i]));
export const issueLabel = (id, v) => {
  const i = ISSUE_BY_ID[id]; const a = Math.abs(v);
  const side = v < 0 ? i.left : i.right;
  if (a < 15) return 'Mitten';
  return (a > 60 ? 'Tydligt: ' : 'Lutar: ') + side.split(',')[0].toLowerCase();
};

// Färdiga ideologier man kan utgå från när man skapar ett parti
export const IDEOLOGIES = [
  { id: 'socialdemokrati', name: 'Socialdemokrati', desc: 'Stark välfärd, fackligt samarbete, pragmatisk mitten-vänster.', pos: { ekonomi: -45, migration: 15, kriminal: 20, klimat: -30, forsvar: 50, eu: 30, valfard: -50, landsbygd: 0, varderingar: -20, arbete: -70, bostad: -40, energi: 10 } },
  { id: 'socialism', name: 'Demokratisk socialism', desc: 'Omfördelning, offentligt ägande, antimilitarism.', pos: { ekonomi: -90, migration: -40, kriminal: -60, klimat: -75, forsvar: -40, eu: -40, valfard: -90, landsbygd: 10, varderingar: -75, arbete: -90, bostad: -85, energi: -60 } },
  { id: 'gron', name: 'Grön politik', desc: 'Klimatet först, solidaritet, decentralisering.', pos: { ekonomi: -40, migration: -70, kriminal: -50, klimat: -100, forsvar: 0, eu: 20, valfard: -30, landsbygd: 20, varderingar: -80, arbete: -30, bostad: -40, energi: -95 } },
  { id: 'liberalism', name: 'Liberalism', desc: 'Individens frihet, marknad, öppenhet mot omvärlden.', pos: { ekonomi: 55, migration: 10, kriminal: 30, klimat: -15, forsvar: 70, eu: 85, valfard: 55, landsbygd: -20, varderingar: -45, arbete: 50, bostad: 55, energi: 60 } },
  { id: 'konservatism', name: 'Konservatism', desc: 'Lag och ordning, tradition, starkt försvar, lägre skatter.', pos: { ekonomi: 60, migration: 65, kriminal: 75, klimat: 30, forsvar: 80, eu: 30, valfard: 55, landsbygd: 10, varderingar: 55, arbete: 55, bostad: 55, energi: 85 } },
  { id: 'nationalism', name: 'Nationalkonservatism', desc: 'Nationen först, restriktiv migration, kulturell sammanhållning.', pos: { ekonomi: 0, migration: 95, kriminal: 90, klimat: 60, forsvar: 55, eu: -70, valfard: -10, landsbygd: 50, varderingar: 80, arbete: 0, bostad: 10, energi: 80 } },
  { id: 'centrism', name: 'Grön liberalism / centrism', desc: 'Landsbygd, småföretag, liberal syn på migration och miljö.', pos: { ekonomi: 40, migration: -30, kriminal: 10, klimat: -55, forsvar: 50, eu: 50, valfard: 40, landsbygd: 85, varderingar: -35, arbete: 55, bostad: 45, energi: -40 } },
  { id: 'kristdemokrati', name: 'Kristdemokrati', desc: 'Familjen, civilsamhället, vård och omsorg, konservativa värden.', pos: { ekonomi: 45, migration: 55, kriminal: 65, klimat: 20, forsvar: 70, eu: 20, valfard: 40, landsbygd: 20, varderingar: 70, arbete: 40, bostad: 40, energi: 85 } },
  { id: 'libertarianism', name: 'Libertarianism', desc: 'Minimal stat, maximal frihet, platt skatt.', pos: { ekonomi: 100, migration: -20, kriminal: 10, klimat: 50, forsvar: 20, eu: -30, valfard: 95, landsbygd: 0, varderingar: -40, arbete: 95, bostad: 100, energi: 70 } },
  { id: 'populism', name: 'Folklig populism', desc: 'Mot eliten, för vanligt folk – pragmatisk blandning.', pos: { ekonomi: -20, migration: 50, kriminal: 60, klimat: 30, forsvar: 30, eu: -50, valfard: -20, landsbygd: 60, varderingar: 30, arbete: -30, bostad: -20, energi: 40 } },
  { id: 'teknokrati', name: 'Teknokrati', desc: 'Expertstyre, evidens, kärnkraft, digitalisering.', pos: { ekonomi: 20, migration: 0, kriminal: 20, klimat: -40, forsvar: 50, eu: 60, valfard: 20, landsbygd: -30, varderingar: -30, arbete: 20, bostad: 40, energi: 90 } },
  { id: 'egen', name: 'Helt egen', desc: 'Börja i mitten och ställ in varje axel själv.', pos: Object.fromEntries(ISSUES.map((i) => [i.id, 0])) },
];
