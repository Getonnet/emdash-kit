// Vite-plugin: fyller inn norske oversettelser som mangler i EmDash-admin (der EmDash viser engelsk tekst i norsk modus).
// Kit-ens oversettelser ligger i translations/emdash-nb.json: { "<meldings-id>": "Norsk tekst med {plassholdere}" }.
// Prosjektet kan legge til eller overstyre med sin egen fil (defineKit({ translations: "./translations/emdash-nb.json" })).
// Flettes inn i EmDash sin norske meldingsfil når nettsiden bygges, uten å endre node_modules.
// I tillegg fjernes navnet «EmDash» fra tekstene i admin (norsk og engelsk): kunden ser bare merkenavnet og «nettstedet».
// Unntak: navn som må stå for å virke (utvidelsen «EmDash Exporter» for WordPress, `npx emdash`, .emdash-filer).
//
// Ved en ny EmDash-versjon, fra prosjektmappen: `node node_modules/@getonnet/emdash-kit/vite-nb.mjs`
// viser hvor mange meldinger som fortsatt er engelske, og hvilke som fortsatt nevner EmDash.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

function translations(extra) {
	const base = read(join(kitRoot, "translations/emdash-nb.json"));
	return extra && existsSync(extra) ? { ...base, ...read(extra) } : base;
}

// "Hei {name}!" → ["Hei ", ["name"], "!"] (samme format som EmDash sine meldinger)
const toMessage = (text) =>
	text
		.split(/(\{[^{}]+\})/)
		.filter((p) => p !== "")
		.map((p) => (/^\{[^{}]+\}$/.test(p) ? [p.slice(1, -1)] : p));

// Ord som må stå (Exporter, Migration, «EmDash», npx emdash, .emdash) beskyttes og settes tilbake etterpå.
const KEEP = /EmDash Exporter|EmDash Migration|«EmDash»|"EmDash"|npx emdash|\.emdash|X-EmDash/g;

// Navnet EmDash byttes ut (rekkefølgen betyr noe: de mest spesifikke først)
const rules = (brand) => ({
	nb: [
		[/Velkommen til EmDash/g, `Velkommen til ${brand}`],
		[/^EmDash-nettstedspakke$/g, "Nettstedspakke"],
		[/EmDash-nettstedspakke/g, "nettstedspakke"],
		[/et annet EmDash-nettsted/g, "et annet nettsted"],
		[/eksisterende EmDash-nettsted/g, "eksisterende nettsted"],
		[/EmDash-nettsted/g, "nettsted"],
		[/en annen EmDash-installasjon/g, "en annen installasjon"],
		[/EmDash-brukere/g, "brukere"],
		[/EmDash-bruker/g, "bruker"],
		[/EmDash-medielageret ditt/g, "mediebiblioteket"],
		[/EmDash-konfigurasjonen/g, "oppsettet"],
		[/en kompatibel EmDash-versjon/g, "en kompatibel versjon"],
		[/denne versjonen av EmDash/g, "denne versjonen av nettstedet"],
		[/versjon av EmDash/g, "versjon av nettstedet"],
		[/start EmDash på nytt/g, "start nettstedet på nytt"],
		[/oppdatert EmDash/g, "oppdatert nettstedet"],
		[/Krever EmDash /g, "Krever versjon "],
		[/^EmDash $/g, "Versjon "],
		[/(^|[.!?] )EmDash /g, "$1Nettstedet "],
		[/EmDash /g, "nettstedet "],
		[/EmDash/g, "nettstedet"],
	],
	en: [
		[/Welcome to EmDash/g, `Welcome to ${brand}`],
		[/^EmDash site package$/g, "Site package"],
		[/an EmDash site package/g, "a site package"],
		[/EmDash site package/g, "site package"],
		[/another EmDash site/g, "another site"],
		[/existing EmDash site/g, "existing site"],
		[/another EmDash installation/g, "another installation"],
		[/EmDash users?/g, (m) => m.replace("EmDash ", "")],
		[/your EmDash media storage/g, "your media library"],
		[/your EmDash config/g, "your config"],
		[/a compatible EmDash version/g, "a compatible version"],
		[/(this|newer or different) version of EmDash/g, "$1 version of the site"],
		[/restart EmDash/g, "restart the site"],
		[/updating EmDash/g, "updating the site"],
		[/Requires EmDash /g, "Requires version "],
		[/EmDash site/g, "site"],
		[/EmDash plugin/g, "plugin"],
		[/^EmDash $/g, "Version "],
		[/EmDash CMS/g, brand],
		[/(^|[.!?] )EmDash /g, "$1The site "],
		[/EmDash /g, "the site "],
		[/EmDash/g, "the site"],
	],
});

