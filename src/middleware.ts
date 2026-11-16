// Tilpasser EmDash-admin for prosjektet (samme oppsett som AESTO og Trening For Deg), ut fra kit-oppsettet:
// - /_emdash/admin (forsiden) sender videre til kontrollpanelet på /admin
// - prosjektets farger og skrift, alltid lys modus, ingen toppbar, brukeren nederst i menyen
// - menypunkter som ikke trengs skjules; Vibe Editor og Tilganger legges inn i menyen
// - roller og tilganger, automatisk utlogging ved midnatt, norsk som standard, hoveddomene, HSTS
import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { osloDay } from "./besok";
import { cssVars, kit, names } from "./config";
import { autoLogoutOn } from "./innstillinger";
import { accessFor, allows, TAB_PATHS, VIBE_CLIENT, VIEW_AS_COOKIE, type Access, type Tab } from "./roller";

const ADMIN = "/_emdash/admin";

// Sider i EmDash som ikke trengs (meny, seksjoner, utvidelser osv.), fra kit-oppsettet
const HIDDEN = kit.hiddenAdminPaths;

// Utvidelser som skal vises i menyen likevel (Vibe Editor brukes av redaktørene)
const KEEP = [`${ADMIN}/plugins/vibe-editor`];
const keep = KEEP.map((p) => `:not([href^="${p}"])`).join("");
const links = HIDDEN.map((p) => `a[href^="${ADMIN}${p}"]${keep}`);

