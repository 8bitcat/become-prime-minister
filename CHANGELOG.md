# Nyheter i Become Prime Minister

Varje släpp får ett versionsnummer som syns nere till vänster i spelet. Varje version har en
git-tagg (`v0.1.0` osv.).

**Numreringen:** ny funktion → mittensiffran ökar, buggfix → sista siffran ökar.

<!-- släpp: tools/release.mjs lägger nya versioner direkt under denna rad -->

## [0.4.0] – 2026-10-04 – Du skriver dina egna svar
- Du väljer inte svar – du skriver dem själv. Inlägg, debattsvar, presskonferenser, tal, utspel, förhandlingsbud, erbjudanden i regeringsbildningen och enskilda samtal skrivs i fri text. Spelet läser vad du faktiskt skrev: ton (saklig, kämpande, konfrontativ, humor, personlig, undvikande), vilka sakfrågor du berör och åt vilket håll, om du svarar på frågan, löften med siffror, faktapåståenden mot den riktiga statistiken, angrepp på partier, vaghet och risk. Analysen är inbyggd och fungerar utan nätverk.
- Valfritt Claude-läge (☰ Meny → AI-läge): med en egen Anthropic-nyckel analyserar Claude dina texter och skriver journalisternas, motståndarnas, väljarnas och partiledarnas repliker. Nyckeln sparas bara i webbläsaren, anropen går direkt från din dator och du betalar själv.
- Politiskt minne: allt du skriver sparas med analys. Motsägelser mot partiprogrammet och mot vad du sagt förr upptäcks och används av journalister och motståndare. Gamla riskabla uttalanden grävs fram år senare – och du skriver själv hur du svarar (stå fast, ta tillbaka, byta fot, ingen kommentar). Konkreta löften med siffror sparas och granskas av medierna inför valet. "Allt du sagt" och "Löften i egna ord" på Historik-sidan.
- Sociala medier: skriv inlägget själv. Ett levande kommentarsfält med väljare (personas), motståndare, journalister och influerare som svarar på det du skrev. Svara i tråden (och riskera att bråka med väljare), radera inlägg (skärmdumpar kan spridas, journalisterna minns) eller rätta en felaktig siffra offentligt. Faktakoll när en siffra är fel. Virala memes.
- Debatter: skriv ditt svar med egna ord (eller utgå från ett förslag), rådgivaren bedömer texten medan du skriver – och kan ha fel. Journalister ställer följdfrågor när du inte svarar, nämner en fel siffra eller lovar något nytt. Motståndare avbryter dig med motfrågor. AI-politiker gör ibland faktafel som du kan avslöja med INVÄNDNING! Motståndarens replik skrivs utifrån vad du faktiskt sa.
- Presskonferens: skriv ditt uttalande, svara sedan på journalisternas frågor – i ämnet, utanför ämnet (skandalen, regeringskrisen, det heta ämnet) och om något du sagt förr. "Ingen kommentar" kostar. Rubriken skrivs av det du sa.
- Tal på turnén: skriv talet, publiken reagerar mening för mening (jubel, applåder, tystnad, burop), att nämna länet hjälper, floskler och fel siffror sänker.
- Utspel i fri text: löften med siffror registreras, vaga utspel flaggas av medierna.
- Förhandlingar: skriv ett motbud när ett parti ställer krav. Regeringsbildningen: skriv erbjudanden till varje parti (ministerposter, politik, löften) som påverkar deras vilja – hemliga uppgörelser som kan läcka med förtroendetapp.
- Enskilda samtal med partiledare, partikamrater (lojalitet, falanger) och journalister off record. Det du säger kan läcka.
- Fokusgrupp: rådgivaren samlar väljare – hur ni uppfattas, vilken ton ni har, vad ni aldrig sagt något om.
- Programförklaring och egen ideologi i egna ord när partiet skapas; löftena i den följs upp.
- Ministrar har egen vilja: protesterar offentligt mot reformer som går emot deras partis linje och kan avgå. Riksdagsledamöter bryter partilinjen när sammanhållningen är låg och linjen svag. Partiledaren blir trött av tempot – vila eller riskera "utbränd?"-rubriker.
- Figurerna: 40 tecknade karaktärer (20 kvinnor, 20 män, olika åldrar, hudtoner, frisyrer, kläder) genererade som karaktärsark i sex poser med Z-Image Turbo i ComfyUI och skivade till sprites med genomskinlig bakgrund. Alla personer i spelet matchas mot närmaste look; i ledarskaparen väljer du ur galleriet eller låter spelet matcha ditt utseende. SVG-dockan finns kvar som reserv.
- Nytt test tools/text-test.mjs (53 kontroller av fritextlagret). Gamla sparningar uppgraderas (sparformat 4).

