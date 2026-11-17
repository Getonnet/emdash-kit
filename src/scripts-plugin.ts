// Egne skript på nettsiden: det administratorer har lagt inn under Innstillinger → SEO i EmDash
// (f.eks. Google Tag Manager, Google Analytics, Meta Pixel) settes inn i <head>, rett etter <body> og før </body>.
// Bruker EmDash sin page:fragments-krok, så det gjelder alle sider som har <EmDashHead>, <EmDashBodyStart> og <EmDashBodyEnd>.
// Ikke på /admin eller i EmDash-admin.
import { definePlugin } from "emdash";
import { customScripts } from "./innstillinger";

const PLACEMENT = { head: "head", bodyStart: "body:start", bodyEnd: "body:end" } as const;

export function createPlugin() {
	return definePlugin({
		id: "emdash-kit-skript",
		version: "1.0.0",
		capabilities: ["hooks.page-fragments:register"],
		hooks: {
			"page:fragments": async () => {
				const scripts = await customScripts().catch(() => null);
				if (!scripts) return null;
				const out = (Object.keys(PLACEMENT) as (keyof typeof PLACEMENT)[])
					.filter((k) => scripts[k].trim())
					.map((k) => ({ kind: "html" as const, placement: PLACEMENT[k], html: scripts[k], key: `emdash-kit-skript-${k}` }));
				return out.length ? out : null;
			},
		},
	});
}
