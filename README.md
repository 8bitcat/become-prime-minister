# Become Prime Minister

En politisk strategisimulering av Sverige i webbläsaren. Ta över ett riksdagsparti eller
starta ett eget från noll, bygg opinion, vinn val, bilda regering och styr landet – eller
se allt rasa. Ingenting är förutbestämt: händelser, skandaler, nyheter och opinion växer
fram ur dina beslut, din ideologi, din partiledares personlighet och Sveriges utveckling.

Debatter, intervjuer och utfrågningar spelas som anime-scener i rättegångsspelens anda:
figurer med uttryck och poser, textruta med skrivmaskinstext, publikmätare och
**INVÄNDNING!** när motståndaren motsäger sin egen röstning – eller har fel siffror.

**Du väljer inte svar – du skriver dem själv.** Inlägg, debattsvar, presskonferenser, tal,
utspel, förhandlingsbud, erbjudanden i regeringsbildningen och enskilda samtal skrivs i fri
text. Spelet läser vad du faktiskt skrev (ton, sakfrågor, om du svarar på frågan, löften med
siffror, faktapåståenden, angrepp, motsägelser mot vad du sagt förr) och låter världen reagera:
kommentarsfält, följdfrågor, avbrott, faktakoll, läckor, framgrävda uttalanden och löfteskoll.
Analysen är inbyggd och fungerar utan nätverk. Lägger du in en egen Anthropic-nyckel under
☰ Meny → AI-läge läser **Claude** dina texter i stället och skriver journalisternas,
motståndarnas och väljarnas repliker. Nyckeln stannar i din webbläsare.

## Spela

Öppna `index.html` via en statisk server (ES-moduler kräver http):

```bash
node tools/serve.mjs 8790     # http://localhost:8790/
```

Allt sparas automatiskt i webbläsaren (tre sparplatser) efter varje handling och vecka.
Sparfilen kan exporteras/importeras som JSON från menyn.

## Innehåll

- **Två vägar**: ta över S, SD, M, V, C, KD, MP eller L (fiktiva partiledare) – eller skapa ett nytt
  parti i fem steg: identitet, ideologi (51 ideologier, huvud + sekundära, med konsekvenser),
  finjusterad politik på tolv axlar och hjärtefrågor, organisation (centralisering, ledarmakt,
  ledarval, kandidatval, stadgar, ungdomsförbund, lokal autonomi, bredd) och målgrupper.
- **Partiledaren**: vanliga människor i anime-grafik – kroppstyp, 19 frisyrer, 27 plagg med egna
  färger, ansiktsdetaljer, stil, röst, kroppsspråk, 40 yrken med trovärdighet i sakfrågor, politisk
  erfarenhet, familj, livsåskådning, personlighetsdrag och offentlig image (äkthet). Tio egenskaper
  styr debatter, kriser, förhandlingar och skandalrisk. Ett galleri med 40 tecknade figurer
  (genererade karaktärsark i sex poser, `assets/chars/`) väljs ur eller matchas mot utseendet;
  SVG-dockan är reserv.
- **Fri text överallt**: inlägg med levande kommentarsfält (väljare, motståndare, journalister,
  influerare – och du kan svara, radera eller rätta dig), debatter där du skriver svaret och
  journalister ställer följdfrågor när du inte svarar, motståndare som avbryter och kan ha fel
  siffror, presskonferenser med frågor i och utanför ämnet, tal som publiken reagerar på mening för
  mening, utspel där löften med siffror följs upp, motbud i förhandlingar, skriftliga erbjudanden i
  regeringsbildningen (hemliga uppgörelser som kan läcka), enskilda samtal med partiledare,
  partikamrater och journalister off record (som kan läcka), fokusgrupper, ett politiskt minne av
  allt du sagt (motsägelser, framgrävda uttalanden), faktakoll, programförklaring och egen ideologi
  i egna ord, ministrar som protesterar eller avgår, ledamöter som bryter partilinjen, trötthet.
- **Politiken som verktygssystem**: 132 områden i 14 domäner med gällande lag, partiprogram,
  effekter, kostnad och genomförandetid. Ideologi och kompass härleds ur programmet. Reformer röstas i
  riksdagen efter partiernas program, kostar politiskt kapital, genomförs med fördröjning, bromsas av
  myndigheternas kapacitet och kan få oavsiktliga konsekvenser. Grundlagsändringar kräver två beslut
  med val emellan. Lämna EU eller NATO, inför basinkomst, nationalisera, bygg 90 % kärnkraft.
- **Partiets inre liv**: falanger, partiledarstrider, partisplittringar som föder nya partier,
  aktivister, partikongresser, ekonomi rad för rad. Lämna posten och fortsätt med en efterträdare.
- **Förtroende & löften**: valmanifest, löfteskollen, förtroende skilt från popularitet.
- **Medier som individer**: journalister med bevakningsområde, relation och minne; politiska
  influerare och poddar. Kommun- och regionval. AI-partier som föds och dör. Historik med tidslinje
  och biografier.
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
node tools/text-test.mjs         # fritextlagret: analys, minne, debattsvar, tal, samtal …
node tools/shot.mjs "tools/portrait-preview.html?seed=7" tools/out/p.png   # figurgalleri
node tools/comfy-chars.mjs       # generera karaktärsark med Z-Image Turbo i ComfyUI (127.0.0.1:8188)
python tools/slice-chars.py      # skiva arken till assets/chars/<id>/<pose>.webp + manifest.json
```

Släpp: `node tools/release.mjs minor --title "…" --scope … --notes n.md -- <filer>` →
`node tools/verify.mjs` → `git push origin main --follow-tags`.

Vanilla JS/ES-moduler, inga beroenden i spelet. Playwright hämtas från QISY-frontendens
`node_modules` för testerna.
