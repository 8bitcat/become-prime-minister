// Anime-figurer som SVG (cel-shading, tjocka konturer) – i stil med rättegångsspelens
// visual-novel-porträtt. En figur = look (hud, hår, ögon, kläder …) + pose + uttryck.
// ViewBox 0 0 800 900: huvudet runt (400, 250), axlarna vid y≈470, byst ner till 900.
import { OUTFITS } from '../sim/people.js';

const OUT = '#1a1420'; // konturfärg
const SW = 5; // konturbredd
const dark = (hex, k = .72) => shade(hex, k);
const light = (hex, k = 1.18) => shade(hex, k);
function shade(hex, k) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#888888'); if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k)), g = Math.min(255, Math.round(((n >> 8) & 255) * k)), b = Math.min(255, Math.round((n & 255) * k));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
const ST = (extra = '') => `stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round" ${extra}`;

// ---------- HUVUD ----------
function facePath(shape) {
  switch (shape) {
    case 'kantig': return 'M300 240 C300 330 318 392 360 410 L440 410 C482 392 500 330 500 240 C500 160 456 112 400 112 C344 112 300 160 300 240 Z';
    case 'rund': return 'M296 250 C296 340 340 412 400 414 C460 412 504 340 504 250 C504 170 458 112 400 112 C342 112 296 170 296 250 Z';
    case 'smal': return 'M310 240 C310 330 348 400 400 416 C452 400 490 330 490 240 C490 160 450 112 400 112 C350 112 310 160 310 240 Z';
    default: return 'M302 240 C302 335 345 404 400 412 C455 404 498 335 498 240 C498 160 454 112 400 112 C346 112 302 160 302 240 Z'; // oval
  }
}
function faceShadowPath(shape) { // skugga under luggen + vid kinden (vänster sida i bild)
  return 'M305 232 C310 300 330 360 372 400 C340 380 318 330 312 280 C308 262 306 246 305 232 Z';
}

function eyes(look, expr) {
  const col = look.eyes || '#3a6ea5';
  const L = 342, R = 458, Y = 268;
  const shape = look.eyeShape || 'skarp';
  const open = expr === 'shocked' ? 1.25 : expr === 'smug' || expr === 'tired' ? .6 : expr === 'angry' || expr === 'determined' ? .85 : expr === 'happy' ? .5 : 1;
  const closed = expr === 'happy';
  const eye = (cx, dir) => {
    const w = shape === 'rund' ? 30 : shape === 'smal' ? 30 : 32;
    const hgt = (shape === 'rund' ? 30 : shape === 'smal' ? 18 : 24) * open;
    const tilt = shape === 'skarp' ? 7 : shape === 'smal' ? 5 : 2; // yttre hörn högre
    const ox = cx - dir * w, ix = cx + dir * w; // outer / inner x
    if (closed) return `<path d="M${ox} ${Y + 2} Q${cx} ${Y + 14} ${ix} ${Y + 4}" fill="none" ${ST('stroke-width="6"')}/>`;
    const top = `M${ox} ${Y - tilt + 2} Q${cx} ${Y - hgt - 6} ${ix} ${Y + 2}`;
    const bottom = `Q${cx} ${Y + hgt * .55 + 4} ${ox} ${Y - tilt + 2}`;
    const irisR = Math.min(hgt * .95, 17);
    return `<g>
      <clipPath id="e${dir > 0 ? 'l' : 'r'}"><path d="${top} ${bottom} Z"/></clipPath>
      <path d="${top} ${bottom} Z" fill="#fff" stroke="none"/>
      <g clip-path="url(#e${dir > 0 ? 'l' : 'r'})">
        <ellipse cx="${cx + (expr === 'smug' ? dir * 3 : 0)}" cy="${Y + 1}" rx="${irisR}" ry="${irisR * 1.25}" fill="${col}"/>
        <ellipse cx="${cx + (expr === 'smug' ? dir * 3 : 0)}" cy="${Y - 4}" rx="${irisR * .9}" ry="${irisR * .7}" fill="${dark(col, .6)}"/>
        <ellipse cx="${cx + (expr === 'smug' ? dir * 3 : 0)}" cy="${Y + 3}" rx="${irisR * .42}" ry="${irisR * .55}" fill="#120a14"/>
        <ellipse cx="${cx - 6 + (expr === 'smug' ? dir * 3 : 0)}" cy="${Y - 7}" rx="5" ry="6" fill="#fff"/>
        <ellipse cx="${cx + 5}" cy="${Y + 8}" rx="2.5" ry="3" fill="#fff" opacity=".8"/>
        <path d="M${ox - 4} ${Y - hgt - 2} L${ix + 4} ${Y - hgt - 2} L${ix + 4} ${Y - hgt + 6} Q${cx} ${Y - hgt + 10} ${ox - 4} ${Y - hgt + 2} Z" fill="#000" opacity=".18"/>
      </g>
      <path d="${top}" fill="none" ${ST('stroke-width="7"')}/>
      <path d="M${ox + dir * 4} ${Y + hgt * .5 + 2} Q${cx} ${Y + hgt * .55 + 5} ${ix - dir * 6} ${Y + 4}" fill="none" ${ST('stroke-width="3"')} opacity=".7"/>
      ${shape === 'skarp' ? `<path d="M${ox - dir * 2} ${Y - tilt + 2} l${-dir * 10} ${-6}" fill="none" ${ST('stroke-width="5"')}/>` : ''}
    </g>`;
  };
  return eye(L, 1) + eye(R, -1);
}

