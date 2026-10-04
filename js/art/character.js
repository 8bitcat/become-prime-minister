// Anime-figurer som SVG (cel-shading, tjocka konturer) – vanliga människor i visual-novel-stil.
// En figur = look (hud, hår, ögon, näsa, kropp, kläder, detaljer …) + pose + uttryck.
// ViewBox 0 0 800 900: huvudet runt (400, 250), axlarna vid y≈470, byst ner till 900.
import { OUTFITS, OUTFIT_BY_ID, fixLook } from '../sim/people.js';

const OUT = '#1a1420'; // konturfärg
const SW = 5; // konturbredd
const dark = (hex, k = .72) => shade(hex, k);
const light = (hex, k = 1.18) => shade(hex, k);
function shade(hex, k) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#888888'); if (!m) return hex || '#888888';
  const n = parseInt(m[1], 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k)), g = Math.min(255, Math.round(((n >> 8) & 255) * k)), b = Math.min(255, Math.round((n & 255) * k));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
const ST = (extra = '') => `stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round" ${extra}`;

// ---------- HUVUD ----------
function facePath(shape) {
  switch (shape) {
    case 'kantig': return 'M300 240 C300 330 318 392 360 410 L440 410 C482 392 500 330 500 240 C500 160 456 112 400 112 C344 112 300 160 300 240 Z';
    case 'rund': return 'M292 250 C292 345 340 414 400 416 C460 414 508 345 508 250 C508 170 460 112 400 112 C340 112 292 170 292 250 Z';
    case 'smal': return 'M310 240 C310 330 348 400 400 416 C452 400 490 330 490 240 C490 160 450 112 400 112 C350 112 310 160 310 240 Z';
    case 'langt': return 'M306 236 C306 340 344 416 400 426 C456 416 494 340 494 236 C494 156 452 106 400 106 C348 106 306 156 306 236 Z';
    default: return 'M302 240 C302 335 345 404 400 412 C455 404 498 335 498 240 C498 160 454 112 400 112 C346 112 302 160 302 240 Z'; // oval
  }
}
const faceShadowPath = () => 'M305 232 C310 300 330 360 372 400 C340 380 318 330 312 280 C308 262 306 246 305 232 Z';

