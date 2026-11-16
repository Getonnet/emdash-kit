// Besøkstelleren på nettsiden: legg BESOK nederst i <body> på sidene (f.eks. <Fragment set:html={BESOK} />).
// Sender én sidevisning til /api/besok, uten cookies. Roboter, skript og innloggede redaktører telles ikke
// (se src/pages/api/besok.ts). Visningene vises på kontrollpanelet (/admin).
export const BESOK = `<script>(function(){if(!navigator.sendBeacon||navigator.webdriver)return;try{navigator.sendBeacon("/api/besok",location.pathname)}catch(e){}})();</script>`;
