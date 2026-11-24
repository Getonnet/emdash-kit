// Innlogging med e-post og passord (innloggingssiden i EmDash, se src/middleware.ts). Lager samme økt som
// EmDash sin innlogging med passnøkkel eller innloggingslenke. For mange feil forsøk stenger en stund.
import type { APIRoute } from "astro";
import { checkLogin, clearFailures, lockedFor, MAX_LENGTH, recordFailure, recordLogin } from "../../passord";

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
	const keys = { email, ip };
	const wait = await lockedFor(keys);
	if (wait) return json({ error: "locked", retryAfter: wait }, 429);

	const user = await checkLogin(email, password);
	if (!user) {
		await recordFailure(keys);
		return json({ error: "invalid" }, 401);
	}
	await clearFailures(email);
	// Ny økt-ID ved innlogging
	await session.regenerate();
	session.set("user", { id: user.id });
	await recordLogin(user.id).catch(() => {});
	return json({ ok: true });
};