## [0.3.0] – 2026-10-04 – Politiken bygger du själv
- Politiken är nu ett verktygssystem: 132 områden i 14 domäner (migration, skatter, ekonomi & ägande, arbetsmarknad, vård, socialförsäkringar, skola & forskning, brott & straff, fri- och rättigheter, statsskick, försvar, utrikes & EU, energi & klimat, infrastruktur & samhälle). Varje område är ett reglage eller en lag med gällande rätt i Sverige, ert partiprogram, effekter på simuleringen, kostnad och genomförandetid.
- Ideologin härleds ur politiken: partiets tolv väljaraxlar och en niodimensionell kompass (ekonomi, makt, omvärld, kultur, styrning, säkerhet, religion, välfärd, miljö) räknas ut ur programmet. Spelet berättar vilken ideologi din faktiska politik liknar – och partiprogrammet skrivs automatiskt.
- Reformer genom riksdagen: föreslå att en lag ändras, partierna röstar efter sina egna program (ett förslag nära deras program går lättare igenom). Som statsminister kostar varje reform politiskt kapital som växer tillbaka med tiden. Regeringsöverenskommelsen är kompromissen mellan regeringspartiernas program.
- Att besluta är inte att genomföra: varje reform har en genomförandetid (3 månader till 10 år), myndigheternas kapacitet bromsar när för många reformer pågår samtidigt, effekten kan bli större eller mindre än beräknat och en fjärdedel av reformerna får oavsiktliga bieffekter.
- Grundlagsändringar (domstolar, yttrandefrihet, medier, statsskick, riksdagsspärr, mandatperiod, valsystem, regeringsmakt) kräver två riksdagsbeslut med ett val emellan.
- Gränsfallen finns: lämna EU eller NATO, basinkomst, bidragssystemet avskaffat, nationaliserade banker och industrier, 90 procent kärnkraft, massutvisningsprogram, republik, statskyrka, massövervakning, majoritetsval – alla med simulerade konsekvenser för ekonomi, demokratiindex, relationer, protester och opinion.
- Spärren, mandatperioden och valsystemet följer nu gällande lag; AI-regeringar driver reformer mot sitt program och AI-partierna flyttar sig genom att ändra sitt program.
- Budgeten skriver in sig i lagen, och lagförslag som rör skatter och utgifter håller lagen uppdaterad.
- Ny sida "Politiken", reformer under genomförande och politiskt kapital på Regeringen-sidan, kompass och härledd ideologi på Partiet-sidan. Gamla sparningar uppgraderas.

