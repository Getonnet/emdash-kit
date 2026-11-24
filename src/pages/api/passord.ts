// Eget passord for den innloggede brukeren (Innstillinger → Sikkerhet i EmDash, se src/middleware.ts).
// GET: har brukeren passord? PUT: lag eller bytt passord. Glemt passord: logg inn med innloggingslenke og bytt her.
import type { APIRoute } from "astro";
import { hasPassword, lastLogins, MIN_LENGTH, setPassword, weakPassword } from "../../passord";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const GET: APIRoute = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) return json({ error: "unauthorized" }, 401);
	// ?brukere=1 (administratorer): sist innlogget med passord per e-post, til Brukere i EmDash
	if (url.searchParams.get("brukere") === "1") {
		if ((user.role ?? 0) < 50) return json({ error: "forbidden" }, 403);
		return json({ lastLogins: await lastLogins() });
	}
	return json({ hasPassword: await hasPassword(user.id), minLength: MIN_LENGTH });
};

export const PUT: APIRoute = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: "unauthorized" }, 401);
	if (request.headers.get("X-EmDash-Request") !== "1") return json({ error: "missing_header" }, 400);
	const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
	const weak = weakPassword(body?.password, user.email);
	if (weak) return json({ error: weak, minLength: MIN_LENGTH }, 400);
	await setPassword(user.id, body!.password as string);
	return json({ hasPassword: true });
};
