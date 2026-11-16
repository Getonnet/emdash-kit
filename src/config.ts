// Prosjektets kit-oppsett (fra defineKit i astro.config.mjs), tilgjengelig for koden som kjører på nettstedet.
// Avledede navn (D1-tabeller, cookies, CSS-variabler) samles her, så resten av kit-en ikke har noe hardkodet.
import { config as raw, hooks as rawHooks } from "virtual:emdash-kit/config";

export type Colors = {
	paper: string;
	paperDeep: string;
	card: string;
	ink: string;
	muted: string;
	line: string;
	lineStrong: string;
	interact: string;
	label: string;
	dark: string;
	darkAlt: string;
	accent: string;
	accentHover: string;
	accentText: string;
	accentInk: string;
	wash: string;
	onDarkAccent: string;
	onDarkMuted: string;
	grid: string;
};

type Names = { plural: string; singular: string };
export type Collection = { slug: string; urlBase?: string; nb: Names; en: Names };

export type KitConfig = {
	brand: {
		name: string;
		logo: string;
		icon: string;
		favicon: string;
		tagline: { nb: string; en: string };
		fontsCss: string;
		font: string;
		headingFont: string;
		colors: Colors;
	};
	prefix: string;
	email: { from: { email: string; name?: string } | null; company: string; wordmark: string };
	collections: { articles: Collection; pages: Collection };
	hiddenAdminPaths: string[];
	vibeEditor: boolean;
	version: string;
};

/** Valgfrie funksjoner i prosjektets hooks-modul (defineKit({ hooks: "./src/emdash-kit.ts" })). */
export type KitHooks = {
	/** Lesbart navn på en side ut fra stien besøkstelleren lagrer (uten / til slutt, "/" for forsiden). */
	pageName?: (path: string, lang: "nb" | "en") => string | undefined;
};

export const kit = raw as KitConfig;
export const hooks = rawHooks as KitHooks;

const p = kit.prefix;
/** D1-tabeller og cookies, med prosjektets forstavelse (f.eks. getonnet_settings, getonnet-view-as) */
export const names = {
	settingsTable: `${p}_settings`,
	visitsTable: `${p}_visits`,
	rolesTable: `${p}_user_roles`,
	viewAsCookie: `${p}-view-as`,
	langCookie: `${p}-lang`,
	loginSessionKey: `${p}-login`,
	localsAccess: "kitAccess",
	localsRealLevel: "kitRealLevel",
};

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
/** CSS-variablene (--ek-paper, --ek-accent …) for prosjektets farger og skrift */
export function cssVars(): string {
	const c = kit.brand.colors;
	const font = (f: string) => (/[\s,]/.test(f) && !f.includes(",") ? `"${f}"` : f);
	const vars = Object.entries(c).map(([k, v]) => `--ek-${kebab(k)}:${v}`);
	vars.push(`--ek-font:${font(kit.brand.font)},ui-sans-serif,system-ui,sans-serif`);
	vars.push(`--ek-heading:${font(kit.brand.headingFont)},${font(kit.brand.font)},ui-sans-serif,system-ui,sans-serif`);
	return vars.join(";");
}

/** Samlingsnavn på riktig språk */
export const collectionLabel = (c: Collection, lang: "nb" | "en", form: keyof Names = "plural") => c[lang][form];

/** Stien besøkstelleren lagrer for en artikkel (uten / til slutt) */
export const articlePath = (slug: string) => `${(kit.collections.articles.urlBase ?? `/${kit.collections.articles.slug}/`).replace(/\/?$/, "/")}${slug}`;