function brows(look, expr) {
  const col = look.hairColor || '#2b2b2b';
  const thick = look.brows === 'tjocka' ? 11 : look.brows === 'tunna' ? 6 : 8;
  const L = 342, R = 458;
  let y = 232, innerDy = 0, outerDy = 0;
  if (expr === 'determined') { innerDy = 18; outerDy = -4; y = 228; }
  if (expr === 'angry' || expr === 'objection') { innerDy = 28; outerDy = -8; y = 226; }
  if (expr === 'shocked') { y = 214; innerDy = -4; outerDy = -2; }
  if (expr === 'sad' || expr === 'nervous') { innerDy = -10; outerDy = 6; y = 232; }
  if (expr === 'smug') { innerDy = 6; outerDy = -8; y = 230; }
  if (expr === 'happy') { y = 226; }
  const b = (cx, dir) => { const ox = cx - dir * 34, ix = cx + dir * 30; return `<path d="M${ox} ${y + outerDy} Q${cx} ${y - 10 + (innerDy + outerDy) / 2} ${ix} ${y + innerDy}" fill="none" stroke="${dark(col, .7)}" stroke-width="${thick}" stroke-linecap="round"/>`; };
  return b(L, 1) + b(R, -1);
}

function nose() {
  return `<path d="M402 300 L408 322 L396 326" fill="none" ${ST('stroke-width="4"')} opacity=".85"/>`;
}

function mouth(look, expr, talking) {
  const y = 356;
  const wide = look.mouth === 'bred' ? 1.25 : look.mouth === 'smal' ? .8 : 1;
  const w = 26 * wide;
  if (talking || expr === 'objection' || expr === 'shocked') {
    const h = expr === 'objection' ? 34 : expr === 'shocked' ? 26 : 18;
    const ww = expr === 'objection' ? w * 1.3 : w;
    return `<path d="M${400 - ww} ${y - 2} Q400 ${y - 8} ${400 + ww} ${y - 2} Q${400 + ww * .9} ${y + h} 400 ${y + h + 6} Q${400 - ww * .9} ${y + h} ${400 - ww} ${y - 2} Z" fill="#4a1420" ${ST()}/>
      <path d="M${400 - ww * .8} ${y + 1} Q400 ${y + 5} ${400 + ww * .8} ${y + 1} L${400 + ww * .7} ${y + 7} Q400 ${y + 11} ${400 - ww * .7} ${y + 7} Z" fill="#fff"/>
      <ellipse cx="400" cy="${y + h - 2}" rx="${ww * .5}" ry="${h * .22}" fill="#c0384a"/>`;
  }
  switch (expr) {
    case 'angry': case 'determined': return `<path d="M${400 - w} ${y + 4} Q400 ${y - 4} ${400 + w} ${y + 4}" fill="none" ${ST('stroke-width="5"')}/>`;
    case 'smug': return `<path d="M${400 - w} ${y + 2} Q${400 + w * .3} ${y + 14} ${400 + w * 1.1} ${y - 6}" fill="none" ${ST('stroke-width="5"')}/>`;
    case 'happy': return `<path d="M${400 - w} ${y - 2} Q400 ${y + 20} ${400 + w} ${y - 2}" fill="#4a1420" ${ST('stroke-width="5"')}/><path d="M${400 - w * .7} ${y + 1} Q400 ${y + 7} ${400 + w * .7} ${y + 1} Z" fill="#fff"/>`;
    case 'sad': case 'nervous': return `<path d="M${400 - w * .8} ${y + 6} Q400 ${y - 4} ${400 + w * .8} ${y + 6}" fill="none" ${ST('stroke-width="5"')}/>`;
    case 'confident': return `<path d="M${400 - w} ${y} Q400 ${y + 10} ${400 + w} ${y - 2}" fill="none" ${ST('stroke-width="5"')}/>`;
    default: return `<path d="M${400 - w} ${y + 2} Q400 ${y + 8} ${400 + w} ${y + 2}" fill="none" ${ST('stroke-width="5"')}/>`;
  }
}

