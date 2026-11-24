// Egne skript på nettsiden: det administratorer har lagt inn under Innstillinger → SEO i EmDash
// (f.eks. Google Tag Manager, Google Analytics, Meta Pixel) settes inn i <head>, rett etter <body> og før </body>.
// Bruker EmDash sin page:fragments-krok, så det gjelder alle sider som har <EmDashHead>, <EmDashBodyStart> og <EmDashBodyEnd>.
// Ikke på /admin eller i EmDash-admin.
// Med Vibe Editor: flytter Vibe Editor-bryteren (nede til høyre) til venstre hvis noe annet ligger over den,
// f.eks. en chat-knapp. Kjører bare for innloggede redaktører (flagget «emdash-editor»).
import { definePlugin } from "emdash";
import { kit } from "./config";
import { customScripts } from "./innstillinger";

const VIBE_DODGE = `<script>
(() => {
try { if (!localStorage.getItem("emdash-editor")) return; } catch { return; }
const IDS = ["wpve-bubble", "wpve-settings-btn", "wpve-page-btn"];
// Egen stilregel (ikke style på elementene): Vibe Editor setter stilen sin på nytt når redigeringsmodus slås av og på
const sheet = document.createElement("style");
let base = null, shift = 0;
const covered = (el) => {
	const r = el.getBoundingClientRect();
	if (!r.width) return false;
	const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
	return !!hit && !el.contains(hit);
};
const place = () => {
	const bubble = document.getElementById("wpve-bubble");
	if (!bubble) return;
	if (!base) {
		base = IDS.map((id) => [id, parseFloat(getComputedStyle(document.getElementById(id) || bubble).right) || 24]);
		document.head.append(sheet);
	}
	// Små steg mot venstre til ingenting ligger over (høyst 360 px)
	for (let i = 0; i < 15 && covered(bubble); i++) {
		shift += 24;
		sheet.textContent = base.map(([id, r]) => "#" + id + "{right:" + (r + shift) + "px!important}").join("");
	}
};
// Chat-knapper lastes ofte etter siden: sjekk noen ganger etter innlasting
addEventListener("load", () => [0, 1500, 4000, 8000].forEach((ms) => setTimeout(place, ms)));
})();
</script>`;

const PLACEMENT = { head: "head", bodyStart: "body:start", bodyEnd: "body:end" } as const;

export function createPlugin() {
	return definePlugin({
		id: "emdash-kit-skript",
		// Vises under Utvidelser (super admin) med kit-versjonen
		displayName: "emdash-kit · skript og Vibe Editor-plassering",
		version: kit.version,
		capabilities: ["hooks.page-fragments:register"],
		hooks: {
			"page:fragments": async () => {
				const out: { kind: "html"; placement: "head" | "body:start" | "body:end"; html: string; key: string }[] = [];
				const scripts = kit.scripts ? await customScripts().catch(() => null) : null;
				if (scripts) {
					for (const k of Object.keys(PLACEMENT) as (keyof typeof PLACEMENT)[]) {
						if (scripts[k].trim()) out.push({ kind: "html", placement: PLACEMENT[k], html: scripts[k], key: `emdash-kit-skript-${k}` });
					}
				}
				if (kit.vibeEditor) out.push({ kind: "html", placement: "body:end", html: VIBE_DODGE, key: "emdash-kit-vibe-plassering" });
				return out.length ? out : null;
			},
		},
	});
}
