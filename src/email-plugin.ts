// E-post fra EmDash med prosjektets profil (invitasjoner, innloggingslenker, gjenoppretting, test-e-post, flytting av domene).
// EmDash bygger e-postene selv, med enkel blå knapp og uten logo. Her hentes overskrift, tekst og knapp ut av e-posten
// EmDash har laget, og den sendes i prosjektets drakt: ordmerke, farger og firmaopplysninger. Ingen omtale av EmDash.
// Samme plugin som AESTO; navn, farger og firmalinje kommer fra kit-oppsettet (defineKit → email, brand).
// Sendes med Cloudflare Email Sending (bindingen EMAIL i wrangler.jsonc).
import { createCloudflareEmailDeliver } from "@emdash-cms/cloudflare/plugins";
import { definePlugin } from "emdash";
import { kit } from "./config";

type Brand = {
	name: string;
	wordmark: string;
	company: string;
	colors: Record<string, string>;
	mode?: "light" | "dark";
	logo?: { src: string; width: number; height: number } | null;
	links?: Record<string, string>;
	headingFont?: string;
};
type Options = { from: { email: string; name?: string }; replyTo?: string; brand: Brand };
type Message = { to: string; subject: string; text: string; html?: string; cc?: string[]; replyTo?: string };

// Nettstedets skrifter finnes ikke i e-postprogrammene: systemskrift, halvfet i titlene
const SYSTEM = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Firmalinjen: tekstene i links blir lenker i bunntekstens farge (ellers gjør Gmail adresser og telefonnumre til blå lenker)
function companyHtml(company: string, links: Record<string, string> | undefined, color: string) {
	let html = esc(company);
	for (const [text, href] of Object.entries(links ?? {})) {
		html = html.replace(esc(text), `<a href="${esc(href)}" style="color:${color};text-decoration:none;">${esc(text)}</a>`);
	}
	return html;
}