// Prosjektets farger i EmDash (samme som /admin), som CSS-variabler fra kit-oppsettet; alltid lys modus
const theme = `:root,html[data-theme][data-mode]{${cssVars()}}
html[data-theme][data-mode]{
--color-kumo-canvas:var(--ek-paper);--color-kumo-base:var(--ek-card);--color-kumo-elevated:var(--ek-card);--color-kumo-recessed:var(--ek-paper-deep);
--color-kumo-overlay:var(--ek-card);--color-kumo-control:var(--ek-card);--color-kumo-tint:var(--ek-paper);--color-kumo-fill:var(--ek-line);
--color-kumo-fill-hover:var(--ek-paper-deep);--color-kumo-interact:var(--ek-interact);--color-kumo-contrast:var(--ek-ink);
--color-kumo-line:color-mix(in srgb,var(--ek-ink) 10%,transparent);--color-kumo-hairline:var(--ek-line);--color-kumo-brand:var(--ek-accent);--color-kumo-brand-hover:var(--ek-accent-hover);
--color-kumo-focus:var(--ek-accent);--text-color-kumo-default:var(--ek-ink);--text-color-kumo-strong:var(--ek-ink);--text-color-kumo-subtle:var(--ek-muted);
--text-color-kumo-placeholder:var(--ek-label);--text-color-kumo-brand:var(--ek-accent-ink);--text-color-kumo-link:var(--ek-accent-ink);
color-scheme:light;background:var(--ek-paper);font-family:var(--ek-font)}
.bg-kumo-brand,.bg-kumo-brand *{color:var(--ek-accent-text)!important}
body,main{background:var(--ek-paper)!important}
/* Velkomstdialogen setter logoen i en firkant på 32×32 (laget for et ikon). Logoen er et bredt ordmerke: vis det i riktige proporsjoner */
[role=dialog] img[src="${kit.brand.logo}"]{width:140px!important;height:auto!important;max-width:none!important;max-height:none!important;object-fit:contain}
.emdash-sidebar{--sidebar-active-bg:var(--ek-wash)}
.emdash-sidebar [data-sidebar=content-container]{background:var(--ek-card)}
.emdash-sidebar [data-sidebar=header] img{height:30px;width:auto}
.emdash-sidebar [data-sidebar=group-label],.emdash-sidebar [data-sidebar=group-label] *{font-size:10px!important;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ek-label)!important}
.emdash-sidebar a[data-sidebar=menu-button],.emdash-sidebar a[data-sidebar=menu-button] *{color:var(--ek-muted)}
.emdash-sidebar a[data-sidebar=menu-button]{border-radius:10px}
.emdash-sidebar a[data-sidebar=menu-button][aria-current=page] *,.emdash-sidebar a[data-sidebar=menu-button][data-active] *{color:var(--ek-accent-ink)}
.emdash-sidebar a[data-sidebar=menu-button]:hover{background:var(--ek-paper)}
.emdash-sidebar a[data-sidebar=menu-button][aria-current=page],.emdash-sidebar a[data-sidebar=menu-button][data-active]{background:var(--ek-wash)!important;color:var(--ek-accent-ink);font-weight:600}
/* Likt menyen på /admin: logo med undertittel, luftige menypunkter, bruker nederst, titler i overskriftsskriften */
.emdash-sidebar [data-sidebar=header]{height:auto!important;min-height:0!important;padding:28px 20px 14px!important;border-bottom:0!important}
.emdash-sidebar [data-sidebar=header]>a{flex-direction:column!important;align-items:flex-start!important;gap:12px!important;height:auto!important}
.emdash-sidebar [data-sidebar=header] img{height:auto!important;width:150px!important;max-height:none!important}
.emdash-sidebar [data-sidebar=header]>a>span{display:none!important}
.emdash-sidebar [data-sidebar=header]>a::after{content:var(--ek-tagline,"INNHOLDSSTUDIO");font-size:10px;font-weight:600;letter-spacing:.16em;color:var(--ek-label)}
/* Sammenslått meny (56 px): ordmerket får ikke plass, så det firkantede ikonet vises i stedet, midt over menyikonene */
.emdash-sidebar[data-state=collapsed] [data-sidebar=header]{padding:16px 0 10px!important;justify-content:center}
.emdash-sidebar[data-state=collapsed] [data-sidebar=header]>a{align-items:center!important;width:100%}
.emdash-sidebar[data-state=collapsed] [data-sidebar=header] img{content:url("${kit.brand.icon || kit.brand.logo}");width:32px!important;height:32px!important;border-radius:8px}
/* Bare navn og rolle skjules; menyen med Logg ut (.ek-pop) må fortsatt kunne åpnes */
.emdash-sidebar[data-state=collapsed] [data-sidebar=header]>a::after,.emdash-sidebar[data-state=collapsed] .ek-user>div:not(.ek-pop){display:none}
/* Midt under menyikonene (EmDash plasserer dem 2 px til høyre for midten) */
.emdash-sidebar[data-state=collapsed] .ek-user{padding:14px 0 14px 4px;justify-content:center}
/* Menyen klipper alt som stikker ut: brukermenyen legges utenfor, til høyre for den smale menyen */
.emdash-sidebar[data-state=collapsed] .ek-pop{position:fixed;left:64px;right:auto;bottom:16px;width:250px}
.emdash-sidebar a[data-sidebar=menu-button]{min-height:40px!important;padding:0 14px!important;font-size:13.5px!important;gap:11px!important}
.emdash-sidebar [data-sidebar=group-label]{margin-top:12px}
.emdash-sidebar [data-sidebar=footer] p{display:none}
.ek-user{display:flex;align-items:center;gap:11px;padding:14px 20px;border-top:1px solid var(--ek-line)}
.ek-user .av,.ek-user-av{display:grid;place-items:center;width:34px;height:34px;flex-shrink:0;border-radius:50%;background:var(--ek-wash);color:var(--ek-accent-ink);font:400 16px/1 var(--ek-heading)}
.ek-user strong{display:block;font-size:13px;font-weight:600;color:var(--ek-ink);line-height:1.3}
.ek-user small{display:block;font-size:11.5px;color:var(--ek-muted)}
main h1{font-family:var(--ek-heading)!important;font-weight:500!important;letter-spacing:-.02em}
.ek-switch{position:relative;flex-shrink:0;width:36px;height:20px;border-radius:20px;border:0;padding:0;background:var(--ek-interact);cursor:pointer;transition:background .15s}
.ek-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--ek-card);box-shadow:0 1px 2px color-mix(in srgb,var(--ek-ink) 20%,transparent);transition:transform .15s}
.ek-switch[aria-checked=true]{background:var(--ek-accent-ink)}.ek-switch[aria-checked=true]::after{transform:translateX(16px)}
.ek-switch:disabled{opacity:.5;cursor:wait}.ek-switch:focus-visible{outline:2px solid var(--ek-accent-ink);outline-offset:2px}
.ek-mailapps{margin-top:4px;text-align:center}.ek-mailapps p{font-size:13px;color:var(--ek-muted);margin:0 0 10px}
.ek-mailapps div{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.ek-mailapps a{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border:1px solid var(--ek-line);border-radius:10px;background:var(--ek-card);color:var(--ek-ink);font-size:14px;font-weight:600;text-decoration:none;transition:border-color .15s,box-shadow .15s}
.ek-mailapps a:hover{border-color:var(--ek-accent-ink);box-shadow:0 2px 8px color-mix(in srgb,var(--ek-ink) 8%,transparent)}.ek-mailapps a:focus-visible{outline:2px solid var(--ek-accent-ink);outline-offset:2px}
.ek-mailapps a.first{border-color:var(--ek-accent-ink);background:var(--ek-wash)}.ek-mailapps svg{width:18px;height:18px;flex-shrink:0}
/* Ingen toppbar i EmDash (som på /admin): «Vis nettsted» er et ikon ved logoen, Logg ut ligger på brukeren nederst. På mobil beholdes bare menyknappen */
header.sticky:has(>[data-sidebar=trigger])>div{display:none!important}
@media(min-width:768px){header.sticky:has(>[data-sidebar=trigger]){display:none!important}}
/* Ligger som søsken etter header-elementet i menyen (React tegner header på nytt), oppe til høyre */
.ek-site{position:absolute;top:24px;right:14px;z-index:2;display:flex;padding:7px;border-radius:8px;color:var(--ek-muted);text-decoration:none}.ek-site:hover{background:var(--ek-paper);color:var(--ek-ink)}
.ek-site svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.emdash-sidebar[data-state=collapsed] .ek-site{display:none}
.ek-user{position:relative;cursor:pointer}.ek-user:hover{background:var(--ek-paper)}
.ek-pop{position:absolute;left:12px;right:12px;bottom:calc(100% + 6px);background:var(--ek-card);border:1px solid var(--ek-line);border-radius:12px;box-shadow:0 14px 40px color-mix(in srgb,var(--ek-ink) 9%,transparent);padding:6px;z-index:30;cursor:default}
.ek-pop .who{padding:10px 12px 8px;border-bottom:1px solid var(--ek-line);margin-bottom:6px}.ek-pop .who strong{display:block;font-size:13px;color:var(--ek-ink)}.ek-pop .who small{font-size:12px;color:var(--ek-muted)}
.ek-pop button{width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;text-align:left;background:none;border:0;color:var(--ek-ink);cursor:pointer;font:inherit;font-size:13px}.ek-pop button:hover{background:var(--ek-paper)}
.ek-pop svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.ek-viewas{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;background:var(--ek-ink);color:var(--ek-card);border-radius:30px;box-shadow:0 14px 40px color-mix(in srgb,var(--ek-ink) 19%,transparent);font-size:13px;font-weight:500;white-space:nowrap}
.ek-viewas button{background:var(--ek-accent);color:var(--ek-accent-text);border:0;border-radius:30px;padding:6px 12px;font-weight:600;font-size:12.5px;cursor:pointer;font:inherit}`;


