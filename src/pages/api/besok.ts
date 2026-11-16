// Tar imot én sidevisning fra nettsiden (BESOK-skriptet fra @getonnet/emdash-kit/besok).
// Teller ikke roboter eller innloggede redaktører.
import type { APIRoute } from "astro";
import { countVisit } from "../../besok";

export const prerender = false;

// Roboter, og skript/HTTP-biblioteker (curl, Python, Node osv.), som aldri er ekte besøkende.
// Nettlesere har alltid «Mozilla/» først; uten det telles ikke besøket.
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|facebookexternalhit|embedly|curl|wget|python|node|undici|axios|okhttp|go-http|java\//i;
const BROWSER = /^Mozilla\//;
// Bare ekte sider på nettstedet: bokstaver (også æøå), tall, - og _, høyst 200 tegn
const PATH = /^\/(?:[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)?$/u;
const decode = (s: string) => {
	try {
		return decodeURIComponent(s);
	} catch {
		return "";
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const ua = request.headers.get("user-agent") ?? "";
	if (locals.user || !BROWSER.test(ua) || BOT.test(ua)) return new Response(null, { status: 204 });

	// location.pathname er prosentkodet (/s%C3%B8k): lagres som vanlig tekst (/søk)
	let path = decode((await request.text()).trim().slice(0, 400)).normalize("NFC").toLowerCase().replace(/\.html$/, "").replace(/\/index$/, "/");
	if (path.length > 1) path = path.replace(/\/$/, "");
	const internal = path === "/admin" || path.startsWith("/admin/") || path.startsWith("/_");
	if (path.length > 200 || !PATH.test(path) || internal) return new Response(null, { status: 204 });

	try {
		await countVisit(path);
	} catch (error) {
		console.error("[besok] kunne ikke lagre besøk:", error);
	}
	return new Response(null, { status: 204 });
};
