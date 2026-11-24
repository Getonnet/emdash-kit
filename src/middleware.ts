// Tilpasser EmDash-admin for prosjektet (samme oppsett som AESTO og Trening For Deg), ut fra kit-oppsettet:
// - /_emdash/admin (forsiden) sender videre til kontrollpanelet på /admin
// - prosjektets farger og skrift, alltid lys modus, ingen toppbar, brukeren nederst i menyen
// - menypunkter som ikke trengs skjules; Vibe Editor og Tilganger legges inn i menyen
// - innlogging med e-post og passord i stedet for passnøkkel (src/passord.ts)
// - roller og tilganger, automatisk utlogging ved midnatt, norsk som standard, hoveddomene, HSTS
import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { osloDay } from "./besok";
import { allCollections, cssVars, kit, mode, names } from "./config";
import { adminExtraCss, adminExtraJs } from "./admin-extra";
import { autoLogoutOn } from "./innstillinger";
import { accessFor, allows, SECURITY_PATH, TAB_PATHS, VIBE_CLIENT, VIEW_AS_COOKIE, type Access, type Tab } from "./roller";
import { hasPassword } from "./passord";

const ADMIN = "/_emdash/admin";

// Sider i EmDash som ikke trengs (meny, seksjoner, utvidelser osv.), fra kit-oppsettet
const HIDDEN = kit.hiddenAdminPaths;

// Utvidelser som skal vises i menyen likevel (Vibe Editor brukes av redaktørene)
const KEEP = kit.vibeEditor ? [`${ADMIN}/plugins/vibe-editor`] : [];
// Ikonet der det er plass til et kvadrat (sammenslått meny, dialoger); logoen hvis prosjektet ikke har ikon
const ICON = kit.brand.icon || kit.brand.logo;
// Lenker kit-en legger inn selv (data-ek), som Utvidelser for super admin, skjules aldri
const keep = KEEP.map((p) => `:not([href^="${p}"])`).join("") + ":not([data-ek])";
const links = HIDDEN.map((p) => `a[href^="${ADMIN}${p}"]${keep}`);

