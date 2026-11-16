// Tar imot én sidevisning fra nettsiden (BESOK-skriptet fra @getonnet/emdash-kit/besok).
// Teller ikke roboter eller innloggede redaktører.
import type { APIRoute } from "astro";
import { countVisit } from "../../besok";

export const prerender = false;

// Roboter, og skript/HTTP-biblioteker (curl, Python, Node osv.), som aldri er ekte besøkende.
// Nettlesere har alltid «Mozilla/» først; uten det telles ikke besøket.
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|facebookexternalhit|embedly|curl|wget|python|node|undici|axios|okhttp|go-http|java\//i;
const BROWSER = /^Mozilla\//;
// Bare ekte sider på nettstedet
const PATH = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/;

export const POST: APIRoute = async ({ request, locals }) => {
	const ua = request.headers.get("user-agent") ?? "";
	if (locals.user || !BROWSER.test(ua) || BOT.test(ua)) return new Response(null, { status: 204 });

	let path = (await request.text()).trim().toLowerCase().replace(/\.html$/, "").replace(/\/index$/, "/");
	if (path.length > 1) path = path.replace(/\/$/, "");
	if (!PATH.test(path) || path.startsWith("/admin") || path.startsWith("/_")) return new Response(null, { status: 204 });

	try {
		await countVisit(path);
	} catch (error) {
		console.error("[besok] kunne ikke lagre besøk:", error);
	}
	return new Response(null, { status: 204 });
};
