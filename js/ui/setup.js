// Skapa spelomgång: vägval → partiet (identitet, ideologi, organisation, målgrupper) → ledaren → starta.
import { h, esc, makeRng, clamp } from '../core/util.js';
import { START_PARTIES, LOGO_SHAPES, PARTY_COLORS } from '../data/parties.js';
import { ISSUES } from '../data/issues.js';
import { IDEOLOGIES, IDEOLOGY_BY_ID, FAMILIES, combinePositions, extremismOf, demoOf, ideologyLabel } from '../data/ideologies.js';
import { SEGMENTS } from '../data/segments.js';
import { logoSVG, imageToLogo } from '../art/logo.js';
import { characterArt } from '../art/sprites.js';
import { adviserLine } from '../scene/debate.js';
const characterSVG = (p, o) => characterArt({ ...p, id: 'draft', sprite: p.sprite === 'auto' ? undefined : p.sprite }, o);
import { listSaves } from '../core/state.js';
import { modal } from './modal.js';
import { renderLeaderCreator, blankLeader, finalizeLeader } from './leader-creator.js';
import { TRAITS } from '../sim/people.js';
import { defaultStructure, STRUCTURE_OPTIONS, structureSummary } from '../sim/party.js';
import { ideologyProgram, axesFromProgram, programExtremism, EXT_NAMES, DEMO_NAMES } from '../sim/policy.js';
import { partyPoliticsStep } from './partypolitics.js';

