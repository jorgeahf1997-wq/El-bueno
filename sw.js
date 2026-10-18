// PreçoCerto Brasil - service worker.
//
// Goal: the app opens fast and shows a friendly page when there is no connection, WITHOUT ever showing an
// outdated version of the app or outdated prices (the old worker answered every page from its cache first,
// so people could keep seeing a release from weeks ago).
//
//  - /api/*            never stored here: prices and coupons always come from the server.
//  - pages (HTML)      network first and never stored, so a new release shows up right away.
//                      Without a connection the visitor gets /offline.html.
//  - /assets/*         file names carry a content hash, so they are stored on first use and served from there.
//  - other same-origin GET requests (icons, manifest, share image) are served from the cache and refreshed
//                      in the background.
//  - other websites (store photos, fonts) are not touched.

const VERSION = 'v2';
const SHELL_CACHE = `precocerto-shell-${VERSION}`;
const ASSET_CACHE = `precocerto-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const MAX_ASSETS = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.add(OFFLINE_URL);
      // Nice to have: a failure here must not stop the worker from installing.
      await Promise.allSettled([cache.add('/icon.svg'), cache.add('/pwa-192x192.png')]);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

// A missing file can be answered with the HTML app by the server; that must never be stored as a script or an image.
const isStorable = (response) =>
  response && response.ok && response.type === 'basic' && !(response.headers.get('content-type') || '').includes('text/html');

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) {
    await cache.delete(keys[i]);
  }
}

async function networkFirstPage(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response('Sem conexão com a internet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (isStorable(response)) {
    await cache.put(request, response.clone());
    await trim(cache, MAX_ASSETS);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (isStorable(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached) return cached;
  return (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
