// Enkel besøksteller: sidevisninger per dag og side, lagret i D1 (tabellen <prefix>_visits).
// Ingen cookies og ingen personopplysninger, bare dato, sti og antall.
import { env } from "cloudflare:workers";
import { names } from "./config";

type D1 = {
	prepare(sql: string): { bind(...v: unknown[]): any; all<T = any>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
	exec(sql: string): Promise<unknown>;
};

const db = () => (env as unknown as { DB: D1 }).DB;

let ready = false;
async function ensureTable() {
	if (ready) return;
	await db().exec(
		`CREATE TABLE IF NOT EXISTS ${names.visitsTable} (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path))`,
	);
	ready = true;
}

// Dato i norsk tid (YYYY-MM-DD)
export const osloDay = (d = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(d);

export async function countVisit(path: string) {
	await ensureTable();
	await db()
		.prepare(`INSERT INTO ${names.visitsTable} (day, path, views) VALUES (?, ?, 1) ON CONFLICT (day, path) DO UPDATE SET views = views + 1`)
		.bind(osloDay(), path)
		.run();
}

export type VisitStats = {
	total: number;
	daily: { day: string; views: number }[];
	byPath: Map<string, number>;
	top: { path: string; views: number }[];
	// Første dag med registrerte besøk (tellingen startet), eller null
	since: string | null;
};

// Besøk mellom to datoer (begge inkludert)
export async function visitStats(from: string, to: string): Promise<VisitStats> {
	await ensureTable();
	const rows = (
		await db()
			.prepare(`SELECT day, path, views FROM ${names.visitsTable} WHERE day >= ? AND day <= ?`)
			.bind(from, to)
			.all<{ day: string; path: string; views: number }>()
	).results;

	const perDay = new Map<string, number>();
	const byPath = new Map<string, number>();
	let total = 0;
	for (const r of rows) {
		total += r.views;
		perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.views);
		byPath.set(r.path, (byPath.get(r.path) ?? 0) + r.views);
	}

	// Alle dager i perioden, også dager uten besøk
	const daily: { day: string; views: number }[] = [];
	for (let d = new Date(`${from}T12:00:00Z`); osloDay(d) <= to; d = new Date(d.getTime() + 864e5)) {
		const key = osloDay(d);
		daily.push({ day: key, views: perDay.get(key) ?? 0 });
	}

	const first = await db().prepare(`SELECT MIN(day) AS day FROM ${names.visitsTable}`).all<{ day: string | null }>();
	const since = first.results[0]?.day ?? null;

	const top = [...byPath].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views);
	return { total, daily, byPath, top, since };
}
