export function registerServiceWorker(path = './sw.js') {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return;

  // Jakmile převezme řízení nová verze SW, jednou stránku obnovíme – ale jen když už
  // nějaká verze běžela (tj. jde o aktualizaci, ne o první instalaci), ať to při prvním
  // otevření zbytečně nebliká.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register(path)
    .then(registration => {
      const checkForUpdate = () => registration.update().catch(() => {});
      checkForUpdate();
      // Znovu ověř aktualizaci při každém návratu do aplikace (přepnutí zpět na záložku/PWA).
      document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
    })
    .catch(() => {});
}