function rebrandText(s, list) {
	if (!s.includes("EmDash")) return s;
	const kept = [];
	let out = s.replace(KEEP, (m) => `\u0000${kept.push(m) - 1}\u0000`);
	for (const [re, to] of list) out = out.replace(re, to);
	return out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[+i]);
}

// Går gjennom en melding (tekst, liste med deler, flertallsformer) og bytter navnet i tekstdelene
function rebrand(msg, list) {
	if (typeof msg === "string") return rebrandText(msg, list);
	if (Array.isArray(msg)) return msg.map((p) => rebrand(p, list));
	if (msg && typeof msg === "object") return Object.fromEntries(Object.entries(msg).map(([k, v]) => [k, rebrand(v, list)]));
	return msg;
}

const JSON_RE = /JSON\.parse\(("(?:[^"\\]|\\.)*")\)/;
// Kildefilen locales/<språk>/messages.mjs og kopien admin laster (messages-<hash>.js, med "src/locales/<språk>/messages.mjs" øverst)
const catalogLocale = (id, code) => {
	if (!id.includes("@emdash-cms/admin")) return null;
	for (const lang of ["nb", "en"]) {
		const file = new RegExp(`locales[\\\\/]${lang}[\\\\/]messages\\.mjs$`);
		if (file.test(id) || code.startsWith(`//#region src/locales/${lang}/messages.mjs`)) return lang;
	}
	return null;
};

export function merge(code, lang = "nb", { brandName = "nettstedet", extraTranslations = null } = {}) {
	const m = code.match(JSON_RE);
	if (!m) return null;
	const messages = JSON.parse(JSON.parse(m[1]));
	// Tekst med {plassholdere}, eller ferdig melding (liste) for flertall: [["antall", "plural", { one, other }]]
	if (lang === "nb") for (const [id, text] of Object.entries(translations(extraTranslations))) if (id in messages) messages[id] = Array.isArray(text) ? text : toMessage(text);
	const list = rules(brandName)[lang];
	for (const id of Object.keys(messages)) messages[id] = rebrand(messages[id], list);
	return code.replace(JSON_RE, () => `JSON.parse(${JSON.stringify(JSON.stringify(messages))})`);
}

export default function emdashNb(options = {}) {
	return {
		name: "emdash-kit-nb",
		enforce: "pre",
		transform(code, id) {
			const lang = catalogLocale(id, code);
			if (!lang) return null;
			const out = merge(code, lang, options);
			return out ? { code: out, map: null } : null;
		},
	};
}

// Fra prosjektmappen: node node_modules/@getonnet/emdash-kit/vite-nb.mjs [ekstra-oversettelser.json]
// → antall meldinger som fortsatt er engelske i norsk modus, og tekster som fortsatt nevner EmDash
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const project = process.cwd();
	const extra = process.argv[2] ? join(project, process.argv[2]) : null;
	// npm legger pakken rett i node_modules, pnpm under node_modules/.pnpm/@emdash-cms+admin@…
	const flat = join(project, "node_modules/@emdash-cms/admin/dist/locales");
	const store = join(project, "node_modules/.pnpm");
	const nested = existsSync(store) ? readdirSync(store).find((d) => d.startsWith("@emdash-cms+admin@")) : undefined;
	const dist = existsSync(flat) ? flat : join(store, nested ?? "", "node_modules/@emdash-cms/admin/dist/locales");
	const opts = { brandName: "nettstedet", extraTranslations: extra };
	const load = (lang) => JSON.parse(JSON.parse(merge(readFileSync(join(dist, `${lang}/messages.mjs`), "utf8"), lang, opts).match(JSON_RE)[1]));
	const en = (await import(pathToFileURL(join(dist, "en/messages.mjs")).href)).messages;
	const nb = load("nb");
	const left = Object.keys(en).filter((k) => JSON.stringify(en[k]) === JSON.stringify(nb[k]));
	console.log(`${Object.keys(translations(extra)).length} oversettelser, ${left.length} meldinger fortsatt engelske`);
	for (const lang of ["nb", "en"]) {
		const msgs = lang === "nb" ? nb : load("en");
		const still = Object.entries(msgs).filter(([, v]) => JSON.stringify(v).replace(KEEP, "").includes("EmDash"));
		console.log(`${lang}: ${still.length} tekster nevner fortsatt EmDash`, still.map(([k]) => k).join(" "));
	}
}
