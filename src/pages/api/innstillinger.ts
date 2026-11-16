// Kit-innstillinger for administratorer (bryteren under Innstillinger → Sikkerhet i EmDash).
import type { APIRoute } from "astro";
import { autoLogoutOn, setAutoLogout } from "../../innstillinger";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const isAdmin = (locals: App.Locals) => (locals.user?.role ?? 0) >= 50;

export const GET: APIRoute = async ({ locals }) => {
	if (!isAdmin(locals)) return json({ error: "forbidden" }, 403);
	return json({ autoLogout: await autoLogoutOn() });
};

export const PUT: APIRoute = async ({ request, locals }) => {
	if (!isAdmin(locals)) return json({ error: "forbidden" }, 403);
	// Samme vern mot forfalskede forespørsler som EmDash sitt API
	if (request.headers.get("X-EmDash-Request") !== "1") return json({ error: "missing header" }, 400);
	const body = (await request.json().catch(() => null)) as { autoLogout?: unknown } | null;
	if (typeof body?.autoLogout !== "boolean") return json({ error: "autoLogout must be true or false" }, 400);
	await setAutoLogout(body.autoLogout);
	return json({ autoLogout: body.autoLogout });
};
