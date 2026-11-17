// Ekstra skript i EmDash-admin (settes inn av src/middleware.ts sammen med resten):
// - bildekomprimering før opplasting (defineKit({ images }))
// - felt for egne skript under Innstillinger → SEO (defineKit({ scripts }))
import { kit } from "./config";

const ADMIN = "/_emdash/admin";

// Bilder krympes i nettleseren før EmDash laster dem opp: lengste side høyst maxSize, JPEG forblir JPEG,
// PNG og WebP blir WebP (gjennomsiktighet beholdes). Bildet beholdes som det er hvis resultatet ikke blir mindre.
// Gjelder filvelgeren og dra-og-slipp (mediebiblioteket, bildefelt og tekstredigering). Fjerner også EXIF (bl.a. GPS-posisjon).
// Fungerer uten Cloudflare Images. Nettlesere som ikke kan lage WebP (eldre Safari) laster opp originalen.
const imageScript = (maxSize: number, quality: number) => `<script>
(() => {
const MAX = ${maxSize}, Q = ${quality}, TYPES = /^image\\/(jpeg|png|webp)$/;
const nb = () => document.documentElement.lang.startsWith("nb");
const size = (n) => n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", nb() ? "," : ".") + " MB" : Math.max(1, Math.round(n / 1024)) + " kB";
async function shrink(file) {
	if (!TYPES.test(file.type)) return file;
	let bmp;
	try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { return file; }
	const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
	// Små bilder som allerede har passe størrelse lastes opp som de er
	if (scale === 1 && file.size < 300 * 1024) { bmp.close(); return file; }
	const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
	const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
	let blob = null;
	try {
		const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
		const g = c.getContext("2d");
		g.imageSmoothingQuality = "high";
		g.drawImage(bmp, 0, 0, w, h);
		blob = c.convertToBlob ? await c.convertToBlob({ type, quality: Q }) : await new Promise((r) => c.toBlob(r, type, Q));
	} catch { return file; } finally { bmp.close(); }
	// Nettleseren kunne ikke lage formatet (gir PNG i stedet), eller resultatet ble ikke mindre
	if (!blob || blob.type !== type || blob.size >= file.size || (scale === 1 && blob.size > file.size * 0.9)) return file;
	const name = type === "image/jpeg" ? file.name.replace(/\\.(jpe?g)?$/i, (m) => m || ".jpg") : file.name.replace(/\\.[^.]+$/, "") + ".webp";
	return new File([blob], name, { type, lastModified: file.lastModified });
}
let toast;
const note = (text, ms) => {
	if (!toast) {
		toast = document.createElement("div");
		toast.className = "ek-toast";
		toast.setAttribute("role", "status");
		document.body.append(toast);
	}
	toast.textContent = text;
	toast.hidden = false;
	clearTimeout(toast.t);
	if (ms) toast.t = setTimeout(() => (toast.hidden = true), ms);
};
async function swap(files) {
	const many = files.filter((f) => TYPES.test(f.type)).length > 1;
	const slow = setTimeout(() => note(nb() ? (many ? "Komprimerer bildene …" : "Komprimerer bildet …") : (many ? "Compressing images …" : "Compressing image …")), 150);
	let before = 0, after = 0;
	const out = [];
	for (const f of files) {
		const n = await shrink(f);
		if (n !== f) { before += f.size; after += n.size; }
		out.push(n);
	}
	clearTimeout(slow);
	if (before) note((nb() ? (many ? "Bildene er komprimert: " : "Bildet er komprimert: ") : (many ? "Images compressed: " : "Image compressed: ")) + size(before) + " → " + size(after), 4000);
	else if (toast) toast.hidden = true;
	const dt = new DataTransfer();
	out.forEach((f) => dt.items.add(f));
	return dt;
}
const hasImages = (files) => !!files && [...files].some((f) => TYPES.test(f.type));
// Hendelsene stoppes før EmDash ser dem, og sendes på nytt med de komprimerte filene
let replaying = false;
const replay = (target, event) => { replaying = true; try { target.dispatchEvent(event); } finally { replaying = false; } };
addEventListener("change", (e) => {
	const input = e.target;
	if (replaying || !(input instanceof HTMLInputElement) || input.type !== "file" || !hasImages(input.files)) return;
	e.stopImmediatePropagation();
	swap([...input.files]).then((dt) => {
		input.files = dt.files;
		replay(input, new Event("change", { bubbles: true }));
	});
}, true);
addEventListener("drop", (e) => {
	if (replaying || !hasImages(e.dataTransfer?.files)) return;
	e.preventDefault();
	e.stopImmediatePropagation();
	const { target, clientX, clientY, screenX, screenY } = e;
	swap([...e.dataTransfer.files]).then((dt) => {
		if (target.isConnected) replay(target, new DragEvent("drop", { bubbles: true, cancelable: true, composed: true, clientX, clientY, screenX, screenY, dataTransfer: dt }));
	});
}, true);
})();
</script>`;

