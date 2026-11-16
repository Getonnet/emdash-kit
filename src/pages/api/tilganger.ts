// Roller og tilganger (siden /admin/tilganger). Bare super admin får endre; «se som» settes som cookie.
// Samme oppsett som Trening for deg (se src/roller.ts).
import type { APIRoute } from "astro";
import { UserRepository } from "emdash";
import { accessFor, LEVEL, ROLES, TABS, VIEW_AS_COOKIE, setRoleTabs, setUserRole, type Role, type Tab } from "../../roller";
import { names } from "../../config";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const PUT: APIRoute = async ({ request, locals, cookies, url }) => {
	const user = locals.user;
	if (!user) return json({ error: "unauthorized" }, 401);
	if (request.headers.get("X-EmDash-Request") !== "1") return json({ error: "missing header" }, 400);
	// Bruk den ekte rollen: en super admin som «ser som» en annen rolle skal fortsatt kunne avslutte
	const access = await accessFor({ id: user.id, role: (locals as any)[names.localsRealLevel] ?? user.role }, cookies.get(VIEW_AS_COOKIE)?.value);
	if (access.realRole !== "superadmin") return json({ error: "forbidden" }, 403);

	const body = (await request.json().catch(() => null)) as { viewAs?: unknown; roles?: unknown; tabs?: unknown } | null;
	if (!body) return json({ error: "bad request" }, 400);
	const secure = url.protocol === "https:";

	// «Se som»: null avslutter. Cookien varer to timer, så ingen blir sittende fast i en lavere rolle.
	if ("viewAs" in body) {
		const v = body.viewAs;
		if (v === null || v === "") cookies.delete(VIEW_AS_COOKIE, { path: "/" });
		else if (typeof v === "string" && ROLES.includes(v as Role) && v !== "superadmin")
			cookies.set(VIEW_AS_COOKIE, v, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 2 * 60 * 60 });
		else return json({ error: "unknown role" }, 400);
	}

	// Roller per bruker. EmDash-nivået følger med, så API-et tillater det samme som menyen viser.
	if (body.roles !== undefined) {
		if (typeof body.roles !== "object" || body.roles === null) return json({ error: "roles must be an object" }, 400);
		const db = (locals as any).emdash?.db;
		if (!db) return json({ error: "no database" }, 500);
		const users = new UserRepository(db);
		// Den som lagrer, er super admin: skriv det ned, så ikke alle administratorer regnes som super admin lenger
		await setUserRole(user.id, "superadmin");
		for (const [id, role] of Object.entries(body.roles as Record<string, unknown>)) {
			if (typeof role !== "string" || !ROLES.includes(role as Role)) return json({ error: `unknown role for ${id}` }, 400);
			if (id === user.id && role !== "superadmin") return json({ error: "self" }, 400);
			await setUserRole(id, role as Role);
			await users.update(id, { role: LEVEL[role as Role] });
		}
	}

	if (body.tabs !== undefined) {
		if (typeof body.tabs !== "object" || body.tabs === null) return json({ error: "tabs must be an object" }, 400);
		const next = {} as Record<Exclude<Role, "superadmin">, Tab[]>;
		for (const role of ROLES) {
			if (role === "superadmin") continue;
			const v = (body.tabs as Record<string, unknown>)[role];
			if (!Array.isArray(v)) return json({ error: `tabs missing for ${role}` }, 400);
			next[role] = TABS.filter((t) => v.includes(t));
			if (!next[role].includes("oversikt")) next[role].unshift("oversikt");
		}
		await setRoleTabs(next);
	}

	return json({ ok: true });
};