function extras(expr) {
  if (expr === 'nervous') return `<path d="M470 190 C480 205 486 214 486 222 A10 10 0 0 1 466 222 C466 214 470 205 470 190 Z" fill="#9fd8ff" ${ST('stroke-width="3"')}/>`;
  if (expr === 'angry' || expr === 'objection') return `<g fill="none" ${ST('stroke-width="4"')}><path d="M494 170 l8 -8 M504 180 l8 -8 M486 158 l8 -8"/></g>`;
  if (expr === 'shocked') return `<g fill="none" ${ST('stroke-width="4"')}><path d="M300 140 l-10 -14 M292 160 l-14 -8 M314 128 l-6 -16"/></g>`;
  return '';
}

function ears(skin) {
  return `<ellipse cx="300" cy="272" rx="13" ry="22" fill="${skin}" ${ST()}/><ellipse cx="500" cy="272" rx="13" ry="22" fill="${skin}" ${ST()}/>
    <path d="M296 262 q-4 10 2 20" fill="none" ${ST('stroke-width="3"')} opacity=".6"/><path d="M504 262 q4 10 -2 20" fill="none" ${ST('stroke-width="3"')} opacity=".6"/>`;
}

function glasses(kind) {
  if (!kind || kind === 'inga') return '';
  const col = '#2a2a2a';
  if (kind === 'runda') return `<g fill="none" stroke="${col}" stroke-width="5"><circle cx="344" cy="270" r="30"/><circle cx="456" cy="270" r="30"/><path d="M374 266 q26 -8 52 0"/><path d="M314 262 L300 256 M486 262 L500 256"/></g><g fill="#9fd8ff" opacity=".18"><circle cx="344" cy="270" r="30"/><circle cx="456" cy="270" r="30"/></g>`;
  if (kind === 'kant') return `<g fill="none" stroke="${col}" stroke-width="6"><rect x="310" y="246" width="66" height="46" rx="8"/><rect x="424" y="246" width="66" height="46" rx="8"/><path d="M376 266 q24 -8 48 0"/><path d="M310 262 L300 256 M490 262 L500 256"/></g><g fill="#9fd8ff" opacity=".15"><rect x="310" y="246" width="66" height="46" rx="8"/><rect x="424" y="246" width="66" height="46" rx="8"/></g>`;
  return `<g fill="none" stroke="#8a7a50" stroke-width="3"><path d="M312 258 q32 -12 64 0 v24 q-32 12 -64 0 Z"/><path d="M424 258 q32 -12 64 0 v24 q-32 12 -64 0 Z"/><path d="M376 264 q24 -8 48 0"/><path d="M312 262 L300 256 M488 262 L500 256"/></g>`;
}

