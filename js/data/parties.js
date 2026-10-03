// Riksdagens åtta partier vid spelets start (januari 2027). Mandaten är spelets
// fiktiva utgångsläge, inte ett verkligt valresultat. Partiledarna slumpas fram
// per spelomgång – inga verkliga personer förekommer.
export const START_PARTIES = [
  { id: 's', name: 'Socialdemokraterna', abbr: 'S', color: '#E8112d', color2: '#ff6b6b', logo: { shape: 'rose', glyph: 'S' }, slogan: 'Ett starkare samhälle, ett tryggare Sverige', seats: 107, founded: 1889, members: 75000, money: 180e6,
    pos: { ekonomi: -45, migration: 20, kriminal: 25, klimat: -30, forsvar: 55, eu: 30, valfard: -50, landsbygd: 0, varderingar: -20, arbete: -70, bostad: -40, energi: 10 },
    profile: { ekonomi: 1.3, valfard: 1.4, arbete: 1.2, kriminal: .9 }, bloc: 'left', cordon: ['sd'] },
  { id: 'sd', name: 'Sverigedemokraterna', abbr: 'SD', color: '#DDBB00', color2: '#2d5fa8', logo: { shape: 'flower', glyph: 'SD' }, slogan: 'Sverige ska bli bra igen', seats: 73, founded: 1988, members: 35000, money: 95e6,
    pos: { ekonomi: 0, migration: 90, kriminal: 85, klimat: 60, forsvar: 50, eu: -60, valfard: -10, landsbygd: 50, varderingar: 75, arbete: 0, bostad: 10, energi: 80 },
    profile: { migration: 1.8, kriminal: 1.5, energi: .9, eu: .8 }, bloc: 'right', cordon: [] },
  { id: 'm', name: 'Moderaterna', abbr: 'M', color: '#52BDEC', color2: '#1f6fb0', logo: { shape: 'm', glyph: 'M' }, slogan: 'Nu får vi ordning på Sverige', seats: 68, founded: 1904, members: 45000, money: 140e6,
    pos: { ekonomi: 65, migration: 60, kriminal: 70, klimat: 30, forsvar: 80, eu: 50, valfard: 60, landsbygd: -10, varderingar: 30, arbete: 60, bostad: 60, energi: 85 },
    profile: { ekonomi: 1.5, kriminal: 1.3, forsvar: 1.1, energi: 1.0 }, bloc: 'right', cordon: [] },
  { id: 'v', name: 'Vänsterpartiet', abbr: 'V', color: '#DA291C', color2: '#8b0000', logo: { shape: 'v', glyph: 'V' }, slogan: 'Ett Sverige för alla, inte bara för de rikaste', seats: 24, founded: 1917, members: 28000, money: 45e6,
    pos: { ekonomi: -90, migration: -40, kriminal: -60, klimat: -75, forsvar: -30, eu: -40, valfard: -90, landsbygd: 10, varderingar: -75, arbete: -90, bostad: -85, energi: -60 },
    profile: { ekonomi: 1.6, valfard: 1.5, bostad: 1.1, klimat: .9 }, bloc: 'left', cordon: ['sd'] },
  { id: 'c', name: 'Centerpartiet', abbr: 'C', color: '#009933', color2: '#006622', logo: { shape: 'leaf', glyph: 'C' }, slogan: 'Framåt för hela Sverige', seats: 24, founded: 1913, members: 30000, money: 70e6,
    pos: { ekonomi: 40, migration: -30, kriminal: 10, klimat: -55, forsvar: 50, eu: 50, valfard: 40, landsbygd: 85, varderingar: -35, arbete: 55, bostad: 45, energi: -40 },
    profile: { landsbygd: 1.8, klimat: 1.1, ekonomi: .9, migration: .8 }, bloc: 'center', cordon: ['sd', 'v'] },
  { id: 'kd', name: 'Kristdemokraterna', abbr: 'KD', color: '#000077', color2: '#3b3bb3', logo: { shape: 'heart', glyph: 'KD' }, slogan: 'Ett mänskligare Sverige', seats: 19, founded: 1964, members: 18000, money: 40e6,
    pos: { ekonomi: 45, migration: 55, kriminal: 65, klimat: 20, forsvar: 70, eu: 20, valfard: 40, landsbygd: 20, varderingar: 70, arbete: 40, bostad: 40, energi: 85 },
    profile: { valfard: 1.4, varderingar: 1.3, kriminal: 1.0, energi: .9 }, bloc: 'right', cordon: [] },
  { id: 'mp', name: 'Miljöpartiet', abbr: 'MP', color: '#83CF39', color2: '#2e7d32', logo: { shape: 'dandelion', glyph: 'MP' }, slogan: 'Nu. Klimatet kan inte vänta', seats: 18, founded: 1981, members: 14000, money: 35e6,
    pos: { ekonomi: -40, migration: -70, kriminal: -50, klimat: -100, forsvar: 10, eu: 20, valfard: -30, landsbygd: 20, varderingar: -80, arbete: -30, bostad: -40, energi: -95 },
    profile: { klimat: 2.0, energi: 1.3, migration: 1.0, varderingar: .9 }, bloc: 'left', cordon: ['sd'] },
  { id: 'l', name: 'Liberalerna', abbr: 'L', color: '#006AB3', color2: '#1a8ad8', logo: { shape: 'l', glyph: 'L' }, slogan: 'Frihet måste försvaras', seats: 16, founded: 1934, members: 12000, money: 30e6,
    pos: { ekonomi: 55, migration: 20, kriminal: 40, klimat: -10, forsvar: 75, eu: 85, valfard: 55, landsbygd: -20, varderingar: -40, arbete: 50, bostad: 50, energi: 70 },
    profile: { eu: 1.5, valfard: 1.2, forsvar: 1.0, ekonomi: 1.0 }, bloc: 'right', cordon: [] },
];
export const RIKSDAG_SEATS = 349;
export const THRESHOLD = 4;

// Logotyp-former för partiskaparen
export const LOGO_SHAPES = ['rose', 'flower', 'leaf', 'heart', 'star', 'shield', 'circle', 'torch', 'tree', 'wave', 'hex', 'bolt', 'm', 'v', 'l', 'dandelion'];
export const PARTY_COLORS = ['#E8112d', '#DDBB00', '#52BDEC', '#DA291C', '#009933', '#000077', '#83CF39', '#006AB3', '#8e44ad', '#ff7f0e', '#17becf', '#e377c2', '#2c3e50', '#f2c14e', '#1abc9c', '#7f8c8d', '#c0392b', '#2980b9', '#d35400', '#27ae60', '#000000', '#ffffff'];
