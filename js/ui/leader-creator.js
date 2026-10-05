// Ledarskaparen – används både vid ny spelomgång och när en ny partiledare tar över.
// draft.leader = { first, last, gender, age, look, traits (bas), persona }
import { h, esc, clamp, pick } from '../core/util.js';
import { CITIES, EDUCATIONS, FAMILY, FIRST_F, FIRST_M, LAST } from '../data/names.js';
import { PROFESSIONS, EXPERIENCE, PERSONALITY, PERSONALITY_BY_ID, MAX_PERSONALITY, VOICES, BODY_LANGUAGE, STYLES, FAMILY_STATUS, WORLDVIEW, PUBLIC_IMAGE } from '../data/persona.js';
import { ISSUE_BY_ID } from '../data/issues.js';
import { TRAITS, TRAIT_POINTS, HAIR_STYLES, HAIR_COLORS, SKIN_TONES, EYE_COLORS, EYE_SHAPES, NOSES, BODIES, FACES, BROWS, MOUTHS, OUTFITS, JACKET_COLORS, SHIRT_COLORS, TIE_COLORS, GLASSES, BEARDS, randomLook, randomPersona, applyPersona, traitLabel, fixLook } from '../sim/people.js';
import { EXPRESSIONS, POSES } from '../art/character.js';
import { characterArt, spriteList, spriteFaceUrl, spritesReady, pickSprite, spriteById } from '../art/sprites.js';
import { PARTS, prepareLook, hasCustomLook } from '../art/recolor.js';
const characterSVG = (p, o) => characterArt({ ...p, id: 'draft', sprite: p.sprite === 'auto' || !p.sprite ? undefined : p.sprite }, o);

export function blankLeader(rnd, gender = 'k') {
  return { first: '', last: '', gender, age: 45, sprite: 'auto', look: randomLook(rnd, gender, { age: 45 }), traits: Object.fromEntries(TRAITS.map((t) => [t.id, 42])),
    persona: { profession: 'kommunalrad', experience: 'lokal', personality: [], voice: 'mjuk', bodyLanguage: 'kontrollerat', style: 'formell', family: 'Gift', children: 1, worldview: 'sekular', image: 'statsman' },
    bg: { utbildning: 'Statsvetare', hemstad: 'Stockholm', familj: 'Medelklass' } };
}

