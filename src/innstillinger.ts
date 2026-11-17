// Innstillinger som EmDash ikke har selv, lagret i D1 (tabellen <prefix>_settings).
// Endres av administratorer i EmDash under Innstillinger → Sikkerhet og Innstillinger → SEO (se src/middleware.ts og /api/innstillinger).
import { env } from "cloudflare:workers";
import { names } from "./config";

type D1 = {
	prepare(sql: string): { bind(...v: unknown[]): any; first<T = any>(): Promise<T | null> };
	exec(sql: string): Promise<unknown>;
};

const db = () => (env as unknown as { DB: D1 }).DB;

let ready = false;
async function ensureTable() {
	if (ready) return;
	await db().exec(`CREATE TABLE IF NOT EXISTS ${names.settingsTable} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
	ready = true;
}

// Leses på hver innlogget forespørsel: holdes i minnet et halvt minutt
let cached: { value: boolean; at: number } | null = null;

// Automatisk utlogging ved midnatt (norsk tid). På som standard.
export async function autoLogoutOn() {
	if (cached && Date.now() - cached.at < 30_000) return cached.value;
	await ensureTable();
	const row = await db().prepare(`SELECT value FROM ${names.settingsTable} WHERE key = ?`).bind("auto_logout").first<{ value: string }>();
	const value = row?.value !== "off";
	cached = { value, at: Date.now() };
	return value;
}

export async function setAutoLogout(on: boolean) {
	await ensureTable();
	await db()
		.prepare(`INSERT INTO ${names.settingsTable} (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`)
		.bind("auto_logout", on ? "on" : "off")
		.run();
	cached = { value: on, at: Date.now() };
}

// Egne skript på nettsiden (Google Tag Manager, Analytics, Meta Pixel, verifisering o.l.), lagt inn av administratorer
// under Innstillinger → SEO i EmDash. Settes inn på alle offentlige sider av src/scripts-plugin.ts.
export type CustomScripts = { head: string; bodyStart: string; bodyEnd: string };
export const SCRIPT_FIELDS = ["head", "bodyStart", "bodyEnd"] as const;
export const SCRIPT_MAX = 20_000;
const EMPTY: CustomScripts = { head: "", bodyStart: "", bodyEnd: "" };

// Leses på hver sidevisning: holdes i minnet et halvt minutt (endringer vises innen 30 sekunder)
let scriptsCache: { value: CustomScripts; at: number } | null = null;

export async function customScripts(): Promise<CustomScripts> {
	if (scriptsCache && Date.now() - scriptsCache.at < 30_000) return scriptsCache.value;
	await ensureTable();
	const row = await db().prepare(`SELECT value FROM ${names.settingsTable} WHERE key = ?`).bind("custom_scripts").first<{ value: string }>();
	let value = EMPTY;
	try {
		const parsed = row ? JSON.parse(row.value) : null;
		if (parsed && typeof parsed === "object") value = Object.fromEntries(SCRIPT_FIELDS.map((k) => [k, typeof parsed[k] === "string" ? parsed[k] : ""])) as CustomScripts;
	} catch {}
	scriptsCache = { value, at: Date.now() };
	return value;
}

export async function setCustomScripts(value: CustomScripts) {
	await ensureTable();
	await db()
		.prepare(`INSERT INTO ${names.settingsTable} (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`)
		.bind("custom_scripts", JSON.stringify(value))
		.run();
	scriptsCache = { value, at: Date.now() };
}
