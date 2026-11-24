// Innlogging med e-post og passord (innloggingssiden i EmDash, se src/middleware.ts). Lager samme økt som
// EmDash sin innlogging med passnøkkel eller innloggingslenke. For mange feil forsøk stenger en stund.
import type { APIRoute } from "astro";
import { attemptLogin, MAX_LENGTH } from "../../passord";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const POST: APIRoute = async ({ request, session, clientAddress }) => {
	// Samme vern mot forfalskede forespørsler som EmDash sitt API
	if (request.headers.get("X-EmDash-Request") !== "1") return json({ error: "missing_header" }, 400);
	if (!session) return json({ error: "no_session" }, 500);
	const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
	const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
	const password = typeof body?.password === "string" ? body.password : "";
	if (!email || !password || email.length > 320 || password.length > MAX_LENGTH) return json({ error: "invalid" }, 401);

	let ip = request.headers.get("cf-connecting-ip") || "";
	if (!ip) try { ip = clientAddress; } catch { ip = "unknown"; }
	// Én tur til databasen for stengning og bruker, og én for å lagre resultatet (se src/passord.ts)
	const result = await attemptLogin(email, password, ip);
	if (!result.ok) return result.locked ? json({ error: "locked", retryAfter: result.locked }, 429) : json({ error: "invalid" }, 401);
	// Ny økt-ID ved innlogging
	await session.regenerate();
	session.set("user", { id: result.userId });
	return json({ ok: true });
};
