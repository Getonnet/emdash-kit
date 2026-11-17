# @getonnet/emdash-kit

Felles EmDash-oppsett for GetOnNet-prosjekter. Samme kontrollpanel og admin som AESTO og Trening For Deg, men som
én pakke: hvert prosjekt setter bare sine egne farger, navn og samlinger, og får forbedringer automatisk.

Brukes av: [getonnet-emdash](https://github.com/Getonnet/getonnet-emdash) og [attitude-tattoo](https://github.com/Getonnet/attitude-tattoo) (mørk modus, ekstra samling, e-post med logo).

**Kom i gang:** [How-to (PDF, 7 sider)](docs/emdash-kit-how-to.pdf) – ferdige prompter (også for å gjøre et statisk nettsted om til EmDash), hva hvert nettsted setter selv (farger, logo, skrift, egne tilpasninger), sjekkliste, do's and don'ts og skjermbilder. Kilden ligger i `docs/how-to-kilde/`.

## Hva kit-en gir

- **Kontrollpanel** på `/admin`: hilsen, snarveier etter rollen, besøksgraf med periodevelger, mest besøkte side,
  artiklene med besøk og status, og en veiledning. Norsk og engelsk.
- **Roller og tilganger** på `/admin/tilganger`: super admin, administrator, innholdsansvarlig, innholdsmedarbeider og
  lesetilgang, hvilke faner hver rolle ser, og «se som» en annen rolle.
- **EmDash-admin i prosjektets farger og skrift**: alltid lys (eller mørk, `brand.mode`) modus, ingen toppbar, brukeren med Logg ut nederst, Vibe
  Editor og Tilganger i menyen, skjulte menypunkter, navnet EmDash byttet med prosjektets, og riktig logo også i
  sammenslått meny.
- **Norsk admin**: rundt 2500 oversettelser (EmDash 1.5), norsk som standard (kan byttes under Innstillinger → Språk).
- **Automatisk utlogging ved midnatt** (norsk tid), med bryter under Innstillinger → Sikkerhet.
- **E-post** (invitasjoner, innloggingslenker) i prosjektets profil, alltid på norsk, via Cloudflare Email Sending.
- **Innlogging med e-postlenke**: knapper til Gmail, Outlook og iCloud Mail, riktig tjeneste først.
- **Besøksteller** uten cookies (roboter, skript og innloggede teller ikke).
- **Sikkerhet**: HSTS, hoveddomene (`NETTSTED` → 301 fra andre adresser), hurtigbuffer for bilder fra mediebiblioteket.
- **Bildekomprimering ved opplasting**: bilder krympes i nettleseren før de lastes opp (lengste side høyst 2560 px,
  JPEG forblir JPEG, PNG/WebP blir WebP, EXIF og GPS fjernes). Virker uten Cloudflare Images. `images`
- **Sporing og egne skript** (Google Tag Manager, Analytics, Meta Pixel o.l.): tre felt under Innstillinger → SEO
  i EmDash (i `<head>`, rett etter `<body>`, før `</body>`), bare for administratorer. `scripts`
- **SEO**: EmDash sine egne SEO-innstillinger (Innstillinger → SEO: tittelskille, standard delingsbilde, robots.txt,
  Google/Bing-verifisering) er synlige. SEO-feltene per side kommer fra samlingene (`"supports": [..., "seo"]`) og
  sidemalene (`getSeoMeta` og `<EmDashHead>`), se under.
- **Vibe Editor** koblet inn.

Det som er spesielt for nettstedet (sidene, malene, artikkelsidene, 404-siden osv.) ligger i prosjektet.

## Ta i bruk i et prosjekt

```sh
pnpm add "github:Getonnet/emdash-kit#semver:^1.0.0" emdash-vibe-editor
```

`astro.config.mjs`:

```js
import { defineKit } from "@getonnet/emdash-kit";

const kit = defineKit({
	brand: {
		name: "Kunde",
		logo: "/assets/img/logo.svg", // bredt ordmerke (meny, innlogging)
		icon: "/assets/img/ikon.svg", // kvadratisk ikon (sammenslått meny, dialoger)
		favicon: "/favicon.ico",
		tagline: { nb: "Kort undertittel", en: "Short tagline" },
		fontsCss: "/assets/css/admin-fonts.css", // @font-face for skriftene under
		font: "Figtree",
		headingFont: "Bricolage Grotesque",
		colors: { accent: "#EB5757", accentInk: "#C93838", wash: "#FFF4F4", ink: "#232323", paper: "#F1F0EE" /* … */ },
	},
	prefix: "kunde", // D1-tabeller kunde_settings, kunde_visits, kunde_user_roles; cookies kunde-*
	email: { from: { email: "cms@getonnet.cloud", name: "Kunde" }, company: "Kunde AS · Adresse · Telefon", wordmark: "KUNDE" },
	collections: {
		articles: { slug: "artikler", urlBase: "/artikler/", nb: { plural: "Artikler", singular: "Artikkel" }, en: { plural: "Articles", singular: "Article" } },
		pages: { slug: "sider", nb: { plural: "Sider", singular: "Side" }, en: { plural: "Pages", singular: "Page" } },
	},
	hooks: "./src/emdash-kit.ts", // valgfritt
	translations: "./translations/emdash-nb.json", // valgfritt: egne/overstyrte oversettelser
	extraHiddenAdminPaths: ["/settings/email"], // valgfritt: skjul flere EmDash-sider (i tillegg til standardlisten)
	vibeEditor: true, // false: uten Vibe Editor (pakken trenger da ikke være installert)
	// Fra 1.3.0, valgfrie (standardverdiene vises):
	images: { maxSize: 2560, quality: 0.82 }, // false: ingen komprimering ved opplasting
	scripts: true, // false: ingen felt for egne skript under Innstillinger → SEO
	// Fra 1.2.0, alle valgfrie:
	// brand.mode: "dark", brand.headingWeight: 600
	// collections.extra: [{ slug: "artister", tab: "artister", urlBase: "/artist/", icon: "user", nb: {…}, en: {…} }]
	// contentLocale: "nb" (innhold med oversettelser)
	// email.logo: { src: "/logo.png", width: 150, height: 51 }, email.links: { "22 20 13 13": "tel:+4722201313" }
});

export default defineConfig({
	// …
	integrations: [react(), emdash({ database, storage, ...kit.emdash }), kit.integration],
});
```

Alle farger (med standardverdier) står i `index.mjs` under `DEFAULTS.brand.colors`. Alt annet enn `prefix` og
`collections` har standardverdier: uten `logo` vises navnet som tekst, uten `icon` brukes logoen, uten `email.from`
sendes e-post slik EmDash gjør selv. Mangler `hooks`-filen, stopper byggingen med en tydelig feilmelding. Prosjektet trenger ikke egen
`src/middleware.ts`, `/admin`-sider eller `/api/besok` osv.; kit-en legger dem inn. Har prosjektet en egen middleware,
kjører kit-ens først.

Besøkstelleren på sidene:

```astro
---
import { BESOK } from "@getonnet/emdash-kit/besok";
---
<Fragment set:html={BESOK} />
```

`wrangler.jsonc` trenger bindingene `DB` (D1), `MEDIA` (R2), `EMAIL` (`send_email`) og variabelen `NETTSTED`.

### Hooks (prosjektets tilpasninger)

`src/emdash-kit.ts`:

```ts
import type { KitHooks } from "@getonnet/emdash-kit/config";

// Navn på sidene i «Mest besøkt» på kontrollpanelet (stien uten / til slutt, "/" for forsiden)
export const pageName: KitHooks["pageName"] = (path, lang) => (path === "/" ? (lang === "en" ? "Home page" : "Forsiden") : undefined);
```

## Oppdateringer

Kit-en følger [semver](https://semver.org): `1.x.y`.

- **Patch/minor (1.0.1, 1.1.0):** feilrettinger og nye funksjoner som ikke krever endringer i prosjektene. Prosjektene
  henter dem automatisk: arbeidsflyten `.github/workflows/oppdater-emdash.yml` i hvert prosjekt kjører hver morgen
  kl. 09.00 norsk tid,
  oppdaterer kit-en, EmDash og Vibe Editor innenfor samme hovedversjon, bygger, og committer og publiserer bare hvis
  byggingen går gjennom.
- **Major (2.0.0):** endringer som krever noe i prosjektene (nytt oppsett, ny config). Står i CHANGELOG.md med hva
  som må gjøres; oppdateres for hånd i hvert prosjekt.

Slik slippes en ny versjon:

1. Endre koden her, og oppdater `version` i `package.json` (`VERSION` i `index.mjs` leses derfra).
2. Skriv hva som er endret i `CHANGELOG.md`.
3. `git commit`, `git tag -a v1.0.1 -m "v1.0.1"`, `git push --follow-tags` (taggen må være annotert (`-a`), ellers sendes den ikke med).

Prosjektene får den ved neste kjøring (kl. 09.00 norsk tid), eller med en gang med «Run workflow» på «Oppdater EmDash» i prosjektet.

## SEO, skript og bilder i sidemalene

Kit-en setter ikke inn noe i selve sidene; det gjør sidemalene i prosjektet. For at SEO-feltene og de egne skriptene
skal virke, må hver sidemal (sider, artikler, 404) ha:

```astro
---
import { getSeoMeta } from "emdash";
import { EmDashHead, EmDashBodyStart, EmDashBodyEnd } from "emdash/ui";
import { createPublicPageContext } from "emdash/page";
const seo = getSeoMeta(entry, { siteUrl: Astro.url.origin, path: Astro.url.pathname });
const page = createPublicPageContext({ Astro, kind: "content", title: seo.title, description: seo.description, canonical: seo.canonical, image: seo.ogImage, seo: { robots: seo.robots }, content: { collection: "sider", id: entry.id } });
---
<head>… <EmDashHead page={page} /></head>
<body><EmDashBodyStart page={page} /> … <EmDashBodyEnd page={page} /></body>
```

og samlingene `"supports": ["drafts", "revisions", "seo", …]` i seed-filen. Se AESTO (`src/layouts/Site.astro`) for et
fullt eksempel med sitemap.xml.

Sporing som setter informasjonskapsler (GTM, Analytics, Meta Pixel) krever samtykke fra de besøkende; kit-en har ikke
eget samtykkebanner, så legg det inn sammen med skriptet (f.eks. Cookiebot eller CookieYes).

Bilder: originalene fra mediebiblioteket får 30 dagers hurtigbuffer. Komprimeringen skjer ved opplasting i
EmDash-admin (filvelger og dra-og-slipp); bilder lastet opp før 1.3.0, eller via Vibe Editor, endres ikke.

## Mobil

Kontrollpanelet, Tilganger og EmDash-admin er laget for telefon også: toppstripe med meny, logo og «Vis nettsted»
under 768 px, felt på minst 16 px (iOS forstørrer ellers siden), knapper store nok for fingeren, og «Se som»-stripen
innenfor skjermen. Test endringer i 390 px bredde (iPhone) i tillegg til datamaskin.

## Ved ny EmDash-versjon

Fra et prosjekt: `node node_modules/@getonnet/emdash-kit/vite-nb.mjs` viser hvor mange admin-tekster som fortsatt er
engelske. Legg nye oversettelser i `translations/emdash-nb.json` her, og slipp en ny patch-versjon.

## Struktur

- `index.mjs` – `defineKit()`: config, Astro-integrasjon (ruter, middleware, virtuell config-modul) og EmDash-oppsett
- `vite-nb.mjs` – norske oversettelser og bytte av navnet EmDash i admin
- `translations/emdash-nb.json` – oversettelsene
- `src/config.ts` – oppsettet på nettstedet, med avledede navn (tabeller, cookies, CSS-variabler `--ek-*`)
- `src/middleware.ts` – EmDash-admin, roller, utlogging, hoveddomene, HSTS
- `src/roller.ts`, `src/besok.ts`, `src/innstillinger.ts` – roller/faner, besøk, innstillinger (D1)
- `src/pages/admin/` – kontrollpanelet og Tilganger; `src/components/AdminSidebar.astro` – menyen der
- `src/pages/api/` – `besok`, `innstillinger`, `tilganger`, `epostleverandor`
- `src/email-plugin.ts` – e-post med prosjektets profil
- `src/scripts-plugin.ts` – egne skript på sidene (page:fragments); `src/admin-extra.ts` – bildekomprimering og skriptfeltene i admin
- `src/besok-snippet.ts` – skriptet for besøkstelleren på sidene
