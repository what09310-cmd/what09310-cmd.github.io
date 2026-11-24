// Service worker : réseau d'abord avec copie de secours pour le hors-ligne, jamais pour Overpass ni Nominatim.
const CACHE = 'quan-an-v6';
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

// Réseau d'abord : en ligne, on sert toujours la dernière version publiée (et on met le cache à jour).
// Hors ligne, ou si le réseau ne répond pas en 4 s, on sert la copie en cache.
const NETWORK_TIMEOUT_MS = 4000;

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(
    (hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Uniquement les fichiers de l'appli (même origine). Overpass, Nominatim, Google Maps passent au réseau.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    new Promise((resolve) => {
      let settled = false;
      const done = (res) => { if (!settled && res) { settled = true; resolve(res); } };

      const timer = setTimeout(() => fromCache(req).then(done), NETWORK_TIMEOUT_MS);

      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          clearTimeout(timer);
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          done(res);
        })
        .catch(() => {
          clearTimeout(timer);
          fromCache(req).then((hit) => done(hit || Response.error()));
        });
    })
  );
});
