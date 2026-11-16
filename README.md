# @getonnet/emdash-kit

Felles EmDash-oppsett for GetOnNet-prosjekter. Samme kontrollpanel og admin som AESTO og Trening For Deg, men som
én pakke: hvert prosjekt setter bare sine egne farger, navn og samlinger, og får forbedringer automatisk.

Brukes av: [getonnet-emdash](https://github.com/Getonnet/getonnet-emdash).

**Kom i gang:** [How-to (PDF, 4 sider)](docs/emdash-kit-how-to.pdf) – ferdige prompter, sjekkliste, do's and don'ts og skjermbilder.

## Hva kit-en gir

- **Kontrollpanel** på `/admin`: hilsen, snarveier etter rollen, besøksgraf med periodevelger, mest besøkte side,
  artiklene med besøk og status, og en veiledning. Norsk og engelsk.
- **Roller og tilganger** på `/admin/tilganger`: super admin, administrator, innholdsansvarlig, innholdsmedarbeider og
  lesetilgang, hvilke faner hver rolle ser, og «se som» en annen rolle.
- **EmDash-admin i prosjektets farger og skrift**: alltid lys modus, ingen toppbar, brukeren med Logg ut nederst, Vibe
  Editor og Tilganger i menyen, skjulte menypunkter, navnet EmDash byttet med prosjektets, og riktig logo også i
  sammenslått meny.
- **Norsk admin**: rundt 2500 oversettelser (EmDash 1.5), norsk som standard (kan byttes under Innstillinger → Språk).
- **Automatisk utlogging ved midnatt** (norsk tid), med bryter under Innstillinger → Sikkerhet.
- **E-post** (invitasjoner, innloggingslenker) i prosjektets profil, alltid på norsk, via Cloudflare Email Sending.
- **Innlogging med e-postlenke**: knapper til Gmail, Outlook og iCloud Mail, riktig tjeneste først.
- **Besøksteller** uten cookies (roboter, skript og innloggede teller ikke).
- **Sikkerhet**: HSTS, hoveddomene (`NETTSTED` → 301 fra andre adresser), hurtigbuffer for bilder fra mediebiblioteket.
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
  henter dem automatisk: arbeidsflyten `.github/workflows/oppdater-emdash.yml` i hvert prosjekt kjører hver natt,
  oppdaterer kit-en, EmDash og Vibe Editor innenfor samme hovedversjon, bygger, og committer og publiserer bare hvis
  byggingen går gjennom.
- **Major (2.0.0):** endringer som krever noe i prosjektene (nytt oppsett, ny config). Står i CHANGELOG.md med hva
  som må gjøres; oppdateres for hånd i hvert prosjekt.

Slik slippes en ny versjon:

1. Endre koden her, og oppdater `version` i `package.json` (`VERSION` i `index.mjs` leses derfra).
2. Skriv hva som er endret i `CHANGELOG.md`.
3. `git commit`, `git tag v1.0.1`, `git push --follow-tags`.

Prosjektene får den ved neste nattlige kjøring, eller med en gang med «Run workflow» på «Oppdater EmDash» i prosjektet.

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
- `src/besok-snippet.ts` – skriptet for besøkstelleren på sidene
