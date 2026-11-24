// Invitasjon med passord i stedet for passnøkkel (invitasjonssiden i EmDash, se src/middleware.ts).
// GET ?token=: gyldig invitasjon? (e-posten vises på siden). POST: lag kontoen med navn og passord og logg inn.
import type { APIRoute } from "astro";
import { completeInvite, InviteError, validateInvite } from "@emdash-cms/auth";
import { createKyselyAdapter } from "@emdash-cms/auth/adapters/kysely";
import { getDb } from "emdash/runtime";
import { MIN_LENGTH, recordLogin, setPassword, weakPassword } from "../../passord";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// EmDash gir bare databasen (locals.emdash.db) til sine egne ruter: hent den selv her
const adapterFor = async (locals: App.Locals) => {
	const db = (locals as { emdash?: { db?: unknown } }).emdash?.db ?? (await getDb().catch(() => null));
	return db ? createKyselyAdapter(db as never) : null;
};

const inviteError = (error: unknown) =>
	error instanceof InviteError ? json({ error: error.code }, error.code === "token_expired" ? 410 : 404) : null;

export const GET: APIRoute = async ({ url, locals }) => {
	const adapter = await adapterFor(locals);
	if (!adapter) return json({ error: "not_configured" }, 500);
	const token = url.searchParams.get("token") ?? "";
	if (!token) return json({ error: "invalid_token" }, 404);
	try {
		const invite = await validateInvite(adapter, token);
		return json({ email: invite.email, minLength: MIN_LENGTH });
	} catch (error) {
		const res = inviteError(error);
		if (res) return res;
		throw error;
	}
};

export const POST: APIRoute = async ({ request, locals, session }) => {
	if (request.headers.get("X-EmDash-Request") !== "1") return json({ error: "missing_header" }, 400);
	if (!session) return json({ error: "no_session" }, 500);
	const adapter = await adapterFor(locals);
	if (!adapter) return json({ error: "not_configured" }, 500);
	const body = (await request.json().catch(() => null)) as { token?: unknown; name?: unknown; password?: unknown } | null;
	const token = typeof body?.token === "string" ? body.token : "";
	const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";
	if (!token) return json({ error: "invalid_token" }, 404);
	if (!name) return json({ error: "name_required" }, 400);
	try {
		// Sjekk passordet før invitasjonen brukes opp
		const invite = await validateInvite(adapter, token);
		const weak = weakPassword(body?.password, invite.email);
		if (weak) return json({ error: weak, minLength: MIN_LENGTH }, 400);
		const user = await completeInvite(adapter, token, { name });
		await setPassword(user.id, body!.password as string);
		await session.regenerate();
		session.set("user", { id: user.id });
		await recordLogin(user.id).catch(() => {});
		return json({ ok: true });
	} catch (error) {
		const res = inviteError(error);
		if (res) return res;
		throw error;
	}
};
