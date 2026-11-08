// EvenUCan service worker — makes the web version installable ("Install EvenUCan") and usable offline.
//
// How it caches:
//   - the page itself (EvenUCan.html): network first, so a new release is picked up at once,
//     with the cached copy as the offline fallback;
//   - JSON (the parts libraries): network first, cache as the offline fallback - a refreshed
//     library on the server must reach the page, which keeps it in IndexedDB;
//   - everything else same-origin (manual, icons): cache first, refreshed in the background,
//     so opening it never waits on the network and works offline.
//   - cross-origin requests (the optional AI beacon, AI calls) are left alone.
//
// Bump CACHE when a release changes any file, so old copies are cleaned up on activate.

const CACHE = 'evenucan-1.9.57-pwa3';
const PAGE = 'EvenUCan.html';
const WARM = [PAGE, 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'];
// Big files: fetched in the background after activation (best effort) and kept for offline use.
const BIG = ['parts-library.json', 'eagle-parts.json', 'kicad-parts.json'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // "reload" bypasses the HTTP cache so a fresh install really is fresh.
    await Promise.all(WARM.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = await caches.keys();
    await Promise.all(keep.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    // Warm the parts library in the background so the very first "Browse parts" also works offline.
    const c = await caches.open(CACHE);
    await Promise.all(BIG.map((u) =>
      fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? c.put(u, r.clone()) : null)).catch(() => {})
    ));
  })());
});

// JSON (the parts libraries): network first, so a refreshed library on the server is picked up at
// once - the page stores it in IndexedDB and must not keep a stale copy - with the cache as the
// offline fallback.
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    if (res && res.ok) return res;
    // The server answered with an error (502/503...): the cached copy is better than nothing.
    const hit = await caches.match(req, { ignoreSearch: true });
    return hit || res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    return new Response('', { status: 504, statusText: 'Offline and not cached' });
  }
}

// Cache first for data, refreshed in the background (stale-while-revalidate).
async function cachedFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  const refresh = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') return caches.open(CACHE).then((c) => c.put(req, res.clone()));
    return null;
  }).catch(() => {});
  if (hit) { refresh.catch(() => {}); return hit; }
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline and not cached' });
  }
}

async function pageOffline() {
  const hit = await caches.match(PAGE, { ignoreSearch: true });
  if (hit) return hit;
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>EvenUCan — offline</title>' +
    '<div style="font:15px/1.5 system-ui,sans-serif;max-width:34em;margin:15vh auto;text-align:center">' +
    '<h1 style="font-size:22px">EvenUCan needs the internet once</h1>' +
    '<p>This copy has not been opened online yet, so it is not in the offline cache. ' +
    'Connect and reload this page once; after that it will open with or without a connection.</p></div>',
    { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 }
  );
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                                   // never cache saves or AI posts
  let url; try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;                    // cross-origin: AI calls, CDN beacon
  if (req.headers.has('range')) return;                               // partial content (e.g. the PDF)
  if (req.mode === 'navigate' || req.destination === 'document') {
    const isPage = url.pathname.endsWith('/') || url.pathname.split('/').pop() === PAGE;
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const ok = fresh && fresh.ok;
        if (ok) { const c = await caches.open(CACHE); c.put(PAGE, fresh.clone()); }
        if (ok || !isPage) return fresh;
        // The server answered with an error (502/503...): use the offline copy if we have one.
        const hit = await caches.match(PAGE, { ignoreSearch: true });
        return hit || fresh;
      } catch (err) {
        return isPage ? pageOffline() : new Response('', { status: 504, statusText: 'Offline and not cached' });
      }
    })());
    return;
  }
  if (url.pathname.endsWith('.json')) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(cachedFirst(req));
});
