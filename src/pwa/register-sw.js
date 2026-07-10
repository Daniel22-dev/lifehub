export function registerServiceWorker(path = './sw.js') {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return;

  navigator.serviceWorker.register(path)
    .then(registration => {
      const checkForUpdate = () => registration.update().catch(() => {});
      checkForUpdate();
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkForUpdate();
      });
    })
    .catch(error => console.warn('Registrace service workeru selhala.', error));
}