// Innstillinger → SEO: felt for egne skript på nettsiden (bare administratorer). Lagres i <prefix>_settings via /api/innstillinger
// og settes inn av src/scripts-plugin.ts. Vises under EmDash sine egne SEO-innstillinger.
const scriptsPanel = `<script>
(() => {
const FIELDS = [
	{ key: "head", nb: ["I <head>", "F.eks. Google Tag Manager (første del), Google Analytics, Meta Pixel eller verifisering."], en: ["In <head>", "E.g. Google Tag Manager (first part), Google Analytics, Meta Pixel or verification tags."] },
	{ key: "bodyStart", nb: ["Rett etter <body>", "F.eks. Google Tag Manager (noscript-delen)."], en: ["Right after <body>", "E.g. Google Tag Manager (the noscript part)."] },
	{ key: "bodyEnd", nb: ["Før </body>", "Skript som skal lastes til slutt, f.eks. chat eller widgeter."], en: ["Before </body>", "Scripts that should load last, e.g. chat or widgets."] },
];
const add = () => {
	if (location.pathname !== "${ADMIN}/settings/seo" || (window.__ekUser?.role ?? 0) < 50 || document.querySelector("[data-ek=scripts]")) return;
	const host = document.querySelector("main form")?.parentElement || document.querySelector("main .space-y-6, main .mt-6");
	if (!host) return;
	const nb = document.documentElement.lang.startsWith("nb");
	const sec = document.createElement("section");
	sec.setAttribute("data-ek", "scripts");
	sec.className = "ek-scripts";
	sec.innerHTML = '<div class="rounded-lg border bg-kumo-base p-6"><h2 class="text-lg font-semibold"></h2><p class="ek-scripts-lead text-sm text-kumo-subtle"></p><div class="ek-scripts-fields"></div><div class="ek-scripts-foot"><span class="ek-scripts-status text-sm" role="status"></span><button type="button" class="ek-scripts-save"></button></div></div>';
	sec.querySelector("h2").textContent = nb ? "Sporing og egne skript" : "Tracking and custom scripts";
	sec.querySelector(".ek-scripts-lead").textContent = nb
		? "Kode som legges inn på alle sidene på nettstedet (ikke i administrasjonen). Lim inn koden slik du fikk den, med <script>-taggene. Husk at sporing som setter informasjonskapsler krever samtykke fra de besøkende."
		: "Code added to every page on the website (not the admin). Paste the code as you received it, including the <script> tags. Tracking that sets cookies requires consent from visitors.";
	const box = sec.querySelector(".ek-scripts-fields");
	const areas = {};
	for (const f of FIELDS) {
		const [label, hint] = nb ? f.nb : f.en;
		const wrap = document.createElement("label");
		wrap.className = "ek-scripts-field";
		wrap.innerHTML = '<span class="ek-scripts-label"></span><span class="ek-scripts-hint text-sm text-kumo-subtle"></span><textarea rows="5" spellcheck="false" autocomplete="off" autocapitalize="off" disabled></textarea>';
		wrap.querySelector(".ek-scripts-label").textContent = label;
		wrap.querySelector(".ek-scripts-hint").textContent = hint;
		areas[f.key] = wrap.querySelector("textarea");
		areas[f.key].maxLength = 20000;
		box.append(wrap);
	}
	const save = sec.querySelector(".ek-scripts-save");
	const status = sec.querySelector(".ek-scripts-status");
	save.textContent = nb ? "Lagre skript" : "Save scripts";
	save.disabled = true;
	const api = (init) => fetch("/api/innstillinger", { credentials: "same-origin", ...init }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
	const fill = (d) => {
		for (const f of FIELDS) { areas[f.key].value = d.scripts?.[f.key] ?? ""; areas[f.key].disabled = false; }
		save.disabled = false;
	};
	api().then(fill).catch(() => { status.textContent = nb ? "Kunne ikke hente skriptene." : "Could not load the scripts."; });
	save.addEventListener("click", () => {
		save.disabled = true;
		status.textContent = nb ? "Lagrer …" : "Saving …";
		const scripts = Object.fromEntries(FIELDS.map((f) => [f.key, areas[f.key].value]));
		api({ method: "PUT", headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" }, body: JSON.stringify({ scripts }) })
			.then((d) => { fill(d); status.textContent = nb ? "Lagret. Vises på nettstedet innen et halvt minutt." : "Saved. Live on the website within half a minute."; })
			.catch(() => { save.disabled = false; status.textContent = nb ? "Kunne ikke lagre. Prøv igjen." : "Could not save. Try again."; });
	});
	host.append(sec);
};
let q = false;
new MutationObserver(() => { if (q) return; q = true; requestAnimationFrame(() => { q = false; add(); }); }).observe(document.documentElement, { childList: true, subtree: true });
add();
})();
</script>`;

