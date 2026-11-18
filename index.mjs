// @getonnet/emdash-kit — felles EmDash-oppsett for GetOnNet-prosjekter (samme som AESTO og Trening For Deg).
//
// Bruk i et prosjekt (astro.config.mjs):
//   import { defineKit } from "@getonnet/emdash-kit";
//   const kit = defineKit({ brand: {...}, prefix: "kunde", email: {...}, collections: {...}, hooks: "./src/emdash-kit.ts" });
//   integrations: [react(), emdash({ database, storage, ...kit.emdash }), kit.integration]
//
// Kit-en legger inn: kontrollpanel (/admin, /admin/tilganger), API-er (/api/besok, /api/innstillinger,
// /api/tilganger, /api/epostleverandor, /api/auto-oppdatering), middleware (EmDash-admin i prosjektets farger, roller og tilganger,
// utlogging ved midnatt, hoveddomene, HSTS), e-post med prosjektets profil, norske oversettelser, Vibe Editor,
// felt for egne skript (GTM o.l.) og komprimering av bilder ved opplasting.
// Alt som er spesielt for prosjektet (navn, farger, skrift, logo, firmaopplysninger, samlinger) kommer fra config.
// Selve nettsiden (sider, maler, artikkelsider) ligger i prosjektet.
//
// Skrevet som vanlig JavaScript: Node leser astro.config.mjs før Vite, og Node fjerner ikke TypeScript i node_modules.
// Filene under src/ er TypeScript/Astro og bygges av Vite som en del av nettstedet.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";
import emdashNb from "./vite-nb.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url)).replaceAll("\\", "/");

/** Versjonen fra package.json (ett sted å endre ved ny versjon) */
export const VERSION = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

// Vibe Editor følger med kit-en (avhengighet i package.json), og er på som standard (defineKit({ vibeEditor: false }) slår av).
// Prosjektet trenger ikke installere pakken selv. Faller tilbake til ingen Vibe Editor hvis pakken mangler.
const vibeEditor = await import("emdash-vibe-editor").then(
	(m) => m.default,
	(error) => {
		if (error?.code === "ERR_MODULE_NOT_FOUND" && String(error.message).includes("emdash-vibe-editor")) return null;
		throw error;
	},
);