function beard(kind, col) {
  const c = dark(col, .8);
  switch (kind) {
    case 'stubb': return `<path d="M318 300 C322 360 350 400 400 410 C450 400 478 360 482 300 C470 350 445 380 400 388 C355 380 330 350 318 300 Z" fill="${c}" opacity=".25"/>`;
    case 'skagg': return `<path d="M312 290 C318 370 352 416 400 426 C448 416 482 370 488 290 C480 340 460 392 400 398 C340 392 320 340 312 290 Z" fill="${c}" ${ST()}/><path d="M372 346 Q400 338 428 346" fill="none" stroke="${c}" stroke-width="7"/>`;
    case 'mustasch': return `<path d="M366 340 Q384 330 400 340 Q416 330 434 340 Q424 352 400 348 Q376 352 366 340 Z" fill="${c}" ${ST('stroke-width="3"')}/>`;
    case 'getskagg': return `<path d="M378 384 Q400 420 422 384 Q412 400 400 404 Q388 400 378 384 Z" fill="${c}" ${ST('stroke-width="3"')}/><path d="M366 340 Q384 330 400 340 Q416 330 434 340 Q424 352 400 348 Q376 352 366 340 Z" fill="${c}" ${ST('stroke-width="3"')}/>`;
    default: return '';
  }
}

