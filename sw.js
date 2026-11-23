// Service worker : l'app marche hors-ligne et se met à jour toute seule.
// Stratégie "stale-while-revalidate" : on sert le cache tout de suite,
// puis on récupère la nouvelle version en arrière-plan pour le prochain lancement.
const CACHE = 'brahot-v2';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'gate.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
  // Seulement les fichiers de l'app elle-même : sur GitHub Pages, le même domaine
  // héberge d'autres projets, qui n'ont rien à faire dans ce cache.
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  const url = new URL(req.url);
  // Clé sans paramètres (?test…) : une seule copie par fichier, le cache ne grossit pas.
  const key = url.origin + url.pathname;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic' && !res.redirected) cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match('index.html');
      return Response.error();
    })
  );
});
