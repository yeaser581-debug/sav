const CACHE_NAME = 'after-sales-shell-v3';
const RUNTIME_CACHE = 'after-sales-runtime-v2';
const SHELL_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline.html',
  '/login',
];

const API_ALLOWLIST = [/^\/api\/issues(\/\d+)?$/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_RUNTIME_CACHE') {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});

function putInRuntimeCache(event, key, response) {
  const copy = response.clone();
  event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(key, copy)));
}

function pageCacheKey(request) {
  const key = new URL(request.url);
  key.searchParams.delete('_rsc');
  return key.toString();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isApi = url.pathname.startsWith('/api/');
  if (isApi && !API_ALLOWLIST.some((re) => re.test(url.pathname))) return;

  const isPageRequest = request.mode === 'navigate' || request.headers.get('rsc') === '1';

  if (isPageRequest) {
    const isClientRoute = url.pathname === '/client' || url.pathname.startsWith('/client/');
    if (!isClientRoute) {
      event.respondWith(
        fetch(request).catch(() => caches.match(request, { ignoreVary: true }).then((cached) => cached || caches.match('/offline.html')))
      );
      return;
    }

    const key = pageCacheKey(request);
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) putInRuntimeCache(event, key, res);
          return res;
        })
        .catch(() => caches.match(key, { ignoreVary: true }).then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }

  if (isApi) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) putInRuntimeCache(event, request, res);
          return res;
        })
        .catch(() =>
          caches.match(request, { ignoreVary: true }).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify({ error: 'offline' }), {
                status: 503,
                headers: { 'content-type': 'application/json' },
              })
          )
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) putInRuntimeCache(event, request, res);
        return res;
      });
    })
  );
});