// ---------- HÅR ----------
// Varje stil returnerar { back, front } (bakom huvudet / framför ansiktet)
const HAIR = {
  spik(c) {
    const d = dark(c), l = light(c, 1.3);
    return {
      back: `<path d="M300 250 L250 190 L286 196 L240 130 L300 150 L282 90 L350 120 L360 60 L410 110 L470 50 L468 118 L540 92 L512 150 L560 150 L520 190 L540 230 L500 240 L500 300 L300 300 Z" fill="${c}" ${ST()}/>
             <path d="M250 190 L286 196 L240 130 L300 150 L282 90 L350 120 L360 60 L410 110" fill="none" stroke="${l}" stroke-width="6" opacity=".35"/>`,
      front: `<path d="M298 236 C300 180 330 130 380 118 L368 150 L420 112 L418 150 L470 118 L462 160 L498 150 L500 236 L480 190 L450 210 L430 176 L394 214 L370 184 L340 212 L320 186 Z" fill="${c}" ${ST()}/>
              <path d="M330 150 Q360 128 400 122" fill="none" stroke="${l}" stroke-width="7" opacity=".4"/>`,
    };
  },
  sidbena(c) {
    const l = light(c, 1.3);
    return {
      back: `<path d="M296 250 C290 180 330 112 400 108 C470 112 510 180 504 250 L504 300 L296 300 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M296 240 C300 170 340 118 400 116 C460 116 502 160 504 240 L492 210 C470 186 440 170 420 176 C400 182 388 200 382 216 L370 190 C350 176 326 190 312 220 Z" fill="${c}" ${ST()}/>
              <path d="M330 160 Q380 128 440 140" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>`,
    };
  },
  kort(c) {
    const l = light(c, 1.3);
    return {
      back: `<path d="M298 246 C292 176 334 112 400 110 C466 112 508 176 502 246 L502 280 L298 280 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M298 236 C300 180 340 124 400 120 C460 124 500 180 502 236 L486 204 C470 188 452 182 436 190 L420 170 L404 192 L380 170 L366 194 C348 186 330 196 314 216 Z" fill="${c}" ${ST()}/>
              <path d="M340 150 Q400 126 460 150" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>`,
    };
  },
  slick(c) {
    const l = light(c, 1.35);
    return {
      back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L510 300 L290 300 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M296 236 C300 160 346 110 400 108 C454 110 500 160 504 236 L496 214 C480 170 440 150 400 150 C360 150 320 170 304 214 Z" fill="${c}" ${ST()}/>
              <g fill="none" stroke="${l}" stroke-width="5" opacity=".45"><path d="M330 170 Q400 130 470 170"/><path d="M345 150 Q400 120 455 150"/></g>`,
    };
  },
  lang(c) {
    const l = light(c, 1.3);
    return {
      back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L530 560 C500 580 460 590 400 590 C340 590 300 580 270 560 Z" fill="${c}" ${ST()}/>
             <path d="M320 300 Q310 440 300 540 M480 300 Q490 440 500 540" fill="none" stroke="${dark(c)}" stroke-width="6" opacity=".5"/>`,
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L494 212 C476 180 450 166 426 174 L408 196 L392 170 C364 166 334 180 316 216 Z" fill="${c}" ${ST()}/>
              <path d="M340 160 Q400 126 460 150" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>`,
    };
  },
  bob(c) {
    const l = light(c, 1.3), d = dark(c);
    return {
      back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L516 400 C490 418 440 426 400 426 C360 426 310 418 284 400 Z" fill="${c}" ${ST()}/>
             <g fill="none" stroke="${d}" stroke-width="5" opacity=".4"><path d="M312 300 q-4 50 -8 94 M488 300 q4 50 8 94 M330 340 q-2 40 -6 66"/></g>`,
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L500 260 C488 210 460 186 430 188 L416 208 L396 184 C360 176 330 194 312 236 L300 262 Z" fill="${c}" ${ST()}/>
              <path d="M330 170 Q400 128 470 160" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>`,
    };
  },
  knut(c) {
    const l = light(c, 1.3);
    return {
      back: `<circle cx="400" cy="112" r="40" fill="${c}" ${ST()}/><path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L504 290 L296 290 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M296 236 C300 160 346 112 400 110 C454 112 500 160 504 236 L496 220 C486 178 450 158 400 156 C350 158 316 178 304 220 Z" fill="${c}" ${ST()}/>
              <path d="M340 180 Q400 150 460 180 M372 158 L380 206" fill="none" stroke="${l}" stroke-width="5" opacity=".45"/>`,
    };
  },
  lockigt(c) {
    const l = light(c, 1.3), d = dark(c);
    // en stor rundad hårmassa med vågig kant + några lockar i luggen
    const edge = [[292, 300], [288, 340], [300, 372], [330, 390], [470, 390], [500, 372], [512, 340], [508, 300]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="24" fill="${c}" ${ST()}/>`).join('');
    return {
      back: edge + `<path d="M288 250 C276 160 322 96 400 94 C478 96 524 160 512 250 L512 340 C500 372 470 388 400 388 C330 388 300 372 288 340 Z" fill="${c}" ${ST()}/>
             <g fill="none" stroke="${d}" stroke-width="4" opacity=".45"><path d="M320 300 q-10 24 4 46 M480 300 q10 24 -4 46 M300 250 q-8 20 2 40"/></g>`,
      front: `<path d="M296 236 C300 160 346 112 400 110 C454 112 500 160 504 236 L492 222 C474 200 452 204 440 220 L412 196 L388 220 C372 204 344 200 322 224 L308 240 Z" fill="${c}" ${ST()}/>
              <g fill="none" stroke="${d}" stroke-width="4" opacity=".45"><path d="M330 214 q-8 -14 6 -22 M352 196 q-6 -16 10 -20 M384 190 q-2 -18 14 -16 M420 190 q4 -18 -12 -16 M452 198 q8 -14 -8 -20 M474 218 q10 -12 -4 -22 M344 150 q6 -14 20 -8 M396 134 q10 -10 22 0 M444 150 q-6 -14 -20 -8"/></g>
              <path d="M360 140 Q400 124 440 140" fill="none" stroke="${l}" stroke-width="6" opacity=".4"/>`,
    };
  },
  flint() { return { back: '', front: `<path d="M330 150 Q400 118 470 150" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="8" stroke-linecap="round"/>` }; },
  page(c) {
    const l = light(c, 1.3), d = dark(c);
    return {
      back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L512 360 C480 372 440 376 400 376 C360 376 320 372 288 360 Z" fill="${c}" ${ST()}/>
             <g fill="none" stroke="${d}" stroke-width="5" opacity=".4"><path d="M310 290 q-2 40 -6 70 M490 290 q2 40 6 70"/></g>`,
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L500 250 L300 250 Z" fill="${c}" ${ST()}/><path d="M304 246 L496 246 L494 236 L306 236 Z" fill="${dark(c)}" opacity=".3"/>
              <path d="M330 170 Q400 128 470 160" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>`,
    };
  },
  tofs(c) {
    const l = light(c, 1.3);
    return {
      back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L504 290 L296 290 Z" fill="${c}" ${ST()}/><path d="M490 200 C560 240 560 380 520 470 L496 460 C520 390 520 280 480 230 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M296 236 C300 160 346 112 400 110 C454 112 500 160 504 236 L496 214 C480 170 440 160 400 162 C360 160 320 170 304 214 Z M376 160 L360 212 L394 176 Z" fill="${c}" ${ST()}/>
              <path d="M340 176 Q400 146 460 176" fill="none" stroke="${l}" stroke-width="5" opacity=".45"/>`,
    };
  },
  tunn(c) {
    return {
      back: `<path d="M298 250 C294 190 318 140 350 122 L300 300 Z M502 250 C506 190 482 140 450 122 L500 300 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M302 236 C306 200 322 160 352 136 L330 220 L316 236 Z M498 236 C494 200 478 160 448 136 L470 220 L484 236 Z" fill="${c}" ${ST()}/>
              <path d="M360 140 Q400 124 440 140" fill="none" stroke="${c}" stroke-width="5" opacity=".5"/>`,
    };
  },
};

// ---------- KROPP & POSER ----------
function outfitOf(look) { return OUTFITS.find((o) => o.id === look.outfit) || OUTFITS[0]; }

function torso(o, skin) {
  const jacket = o.jacket, shirt = o.shirt;
  if (!jacket) { // skjorta
    return `<path d="M400 452 L330 436 C240 452 190 530 184 650 L178 900 L622 900 L616 650 C610 530 560 452 470 436 Z" fill="${shirt}" ${ST()}/>
      <path d="M330 436 C300 480 320 560 400 600 C480 560 500 480 470 436 L446 460 L400 520 L354 460 Z" fill="${dark(shirt, .9)}" stroke="none"/>
      <path d="M352 440 L400 470 L448 440 L436 418 L400 448 L364 418 Z" fill="${shirt}" ${ST()}/>
      <path d="M400 470 L392 640 M400 470 L408 640" stroke="${dark(shirt, .8)}" stroke-width="2"/>
      <path d="M190 620 C200 560 230 500 300 470" fill="none" stroke="${dark(shirt, .85)}" stroke-width="6" opacity=".5"/>`;
  }
  const jd = dark(jacket, .78), jl = light(jacket, 1.12);
  let s = `<path d="M400 460 L330 434 C236 452 186 530 180 650 L172 900 L628 900 L620 650 C614 530 564 452 470 434 Z" fill="${jacket}" ${ST()}/>`;
  // skugga under kavajens högra sida (bildens vänstra)
  s += `<path d="M330 434 C236 452 186 530 180 650 L172 900 L260 900 L262 660 C266 560 290 490 340 450 Z" fill="${jd}" opacity=".5" stroke="none"/>`;
  s += `<path d="M560 480 C598 540 614 600 618 680" fill="none" stroke="${jl}" stroke-width="8" opacity=".35"/>`;
  if (o.polo) {
    s += `<path d="M352 440 C352 480 376 520 400 640 C424 520 448 480 448 440 Z" fill="${shirt}" ${ST()}/>
          <path d="M352 440 C352 480 376 520 400 640 C424 520 448 480 448 440 L440 436 L400 448 L360 436 Z" fill="${jacket}" opacity=".5" stroke="none"/>
          <path d="M362 418 Q400 440 438 418 L446 440 Q400 466 354 440 Z" fill="${dark(shirt, .9)}" ${ST()}/>`;
  } else {
    // skjortan i V:et
    s += `<path d="M352 436 L400 470 L448 436 L440 420 L400 448 L360 420 Z" fill="${shirt}" ${ST()}/>`;
    s += `<path d="M360 440 L400 650 L440 440 L400 470 Z" fill="${shirt}" stroke="none"/>`;
    if (o.cravat) {
      s += `<path d="M372 450 Q400 480 428 450 L432 520 Q400 560 368 520 Z" fill="#f4f0ea" ${ST()}/><path d="M380 470 Q400 490 420 470 M376 500 Q400 522 424 500" fill="none" stroke="#cfc8bb" stroke-width="3"/>`;
    } else if (o.tie) {
      s += `<path d="M388 462 L412 462 L404 486 L420 600 L400 640 L380 600 L396 486 Z" fill="${o.tie}" ${ST()}/><path d="M396 486 L380 600 L400 640 L402 600 Z" fill="${dark(o.tie, .7)}" stroke="none" opacity=".6"/>`;
    }
    // slag (lapels)
    s += `<path d="M330 434 L400 640 L350 486 Q324 450 330 434 Z" fill="${jl}" ${ST()}/><path d="M470 434 L400 640 L450 486 Q476 450 470 434 Z" fill="${jl}" ${ST()}/>`;
    s += `<path d="M330 434 L400 640 L350 486 Q324 450 330 434 Z" fill="${jd}" opacity=".35" stroke="none"/>`;
    // knapp + nål
    s += `<circle cx="400" cy="660" r="7" fill="${jd}" ${ST('stroke-width="3"')}/>`;
  }
  return s;
}

const armSleeve = (pts, o, far = false) => {
  const col = o.jacket || o.shirt;
  const c = far ? dark(col, .85) : col;
  return `<path d="${pts}" fill="none" stroke="${OUT}" stroke-width="${84 + SW * 2}" stroke-linecap="round" stroke-linejoin="round"/><path d="${pts}" fill="none" stroke="${c}" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/>`;
};
// Allt nedan ritas i "armlokala" koordinater: +x = utmed armen mot handen, a = armens vinkel.
const at = (x, y, a, inner) => `<g transform="translate(${x} ${y}) rotate(${a})">${inner}</g>`;
const cuff = (x, y, a, o) => o.jacket ? at(x, y, a, `<rect x="-12" y="-46" width="24" height="92" rx="5" fill="${o.shirt}" ${ST('stroke-width="4"')}/>`) : '';
const knuckles = `<path d="M6 -14 h36 M6 2 h38 M6 18 h34" fill="none" ${ST('stroke-width="3"')} opacity=".5"/>`;
function handPoint(x, y, a, skin) { // knuten hand med utsträckt pekfinger
  return at(x, y, a, `<rect x="-18" y="-36" width="78" height="72" rx="26" fill="${skin}" ${ST()}/>
    <rect x="42" y="-15" width="104" height="30" rx="15" fill="${skin}" ${ST()}/>
    <path d="M0 -34 q22 -30 48 -16 q-4 18 -26 22" fill="${skin}" ${ST('stroke-width="4"')}/>
    <path d="M42 -2 q10 6 22 2" fill="none" ${ST('stroke-width="3"')} opacity=".5"/>${knuckles}`);
}
function handFist(x, y, a, skin) {
  return at(x, y, a, `<rect x="-36" y="-32" width="78" height="64" rx="24" fill="${skin}" ${ST()}/>
    <path d="M-10 -34 q20 -22 44 -10 q-6 16 -26 18" fill="${skin}" ${ST('stroke-width="4"')}/>${knuckles}`);
}
function handFlat(x, y, a, skin) { // handflatan nedåt, fingrarna utmed +x
  return at(x, y, a, `<rect x="-30" y="-28" width="98" height="56" rx="22" fill="${skin}" ${ST()}/>
    <path d="M24 -26 v52 M44 -26 v52" fill="none" ${ST('stroke-width="3"')} opacity=".5"/>
    <path d="M-20 -28 q10 -14 30 -8" fill="none" ${ST('stroke-width="3"')} opacity=".5"/>`);
}
function handOpen(x, y, a, skin) { // öppen hand som presenterar
  const f = (ang, len) => `<rect x="20" y="-13" width="${len}" height="26" rx="13" fill="${skin}" ${ST()} transform="rotate(${ang})"/>`;
  return at(x, y, a, `${f(-38, 62)}${f(-12, 72)}${f(12, 70)}${f(36, 58)}<ellipse cx="4" cy="2" rx="40" ry="36" fill="${skin}" ${ST()}/>
    <rect x="-10" y="-14" width="26" height="56" rx="13" fill="${skin}" ${ST()} transform="rotate(-72)"/>`);
}

function pose(kind, o, skin) {
  switch (kind) {
    case 'point': // signaturposen: armen rakt ut, pekfingret mot motståndaren
      return { behind: armSleeve('M292 500 L250 600 L262 720', o, true) + handFist(262, 740, 90, skin),
        front: armSleeve('M520 496 L610 436 L690 384', o) + cuff(690, 384, -33, o) + handPoint(704, 375, -33, skin) };
    case 'cross': // armarna i kors
      return { behind: '', front: armSleeve('M292 500 L262 610 L450 636', o, true) + handFlat(486, 640, 6, skin) + armSleeve('M508 500 L538 610 L350 636', o) + cuff(350, 636, 186, o) + handFlat(318, 642, 186, skin) };
    case 'slam': // händerna i bordet
      return { behind: '', front: armSleeve('M292 500 L250 650 L300 840', o, true) + armSleeve('M508 500 L550 650 L500 840', o) + cuff(300, 840, 75, o) + handFlat(312, 870, 75, skin) + cuff(500, 840, 105, o) + handFlat(488, 870, 105, skin) };
    case 'think': // knogarna mot hakan
      return { behind: armSleeve('M508 500 L560 620 L540 760', o, true), front: armSleeve('M292 500 L262 640 L372 436', o) + cuff(372, 436, -62, o) + handFist(382, 416, -62, skin) };
    case 'open': // öppen hand, presenterar
      return { behind: armSleeve('M292 500 L250 620 L262 760', o, true), front: armSleeve('M508 500 L600 600 L690 560', o) + cuff(690, 560, -24, o) + handOpen(712, 550, -24, skin) };
    case 'hips': // händerna i sidorna
      return { behind: '', front: armSleeve('M292 500 L236 640 L290 760', o, true) + armSleeve('M508 500 L564 640 L510 760', o) + cuff(290, 760, 66, o) + handFist(300, 782, 66, skin) + cuff(510, 760, 114, o) + handFist(500, 782, 114, skin) };
    default: // stand
      return { behind: '', front: armSleeve('M292 500 L252 640 L246 800', o, true) + armSleeve('M508 500 L548 640 L554 800', o) };
  }
}

// ---------- HELA FIGUREN ----------
export function characterSVG(person, { pose: poseKind = 'stand', expr = 'neutral', talking = false, width = 400, height = 450, crop = 'bust', id = 'c' } = {}) {
  const look = person.look || {};
  const skin = look.skin || '#f5cfae';
  const o = outfitOf(look);
  const hairC = look.hairColor || '#2b2b2b';
  const hair = (HAIR[look.hair] || HAIR.kort)(hairC);
  const P = pose(poseKind, o, skin);
  const view = crop === 'face' ? '270 90 260 340' : crop === 'head' ? '240 60 320 420' : '0 0 800 900';
  const grey = person.age >= 62 ? `<path d="M310 200 Q330 150 370 130" fill="none" stroke="#e8e8e8" stroke-width="6" opacity=".5"/><path d="M490 200 Q470 150 430 130" fill="none" stroke="#e8e8e8" stroke-width="6" opacity=".5"/>` : '';
  const wrinkles = person.age >= 55 ? `<g fill="none" ${ST('stroke-width="3"')} opacity=".35"><path d="M318 316 q8 10 2 24 M482 316 q-8 10 -2 24 M372 390 q28 10 56 0"/></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="${width}" height="${height}" class="aa-char" data-expr="${expr}" data-pose="${poseKind}">
    <defs><clipPath id="${id}face"><path d="${facePath(look.face)}"/></clipPath></defs>
    ${hair.back}
    ${P.behind}
    ${torso(o, skin)}
    <path d="M372 380 L372 470 L428 470 L428 380 Z" fill="${skin}" ${ST()}/>
    <path d="M372 384 L372 420 Q400 440 428 420 L428 384 Z" fill="${dark(skin, .78)}" stroke="none"/>
    ${ears(skin)}
    <path d="${facePath(look.face)}" fill="${skin}" ${ST()}/>
    <g clip-path="url(#${id}face)">
      <path d="${faceShadowPath(look.face)}" fill="${dark(skin, .82)}" opacity=".7"/>
      <ellipse cx="340" cy="320" rx="26" ry="14" fill="#f08a8a" opacity=".22"/><ellipse cx="460" cy="320" rx="26" ry="14" fill="#f08a8a" opacity=".22"/>
      ${wrinkles}
    </g>
    ${beard(look.beard, hairC)}
    ${brows(look, expr)}
    ${eyes(look, expr)}
    ${nose()}
    ${mouth(look, expr, talking)}
    ${hair.front}
    ${grey}
    ${glasses(look.glasses)}
    ${extras(expr)}
    ${P.front}
  </svg>`;
}

export const EXPRESSIONS = ['neutral', 'determined', 'confident', 'angry', 'objection', 'shocked', 'smug', 'happy', 'sad', 'nervous'];
export const POSES = ['stand', 'point', 'cross', 'slam', 'think', 'open', 'hips'];
