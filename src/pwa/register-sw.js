export function registerServiceWorker(path = './sw.js') {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return;
  navigator.serviceWorker.register(path).then(registration => registration.update()).catch(() => {});
}
