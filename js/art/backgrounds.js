// Bakgrunder till debattscenerna (SVG, 16:9). riksdag = plenisalen, tv = studio, press = pressrum,
// kansli = partikansliet, intervju = nyhetsstudio.
export function backgroundSVG(kind) {
  const W = 1600, H = 900;
  const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  switch (kind) {
    case 'riksdag': return wrap(`
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c98f"/><stop offset="1" stop-color="#c79a5a"/></linearGradient>
        <linearGradient id="wood2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4a86a"/><stop offset="1" stop-color="#9c6f3a"/></linearGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3ede0"/><stop offset="1" stop-color="#e2d7c0"/></linearGradient>
        <pattern id="grain" width="40" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 Q10 2 20 4 T40 4" stroke="#000" stroke-opacity=".05" fill="none"/></pattern>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#sky)"/>
      <!-- bakvägg: ljus björkpanel -->
      <rect x="0" y="0" width="${W}" height="520" fill="url(#wood)"/><rect x="0" y="0" width="${W}" height="520" fill="url(#grain)"/>
      ${Array.from({ length: 17 }, (_, i) => `<rect x="${i * 100 - 6}" y="0" width="12" height="520" fill="#000" opacity=".06"/>`).join('')}
      <!-- den stora gobelängen -->
      <rect x="520" y="40" width="560" height="330" fill="#3b5a8c"/><rect x="540" y="60" width="520" height="290" fill="#5d7fb3"/>
      <path d="M540 350 L560 300 L600 320 L650 260 L700 300 L760 230 L820 290 L880 240 L940 300 L1000 250 L1060 320 L1060 350 Z" fill="#8aa6d1" opacity=".8"/>
      <path d="M540 350 L580 330 L640 345 L700 325 L780 345 L860 330 L940 348 L1020 332 L1060 350 Z" fill="#c9d6ea" opacity=".7"/>
      <circle cx="700" cy="140" r="36" fill="#f2d98a" opacity=".9"/>
      <!-- tre kronor -->
      <g fill="#f2c14e" stroke="#9c7a2e" stroke-width="2"><path d="M770 110 l10 -24 l10 24 z"/><path d="M800 90 l10 -24 l10 24 z"/><path d="M830 110 l10 -24 l10 24 z"/></g>
      <!-- talmannens podium -->
      <rect x="560" y="400" width="480" height="140" rx="6" fill="url(#wood2)"/><rect x="560" y="400" width="480" height="14" fill="#f0d8a8"/>
      <rect x="600" y="430" width="400" height="70" fill="#7a5a30" opacity=".5"/>
      <!-- ledamotsbänkar i båge -->
      <path d="M0 620 Q800 520 1600 620 L1600 700 Q800 600 0 700 Z" fill="#6f8fb8"/><path d="M0 620 Q800 520 1600 620 L1600 640 Q800 540 0 640 Z" fill="#8aa8cc"/>
      <path d="M0 720 Q800 610 1600 720 L1600 800 Q800 690 0 800 Z" fill="#5f7fa8"/><path d="M0 720 Q800 610 1600 720 L1600 740 Q800 630 0 740 Z" fill="#7a98c0"/>
      ${Array.from({ length: 22 }, (_, i) => `<rect x="${i * 76 + 10}" y="${600 + Math.abs(i - 10.5) * 7}" width="34" height="24" rx="4" fill="#d9c9a8" opacity=".5"/>`).join('')}
      <!-- talarstol/golv -->
      <rect x="0" y="800" width="${W}" height="100" fill="#8e6a3e"/><rect x="0" y="800" width="${W}" height="10" fill="#b48a55"/>
      <rect x="0" y="0" width="${W}" height="${H}" fill="url(#vign)"/>
      <radialGradient id="vign" cx=".5" cy=".4" r=".8"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>`);
    case 'tv': return wrap(`
      <defs>
        <linearGradient id="tvbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1a3a"/><stop offset="1" stop-color="#132a57"/></linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3a6f"/><stop offset="1" stop-color="#0b1b3a"/></linearGradient>
        <radialGradient id="spot" cx=".5" cy=".3" r=".6"><stop offset="0" stop-color="#4f8ff7" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#tvbg)"/>
      <!-- bakgrundsskärmar -->
      ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 200 + 10}" y="80" width="180" height="300" rx="6" fill="#1e3f7a" stroke="#2f5ea8" stroke-width="3"/><rect x="${i * 200 + 30}" y="110" width="140" height="240" fill="#2a56a0" opacity=".6"/><path d="M${i * 200 + 40} ${300 - (i * 37) % 120} L${i * 200 + 90} ${260 - (i * 53) % 100} L${i * 200 + 150} ${310 - (i * 29) % 140}" stroke="#7fb3ff" stroke-width="4" fill="none" opacity=".8"/>`).join('')}
      <text x="800" y="470" text-anchor="middle" font-family="Inter, Arial" font-weight="900" font-size="72" fill="#dbe8ff" opacity=".9" letter-spacing="6">PARTILEDARDEBATT</text>
      <rect x="300" y="490" width="1000" height="6" fill="#4f8ff7"/>
      <!-- ljusstrålar -->
      <polygon points="200,0 400,0 700,560 500,560" fill="#fff" opacity=".04"/><polygon points="1200,0 1400,0 1100,560 900,560" fill="#fff" opacity=".04"/>
      <rect width="${W}" height="${H}" fill="url(#spot)"/>
      <!-- golv + pulpeter -->
      <rect x="0" y="560" width="${W}" height="340" fill="url(#floor)"/>
      ${Array.from({ length: 16 }, (_, i) => `<line x1="${i * 110}" y1="560" x2="${(i - 8) * 260 + 800}" y2="900" stroke="#3b6fc0" stroke-opacity=".25" stroke-width="2"/>`).join('')}
      <path d="M60 900 L140 700 L420 700 L500 900 Z" fill="#20427c"/><rect x="140" y="690" width="280" height="20" rx="4" fill="#5d8be0"/>
      <path d="M1100 900 L1180 700 L1460 700 L1540 900 Z" fill="#20427c"/><rect x="1180" y="690" width="280" height="20" rx="4" fill="#5d8be0"/>
      <ellipse cx="800" cy="1000" rx="900" ry="300" fill="#4f8ff7" opacity=".12"/>`);
    case 'intervju': return wrap(`
      <defs><linearGradient id="nbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a1c24"/><stop offset="1" stop-color="#2b2f3f"/></linearGradient>
      <linearGradient id="nfloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3f52"/><stop offset="1" stop-color="#1c1f2b"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#nbg)"/>
      <rect x="100" y="60" width="1400" height="420" rx="12" fill="#0f1420" stroke="#3a4260" stroke-width="4"/>
      <rect x="130" y="90" width="1340" height="360" fill="#16213a"/>
      <path d="M130 450 L400 250 L620 330 L900 160 L1180 300 L1470 200 L1470 450 Z" fill="#23365e" opacity=".9"/>
      <circle cx="1250" cy="200" r="60" fill="#e5484d" opacity=".9"/><text x="1250" y="212" text-anchor="middle" font-family="Inter, Arial" font-weight="900" font-size="32" fill="#fff">LIVE</text>
      <text x="200" y="420" font-family="Inter, Arial" font-weight="800" font-size="40" fill="#dbe8ff" opacity=".9">UTFRÅGNINGEN</text>
      <rect x="0" y="560" width="${W}" height="340" fill="url(#nfloor)"/>
      <rect x="250" y="600" width="1100" height="40" rx="8" fill="#5a6180"/><rect x="250" y="640" width="1100" height="260" fill="#3c4260"/>
      <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>`);
    case 'press': return wrap(`
      <defs><linearGradient id="pbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8e9ee"/><stop offset="1" stop-color="#c9ccd6"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#pbg)"/>
      ${Array.from({ length: 24 }, (_, i) => `<text x="${(i % 6) * 280 + 60}" y="${Math.floor(i / 6) * 150 + 120}" font-family="Inter, Arial" font-weight="800" font-size="30" fill="#8a8fa3" opacity=".35" transform="rotate(-8 ${(i % 6) * 280 + 60} ${Math.floor(i / 6) * 150 + 120})">PRESSTRÄFF</text>`).join('')}
      <rect x="0" y="620" width="${W}" height="280" fill="#2f3340"/>
      <rect x="500" y="560" width="600" height="80" rx="6" fill="#1f2230"/><rect x="520" y="540" width="560" height="30" rx="4" fill="#3b4052"/>
      ${Array.from({ length: 7 }, (_, i) => `<rect x="${560 + i * 70}" y="500" width="14" height="60" rx="4" fill="#111"/><rect x="${552 + i * 70}" y="480" width="30" height="34" rx="8" fill="#222"/>`).join('')}`);
    case 'kansli': default: return wrap(`
      <defs><linearGradient id="kbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1ead9"/><stop offset="1" stop-color="#d9cdb5"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#kbg)"/>
      <rect x="120" y="80" width="420" height="400" fill="#a9c7e8" stroke="#fff" stroke-width="12"/><rect x="330" y="80" width="8" height="400" fill="#fff"/><rect x="120" y="280" width="420" height="8" fill="#fff"/>
      <path d="M120 480 L540 480 L540 300 Q400 320 330 280 Q250 300 120 340 Z" fill="#7fa3c9" opacity=".6"/>
      <rect x="700" y="100" width="760" height="380" rx="10" fill="#fff" stroke="#c4b89a" stroke-width="6"/>
      ${Array.from({ length: 5 }, (_, i) => `<rect x="${730 + i * 150}" y="130" width="120" height="320" fill="#e9e2d0"/><rect x="${745 + i * 150}" y="150" width="90" height="12" fill="#b8ad93"/><rect x="${745 + i * 150}" y="175" width="90" height="12" fill="#b8ad93"/><rect x="${745 + i * 150}" y="200" width="60" height="12" fill="#b8ad93"/>`).join('')}
      <rect x="0" y="620" width="${W}" height="280" fill="#6b5436"/><rect x="200" y="560" width="1200" height="70" rx="6" fill="#8c6b42"/><rect x="200" y="560" width="1200" height="12" fill="#b08a58"/>`);
  }
}
