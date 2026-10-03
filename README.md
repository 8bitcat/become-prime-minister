# Become Prime Minister

En politisk strategisimulering av Sverige i webbläsaren. Ta över ett riksdagsparti eller
starta ett eget från noll, bygg opinion, vinn val, bilda regering och styr landet – eller
se allt rasa. Ingenting är förutbestämt: händelser, skandaler, nyheter och opinion växer
fram ur dina beslut, din ideologi, din partiledares personlighet och Sveriges utveckling.

Debatter, intervjuer och utfrågningar spelas som anime-scener i rättegångsspelens anda:
figurer med uttryck och poser, textruta med skrivmaskinstext, argumentval, publikmätare och
**INVÄNDNING!** när motståndaren motsäger sin egen röstning i riksdagen.

## Spela

Öppna `index.html` via en statisk server (ES-moduler kräver http):

```bash
node tools/serve.mjs 8790     # http://localhost:8790/
```

Allt sparas automatiskt i webbläsaren (tre sparplatser) efter varje handling och vecka.
Sparfilen kan exporteras/importeras som JSON från menyn.

## Innehåll (v0.1)

- **Två vägar**: ta över S, SD, M, V, C, KD, MP eller L (fiktiva partiledare) – eller skapa ett nytt
  parti med namn, logotyp, färger, slogan, ideologi på tolv axlar och hjärtefrågor.
- **Partiledaren**: utseende (anime-porträtt), bakgrund, tio egenskaper (karisma, retorik, lugn, …)
  som styr debatter, kriser, förhandlingar och skandalrisk.
- **Veckoloop** med handlingspoäng: presskonferens, turné, utspel, angrepp, medlemsvärvning,
  insamling, organisation, partiprogram, motioner, förhandlingar, relationer, kampanjhandlingar.
- **Sverige** simuleras månadsvis: ~150 nationella mätserier (ekonomi, finanser, skatter, utgifter,
  arbetsmarknad, vård/skola/omsorg, brott, klimat/energi, försvar, bostäder, demokrati) plus tio
  mått för vart och ett av 21 län. Reformer slår igenom med fördröjning.
- **Opinion**: 14 väljargrupper med egna ideal och viktning, vad som är hett just nu (salience),
  kännedom, lojalitet, momentum, ledareffekt, regeringens leverans, skandaler. Veckovisa mätningar
  från fem institut med husfel.
- **Riksdagen**: 50 lagförslag, AI-partier som föreslår och röstar efter ideologi och block,
  förhandlingar med motkrav, röstminne som kan användas i debatter, misstroendeförklaring.
- **Val**: jämkade uddatalsmetoden, 4 %-spärr, taktikröstning, valdeltagande per grupp, valnatt
  län för län. **Regeringsbildning** med talmansrundor, koalitioner, stödpartier och
  tolerans-omröstning (negativ parlamentarism), extraval efter fyra misslyckade rundor.
- **Regera**: ministrar (ombilda), budget i oktober (utgifter och skatter), regeringskris.
- **Medier**: dynamiska rubriker från SVT, Aftonbladet, Expressen, DN, SvD, TV4, Ekot m.fl.
- **Sociala medier**: X, Instagram, TikTok, Facebook – ton, format, räckvidd, följare, virala
  inlägg, inlägg som landar fel och gamla inlägg som grävs fram.
- **Skandaler** ur det som faktiskt händer (donationer, läckor, partimedlemmar, ministrar …) med
  sex sätt att svara. **Händelser** med val (kriser, strejker, terror, EU, NATO, grundlag …).
- **Omvärld**: 16 länder/organisationer med relationer, spänning, energichocker, migrationstryck.

## Utveckling

```bash
node tools/serve.mjs 8790        # dev-server
node tools/sim-test.mjs 220 new  # huvudlös simulering (220 veckor, nytt parti)
node tools/smoke.mjs             # röktest i webbläsaren (Playwright) → tools/out/*.png
node tools/val-test.mjs          # valrörelse, valnatt, regeringsbildning
node tools/shot.mjs "tools/portrait-preview.html?seed=7" tools/out/p.png   # figurgalleri
```

Släpp: `node tools/release.mjs minor --title "…" --scope … --notes n.md -- <filer>` →
`node tools/verify.mjs` → `git push origin main --follow-tags`.

Vanilla JS/ES-moduler, inga beroenden i spelet. Playwright hämtas från QISY-frontendens
`node_modules` för testerna.
