// Roller og faner (samme oppsett som AESTO og Trening For Deg). EmDash har fem nivåer (10–50) som styrer hva
// API-et tillater; oppå dem ligger fem roller, lagret i D1 (tabellen <prefix>_user_roles). Super admin velger
// hvilke faner de andre rollene ser (<prefix>_settings → role_tabs) og kan «se som» en annen rolle (cookie <prefix>-view-as).
// Siden for dette er /admin/tilganger (bare super admin).
import { env } from "cloudflare:workers";
import { kit, names } from "./config";

export type Role = "superadmin" | "admin" | "innholdsansvarlig" | "innholdsmedarbeider" | "lesetilgang";
// «vibe» er selve Vibe Editor-verktøyet på nettsiden, «vibeinnstillinger» er fanen i menyen der det kobles til
export type Tab = "oversikt" | "artikler" | "sider" | "medier" | "brukere" | "innstillinger" | "vibe" | "vibeinnstillinger" | "tilganger";

export const ROLES: Role[] = ["superadmin", "admin", "innholdsansvarlig", "innholdsmedarbeider", "lesetilgang"];
// Fanene super admin kan slå av og på for de andre rollene («tilganger» er bare for super admin)
export const TABS: Tab[] = ["oversikt", "artikler", "sider", "medier", "brukere", "innstillinger", "vibe", "vibeinnstillinger"];

// EmDash-nivået hver rolle får (styrer hva API-et tillater: publisering, brukere, innstillinger osv.)
// Innholdsmedarbeider = Bidragsyter (20): ser alt innhold, også utkast, men kan ikke publisere eller endre andres.
export const LEVEL: Record<Role, number> = { superadmin: 50, admin: 50, innholdsansvarlig: 40, innholdsmedarbeider: 20, lesetilgang: 10 };

// Standardfaner (super admin ser alltid alt og kan ikke begrenses). Vibe Editor-verktøyet følger redigeringstilgang;
// Vibe Editor-innstillinger og Innstillinger er bare for super admin, til de slås på her.
export const DEFAULT_TABS: Record<Exclude<Role, "superadmin">, Tab[]> = {
	admin: ["oversikt", "artikler", "sider", "medier", "brukere", "vibe"],
	innholdsansvarlig: ["oversikt", "artikler", "sider", "medier", "vibe"],
	innholdsmedarbeider: ["oversikt", "artikler", "sider", "medier"],
	lesetilgang: ["oversikt"],
};

// Hvor fanene bor: stier som sperres når fanen ikke er tillatt (verktøyet sperres i middleware, se VIBE_CLIENT)
export const TAB_PATHS: Record<Tab, string[]> = {
	oversikt: ["/admin"],
	artikler: [`/_emdash/admin/content/${kit.collections.articles.slug}`],
	sider: [`/_emdash/admin/content/${kit.collections.pages.slug}`],
	medier: ["/_emdash/admin/media"],
	brukere: ["/_emdash/admin/users"],
	innstillinger: ["/_emdash/admin/settings"],
	vibe: [],
	vibeinnstillinger: ["/_emdash/admin/plugins/vibe-editor"],
	tilganger: ["/admin/tilganger"],
};

export const VIEW_AS_COOKIE = names.viewAsCookie;
// Skriptet som laster Vibe Editor-verktøyet på nettsiden: svarer 403 for roller uten «vibe»
export const VIBE_CLIENT = "/_emdash/api/plugins/vibe-editor/client";

