const CACHE_NAME = 'lifehub-vite-shell-v4-8-2-archives-1';
const STATIC_SHELL = [
  './', './index.html', './manifest.json', './lifehub-icon-v2.svg', './lifehub-icon-192-v2.png', './lifehub-icon-512-v2.png',
  './vendor/pdf.min.mjs', './vendor/pdf.worker.min.mjs', './manual.html', './school-logo.png'
];

async function discoverBuildAssets(){
  try{
    const response = await fetch('./index.html', {cache:'no-store'});
    if(!response.ok) return [];
    const html = await response.text();
    return [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
      .map(match => new URL(match[1], self.registration.scope).href)
      .filter(url => new URL(url).origin === location.origin);
  }catch(error){
    return [];
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE_NAME);
    const assets = await discoverBuildAssets();
    await cache.addAll([...STATIC_SHELL, ...assets]);
  })());
});

self.addEventListener('message', event => {
  if(event.data?.type === 'SKIP_WAITING') self.skipWaiting();
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
  if(request.method !== 'GET') return;
  const url = new URL(request.url);
  if(url.origin !== location.origin) return;

  if(request.mode === 'navigate'){
    event.respondWith(
      fetch(request, {cache:'no-store'})
        .then(response => {
          if(response?.ok) caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone())).catch(()=>{});
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith((async()=>{
    const cached = await caches.match(request);
    if(cached) return cached;
    const response = await fetch(request);
    if(response?.ok){
      const destination = request.destination;
      if(['script','style','image','font','worker'].includes(destination)){
        caches.open(CACHE_NAME).then(cache => cache.put(request,response.clone())).catch(()=>{});
      }
    }
    return response;
  })());
});
