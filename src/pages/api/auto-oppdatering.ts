// Leses av arbeidsflyten «Oppdater EmDash» i GitHub før hver kjøring kl. 09.00: hopper over hvis en administrator
// har slått av automatisk oppdatering under Innstillinger → Sikkerhet. Åpent (ingen innlogging), viser bare av/på.
import type { APIRoute } from "astro";
import { autoUpdateOn } from "../../innstillinger";

export const prerender = false;

export const GET: APIRoute = async () =>
	new Response(JSON.stringify({ autoUpdate: await autoUpdateOn() }), {
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	});
