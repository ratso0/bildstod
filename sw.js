// Service worker för Bildstöd
// Appfilerna hämtas från nätet först (så att nya versioner kommer fram direkt)
// och från cachen när enheten är offline. Typsnitt, ikoner och bibliotek tas från cachen först.
const CACHE = 'bildstod-0.10';
const APP_FILES = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.json'
];
const STATIC_FILES = [
  './icon-192.png',
  './icon-512.png',
  './fonts/nunito-700.woff2',
  './fonts/nunito-800.woff2',
  './fonts/nunito-900.woff2',
  './vendor/Sortable.min.js'
];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([...APP_FILES, ...STATIC_FILES])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isStatic(url) {
  return /\.(woff2|png|jpe?g|svg)$/.test(url.pathname) || url.pathname.includes('/vendor/');
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT))
    ]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('./index.html');
    throw new Error('offline');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(isStatic(url) ? cacheFirst(e.request) : networkFirst(e.request));
});
