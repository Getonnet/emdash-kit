# Endringer

## 1.6.0-beta.3 – 24. nov 2026

Forhåndsversjon, bare i getonnet-emdash.

- **Raskere innlogging med passord:** stengning og bruker hentes i én tur til databasen, og resultatet (feil forsøk
  eller sist innlogget) lagres i én tur til, i stedet for opptil 10 spørringer etter hverandre. Tabellene lages med
  én spørring. «Har passord» huskes i minnet, så sidene i admin slipper en databasespørring hver gang.

## 1.6.0-beta.2 – 24. nov 2026

Forhåndsversjon, bare i getonnet-emdash.

- **Innstillinger → Sikkerhet uten passord:** åpnes siden direkte (uten `?passord=ny`) av en bruker som ikke har
  passord ennå, står det nå «Lag et passord for å fortsette» i stedet for teksten for brukere som har passord.

## 1.6.0-beta.1 – 24. nov 2026

Forhåndsversjon, bare i getonnet-emdash. Ingen endringer kreves i prosjektene.

- **Innlogging med e-post og passord i stedet for passnøkkel:** innloggingssiden viser e-post og passord, og
  «Glemt passordet?» sender EmDash sin innloggingslenke. Invitasjoner ber om navn og passord. Under Innstillinger →
  Sikkerhet lager eller bytter man passord; passnøklene er skjult der. Brukere uten passord (alle som finnes fra før)
  sendes dit og må lage et før de kommer videre i admin. Passordene lagres som PBKDF2-SHA256 (100 000 runder) i
  D1-tabellen `<prefix>_passwords`. 5 feil forsøk per e-post (30 per IP-adresse) på 15 minutter stenger innloggingen
  i 15 minutter (`<prefix>_login_attempts`). Nye API-er: `/api/passord`, `/api/passord/logg-inn`,
  `/api/passord/invitasjon`. Ny avhengighet: `@emdash-cms/auth` (samme pakke som EmDash bruker).
  Under Brukere viser «Sist innlogget» innloggingene med passord (`<prefix>_last_logins`; EmDash regner det ellers ut
  fra passnøklene), og passnøkkel-kolonnen og -boksen er skjult. «Send gjenopprettingslenke» sender en
  innloggingslenke, så brukeren kan bytte passord under Sikkerhet.
  Merk: første administrator på et helt nytt nettsted lages fortsatt med passnøkkel i EmDash sitt oppsett, og bytte
  av passord logger ikke ut andre innlogginger (de utløper ved midnatt når automatisk utlogging er på).
- **Utvidelser for super admin:** nytt menypunkt etter Tilganger (EmDash-admin og `/admin`) med installerte plugins
  og versjonene deres. Bare super admin får åpne siden. Kit-ens egne plugins heter «emdash-kit · e-post» og
  «emdash-kit · skript og Vibe Editor-plassering» og viser kit-versjonen (før alltid 1.0.0).

## 1.5.0 – 18. nov 2026

Ingen endringer kreves i prosjektene. Prosjekter som har `emdash-vibe-editor` i package.json kan beholde den.

- **Vibe Editor-bryteren flyttes hvis noe ligger over den:** ligger f.eks. en chat-knapp nede til høyre over Vibe
  Editor sin bryter, flyttes bryteren (og knappene over den) mot venstre til den kan klikkes. Bare for innloggede
  redaktører; gjelder også i redigeringsmodus.

## 1.5.0-beta.1 – 18. nov 2026

Forhåndsversjon, bare i getonnet-emdash. Alt under er med i 1.5.0. Prosjekter som har `emdash-vibe-editor` i package.json kan beholde den.

- **Vibe Editor følger med kit-en:** `emdash-vibe-editor` er nå en vanlig avhengighet av kit-en, så nye prosjekter
  trenger bare `pnpm add "github:Getonnet/emdash-kit#semver:^1.0.0"`. På som standard; `vibeEditor: false` slår av.
  Kit-en peker EmDash til sin egen kopi av pakken, så det virker også når prosjektet ikke har pakken selv (pnpm).
- **Vibe Editor etter innlogging via `/admin`:** kontrollpanelet setter flagget Vibe Editor trenger på nettsiden
  (før ble det bare satt i EmDash-adminen), for roller med fanen «Vibe Editor».
- **«Sjekk e-posten din»:** Gmail-knappen åpner `mail.google.com/mail/?authuser=<e-post>` i stedet for
  `/mail/u/<e-post>/`, som ga «Temporary Error» når akkurat den kontoen ikke var logget inn i nettleseren.

## 1.4.0 – 17. nov 2026

Ingen endringer kreves i prosjektene for å få bryteren. For at GitHub skal lese den, må «Oppdater EmDash» i prosjektet
ha `SITE` og sjekken mot `/api/auto-oppdatering` i jobben «tid» (se `maler/oppdater-emdash.yml`). Uten den oppdateres
nettstedet som før.

- **Bryter for automatisk oppdatering:** «Oppdater nettstedet automatisk» under Innstillinger → Sikkerhet i EmDash
  (bare administratorer, på som standard). Slått av hopper arbeidsflyten over kjøringen kl. 09.00; «Run workflow»
  virker fortsatt. Svarer ikke nettstedet, kjører arbeidsflyten likevel, så en feilretting kan komme ut.
- Nytt åpent endepunkt `/api/auto-oppdatering` (`{ "autoUpdate": true|false }`), og `/api/innstillinger` gir og tar `autoUpdate`.
- Repo-variabelen `EMDASH_AUTO_UPDATE` = `false` i GitHub virker fortsatt og overstyrer.

## 1.3.0 – 17. nov 2026