/** Standardverdier. Alt kan overstyres i defineKit({...}). */
const DEFAULTS = {
	brand: {
		name: "Nettstedet",
		// Logo i menyen og på innloggingen (gjerne et bredt ordmerke), og et kvadratisk ikon (sammenslått meny, dialoger)
		logo: "",
		icon: "",
		favicon: "",
		// Undertittel på kontrollpanelet («eyebrow»)
		tagline: { nb: "", en: "" },
		// Stilark med @font-face for skriftene under (lastes i admin og på kontrollpanelet)
		fontsCss: "",
		font: "system-ui",
		headingFont: "system-ui",
		// Vekt på titlene (400 passer en serif/display-skrift, 600 en vanlig grotesk)
		headingWeight: 400,
		// "light" eller "dark": EmDash-admin, kontrollpanelet og e-postene vises alltid i denne modusen
		mode: "light",
		colors: {
			paper: "#F3F2EF", // bakgrunn
			paperDeep: "#E9E7E3", // dypere bakgrunn (bilder som lastes)
			card: "#FFFFFF", // kort og paneler
			ink: "#1F1F1F", // tekst
			muted: "#5E5C58", // dempet tekst
			line: "#E2E0DC", // linjer og rammer
			lineStrong: "#C9C5BF", // rammer ved hover
			interact: "#D6D2CC", // knapper ved trykk, av-bryter
			label: "#8A8781", // små etiketter i store bokstaver
			dark: "#1F1F1F", // mørke flater (hovedsnarvei, verktøytips)
			darkAlt: "#3A3836", // andre farge i mørke gradienter
			accent: "#2563EB", // hovedfarge (knapper, aktive menypunkter)
			accentHover: "#1D4ED8",
			accentText: "#FFFFFF", // tekst på hovedfargen
			accentInk: "#1D4ED8", // lenker og fremhevet tekst (god kontrast på hvitt)
			wash: "#EEF2FF", // lys bakgrunn for aktive menypunkter
			onDarkAccent: "#93C5FD", // ikoner på mørke flater
			onDarkMuted: "#E2E0DC", // dempet tekst på mørke flater
			grid: "#EEECE8", // rutenett i grafen
			darkText: "#FFFFFF", // tekst på mørke flater (dark/darkAlt)
			sand: "#F3EAD8", // merkelapp «Utkast» o.l.
			sandInk: "#7B5C27",
			shadow: "", // farge på skygger; tom = tekstfargen (lys modus) eller svart (mørk modus)
		},
	},
	// Forstavelse for D1-tabeller (<prefix>_settings, <prefix>_visits, <prefix>_user_roles), cookies og økt
	prefix: "kit",
	email: {
		// Avsender (Cloudflare Email Sending må være aktivert for domenet)
		from: null, // { email: "cms@getonnet.cloud", name: "Navn" }
		company: "", // én linje nederst i e-postene
		// Ordmerket øverst i e-posten (tekst, fordi Gmail/Outlook ikke viser SVG)
		wordmark: "",
		// Logo som bilde i stedet for ordmerket: { src: "/logo.png", width: 150, height: 51 } (PNG/JPG, ikke SVG)
		logo: null,
		// Tekst i firmalinjen som skal være lenker, f.eks. { "22 20 13 13": "tel:+4722201313" }
		// (ellers gjør Gmail adresser og telefonnumre til blå lenker)
		links: {},
		// Skrift i titlene i e-posten (systemskrift som standard), f.eks. "Georgia, serif"
		headingFont: "",
	},
	collections: {
		articles: { slug: "artikler", urlBase: "/artikler/", nb: { plural: "Artikler", singular: "Artikkel" }, en: { plural: "Articles", singular: "Article" } },
		pages: { slug: "sider", nb: { plural: "Sider", singular: "Side" }, en: { plural: "Pages", singular: "Page" } },
		// Flere samlinger med egen fane i menyen og under Tilganger, f.eks.
		// { slug: "artister", tab: "artister", urlBase: "/artist/", icon: "user", nb: {…}, en: {…} }
		extra: [],
	},
	// Språket innholdet listes på i kontrollpanelet når samlingene har oversettelser (f.eks. "nb"); null = alle
	contentLocale: null,
	// Menypunkter i EmDash som skjules (sti under /_emdash/admin). Erstatter hele listen; bruk
	// extraHiddenAdminPaths for å skjule noe i tillegg.
	hiddenAdminPaths: [
		"/calendar", "/menus", "/sections", "/widgets", "/bylines", "/byline-schema", "/comments", "/content-types",
		"/taxonomies", "/redirects", "/plugins", "/plugins-manager", "/import", "/themes", "/settings/api-tokens",
		"/settings/allowed-domains", "/settings/transfer", "/settings/media-usage", "/settings/social",
	],
	extraHiddenAdminPaths: [],
	// Modul i prosjektet med valgfrie funksjoner (se README): pageName(path, lang)
	hooks: null,
	// Ekstra norske oversettelser i prosjektet (samme format som translations/emdash-nb.json), går foran kit-ens
	translations: null,
	vibeEditor: true,
	// Felt for egne skript (Google Tag Manager, Analytics, Meta Pixel o.l.) under Innstillinger → SEO i EmDash.
	// Settes inn på alle sider med <EmDashHead>, <EmDashBodyStart> og <EmDashBodyEnd>. false = av.
	scripts: true,
	// Bilder komprimeres i nettleseren før de lastes opp i EmDash: lengste side høyst maxSize piksler,
	// JPEG forblir JPEG, PNG og WebP blir WebP (gjennomsiktighet beholdes). GIF og SVG endres ikke. false = av.
	images: { maxSize: 2560, quality: 0.82 },
};

