// Legilimens — Service Worker
// Strategy:
//   - Static/shell assets: cache-first (install pre-cache)
//   - API & WebSocket upgrade requests: network-first, fall back to cache
//   - Muffliato page: pre-cached so student phones work offline

const CACHE_NAME = 'legilimens-v2';
const STATIC_PRECACHE = [
  '/',
  '/muffliato',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: pre-cache shell ───────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE);
    })
  );
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Claim all open clients so new SW is active immediately
  self.clients.claim();
});

// ── Fetch: route-based strategy ───────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and WebSocket upgrade requests
  if (request.method !== 'GET') return;
  if (request.headers.get('upgrade') === 'websocket') return;

  // API routes — network first, fall back to cache
  if (url.pathname.startsWith('/api/') || url.port === '8001') {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML pages — network first (always get latest), everything else cache first
  if (url.pathname === '/' || url.pathname.startsWith('/_next/')) {
    event.respondWith(cacheFirst(request));
  } else {
    // Muffliato, dashboard, etc — network first (updates take effect immediately)
    event.respondWith(networkFirst(request));
  }
});

// ── Strategies ────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // Offline and not cached — return a minimal offline page
    return new Response(
      '<html><body style="background:#1a0f2e;color:#d3a625;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>🪄 You are offline. Muffliato is pre-cached — reload /muffliato.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