// Samlingene på norsk og engelsk (fra kit-oppsettet), til tekstrettingene i admin
const COLLECTIONS = [kit.collections.articles, kit.collections.pages];
const NB_NAMES = COLLECTIONS.flatMap((c) => [c.nb.plural, c.nb.singular]);
const COLLECTION_EN_MAP = Object.fromEntries(COLLECTIONS.flatMap((c) => [[c.nb.plural, c.en.plural], [c.nb.singular, c.en.singular]]));
// Settes rett inn i skriptet på siden (ikke som en JavaScript-streng), så én skråstrek foran spesialtegn holder
const reAlt = (words: string[]) => words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const NEW_FIX = COLLECTIONS.map((c) => ({ en: "New " + c.nb.singular, nb: "Ny " + c.nb.singular.toLowerCase(), enOut: "New " + c.en.singular.toLowerCase() }));

const inject = `<style id="ek-admin">
${theme}
${links.join(",")},${links.map((l) => `li:has(> ${l})`).join(",")}{display:none!important}
</style>
<script>
// Alltid lys modus, slik at EmDash ser ut som kontrollpanelet på /admin
const light = () => document.documentElement.getAttribute("data-mode") !== "light" && document.documentElement.setAttribute("data-mode", "light");
light();
new MutationObserver(light).observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });

// "Oversikt" og logoen i EmDash peker til forsiden av EmDash; send dem til /admin i stedet
document.addEventListener("click", (e) => {
	const a = e.target instanceof Element && e.target.closest("a[href]");
	if (!a) return;
	const href = a.getAttribute("href");
	if (href === "${ADMIN}" || href === "${ADMIN}/") {
		e.preventDefault();
		e.stopPropagation();
		location.href = "/admin";
	}
}, true);

const NB_EXTRA = {
	"Drop an image here or": "Slipp et bilde her, eller",
	"browse": "bla gjennom",
	"Drag and drop files here": "Dra og slipp filer her",
	// Feilmeldinger fra serveren ved invitasjon og innlogging med e-postlenke (EmDash sender dem bare på engelsk)
	"Invalid or expired invite link": "Lenken er ugyldig eller utløpt.",
	"Invalid or expired invite": "Invitasjonen er ugyldig eller utløpt.",
	"Invalid invite data": "Invitasjonen er ugyldig.",
	"This invite has expired": "Invitasjonen har utløpt.",
	"A user with this email already exists": "Det finnes allerede en bruker med denne e-postadressen.",
	"Invalid or expired link": "Lenken er ugyldig eller utløpt.",
	"Invalid token": "Lenken er ugyldig.",
	"This link has expired": "Lenken har utløpt.",
	"User not found": "Fant ikke brukeren.",
};

const COLLECTION_EN = ${JSON.stringify(COLLECTION_EN_MAP)};
// "Unpublish Side", "Search artikler…", "Add New Artikkel" (engelsk verb foran samlingsnavnet)
const COLLECTION_EN_RE = /^(New|Add|Add new|Edit|Delete|Unpublish|Publish|Save|Search|Duplicate|Preview|Restore|Schedule|Select|View|All|No)\\s+(${reAlt(NB_NAMES)})\\b(.*)$/i;
const cap = (w) => w[0].toUpperCase() + w.slice(1).toLowerCase();
const fixPlaceholders = () => {
	if (document.documentElement.lang.startsWith("nb")) return;
	for (const el of document.querySelectorAll("input[placeholder], textarea[placeholder]")) {
		const p = el.getAttribute("placeholder");
		const q = p.replace(/\\b(${reAlt(COLLECTIONS.map((c) => c.nb.plural.toLowerCase()))})\\b/gi, (w) => COLLECTION_EN[cap(w)].toLowerCase());
		if (q !== p) el.setAttribute("placeholder", q);
	}
};

const VIBE_EN = {
	"Koble nettstedet til Vibe Editor-kontoen din, så kan redaktører endre tekst og bilder rett på siden med AI. AI-bruk trekkes fra kredittene på kontoen.":
		"Connect the site to your Vibe Editor account so editors can change text and images directly on the page with AI. AI usage is deducted from the account's credits.",
	"Nettstedet bruker VIBE_API_KEY fra miljøet. Koble til her for å bruke en tilkobling i stedet.":
		"The site uses VIBE_API_KEY from the environment. Connect here to use a connection instead.",
	"Koble til Vibe Editor": "Connect Vibe Editor",
	"Koble fra": "Disconnect",
	"Koble fra Vibe Editor?": "Disconnect Vibe Editor?",
	"Redaktører kan ikke bruke AI på siden før du kobler til igjen.": "Editors can't use AI on the site until you connect again.",
	"Avbryt": "Cancel",
	"Godkjenn tilkoblingen i Vibe Editor. Siden åpnes i en ny fane og sender deg tilbake hit når du er ferdig.":
		"Approve the connection in Vibe Editor. It opens in a new tab and sends you back here when you're done.",
	"Fortsett til Vibe Editor": "Continue to Vibe Editor",
	"Vibe Editor godtar bare nettsteder på https.": "Vibe Editor only accepts sites on https.",
	"Tilkoblingen ble ikke fullført i tide. Prøv igjen.": "The connection didn't finish in time. Try again.",
	"Klarte ikke å koble til Vibe Editor. Prøv igjen.": "Couldn't connect to Vibe Editor. Try again.",
};

// Fanetittelen i nettleseren: noen sider (innlogging) setter den før oversettelsene er lastet, og EmDash skriver
// samlingsnavnet med stor forbokstav («Ny Artikkel»). Rettes likt som teksten på siden.
const TITLE_NB = {
	"Log in": "Logg inn",
	"Confirm magic link": "Bekreft innloggingslenke",
	"Sign up": "Registrer deg",
	"Setup": "Oppsett",
	"Accept invite": "Godta invitasjon",
	"Admin": "Administrasjon",
	${JSON.stringify(kit.brand.name + " Admin")}: ${JSON.stringify(kit.brand.name)},
};
const TITLE_VERBS = ["Avpubliser", "Publiser", "Lagre", "Slett", "Rediger", "Dupliser", "Forhåndsvis", "Gjenopprett", "Planlegg", "Ny", "Nytt", "Legg til", "Søk i", "Velg"];
const TITLE_NOUNS = ${JSON.stringify(NB_NAMES)};
const fixTitle = () => {
	if (!document.documentElement.lang.startsWith("nb")) return;
	const parts = document.title.split(" · ");
	let head = TITLE_NB[parts[0]] ?? parts[0];
	for (const verb of TITLE_VERBS) {
		for (const noun of TITLE_NOUNS) {
			if (head === verb + " " + noun || head.startsWith(verb + " " + noun + ":")) head = verb + " " + noun.toLowerCase() + head.slice(verb.length + 1 + noun.length);
		}
	}
	parts[0] = head;
	const next = parts.join(" · ");
	if (next !== document.title) document.title = next;
};

// Rydd opp etter at React har tegnet: skjul tomme menygrupper og bytt EmDash-navnet/-ikonet med prosjektets
const tidy = () => {
	fixTitle();
	fixPlaceholders();
	document.querySelectorAll("aside ul, nav ul").forEach((ul) => {
		const items = [...ul.children];
		if (items.length && items.every((li) => getComputedStyle(li).display === "none")) ul.parentElement.style.display = "none";
	});
	// Vibe Editor har ingen lenke i EmDash-menyen: legg den inn under Innstillinger (bare administratorer ser Innstillinger)
	const sidebar = document.querySelector(".emdash-sidebar");
	const settings = sidebar?.querySelector('a[data-sidebar=menu-button][href="${ADMIN}/settings"]');
	if (settings && !sidebar.querySelector("[data-ek=vibe]")) {
		const li = settings.closest("li");
		const copy = (li || settings).cloneNode(true);
		const a = copy.matches("a") ? copy : copy.querySelector("a");
		a.setAttribute("href", "${ADMIN}/plugins/vibe-editor/");
		a.setAttribute("data-ek", "vibe");
		a.removeAttribute("aria-current");
		a.removeAttribute("data-active");
		const label = [...a.querySelectorAll("*")].find((e) => !e.children.length && e.textContent.trim());
		if (label) label.textContent = "Vibe Editor";
		const svg = a.querySelector("svg");
		if (svg) svg.innerHTML = '<path d="M128 32l22 74 74 22-74 22-22 74-22-74-74-22 74-22z" fill="none" stroke="currentColor" stroke-width="16" stroke-linejoin="round"/>';
		(li || settings).after(copy);
	}
	// Markert bare når man står på Vibe Editor-siden (EmDash bytter side uten å laste på nytt)
	const vibe = sidebar?.querySelector("[data-ek=vibe]");
	if (vibe) {
		const here = location.pathname.startsWith("${ADMIN}/plugins/vibe-editor");
		if (here && !vibe.hasAttribute("aria-current")) vibe.setAttribute("aria-current", "page");
		if (!here && vibe.hasAttribute("aria-current")) vibe.removeAttribute("aria-current");
		// Kopien arver EmDash sin "aktiv"-stil fra Innstillinger: bruk stilen til et vanlig menypunkt når den ikke er aktiv
		const plain = [...sidebar.querySelectorAll("a[data-sidebar=menu-button]")].find(
			(l) => l !== vibe && !l.hasAttribute("aria-current") && !l.hasAttribute("data-active"),
		);
		if (!here && plain && vibe.className !== plain.className) vibe.className = plain.className;
	}
	// Tilganger (roller og faner) bare for super admin: egen lenke etter Vibe Editor/Innstillinger
	const anchor = sidebar?.querySelector("[data-ek=vibe]") || settings;
	if (anchor && window.__ekUser?.superadmin && !sidebar.querySelector("[data-ek=tilganger]")) {
		const li = anchor.closest("li");
		const copy = (li || anchor).cloneNode(true);
		const a = copy.matches("a") ? copy : copy.querySelector("a");
		a.setAttribute("href", "/admin/tilganger");
		a.setAttribute("data-ek", "tilganger");
		a.removeAttribute("aria-current");
		a.removeAttribute("data-active");
		const label = [...a.querySelectorAll("*")].find((e) => !e.children.length && e.textContent.trim());
		if (label) label.textContent = window.__ekUser.t.tilganger;
		const svg = a.querySelector("svg");
		if (svg) svg.innerHTML = '<path d="M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A16,16,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A79.73,79.73,0,0,0,160,176h.1A80,80,0,0,0,216.57,39.43ZM224,98.1c-1.09,34.09-29.75,61.86-63.89,61.9H160a63.7,63.7,0,0,1-23.65-4.51,8,8,0,0,0-8.84,1.68L116.69,168H96a8,8,0,0,0-8,8v16H72a8,8,0,0,0-8,8v16H40V187.31l58.83-58.82a8,8,0,0,0,1.68-8.84A63.72,63.72,0,0,1,96,96c0-34.1,27.77-62.78,61.86-63.9A64,64,0,0,1,224,98.1ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z"/>';
		(li || anchor).after(copy);
	}
	const tilgLink = sidebar?.querySelector("[data-ek=tilganger]");
	if (tilgLink) {
		const plain = [...sidebar.querySelectorAll("a[data-sidebar=menu-button]")].find(
			(l) => !l.hasAttribute("data-ek") && !l.hasAttribute("aria-current") && !l.hasAttribute("data-active"),
		);
		if (plain && tilgLink.className !== plain.className) tilgLink.className = plain.className;
	}
	// Bylines brukes ikke (skjult i menyen); skjul også panelet i redigeringsvisningen
	for (const h of document.querySelectorAll("main section h3")) {
		const s = h.closest("section");
		if (h.textContent.trim() === "Bylines" && s && s.style.display !== "none") s.style.display = "none";
	}
	for (const b of document.querySelectorAll("main button")) {
		if (/^(Alle bylines|All bylines)$/.test(b.textContent.trim()) && b.style.display !== "none") b.style.display = "none";
	}
	// Setningen om flytting til en annen installasjon lenker til en side vi har skjult; skjul hele setningen
	for (const p of document.querySelectorAll("main p")) {
		if (/^(For å flytte et nettsted|To move a site)/.test(p.textContent.trim()) && p.style.display !== "none") p.style.display = "none";
	}
	const u = window.__ekUser;
	const nbUi = document.documentElement.lang.startsWith("nb");
	// «Vis nettsted» som ikon til høyre for logoen (toppbaren i EmDash er fjernet)
	const head = sidebar?.querySelector("[data-sidebar=header]");
	if (head && !sidebar.querySelector(".ek-site")) {
		const a = document.createElement("a");
		a.className = "ek-site";
		a.href = "/";
		a.target = "_blank";
		a.rel = "noopener";
		a.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
		a.setAttribute("aria-label", nbUi ? "Vis nettsted" : "View site");
		a.title = nbUi ? "Vis nettsted" : "View site";
		head.after(a);
	}
	// Innlogget bruker nederst i menyen, som på /admin: klikk åpner Logg ut
	const footer = sidebar?.querySelector("[data-sidebar=footer]");
	if (u && footer && !sidebar.querySelector(".ek-user")) {
		const nb = document.documentElement.lang.startsWith("nb");
		const roles = nb ? { 50: "Administrator", 40: "Redaktør", 30: "Forfatter", 20: "Bidragsyter", 10: "Abonnent" } : { 50: "Administrator", 40: "Editor", 30: "Author", 20: "Contributor", 10: "Subscriber" };
		const role = u.roleLabel || roles[[50, 40, 30, 20, 10].find((r) => u.role >= r) ?? 10];
		const card = document.createElement("div");
		card.className = "ek-user";
		const av = document.createElement("span");
		av.className = "av";
		av.textContent = u.initials;
		const text = document.createElement("div");
		const name = document.createElement("strong");
		name.textContent = u.name;
		const small = document.createElement("small");
		small.textContent = role;
		text.append(name, small);
		const pop = document.createElement("div");
		pop.className = "ek-pop";
		pop.hidden = true;
		const who = document.createElement("div");
		who.className = "who";
		const wn = document.createElement("strong");
		wn.textContent = u.name;
		const ws = document.createElement("small");
		ws.textContent = role + (u.email ? " · " + u.email : "");
		who.append(wn, ws);
		const out = document.createElement("button");
		out.type = "button";
		out.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>';
		out.append(nb ? "Logg ut" : "Log out");
		out.addEventListener("click", async () => {
			await fetch("/_emdash/api/auth/logout", { method: "POST", headers: { "X-EmDash-Request": "1" }, credentials: "same-origin" });
			location.href = "${ADMIN}/login?redirect=%2Fadmin";
		});
		pop.append(who);
		// Egne passnøkler (Innstillinger → Sikkerhet): alle roller, også de uten Innstillinger. Knapp, ikke lenke,
		// så den ikke skjules sammen med Innstillinger-lenkene
		const sec = document.createElement("button");
		sec.type = "button";
		sec.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
		sec.append(u.t.security);
		sec.addEventListener("click", () => location.assign("${ADMIN}/settings/security"));
		pop.append(sec);
		// «Se som» en annen rolle (bare super admin): avslutt herfra eller fra stripen nederst
		const exitViewAs = () =>
			fetch("/api/tilganger", { method: "PUT", headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" }, credentials: "same-origin", body: JSON.stringify({ viewAs: null }) })
				.then(() => location.assign("/admin"));
		if (u.viewAs) {
			const ex = document.createElement("button");
			ex.type = "button";
			ex.innerHTML = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
			ex.append(u.t.exitViewAs);
			ex.addEventListener("click", exitViewAs);
			pop.append(ex);
		}
		pop.append(out);
		if (u.viewAs && !document.querySelector(".ek-viewas")) {
			const bar = document.createElement("div");
			bar.className = "ek-viewas";
			bar.setAttribute("role", "status");
			bar.append(u.t.viewingAs.replace("{role}", u.viewAs));
			const b = document.createElement("button");
			b.type = "button";
			b.textContent = u.t.exitViewAs;
			b.addEventListener("click", exitViewAs);
			bar.append(b);
			document.body.append(bar);
		}
		card.append(av, text, pop);
		card.addEventListener("click", (e) => { if (!pop.contains(e.target)) pop.hidden = !pop.hidden; });
		document.addEventListener("click", (e) => { if (!card.contains(e.target)) pop.hidden = true; });
		document.addEventListener("keydown", (e) => { if (e.key === "Escape") pop.hidden = true; });
		footer.before(card);
	}
	// Innstillinger → Sikkerhet: bryter for automatisk utlogging ved midnatt (bare administratorer, gjelder alle brukere)
	const secGrid = location.pathname === "${ADMIN}/settings/security" && (u?.role ?? 0) >= 50 && document.querySelector("main .mt-6 > .grid.gap-8");
	if (secGrid && !secGrid.querySelector("[data-ek=autologout]")) {
		const nb = document.documentElement.lang.startsWith("nb");
		const sec = document.createElement("section");
		sec.setAttribute("data-ek", "autologout");
		sec.innerHTML =
			'<h2 class="text-lg font-semibold leading-6 text-balance"></h2>' +
			'<div class="mt-3 overflow-hidden rounded-xl border border-kumo-line bg-kumo-base"><div class="flex items-center justify-between gap-4 px-4 py-4">' +
			'<div class="min-w-0"><div class="font-medium"></div><div class="text-sm text-kumo-subtle"></div></div>' +
			'<button type="button" role="switch" class="ek-switch" aria-checked="false" disabled></button></div></div>';
		sec.querySelector("h2").textContent = nb ? "Innlogging" : "Sign-in";
		sec.querySelector(".font-medium").textContent = nb ? "Logg ut automatisk ved midnatt" : "Sign out automatically at midnight";
		sec.querySelector(".text-kumo-subtle").textContent = nb
			? "Alle brukere logges ut ved slutten av hver dag (norsk tid) og må logge inn på nytt neste dag."
			: "Everyone is signed out at the end of each day (Norwegian time) and signs in again the next day.";
		const sw = sec.querySelector("button");
		sw.setAttribute("aria-label", sec.querySelector(".font-medium").textContent);
		const api = (init) => fetch("/api/innstillinger", { credentials: "same-origin", ...init }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
		const show = (d) => { sw.setAttribute("aria-checked", String(d.autoLogout)); sw.disabled = false; };
		api().then(show).catch(() => {});
		sw.addEventListener("click", () => {
			const next = sw.getAttribute("aria-checked") !== "true";
			sw.disabled = true;
			api({ method: "PUT", headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" }, body: JSON.stringify({ autoLogout: next }) })
				.then(show)
				.catch(() => { sw.disabled = false; });
		});
		secGrid.append(sec);
	}
	// «Sjekk e-posten din» etter innloggingslenke: knapper som åpner de vanligste e-posttjenestene, riktig tjeneste først
	const checkMail = [...document.querySelectorAll("h2")].find((h) => /^(Sjekk e-posten din|Check your email)$/.test(h.textContent.trim()));
	const mailBox = checkMail?.parentElement?.parentElement;
	const mailBack = mailBox && [...mailBox.children].find((c) => c.matches("button"));
	if (mailBack && !mailBox.querySelector(".ek-mailapps")) {
		const nb = document.documentElement.lang.startsWith("nb") || checkMail.textContent.includes("Sjekk");
		const email = (checkMail.parentElement.querySelector("p span")?.textContent || "").trim().toLowerCase();
		const domain = email.split("@")[1] || "";
		const consumer = { "gmail.com": "google", "googlemail.com": "google", "outlook.com": "outlook", "hotmail.com": "outlook", "hotmail.no": "outlook", "live.com": "outlook", "live.no": "outlook", "msn.com": "outlook", "icloud.com": "apple", "me.com": "apple", "mac.com": "apple" };
		// Avsenderen av innloggingslenken (cloudflareEmail i astro.config.mjs): Gmail åpner rett på e-posten
		const gmail = "https://mail.google.com/mail/u/" + (email ? encodeURIComponent(email) : "0") + "/#search/from%3A${encodeURIComponent(kit.email.from?.email ?? "")}";
		const apps = [
			{ id: "google", label: "Gmail", href: gmail, icon: '<svg viewBox="0 0 24 24"><path fill="#EA4335" d="M2 6.5 12 13l10-6.5V18a2 2 0 0 1-2 2h-2V9.8l-6 4-6-4V20H4a2 2 0 0 1-2-2z"/><path fill="#FBBC04" d="M18 9.8V20h2a2 2 0 0 0 2-2V6.5z"/><path fill="#34A853" d="M6 9.8V20H4a2 2 0 0 1-2-2V6.5z"/><path fill="#C5221F" d="M2 6.5V6a2 2 0 0 1 3.2-1.6L12 9.5l6.8-5.1A2 2 0 0 1 22 6v.5L12 13z"/></svg>' },
			{ id: "microsoft", label: "Outlook", href: consumer[domain] === "outlook" ? "https://outlook.live.com/mail/0/" : "https://outlook.office.com/mail/", icon: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="13" height="16" rx="2" fill="#0A64C8"/><circle cx="8.5" cy="12" r="3.2" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M15 7h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-6" fill="#28A8EA"/><path d="m15 9 3.5 2.5L22 9" fill="none" stroke="#fff" stroke-width="1.2"/></svg>' },
			{ id: "apple", label: "iCloud Mail", href: "https://www.icloud.com/mail/", icon: '<svg viewBox="0 0 24 24"><path fill="#3E9BF6" d="M7 19a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9.5 4.75 4.75 0 0 1 17.5 19z"/></svg>' },
		];
		const box = document.createElement("div");
		box.className = "ek-mailapps";
		const title = document.createElement("p");
		title.textContent = nb ? "Åpne e-posten din" : "Open your email";
		const row = document.createElement("div");
		const draw = (first) => {
			row.replaceChildren(
				...[...apps].sort((a, b) => (b.id === first) - (a.id === first)).map((app) => {
					const a = document.createElement("a");
					a.href = app.href;
					a.target = "_blank";
					a.rel = "noopener";
					a.innerHTML = app.icon;
					a.append(app.label);
					if (app.id === first) a.className = "first";
					return a;
				}),
			);
		};
		const known = consumer[domain] === "outlook" ? "microsoft" : consumer[domain];
		draw(known);
		// Firmadomener (f.eks. Google Workspace eller Microsoft 365): spør serveren om MX-oppføringene
		if (!known && domain) fetch("/api/epostleverandor?d=" + encodeURIComponent(domain)).then((r) => r.json()).then((d) => d.provider && draw(d.provider)).catch(() => {});
		box.append(title, row);
		mailBox.insertBefore(box, mailBack);
	}
	// Mørk/lys-knappen trengs ikke, EmDash vises alltid lyst
	document.querySelectorAll("button[aria-label]").forEach((b) => {
		if (/^(switch to (light|dark)|bytt til (lys|mørk))/i.test(b.getAttribute("aria-label"))) b.style.display = "none";
	});
	// Innstillinger: skjul seksjoner der alle lenkene er skjult (f.eks. "API Tokens")
	document.querySelectorAll("main section").forEach((s) => {
		const a = [...s.querySelectorAll("a[href]")];
		if (a.length && a.every((l) => getComputedStyle(l).display === "none")) s.style.display = "none";
	});
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	for (let n; (n = walker.nextNode()); ) {
		// Samme navn som i menyen på /admin
		if (n.nodeValue === "Dashbord" && n.parentElement?.closest(".emdash-sidebar")) n.nodeValue = "Oversikt";
		// EmDash blander språk i tittelen på ny artikkel ("New Artikkel")
		for (const f of ${JSON.stringify(NEW_FIX)}) if (n.nodeValue === f.en) n.nodeValue = document.documentElement.lang.startsWith("nb") ? f.nb : f.enOut;
		// Samlingene heter "Artikler" og "Sider" i databasen: engelske navn når admin er på engelsk
		if (!document.documentElement.lang.startsWith("nb") && !n.parentElement?.closest("[contenteditable], input, textarea")) {
			const t = n.nodeValue.trim();
			if (COLLECTION_EN[t]) n.nodeValue = n.nodeValue.replace(t, COLLECTION_EN[t]);
			else {
				const m = t.match(COLLECTION_EN_RE);
				if (m) n.nodeValue = n.nodeValue.replace(t, m[1] + " " + COLLECTION_EN[cap(m[2])].toLowerCase() + m[3]);
			}
		}
		// Noen få EmDash-tekster med innebygde lenker mangler i den norske oversettelsen (resten: translations/emdash-nb.json)
		if (document.documentElement.lang.startsWith("nb")) {
			// EmDash setter inn samlingsnavnet med stor forbokstav ("Avpubliser Side"); på norsk skrives det med liten
			const m = n.nodeValue.match(/^(\\s*)(Avpubliser|Publiser|Lagre|Slett|Rediger|Dupliser|Forhåndsvis|Gjenopprett|Planlegg|Ny|Nytt|Legg til|Søk i|Velg) (${reAlt(NB_NAMES)})(\\s*)$/);
			if (m) n.nodeValue = m[1] + m[2] + " " + m[3].toLowerCase() + m[4];
			const nb = NB_EXTRA[n.nodeValue.trim()];
			if (nb) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), nb);
		}
		// Vibe Editor-siden er bare på norsk: engelsk tekst når admin er på engelsk
		if (!document.documentElement.lang.startsWith("nb")) {
			const en = VIBE_EN[n.nodeValue.trim()];
			if (en) n.nodeValue = en;
			else if (/^Koblet til /.test(n.nodeValue)) {
				n.nodeValue = n.nodeValue
					.replace(/^Koblet til Vibe Editor \\((.*)\\)\\. Kreditter igjen: (.*)\\.$/, "Connected to Vibe Editor ($1). Credits left: $2.")
					.replace(/^Koblet til (.*)\\.$/, "Connected $1.")
					.replace("ubegrenset", "unlimited");
			}
		}
		if (n.nodeValue.includes("EmDash") && !n.parentElement?.closest("[contenteditable], input, textarea")) {
			n.nodeValue = n.nodeValue.replace(/EmDash/g, ${JSON.stringify(kit.brand.name)});
			const dialog = n.parentElement?.closest("[role=dialog]");
			const icon = dialog && [...dialog.querySelectorAll("svg")].find((s) => !s.closest("button"));
			if (icon) {
				const img = document.createElement("img");
				img.src = ${JSON.stringify(kit.brand.icon || kit.brand.logo)};
				img.alt = ${JSON.stringify(kit.brand.name)};
				img.width = 40;
				icon.replaceWith(img);
			}
		}
	}
};
// Språk valgt i EmDash (Innstillinger → Språk) gjelder også kontrollpanelet på /admin
const syncLang = () => {
	const m = document.cookie.match(/(?:^|; )emdash-locale=([^;]+)/);
	if (!m) return;
	const lang = m[1].startsWith("nb") ? "nb" : "en";
	document.cookie = ${JSON.stringify(names.langCookie + "=")} + lang + "; Path=/admin; SameSite=Lax; Max-Age=31536000" + (location.protocol === "https:" ? "; Secure" : "");
};
syncLang();
addEventListener("pagehide", syncLang);
document.addEventListener("click", syncLang, true);

let queued = false;
new MutationObserver(() => {
	if (queued) return;
	queued = true;
	requestAnimationFrame(() => { queued = false; tidy(); });
}).observe(document.documentElement, { childList: true, subtree: true });
</script>`;