// Ritar skaparen i container. Returnerar { validate() → feltext|null, read() }.
export function renderLeaderCreator(container, L, { rnd, tab = 'person' } = {}) {
  container.innerHTML = '';
  const el = h('div', { class: 'grid c3' });
  // ---- porträtt ----
  const port = h('div', { class: 'panel' });
  port.innerHTML = `<h3>Porträtt</h3><div class="portrait" id="portrait"></div><div class="row" style="margin-top:8px"><select id="expr">${EXPRESSIONS.map((e) => `<option value="${e}">${e}</option>`).join('')}</select><select id="pose">${POSES.map((p) => `<option value="${p}">${p}</option>`).join('')}</select><button class="btn sm" id="randLook">🎲 Utseende</button></div>
    <div class="help" style="margin-top:10px" id="personaHint"></div>`;
  const drawPortrait = () => { port.querySelector('#portrait').innerHTML = characterSVG({ look: L.look, age: L.age, gender: L.gender, sprite: L.sprite, spriteLook: L.spriteLook }, { expr: port.querySelector('#expr').value, pose: port.querySelector('#pose').value, id: 'setup' }); port.querySelector('#personaHint').innerHTML = personaHint(L); };
  document.addEventListener('bpm:sprites', drawPortrait);
  port.querySelector('#expr').addEventListener('change', drawPortrait); port.querySelector('#pose').addEventListener('change', drawPortrait);
  port.querySelector('#randLook').addEventListener('click', () => { L.look = randomLook(rnd, L.gender, { age: L.age, style: L.persona.style }); renderLeaderCreator(container, L, { rnd, tab: current }); });

  // ---- mitten: flikar person / utseende / personlighet ----
  const mid = h('div', { class: 'panel' });
  let current = tab;
  const tabs = h('div', { class: 'tabs' });
  for (const [id, name] of [['person', 'Personen'], ['utseende', 'Utseende'], ['klader', 'Kläder & stil'], ['personlighet', 'Personlighet']]) tabs.append(h('button', { class: id === current ? 'on' : '', onclick: () => renderLeaderCreator(container, L, { rnd, tab: id }) }, name));
  mid.append(tabs);
  const body = h('div', {});
  mid.append(body);
  const q = (s) => body.querySelector(s);
  if (current === 'person') {
    body.innerHTML = `
      <div class="row"><div class="field" style="flex:1"><label>Förnamn</label><input type="text" id="first" value="${esc(L.first)}"></div><div class="field" style="flex:1"><label>Efternamn</label><input type="text" id="last" value="${esc(L.last)}"></div><button class="btn sm" id="randName" style="margin-top:14px">🎲</button></div>
      <div class="row"><div class="field" style="flex:1"><label>Kön</label><select id="gender"><option value="k" ${L.gender === 'k' ? 'selected' : ''}>Kvinna</option><option value="m" ${L.gender === 'm' ? 'selected' : ''}>Man</option><option value="x" ${L.gender === 'x' ? 'selected' : ''}>Icke-binär</option></select></div><div class="field" style="flex:1"><label>Ålder</label><input type="number" id="age" min="18" max="85" value="${L.age}"></div></div>
      <div class="field"><label>Tidigare yrke</label><select id="profession">${PROFESSIONS.map((p) => `<option value="${p.id}" ${L.persona.profession === p.id ? 'selected' : ''}>${esc(p.name)}${Object.keys(p.cred).length ? ' – trovärdig i ' + Object.keys(p.cred).map((k) => ISSUE_BY_ID[k].short.toLowerCase()).join(', ') : ''}</option>`).join('')}</select></div>
      <div class="field"><label>Politisk erfarenhet</label><select id="experience">${EXPERIENCE.map((e) => `<option value="${e.id}" ${L.persona.experience === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select><div class="hint" id="expHint"></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Utbildning</label><select id="utb">${EDUCATIONS.map((x) => `<option ${L.bg.utbildning === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Hemstad</label><select id="stad">${CITIES.map((x) => `<option ${L.bg.hemstad === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Uppväxt</label><select id="fam">${FAMILY.map((x) => `<option ${L.bg.familj === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Civilstånd</label><select id="family">${FAMILY_STATUS.map((x) => `<option ${L.persona.family === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Barn</label><input type="number" id="children" min="0" max="8" value="${L.persona.children ?? 0}"></div><div class="field" style="flex:1"><label>Livsåskådning</label><select id="worldview">${WORLDVIEW.map((w) => `<option value="${w.id}" ${L.persona.worldview === w.id ? 'selected' : ''}>${w.name}</option>`).join('')}</select></div></div>`;
    const read = () => { L.first = q('#first').value.trim(); L.last = q('#last').value.trim(); L.age = clamp(+q('#age').value || 45, 18, 85); L.persona.profession = q('#profession').value; L.persona.experience = q('#experience').value; L.bg = { utbildning: q('#utb').value, hemstad: q('#stad').value, familj: q('#fam').value }; L.persona.family = q('#family').value; L.persona.children = clamp(+q('#children').value || 0, 0, 8); L.persona.worldview = q('#worldview').value; q('#expHint').textContent = EXPERIENCE.find((e) => e.id === L.persona.experience)?.desc || ''; drawPortrait(); refreshTraits(); };
    body.querySelectorAll('input,select').forEach((e) => e.addEventListener('input', read));
    q('#randName').addEventListener('click', () => { L.first = pick(rnd, L.gender === 'm' ? FIRST_M : FIRST_F); L.last = pick(rnd, LAST); q('#first').value = L.first; q('#last').value = L.last; });
    q('#gender').addEventListener('change', () => { L.gender = q('#gender').value; L.look = randomLook(rnd, L.gender, { age: L.age, style: L.persona.style }); renderLeaderCreator(container, L, { rnd, tab: 'person' }); });
    q('#expHint').textContent = EXPERIENCE.find((e) => e.id === L.persona.experience)?.desc || '';
  } else if (current === 'utseende') {
    body.innerHTML = `
      ${spritesReady() ? `<div class="field"><label>Tecknad figur <small class="muted">– välj en ur galleriet, eller låt spelet välja den som liknar ditt utseende nedan</small></label><div class="chips" id="spriteMode"><span class="chip ${L.sprite === 'auto' || !L.sprite ? 'on' : ''}" data-v="auto">Närmast mitt utseende</span><span class="chip ${L.sprite === 'svg' ? 'on' : ''}" data-v="svg">Bara den ritade dockan</span></div><div class="gallery" id="gallery"></div></div>
      <div class="field" id="customize"><label>Anpassa figuren <small class="muted">– bestäm själv hårfärg, hudton och kläder på den tecknade figuren (skuggningen behålls)</small></label><div class="parts" id="parts"></div><button class="btn sm" id="resetLook" style="margin-top:4px">Figurens egna färger</button></div>` : ''}
      <div class="field"><label>Frisyr</label><div class="chips" id="hair"></div></div>
      <div class="field"><label>Hårfärg</label><div class="swatches" id="hairc"></div></div>
      <div class="field"><label>Hudton</label><div class="swatches" id="skin"></div></div>
      <div class="field"><label>Ögonfärg</label><div class="swatches" id="eyes"></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Ögon</label><select id="eyeShape">${EYE_SHAPES.map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Ansikte</label><select id="face">${FACES.map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Näsa</label><select id="nose">${NOSES.map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Ögonbryn</label><select id="brows">${BROWS.map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Mun</label><select id="mouth">${MOUTHS.map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Kroppstyp</label><select id="body">${BODIES.map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Glasögon</label><select id="glasses">${GLASSES.map((g) => `<option value="${g.id}">${g.name}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Skägg</label><select id="beard">${BEARDS.map((g) => `<option value="${g.id}">${g.name}</option>`).join('')}</select></div></div>
      <div class="chips" id="flags"><span class="chip" data-f="freckles">Fräknar</span><span class="chip" data-f="earrings">Örhängen</span><span class="chip" data-f="lipstick">Läppstift</span><span class="chip" data-f="moleL">Födelsemärke vänster</span><span class="chip" data-f="moleR">Födelsemärke höger</span></div>`;
    const setSel = (id, v) => { const e = q('#' + id); if (e) e.value = v; };
    for (const k of ['eyeShape', 'face', 'nose', 'brows', 'mouth', 'body', 'glasses', 'beard']) setSel(k, L.look[k]);
    if (spritesReady()) {
      const gal = q('#gallery');
      const autoId = pickSprite({ look: L.look, age: L.age, gender: L.gender, id: 'draft' });
      const drawGal = () => { gal.innerHTML = ''; for (const c of spriteList().filter((x) => L.gender === 'x' || x.gender === L.gender)) { const g = h('div', { class: 'g ' + (L.sprite === c.id || ((L.sprite === 'auto' || !L.sprite) && c.id === autoId) ? 'on' : ''), title: `${c.age} år`, onclick: () => { L.sprite = c.id; q('#spriteMode').querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); drawGal(); drawPortrait(); } }); g.innerHTML = `<img src="${spriteFaceUrl(c.id)}" alt="" loading="lazy">`; gal.append(g); } };
      drawGal();
      // anpassningen: färga om delar av den valda (eller auto-matchade) figuren
      const LISTS = { hair: HAIR_COLORS, skin: SKIN_TONES, jacket: JACKET_COLORS, shirt: SHIRT_COLORS, accent: TIE_COLORS };
      const currentSprite = () => (L.sprite === 'svg' ? null : L.sprite && L.sprite !== 'auto' ? L.sprite : autoId);
      const applyLook = () => { const id = currentSprite(); if (!id) return drawPortrait(); prepareLook(id, L.spriteLook).then(drawPortrait).catch(drawPortrait); drawPortrait(); };
      const drawParts = () => {
        const id = currentSprite(); const sp = id ? spriteById(id) : null; const box = q('#customize'); const parts = q('#parts');
        if (!sp?.colors) { box.style.display = 'none'; return; }
        box.style.display = ''; parts.innerHTML = ''; L.spriteLook ||= {};
        for (const [part, name] of PARTS) {
          if (!sp.colors[part]) continue;
          const row = h('div', { class: 'prow' }); row.append(h('span', {}, name));
          const orig = h('span', { class: 'swatch orig ' + (!L.spriteLook[part] ? 'on' : ''), title: 'Figurens egen färg', onclick: () => { delete L.spriteLook[part]; drawParts(); applyLook(); } }); row.append(orig);
          for (const c of LISTS[part]) row.append(h('span', { class: 'swatch ' + (L.spriteLook[part] === c ? 'on' : ''), style: `background:${c}`, onclick: () => { L.spriteLook[part] = c; drawParts(); applyLook(); } }));
          parts.append(row);
        }
      };
      drawParts();
      q('#resetLook').addEventListener('click', () => { L.spriteLook = {}; drawParts(); applyLook(); });
      q('#spriteMode').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; L.sprite = c.dataset.v; q('#spriteMode').querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c)); drawGal(); drawParts(); applyLook(); });
      gal.addEventListener('click', () => { drawParts(); applyLook(); });
    }
    const hair = q('#hair');
    for (const hs of HAIR_STYLES) { const c = h('span', { class: 'chip ' + (L.look.hair === hs.id ? 'on' : ''), onclick: () => { L.look.hair = hs.id; hair.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); drawPortrait(); } }, hs.name); hair.append(c); }
    const swatchRow = (sel, list, key) => { const el2 = q(sel); for (const c of list) { const s = h('span', { class: 'swatch ' + (L.look[key] === c ? 'on' : ''), style: `background:${c}`, onclick: () => { L.look[key] = c; el2.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); s.classList.add('on'); drawPortrait(); } }); el2.append(s); } };
    swatchRow('#hairc', HAIR_COLORS, 'hairColor'); swatchRow('#skin', SKIN_TONES, 'skin'); swatchRow('#eyes', EYE_COLORS, 'eyes');
    body.querySelectorAll('select').forEach((e) => e.addEventListener('change', () => { for (const k of ['eyeShape', 'face', 'nose', 'brows', 'mouth', 'body', 'glasses', 'beard']) L.look[k] = q('#' + k).value; drawPortrait(); }));
    const flags = q('#flags');
    const syncFlags = () => { flags.querySelector('[data-f=freckles]').classList.toggle('on', !!L.look.freckles); flags.querySelector('[data-f=earrings]').classList.toggle('on', !!L.look.earrings); flags.querySelector('[data-f=lipstick]').classList.toggle('on', !!L.look.lipstick); flags.querySelector('[data-f=moleL]').classList.toggle('on', L.look.mole === 'vanster'); flags.querySelector('[data-f=moleR]').classList.toggle('on', L.look.mole === 'hoger'); };
    flags.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; const f = c.dataset.f; if (f === 'moleL') L.look.mole = L.look.mole === 'vanster' ? null : 'vanster'; else if (f === 'moleR') L.look.mole = L.look.mole === 'hoger' ? null : 'hoger'; else L.look[f] = !L.look[f]; syncFlags(); drawPortrait(); });
    syncFlags();
  } else if (current === 'klader') {
    body.innerHTML = `
      <div class="field"><label>Stil</label><div class="pick" id="style"></div></div>
      <div class="field"><label>Plagg</label><select id="outfit">${OUTFITS.map((o) => `<option value="${o.id}" ${L.look.outfit === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
      <div class="field" id="jc"><label>Färg på kavaj/tröja</label><div class="swatches" id="jacketColor"></div></div>
      <div class="field" id="sc"><label>Färg på skjorta/blus</label><div class="swatches" id="shirtColor"></div></div>
      <div class="field" id="tc"><label>Slipsfärg</label><div class="swatches" id="tieColor"></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Röst</label><select id="voice">${VOICES.map((v) => `<option value="${v.id}" ${L.persona.voice === v.id ? 'selected' : ''}>${v.name} – ${v.desc}</option>`).join('')}</select></div></div>
      <div class="field"><label>Kroppsspråk</label><select id="bodyLanguage">${BODY_LANGUAGE.map((v) => `<option value="${v.id}" ${L.persona.bodyLanguage === v.id ? 'selected' : ''}>${v.name} – ${v.desc}</option>`).join('')}</select></div>`;
    const st = q('#style');
    for (const s of STYLES) { const o = h('div', { class: 'opt ' + (L.persona.style === s.id ? 'on' : '') }); o.innerHTML = `<b>${esc(s.name)}</b><small>${esc(s.desc)}</small>`; o.addEventListener('click', () => { L.persona.style = s.id; L.look.style = s.id; const fits = OUTFITS.filter((x) => x.style.includes(s.id)); if (!fits.some((x) => x.id === L.look.outfit)) { const f = fits[0]; L.look.outfit = f.id; L.look.jacketColor = f.jacket; L.look.shirtColor = f.shirt; L.look.tieColor = f.tie; } renderLeaderCreator(container, L, { rnd, tab: 'klader' }); }); st.append(o); }
    const sw = (sel, list, key) => { const el2 = q(sel); el2.innerHTML = ''; for (const c of list) { const s = h('span', { class: 'swatch ' + (L.look[key] === c ? 'on' : ''), style: `background:${c}`, onclick: () => { L.look[key] = c; el2.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); s.classList.add('on'); drawPortrait(); } }); el2.append(s); } };
    const syncOutfit = () => { const o = OUTFITS.find((x) => x.id === L.look.outfit); q('#jc').style.display = o.jacket ? '' : 'none'; q('#sc').style.display = o.shirt ? '' : 'none'; q('#tc').style.display = o.tie ? '' : 'none'; sw('#jacketColor', JACKET_COLORS, 'jacketColor'); sw('#shirtColor', SHIRT_COLORS, 'shirtColor'); sw('#tieColor', TIE_COLORS, 'tieColor'); };
    q('#outfit').addEventListener('change', () => { const o = OUTFITS.find((x) => x.id === q('#outfit').value); L.look.outfit = o.id; L.look.jacketColor = o.jacket; L.look.shirtColor = o.shirt; L.look.tieColor = o.tie; syncOutfit(); drawPortrait(); });
    q('#voice').addEventListener('change', () => { L.persona.voice = q('#voice').value; drawPortrait(); });
    q('#bodyLanguage').addEventListener('change', () => { L.persona.bodyLanguage = q('#bodyLanguage').value; drawPortrait(); });
    syncOutfit();
  } else {
    body.innerHTML = `<p class="help">Välj upp till ${MAX_PERSONALITY} drag. Motsatta drag utesluter varandra. Dragen justerar egenskaperna och låser upp beteenden i debatter, sociala medier och händelser.</p><div class="pick" id="pers"></div>
      <h3 style="margin-top:12px">Offentlig image</h3><p class="help">Vad du försöker vara i mediernas ögon. Krockar den med din personlighet växer en "äkthetsrisk" när du pressas.</p><div class="pick" id="image"></div>`;
    const pers = q('#pers');
    const draw = () => { pers.innerHTML = ''; for (const p of PERSONALITY) { const on = L.persona.personality.includes(p.id); const blocked = !on && (L.persona.personality.some((x) => PERSONALITY_BY_ID[x].excl === p.id || p.excl === x) || L.persona.personality.length >= MAX_PERSONALITY); const o = h('div', { class: 'opt ' + (on ? 'on' : ''), style: blocked ? 'opacity:.4' : '' }); o.innerHTML = `<b>${esc(p.name)}</b><small>${esc(p.desc)}</small>`; o.addEventListener('click', () => { if (on) L.persona.personality = L.persona.personality.filter((x) => x !== p.id); else if (!blocked) L.persona.personality.push(p.id); draw(); refreshTraits(); drawPortrait(); }); pers.append(o); } };
    draw();
    const img = q('#image');
    for (const im of PUBLIC_IMAGE) { const o = h('div', { class: 'opt ' + (L.persona.image === im.id ? 'on' : '') }); o.innerHTML = `<b>${esc(im.name)}</b><small>${esc(im.desc)}</small>`; o.addEventListener('click', () => { L.persona.image = im.id; img.querySelectorAll('.opt').forEach((x) => x.classList.remove('on')); o.classList.add('on'); drawPortrait(); }); img.append(o); }
  }

  // ---- egenskaper ----
  const tr = h('div', { class: 'panel' });
  const used = () => Object.values(L.traits).reduce((a, b) => a + b, 0);
  tr.innerHTML = `<h3>Egenskaper <span class="points" id="pts"></span></h3><p class="help">Fördela ${TRAIT_POINTS} poäng. Personlighet och erfarenhet lägger till (visas i grönt/rött). Allt kan inte vara starkt.</p><div id="traits"></div><button class="btn sm" id="randTraits" style="margin-top:6px">🎲 Slumpa egenskaper</button>`;
  const tl = tr.querySelector('#traits');
  const rows = {};
  const refreshTraits = () => { const eff = applyPersona(L.traits, L.persona); for (const t of TRAITS) { const r = rows[t.id]; if (!r) continue; const d = eff[t.id] - L.traits[t.id]; r.val.innerHTML = `${L.traits[t.id]}${d ? ` <small class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</small>` : ''}`; r.lab.title = `${t.desc} (${traitLabel(eff[t.id])})`; } const u = used(); tr.querySelector('#pts').textContent = `${TRAIT_POINTS - u} poäng kvar`; tr.querySelector('#pts').style.color = u > TRAIT_POINTS ? 'var(--red)' : 'var(--gold)'; };
  for (const t of TRAITS) {
    const row = h('div', { class: 'trait' });
    const lab = h('span', { title: t.desc }, t.name);
    const inp = h('input', { type: 'range', min: 8, max: 92, value: L.traits[t.id] });
    const val = h('b', {}, String(L.traits[t.id]));
    inp.addEventListener('input', () => { const others = used() - L.traits[t.id]; let v = +inp.value; if (others + v > TRAIT_POINTS) v = TRAIT_POINTS - others; inp.value = v; L.traits[t.id] = v; refreshTraits(); });
    row.append(lab, inp, val); tl.append(row); rows[t.id] = { lab, val, inp };
  }
  refreshTraits();
  tr.querySelector('#randTraits').addEventListener('click', () => { let left = TRAIT_POINTS; const ids = TRAITS.map((t) => t.id); for (const id of ids) L.traits[id] = 8; left -= 8 * ids.length; while (left > 0) { const id = pick(rnd, ids); if (L.traits[id] < 92) { L.traits[id]++; left--; } } for (const id of ids) rows[id].inp.value = L.traits[id]; refreshTraits(); });

  el.append(port, mid, tr);
  container.append(el);
  drawPortrait();
  return {
    validate() { if (!L.first || !L.last) return 'Ledaren behöver för- och efternamn.'; if (used() > TRAIT_POINTS) return 'För många egenskapspoäng fördelade.'; return null; },
  };
}
function personaHint(L) {
  const p = L.persona;
  const prof = PROFESSIONS.find((x) => x.id === p.profession);
  const img = PUBLIC_IMAGE.find((x) => x.id === p.image);
  const fits = img ? img.fits.filter((f) => p.personality.includes(f) || p.style === f || p.voice === f || p.bodyLanguage === f).length : 0;
  const auth = img ? (fits >= 2 ? '<span class="ok">äkta</span>' : fits === 1 ? '<span style="color:var(--orange)">delvis trovärdig</span>' : '<span class="danger">spelad – äkthetsrisk</span>') : '';
  return `<b>${esc(L.first || 'Förnamn')} ${esc(L.last || 'Efternamn')}</b>, ${L.age} år · ${esc(prof?.name || '')}${Object.keys(prof?.cred || {}).length ? ' (trovärdig i ' + Object.keys(prof.cred).map((k) => ISSUE_BY_ID[k].short.toLowerCase()).join(', ') + ')' : ''}<br>${esc(EXPERIENCE.find((e) => e.id === p.experience)?.name || '')} · ${p.personality.map((id) => PERSONALITY_BY_ID[id]?.name.toLowerCase()).join(', ') || 'inga drag valda'}<br>Image: <b>${esc(img?.name || '')}</b> – ${auth}`;
}
export function finalizeLeader(L) {
  return { name: `${L.first} ${L.last}`, first: L.first, last: L.last, gender: L.gender, age: L.age, look: fixLook({ ...L.look }), traits: { ...L.traits }, persona: { ...L.persona, personality: [...L.persona.personality] }, bg: { ...L.bg, yrke: PROFESSIONS.find((x) => x.id === L.persona.profession)?.name || 'Politiker' }, sprite: L.sprite && L.sprite !== 'auto' ? L.sprite : undefined, spriteLook: hasCustomLook(L.spriteLook) ? { ...L.spriteLook } : undefined };
}
