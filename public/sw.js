const CACHE_NAME = 'lifehub-vite-shell-v3';
const STATIC_SHELL = [
  './', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png',
  './vendor/pdf.min.mjs', './vendor/pdf.worker.min.mjs'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // U navigace (HTML) obcházíme HTTP cache prohlížeče, aby se po nasazení hned načetla
  // aktuální index.html (a s ní i nové hashované JS/CSS). Ostatní soubory: network-first.
  const isNavigation = request.mode === 'navigate';
  const fetchOptions = isNavigation ? { cache: 'no-store' } : undefined;

  event.respondWith(
    fetch(request, fetchOptions)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
  );
});
