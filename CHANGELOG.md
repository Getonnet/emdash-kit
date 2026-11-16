# Endringer

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