type D1 = {
	prepare(sql: string): { bind(...v: unknown[]): any; first<T = any>(): Promise<T | null>; all<T = any>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
	exec(sql: string): Promise<unknown>;
};
const db = () => (env as unknown as { DB: D1 }).DB;

let ready = false;
async function ensureTables() {
	if (ready) return;
	await db().exec(`CREATE TABLE IF NOT EXISTS ${names.settingsTable} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
	await db().exec(`CREATE TABLE IF NOT EXISTS ${names.rolesTable} (user_id TEXT PRIMARY KEY, role TEXT NOT NULL)`);
	ready = true;
}

// Leses på hver admin-forespørsel: holdes i minnet et halvt minutt
type State = { roles: Map<string, Role>; tabs: Record<Exclude<Role, "superadmin">, Tab[]> };
let cached: { state: State; at: number } | null = null;

export async function loadState(): Promise<State> {
	if (cached && Date.now() - cached.at < 30_000) return cached.state;
	await ensureTables();
	const rows = await db().prepare(`SELECT user_id, role FROM ${names.rolesTable}`).bind().all<{ user_id: string; role: string }>();
	const roles = new Map<string, Role>();
	for (const r of rows.results) if (ROLES.includes(r.role as Role)) roles.set(r.user_id, r.role as Role);
	const row = await db().prepare(`SELECT value FROM ${names.settingsTable} WHERE key = ?`).bind("role_tabs").first<{ value: string }>();
	const tabs = { ...DEFAULT_TABS };
	if (row) {
		try {
			const parsed = JSON.parse(row.value) as Record<string, unknown>;
			for (const role of Object.keys(DEFAULT_TABS) as (keyof typeof DEFAULT_TABS)[]) {
				const v = parsed[role];
				if (Array.isArray(v)) tabs[role] = [...new Set(v.filter((t): t is Tab => TABS.includes(t as Tab)))];
			}
		} catch {}
	}
	const state = { roles, tabs };
	cached = { state, at: Date.now() };
	return state;
}

export function invalidate() {
	cached = null;
}

// Rollen til en bruker. Uten egen oppføring utledes den av EmDash-nivået. Finnes ingen super admin ennå,
// er alle administratorer super admin (slik at den første kan utpeke seg selv under Tilganger).
export function roleOf(user: { id: string; role: number }, state: State): Role {
	const stored = state.roles.get(user.id);
	// Er EmDash-nivået endret under Brukere etter at rollen ble satt her, gjelder nivået
	if (stored && LEVEL[stored] === user.role) return stored;
	if (user.role >= 50) return [...state.roles.values()].includes("superadmin") ? "admin" : "superadmin";
	if (user.role >= 40) return "innholdsansvarlig";
	if (user.role >= 20) return "innholdsmedarbeider";
	return "lesetilgang";
}

export function tabsFor(role: Role, state: State): Tab[] {
	if (role === "superadmin") return [...TABS, "tilganger"];
	return state.tabs[role];
}

// Sider alle innloggede alltid får åpne: egne passnøkler og innlogging (Innstillinger → Sikkerhet).
// Uten den kan ikke redaktører legge til passnøkkel, f.eks. etter bytte av domene.
export const ALWAYS_ALLOWED = ["/_emdash/admin/settings/security"];
export const SECURITY_PATH = ALWAYS_ALLOWED[0]!;

export function allows(tabs: Tab[], path: string): boolean {
	const under = (p: string) => path === p || path.startsWith(p + "/");
	if (ALWAYS_ALLOWED.some(under)) return true;
	// Den mest spesifikke stien avgjør (/admin/tilganger hører til Tilganger, ikke Oversikt på /admin)
	let best: { tab: Tab; len: number } | null = null;
	for (const tab of Object.keys(TAB_PATHS) as Tab[]) {
		for (const p of TAB_PATHS[tab]) if (under(p) && (!best || p.length > best.len)) best = { tab, len: p.length };
	}
	return best ? tabs.includes(best.tab) : true;
}

export async function setUserRole(userId: string, role: Role) {
	await ensureTables();
	await db()
		.prepare(`INSERT INTO ${names.rolesTable} (user_id, role) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET role = excluded.role`)
		.bind(userId, role)
		.run();
	invalidate();
}

export async function setRoleTabs(tabs: Record<Exclude<Role, "superadmin">, Tab[]>) {
	await ensureTables();
	await db()
		.prepare(`INSERT INTO ${names.settingsTable} (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`)
		.bind("role_tabs", JSON.stringify(tabs))
		.run();
	invalidate();
}

// Hva brukeren er og ser akkurat nå: ekte rolle, og rollen den ser som (bare super admin kan «se som»)
export type Access = { role: Role; realRole: Role; viewAs: Role | null; tabs: Tab[]; level: number };

export async function accessFor(user: { id: string; role: number }, viewAsCookie: string | undefined): Promise<Access> {
	const state = await loadState();
	const realRole = roleOf(user, state);
	const viewAs = realRole === "superadmin" && viewAsCookie && ROLES.includes(viewAsCookie as Role) && viewAsCookie !== "superadmin" ? (viewAsCookie as Role) : null;
	const role = viewAs ?? realRole;
	return { role, realRole, viewAs, tabs: tabsFor(role, state), level: viewAs ? LEVEL[viewAs] : user.role };
}
