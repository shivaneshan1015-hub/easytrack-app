// Basic app-shell resilience for the agent page: runtime cache-as-you-go
// (network-first, falling back to the last cached response). This is NOT
// build-time precaching — it only helps after a successful load has happened
// at least once while online. Registered with scope '/agent' from agent.js,
// so it never touches the owner dashboard's requests.
const CACHE_NAME = 'easytrack-agent-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase etc. — never intercepted

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/agent')))
  );
});
