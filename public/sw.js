/* HySmart Station PWA service worker. Never cache API, auth, or business data. */
const CACHE_PREFIX = 'hysmart-static-';
const CACHE_NAME = `${CACHE_PREFIX}v2.27.0`;
const APP_SHELL = ['/','/index.html','/manifest.webmanifest','/icons/hysmart-192.png','/icons/hysmart-512.png','/icons/hysmart-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);

    // Precache every generated route chunk so lazy-loaded screens remain
    // available after the first successful online installation.
    try {
      const manifestResponse = await fetch('/asset-manifest.json', { cache: 'no-store' });
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
        if (assets.length) await cache.addAll(assets);
      }
    } catch (error) {
      // Keep the app shell installable if an optional asset-manifest fetch fails.
      console.warn('HySmart offline asset precache was incomplete:', error);
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/') || url.pathname.startsWith('/storage/') || url.pathname.includes('supabase')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