## [0.2.0] – 2026-10-04 – Partiet och personen – på riktigt
- Partiskaparen i fem steg: identitet, ideologi (51 ideologier – huvudideologi plus upp till två sekundära som drar positionerna mot sig; systemfientliga och antidemokratiska ideologier isoleras av andra partier och medier), finjusterad politik och hjärtefrågor, organisation (centralisering, partiledarens makt, lokal självständighet, hur ledare och kandidater utses, stadgar, ungdomsförbund) och målgrupper (upp till fyra väljargrupper).
- Personskaparen: vanliga människor i anime-grafik – kroppstyp, 19 frisyrer, näsa, ögonform, fräknar, födelsemärken, örhängen, läppstift, 27 plagg från kostym till hoodie och arbetsjacka med egna färger, stil (formell/avslappnad/folklig/elegant), röst, kroppsspråk, 40 yrken med trovärdighet i sakfrågor, politisk erfarenhet, civilstånd, barn, livsåskådning, upp till fyra personlighetsdrag som justerar egenskaperna och låser upp beteenden, samt en offentlig image som kan krocka med personligheten (äkthetsrisk).
- Alla AI-politiker, ministrar och journalister slumpas med samma bakgrund, personlighet och utseende – ingen ser ut som en annan.
- Partiets inre liv: falanger med humör och krav, partiledarstrider där du kan förlora posten, partisplittringar som skapar nya partier (som tar med sig mandat, medlemmar och väljare), aktivister, partikongress för att ändra stadgar och organisation, partiekonomi rad för rad.
- Lämna partiledarposten: välj efterträdare bland partiets profiler eller skapa en ny ledare – världen fortsätter, den gamla ledaren får en biografi i historiken. Utmanare och ålder kan tvinga fram samma sak.
- Förtroende skilt från popularitet: valmanifest med 3–5 löften, löfteskollen vid nästa valrörelse, erkända fel ger förtroende och avslöjade lögner kostar.
- Journalister som individer med bevakningsområde, relation och minne – fientliga journalister ställer tuffare frågor. Politiska influerare och poddar hyllar eller sågar dig och bjuder in till inspelning (humor fungerar bäst där).
- Kommun- och regionval samma dag som riksdagsvalet: kommuner med mandat och regionmandat ger partistöd, organisation och kännedom.
- Nya AI-partier föds där stora väljargrupper saknar företrädare; partier som misslyckas i två val läggs ned.
- Debatter: humor för humoristiska ledare, personliga berättelser ur yrket, röst och kroppsspråk påverkar, trovärdighet i sakfrågor ger bonus.
- Historik med politisk tidslinje, partiledare genom tiderna och biografier.
- Gamla sparningar uppgraderas automatiskt till det nya formatet.

## [0.1.0] – 2026-10-03 – Första spelbara versionen
- Ta över ett riksdagsparti eller skapa ett nytt: namn, logotyp, färger, slogan, ideologi på tolv axlar, hjärtefrågor.
- Skapa partiledaren: anime-porträtt (frisyr, hår, hud, ögon, glasögon, skägg, kläder), bakgrund och tio egenskaper med poängfördelning.
- Veckoloop med handlingspoäng: presskonferens, turné, utspel, angrepp, medlemsvärvning, insamling, organisation, partiprogram, motioner, förhandlingar, relationer, reklam och dörrknackning i valrörelsen.
- Sverige som levande simulering: ~150 nationella mätserier och 21 län, uppdateras varje månad med fördröjda reformeffekter.
- Opinion med 14 väljargrupper, kännedom, lojalitet, momentum, skandaler, regeringens leverans; mätningar från fem institut.
- Riksdagen: 50 lagförslag, omröstningar, förhandlingar med motkrav, röstminne, misstroendeförklaring.
- Val med jämkade uddatalsmetoden och 4 %-spärr, valnatt län för län, regeringsbildning med talmansrundor och tolerans-omröstning, extraval.
- Regera: ministrar, budget i oktober, regeringskriser.
- Debatter, TV-debatter, partiledardebatter och utfrågningar som anime-scener med INVÄNDNING!, publikmätare, uttryck och poser.
- Nyhetsflöde från svenska medier, sociala medier med fyra plattformar, skandaler, händelser med val, omvärld med 16 länder/organisationer.
- Allt sparas automatiskt (tre platser) och kan exporteras/importeras som fil.
