// Kit-innstillinger for administratorer: bryteren under Innstillinger → Sikkerhet og egne skript under Innstillinger → SEO i EmDash.
import type { APIRoute } from "astro";
import { autoLogoutOn, customScripts, SCRIPT_FIELDS, SCRIPT_MAX, setAutoLogout, setCustomScripts, type CustomScripts } from "../../innstillinger";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const isAdmin = (locals: App.Locals) => (locals.user?.role ?? 0) >= 50;

export const GET: APIRoute = async ({ locals }) => {
	if (!isAdmin(locals)) return json({ error: "forbidden" }, 403);
	return json({ autoLogout: await autoLogoutOn(), scripts: await customScripts() });
};

export const PUT: APIRoute = async ({ request, locals }) => {
	if (!isAdmin(locals)) return json({ error: "forbidden" }, 403);
	// Samme vern mot forfalskede forespørsler som EmDash sitt API
	if (request.headers.get("X-EmDash-Request") !== "1") return json({ error: "missing header" }, 400);
	const body = (await request.json().catch(() => null)) as { autoLogout?: unknown; scripts?: Record<string, unknown> } | null;
	if (!body || (body.autoLogout === undefined && body.scripts === undefined)) return json({ error: "autoLogout or scripts required" }, 400);
	if (body.autoLogout !== undefined && typeof body.autoLogout !== "boolean") return json({ error: "autoLogout must be true or false" }, 400);
	let scripts: CustomScripts | undefined;
	if (body.scripts !== undefined) {
		if (!body.scripts || typeof body.scripts !== "object") return json({ error: "scripts must be an object" }, 400);
		const s = body.scripts;
		for (const k of SCRIPT_FIELDS) {
			if (s[k] !== undefined && typeof s[k] !== "string") return json({ error: `scripts.${k} must be text` }, 400);
			if (typeof s[k] === "string" && (s[k] as string).length > SCRIPT_MAX) return json({ error: `scripts.${k} is longer than ${SCRIPT_MAX} characters` }, 400);
		}
		const current = await customScripts();
		scripts = Object.fromEntries(SCRIPT_FIELDS.map((k) => [k, typeof s[k] === "string" ? (s[k] as string).trim() : current[k]])) as CustomScripts;
	}
	if (body.autoLogout !== undefined) await setAutoLogout(body.autoLogout as boolean);
	if (scripts) await setCustomScripts(scripts);
	return json({ autoLogout: await autoLogoutOn(), scripts: await customScripts() });
};
