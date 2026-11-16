// Hvilken e-posttjeneste et domene bruker (Google Workspace, Microsoft 365 eller iCloud), ut fra MX-oppføringene.
// Brukes av «Sjekk e-posten din» i EmDash-innloggingen for å vise riktig «Åpne»-knapp først (se src/middleware.ts).
// Tar bare imot domenet, aldri hele e-postadressen.
import type { APIRoute } from "astro";

export const prerender = false;

const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const json = (provider: string | null, maxAge: number) =>
	new Response(JSON.stringify({ provider }), {
		headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${maxAge}` },
	});

export const GET: APIRoute = async ({ url }) => {
	const domain = (url.searchParams.get("d") ?? "").trim().toLowerCase();
	if (!DOMAIN.test(domain)) return json(null, 3600);
	try {
		const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
			headers: { Accept: "application/dns-json" },
			signal: AbortSignal.timeout(3000),
		});
		const data = (await res.json()) as { Answer?: { data: string }[] };
		const mx = (data.Answer ?? []).map((a) => a.data.toLowerCase()).join(" ");
		const provider = /google\.com|googlemail\.com/.test(mx)
			? "google"
			: /outlook\.com/.test(mx)
				? "microsoft"
				: /icloud\.com|me\.com/.test(mx)
					? "apple"
					: null;
		return json(provider, 86400);
	} catch {
		return json(null, 300);
	}
};