// Prosjektets farger i EmDash (samme som /admin), som CSS-variabler fra kit-oppsettet; alltid lys eller alltid mørk
// modus (brand.mode)
const theme = `:root,html[data-theme][data-mode]{${cssVars()}}
html[data-theme][data-mode]{
--color-kumo-canvas:var(--ek-paper);--color-kumo-base:var(--ek-card);--color-kumo-elevated:var(--ek-card);--color-kumo-recessed:var(--ek-paper-deep);
--color-kumo-overlay:var(--ek-card);--color-kumo-control:var(--ek-card);--color-kumo-tint:var(--ek-paper);--color-kumo-fill:var(--ek-line);
--color-kumo-fill-hover:var(--ek-paper-deep);--color-kumo-interact:var(--ek-interact);--color-kumo-contrast:var(--ek-ink);
--color-kumo-line:color-mix(in srgb,var(--ek-ink) 10%,transparent);--color-kumo-hairline:var(--ek-line);--color-kumo-brand:var(--ek-accent);--color-kumo-brand-hover:var(--ek-accent-hover);
--color-kumo-focus:var(--ek-accent);--text-color-kumo-default:var(--ek-ink);--text-color-kumo-strong:var(--ek-ink);--text-color-kumo-subtle:var(--ek-muted);
--text-color-kumo-placeholder:var(--ek-label);--text-color-kumo-inactive:var(--ek-label);--text-color-kumo-inverse:var(--ek-paper);--text-color-kumo-brand:var(--ek-accent-ink);--text-color-kumo-link:var(--ek-accent-ink);
color-scheme:${mode};background:var(--ek-paper);font-family:var(--ek-font)}
.bg-kumo-brand,.bg-kumo-brand *{color:var(--ek-accent-text)!important}
/* Hovedknappene («Lagre», «Publiser») i hovedfargen. EmDash setter knappefargen i style-attributtet, derfor !important */
html[data-theme] [class*="kumo-button-emphasis-bg"]{--kumo-button-emphasis-bg:var(--ek-accent)!important;--kumo-button-emphasis-ring:var(--ek-accent)!important;--color-white:var(--ek-accent-text)}
html[data-theme] [class*="kumo-button-emphasis-bg"]:hover{--kumo-button-emphasis-bg:var(--ek-accent-hover)!important}
/* Brytere og avkrysningsbokser i hovedfargen (ellers EmDash-blå) */
[data-kumo-component=Switch],[data-kumo-component=Checkbox]{--color-blue-300:var(--ek-line-strong);--color-blue-500:var(--ek-accent);--color-blue-600:var(--ek-accent)}
body,main{background:var(--ek-paper)!important}
/* Velkomstdialogen setter logoen i en firkant på 32×32 (laget for et ikon). Logoen er et bredt ordmerke: vis det i riktige proporsjoner */
${kit.brand.logo ? `[role=dialog] img[src="${kit.brand.logo}"]` : "[data-ek-none]"}{width:140px!important;height:auto!important;max-width:none!important;max-height:none!important;object-fit:contain}
/* Innlogging og invitasjon: et bredt ordmerke blir for stort i EmDash sin høyde (40 px), særlig på mobil */
${kit.brand.logo ? `img.h-10[src="${kit.brand.logo}"]{height:auto!important;width:min(220px,64vw)!important;max-height:56px;object-fit:contain}` : ""}
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
.emdash-sidebar[data-state=collapsed] [data-sidebar=header] img{${ICON ? `content:url("${ICON}");` : ""}width:32px!important;height:32px!important;border-radius:8px;object-fit:contain}
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
.ek-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--ek-card);box-shadow:0 1px 2px color-mix(in srgb,var(--ek-shadow) 20%,transparent);transition:transform .15s}
.ek-switch[aria-checked=true]{background:var(--ek-accent-ink)}.ek-switch[aria-checked=true]::after{transform:translateX(16px)}
.ek-switch:disabled{opacity:.5;cursor:wait}.ek-switch:focus-visible{outline:2px solid var(--ek-accent-ink);outline-offset:2px}
/* Innlogging, invitasjon og Sikkerhet med passord (src/passord.ts) */
.ek-pw{display:flex;flex-direction:column;gap:14px}
.ek-pw label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:500;color:var(--ek-ink)}
.ek-pw input{height:40px;padding:0 12px;border:1px solid var(--ek-line-strong);border-radius:8px;background:var(--ek-card);color:var(--ek-ink);font:inherit;font-size:14px}
.ek-pw input:focus{outline:2px solid var(--ek-accent);outline-offset:-1px;border-color:transparent}
.ek-pw input[readonly]{background:var(--ek-paper);color:var(--ek-muted)}
.ek-pw .ek-btn{height:40px;border:0;border-radius:8px;background:var(--ek-accent);color:var(--ek-accent-text);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.ek-pw .ek-btn:hover{background:var(--ek-accent-hover)}.ek-pw .ek-btn:disabled{opacity:.6;cursor:wait}
.ek-pw .ek-link{align-self:center;border:0;background:none;padding:4px;color:var(--ek-accent-ink);font:inherit;font-size:13px;cursor:pointer}
.ek-pw .ek-link:hover{text-decoration:underline}
.ek-pw .ek-err{margin:0;padding:10px 12px;border-radius:8px;background:color-mix(in srgb,#dc2626 10%,transparent);color:#b91c1c;font-size:13px}
.ek-pw .ek-ok{margin:0;padding:10px 12px;border-radius:8px;background:var(--ek-wash);color:var(--ek-accent-ink);font-size:13px}
.ek-pw .ek-hint{margin:-6px 0 0;font-size:12px;color:var(--ek-muted)}
.ek-mailapps{margin-top:4px;text-align:center}.ek-mailapps p{font-size:13px;color:var(--ek-muted);margin:0 0 10px}
.ek-mailapps div{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.ek-mailapps a{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border:1px solid var(--ek-line);border-radius:10px;background:var(--ek-card);color:var(--ek-ink);font-size:14px;font-weight:600;text-decoration:none;transition:border-color .15s,box-shadow .15s}
.ek-mailapps a:hover{border-color:var(--ek-accent-ink);box-shadow:0 2px 8px color-mix(in srgb,var(--ek-shadow) 8%,transparent)}.ek-mailapps a:focus-visible{outline:2px solid var(--ek-accent-ink);outline-offset:2px}
.ek-mailapps a.first{border-color:var(--ek-accent-ink);background:var(--ek-wash)}.ek-mailapps svg{width:18px;height:18px;flex-shrink:0}
/* Ingen toppbar i EmDash (som på /admin): «Vis nettsted» er et ikon ved logoen, Logg ut ligger på brukeren nederst. På mobil beholdes bare menyknappen */
header.sticky:has(>[data-sidebar=trigger])>div:not(.ek-mbar){display:none!important}
@media(min-width:768px){header.sticky:has(>[data-sidebar=trigger]){display:none!important}}
/* Ligger som søsken etter header-elementet i menyen (React tegner header på nytt), oppe til høyre */
.ek-site{position:absolute;top:24px;right:14px;z-index:2;display:flex;padding:7px;border-radius:8px;color:var(--ek-muted);text-decoration:none}.ek-site:hover{background:var(--ek-paper);color:var(--ek-ink)}
.ek-site svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.emdash-sidebar[data-state=collapsed] .ek-site{display:none}
.ek-user{position:relative;cursor:pointer}.ek-user:hover{background:var(--ek-paper)}
.ek-pop{position:absolute;left:12px;right:12px;bottom:calc(100% + 6px);background:var(--ek-card);border:1px solid var(--ek-line);border-radius:12px;box-shadow:0 14px 40px color-mix(in srgb,var(--ek-shadow) 9%,transparent);padding:6px;z-index:30;cursor:default}
.ek-pop .who{white-space:normal;overflow-wrap:anywhere;padding:10px 12px 8px;border-bottom:1px solid var(--ek-line);margin-bottom:6px}.ek-pop .who strong{display:block;font-size:13px;color:var(--ek-ink)}.ek-pop .who small{font-size:12px;color:var(--ek-muted)}
.ek-pop button{width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;text-align:left;background:none;border:0;color:var(--ek-ink);cursor:pointer;font:inherit;font-size:13px}.ek-pop button:hover{background:var(--ek-paper)}
.ek-pop svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.ek-viewas{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;background:var(--ek-ink);color:var(--ek-card);border-radius:30px;box-shadow:0 14px 40px color-mix(in srgb,var(--ek-shadow) 19%,transparent);font-size:13px;font-weight:500;white-space:nowrap}
.ek-viewas button{background:var(--ek-accent);color:var(--ek-accent-text);border:0;border-radius:30px;padding:6px 12px;font:inherit;font-weight:600;font-size:12.5px;cursor:pointer;white-space:nowrap}
/* Mobil: logoen og «Vis nettsted» i toppbaren til EmDash (samme som toppstripen på /admin) */
.ek-mbar{display:flex;flex:1;min-width:0;align-items:center;justify-content:space-between;gap:8px;margin-left:6px}
.ek-mbar a{display:flex;align-items:center;color:var(--ek-muted);text-decoration:none}
.ek-mbar img{height:24px;width:auto;max-width:150px;object-fit:contain}
.ek-mbar .ek-mname{font:600 17px/1.2 var(--ek-heading);color:var(--ek-ink)}
.ek-mbar .ek-msite{display:grid;place-items:center;width:40px;height:40px;border-radius:10px}.ek-mbar .ek-msite:hover{background:var(--ek-paper)}
.ek-mbar svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
header.sticky>[data-sidebar=trigger]{width:40px;height:40px}
/* Mobil: stripen og brukermenyen får plass innenfor skjermen, og knappene er store nok å treffe med fingeren */
@media(max-width:767px){
.ek-viewas{left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));transform:none;white-space:normal;justify-content:space-between;line-height:1.35}
.ek-viewas button{padding:9px 14px}
.ek-pop button{padding:12px}
.ek-site{padding:10px;top:20px}
.ek-mailapps a{padding:12px 16px}
}`;