export function renderSetup({ onDone, onCancel }) {
  const app = document.getElementById('app');
  const rnd = makeRng(Date.now() % 1e9);
  const draft = {
    mode: null, takeoverId: null,
    party: { name: '', abbr: '', color: '#8e44ad', color2: '#ffffff', logo: { shape: 'star', glyph: '' }, slogan: '', ideology: { primary: 'centrism', secondary: [] }, pos: combinePositions('centrism'), profile: {}, structure: defaultStructure(), tuned: false },
    leader: blankLeader(rnd, 'k'),
    slot: null,
  };
  draft.party.program = ideologyProgram('centrism'); draft.party.pos = axesFromProgram(draft.party.program);
  let step = 0, partyTab = 'identitet', polTab = 'kompass';
  // ideologin ger ett startprogram (med ideologins kännetecken); därefter räknas axlarna ur programmet
  const regenProgram = (P) => { P.program = ideologyProgram(P.ideology.primary, P.ideology.secondary); P.pos = axesFromProgram(P.program); P.tuned = false; };
  const steps = () => draft.mode === 'new' ? ['Vägval', 'Partiet', 'Ledaren', 'Starta'] : ['Vägval', 'Ledaren', 'Starta'];
  let leaderCreator = null;

  function render() {
    app.innerHTML = '';
    const wrap = h('div', { class: 'setup' });
    const inner = h('div', { class: 'inner' });
    const st = steps();
    inner.append(h('div', { class: 'row between' }, h('h1', {}, 'Ny spelomgång'), h('button', { class: 'btn ghost', onclick: onCancel }, '← Tillbaka till start')), h('div', { class: 'steps' }, ...st.map((s, i) => h('span', { class: i === step ? 'on' : i < step ? 'done' : '' }, `${i + 1}. ${s}`))));
    const name = st[step];
    if (name === 'Vägval') inner.append(stepPath());
    else if (name === 'Partiet') inner.append(stepParty());
    else if (name === 'Ledaren') inner.append(stepLeader());
    else inner.append(stepStart());
    wrap.append(inner); app.append(wrap);
    wrap.scrollTop = 0;
  }
  const nav = (okNext, nextLabel = 'Nästa →') => h('div', { class: 'row between', style: 'margin-top:18px' }, h('button', { class: 'btn', onclick: () => { step = Math.max(0, step - 1); render(); }, disabled: step === 0 }, '← Föregående'), h('button', { class: 'btn gold big', onclick: () => { const err = okNext(); if (err) { modal({ title: 'Komplettera', body: `<p>${esc(err)}</p>`, buttons: [{ label: 'OK' }] }); return; } step++; render(); } }, nextLabel));

  // ---------- VÄGVAL ----------
  function stepPath() {
    const el = h('div', {});
    const grid = h('div', { class: 'grid c2' });
    const newCard = h('div', { class: 'panel' });
    newCard.innerHTML = `<h3>🌱 Starta ett nytt parti</h3><p>Från absolut noll: inga mandat, nästan inga pengar, ingen som vet att ni finns. Du bestämmer allt – namn, ideologi, organisation, målgrupper. Räkna med flera mandatperioder innan riksdagen är inom räckhåll.</p>`;
    newCard.append(h('button', { class: 'btn ' + (draft.mode === 'new' ? 'gold' : ''), onclick: () => { draft.mode = 'new'; draft.takeoverId = null; render(); } }, draft.mode === 'new' ? '✓ Valt' : 'Välj denna väg'));
    const takeCard = h('div', { class: 'panel' });
    takeCard.innerHTML = `<h3>🏛️ Ta över ett riksdagsparti</h3><p>Du blir ny partiledare för ett etablerat parti med mandat, pengar, organisation, falanger och gamla löften. Tar du över det största regeringspartiet blir du statsminister på en gång.</p>`;
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

  // ---------- PARTIET ----------
  function stepParty() {
    const P = draft.party;
    const el = h('div', {});
    const tabs = h('div', { class: 'tabs' });
    for (const [id, nm] of [['identitet', '1. Identitet'], ['ideologi', '2. Ideologi'], ['politik', '3. Politiken'], ['organisation', '4. Organisation'], ['malgrupper', '5. Målgrupper']]) tabs.append(h('button', { class: id === partyTab ? 'on' : '', onclick: () => { partyTab = id; render(); } }, nm));
    el.append(tabs);
    const body = { identitet: partyIdentity, ideologi: partyIdeology, politik: partyPolitics, organisation: partyOrganisation, malgrupper: partyTargets }[partyTab](P);
    el.append(body);
    const order = ['identitet', 'ideologi', 'politik', 'organisation', 'malgrupper'];
    const idx = order.indexOf(partyTab);
    const navRow = h('div', { class: 'row between', style: 'margin-top:18px' },
      h('button', { class: 'btn', onclick: () => { if (idx > 0) { partyTab = order[idx - 1]; render(); } else { step--; render(); } } }, '← Föregående'),
      h('button', { class: 'btn gold big', onclick: () => { if (idx < order.length - 1) { partyTab = order[idx + 1]; render(); return; } const err = validateParty(); if (err) { modal({ title: 'Komplettera', body: `<p>${esc(err)}</p>`, buttons: [{ label: 'OK' }] }); return; } step++; render(); } }, idx < order.length - 1 ? 'Nästa →' : 'Vidare till ledaren →'));
    el.append(navRow);
    return el;
  }
  function validateParty() { const P = draft.party; if (!P.name) return 'Partiet behöver ett namn (fliken Identitet).'; if (!P.abbr) return 'Partiet behöver en förkortning.'; if (START_PARTIES.some((q) => q.abbr === P.abbr)) return 'Förkortningen används redan av ett riksdagsparti.'; if (!P.slogan) P.slogan = 'För ett bättre Sverige'; return null; }

  function partyIdentity(P) {
    const el = h('div', { class: 'grid c2' });
    const left = h('div', { class: 'panel' });
    left.innerHTML = `<h3>Namn, färg, logotyp</h3>
      <div class="field"><label>Partinamn</label><input type="text" id="pname" value="${esc(P.name)}" placeholder="t.ex. Framtidspartiet" maxlength="40"></div>
      <div class="row"><div class="field" style="flex:1"><label>Förkortning</label><input type="text" id="pabbr" value="${esc(P.abbr)}" placeholder="FP" maxlength="4"></div>
      <div class="field"><label>Färger</label><div class="row"><input type="color" id="pcolor" value="${P.color}" title="Huvudfärg"><input type="color" id="pcolor2" value="${P.color2}" title="Sekundär färg"></div></div></div>
      <div class="swatches" id="swatches"></div>
      <div class="field" style="margin-top:10px"><label>Slogan</label><input type="text" id="pslogan" value="${esc(P.slogan)}" placeholder="t.ex. Ett Sverige som håller ihop" maxlength="80"></div>
      <div class="field"><label>Logotyp</label><div class="chips" id="shapes"></div></div>
      <div class="field"><label>Egen logotypbild <small class="muted">(valfritt – välj en bild från mobilen eller datorn; den ersätter formen ovan)</small></label><div class="logo-up"><input type="file" id="plogofile" accept="image/*"><button class="btn sm" id="plogoclear" style="display:${P.logoImage ? '' : 'none'}">Ta bort bilden</button></div></div>
      <div class="field"><label>Egen ideologi – ge den ett namn <small class="muted">(valfritt)</small></label><input type="text" id="pideo" value="${esc(P.ideologyName || '')}" placeholder="t.ex. Nordisk pragmatism, Grön konservatism…" maxlength="40"></div>
      <div class="field"><label>Programförklaring i egna ord <small class="muted">(valfritt – men allt du lovar här följs upp)</small></label><textarea id="pmanifest" rows="5" maxlength="1200" placeholder="Vad vill partiet? Skriv fritt. Konkreta löften med siffror registreras och granskas; vaga formuleringar flaggas av medierna.">${esc(P.manifesto || '')}</textarea><div class="adviser" id="padv"></div></div>`;
    const sw = left.querySelector('#swatches');
    for (const c of PARTY_COLORS) { const s = h('span', { class: 'swatch ' + (P.color === c ? 'on' : ''), style: `background:${c}`, onclick: () => { P.color = c; left.querySelector('#pcolor').value = c; sw.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); s.classList.add('on'); upd(); } }); sw.append(s); }
    const shapes = left.querySelector('#shapes');
    for (const sh of LOGO_SHAPES) { const c = h('span', { class: 'chip ' + (P.logo.shape === sh ? 'on' : ''), onclick: () => { P.logo.shape = sh; shapes.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); upd(); } }); c.innerHTML = logoSVG({ ...P, logo: { shape: sh, glyph: P.abbr || 'P' } }, 26); shapes.append(c); }
    const right = h('div', { class: 'panel' });
    right.innerHTML = `<h3>Förhandsvisning</h3><div class="row" style="align-items:center"><div class="hero-logo" id="logoPreview"></div><div><b id="prevName" style="font-size:22px"></b><br><small id="prevSlogan" class="muted"></small></div></div>
      <p class="help" style="margin-top:14px">Namnet och färgerna syns i mätningar, på valnatten och i riksdagens mandatbåge. Välj en färg som inte redan "ägs" av ett riksdagsparti om du vill sticka ut.</p>`;
    let advTmr = null;
    const upd = () => { P.name = left.querySelector('#pname').value.trim(); P.abbr = left.querySelector('#pabbr').value.trim().toUpperCase(); P.color = left.querySelector('#pcolor').value; P.color2 = left.querySelector('#pcolor2').value; P.slogan = left.querySelector('#pslogan').value.trim(); P.ideologyName = left.querySelector('#pideo').value.trim(); P.manifesto = left.querySelector('#pmanifest').value.trim(); P.logo.glyph = P.abbr || '?'; right.querySelector('#logoPreview').innerHTML = logoSVG(P, 120); right.querySelector('#prevName').textContent = P.name || 'Partinamn'; right.querySelector('#prevSlogan').textContent = P.slogan || 'Slogan'; clearTimeout(advTmr); advTmr = setTimeout(() => { left.querySelector('#padv').textContent = P.manifesto ? adviserLine(P.manifesto, {}) : ''; }, 250); };
    for (const id of ['pname', 'pabbr', 'pcolor', 'pcolor2', 'pslogan', 'pideo', 'pmanifest']) left.querySelector('#' + id).addEventListener('input', upd);
    left.querySelector('#plogofile').addEventListener('change', async (e) => { const f = e.target.files?.[0]; if (!f) return; try { P.logoImage = await imageToLogo(f); left.querySelector('#plogoclear').style.display = ''; upd(); } catch (err) { modal({ title: 'Logotyp', body: `<p>${esc(err.message)}</p>`, buttons: [{ label: 'OK' }] }); } });
    left.querySelector('#plogoclear').addEventListener('click', () => { P.logoImage = null; left.querySelector('#plogofile').value = ''; left.querySelector('#plogoclear').style.display = 'none'; upd(); });
    el.append(left, right); upd();
    return el;
  }
  function partyIdeology(P) {
    const el = h('div', { class: 'grid c2' });
    const left = h('div', { class: 'panel' });
    left.innerHTML = `<h3>Huvudideologi</h3><p class="help">Välj en huvudideologi och upp till två sekundära. Sekundära ideologier drar positionerna mot sig (60/40). Systemfientliga ideologier isoleras av andra partier och medier – spelet simulerar konsekvenserna.</p><div class="tabs" id="fam"></div><div class="pick" id="ideo"></div>`;
    const right = h('div', { class: 'panel' });
    right.innerHTML = `<h3>Sekundära ideologier <small class="muted">(max 2)</small></h3><div class="chips" id="sec"></div><div class="card" style="margin-top:14px" id="summary"></div>`;
    let fam = IDEOLOGY_BY_ID[P.ideology.primary]?.family || 'vanster';
    const famEl = left.querySelector('#fam'), ideo = left.querySelector('#ideo'), sec = right.querySelector('#sec'), sum = right.querySelector('#summary');
    const drawFam = () => { famEl.innerHTML = ''; for (const [id, nm] of Object.entries(FAMILIES)) famEl.append(h('button', { class: id === fam ? 'on' : '', onclick: () => { fam = id; drawIdeo(); drawFam(); } }, nm)); };
    const drawIdeo = () => { ideo.innerHTML = ''; for (const I of IDEOLOGIES.filter((x) => x.family === fam)) { const o = h('div', { class: 'opt ' + (P.ideology.primary === I.id ? 'on' : '') }); o.innerHTML = `<b>${esc(I.name)}</b>${I.ext ? ` <span class="tag ${I.ext >= 3 ? 'red' : I.ext === 2 ? 'gold' : ''}">${I.ext >= 3 ? 'systemfientlig' : I.ext === 2 ? 'radikal' : 'utmanande'}</span>` : ''}<small>${esc(I.desc)}</small>`; o.addEventListener('click', () => { P.ideology.primary = I.id; P.ideology.secondary = P.ideology.secondary.filter((s) => s !== I.id); regenProgram(P); drawIdeo(); drawSec(); drawSum(); }); ideo.append(o); } };
    const drawSec = () => { sec.innerHTML = ''; for (const I of IDEOLOGIES) { if (I.id === P.ideology.primary) continue; const on = P.ideology.secondary.includes(I.id); const c = h('span', { class: 'chip ' + (on ? 'on' : ''), title: I.desc, onclick: () => { if (on) P.ideology.secondary = P.ideology.secondary.filter((s) => s !== I.id); else if (P.ideology.secondary.length < 2) P.ideology.secondary.push(I.id); else return; regenProgram(P); drawSec(); drawSum(); } }, I.name); sec.append(c); } };
    const drawSum = () => { const ext = extremismOf(P.ideology.primary, P.ideology.secondary), demo = demoOf(P.ideology.primary, P.ideology.secondary); const I = IDEOLOGY_BY_ID[P.ideology.primary]; const likes = [...new Set([I, ...P.ideology.secondary.map((id) => IDEOLOGY_BY_ID[id])].flatMap((x) => x.tags))].map((id) => SEGMENTS.find((s) => s.id === id)?.name).filter(Boolean); sum.innerHTML = `<b>${esc(ideologyLabel(P.ideology.primary, P.ideology.secondary))}</b><br><small class="muted">Naturlig dragningskraft: ${likes.join(', ') || 'bred'}</small><br><small>Extremism: ${['etablerad', 'utmanande', 'radikal', 'systemfientlig'][ext]}${(() => { const pe = programExtremism(P.program); return pe.items.length ? ` · programmet: <span class="danger">${esc(EXT_NAMES[pe.ext])}${pe.demo < 0 ? ' – ' + esc(DEMO_NAMES[pe.demo]) : ''}</span>` : ''; })()} · Demokratisyn: ${demo < -1 ? '<span class="danger">antidemokratisk – alla partier vägrar samarbete, medierna granskar hårt</span>' : demo < 0 ? '<span style="color:var(--orange)">skeptisk till institutionerna – svårare samarbeten</span>' : 'demokratisk'}</small>${P.tuned ? '<br><small class="muted">Obs: att byta ideologi bygger om programmet från grunden.</small>' : ''}<div style="margin-top:8px">${ISSUES.map((is) => `<span class="tag" title="${esc(is.name)}">${esc(is.short)} ${P.pos[is.id] > 0 ? '+' : ''}${P.pos[is.id]}</span>`).join(' ')}</div>`; };
    drawFam(); drawIdeo(); drawSec(); drawSum();
    el.append(left, right);
    return el;
  }
  function partyPolitics(P) {
    return partyPoliticsStep(P, { tab: polTab, setTab: (t) => { polTab = t; render(); }, ideologyName: ideologyLabel(P.ideology.primary, P.ideology.secondary) });
  }
  function partyOrganisation(P) {
    const el = h('div', { class: 'grid c2' });
    const S = P.structure;
    const left = h('div', { class: 'panel' });
    left.innerHTML = `<h3>Makt och stadgar</h3><p class="help">Hur partiet styrs avgör hur falanger, partiledarstrider och splittringar uppstår – och hur snabbt ni kan växa.</p>
      <div class="axis" id="cent"></div><div class="axis" id="makt"></div><div class="axis" id="lokal"></div>`;
    const slider = (id, name, l, r, key) => { const a = left.querySelector('#' + id); a.innerHTML = `<div class="name"><span style="color:var(--text)">${name}</span><span id="v">${S[key]}</span></div><div class="l">${l}</div><input type="range" min="0" max="100" value="${S[key]}"><div class="r">${r}</div>`; a.querySelector('input').addEventListener('input', (e) => { S[key] = +e.target.value; a.querySelector('#v').textContent = S[key]; drawSum(); }); };
    slider('cent', 'Centralisering', 'Medlemmarna bestämmer', 'Partiledningen bestämmer', 'centralisering');
    slider('makt', 'Partiledarens makt', 'Kollektivt ledarskap', 'Stark ledare', 'ledarmakt');
    slider('lokal', 'Lokal självständighet', 'Styrs från partikansliet', 'Fria lokalavdelningar', 'lokalAutonomi');
    const right = h('div', { class: 'panel' });
    right.innerHTML = `<h3>Så väljs människorna</h3>
      ${['ledarval', 'kandidatval', 'stadgar'].map((k) => `<div class="field"><label>${esc(STRUCTURE_OPTIONS[k].name)}</label><div class="pick" id="${k}">${STRUCTURE_OPTIONS[k].options.map((o) => `<div class="opt ${S[k] === o.id ? 'on' : ''}" data-v="${o.id}"><b>${esc(o.name)}</b><small>${esc(o.desc)}</small></div>`).join('')}</div></div>`).join('')}
      <div class="field"><label>Ungdomsförbund</label><div class="chips"><span class="chip ${S.ungdom ? 'on' : ''}" id="ungJa">Ja – rekryterar unga, kan bli radikalare än moderpartiet</span><span class="chip ${!S.ungdom ? 'on' : ''}" id="ungNej">Nej</span></div></div>
      <div class="card" id="orgsum"></div>`;
    for (const k of ['ledarval', 'kandidatval', 'stadgar']) right.querySelector('#' + k).addEventListener('click', (e) => { const o = e.target.closest('.opt'); if (!o) return; S[k] = o.dataset.v; right.querySelectorAll(`#${k} .opt`).forEach((x) => x.classList.toggle('on', x.dataset.v === S[k])); drawSum(); });
    right.querySelector('#ungJa').addEventListener('click', () => { S.ungdom = true; right.querySelector('#ungJa').classList.add('on'); right.querySelector('#ungNej').classList.remove('on'); drawSum(); });
    right.querySelector('#ungNej').addEventListener('click', () => { S.ungdom = false; right.querySelector('#ungNej').classList.add('on'); right.querySelector('#ungJa').classList.remove('on'); drawSum(); });
    const drawSum = () => { right.querySelector('#orgsum').innerHTML = structureSummary(S); };
    drawSum();
    el.append(left, right);
    return el;
  }
  function partyTargets(P) {
    const el = h('div', { class: 'grid c2' });
    const S = P.structure;
    const left = h('div', { class: 'panel' });
    left.innerHTML = `<h3>Vilka vänder ni er till? <small class="muted">(upp till 4 grupper)</small></h3><p class="help">Målgrupperna styr var ni knackar dörr, vilka frågor ni driver och vilket tonläge som fungerar. Få grupper = skarp profil. Många = bredare men svagare budskap. Siffran visar hur långt gruppen står från er politik just nu (lägre är bättre).</p><div class="pick" id="segs"></div>`;
    const segs = left.querySelector('#segs');
    const dist = (sg) => { let d = 0, w = 0; for (const is of ISSUES) { const ww = sg.w[is.id] || 1; d += ww * Math.abs((P.pos[is.id] || 0) - (sg.ideal[is.id] || 0)); w += ww; } return Math.round(d / w); };
    const draw = () => { segs.innerHTML = ''; for (const sg of SEGMENTS) { const on = S.malgrupper.includes(sg.id); const d = dist(sg); const o = h('div', { class: 'opt ' + (on ? 'on' : '') }); o.innerHTML = `<b>${esc(sg.name)}</b><small>${sg.share} % av väljarna · avstånd <span class="${d < 30 ? 'ok' : d > 55 ? 'danger' : ''}">${d}</span></small>`; o.addEventListener('click', () => { if (on) S.malgrupper = S.malgrupper.filter((x) => x !== sg.id); else if (S.malgrupper.length < 4) S.malgrupper.push(sg.id); draw(); }); segs.append(o); } };
    draw();
    const right = h('div', { class: 'panel' });
    right.innerHTML = `<h3>Sammanfattning</h3><div class="row" style="align-items:center"><div class="hero-logo">${logoSVG({ ...P, logo: { ...P.logo, glyph: P.abbr || '?' } }, 100)}</div><div><b style="font-size:20px">${esc(P.name || 'Partinamn')}</b> (${esc(P.abbr || '?')})<br><small class="muted">${esc(ideologyLabel(P.ideology.primary, P.ideology.secondary))}</small></div></div>
      <div style="margin-top:12px">${structureSummary(S)}</div>
      <p class="help" style="margin-top:12px">Du kan ändra stadgar och organisation senare via en partikongress – men det kostar sammanhållning.</p>`;
    el.append(left, right);
    return el;
  }
  // ---------- LEDAREN ----------
  function stepLeader() {
    const el = h('div', {});
    const box = h('div', {});
    leaderCreator = renderLeaderCreator(box, draft.leader, { rnd });
    el.append(box, nav(() => leaderCreator.validate()));
    return el;
  }

  // ---------- STARTA ----------
  function stepStart() {
    const el = h('div', { class: 'grid c2' });
    const L = draft.leader; const P = draft.mode === 'new' ? draft.party : START_PARTIES.find((p) => p.id === draft.takeoverId);
    const sum = h('div', { class: 'panel' });
    sum.innerHTML = `<h3>Sammanfattning</h3><div class="row" style="align-items:flex-start"><div class="hero-logo">${logoSVG({ ...P, logo: { ...P.logo, glyph: P.abbr } }, 120)}</div><div><b style="font-size:18px">${esc(P.name)} (${esc(P.abbr)})</b><br><small class="muted">${esc(P.slogan)}</small><br><small>${draft.mode === 'new' ? `Nytt parti – ${esc(ideologyLabel(P.ideology.primary, P.ideology.secondary))} · 150 medlemmar, 50 000 kr, 0 mandat` : `${P.seats} mandat i riksdagen`}</small></div></div>
      <div class="row" style="margin-top:14px;align-items:flex-start"><div class="face lg">${characterSVG({ look: L.look, age: L.age, gender: L.gender, sprite: L.sprite, spriteLook: L.spriteLook }, { crop: 'face', expr: 'confident', id: 'sum' })}</div><div><b style="font-size:18px">${esc(L.first)} ${esc(L.last)}</b>, ${L.age} år<br><small class="muted">${esc(L.bg.utbildning)} · ${esc(L.bg.hemstad)} · ${esc(L.bg.familj)}</small><br><small>Starkast: ${TRAITS.slice().sort((a, b) => L.traits[b.id] - L.traits[a.id]).slice(0, 3).map((t) => t.name.toLowerCase()).join(', ')}. Svagast: ${TRAITS.slice().sort((a, b) => L.traits[a.id] - L.traits[b.id]).slice(0, 2).map((t) => t.name.toLowerCase()).join(', ')}.</small></div></div>
      <p style="margin-top:14px" class="help">Spelet börjar måndagen den 4 januari 2027. Nästa riksdagsval hålls i september 2030. Allt sparas automatiskt.</p>`;
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
    const P = draft.party;
    return { mode: draft.mode, takeoverId: draft.takeoverId, slot: draft.slot,
      party: draft.mode === 'new' ? { name: P.name, abbr: P.abbr, color: P.color, color2: P.color2, logo: { ...P.logo, glyph: P.abbr }, slogan: P.slogan, pos: { ...P.pos }, program: { ...P.program }, profile: { ...P.profile }, ideology: { primary: P.ideology.primary, secondary: [...P.ideology.secondary] }, structure: { ...P.structure, malgrupper: [...P.structure.malgrupper] }, manifesto: P.manifesto || '', ideologyName: P.ideologyName || '', logoImage: P.logoImage || null } : null,
      leader: finalizeLeader(draft.leader) };
  }
  render();
}
const IDEOLOGY_HINT = { s: 'Socialdemokrati · störst, oppositionsledare', sd: 'Nationalkonservatism · regeringens stödparti', m: 'Liberalkonservatism · regeringsparti, statsministern', v: 'Socialism · opposition', c: 'Grön liberalism · opposition, mitten', kd: 'Kristdemokrati · regeringsparti', mp: 'Grön politik · opposition', l: 'Liberalism · regeringsparti, minst' };
