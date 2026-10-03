// Skapa spelomgång: välj väg → partiet → ledaren → starta.
import { h, esc, makeRng, clamp, pick, kr } from '../core/util.js';
import { START_PARTIES, LOGO_SHAPES, PARTY_COLORS } from '../data/parties.js';
import { ISSUES, IDEOLOGIES, issueLabel } from '../data/issues.js';
import { CITIES, EDUCATIONS, JOBS, FAMILY, FIRST_F, FIRST_M, LAST } from '../data/names.js';
import { TRAITS, TRAIT_POINTS, HAIR_STYLES, HAIR_COLORS, SKIN_TONES, EYE_COLORS, OUTFITS, GLASSES, BEARDS, randomLook, traitLabel } from '../sim/people.js';
import { logoSVG } from '../art/logo.js';
import { characterSVG, EXPRESSIONS, POSES } from '../art/character.js';
import { listSaves } from '../core/state.js';
import { modal } from './modal.js';

export function renderSetup({ onDone, onCancel }) {
  const app = document.getElementById('app');
  const rnd = makeRng(Date.now() % 1e9);
  const draft = {
    mode: null, takeoverId: null,
    party: { name: '', abbr: '', color: '#8e44ad', color2: '#ffffff', logo: { shape: 'star', glyph: '' }, slogan: '', ideology: 'egen', pos: Object.fromEntries(ISSUES.map((i) => [i.id, 0])), profile: {} },
    leader: { first: '', last: '', gender: 'k', age: 45, look: randomLook(rnd, 'k'), traits: Object.fromEntries(TRAITS.map((t) => [t.id, 42])), bg: { utbildning: 'Statsvetare', yrke: 'Kommunalråd', hemstad: 'Stockholm', familj: 'Medelklass' } },
    slot: null,
  };
  let step = 0;
  const steps = () => draft.mode === 'new' ? ['Vägval', 'Partiet', 'Ledaren', 'Starta'] : ['Vägval', 'Ledaren', 'Starta'];

  function render() {
    app.innerHTML = '';
    const wrap = h('div', { class: 'setup' });
    const inner = h('div', { class: 'inner' });
    const st = steps();
    const stepsEl = h('div', { class: 'steps' }, ...st.map((s, i) => h('span', { class: i === step ? 'on' : i < step ? 'done' : '' }, `${i + 1}. ${s}`)));
    inner.append(h('div', { class: 'row between' }, h('h1', {}, 'Ny spelomgång'), h('button', { class: 'btn ghost', onclick: onCancel }, '← Tillbaka till start')), stepsEl);
    const name = st[step];
    if (name === 'Vägval') inner.append(stepPath());
    else if (name === 'Partiet') inner.append(stepParty());
    else if (name === 'Ledaren') inner.append(stepLeader());
    else inner.append(stepStart());
    wrap.append(inner); app.append(wrap);
    wrap.scrollTop = 0;
  }
  const nav = (okNext, nextLabel = 'Nästa →') => h('div', { class: 'row between', style: 'margin-top:18px' }, h('button', { class: 'btn', onclick: () => { step = Math.max(0, step - 1); render(); }, disabled: step === 0 }, '← Föregående'), h('button', { class: 'btn gold big', onclick: () => { const err = okNext(); if (err) { modal({ title: 'Komplettera', body: `<p>${esc(err)}</p>`, buttons: [{ label: 'OK' }] }); return; } step++; render(); } }, nextLabel));

  // ---------- STEG: VÄGVAL ----------
  function stepPath() {
    const el = h('div', {});
    const grid = h('div', { class: 'grid c2' });
    const newCard = h('div', { class: 'panel' });
    newCard.innerHTML = `<h3>🌱 Starta ett nytt parti</h3><p>Från absolut noll: inga mandat, nästan inga pengar, ingen som vet att ni finns. Det svåraste sättet – och det mest belönande. Räkna med flera mandatperioder innan riksdagen är inom räckhåll.</p>`;
    newCard.append(h('button', { class: 'btn ' + (draft.mode === 'new' ? 'gold' : ''), onclick: () => { draft.mode = 'new'; draft.takeoverId = null; render(); } }, draft.mode === 'new' ? '✓ Valt' : 'Välj denna väg'));
    const takeCard = h('div', { class: 'panel' });
    takeCard.innerHTML = `<h3>🏛️ Ta över ett riksdagsparti</h3><p>Du blir ny partiledare för ett etablerat parti med mandat, pengar och organisation – och alla dess problem. Tar du över det största regeringspartiet blir du statsminister på en gång.</p>`;
    const pg = h('div', { class: 'pick' });
    for (const p of START_PARTIES) {
      const o = h('div', { class: 'opt ' + (draft.takeoverId === p.id ? 'on' : '') });
      o.innerHTML = `<div class="party-card"><div class="logo">${logoSVG(p, 54)}</div><div><b>${esc(p.name)}</b><small>${p.seats} mandat · ${(p.seats / 3.49).toFixed(1).replace('.', ',')} %</small><small>${esc(IDEOLOGY_HINT[p.id])}</small></div></div>`;
      o.addEventListener('click', () => { draft.mode = 'takeover'; draft.takeoverId = p.id; render(); });
      pg.append(o);
    }
    takeCard.append(pg);
    grid.append(newCard, takeCard); el.append(grid);
    el.append(nav(() => (!draft.mode ? 'Välj en väg först.' : draft.mode === 'takeover' && !draft.takeoverId ? 'Välj vilket parti du tar över.' : null)));
    return el;
  }

  // ---------- STEG: PARTIET ----------
  function stepParty() {
    const P = draft.party;
    const el = h('div', { class: 'grid c2' });
    const left = h('div', { class: 'panel' });
    left.innerHTML = `<h3>Partiets identitet</h3>
      <div class="field"><label>Partinamn</label><input type="text" id="pname" value="${esc(P.name)}" placeholder="t.ex. Framtidspartiet" maxlength="40"></div>
      <div class="row"><div class="field" style="flex:1"><label>Förkortning</label><input type="text" id="pabbr" value="${esc(P.abbr)}" placeholder="FP" maxlength="4"></div>
      <div class="field"><label>Färg</label><div class="row"><input type="color" id="pcolor" value="${P.color}"><input type="color" id="pcolor2" value="${P.color2}" title="Sekundär färg"></div></div></div>
      <div class="swatches" id="swatches"></div>
      <div class="field" style="margin-top:10px"><label>Slogan</label><input type="text" id="pslogan" value="${esc(P.slogan)}" placeholder="t.ex. Ett Sverige som håller ihop" maxlength="80"></div>
      <div class="field"><label>Logotyp</label><div class="chips" id="shapes"></div></div>
      <div class="row" style="margin-top:8px;align-items:center"><div class="hero-logo" id="logoPreview"></div><div><b id="prevName"></b><br><small id="prevSlogan" class="muted"></small></div></div>`;
    const sw = left.querySelector('#swatches');
    for (const c of PARTY_COLORS) { const s = h('span', { class: 'swatch ' + (P.color === c ? 'on' : ''), style: `background:${c}`, onclick: () => { P.color = c; left.querySelector('#pcolor').value = c; sw.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); s.classList.add('on'); upd(); } }); sw.append(s); }
    const shapes = left.querySelector('#shapes');
    for (const sh of LOGO_SHAPES) { const c = h('span', { class: 'chip ' + (P.logo.shape === sh ? 'on' : ''), onclick: () => { P.logo.shape = sh; shapes.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); upd(); } }); c.innerHTML = logoSVG({ ...P, logo: { shape: sh, glyph: P.abbr || 'P' } }, 26); shapes.append(c); }
    const upd = () => {
      P.name = left.querySelector('#pname').value.trim(); P.abbr = left.querySelector('#pabbr').value.trim().toUpperCase(); P.color = left.querySelector('#pcolor').value; P.color2 = left.querySelector('#pcolor2').value; P.slogan = left.querySelector('#pslogan').value.trim(); P.logo.glyph = P.abbr || '?';
      left.querySelector('#logoPreview').innerHTML = logoSVG(P, 120); left.querySelector('#prevName').textContent = P.name || 'Partinamn'; left.querySelector('#prevSlogan').textContent = P.slogan || 'Slogan';
    };
    for (const id of ['pname', 'pabbr', 'pcolor', 'pcolor2', 'pslogan']) left.querySelector('#' + id).addEventListener('input', upd);
    upd();

    const right = h('div', { class: 'panel' });
    right.innerHTML = `<h3>Ideologi & politik</h3><p class="help">Välj en utgångspunkt och finjustera sedan varje axel. Positionerna avgör vilka väljare ni lockar och vilka partier som vill samarbeta.</p><div class="pick" id="ideo"></div><div id="axes" style="margin-top:14px"></div>
      <h3 style="margin-top:14px">Hjärtefrågor <small class="muted">(välj upp till 3)</small></h3><p class="help">Frågor ni profilerar er på. Väljare som bryr sig om dem lyssnar extra på er.</p><div class="chips" id="profile"></div>`;
    const ideo = right.querySelector('#ideo');
    for (const I of IDEOLOGIES) { const o = h('div', { class: 'opt ' + (P.ideology === I.id ? 'on' : '') }); o.innerHTML = `<b>${esc(I.name)}</b><small>${esc(I.desc)}</small>`; o.addEventListener('click', () => { P.ideology = I.id; P.pos = { ...I.pos }; ideo.querySelectorAll('.opt').forEach((x) => x.classList.remove('on')); o.classList.add('on'); renderAxes(); }); ideo.append(o); }
    const axesEl = right.querySelector('#axes');
    const renderAxes = () => { axesEl.innerHTML = ''; for (const is of ISSUES) axesEl.append(axisRow(is, P.pos[is.id], (v) => { P.pos[is.id] = v; })); };
    renderAxes();
    const prof = right.querySelector('#profile');
    for (const is of ISSUES) { const c = h('span', { class: 'chip ' + (P.profile[is.id] ? 'on' : ''), onclick: () => { if (P.profile[is.id]) delete P.profile[is.id]; else if (Object.keys(P.profile).length < 3) P.profile[is.id] = 1.6; else return; c.classList.toggle('on', !!P.profile[is.id]); } }, is.name); prof.append(c); }
    el.append(left, right);
    const wrap = h('div', {}, el, nav(() => { upd(); if (!P.name) return 'Partiet behöver ett namn.'; if (!P.abbr) return 'Partiet behöver en förkortning.'; if (START_PARTIES.some((q) => q.abbr === P.abbr)) return 'Förkortningen används redan av ett riksdagsparti.'; if (!P.slogan) P.slogan = 'För ett bättre Sverige'; return null; }));
    return wrap;
  }
  function axisRow(is, value, onChange) {
    const row = h('div', { class: 'axis' });
    const nm = h('div', { class: 'name' }, h('span', { style: 'color:var(--text)' }, is.name), h('span', {}, issueLabel(is.id, value)));
    const inp = h('input', { type: 'range', min: -100, max: 100, value });
    inp.addEventListener('input', () => { onChange(+inp.value); nm.lastChild.textContent = issueLabel(is.id, +inp.value); });
    row.append(nm, h('div', { class: 'l' }, is.left), inp, h('div', { class: 'r' }, is.right));
    return row;
  }

  // ---------- STEG: LEDAREN ----------
  function stepLeader() {
    const L = draft.leader;
    const el = h('div', { class: 'grid c3' });
    // porträtt
    const port = h('div', { class: 'panel' });
    port.innerHTML = `<h3>Porträtt</h3><div class="portrait" id="portrait"></div><div class="row" style="margin-top:8px"><select id="expr">${EXPRESSIONS.map((e) => `<option value="${e}">${e}</option>`).join('')}</select><select id="pose">${POSES.map((p) => `<option value="${p}">${p}</option>`).join('')}</select><button class="btn sm" id="randLook">🎲 Slumpa utseende</button></div>`;
    const drawPortrait = () => { port.querySelector('#portrait').innerHTML = characterSVG({ look: L.look, age: L.age }, { expr: port.querySelector('#expr').value, pose: port.querySelector('#pose').value, id: 'setup' }); };
    port.querySelector('#expr').addEventListener('change', drawPortrait); port.querySelector('#pose').addEventListener('change', drawPortrait);
    port.querySelector('#randLook').addEventListener('click', () => { L.look = randomLook(rnd, L.gender); render(); });

    // person
    const pers = h('div', { class: 'panel' });
    pers.innerHTML = `<h3>Personen</h3>
      <div class="row"><div class="field" style="flex:1"><label>Förnamn</label><input type="text" id="first" value="${esc(L.first)}"></div><div class="field" style="flex:1"><label>Efternamn</label><input type="text" id="last" value="${esc(L.last)}"></div><button class="btn sm" id="randName" style="margin-top:14px">🎲</button></div>
      <div class="row"><div class="field" style="flex:1"><label>Kön</label><select id="gender"><option value="k" ${L.gender === 'k' ? 'selected' : ''}>Kvinna</option><option value="m" ${L.gender === 'm' ? 'selected' : ''}>Man</option><option value="x" ${L.gender === 'x' ? 'selected' : ''}>Icke-binär</option></select></div><div class="field" style="flex:1"><label>Ålder</label><input type="number" id="age" min="25" max="80" value="${L.age}"></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Utbildning</label><select id="utb">${EDUCATIONS.map((x) => `<option ${L.bg.utbildning === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Tidigare yrke</label><select id="yrke">${JOBS.map((x) => `<option ${L.bg.yrke === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Hemstad</label><select id="stad">${CITIES.map((x) => `<option ${L.bg.hemstad === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Familjebakgrund</label><select id="fam">${FAMILY.map((x) => `<option ${L.bg.familj === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
      <h3 style="margin-top:8px">Utseende</h3>
      <div class="field"><label>Frisyr</label><div class="chips" id="hair"></div></div>
      <div class="field"><label>Hårfärg</label><div class="swatches" id="hairc"></div></div>
      <div class="field"><label>Hudton</label><div class="swatches" id="skin"></div></div>
      <div class="field"><label>Ögonfärg</label><div class="swatches" id="eyes"></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Ögon</label><select id="eyeShape"><option value="skarp">Skarpa</option><option value="rund">Runda</option><option value="smal">Smala</option></select></div><div class="field" style="flex:1"><label>Ansikte</label><select id="face"><option value="oval">Ovalt</option><option value="kantig">Kantigt</option><option value="smal">Smalt</option><option value="rund">Runt</option></select></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Ögonbryn</label><select id="brows"><option value="tunna">Tunna</option><option value="vinklade">Vinklade</option><option value="tjocka">Tjocka</option></select></div><div class="field" style="flex:1"><label>Mun</label><select id="mouth"><option value="smal">Smal</option><option value="neutral">Normal</option><option value="bred">Bred</option></select></div></div>
      <div class="row"><div class="field" style="flex:1"><label>Glasögon</label><select id="glasses">${GLASSES.map((g) => `<option value="${g.id}">${g.name}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>Skägg</label><select id="beard">${BEARDS.map((g) => `<option value="${g.id}">${g.name}</option>`).join('')}</select></div></div>
      <div class="field"><label>Kläder</label><select id="outfit">${OUTFITS.map((o) => `<option value="${o.id}">${o.name}</option>`).join('')}</select></div>`;
    const q = (s) => pers.querySelector(s);
    const setSel = (id, v) => { const e = q('#' + id); if (e) e.value = v; };
    setSel('eyeShape', L.look.eyeShape); setSel('face', L.look.face); setSel('brows', L.look.brows); setSel('mouth', L.look.mouth); setSel('glasses', L.look.glasses); setSel('beard', L.look.beard); setSel('outfit', L.look.outfit);
    const hair = q('#hair');
    for (const hs of HAIR_STYLES) { const c = h('span', { class: 'chip ' + (L.look.hair === hs.id ? 'on' : ''), onclick: () => { L.look.hair = hs.id; hair.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); drawPortrait(); } }, hs.name); hair.append(c); }
    const swatchRow = (sel, list, key) => { const el2 = q(sel); for (const c of list) { const s = h('span', { class: 'swatch ' + (L.look[key] === c ? 'on' : ''), style: `background:${c}`, onclick: () => { L.look[key] = c; el2.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); s.classList.add('on'); drawPortrait(); } }); el2.append(s); } };
    swatchRow('#hairc', HAIR_COLORS, 'hairColor'); swatchRow('#skin', SKIN_TONES, 'skin'); swatchRow('#eyes', EYE_COLORS, 'eyes');
    const readPerson = () => { L.first = q('#first').value.trim(); L.last = q('#last').value.trim(); L.gender = q('#gender').value; L.age = clamp(+q('#age').value || 45, 25, 80); L.bg = { utbildning: q('#utb').value, yrke: q('#yrke').value, hemstad: q('#stad').value, familj: q('#fam').value }; for (const k of ['eyeShape', 'face', 'brows', 'mouth', 'glasses', 'beard', 'outfit']) L.look[k] = q('#' + k).value; drawPortrait(); };
    pers.querySelectorAll('input,select').forEach((e) => e.addEventListener('input', readPerson));
    q('#randName').addEventListener('click', () => { L.first = pick(rnd, L.gender === 'm' ? FIRST_M : FIRST_F); L.last = pick(rnd, LAST); q('#first').value = L.first; q('#last').value = L.last; });
    q('#gender').addEventListener('change', () => { L.gender = q('#gender').value; L.look = randomLook(rnd, L.gender); render(); });

    // egenskaper
    const tr = h('div', { class: 'panel' });
    const used = () => Object.values(L.traits).reduce((a, b) => a + b, 0);
    tr.innerHTML = `<h3>Egenskaper <span class="points" id="pts"></span></h3><p class="help">Fördela ${TRAIT_POINTS} poäng. Egenskaperna avgör debatter, kriser, förhandlingar och skandalrisk. Allt kan inte vara starkt.</p><div id="traits"></div><button class="btn sm" id="randTraits" style="margin-top:6px">🎲 Slumpa egenskaper</button>`;
    const tl = tr.querySelector('#traits');
    const updPts = () => { const u = used(); tr.querySelector('#pts').textContent = `${TRAIT_POINTS - u} poäng kvar`; tr.querySelector('#pts').style.color = u > TRAIT_POINTS ? 'var(--red)' : 'var(--gold)'; };
    for (const t of TRAITS) {
      const row = h('div', { class: 'trait' });
      const lab = h('span', { title: t.desc }, t.name);
      const inp = h('input', { type: 'range', min: 8, max: 92, value: L.traits[t.id] });
      const val = h('b', {}, String(L.traits[t.id]));
      inp.addEventListener('input', () => { const others = used() - L.traits[t.id]; let v = +inp.value; if (others + v > TRAIT_POINTS) v = TRAIT_POINTS - others; inp.value = v; L.traits[t.id] = v; val.textContent = v; lab.title = `${t.desc} (${traitLabel(v)})`; updPts(); });
      row.append(lab, inp, val); tl.append(row);
    }
    updPts();
    tr.querySelector('#randTraits').addEventListener('click', () => { let left = TRAIT_POINTS; const ids = TRAITS.map((t) => t.id); for (const id of ids) L.traits[id] = 8; left -= 8 * ids.length; while (left > 0) { const id = pick(rnd, ids); if (L.traits[id] < 92) { L.traits[id]++; left--; } } render(); });
    el.append(port, pers, tr);
    drawPortrait();
    return h('div', {}, el, nav(() => { readPerson(); if (!L.first || !L.last) return 'Ledaren behöver för- och efternamn.'; if (used() > TRAIT_POINTS) return 'För många egenskapspoäng fördelade.'; return null; }));
  }

  // ---------- STEG: STARTA ----------
  function stepStart() {
    const el = h('div', { class: 'grid c2' });
    const L = draft.leader; const P = draft.mode === 'new' ? draft.party : START_PARTIES.find((p) => p.id === draft.takeoverId);
    const sum = h('div', { class: 'panel' });
    sum.innerHTML = `<h3>Sammanfattning</h3><div class="row" style="align-items:flex-start"><div class="hero-logo">${logoSVG(P, 120)}</div><div><b style="font-size:18px">${esc(P.name)} (${esc(P.abbr)})</b><br><small class="muted">${esc(P.slogan)}</small><br><small>${draft.mode === 'new' ? 'Nytt parti – 150 medlemmar, 50 000 kr, 0 mandat' : `${P.seats} mandat i riksdagen`}</small></div></div>
      <div class="row" style="margin-top:14px;align-items:flex-start"><div class="face lg">${characterSVG({ look: L.look, age: L.age }, { crop: 'face', expr: 'confident', id: 'sum' })}</div><div><b style="font-size:18px">${esc(L.first)} ${esc(L.last)}</b>, ${L.age} år<br><small class="muted">${esc(L.bg.utbildning)} · ${esc(L.bg.yrke)} · ${esc(L.bg.hemstad)} · ${esc(L.bg.familj)}</small><br><small>Starkast: ${TRAITS.slice().sort((a, b) => L.traits[b.id] - L.traits[a.id]).slice(0, 3).map((t) => t.name.toLowerCase()).join(', ')}. Svagast: ${TRAITS.slice().sort((a, b) => L.traits[a.id] - L.traits[b.id]).slice(0, 2).map((t) => t.name.toLowerCase()).join(', ')}.</small></div></div>
      <p style="margin-top:14px" class="help">Spelet börjar måndagen den 4 januari 2027. Nästa riksdagsval hålls i september 2030. Varje vecka har du handlingspoäng att använda på presskonferenser, turnéer, sociala medier, riksdagsarbete och mycket mer. Allt sparas automatiskt.</p>`;
    const slots = h('div', { class: 'panel' });
    slots.innerHTML = `<h3>Välj sparplats</h3><p class="help">Tre platser. En upptagen plats skrivs över.</p>`;
    const saves = listSaves();
    const list = h('div', { class: 'saves' });
    for (const s of saves) {
      const o = h('div', { class: 'save', style: 'cursor:pointer;border-color:' + (draft.slot === s.slot ? 'var(--gold)' : 'var(--line)'), onclick: () => { draft.slot = s.slot; render(); } });
      o.innerHTML = `<div class="who"><span class="dot" style="background:${s.empty ? 'var(--line)' : s.color}"></span><div><b>Plats ${s.slot}</b><small>${s.empty ? 'Tom' : esc(`${s.party} – ${s.leader} (skrivs över!)`)}</small></div></div>${draft.slot === s.slot ? '<b style="color:var(--gold)">✓</b>' : ''}`;
      list.append(o);
    }
    slots.append(list);
    el.append(sum, slots);
    const start = h('button', { class: 'btn gold big', onclick: () => { if (!draft.slot) { modal({ title: 'Välj sparplats', body: '<p>Välj en plats att spara på.</p>', buttons: [{ label: 'OK' }] }); return; } onDone(buildDef()); } }, '🚀 Starta spelet');
    return h('div', {}, el, h('div', { class: 'row between', style: 'margin-top:18px' }, h('button', { class: 'btn', onclick: () => { step--; render(); } }, '← Föregående'), start));
  }
  function buildDef() {
    const L = draft.leader;
    return { mode: draft.mode, takeoverId: draft.takeoverId, slot: draft.slot, party: draft.mode === 'new' ? { ...draft.party, logo: { ...draft.party.logo, glyph: draft.party.abbr } } : null,
      leader: { name: `${L.first} ${L.last}`, first: L.first, last: L.last, gender: L.gender, age: L.age, look: { ...L.look }, traits: { ...L.traits }, bg: { ...L.bg } } };
  }
  render();
}
const IDEOLOGY_HINT = { s: 'Socialdemokrati · störst, oppositionsledare', sd: 'Nationalkonservatism · regeringens stödparti', m: 'Liberalkonservatism · regeringsparti, statsministern', v: 'Socialism · opposition', c: 'Grön liberalism · opposition, mitten', kd: 'Kristdemokrati · regeringsparti', mp: 'Grön politik · opposition', l: 'Liberalism · regeringsparti, minst' };