// Samlingene på norsk og engelsk (fra kit-oppsettet), til tekstrettingene i admin
const COLLECTIONS = allCollections();
const NB_NAMES = COLLECTIONS.flatMap((c) => [c.nb.plural, c.nb.singular]);
const COLLECTION_EN_MAP = Object.fromEntries(COLLECTIONS.flatMap((c) => [[c.nb.plural, c.en.plural], [c.nb.singular, c.en.singular]]));
// Settes rett inn i skriptet på siden (ikke som en JavaScript-streng), så én skråstrek foran spesialtegn holder
const reAlt = (words: string[]) => words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const NEW_FIX = COLLECTIONS.map((c) => ({ en: "New " + c.nb.singular, nb: "Ny " + c.nb.singular.toLowerCase(), enOut: "New " + c.en.singular.toLowerCase() }));

const inject = `<style id="ek-admin">
${theme}
${links.join(",")},${links.map((l) => `li:has(> ${l})`).join(",")}{display:none!important}
${adminExtraCss}
</style>
<script>
// Alltid samme modus (lys eller mørk, brand.mode), slik at EmDash ser ut som kontrollpanelet på /admin
const fixMode = () => document.documentElement.getAttribute("data-mode") !== "${mode}" && document.documentElement.setAttribute("data-mode", "${mode}");
fixMode();
new MutationObserver(fixMode).observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });

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
	if (${kit.vibeEditor ? "true" : "false"} && settings && !sidebar.querySelector("[data-ek=vibe]")) {
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
	// Utvidelser (installerte plugins og versjonene, også kit-ens egen) bare for super admin, etter Tilganger
	const tilgAnchor = sidebar?.querySelector("[data-ek=tilganger]");
	if (tilgAnchor && window.__ekUser?.superadmin && !window.__ekUser.viewAs && !sidebar.querySelector("[data-ek=utvidelser]")) {
		const li = tilgAnchor.closest("li");
		const copy = (li || tilgAnchor).cloneNode(true);
		const a = copy.matches("a") ? copy : copy.querySelector("a");
		a.setAttribute("href", "${ADMIN}/plugins-manager");
		a.setAttribute("data-ek", "utvidelser");
		a.removeAttribute("aria-current");
		a.removeAttribute("data-active");
		const label = [...a.querySelectorAll("*")].find((e) => !e.children.length && e.textContent.trim());
		if (label) label.textContent = window.__ekUser.t.plugins;
		const svg = a.querySelector("svg");
		if (svg) { svg.setAttribute("viewBox", "0 0 256 256"); svg.innerHTML = '<rect x="40" y="40" width="72" height="72" rx="8" fill="none" stroke="currentColor" stroke-width="16"/><rect x="144" y="40" width="72" height="72" rx="8" fill="none" stroke="currentColor" stroke-width="16"/><rect x="40" y="144" width="72" height="72" rx="8" fill="none" stroke="currentColor" stroke-width="16"/><path d="M180 140v80M140 180h80" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round"/>'; }
		(li || tilgAnchor).after(copy);
	}
	for (const [sel, path] of [["[data-ek=tilganger]", "/admin/tilganger"], ["[data-ek=utvidelser]", "${ADMIN}/plugins-manager"]]) {
		const link = sidebar?.querySelector(sel);
		if (!link) continue;
		const here = location.pathname.startsWith(path);
		if (here && !link.hasAttribute("aria-current")) link.setAttribute("aria-current", "page");
		if (!here && link.hasAttribute("aria-current")) link.removeAttribute("aria-current");
		const plain = [...sidebar.querySelectorAll("a[data-sidebar=menu-button]")].find(
			(l) => !l.hasAttribute("data-ek") && !l.hasAttribute("aria-current") && !l.hasAttribute("data-active"),
		);
		if (!here && plain && link.className !== plain.className) link.className = plain.className;
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
	// Toppbaren på mobil: logo (til /admin) og «Vis nettsted», i stedet for en tom stripe med bare menyknappen
	const mhead = document.querySelector("header.sticky:has(>[data-sidebar=trigger])");
	if (mhead && !mhead.querySelector(".ek-mbar")) {
		const bar = document.createElement("div");
		bar.className = "ek-mbar";
		const home = document.createElement("a");
		home.href = "/admin";
		${kit.brand.logo ? `const img = document.createElement("img"); img.src = ${JSON.stringify(kit.brand.logo)}; img.alt = ${JSON.stringify(kit.brand.name)}; home.append(img);` : `const nm = document.createElement("span"); nm.className = "ek-mname"; nm.textContent = ${JSON.stringify(kit.brand.name)}; home.append(nm);`}
		const site = document.createElement("a");
		site.className = "ek-msite";
		site.href = "/";
		site.target = "_blank";
		site.rel = "noopener";
		site.setAttribute("aria-label", nbUi ? "Vis nettsted" : "View site");
		site.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
		bar.append(home, site);
		mhead.append(bar);
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
		// Eget passord (Innstillinger → Sikkerhet): alle roller, også de uten Innstillinger. Knapp, ikke lenke,
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
	// Innstillinger → Sikkerhet: brytere for automatisk utlogging ved midnatt og automatisk oppdatering (bare administratorer, gjelder hele nettstedet)
	const secGrid = location.pathname === "${ADMIN}/settings/security" && (u?.role ?? 0) >= 50 && document.querySelector("main .mt-6 > .grid.gap-8");
	if (secGrid && !secGrid.querySelector("[data-ek=autologout]")) {
		const nb = document.documentElement.lang.startsWith("nb");
		const api = (init) => fetch("/api/innstillinger", { credentials: "same-origin", ...init }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
		const toggle = (id, key, heading, label, hint) => {
			const sec = document.createElement("section");
			sec.setAttribute("data-ek", id);
			sec.innerHTML =
				'<h2 class="text-lg font-semibold leading-6 text-balance"></h2>' +
				'<div class="mt-3 overflow-hidden rounded-xl border border-kumo-line bg-kumo-base"><div class="flex items-center justify-between gap-4 px-4 py-4">' +
				'<div class="min-w-0"><div class="font-medium"></div><div class="text-sm text-kumo-subtle"></div></div>' +
				'<button type="button" role="switch" class="ek-switch" aria-checked="false" disabled></button></div></div>';
			sec.querySelector("h2").textContent = heading;
			sec.querySelector(".font-medium").textContent = label;
			sec.querySelector(".text-kumo-subtle").textContent = hint;
			const sw = sec.querySelector("button");
			sw.setAttribute("aria-label", label);
			const show = (d) => { sw.setAttribute("aria-checked", String(d[key])); sw.disabled = false; };
			api().then(show).catch(() => {});
			sw.addEventListener("click", () => {
				const next = sw.getAttribute("aria-checked") !== "true";
				sw.disabled = true;
				api({ method: "PUT", headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" }, body: JSON.stringify({ [key]: next }) })
					.then(show)
					.catch(() => { sw.disabled = false; });
			});
			secGrid.append(sec);
		};
		toggle("autologout", "autoLogout", nb ? "Innlogging" : "Sign-in",
			nb ? "Logg ut automatisk ved midnatt" : "Sign out automatically at midnight",
			nb ? "Alle brukere logges ut ved slutten av hver dag (norsk tid) og må logge inn på nytt neste dag." : "Everyone is signed out at the end of each day (Norwegian time) and signs in again the next day.");
		toggle("autoupdate", "autoUpdate", nb ? "Oppdateringer" : "Updates",
			nb ? "Oppdater nettstedet automatisk" : "Update the website automatically",
			nb ? "Hver morgen kl. 09.00 (norsk tid) installeres feilrettinger og sikkerhetsoppdateringer. Nettstedet publiseres bare hvis alt bygger som det skal." : "Every morning at 09:00 (Norwegian time) bug fixes and security updates are installed. The website is only published if everything builds correctly.");
	}
	// Passord i stedet for passnøkkel (src/passord.ts): innlogging, invitasjon og Innstillinger → Sikkerhet
	// Uten passord ennå: bare Sikkerhet (også når EmDash bytter side uten å laste den på nytt)
	if (window.__ekUser?.needsPassword && location.pathname !== "${ADMIN}/settings/security") {
		location.replace("${ADMIN}/settings/security?passord=ny");
		return;
	}
	const pwT = document.documentElement.lang.startsWith("nb")
		? { email: "E-post", password: "Passord", repeat: "Gjenta passordet", name: "Navn", login: "Logg inn", forgot: "Glemt passordet? Få en innloggingslenke på e-post",
			wrong: "Feil e-post eller passord.", locked: "For mange forsøk. Prøv igjen om {min} min.", failed: "Noe gikk galt. Prøv igjen.",
			loginHelp: "Logg inn med e-post og passord.", tooShort: "Passordet må ha minst {n} tegn.", sameAsEmail: "Passordet kan ikke være e-postadressen.",
			mismatch: "Passordene er ikke like.", tooLong: "Passordet kan ha høyst 200 tegn.", nameRequired: "Skriv inn navnet ditt.", create: "Opprett konto", invalidInvite: "Invitasjonen er ugyldig eller utløpt.",
			pwSub: "Administrer passordet og innloggingen din", pwHeading: "Passord", pwNew: "Nytt passord", pwSave: "Lagre passordet", pwSaved: "Passordet er lagret.",
			pwHas: "Du logger inn med e-postadressen din og dette passordet. Glemt passordet? Velg «Glemt passordet?» på innloggingssiden.",
			pwFirst: "Lag et passord for å fortsette. Fra nå logger du inn med e-post og passord i stedet for passnøkkel." }
		: { email: "Email", password: "Password", repeat: "Repeat password", name: "Name", login: "Sign in", forgot: "Forgot your password? Get a sign-in link by email",
			wrong: "Wrong email or password.", locked: "Too many attempts. Try again in {min} min.", failed: "Something went wrong. Please try again.",
			loginHelp: "Sign in with your email and password.", tooShort: "The password needs at least {n} characters.", sameAsEmail: "The password can't be your email address.",
			mismatch: "The passwords don't match.", tooLong: "The password can have at most 200 characters.", nameRequired: "Enter your name.", create: "Create account", invalidInvite: "The invite is invalid or has expired.",
			pwSub: "Manage your password and sign-in", pwHeading: "Password", pwNew: "New password", pwSave: "Save password", pwSaved: "The password is saved.",
			pwHas: "You sign in with your email address and this password. Forgot it? Choose “Forgot your password?” on the sign-in page.",
			pwFirst: "Create a password to continue. From now on you sign in with email and password instead of a passkey." };
	const pwField = (label, attrs) => {
		const l = document.createElement("label");
		l.append(label);
		const i = document.createElement("input");
		for (const [k, v] of Object.entries(attrs)) i.setAttribute(k, v);
		l.append(i);
		return [l, i];
	};
	const pwMsg = (form, cls, text) => {
		form.querySelector(".ek-err, .ek-ok")?.remove();
		if (!text) return;
		const p = document.createElement("p");
		p.className = cls;
		p.setAttribute("role", cls === "ek-err" ? "alert" : "status");
		p.textContent = text;
		form.prepend(p);
	};
	const pwError = (d, min) =>
		d?.error === "too_short" ? pwT.tooShort.replace("{n}", d.minLength ?? min) : d?.error === "same_as_email" ? pwT.sameAsEmail : d?.error === "name_required" ? pwT.nameRequired : d?.error === "too_long" ? pwT.tooLong : pwT.failed;
	const pwPost = (url, method, body) =>
		fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" }, body: JSON.stringify(body) })
			.then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }));
	const pwCard = document.querySelector("div.rounded-lg.shadow-sm.p-6");
	// Innlogging: passnøkkel-knappen byttes med e-post og passord. «Glemt passordet?» åpner EmDash sin innloggingslenke.
	if (pwCard && location.pathname === "${ADMIN}/login") {
		const passkeyView = [...pwCard.children].find((c) => c.matches(".space-y-6") && !c.hasAttribute("data-ek"));
		let form = pwCard.querySelector("form[data-ek=passord]");
		// Byttet språk på innloggingssiden: lag skjemaet på nytt med riktige tekster
		if (form && form.dataset.lang !== document.documentElement.lang) { form.remove(); form = null; }
		if (passkeyView) {
			if (passkeyView.style.display !== "none") passkeyView.style.display = "none";
			if (!form) {
				form = document.createElement("form");
				form.className = "ek-pw";
				form.setAttribute("data-ek", "passord");
				form.dataset.lang = document.documentElement.lang;
				const [le, email] = pwField(pwT.email, { type: "email", name: "email", autocomplete: "username", required: "" });
				const [lp, password] = pwField(pwT.password, { type: "password", name: "password", autocomplete: "current-password", required: "" });
				const submit = document.createElement("button");
				submit.type = "submit";
				submit.className = "ek-btn";
				submit.textContent = pwT.login;
				const forgot = document.createElement("button");
				forgot.type = "button";
				forgot.className = "ek-link";
				forgot.textContent = pwT.forgot;
				// Siste knapp i EmDash sin passnøkkel-visning er «Logg inn med innloggingslenke»
				forgot.addEventListener("click", () => {
					const buttons = pwCard.querySelectorAll(".space-y-6:not([data-ek]) > button");
					buttons[buttons.length - 1]?.click();
				});
				form.append(le, lp, submit, forgot);
				form.addEventListener("submit", async (e) => {
					e.preventDefault();
					submit.disabled = true;
					pwMsg(form);
					const res = await pwPost("/api/passord/logg-inn", "POST", { email: email.value, password: password.value }).catch(() => null);
					if (res?.ok) {
						const to = new URLSearchParams(location.search).get("redirect") || "";
						// Bare stier på dette nettstedet: ikke to skråstreker eller skråstrek + bakoverstrek (92), som nettleseren leser som en annen adresse
						location.href = to[0] === "/" && to[1] !== "/" && to.charCodeAt(1) !== 92 ? to : "${ADMIN}";
						return;
					}
					submit.disabled = false;
					pwMsg(form, "ek-err", res?.status === 401 ? pwT.wrong : res?.status === 429 ? pwT.locked.replace("{min}", Math.ceil((res.data.retryAfter || 60) / 60)) : pwT.failed);
					if (res?.status === 401) { password.value = ""; password.focus(); }
				});
				pwCard.prepend(form);
			}
			if (form.style.display) form.style.display = "";
			const help = pwCard.nextElementSibling;
			if (help?.matches("p") && help.textContent !== pwT.loginHelp) help.textContent = pwT.loginHelp;
		} else if (form && form.style.display !== "none") form.style.display = "none";
	}
	// Invitasjon: navn og passord i stedet for å lage passnøkkel (ugyldig invitasjon: EmDash viser feilen selv)
	if (pwCard && location.pathname === "${ADMIN}/invite/accept" && !window.__ekInvite) {
		const token = new URLSearchParams(location.search).get("token") || "";
		window.__ekInvite = fetch("/api/passord/invitasjon?token=" + encodeURIComponent(token), { credentials: "same-origin" })
			.then((r) => (r.ok ? r.json() : null))
			.catch(() => null)
			.then((invite) => {
				if (!invite?.email) return;
				const card = document.querySelector("div.rounded-lg.shadow-sm.p-6") || pwCard;
				[...card.children].forEach((c) => { c.style.display = "none"; });
				const form = document.createElement("form");
				form.className = "ek-pw";
				form.setAttribute("data-ek", "invitasjon");
				const [le] = pwField(pwT.email, { type: "email", value: invite.email, readonly: "", autocomplete: "username" });
				const [ln, name] = pwField(pwT.name, { type: "text", name: "name", autocomplete: "name", required: "", maxlength: "100" });
				const [lp, password] = pwField(pwT.password, { type: "password", autocomplete: "new-password", required: "", minlength: String(invite.minLength) });
				const [lr, repeat] = pwField(pwT.repeat, { type: "password", autocomplete: "new-password", required: "" });
				const hint = document.createElement("p");
				hint.className = "ek-hint";
				hint.textContent = pwT.tooShort.replace("{n}", invite.minLength);
				const submit = document.createElement("button");
				submit.type = "submit";
				submit.className = "ek-btn";
				submit.textContent = pwT.create;
				form.append(le, ln, lp, hint, lr, submit);
				form.addEventListener("submit", async (e) => {
					e.preventDefault();
					pwMsg(form);
					if (password.value !== repeat.value) return pwMsg(form, "ek-err", pwT.mismatch);
					submit.disabled = true;
					const res = await pwPost("/api/passord/invitasjon", "POST", { token, name: name.value, password: password.value }).catch(() => null);
					if (res?.ok) { location.href = "/admin"; return; }
					submit.disabled = false;
					pwMsg(form, "ek-err", res && (res.status === 404 || res.status === 410) ? pwT.invalidInvite : pwError(res?.data, invite.minLength));
				});
				card.append(form);
				name.focus();
			});
	}
	// Innstillinger → Sikkerhet: passord i stedet for passnøkler (alle roller)
	let pwGrid = location.pathname === "${ADMIN}/settings/security" && document.querySelector("main .mt-6 > .grid.gap-8");
	// Endrer EmDash oppsettet på siden, legges skjemaet øverst i hovedinnholdet i stedet (ellers kunne brukere uten
	// passord bli stående fast her)
	if (location.pathname === "${ADMIN}/settings/security" && !pwGrid && document.querySelector("main h1")) {
		window.__ekPwWait ??= Date.now();
		if (Date.now() - window.__ekPwWait > 4000) pwGrid = document.querySelector("main");
		else if (!window.__ekPwTimer) window.__ekPwTimer = setTimeout(tidy, 4100);
	}
	if (pwGrid) {
		for (const s of pwGrid.querySelectorAll(":scope > section:not([data-ek])")) if (s.style.display !== "none") s.style.display = "none";
		// Undertittelen nevner passnøkler
		const sub = [...document.querySelectorAll("main [data-editor-header] p")].find((p) => /passnøkl|passkey/i.test(p.textContent));
		if (sub) sub.textContent = pwT.pwSub;
		if (!pwGrid.querySelector("[data-ek=passord]")) {
			// Uten passord ennå (også når siden åpnes direkte, uten ?passord=ny): be om å lage et
			const first = new URLSearchParams(location.search).get("passord") === "ny" || !!window.__ekUser?.needsPassword;
			const sec = document.createElement("section");
			sec.setAttribute("data-ek", "passord");
			sec.innerHTML = '<h2 class="text-lg font-semibold leading-6 text-balance"></h2><div class="mt-3 rounded-xl border border-kumo-line bg-kumo-base px-4 py-4"></div>';
			sec.querySelector("h2").textContent = pwT.pwHeading;
			const form = document.createElement("form");
			form.className = "ek-pw";
			form.style.maxWidth = "420px";
			const info = document.createElement("p");
			info.className = "ek-hint";
			info.style.margin = "0";
			info.textContent = first ? "" : pwT.pwHas;
			const [lp, password] = pwField(pwT.pwNew, { type: "password", autocomplete: "new-password", required: "", minlength: "10" });
			const [lr, repeat] = pwField(pwT.repeat, { type: "password", autocomplete: "new-password", required: "" });
			const hint = document.createElement("p");
			hint.className = "ek-hint";
			hint.textContent = pwT.tooShort.replace("{n}", 10);
			const submit = document.createElement("button");
			submit.type = "submit";
			submit.className = "ek-btn";
			submit.textContent = pwT.pwSave;
			// Brukernavnet til passordbehandleren (lagres sammen med passordet)
			const account = document.createElement("input");
			account.type = "email";
			account.autocomplete = "username";
			account.value = window.__ekUser?.email || "";
			account.hidden = true;
			form.append(account, info, lp, hint, lr, submit);
			form.addEventListener("submit", async (e) => {
				e.preventDefault();
				pwMsg(form);
				if (password.value !== repeat.value) return pwMsg(form, "ek-err", pwT.mismatch);
				submit.disabled = true;
				const res = await pwPost("/api/passord", "PUT", { password: password.value }).catch(() => null);
				submit.disabled = false;
				if (!res?.ok) return pwMsg(form, "ek-err", pwError(res?.data, 10));
				password.value = repeat.value = "";
				if (first) { location.href = "/admin"; return; }
				info.textContent = pwT.pwHas;
				pwMsg(form, "ek-ok", pwT.pwSaved);
			});
			if (first) pwMsg(form, "ek-ok", pwT.pwFirst);
			sec.querySelector("div").append(form);
			pwGrid.prepend(sec);
		}
	}
	// Brukere: EmDash regner «Sist innlogget» ut fra passnøklene. Vis innloggingene med passord i stedet, og skjul passnøklene.
	if (location.pathname.startsWith("${ADMIN}/users") && (window.__ekUser?.role ?? 0) >= 50) {
		if (!window.__ekLogins || Date.now() - window.__ekLogins.at > 30000) {
			window.__ekLogins = { at: Date.now(), map: window.__ekLogins?.map ?? null };
			fetch("/api/passord?brukere=1", { credentials: "same-origin" })
				.then((r) => (r.ok ? r.json() : null))
				.then((d) => { if (d?.lastLogins) { window.__ekLogins.map = d.lastLogins; tidy(); } })
				.catch(() => {});
		}
		const logins = window.__ekLogins.map;
		const nbDate = document.documentElement.lang.startsWith("nb");
		const day = (iso) => new Date(iso).toLocaleDateString(nbDate ? "nb-NO" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
		const leaf = (el, test) => [...el.querySelectorAll("*")].find((e) => !e.children.length && test(e.textContent.trim()));
		const setText = (el, text) => { const t = el.children.length ? leaf(el, (s) => !!s) : el; if (t && t.textContent !== text) t.textContent = text; };
		const table = document.querySelector("main table");
		if (table) {
			const heads = [...table.querySelectorAll("thead th")].map((h) => h.textContent.trim());
			const pkCol = heads.findIndex((h) => /^(Passnøkler|Passkeys)$/.test(h));
			const lastCol = heads.findIndex((h) => /^(Sist innlogget|Last login)$/.test(h));
			for (const tr of table.querySelectorAll("tr")) {
				const cell = tr.children[pkCol];
				if (cell && cell.style.display !== "none") cell.style.display = "none";
				if (logins && lastCol >= 0 && tr.parentElement?.tagName === "TBODY" && tr.children[lastCol]) {
					const email = (leaf(tr.children[0], (s) => s.includes("@"))?.textContent || "").trim().toLowerCase();
					if (logins[email]) setText(tr.children[lastCol], day(logins[email]));
				}
			}
		}
		const dialog = document.querySelector("[role=dialog]");
		if (dialog) {
			for (const box of dialog.querySelectorAll("div.rounded-lg.border")) {
				if (/^(Passnøkler|Passkeys)/.test(box.textContent.trim()) && box.style.display !== "none") box.style.display = "none";
			}
			const email = (dialog.querySelector("input[type=email]")?.value || "").trim().toLowerCase();
			const label = leaf(dialog, (s) => /^(Sist innlogget|Last login)$/.test(s));
			const value = label?.nextElementSibling;
			if (logins?.[email] && value) setText(value, day(logins[email]));
		}
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
		// Avsenderen av innloggingslenken (cloudflareEmail i astro.config.mjs): Gmail åpner rett på e-posten.
		// authuser velger kontoen hvis den er logget inn, ellers får man Googles kontovalg/innlogging.
		// (/mail/u/<e-post>/ ga «Temporary Error» når akkurat den kontoen ikke var logget inn i nettleseren.)
		const gmail = "https://mail.google.com/mail/" + (email ? "?authuser=" + encodeURIComponent(email) : "") + "${kit.email.from?.email ? `#search/from%3A${encodeURIComponent(kit.email.from.email)}` : ""}";
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
	// Mørk/lys-knappen trengs ikke, EmDash vises alltid i samme modus
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
			if (icon && ${JSON.stringify(ICON)}) {
				const img = document.createElement("img");
				img.src = ${JSON.stringify(ICON)};
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
</script>${adminExtraJs}`;

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
	const navigation = context.request.headers.get("sec-fetch-mode") === "navigate" || (context.request.headers.get("accept") ?? "").includes("text/html");
	if (pathname.startsWith(ADMIN) && context.request.method === "GET" && navigation && !context.cookies.get("emdash-locale")) {
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
			// Innlogging med passord (src/passord.ts): har brukeren ikke passord ennå (logget inn med passnøkkel eller
			// innloggingslenke før), må det lages under Innstillinger → Sikkerhet før resten av admin kan brukes
			if (guarded && context.request.method === "GET" && navigation && pathname !== SECURITY_PATH && !(await hasPassword(current.id).catch(() => true))) {
				return context.redirect(`${SECURITY_PATH}?passord=ny`, 302);
			}
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
			? { tilganger: "Tilganger", plugins: "Utvidelser", security: "Passord og sikkerhet", viewingAs: "Du ser siden som {role}", exitViewAs: "Avslutt «Se som»" }
			: { tilganger: "Access", plugins: "Plugins", security: "Password and security", viewingAs: "You are viewing the site as {role}", exitViewAs: "Exit “View as”" };
		const ekUser = user
			? {
					name,
					initials,
					role: user.role,
					email: user.email,
					roleLabel: access ? roleNames[access.role] : "",
					superadmin: access?.realRole === "superadmin",
					// Uten passord ennå (src/passord.ts): siden sender brukeren til Sikkerhet
					needsPassword: !(await hasPassword(user.id).catch(() => true)),
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
