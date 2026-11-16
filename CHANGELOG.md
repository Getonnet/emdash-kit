# Endringer

## 1.0.0 – 16. nov 2026

Første versjon, hentet ut av getonnet-emdash (som igjen bygger på AESTO og Trening For Deg).

- Kontrollpanel (`/admin`), Roller og tilganger (`/admin/tilganger`), API-er (`/api/besok`, `/api/innstillinger`,
  `/api/tilganger`, `/api/epostleverandor`) og middleware legges inn av `defineKit().integration`.
- Farger, skrift, logo, ikon, navn, firmaopplysninger, D1-forstavelse og samlinger fra config (`defineKit({...})`).
- E-post-plugin med prosjektets profil, norske oversettelser (EmDash 1.5) og Vibe Editor via `defineKit().emdash`.
- Norsk som standard i EmDash-admin; sammenslått meny viser ikonet og har riktig justering; stilt 404 i prosjektet.