Ingen endringer kreves i prosjektene. Begge funksjonene er på som standard og kan slås av.

- **Bildekomprimering ved opplasting:** bilder krympes i nettleseren før EmDash laster dem opp (filvelger og
  dra-og-slipp): lengste side høyst 2560 px, JPEG forblir JPEG, PNG og WebP blir WebP (gjennomsiktighet beholdes),
  EXIF og GPS-posisjon fjernes. Små bilder og bilder som ikke blir mindre lastes opp som de er. Virker uten
  Cloudflare Images. `images: { maxSize, quality }` eller `images: false`.
- **Sporing og egne skript:** tre felt under Innstillinger → SEO i EmDash (i `<head>`, rett etter `<body>`, før
  `</body>`) for Google Tag Manager, Analytics, Meta Pixel o.l. Bare administratorer. Settes inn på alle sider med
  `<EmDashHead>`/`<EmDashBodyStart>`/`<EmDashBodyEnd>`, innen et halvt minutt etter lagring. `scripts: false` slår av.
- `/api/innstillinger` gir og tar også `scripts`.

## 1.2.1 – 16. nov 2026

Ingen endringer kreves i prosjektene.

- **Brukermenyen:** lange e-postadresser og navn brytes over flere linjer i stedet for å stikke ut av boksen
  (EmDash-admin og kontrollpanelet).

## 1.2.0 – 16. nov 2026

Ingen endringer kreves i prosjektene. Nye valg (alle valgfrie), hentet fra Attitude Tattoo Studio:

- **Mørk modus:** `brand.mode: "dark"` gir mørk EmDash-admin, kontrollpanel, Tilganger og e-post (standard `"light"`, som før).
  Nye farger med standardverdier: `darkText` (tekst på mørke flater, før fast hvit), `sand`/`sandInk` (merkelappen
  Utkast) og `shadow` (skygger; standard tekstfargen i lys modus, svart i mørk). `brand.headingWeight` (standard 400).
- **Flere samlinger:** `collections.extra: [{ slug, tab, urlBase?, icon?, nb, en }]` gir hver samling en egen fane i
  menyen og under Tilganger (sperres som Artikler og Sider), og navn under «Mest besøkt» når `urlBase` er satt.
- **Oversatt innhold:** `contentLocale` (f.eks. `"nb"`) lister bare ett språk på kontrollpanelet.
- **hooks.pageName** får et tredje argument, `named(path)`, med navnet kit-en selv finner (artikler og ekstra samlinger).
- **E-post:** `email.logo` ({ src, width, height }, PNG/JPG) i stedet for ordmerket som tekst, `email.links` gjør deler
  av firmalinjen til lenker i bunntekstens farge (ellers gjør Gmail adresse og telefon blå), og `email.headingFont`.
- **Alle prosjekter:** hovedknappene («Lagre», «Publiser») og brytere/avkrysningsbokser i EmDash bruker hovedfargen
  (før EmDash-blå), og ugyldige valg (`brand.mode`, `collections.extra`) gir tydelig feilmelding.

## 1.1.0 – 16. nov 2026

Ingen endringer kreves i prosjektene.

- **Mobil:** toppstripe med meny, logo og «Vis nettsted» på kontrollpanelet, Tilganger og EmDash-admin (før: en løs
  menyknapp over innholdet og en tom stripe i EmDash). Snarveiene på kontrollpanelet vises som en liste. Felt er
  16 px, så iOS ikke forstørrer siden. Større knapper, filtrene sveipes sidelengs, besøksgrafen kan dras med
  fingeren, og «Se som»-stripen holder seg innenfor skjermen. Lukket meny er utenfor tab-rekkefølgen, og siden låses
  mens menyen er åpen. Logoen på innloggingen har fornuftig størrelse.
- **Gjenbruk i andre prosjekter:** Vibe Editor kan slås av (`vibeEditor: false`), og pakken er da valgfri; fanene for
  Vibe Editor forsvinner fra Tilganger. Nytt valg `extraHiddenAdminPaths`. Uten logo vises navnet som tekst, uten
  ikon brukes logoen. Tydelige feil og advarsler for manglende hooks-fil, oversettelsesfil eller samlinger.
  `VERSION` leses fra package.json.
- **Besøksteller:** sider med æøå i adressen telles (lagres som vanlig tekst), og sider som bare begynner med
  «/admin» (f.eks. /administrasjon) telles også.
- **Tilganger:** rollene sjekkes før noe lagres, ukjente brukere avvises, og feil gir en melding i stedet for krasj.
- **Ellers:** norsk-som-standard-videresendingen gjelder bare sidevisninger (ingen løkke for andre forespørsler),
  Gmail-knappen virker uten avsenderadresse, e-posten bruker kortfargen fra oppsettet, og «Se som»-knappen bruker
  tekstfargen for hovedfargen.

## 1.0.0 – 16. nov 2026

Første versjon, hentet ut av getonnet-emdash (som igjen bygger på AESTO og Trening For Deg).

- Kontrollpanel (`/admin`), Roller og tilganger (`/admin/tilganger`), API-er (`/api/besok`, `/api/innstillinger`,
  `/api/tilganger`, `/api/epostleverandor`) og middleware legges inn av `defineKit().integration`.
- Farger, skrift, logo, ikon, navn, firmaopplysninger, D1-forstavelse og samlinger fra config (`defineKit({...})`).
- E-post-plugin med prosjektets profil, norske oversettelser (EmDash 1.5) og Vibe Editor via `defineKit().emdash`.
- Norsk som standard i EmDash-admin; sammenslått meny viser ikonet og har riktig justering; stilt 404 i prosjektet.