// Alltid norsk: EmDash skriver e-posten på språket til den som sender invitasjonen (ofte engelsk).
// De faste engelske setningene byttes med de norske fra admin-oversettelsen. Allerede norsk tekst endres ikke.
const NORSK: [RegExp, string][] = [
	[/You've been invited to join (.+?)\./g, "Du er invitert til å bli med i $1."],
	[/You've been invited to (.+?)(?=$|\n|<)/gm, "Du er invitert til $1"],
	[/Click this link to create your account:/g, "Klikk på denne lenken for å opprette kontoen din:"],
	[/Click the button below to create your account:/g, "Klikk på knappen under for å opprette kontoen din:"],
	[/Accept Invite/g, "Godta invitasjon"],
	[/This link expires in 7 days\./g, "Denne lenken utløper om 7 dager."],
	[/Click this link to sign in to (.+?):/g, "Klikk på denne lenken for å logge inn på $1:"],
	[/Click the button below to sign in:/g, "Klikk på knappen under for å logge inn:"],
	[/Sign in to (.+?)(?=$|\n|<)/gm, "Logg inn på $1"],
	[/>\s*Sign in\s*</g, ">Logg inn<"],
	[/This link expires in 15 minutes\./g, "Denne lenken utløper om 15 minutter."],
	[/If you didn't request this, you can safely ignore this email\./g, "Hvis du ikke ba om dette, kan du trygt ignorere denne e-posten."],
	[/(.+?) has moved to (.+?)(?=$|\n|<)/gm, "$1 har flyttet til $2"],
	[/(.+?) is now at (.+?)\. Sign in there from now on\./g, "$1 ligger nå på $2. Logg inn der fra nå av."],
	[/Open the sign-in page at the new address:/g, "Åpne innloggingssiden på den nye adressen:"],
	[/Go to sign-in/g, "Gå til innlogging"],
	[/Passkeys from the old address don't work there\. Sign in with an email link, then add a passkey in Security settings\./g, "Passnøkler fra den gamle adressen fungerer ikke der. Logg inn med en e-postlenke, og legg deretter til en passnøkkel i sikkerhetsinnstillingene."],
	// Test-e-post fra Innstillinger → E-post
	[/Test email from (.+?)(?=$|\n|<)/gm, "Test-e-post fra $1"],
	[/\bTest Email\b/g, "Test-e-post"],
	[/This is a test email from /g, "Dette er en test-e-post fra "],
	[/If you received this, your email provider is working correctly\./g, "Når du har fått denne, fungerer e-posten som den skal."],
	[/\s*Sent via the EmDash email pipeline\.\s*/g, ""],
];

// Bare prosjektets navn, aldri EmDash (også i emne og ren tekst), og alltid norsk
const rebrand = (s: string, name: string) => NORSK.reduce((t, [re, to]) => t.replace(re, to), s).replace(/EmDash/g, name);

const inner = (html: string) => html.replace(/<[^>]+>/g, "").trim();
const knapp = (label: string, name: string) => (label === "Sign in" ? "Logg inn" : rebrand(label, name));

// Adressen til nettstedet, hentet fra lenken i e-posten (så logoen følger domenet)
function originOf(html: string, text: string) {
	const m = /https?:\/\/[^\s"'<>]+/.exec(html) ?? /https?:\/\/[^\s"'<>]+/.exec(text);
	try {
		return m ? new URL(m[0]).origin : "";
	} catch {
		return "";
	}
}

/** Lager prosjektets versjon av HTML-en. Returnerer null hvis e-posten ikke har den kjente formen. */
export function brandHtml(html: string, text: string, brand: Brand): string | null {
	const c = brand.colors;
	// Brødteksten: darkAlt i lys modus; i mørk modus er darkAlt ofte en farge i gradienten, så tekstfargen brukes
	const [PAPER, CARD, INK, SOFT, MUTE, LINE, BUTTON, BUTTON_TEXT] = [c.paper, c.card || "#ffffff", c.ink, brand.mode === "dark" ? c.ink : c.darkAlt, c.muted, c.interact, c.accent, c.accentText];
	const NAVN = brand.name;
	const HEAD = brand.headingFont || SYSTEM;
	const dark = brand.mode === "dark";
	const rb = (t: string) => rebrand(t, NAVN);
	const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
	const title = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(body)?.[1]?.trim();
	if (!title) return null;
	const button = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(body);
	const before: string[] = [];
	const after: string[] = [];
	for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
		if (/<a\s/i.test(m[1]!)) continue; // avsnittet med knappen
		const t = m[1]!.trim();
		if (!t) continue;
		(button && m.index! > button.index ? after : before).push(t);
	}
	const origin = originOf(html, text);
	// Logoer er ofte SVG, som Gmail og Outlook ikke viser: ordmerket som tekst (store bokstaver, luftig),
	// eller email.logo (PNG/JPG) fra nettstedet når prosjektet har det
	const logo =
		brand.logo && origin
			? `<img src="${origin}${brand.logo.src}" width="${brand.logo.width}" height="${brand.logo.height}" alt="${esc(NAVN)}" style="display:block;margin:0 auto;border:0;height:${brand.logo.height}px;width:${brand.logo.width}px;">`
			: `<span style="font-family:${HEAD};font-size:20px;font-weight:600;letter-spacing:0.32em;color:${INK};">${brand.wordmark}</span>`;
	const p = (t: string, extra = "") =>
		`<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${SOFT};text-align:center;${extra}">${t}</p>`;
	const cta = button
		? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 28px;"><tr><td style="border-radius:999px;background:${BUTTON};">` +
			`<a href="${button[1]}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:600;color:${BUTTON_TEXT};text-decoration:none;border-radius:999px;">${knapp(inner(button[2]!), NAVN)}</a>` +
			`</td></tr></table>`
		: "";
	return `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${dark ? `<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">` : `<meta name="color-scheme" content="light">`}
<title>${rb(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};" bgcolor="${PAPER}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};" bgcolor="${PAPER}">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td align="center" style="padding:0 0 20px;text-align:center;">${logo}</td></tr>
<tr><td align="center" bgcolor="${CARD}" style="text-align:center;background:${CARD};border:1px solid ${LINE};border-radius:20px;padding:36px 32px 12px;">
<h1 style="margin:0 0 18px;font-family:${HEAD};font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-0.01em;color:${INK};text-align:center;">${rb(title)}</h1>
${before.map((t) => p(rb(t))).join("\n")}
${cta}
${after.map((t) => p(rb(t), `font-size:14px;color:${MUTE};`)).join("\n")}
</td></tr>
<tr><td align="center" style="text-align:center;padding:20px 8px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTE};">
${companyHtml(brand.company, brand.links, MUTE)}<br>${origin ? `<a href="${origin}" style="color:${MUTE};">${origin.replace(/^https?:\/\//, "")}</a>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function brand(message: Message, b: Brand): Message {
	const html = message.html ? (brandHtml(message.html, message.text, b) ?? rebrand(message.html, b.name)) : undefined;
	return {
		...message,
		subject: rebrand(message.subject, b.name),
		text: `${rebrand(message.text, b.name)}${b.company ? `\n\n--\n${b.company}` : ""}`,
		...(html ? { html } : {}),
	};
}

export function createPlugin(options: Options) {
	const deliver = createCloudflareEmailDeliver({ from: options.from, replyTo: options.replyTo } as never);
	return definePlugin({
		id: "emdash-kit-epost",
		// Vises under Utvidelser (super admin) med kit-versjonen
		displayName: "emdash-kit · e-post",
		version: kit.version,
		capabilities: ["hooks.email-transport:register"],
		hooks: {
			"email:deliver": {
				exclusive: true,
				handler: (event: { message: Message }, ctx: unknown) =>
					deliver({ ...event, message: brand(event.message, options.brand) } as never, ctx as never),
			},
		},
	});
}
