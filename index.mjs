// @getonnet/emdash-kit — felles EmDash-oppsett for GetOnNet-prosjekter (samme som AESTO og Trening For Deg).
//
// Bruk i et prosjekt (astro.config.mjs):
//   import { defineKit } from "@getonnet/emdash-kit";
//   const kit = defineKit({ brand: {...}, prefix: "kunde", email: {...}, collections: {...}, hooks: "./src/emdash-kit.ts" });
//   integrations: [react(), emdash({ database, storage, ...kit.emdash }), kit.integration]
//
// Kit-en legger inn: kontrollpanel (/admin, /admin/tilganger), API-er (/api/besok, /api/innstillinger,
// /api/tilganger, /api/epostleverandor), middleware (EmDash-admin i prosjektets farger, roller og tilganger,
// utlogging ved midnatt, hoveddomene, HSTS), e-post med prosjektets profil, norske oversettelser og Vibe Editor.
// Alt som er spesielt for prosjektet (navn, farger, skrift, logo, firmaopplysninger, samlinger) kommer fra config.
// Selve nettsiden (sider, maler, artikkelsider) ligger i prosjektet.
//
// Skrevet som vanlig JavaScript: Node leser astro.config.mjs før Vite, og Node fjerner ikke TypeScript i node_modules.
// Filene under src/ er TypeScript/Astro og bygges av Vite som en del av nettstedet.
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";
import vibeEditor from "emdash-vibe-editor";
import emdashNb from "./vite-nb.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url)).replaceAll("\\", "/");

export const VERSION = "1.0.0";

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
	},
	collections: {
		articles: { slug: "artikler", urlBase: "/artikler/", nb: { plural: "Artikler", singular: "Artikkel" }, en: { plural: "Articles", singular: "Article" } },
		pages: { slug: "sider", nb: { plural: "Sider", singular: "Side" }, en: { plural: "Pages", singular: "Page" } },
	},
	// Menypunkter i EmDash som skjules (sti under /_emdash/admin)
	hiddenAdminPaths: [
		"/calendar", "/menus", "/sections", "/widgets", "/bylines", "/byline-schema", "/comments", "/content-types",
		"/taxonomies", "/redirects", "/plugins", "/plugins-manager", "/import", "/themes", "/settings/api-tokens",
		"/settings/allowed-domains", "/settings/transfer", "/settings/media-usage", "/settings/social",
	],
	// Modul i prosjektet med valgfrie funksjoner (se README): pageName(path, lang)
	hooks: null,
	// Ekstra norske oversettelser i prosjektet (samme format som translations/emdash-nb.json), går foran kit-ens
	translations: null,
	vibeEditor: true,
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

	const plugins = [];
	if (config.email?.from) {
		plugins.push({
			id: "emdash-kit-epost",
			version: VERSION,
			entrypoint: here("./src/email-plugin.ts"),
			format: "native",
			options: { from: config.email.from, brand: { name: config.brand.name, wordmark: config.email.wordmark || config.brand.name.toUpperCase(), company: config.email.company, colors: config.brand.colors } },
			capabilities: ["hooks.email-transport:register"],
		});
	}
	if (config.vibeEditor) plugins.push(vibeEditor());

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

				const routes = [
					["/admin", "./src/pages/admin/index.astro"],
					["/admin/tilganger", "./src/pages/admin/tilganger.astro"],
					["/api/besok", "./src/pages/api/besok.ts"],
					["/api/innstillinger", "./src/pages/api/innstillinger.ts"],
					["/api/tilganger", "./src/pages/api/tilganger.ts"],
					["/api/epostleverandor", "./src/pages/api/epostleverandor.ts"],
				];
				for (const [pattern, entrypoint] of routes) injectRoute({ pattern, entrypoint: here(entrypoint), prerender: false });
				addMiddleware({ entrypoint: here("./src/middleware.ts"), order: "pre" });

				const VIRTUAL = "virtual:emdash-kit/config";
				const RESOLVED = "\0" + VIRTUAL;
				const runtimeConfig = { ...config, hooks: undefined, translations: undefined, version: VERSION };
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
