// Service worker : cache-first sur les fichiers de l'appli, jamais sur Overpass.
const CACHE = 'quan-an-v4';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/app.js',
  './src/geo.js',
  './src/phrase.js',
  './src/overpass.js',
  './src/storage.js',
  './src/format.js',
  './src/geocode.js',
  './src/style.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE)
      // cache: 'reload' contourne le cache HTTP du navigateur, sinon une mise à jour peut mettre en cache d'anciens fichiers.
      .then((c) => c.addAll(APP_FILES.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Uniquement les fichiers de l'appli (même origine). Overpass, Google Maps, etc. passent au réseau.
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