function eyes(look, expr, uid) {
  const col = look.eyes || '#3a6ea5';
  const L = 342, R = 458, Y = 268;
  const shape = look.eyeShape || 'skarp';
  let open = expr === 'shocked' ? 1.25 : expr === 'smug' || expr === 'tired' ? .6 : expr === 'angry' || expr === 'determined' ? .85 : expr === 'happy' ? .5 : 1;
  if (shape === 'trotta') open *= .75;
  const closed = expr === 'happy';
  const eye = (cx, dir) => {
    const w = shape === 'stora' ? 34 : 31;
    const hgt = (shape === 'rund' ? 30 : shape === 'stora' ? 34 : shape === 'smal' ? 18 : shape === 'trotta' ? 22 : 24) * open;
    const tilt = shape === 'skarp' ? 7 : shape === 'smal' ? 5 : shape === 'trotta' ? -2 : 2;
    const ox = cx - dir * w, ix = cx + dir * w;
    if (closed) return `<path d="M${ox} ${Y + 2} Q${cx} ${Y + 14} ${ix} ${Y + 4}" fill="none" ${ST('stroke-width="6"')}/>`;
    const top = `M${ox} ${Y - tilt + 2} Q${cx} ${Y - hgt - 6} ${ix} ${Y + 2}`;
    const bottom = `Q${cx} ${Y + hgt * .55 + 4} ${ox} ${Y - tilt + 2}`;
    const irisR = Math.min(hgt * .95, shape === 'stora' ? 19 : 17);
    const cid = `${uid}e${dir > 0 ? 'l' : 'r'}`;
    return `<g>
      <clipPath id="${cid}"><path d="${top} ${bottom} Z"/></clipPath>
      <path d="${top} ${bottom} Z" fill="#fff" stroke="none"/>
      <g clip-path="url(#${cid})">
        <ellipse cx="${cx + (expr === 'smug' ? dir * 3 : 0)}" cy="${Y + 1}" rx="${irisR}" ry="${irisR * 1.25}" fill="${col}"/>
        <ellipse cx="${cx + (expr === 'smug' ? dir * 3 : 0)}" cy="${Y - 4}" rx="${irisR * .9}" ry="${irisR * .7}" fill="${dark(col, .6)}"/>
        <ellipse cx="${cx + (expr === 'smug' ? dir * 3 : 0)}" cy="${Y + 3}" rx="${irisR * .42}" ry="${irisR * .55}" fill="#120a14"/>
        <ellipse cx="${cx - 6 + (expr === 'smug' ? dir * 3 : 0)}" cy="${Y - 7}" rx="5" ry="6" fill="#fff"/>
        <ellipse cx="${cx + 5}" cy="${Y + 8}" rx="2.5" ry="3" fill="#fff" opacity=".8"/>
        <path d="M${ox - 4} ${Y - hgt - 2} L${ix + 4} ${Y - hgt - 2} L${ix + 4} ${Y - hgt + 6} Q${cx} ${Y - hgt + 10} ${ox - 4} ${Y - hgt + 2} Z" fill="#000" opacity=".18"/>
      </g>
      <path d="${top}" fill="none" ${ST('stroke-width="7"')}/>
      ${shape === 'trotta' ? `<path d="M${ox} ${Y - 8} Q${cx} ${Y - hgt - 14} ${ix} ${Y - 6}" fill="none" ${ST('stroke-width="3"')} opacity=".5"/>` : ''}
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
  const arch = look.brows === 'raka' ? -2 : look.brows === 'vinklade' ? -16 : -10;
  const b = (cx, dir) => { const ox = cx - dir * 34, ix = cx + dir * 30; return `<path d="M${ox} ${y + outerDy} Q${cx} ${y + arch + (innerDy + outerDy) / 2} ${ix} ${y + innerDy}" fill="none" stroke="${dark(col, .7)}" stroke-width="${thick}" stroke-linecap="round"/>`; };
  return b(L, 1) + b(R, -1);
}

function nose(kind) {
  switch (kind) {
    case 'liten': return `<path d="M402 306 L406 320 L398 322" fill="none" ${ST('stroke-width="3.5"')} opacity=".8"/>`;
    case 'stor': return `<path d="M404 292 L414 326 L392 332 Q386 324 392 318" fill="none" ${ST('stroke-width="4.5"')} opacity=".85"/><path d="M408 326 q-4 8 -14 6" fill="none" ${ST('stroke-width="3"')} opacity=".5"/>`;
    case 'spetsig': return `<path d="M402 296 L412 326 L396 324" fill="none" ${ST('stroke-width="4"')} opacity=".85"/>`;
    case 'bred': return `<path d="M400 300 L404 318 M388 326 Q400 334 414 326" fill="none" ${ST('stroke-width="4"')} opacity=".8"/>`;
    default: return `<path d="M402 300 L408 322 L396 326" fill="none" ${ST('stroke-width="4"')} opacity=".85"/>`;
  }
}

function mouth(look, expr, talking) {
  const y = 356;
  const wide = look.mouth === 'bred' ? 1.25 : look.mouth === 'smal' ? .8 : 1;
  const w = 26 * wide;
  const lip = look.lipstick ? '#b8304a' : null;
  const full = look.mouth === 'fyllig' || look.lipstick ? `<path d="M${400 - w * .95} ${y + 3} Q400 ${y - 4} ${400 + w * .95} ${y + 3} Q400 ${y + 14} ${400 - w * .95} ${y + 3} Z" fill="${lip || dark(look.skin || '#f5cfae', .78)}" stroke="none" opacity="${lip ? .95 : .55}"/>` : '';
  if (talking || expr === 'objection' || expr === 'shocked') {
    const h = expr === 'objection' ? 34 : expr === 'shocked' ? 26 : 18;
    const ww = expr === 'objection' ? w * 1.3 : w;
    return `<path d="M${400 - ww} ${y - 2} Q400 ${y - 8} ${400 + ww} ${y - 2} Q${400 + ww * .9} ${y + h} 400 ${y + h + 6} Q${400 - ww * .9} ${y + h} ${400 - ww} ${y - 2} Z" fill="#4a1420" ${ST(lip ? `stroke="${lip}" stroke-width="7"` : '')}/>
      <path d="M${400 - ww * .8} ${y + 1} Q400 ${y + 5} ${400 + ww * .8} ${y + 1} L${400 + ww * .7} ${y + 7} Q400 ${y + 11} ${400 - ww * .7} ${y + 7} Z" fill="#fff"/>
      <ellipse cx="400" cy="${y + h - 2}" rx="${ww * .5}" ry="${h * .22}" fill="#c0384a"/>`;
  }
  switch (expr) {
    case 'angry': case 'determined': return full + `<path d="M${400 - w} ${y + 4} Q400 ${y - 4} ${400 + w} ${y + 4}" fill="none" ${ST('stroke-width="5"')}/>`;
    case 'smug': return full + `<path d="M${400 - w} ${y + 2} Q${400 + w * .3} ${y + 14} ${400 + w * 1.1} ${y - 6}" fill="none" ${ST('stroke-width="5"')}/>`;
    case 'happy': return `<path d="M${400 - w} ${y - 2} Q400 ${y + 20} ${400 + w} ${y - 2}" fill="#4a1420" ${ST(lip ? `stroke="${lip}" stroke-width="6"` : 'stroke-width="5"')}/><path d="M${400 - w * .7} ${y + 1} Q400 ${y + 7} ${400 + w * .7} ${y + 1} Z" fill="#fff"/>`;
    case 'sad': case 'nervous': return full + `<path d="M${400 - w * .8} ${y + 6} Q400 ${y - 4} ${400 + w * .8} ${y + 6}" fill="none" ${ST('stroke-width="5"')}/>`;
    case 'confident': return full + `<path d="M${400 - w} ${y} Q400 ${y + 10} ${400 + w} ${y - 2}" fill="none" ${ST('stroke-width="5"')}/>`;
    default: return full + `<path d="M${400 - w} ${y + 2} Q400 ${y + 8} ${400 + w} ${y + 2}" fill="none" ${ST('stroke-width="5"')}/>`;
  }
}

function extras(expr) {
  if (expr === 'nervous') return `<path d="M470 190 C480 205 486 214 486 222 A10 10 0 0 1 466 222 C466 214 470 205 470 190 Z" fill="#9fd8ff" ${ST('stroke-width="3"')}/>`;
  if (expr === 'angry' || expr === 'objection') return `<g fill="none" ${ST('stroke-width="4"')}><path d="M494 170 l8 -8 M504 180 l8 -8 M486 158 l8 -8"/></g>`;
  if (expr === 'shocked') return `<g fill="none" ${ST('stroke-width="4"')}><path d="M300 140 l-10 -14 M292 160 l-14 -8 M314 128 l-6 -16"/></g>`;
  return '';
}
function details(look, skin) {
  let s = '';
  if (look.freckles) { const d = dark(skin, .72); s += `<g fill="${d}" opacity=".55">${[[330, 318], [344, 328], [356, 316], [338, 338], [470, 318], [456, 328], [444, 316], [462, 338], [392, 332], [410, 334]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</g>`; }
  if (look.mole === 'vanster') s += `<circle cx="366" cy="346" r="3.5" fill="${dark(skin, .5)}"/>`;
  if (look.mole === 'hoger') s += `<circle cx="446" cy="382" r="3.5" fill="${dark(skin, .5)}"/>`;
  return s;
}
function ears(skin, look) {
  const er = look.earrings ? `<circle cx="300" cy="296" r="5" fill="#f2c14e" ${ST('stroke-width="2"')}/><circle cx="500" cy="296" r="5" fill="#f2c14e" ${ST('stroke-width="2"')}/>` : '';
  return `<ellipse cx="300" cy="272" rx="13" ry="22" fill="${skin}" ${ST()}/><ellipse cx="500" cy="272" rx="13" ry="22" fill="${skin}" ${ST()}/>
    <path d="M296 262 q-4 10 2 20" fill="none" ${ST('stroke-width="3"')} opacity=".6"/><path d="M504 262 q4 10 -2 20" fill="none" ${ST('stroke-width="3"')} opacity=".6"/>${er}`;
}

function glasses(kind) {
  if (!kind || kind === 'inga') return '';
  const col = '#2a2a2a';
  if (kind === 'runda') return `<g fill="none" stroke="${col}" stroke-width="5"><circle cx="344" cy="270" r="30"/><circle cx="456" cy="270" r="30"/><path d="M374 266 q26 -8 52 0"/><path d="M314 262 L300 256 M486 262 L500 256"/></g><g fill="#9fd8ff" opacity=".18"><circle cx="344" cy="270" r="30"/><circle cx="456" cy="270" r="30"/></g>`;
  if (kind === 'kant') return `<g fill="none" stroke="${col}" stroke-width="6"><rect x="310" y="246" width="66" height="46" rx="8"/><rect x="424" y="246" width="66" height="46" rx="8"/><path d="M376 266 q24 -8 48 0"/><path d="M310 262 L300 256 M490 262 L500 256"/></g><g fill="#9fd8ff" opacity=".15"><rect x="310" y="246" width="66" height="46" rx="8"/><rect x="424" y="246" width="66" height="46" rx="8"/></g>`;
  if (kind === 'halv') return `<g fill="none" stroke="#6b4a2a" stroke-width="4"><path d="M312 276 h64 v18 q-32 10 -64 0 Z"/><path d="M424 276 h64 v18 q-32 10 -64 0 Z"/><path d="M376 280 q24 -6 48 0"/><path d="M312 280 L300 276 M488 280 L500 276"/></g>`;
  return `<g fill="none" stroke="#8a7a50" stroke-width="3"><path d="M312 258 q32 -12 64 0 v24 q-32 12 -64 0 Z"/><path d="M424 258 q32 -12 64 0 v24 q-32 12 -64 0 Z"/><path d="M376 264 q24 -8 48 0"/><path d="M312 262 L300 256 M488 262 L500 256"/></g>`;
}

function beard(kind, col) {
  const c = dark(col, .8);
  switch (kind) {
    case 'stubb': return `<path d="M318 300 C322 360 350 400 400 410 C450 400 478 360 482 300 C470 350 445 380 400 388 C355 380 330 350 318 300 Z" fill="${c}" opacity=".25"/>`;
    case 'skagg': return `<path d="M312 290 C318 370 352 416 400 426 C448 416 482 370 488 290 C480 340 460 392 400 398 C340 392 320 340 312 290 Z" fill="${c}" ${ST()}/><path d="M372 346 Q400 338 428 346" fill="none" stroke="${c}" stroke-width="7"/>`;
    case 'langt': return `<path d="M312 290 C318 380 340 470 400 500 C460 470 482 380 488 290 C480 340 460 392 400 398 C340 392 320 340 312 290 Z" fill="${c}" ${ST()}/><path d="M372 346 Q400 338 428 346 M370 430 Q400 450 430 430" fill="none" stroke="${dark(c, .8)}" stroke-width="5"/>`;
    case 'mustasch': return `<path d="M366 340 Q384 330 400 340 Q416 330 434 340 Q424 352 400 348 Q376 352 366 340 Z" fill="${c}" ${ST('stroke-width="3"')}/>`;
    case 'getskagg': return `<path d="M378 384 Q400 420 422 384 Q412 400 400 404 Q388 400 378 384 Z" fill="${c}" ${ST('stroke-width="3"')}/><path d="M366 340 Q384 330 400 340 Q416 330 434 340 Q424 352 400 348 Q376 352 366 340 Z" fill="${c}" ${ST('stroke-width="3"')}/>`;
    default: return '';
  }
}

// ---------- HÅR ----------
// Varje stil returnerar { back, front } (bakom huvudet / framför ansiktet)
const SKULL = 'M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L504 300 L296 300 Z';
const HAIR = {
  spik(c) {
    const l = light(c, 1.3);
    return {
      back: `<path d="M300 250 L250 190 L286 196 L240 130 L300 150 L282 90 L350 120 L360 60 L410 110 L470 50 L468 118 L540 92 L512 150 L560 150 L520 190 L540 230 L500 240 L500 300 L300 300 Z" fill="${c}" ${ST()}/>
             <path d="M250 190 L286 196 L240 130 L300 150 L282 90 L350 120 L360 60 L410 110" fill="none" stroke="${l}" stroke-width="6" opacity=".35"/>`,
      front: `<path d="M298 236 C300 180 330 130 380 118 L368 150 L420 112 L418 150 L470 118 L462 160 L498 150 L500 236 L480 190 L450 210 L430 176 L394 214 L370 184 L340 212 L320 186 Z" fill="${c}" ${ST()}/>
              <path d="M330 150 Q360 128 400 122" fill="none" stroke="${l}" stroke-width="7" opacity=".4"/>`,
    };
  },
  sidbena(c) {
    const l = light(c, 1.3);
    return { back: `<path d="${SKULL}" fill="${c}" ${ST()}/>`,
      front: `<path d="M296 240 C300 170 340 118 400 116 C460 116 502 160 504 240 L492 210 C470 186 440 170 420 176 C400 182 388 200 382 216 L370 190 C350 176 326 190 312 220 Z" fill="${c}" ${ST()}/>
              <path d="M330 160 Q380 128 440 140" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>` };
  },
  mittbena(c) {
    const l = light(c, 1.3), d = dark(c);
    return { back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L508 340 L292 340 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L500 262 C494 210 470 186 440 186 C420 190 406 200 400 150 C394 200 380 190 360 186 C330 186 306 210 300 262 Z" fill="${c}" ${ST()}/>
              <path d="M400 150 L400 112" fill="none" stroke="${d}" stroke-width="4" opacity=".5"/><path d="M340 160 Q370 132 396 128 M460 160 Q430 132 404 128" fill="none" stroke="${l}" stroke-width="7" opacity=".4"/>` };
  },
  kort(c) {
    const l = light(c, 1.3);
    return { back: `<path d="M298 246 C292 176 334 112 400 110 C466 112 508 176 502 246 L502 280 L298 280 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M298 236 C300 180 340 124 400 120 C460 124 500 180 502 236 L486 204 C470 188 452 182 436 190 L420 170 L404 192 L380 170 L366 194 C348 186 330 196 314 216 Z" fill="${c}" ${ST()}/>
              <path d="M340 150 Q400 126 460 150" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>` };
  },
  rakad(c) {
    return { back: '', front: `<path d="M304 236 C306 170 346 118 400 116 C454 118 494 170 496 236 L496 250 L304 250 Z" fill="${c}" opacity=".55" stroke="none"/><path d="M304 236 C306 170 346 118 400 116 C454 118 494 170 496 236" fill="none" ${ST('stroke-width="4"')} opacity=".6"/>` };
  },
  hjalm(c) {
    const l = light(c, 1.3);
    return { back: `<path d="M292 250 C284 160 330 100 400 98 C470 100 516 160 508 250 L512 310 L288 310 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M292 240 C296 160 344 108 400 106 C456 108 504 160 508 240 L500 250 C494 212 478 190 452 190 C420 192 380 206 350 206 C326 206 306 220 300 250 Z" fill="${c}" ${ST()}/>
              <path d="M330 170 Q390 130 460 150" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>` };
  },
  slick(c) {
    const l = light(c, 1.35);
    return { back: `<path d="${SKULL}" fill="${c}" ${ST()}/>`,
      front: `<path d="M296 236 C300 160 346 110 400 108 C454 110 500 160 504 236 L496 214 C480 170 440 150 400 150 C360 150 320 170 304 214 Z" fill="${c}" ${ST()}/>
              <g fill="none" stroke="${l}" stroke-width="5" opacity=".45"><path d="M330 170 Q400 130 470 170"/><path d="M345 150 Q400 120 455 150"/></g>` };
  },
  lang(c) {
    const l = light(c, 1.3);
    return { back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L530 560 C500 580 460 590 400 590 C340 590 300 580 270 560 Z" fill="${c}" ${ST()}/>
             <path d="M320 300 Q310 440 300 540 M480 300 Q490 440 500 540" fill="none" stroke="${dark(c)}" stroke-width="6" opacity=".5"/>`,
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L494 212 C476 180 450 166 426 174 L408 196 L392 170 C364 166 334 180 316 216 Z" fill="${c}" ${ST()}/>
              <path d="M340 160 Q400 126 460 150" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>` };
  },
  axellangt(c) {
    const l = light(c, 1.3), d = dark(c);
    return { back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 C520 330 530 400 510 470 C490 490 470 480 460 470 L340 470 C330 480 310 490 290 470 C270 400 280 330 296 250 Z" fill="${c}" ${ST()}/>
             <g fill="none" stroke="${d}" stroke-width="5" opacity=".45"><path d="M314 300 q-14 60 -4 120 M486 300 q14 60 4 120 M330 360 q-8 40 2 80 M470 360 q8 40 -2 80"/></g>`,
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L498 250 C484 206 460 190 436 196 L416 210 L396 184 C366 176 334 190 312 230 L300 252 Z" fill="${c}" ${ST()}/>
              <path d="M340 160 Q400 126 460 150" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>` };
  },
  lugg(c) {
    const l = light(c, 1.3), d = dark(c);
    return { back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L516 430 C480 448 440 452 400 452 C360 452 320 448 284 430 Z" fill="${c}" ${ST()}/>
             <g fill="none" stroke="${d}" stroke-width="5" opacity=".4"><path d="M312 300 q-6 60 -8 110 M488 300 q6 60 8 110"/></g>`,
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L504 250 L492 252 L484 240 L472 254 L458 240 L444 254 L430 240 L416 254 L400 240 L384 254 L370 240 L356 254 L342 240 L328 254 L316 240 L308 252 L296 250 Z" fill="${c}" ${ST()}/>
              <path d="M330 170 Q400 128 470 160" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>` };
  },
  bob(c) {
    const l = light(c, 1.3), d = dark(c);
    return { back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L516 400 C490 418 440 426 400 426 C360 426 310 418 284 400 Z" fill="${c}" ${ST()}/>
             <g fill="none" stroke="${d}" stroke-width="5" opacity=".4"><path d="M312 300 q-4 50 -8 94 M488 300 q4 50 8 94 M330 340 q-2 40 -6 66"/></g>`,
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L500 260 C488 210 460 186 430 188 L416 208 L396 184 C360 176 330 194 312 236 L300 262 Z" fill="${c}" ${ST()}/>
              <path d="M330 170 Q400 128 470 160" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>` };
  },
  knut(c) {
    const l = light(c, 1.3);
    return { back: `<circle cx="400" cy="112" r="40" fill="${c}" ${ST()}/><path d="${SKULL}" fill="${c}" ${ST()}/>`,
      front: `<path d="M296 236 C300 160 346 112 400 110 C454 112 500 160 504 236 L496 220 C486 178 450 158 400 156 C350 158 316 178 304 220 Z" fill="${c}" ${ST()}/>
              <path d="M340 180 Q400 150 460 180 M372 158 L380 206" fill="none" stroke="${l}" stroke-width="5" opacity=".45"/>` };
  },
  lockigt(c) {
    const l = light(c, 1.3), d = dark(c);
    const edge = [[292, 290], [286, 318], [288, 346], [298, 372], [318, 390], [344, 398], [456, 398], [482, 390], [502, 372], [512, 346], [514, 318], [508, 290]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="18" fill="${c}" ${ST()}/>`).join('');
    return { back: edge + `<path d="M288 250 C276 160 322 96 400 94 C478 96 524 160 512 250 L512 340 C500 372 470 388 400 388 C330 388 300 372 288 340 Z" fill="${c}" ${ST()}/>
             <g fill="none" stroke="${d}" stroke-width="4" opacity=".45"><path d="M320 300 q-10 24 4 46 M480 300 q10 24 -4 46 M300 250 q-8 20 2 40"/></g>`,
      front: `<path d="M296 236 C300 160 346 112 400 110 C454 112 500 160 504 236 L492 222 C474 200 452 204 440 220 L412 196 L388 220 C372 204 344 200 322 224 L308 240 Z" fill="${c}" ${ST()}/>
              <g fill="none" stroke="${d}" stroke-width="4" opacity=".45"><path d="M330 214 q-8 -14 6 -22 M352 196 q-6 -16 10 -20 M384 190 q-2 -18 14 -16 M420 190 q4 -18 -12 -16 M452 198 q8 -14 -8 -20 M474 218 q10 -12 -4 -22 M344 150 q6 -14 20 -8 M396 134 q10 -10 22 0 M444 150 q-6 -14 -20 -8"/></g>
              <path d="M360 140 Q400 124 440 140" fill="none" stroke="${l}" stroke-width="6" opacity=".4"/>` };
  },
  afro(c) {
    const d = dark(c), l = light(c, 1.25);
    // tät rundad hårmassa: ellips med små bucklor längs kanten (inte en ring utanför huvudet)
    const bumps = Array.from({ length: 16 }, (_, i) => { const a = Math.PI * 1.08 + (i / 15) * Math.PI * .84; return `<circle cx="${(400 + Math.cos(a) * 128).toFixed(0)}" cy="${(222 + Math.sin(a) * 118).toFixed(0)}" r="22" fill="${c}" ${ST()}/>`; }).join('');
    return { back: bumps + `<ellipse cx="400" cy="222" rx="130" ry="120" fill="${c}" ${ST()}/><g fill="none" stroke="${d}" stroke-width="4" opacity=".4"><path d="M320 190 q8 -30 30 -44 M480 190 q-8 -30 -30 -44 M350 120 q25 -16 60 -14 M300 260 q-4 30 10 50 M500 260 q4 30 -10 50"/></g>`,
      front: `<path d="M296 236 C300 164 346 114 400 112 C454 114 500 164 504 236 L498 236 C490 206 466 190 436 192 L420 200 L400 186 L380 200 L364 192 C334 190 310 206 302 236 Z" fill="${c}" ${ST()}/><g fill="none" stroke="${d}" stroke-width="4" opacity=".45"><path d="M330 212 q-6 -12 6 -18 M360 196 q-4 -14 10 -16 M440 196 q4 -14 -10 -16 M470 212 q6 -12 -6 -18"/></g><path d="M350 150 Q400 130 450 150" fill="none" stroke="${l}" stroke-width="6" opacity=".35"/>` };
  },
  flator(c) {
    const d = dark(c);
    const braid = (x) => `<path d="M${x} 300 C${x - 10} 360 ${x + 10} 420 ${x} 480 C${x - 10} 540 ${x + 10} 600 ${x} 660" fill="none" stroke="${OUT}" stroke-width="40" stroke-linecap="round"/><path d="M${x} 300 C${x - 10} 360 ${x + 10} 420 ${x} 480 C${x - 10} 540 ${x + 10} 600 ${x} 660" fill="none" stroke="${c}" stroke-width="32" stroke-linecap="round"/>${[340, 380, 420, 460, 500, 540, 580, 620].map((y) => `<path d="M${x - 14} ${y} q14 10 28 0" fill="none" stroke="${d}" stroke-width="4" opacity=".6"/>`).join('')}`;
    return { back: `<path d="${SKULL}" fill="${c}" ${ST()}/>` + braid(314) + braid(486),
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L500 258 C492 210 466 190 440 192 L418 210 L400 186 L382 210 L360 192 C334 190 308 210 300 258 Z" fill="${c}" ${ST()}/><path d="M400 110 L400 186" fill="none" stroke="${d}" stroke-width="4" opacity=".5"/>` };
  },
  flint() { return { back: '', front: `<path d="M330 150 Q400 118 470 150" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="8" stroke-linecap="round"/>` }; },
  page(c) {
    const l = light(c, 1.3), d = dark(c);
    return { back: `<path d="M296 250 C288 170 330 104 400 102 C470 104 512 170 504 250 L512 360 C480 372 440 376 400 376 C360 376 320 372 288 360 Z" fill="${c}" ${ST()}/>
             <g fill="none" stroke="${d}" stroke-width="5" opacity=".4"><path d="M310 290 q-2 40 -6 70 M490 290 q2 40 6 70"/></g>`,
      front: `<path d="M296 240 C300 166 346 112 400 110 C454 112 500 166 504 240 L500 250 L300 250 Z" fill="${c}" ${ST()}/><path d="M304 246 L496 246 L494 236 L306 236 Z" fill="${dark(c)}" opacity=".3"/>
              <path d="M330 170 Q400 128 470 160" fill="none" stroke="${l}" stroke-width="8" opacity=".4"/>` };
  },
  tofs(c) {
    const l = light(c, 1.3);
    return { back: `<path d="${SKULL}" fill="${c}" ${ST()}/><path d="M490 200 C560 240 560 380 520 470 L496 460 C520 390 520 280 480 230 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M296 236 C300 160 346 112 400 110 C454 112 500 160 504 236 L496 214 C480 170 440 160 400 162 C360 160 320 170 304 214 Z M376 160 L360 212 L394 176 Z" fill="${c}" ${ST()}/>
              <path d="M340 176 Q400 146 460 176" fill="none" stroke="${l}" stroke-width="5" opacity=".45"/>` };
  },
  tunn(c) {
    return { back: `<path d="M298 250 C294 190 318 140 350 122 L300 300 Z M502 250 C506 190 482 140 450 122 L500 300 Z" fill="${c}" ${ST()}/>`,
      front: `<path d="M302 236 C306 200 322 160 352 136 L330 220 L316 236 Z M498 236 C494 200 478 160 448 136 L470 220 L484 236 Z" fill="${c}" ${ST()}/>
              <path d="M360 140 Q400 124 440 140" fill="none" stroke="${c}" stroke-width="5" opacity=".5"/>` };
  },
};

// ---------- KROPP & KLÄDER ----------
function outfitOf(look) { return OUTFIT_BY_ID[look.outfit] || OUTFITS[0]; }
const colorsOf = (look) => { const o = outfitOf(look); return { ...o, jacket: o.jacket ? (look.jacketColor || o.jacket) : null, shirt: o.shirt ? (look.shirtColor || o.shirt) : (o.kind === 'knit' || o.kind === 'dress' || o.kind === 'hoodie' ? null : o.shirt), tie: o.tie ? (look.tieColor || o.tie) : null }; };

const BODY_PATH = 'M400 460 L330 434 C236 452 186 530 180 650 L172 900 L628 900 L620 650 C614 530 564 452 470 434 Z';
const shirtV = (shirt) => `<path d="M352 436 L400 470 L448 436 L440 420 L400 448 L360 420 Z" fill="${shirt}" ${ST()}/>`;
const collarShirt = (shirt) => `<path d="M360 418 L400 452 L440 418 L452 442 L400 478 L348 442 Z" fill="${shirt}" ${ST()}/>`;
const tie = (col) => `<path d="M388 462 L412 462 L404 486 L420 600 L400 640 L380 600 L396 486 Z" fill="${col}" ${ST()}/><path d="M396 486 L380 600 L400 640 L402 600 Z" fill="${dark(col, .7)}" stroke="none" opacity=".6"/>`;
const lapels = (jl, jd) => `<path d="M330 434 L400 640 L350 486 Q324 450 330 434 Z" fill="${jl}" ${ST()}/><path d="M470 434 L400 640 L450 486 Q476 450 470 434 Z" fill="${jl}" ${ST()}/><path d="M330 434 L400 640 L350 486 Q324 450 330 434 Z" fill="${jd}" opacity=".35" stroke="none"/>`;
const sideShadow = (jd) => `<path d="M330 434 C236 452 186 530 180 650 L172 900 L260 900 L262 660 C266 560 290 490 340 450 Z" fill="${jd}" opacity=".5" stroke="none"/>`;
const highlight = (jl) => `<path d="M560 480 C598 540 614 600 618 680" fill="none" stroke="${jl}" stroke-width="8" opacity=".35"/>`;

function torso(look, skin) {
  const o = colorsOf(look);
  const J = o.jacket, S = o.shirt, T = o.tie;
  const jd = J ? dark(J, .78) : null, jl = J ? light(J, 1.12) : null;
  const base = (col) => `<path d="${BODY_PATH}" fill="${col}" ${ST()}/>`;
  switch (o.kind) {
    case 'suit': case 'bowtie': case 'vest':
      return base(J) + sideShadow(jd) + highlight(jl) + shirtV(S) + `<path d="M360 440 L400 650 L440 440 L400 470 Z" fill="${S}" stroke="none"/>`
        + (o.kind === 'bowtie' ? `<path d="M372 452 L398 466 L372 480 Z M428 452 L402 466 L428 480 Z" fill="${T}" ${ST('stroke-width="3"')}/><circle cx="400" cy="466" r="7" fill="${dark(T, .7)}" ${ST('stroke-width="3"')}/>` : T ? tie(T) : '')
        + (o.kind === 'vest' ? `<path d="M330 434 L400 640 L350 486 Q324 450 330 434 Z M470 434 L400 640 L450 486 Q476 450 470 434 Z" fill="${S}" ${ST()}/><path d="M340 470 C300 560 300 760 330 900 L470 900 C500 760 500 560 460 470 L400 650 Z" fill="${J}" ${ST()}/><circle cx="400" cy="700" r="6" fill="${jd}"/><circle cx="400" cy="760" r="6" fill="${jd}"/>` : lapels(jl, jd) + `<circle cx="400" cy="660" r="7" fill="${jd}" ${ST('stroke-width="3"')}/>`);
    case 'cravat':
      return base(J) + sideShadow(jd) + highlight(jl) + shirtV(S) + `<path d="M372 450 Q400 480 428 450 L432 520 Q400 560 368 520 Z" fill="#f4f0ea" ${ST()}/><path d="M380 470 Q400 490 420 470 M376 500 Q400 522 424 500" fill="none" stroke="#cfc8bb" stroke-width="3"/>` + lapels(jl, jd);
    case 'blazer': // öppen skjorta/blus under
      return base(J) + sideShadow(jd) + highlight(jl) + `<path d="M360 440 L400 650 L440 440 L400 470 Z" fill="${S}" stroke="none"/>` + collarShirt(S) + lapels(jl, jd);
    case 'blazer_tee':
      return base(J) + sideShadow(jd) + highlight(jl) + `<path d="M352 440 Q400 500 448 440 L440 420 Q400 466 360 420 Z" fill="${S}" ${ST()}/><path d="M362 440 L400 650 L438 440 Q400 480 362 440 Z" fill="${S}" stroke="none"/>` + lapels(jl, jd);
    case 'polo':
      return base(J) + sideShadow(jd) + highlight(jl) + `<path d="M352 440 C352 480 376 520 400 640 C424 520 448 480 448 440 Z" fill="${S}" ${ST()}/><path d="M362 418 Q400 440 438 418 L446 440 Q400 466 354 440 Z" fill="${dark(S, .9)}" ${ST()}/>` + lapels(jl, jd);
    case 'cardigan':
      return base(J) + sideShadow(jd) + `<path d="M350 440 L400 660 L450 440 L440 420 L400 448 L360 420 Z" fill="${S}" ${ST()}/><path d="M340 434 L400 900 M460 434 L400 900" fill="none" stroke="${jd}" stroke-width="6" opacity=".6"/>` + collarShirt(S) + `<path d="M330 434 Q330 520 360 600 L400 660 L440 600 Q470 520 470 434" fill="none" ${ST()}/>${[700, 760, 820].map((y) => `<circle cx="400" cy="${y}" r="7" fill="${jd}" ${ST('stroke-width="3"')}/>`).join('')}<path d="M300 520 q-30 100 -20 240 M500 520 q30 100 20 240" fill="none" stroke="${jd}" stroke-width="5" opacity=".4"/>`;
    case 'knit': {
      const K = J;
      return base(K) + sideShadow(dark(K, .78)) + `<path d="M352 440 Q400 492 448 440 L442 424 Q400 468 358 424 Z" fill="${dark(K, .85)}" ${ST()}/><g stroke="${dark(K, .82)}" stroke-width="4" opacity=".5" fill="none">${[520, 580, 640, 700, 760, 820].map((y) => `<path d="M240 ${y} q40 -10 80 0 t80 0 t80 0 t80 0"/>`).join('')}</g>`;
    }
    case 'sweater_collar':
      return base(J) + sideShadow(jd) + `<path d="M352 440 Q400 492 448 440 L442 424 Q400 468 358 424 Z" fill="${dark(J, .85)}" ${ST()}/>` + collarShirt(S) + `<path d="M382 448 L400 470 L418 448" fill="${S}" ${ST('stroke-width="3"')}/><g stroke="${jd}" stroke-width="3" opacity=".35" fill="none">${[560, 640, 720, 800].map((y) => `<path d="M250 ${y} h300"/>`).join('')}</g>`;
    case 'shirt': case 'shirt_tie': case 'plaid': {
      const base2 = base(S) + `<path d="M330 436 C300 480 320 560 400 600 C480 560 500 480 470 436 L446 460 L400 520 L354 460 Z" fill="${dark(S, .9)}" stroke="none"/>` + collarShirt(S) + `<path d="M400 470 L392 900 M400 470 L408 900" stroke="${dark(S, .8)}" stroke-width="2"/>${[560, 640, 720, 800].map((y) => `<circle cx="400" cy="${y}" r="5" fill="${dark(S, .75)}"/>`).join('')}<path d="M190 620 C200 560 230 500 300 470" fill="none" stroke="${dark(S, .85)}" stroke-width="6" opacity=".5"/>`;
      const plaid = o.kind === 'plaid' ? `<g stroke="${dark(S, .6)}" stroke-width="7" opacity=".45" fill="none">${[230, 300, 370, 440, 510, 580].map((x) => `<path d="M${x} 470 L${x - 10} 900"/>`).join('')}${[520, 600, 680, 760, 840].map((y) => `<path d="M180 ${y} h440"/>`).join('')}</g>` : '';
      const pocket = `<path d="M470 560 h60 v60 h-60 z" fill="none" stroke="${dark(S, .75)}" stroke-width="3"/>`;
      return base2 + plaid + pocket + (o.kind === 'shirt_tie' ? tie(T) : '');
    }
    case 'blouse':
      return base(S) + `<path d="M330 436 C300 480 320 560 400 600 C480 560 500 480 470 436 L446 460 L400 520 L354 460 Z" fill="${dark(S, .92)}" stroke="none"/><path d="M360 418 L400 452 L440 418 L456 446 L400 486 L344 446 Z" fill="${S}" ${ST()}/><path d="M370 480 Q400 500 430 480 L440 530 Q400 560 360 530 Z M384 470 L380 520 M416 470 L420 520" fill="${dark(S, .85)}" ${ST('stroke-width="3"')}/><path d="M200 600 C210 540 240 500 300 470 M600 600 C590 540 560 500 500 470" fill="none" stroke="${dark(S, .85)}" stroke-width="6" opacity=".5"/>`;
    case 'dress': {
      const D = J;
      return base(D) + sideShadow(dark(D, .78)) + `<path d="M340 436 Q400 500 460 436 L450 420 Q400 470 350 420 Z" fill="${skin}" ${ST('stroke-width="4"')}/><path d="M300 470 L280 900 M500 470 L520 900" fill="none" stroke="${dark(D, .8)}" stroke-width="5" opacity=".5"/><ellipse cx="400" cy="620" rx="90" ry="12" fill="${dark(D, .8)}" opacity=".4"/>`;
    }
    case 'hoodie': {
      const H = J;
      return `<path d="M320 400 C300 430 300 470 330 500 L470 500 C500 470 500 430 480 400 Z" fill="${dark(H, .8)}" ${ST()}/>` + base(H) + sideShadow(dark(H, .78)) + `<path d="M340 436 Q400 520 460 436" fill="none" ${ST('stroke-width="6"')}/><path d="M348 436 C330 470 330 520 350 560 L400 520 L450 560 C470 520 470 470 452 436 Q400 500 348 436 Z" fill="${dark(H, .72)}" ${ST()}/><path d="M384 520 L376 640 M416 520 L424 640" fill="none" stroke="#e8e8e8" stroke-width="6"/><path d="M300 720 h200 v100 h-200 z" fill="none" stroke="${dark(H, .8)}" stroke-width="4" opacity=".6"/>`;
    }
    case 'outdoor': {
      return base(J) + sideShadow(jd) + `<path d="M352 440 L400 470 L448 440 L440 420 L400 448 L360 420 Z" fill="${S}" ${ST()}/><path d="M330 434 L350 470 L400 500 L450 470 L470 434 L450 424 L400 470 L350 424 Z" fill="${dark(J, .85)}" ${ST()}/><path d="M400 500 L400 900" stroke="${OUT}" stroke-width="7"/><path d="M400 500 L400 900" stroke="#9aa3ad" stroke-width="4"/>${[560, 640, 720].map((y) => `<path d="M394 ${y} h12" stroke="#d0d6dc" stroke-width="3"/>`).join('')}<path d="M250 560 h80 v70 h-80 z M470 560 h80 v70 h-80 z" fill="${dark(J, .85)}" ${ST('stroke-width="3"')}/><path d="M250 560 h80 M470 560 h80" stroke="#9aa3ad" stroke-width="4"/>`;
    }
    case 'tee':
      return base(S) + `<path d="M352 440 Q400 500 448 440 L440 420 Q400 466 360 420 Z" fill="${dark(S, .85)}" ${ST()}/><path d="M190 620 C200 560 230 500 300 470 M610 620 C600 560 570 500 500 470" fill="none" stroke="${dark(S, .85)}" stroke-width="6" opacity=".5"/>`;
    default:
      return base(J || S || '#555') + shirtV(S || '#fff');
  }
}

// Ärmar och händer – i "armlokala" koordinater (+x = utmed armen mot handen, a = armens vinkel)
const sleeveColor = (look) => { const o = colorsOf(look); return o.kind === 'vest' ? o.shirt : (o.jacket || o.shirt || '#555'); };
const armSleeve = (pts, look, far = false) => {
  const col = sleeveColor(look); const c = far ? dark(col, .85) : col;
  return `<path d="${pts}" fill="none" stroke="${OUT}" stroke-width="${84 + SW * 2}" stroke-linecap="round" stroke-linejoin="round"/><path d="${pts}" fill="none" stroke="${c}" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const at = (x, y, a, inner) => `<g transform="translate(${x} ${y}) rotate(${a})">${inner}</g>`;
const cuff = (x, y, a, look) => { const o = colorsOf(look); return o.jacket && o.shirt && !['knit', 'hoodie', 'outdoor', 'dress', 'cardigan', 'sweater_collar'].includes(o.kind) ? at(x, y, a, `<rect x="-12" y="-46" width="24" height="92" rx="5" fill="${o.shirt}" ${ST('stroke-width="4"')}/>`) : ['shirt', 'shirt_tie', 'plaid'].includes(o.kind) ? at(x - 30, y, a, `<rect x="-14" y="-48" width="28" height="96" rx="6" fill="${dark(o.shirt, .9)}" ${ST('stroke-width="4"')}/>`) : ''; };
const knuckles = `<path d="M6 -14 h36 M6 2 h38 M6 18 h34" fill="none" ${ST('stroke-width="3"')} opacity=".5"/>`;
function handPoint(x, y, a, skin) { return at(x, y, a, `<rect x="-18" y="-36" width="78" height="72" rx="26" fill="${skin}" ${ST()}/><rect x="42" y="-15" width="104" height="30" rx="15" fill="${skin}" ${ST()}/><path d="M0 -34 q22 -30 48 -16 q-4 18 -26 22" fill="${skin}" ${ST('stroke-width="4"')}/><path d="M42 -2 q10 6 22 2" fill="none" ${ST('stroke-width="3"')} opacity=".5"/>${knuckles}`); }
function handFist(x, y, a, skin) { return at(x, y, a, `<rect x="-36" y="-32" width="78" height="64" rx="24" fill="${skin}" ${ST()}/><path d="M-10 -34 q20 -22 44 -10 q-6 16 -26 18" fill="${skin}" ${ST('stroke-width="4"')}/>${knuckles}`); }
function handFlat(x, y, a, skin) { return at(x, y, a, `<rect x="-30" y="-28" width="98" height="56" rx="22" fill="${skin}" ${ST()}/><path d="M24 -26 v52 M44 -26 v52" fill="none" ${ST('stroke-width="3"')} opacity=".5"/><path d="M-20 -28 q10 -14 30 -8" fill="none" ${ST('stroke-width="3"')} opacity=".5"/>`); }
function handOpen(x, y, a, skin) { const f = (ang, len) => `<rect x="20" y="-13" width="${len}" height="26" rx="13" fill="${skin}" ${ST()} transform="rotate(${ang})"/>`; return at(x, y, a, `${f(-38, 62)}${f(-12, 72)}${f(12, 70)}${f(36, 58)}<ellipse cx="4" cy="2" rx="40" ry="36" fill="${skin}" ${ST()}/><rect x="-10" y="-14" width="26" height="56" rx="13" fill="${skin}" ${ST()} transform="rotate(-72)"/>`); }

function pose(kind, look, skin) {
  switch (kind) {
    case 'point': return { behind: armSleeve('M292 500 L250 600 L262 720', look, true) + handFist(262, 740, 90, skin), front: armSleeve('M520 496 L610 436 L690 384', look) + cuff(690, 384, -33, look) + handPoint(704, 375, -33, skin) };
    case 'cross': return { behind: '', front: armSleeve('M292 500 L262 610 L450 636', look, true) + handFlat(486, 640, 6, skin) + armSleeve('M508 500 L538 610 L350 636', look) + cuff(350, 636, 186, look) + handFlat(318, 642, 186, skin) };
    case 'slam': return { behind: '', front: armSleeve('M292 500 L250 650 L300 840', look, true) + armSleeve('M508 500 L550 650 L500 840', look) + cuff(300, 840, 75, look) + handFlat(312, 870, 75, skin) + cuff(500, 840, 105, look) + handFlat(488, 870, 105, skin) };
    case 'think': return { behind: armSleeve('M508 500 L560 620 L540 760', look, true), front: armSleeve('M292 500 L262 640 L372 436', look) + cuff(372, 436, -62, look) + handFist(382, 416, -62, skin) };
    case 'open': return { behind: armSleeve('M292 500 L250 620 L262 760', look, true), front: armSleeve('M508 500 L600 600 L690 560', look) + cuff(690, 560, -24, look) + handOpen(712, 550, -24, skin) };
    case 'hips': return { behind: '', front: armSleeve('M292 500 L236 640 L290 760', look, true) + armSleeve('M508 500 L564 640 L510 760', look) + cuff(290, 760, 66, look) + handFist(300, 782, 66, skin) + cuff(510, 760, 114, look) + handFist(500, 782, 114, skin) };
    default: return { behind: '', front: armSleeve('M292 500 L252 640 L246 800', look, true) + armSleeve('M508 500 L548 640 L554 800', look) };
  }
}
const BODY_SCALE = { smal: .9, normal: 1, kraftig: 1.12, bred: 1.22 };

// ---------- HELA FIGUREN ----------
export function characterSVG(person, { pose: poseKind = 'stand', expr = 'neutral', talking = false, width = 400, height = 450, crop = 'bust', id = 'c' } = {}) {
  const look = fixLook({ ...(person.look || {}) });
  const skin = look.skin || '#f5cfae';
  const hairC = look.hairColor || '#2b2b2b';
  const hair = (HAIR[look.hair] || HAIR.kort)(hairC);
  const P = pose(poseKind, look, skin);
  const view = crop === 'face' ? '270 90 260 340' : crop === 'head' ? '240 60 320 420' : '0 0 800 900';
  const age = person.age || 45;
  const grey = age >= 62 && !/^#(7a7a7a|b5b5b5|e6e6e6)/.test(hairC) ? `<path d="M310 200 Q330 150 370 130" fill="none" stroke="#e8e8e8" stroke-width="6" opacity=".5"/><path d="M490 200 Q470 150 430 130" fill="none" stroke="#e8e8e8" stroke-width="6" opacity=".5"/>` : '';
  const wrinkles = age >= 55 ? `<g fill="none" ${ST('stroke-width="3"')} opacity=".35"><path d="M318 316 q8 10 2 24 M482 316 q-8 10 -2 24 M372 390 q28 10 56 0"/>${age >= 65 ? '<path d="M330 296 q10 6 24 4 M470 296 q-10 6 -24 4 M340 236 q60 -14 120 0"/>' : ''}</g>` : age >= 45 ? `<g fill="none" ${ST('stroke-width="2.5"')} opacity=".22"><path d="M330 296 q10 6 24 4 M470 296 q-10 6 -24 4"/></g>` : '';
  const bs = BODY_SCALE[look.body] || 1;
  const bodyT = bs !== 1 ? `transform="translate(400 0) scale(${bs} 1) translate(-400 0)"` : '';
  const neckW = bs > 1.1 ? 8 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="${width}" height="${height}" class="aa-char" data-expr="${expr}" data-pose="${poseKind}">
    <defs><clipPath id="${id}face"><path d="${facePath(look.face)}"/></clipPath></defs>
    ${hair.back}
    <g ${bodyT}>${P.behind}${torso(look, skin)}</g>
    <path d="M${372 - neckW} 380 L${372 - neckW} 470 L${428 + neckW} 470 L${428 + neckW} 380 Z" fill="${skin}" ${ST()}/>
    <path d="M${372 - neckW} 384 L${372 - neckW} 420 Q400 440 ${428 + neckW} 420 L${428 + neckW} 384 Z" fill="${dark(skin, .78)}" stroke="none"/>
    ${ears(skin, look)}
    <path d="${facePath(look.face)}" fill="${skin}" ${ST()}/>
    <g clip-path="url(#${id}face)">
      <path d="${faceShadowPath(look.face)}" fill="${dark(skin, .82)}" opacity=".7"/>
      <ellipse cx="340" cy="320" rx="26" ry="14" fill="#f08a8a" opacity=".22"/><ellipse cx="460" cy="320" rx="26" ry="14" fill="#f08a8a" opacity=".22"/>
      ${wrinkles}${details(look, skin)}
    </g>
    ${beard(look.beard, hairC)}
    ${brows(look, expr)}
    ${eyes(look, expr, id)}
    ${nose(look.nose)}
    ${mouth(look, expr, talking)}
    ${hair.front}
    ${grey}
    ${glasses(look.glasses)}
    ${extras(expr)}
    <g ${bodyT}>${P.front}</g>
  </svg>`;
}

export const EXPRESSIONS = ['neutral', 'determined', 'confident', 'angry', 'objection', 'shocked', 'smug', 'happy', 'sad', 'nervous'];
export const POSES = ['stand', 'point', 'cross', 'slam', 'think', 'open', 'hips'];
