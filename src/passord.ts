// Innlogging med e-post og passord i stedet for passnøkkel (EmDash har bare passnøkkel og innloggingslenke).
// Passordene lagres som PBKDF2-SHA256 (100 000 runder, tilfeldig salt) i D1-tabellen <prefix>_passwords.
// For mange feil forsøk stenger innloggingen en stund (<prefix>_login_attempts).
// Sidene: innlogging, invitasjon og Innstillinger → Sikkerhet i EmDash (src/middleware.ts). API: /api/passord*.
import { env } from "cloudflare:workers";
import { names } from "./config";

type D1 = {
	prepare(sql: string): { bind(...v: unknown[]): any; first<T = any>(): Promise<T | null>; all<T = any>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
	exec(sql: string): Promise<unknown>;
};
const db = () => (env as unknown as { DB: D1 }).DB;

let ready = false;
async function ensureTables() {
	if (ready) return;
	await db().exec(`CREATE TABLE IF NOT EXISTS ${names.passwordsTable} (user_id TEXT PRIMARY KEY, hash TEXT NOT NULL, updated_at TEXT NOT NULL)`);
	await db().exec(`CREATE TABLE IF NOT EXISTS ${names.attemptsTable} (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL)`);
	await db().exec(`CREATE TABLE IF NOT EXISTS ${names.loginsTable} (user_id TEXT PRIMARY KEY, at TEXT NOT NULL)`);
	ready = true;
}

// Sist innlogget: EmDash regner det ut fra passnøklene, så for passord lagres det her og vises under Brukere
export async function recordLogin(userId: string) {
	await ensureTables();
	await db()
		.prepare(`INSERT INTO ${names.loginsTable} (user_id, at) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET at = excluded.at`)
		.bind(userId, new Date().toISOString())
		.run();
}

/** Sist innlogget med passord per e-post (små bokstaver) */
export async function lastLogins(): Promise<Record<string, string>> {
	await ensureTables();
	const rows = await db()
		.prepare(`SELECT lower(u.email) AS email, l.at AS at FROM ${names.loginsTable} l JOIN users u ON u.id = l.user_id`)
		.all<{ email: string; at: string }>();
	return Object.fromEntries(rows.results.map((r) => [r.email, r.at]));
}

export const MIN_LENGTH = 10;
export const MAX_LENGTH = 200;

/** Feilkode hvis passordet ikke kan brukes, ellers null */
export function weakPassword(password: unknown, email = ""): string | null {
	if (typeof password !== "string" || password.length < MIN_LENGTH) return "too_short";
	if (password.length > MAX_LENGTH) return "too_long";
	if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) return "same_as_email";
	return null;
}

// Cloudflare Workers tillater høyst 100 000 runder med PBKDF2
const ITERATIONS = 100_000;
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

async function hashPassword(password: string) {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	return `pbkdf2-sha256$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

async function verifyHash(password: string, stored: string) {
	const [alg, iter, salt, hash] = stored.split("$");
	if (alg !== "pbkdf2-sha256" || !iter || !salt || !hash) return false;
	const got = await derive(password, unb64(salt), Number(iter));
	const want = unb64(hash);
	if (got.length !== want.length) return false;
	let diff = 0;
	for (let i = 0; i < got.length; i++) diff |= got[i]! ^ want[i]!;
	return diff === 0;
}

// Brukes når e-posten ikke finnes, så svaret tar like lang tid (avslører ikke hvem som har konto)
const DUMMY = "pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export async function hasPassword(userId: string) {
	await ensureTables();
	return !!(await db().prepare(`SELECT 1 AS x FROM ${names.passwordsTable} WHERE user_id = ?`).bind(userId).first());
}

export async function setPassword(userId: string, password: string) {
	await ensureTables();
	await db()
		.prepare(
			`INSERT INTO ${names.passwordsTable} (user_id, hash, updated_at) VALUES (?, ?, ?) ` +
				`ON CONFLICT (user_id) DO UPDATE SET hash = excluded.hash, updated_at = excluded.updated_at`,
		)
		.bind(userId, await hashPassword(password), new Date().toISOString())
		.run();
}

/** Brukeren med denne e-posten og dette passordet (aktiv konto), ellers null */
export async function checkLogin(email: string, password: string): Promise<{ id: string } | null> {
	await ensureTables();
	const user = await db()
		.prepare(
			`SELECT u.id AS id, u.disabled AS disabled, p.hash AS hash FROM users u ` +
				`LEFT JOIN ${names.passwordsTable} p ON p.user_id = u.id WHERE lower(u.email) = ?`,
		)
		.bind(email.trim().toLowerCase())
		.first<{ id: string; disabled: number; hash: string | null }>();
	const ok = await verifyHash(password, user?.hash ?? DUMMY);
	return ok && user && !user.disabled ? { id: user.id } : null;
}

// Høyst 5 feil forsøk per e-post og 30 per IP-adresse i løpet av 15 minutter
const WINDOW = 15 * 60_000;
const LIMITS = { email: 5, ip: 30 };
type Keys = { email: string; ip: string };

/** Sekunder til man kan prøve igjen, eller 0 */
export async function lockedFor(keys: Keys) {
	await ensureTables();
	const now = Date.now();
	let wait = 0;
	for (const kind of ["email", "ip"] as const) {
		const row = await db()
			.prepare(`SELECT count, reset_at FROM ${names.attemptsTable} WHERE key = ?`)
			.bind(`${kind}:${keys[kind]}`)
			.first<{ count: number; reset_at: number }>();
		if (row && row.reset_at > now && row.count >= LIMITS[kind]) wait = Math.max(wait, Math.ceil((row.reset_at - now) / 1000));
	}
	return wait;
}

export async function recordFailure(keys: Keys) {
	await ensureTables();
	const now = Date.now();
	for (const kind of ["email", "ip"] as const) {
		await db()
			.prepare(
				`INSERT INTO ${names.attemptsTable} (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT (key) DO UPDATE SET ` +
					`count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END, ` +
					`reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END`,
			)
			.bind(`${kind}:${keys[kind]}`, now + WINDOW, now, now)
			.run();
	}
	// Rydd bort utløpte oppføringer
	await db().prepare(`DELETE FROM ${names.attemptsTable} WHERE reset_at <= ?`).bind(now).run();
}

export async function clearFailures(email: string) {
	await ensureTables();
	await db().prepare(`DELETE FROM ${names.attemptsTable} WHERE key = ?`).bind(`email:${email}`).run();
}
