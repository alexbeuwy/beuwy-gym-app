// GymCoach Service Worker — network-first for HTML, cache-first for images
// Version bumped manually on logic changes; HTML itself is always network-first.
const VERSION = 'gc-v3';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never intercept supabase/gemini/API calls — always go network
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis')) return;

  // Network-first for HTML navigation (always fresh when online)
  if (request.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('.html')) || url.pathname === '/') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for images (GitHub raw, jsDelivr) — speeds up + offline
  if (url.hostname.includes('githubusercontent.com') || url.hostname.includes('jsdelivr.net') || /\.(jpg|jpeg|png|webp|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }
});

// Enables "Tap to update" flow
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