function merge(base, over) {
	if (!over || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
	const out = { ...base };
	for (const [k, v] of Object.entries(over)) out[k] = base && typeof base[k] === "object" && !Array.isArray(base[k]) && v && typeof v === "object" && !Array.isArray(v) ? merge(base[k], v) : v;
	return out;
}

/**
 * Lager kit-oppsettet for et prosjekt.
 * @param {object} options se DEFAULTS og README
 * @returns {{ config: object, emdash: object, integration: import("astro").AstroIntegration }}
 */
export function defineKit(options = {}) {
	const config = merge(DEFAULTS, options);
	if (!/^[a-z][a-z0-9_]{1,30}$/.test(config.prefix)) throw new Error(`[emdash-kit] prefix må være små bokstaver/tall/_ (fikk «${config.prefix}»)`);
	for (const key of ["articles", "pages"]) {
		const c = config.collections[key];
		if (!c?.slug || !c.nb?.plural || !c.nb?.singular || !c.en?.plural || !c.en?.singular)
			throw new Error(`[emdash-kit] collections.${key} trenger slug og nb/en { plural, singular }`);
	}
	const TAB_IDS = ["oversikt", "artikler", "sider", "medier", "brukere", "innstillinger", "vibe", "vibeinnstillinger", "tilganger"];
	if (!Array.isArray(config.collections.extra)) throw new Error("[emdash-kit] collections.extra må være en liste");
	for (const c of config.collections.extra) {
		if (!c?.slug || !c.nb?.plural || !c.nb?.singular || !c.en?.plural || !c.en?.singular)
			throw new Error(`[emdash-kit] collections.extra «${c?.slug ?? "?"}» trenger slug og nb/en { plural, singular }`);
		c.tab = c.tab || c.slug;
		if (!/^[a-z][a-z0-9_-]{1,30}$/.test(c.tab) || TAB_IDS.includes(c.tab)) throw new Error(`[emdash-kit] collections.extra: ugyldig eller opptatt fane «${c.tab}»`);
	}
	if (!["light", "dark"].includes(config.brand.mode)) throw new Error(`[emdash-kit] brand.mode må være "light" eller "dark" (fikk «${config.brand.mode}»)`);
	if (!config.brand.colors.shadow) config.brand.colors.shadow = config.brand.mode === "dark" ? "#000000" : config.brand.colors.ink;
	config.hiddenAdminPaths = [...new Set([...(config.hiddenAdminPaths ?? []), ...(config.extraHiddenAdminPaths ?? [])])];
	if (config.vibeEditor && !vibeEditor) {
		console.warn("[emdash-kit] emdash-vibe-editor er ikke installert: Vibe Editor er slått av (installer pakken, eller sett vibeEditor: false)");
		config.vibeEditor = false;
	}
	if (config.images) {
		const { maxSize, quality } = config.images;
		if (!Number.isInteger(maxSize) || maxSize < 320 || maxSize > 8192) throw new Error(`[emdash-kit] images.maxSize må være et heltall mellom 320 og 8192 (fikk «${maxSize}»)`);
		if (typeof quality !== "number" || quality < 0.3 || quality > 1) throw new Error(`[emdash-kit] images.quality må være mellom 0.3 og 1 (fikk «${quality}»)`);
	}
	if (!config.brand.logo) console.warn("[emdash-kit] brand.logo mangler: navnet vises som tekst i menyen");

	const plugins = [];
	if (config.email?.from) {
		plugins.push({
			id: "emdash-kit-epost",
			version: VERSION,
			entrypoint: here("./src/email-plugin.ts"),
			format: "native",
			options: {
				from: config.email.from,
				brand: {
					name: config.brand.name,
					wordmark: config.email.wordmark || config.brand.name.toUpperCase(),
					company: config.email.company,
					colors: config.brand.colors,
					mode: config.brand.mode,
					logo: config.email.logo,
					links: config.email.links,
					headingFont: config.email.headingFont,
				},
			},
			capabilities: ["hooks.email-transport:register"],
		});
	}
	// Egne skript (scripts) og flytting av Vibe Editor-bryteren bort fra chat-knapper o.l. (vibeEditor) settes inn av samme plugin
	if (config.scripts || config.vibeEditor) {
		plugins.push({
			id: "emdash-kit-skript",
			version: VERSION,
			entrypoint: here("./src/scripts-plugin.ts"),
			format: "native",
			options: {},
			capabilities: ["hooks.page-fragments:register"],
		});
	}
	if (config.vibeEditor) {
		// Pakken peker på serverkoden med navn («emdash-vibe-editor/plugin»). Med pnpm finner prosjektet bare pakker det
		// har installert selv, så navnet byttes med full sti til kit-ens egen kopi.
		const descriptor = vibeEditor();
		plugins.push({ ...descriptor, entrypoint: fileURLToPath(import.meta.resolve(descriptor.entrypoint)).replaceAll("\\", "/") });
	}

	const emdash = {
		// EmDash sin «Edit mode»-verktøylinje på nettsiden er slått av (Vibe Editor har sin egen)
		toolbar: false,
		admin: {
			logo: config.brand.logo || undefined,
			siteName: config.brand.name,
			footerLabel: false,
			favicon: config.brand.favicon || config.brand.icon || undefined,
			locales: ["en", "nb"],
		},
		plugins,
	};

	const integration = {
		name: "@getonnet/emdash-kit",
		hooks: {
			"astro:config:setup": ({ injectRoute, addMiddleware, updateConfig, config: astroConfig }) => {
				const root = fileURLToPath(astroConfig.root);
				const abs = (p) => (p ? (isAbsolute(p) ? p : resolve(root, p)).replaceAll("\\", "/") : null);
				const hooksPath = abs(config.hooks);
				const translationsPath = abs(config.translations);
				if (hooksPath && !existsSync(hooksPath)) throw new Error(`[emdash-kit] fant ikke hooks-filen ${hooksPath}`);
				if (translationsPath && !existsSync(translationsPath)) console.warn(`[emdash-kit] fant ikke oversettelsesfilen ${translationsPath}`);

				const routes = [
					["/admin", "./src/pages/admin/index.astro"],
					["/admin/tilganger", "./src/pages/admin/tilganger.astro"],
					["/api/besok", "./src/pages/api/besok.ts"],
					["/api/innstillinger", "./src/pages/api/innstillinger.ts"],
					["/api/auto-oppdatering", "./src/pages/api/auto-oppdatering.ts"],
					["/api/tilganger", "./src/pages/api/tilganger.ts"],
					["/api/epostleverandor", "./src/pages/api/epostleverandor.ts"],
				];
				for (const [pattern, entrypoint] of routes) injectRoute({ pattern, entrypoint: here(entrypoint), prerender: false });
				addMiddleware({ entrypoint: here("./src/middleware.ts"), order: "pre" });

				const VIRTUAL = "virtual:emdash-kit/config";
				const RESOLVED = "\0" + VIRTUAL;
				const runtimeConfig = { ...config, hooks: undefined, translations: undefined, extraHiddenAdminPaths: undefined, version: VERSION };
				updateConfig({
					vite: {
						plugins: [
							{
								name: "emdash-kit-config",
								resolveId: (id) => (id === VIRTUAL ? RESOLVED : null),
								load: (id) =>
									id === RESOLVED
										? `export const config = ${JSON.stringify(runtimeConfig)};\n` +
											(hooksPath ? `export * as hooks from ${JSON.stringify(hooksPath)};\n` : `export const hooks = {};\n`)
										: null,
							},
							emdashNb({ brandName: config.brand.name, extraTranslations: translationsPath }),
						],
					},
				});
			},
		},
	};

	return { config, emdash, integration };
}

export default defineKit;