// Be nettleseren alltid bruke https for nettstedet (HSTS)
const HSTS = "max-age=31536000";
function withHsts(response: Response, protocol: string): Response {
	if (protocol !== "https:") return response;
	try {
		response.headers.set("Strict-Transport-Security", HSTS);
		return response;
	} catch {
		// Noen svar har låste headere: lag en kopi
		const headers = new Headers(response.headers);
		headers.set("Strict-Transport-Security", HSTS);
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	}
}

// Hoveddomenet (NETTSTED i wrangler.jsonc, f.eks. "kunde.no"). Når det er satt, sendes alle andre adresser
// (kunde.getonnet.cloud, www.) dit med 301, så søkemotorer og lenker samles på ett domene.
// Tomt = ingen videresending. Lokalt (localhost) og *.workers.dev sendes aldri videre.
function redirectToCanonical(url: URL): Response | null {
	const host = ((env as unknown as { NETTSTED?: string }).NETTSTED ?? "").trim().toLowerCase();
	if (!host || url.hostname === host) return null;
	if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".workers.dev")) return null;
	return new Response(null, { status: 301, headers: { Location: `https://${host}${url.pathname}${url.search}` } });
}

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	const moved = redirectToCanonical(context.url);
	if (moved) return moved;

	// Norsk som standard i EmDash-admin, som på /admin. Uten valgt språk velger EmDash nettleserens språk (ofte
	// engelsk), og da blir admin halvt norsk og halvt engelsk. Brukeren kan bytte under Innstillinger → Språk.
	if (pathname.startsWith(ADMIN) && context.request.method === "GET" && !context.cookies.get("emdash-locale")) {
		const secure = context.url.protocol === "https:";
		context.cookies.set("emdash-locale", "nb", { path: "/_emdash", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, secure });
		context.cookies.set(names.langCookie, "nb", { path: "/admin", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, secure });
		return context.redirect(`${pathname}${context.url.search}`, 302);
	}

	if (pathname === ADMIN || pathname === `${ADMIN}/`) {
		return context.redirect("/admin", 302);
	}

	// Automatisk utlogging ved midnatt (norsk tid): innlogginger fra en tidligere dag avsluttes.
	// Slås av og på under Innstillinger → Sikkerhet. Dagen lagres i økten første gang brukeren sees.
	const user = context.locals.user;
	if (user && context.session) {
		const today = osloDay();
		const seen = await context.session.get(names.loginSessionKey);
		if (!seen || seen.id !== user.id) context.session.set(names.loginSessionKey, { id: user.id, day: today });
		else if (seen.day !== today && (await autoLogoutOn().catch(() => false))) {
			context.session.destroy();
			(context.locals as { user?: unknown }).user = undefined;
			// Admin-appen sender brukeren til innloggingen når API-et svarer 401
			if (pathname.startsWith("/_emdash/api/")) {
				return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Session expired" } }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (pathname.startsWith(ADMIN)) {
				return context.redirect(`${ADMIN}/login?redirect=${encodeURIComponent(pathname + context.url.search)}`, 302);
			}
		}
	}

	// Rolle og faner for denne brukeren (src/roller.ts). Ser super admin «som» en annen rolle, får EmDash
	// det lavere nivået, slik at API-et tillater det samme som menyen viser. Sider utenfor rollens faner sendes til /admin.
	let access: Access | null = null;
	const current = context.locals.user;
	if (current) {
		access = await accessFor(current, context.cookies.get(VIEW_AS_COOKIE)?.value).catch(() => null);
		if (access) {
			(context.locals as any)[names.localsAccess] = access;
			(context.locals as any)[names.localsRealLevel] = current.role;
			if (access.viewAs) (context.locals as any).user = { ...current, role: access.level };
			const guarded = pathname.startsWith("/admin") || (pathname.startsWith(ADMIN) && !pathname.startsWith(`${ADMIN}/login`));
			if (guarded && !allows(access.tabs, pathname)) return context.redirect("/admin", 302);
			// Vibe Editor-verktøyet på nettsiden: bare roller med fanen «Vibe Editor»
			if (pathname === VIBE_CLIENT && !access.tabs.includes("vibe")) {
				return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Vibe Editor is not enabled for this role" } }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
		}
	}

	const response = withHsts(await next(), context.url.protocol);

	// Bilder fra mediebiblioteket har unike navn (et nytt bilde får ny adresse): nettleseren kan beholde dem i 30 dager
	// i stedet for å spørre på nytt ved hver sidevisning (EmDash sender max-age=0)
	if (pathname.startsWith("/_emdash/api/media/file/") && response.status === 200) {
		try {
			response.headers.set("Cache-Control", "public, max-age=2592000");
		} catch {
			const headers = new Headers(response.headers);
			headers.set("Cache-Control", "public, max-age=2592000");
			return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
		}
	}

	if (pathname.startsWith(ADMIN) && response.headers.get("content-type")?.includes("text/html")) {
		const html = await response.text();
		const headers = new Headers(response.headers);
		headers.delete("content-length");
		// Brukeren til kortet nederst i menyen, og undertittel på riktig språk
		const user = context.locals.user;
		const name = user ? user.name || user.email : "";
		const initials = name
			.split(/[\s@.]/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w: string) => w[0]!.toUpperCase())
			.join("");
		const nb = !(context.cookies.get("emdash-locale")?.value ?? "nb").startsWith("en");
		// Menypunkter rollen ikke har: skjules i EmDash-menyen (sidene er sperret i tillegg, se over)
		const hiddenTabs = access ? (Object.keys(TAB_PATHS) as Tab[]).filter((t) => !access!.tabs.includes(t)).flatMap((t) => TAB_PATHS[t]).filter((p) => p.startsWith(ADMIN)) : [];
		const tabLinks = hiddenTabs.map((p) => `a[href^="${p}"]`);
		const tabCss = tabLinks.length ? `<style>${tabLinks.join(",")},${tabLinks.map((l) => `li:has(> ${l})`).join(",")}{display:none!important}</style>` : "";
		const roleNames: Record<string, string> = nb
			? { superadmin: "Super admin", admin: "Administrator", innholdsansvarlig: "Innholdsansvarlig", innholdsmedarbeider: "Innholdsmedarbeider", lesetilgang: "Lesetilgang" }
			: { superadmin: "Super admin", admin: "Administrator", innholdsansvarlig: "Content manager", innholdsmedarbeider: "Content staff", lesetilgang: "Read only" };
		const texts = nb
			? { tilganger: "Tilganger", security: "Sikkerhet og passnøkler", viewingAs: "Du ser siden som {role}", exitViewAs: "Avslutt «Se som»" }
			: { tilganger: "Access", security: "Security and passkeys", viewingAs: "You are viewing the site as {role}", exitViewAs: "Exit “View as”" };
		const ekUser = user
			? {
					name,
					initials,
					role: user.role,
					email: user.email,
					roleLabel: access ? roleNames[access.role] : "",
					superadmin: access?.realRole === "superadmin",
					viewAs: access?.viewAs ? roleNames[access.viewAs] : null,
					t: texts,
				}
			: null;
		const perRequest =
			(kit.brand.fontsCss ? `<link rel="stylesheet" href="${kit.brand.fontsCss}">` : "") +
			`<style>:root{--ek-tagline:"${nb ? "INNHOLDSSTUDIO" : "CONTENT STUDIO"}"}</style>` +
			tabCss +
			(ekUser ? `<script>window.__ekUser=${JSON.stringify(ekUser).replace(/</g, "\\u003c")}</script>` : "");
		return new Response(html.replace("</head>", `${perRequest}${inject}</head>`), {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	return response;
});
