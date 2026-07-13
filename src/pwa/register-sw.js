const UPDATE_READY_EVENT = 'lifehub:update-ready';
let controllerReloadStarted = false;

function announceWaitingUpdate(registration, worker = registration.waiting) {
  if (!worker) return;
  window.dispatchEvent(new CustomEvent(UPDATE_READY_EVENT, {
    detail: {
      activate() {
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  }));
}

export function registerServiceWorker(path = './sw.js') {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controllerReloadStarted) return;
    controllerReloadStarted = true;
    window.location.reload();
  });

  navigator.serviceWorker.register(path, { updateViaCache: 'none' })
    .then(registration => {
      const checkForUpdate = async () => {
        try {
          await registration.update();
          if (registration.waiting) announceWaitingUpdate(registration);
        } catch (error) {
          console.warn('Kontrola aktualizace LifeHubu selhala.', error);
        }
      };

      if (registration.waiting) announceWaitingUpdate(registration);

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            announceWaitingUpdate(registration, worker);
          }
        });
      });

      checkForUpdate();
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkForUpdate();
      });
      window.setInterval(checkForUpdate, 30 * 60 * 1000);
    })
    .catch(error => console.warn('Registrace service workeru selhala.', error));
}