export const adminExtraCss = `
.ek-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:calc(100vw - 32px);padding:10px 16px;border-radius:10px;background:var(--ek-dark);color:var(--ek-dark-text);font-size:13.5px;box-shadow:0 8px 24px color-mix(in srgb,var(--ek-shadow) 22%,transparent)}
.ek-toast[hidden]{display:none}
.ek-scripts{margin-top:24px}
.ek-scripts-lead{margin:6px 0 18px;max-width:70ch}
.ek-scripts-fields{display:grid;gap:18px}
.ek-scripts-field{display:grid;gap:4px}
.ek-scripts-label{font-weight:500;font-size:14px}
.ek-scripts-field textarea{width:100%;min-height:110px;margin-top:4px;padding:10px 12px;border:1px solid var(--color-kumo-line,var(--ek-line));border-radius:8px;background:var(--color-kumo-control,var(--ek-card));color:inherit;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;resize:vertical}
.ek-scripts-field textarea:focus{outline:2px solid var(--ek-accent);outline-offset:1px}
.ek-scripts-foot{display:flex;align-items:center;justify-content:flex-end;gap:14px;margin-top:18px;flex-wrap:wrap}
.ek-scripts-status:empty{display:none}
.ek-scripts-save{padding:9px 18px;border:0;border-radius:8px;background:var(--ek-accent);color:var(--ek-accent-text);font:inherit;font-weight:600;font-size:14px;cursor:pointer}
.ek-scripts-save:hover{background:var(--ek-accent-hover)}.ek-scripts-save:disabled{opacity:.6;cursor:wait}
@media(max-width:767px){.ek-scripts-field textarea{font-size:16px}.ek-scripts-save{flex:1 1 100%;padding:12px 18px}}
`;

export const adminExtraJs = (kit.images ? imageScript(kit.images.maxSize, kit.images.quality) : "") + (kit.scripts ? scriptsPanel : "");
