const CACHE_NAME = 'lifehub-vite-shell-v5-0-6-spent-breakdown';
const STATIC_SHELL = [
  './', './index.html', './manifest.json', './lifehub-icon-v2.svg', './lifehub-icon-192-v2.png', './lifehub-icon-512-v2.png',
  './vendor/pdf.min.mjs', './vendor/pdf.worker.min.mjs', './manual.html', './school-logo.png'
];
const NAVIGATE_TIMEOUT_MS = 3000;

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
    const critical = ['./', './index.html'];
    await cache.addAll(critical);
    const optional = [...STATIC_SHELL.filter(url => !critical.includes(url)), ...assets];
    const results = await Promise.allSettled(optional.map(url => cache.add(url)));
    const failed = results
      .map((result,index)=>result.status === 'rejected' ? optional[index] : null)
      .filter(Boolean);
    if(failed.length) console.warn('LifeHub SW: část shellu se nepodařilo uložit do cache.', failed);
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

async function navigateWithTimeout(request){
  const cached = await caches.match('./index.html');
  const network = fetch(request, {cache:'no-store'}).then(response => {
    if(response?.ok){
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone())).catch(()=>{});
      return response;
    }
    return cached || response;
  });
  if(!cached) return network;
  let timer;
  const fallback = new Promise(resolve => {
    timer = setTimeout(() => resolve(cached), NAVIGATE_TIMEOUT_MS);
  });
  try{
    return await Promise.race([network.catch(() => cached), fallback]);
  }finally{
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;
  const url = new URL(request.url);
  if(url.origin !== location.origin) return;

  if(request.mode === 'navigate'){
    event.respondWith(navigateWithTimeout(request));
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
