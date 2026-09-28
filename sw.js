/* Service Worker de Refuge.
   Rôle : rendre l'application utilisable SANS connexion internet.
   En crise, on ne peut pas dépendre du réseau : tout est mis en cache
   la première fois, puis servi depuis le téléphone. */

const CACHE = 'refuge-v13';

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

/* 1. Installation : on télécharge et on range tout dans le cache. */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS))
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
      et on rafraîchit discrètement en arrière-plan si le réseau répond. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  /* Les raccourcis de l'écran d'accueil ouvrent « index.html?mode=bouclier »
     ou « index.html?vue=respiration ». Le cache ne connaît que « index.html » :
     pour l'ouverture d'une page (mode 'navigate'), on ignore donc tout ce qui
     suit le « ? » (ignoreSearch). Sans cela, ces raccourcis échouent hors
     ligne. app.js lit lui-même ?mode= et ?vue= dans la barre d'adresse. */
  const options = e.request.mode === 'navigate' ? { ignoreSearch: true } : {};
  e.respondWith(
    caches.match(e.request, options).then((enCache) => {
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
