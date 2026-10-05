// Partilogotyper som SVG. shape + glyph (förkortning) + färger.
import { esc } from '../core/util.js';

const SHAPES = {
  rose: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M50 72c-14-6-20-18-14-28 6-8 18-6 20 4 2-10 14-12 20-4 6 10 0 22-14 28" /><path d="M50 72c0-10 4-18 10-26M50 72c0-10-4-18-10-26"/></g>`,
  flower: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c2}"/><g fill="${c}"><ellipse cx="50" cy="30" rx="10" ry="16"/><ellipse cx="50" cy="70" rx="10" ry="16"/><ellipse cx="30" cy="50" rx="16" ry="10"/><ellipse cx="70" cy="50" rx="16" ry="10"/><ellipse cx="36" cy="36" rx="10" ry="14" transform="rotate(-45 36 36)"/><ellipse cx="64" cy="36" rx="10" ry="14" transform="rotate(45 64 36)"/><ellipse cx="36" cy="64" rx="10" ry="14" transform="rotate(45 36 64)"/><ellipse cx="64" cy="64" rx="10" ry="14" transform="rotate(-45 64 64)"/></g><circle cx="50" cy="50" r="9" fill="#fff"/>`,
  leaf: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><path d="M30 70C30 40 50 25 74 24c2 24-10 46-40 48z" fill="#fff"/><path d="M34 68c10-14 22-26 36-38" stroke="${c}" stroke-width="3" fill="none"/>`,
  heart: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><path d="M50 76C30 60 20 50 20 38a14 14 0 0 1 30-6 14 14 0 0 1 30 6c0 12-10 22-30 38z" fill="#fff"/>`,
  star: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><path d="M50 18l9 22 24 2-18 16 6 23-21-13-21 13 6-23-18-16 24-2z" fill="#fff"/>`,
  shield: (c, c2) => `<path d="M50 6l38 12v28c0 22-16 40-38 50C28 86 12 68 12 46V18z" fill="${c}"/><path d="M50 16l28 9v21c0 17-12 30-28 38C34 76 22 63 22 46V25z" fill="${c2}" opacity=".6"/>`,
  circle: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><circle cx="50" cy="50" r="34" fill="none" stroke="#fff" stroke-width="5"/>`,
  torch: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><path d="M44 54h12l-3 30h-6z" fill="#fff"/><path d="M50 18c10 10 16 18 12 30-3 8-10 10-12 10s-9-2-12-10c-4-12 2-20 12-30z" fill="${c2}"/><path d="M50 32c5 6 7 10 5 16-1 4-4 5-5 5s-4-1-5-5c-2-6 0-10 5-16z" fill="#fff"/>`,
  tree: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><path d="M50 16l18 24h-10l14 18H60l14 18H26l14-18H28l14-18H32z" fill="#fff"/><rect x="45" y="74" width="10" height="12" fill="#fff"/>`,
  wave: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><path d="M14 56c12-12 24-12 36 0s24 12 36 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M14 40c12-12 24-12 36 0s24 12 36 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".6"/>`,
  hex: (c, c2) => `<path d="M50 4l40 23v46L50 96 10 73V27z" fill="${c}"/><path d="M50 22l25 14v28L50 78 25 64V36z" fill="none" stroke="#fff" stroke-width="5"/>`,
  bolt: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><path d="M56 14L30 54h18l-8 32 30-42H52z" fill="#fff"/>`,
  m: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/>`,
  v: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/>`,
  l: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/>`,
  dandelion: (c, c2) => `<circle cx="50" cy="50" r="46" fill="${c}"/><g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M50 50V84"/><path d="M50 50l-18-18M50 50l18-18M50 50V26M50 50l-24-6M50 50l24-6M50 50l-14-22M50 50l14-22"/></g><g fill="#fff"><circle cx="32" cy="32" r="4"/><circle cx="68" cy="32" r="4"/><circle cx="50" cy="26" r="4"/><circle cx="26" cy="44" r="4"/><circle cx="74" cy="44" r="4"/><circle cx="36" cy="28" r="3"/><circle cx="64" cy="28" r="3"/></g>`,
};
const TEXT_ONLY = new Set(['m', 'v', 'l', 'circle', 'shield', 'hex']);

// Egen logotypbild från mobilen eller datorn: skalas till 160×160 (täckande, centrerad) och sparas som data-URL i sparfilen.
export function imageToLogo(file, size = 160) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Välj en bildfil.'));
    const url = URL.createObjectURL(file); const im = new Image();
    im.onload = () => { try { const c = document.createElement('canvas'); c.width = size; c.height = size; const g = c.getContext('2d'); const s = Math.max(size / im.naturalWidth, size / im.naturalHeight); const w = im.naturalWidth * s, h = im.naturalHeight * s; g.drawImage(im, (size - w) / 2, (size - h) / 2, w, h); let out = c.toDataURL('image/webp', .85); if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png'); if (out.length > 120000) out = c.toDataURL('image/jpeg', .8); URL.revokeObjectURL(url); resolve(out); } catch (e) { reject(e); } };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bilden kunde inte läsas.')); };
    im.src = url;
  });
}

let LOGO_N = 0;
export function logoSVG(party, size = 64) {
  if (party.logoImage) { const id = 'lc' + (++LOGO_N); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="48"/></clipPath></defs><circle cx="50" cy="50" r="48" fill="${esc(party.color || '#fff')}"/><image href="${party.logoImage}" x="2" y="2" width="96" height="96" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/></svg>`; }
  const { shape = 'circle', glyph = party.abbr } = party.logo || {};
  const draw = SHAPES[shape] || SHAPES.circle;
  const fs = glyph.length > 2 ? 30 : glyph.length === 2 ? 38 : 50;
  const text = TEXT_ONLY.has(shape) ? `<text x="50" y="${50 + fs * .36}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="${fs}" fill="#fff">${esc(glyph)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${draw(party.color, party.color2 || '#fff')}${text}</svg>`;
}
