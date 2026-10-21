/* Service Worker de Refuge.
   Rôle : rendre l'application utilisable SANS connexion internet.
   En crise, on ne peut pas dépendre du réseau : tout est mis en cache
   la première fois, puis servi depuis le téléphone. */

const CACHE = 'refuge-v21';

/* La liste des fichiers indispensables au fonctionnement hors-ligne. */
const FICHIERS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png'
];

/* 1. Installation : on télécharge et on range tout dans le cache.
      cache: 'reload' va chercher les fichiers sur le serveur, jamais dans
      la mémoire temporaire du navigateur : GitHub Pages la garde dix
      minutes, et la nouvelle version aurait pu ranger d'anciens fichiers. */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

/* 2. Activation : on supprime les anciens caches d'une version précédente. */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 3. Interception des requêtes : on sert d'abord le cache (instantané, hors-ligne),
      et on rafraîchit discrètement en arrière-plan si le réseau répond.
      ignoreSearch : les raccourcis de l'icône ouvrent « index.html?mode=bouclier »
      ou « ?vue=respiration ». Sans cette option, ces adresses ne correspondaient
      à rien dans le cache, et le raccourci « Bouclier » échouait hors-ligne. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((enCache) => {
      const surLeReseau = fetch(e.request)
        .then((rep) => {
          if (rep && rep.status === 200 && rep.type === 'basic') {
            const copie = rep.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copie));
          }
          return rep;
        })
        .catch(() => enCache);
      return enCache || surLeReseau;
    })
  );
});
