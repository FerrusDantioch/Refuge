/* Service Worker de Refuge.
   Rôle : rendre l'application utilisable SANS connexion internet.
   En crise, on ne peut pas dépendre du réseau : tout est mis en cache
   la première fois, puis servi depuis le téléphone. */

const CACHE = 'refuge-v25';

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
      minutes, et la nouvelle version aurait pu ranger d'anciens fichiers.
      Volontairement, PAS de self.skipWaiting() ici : une nouvelle version
      attend que la personne touche « Mettre à jour » dans les Réglages
      (voir l'étape 3). Rien ne change par surprise. Seule exception, fixée
      par le navigateur : si Refuge est complètement fermée, la nouvelle
      version est là à la prochaine ouverture. */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
  );
});

/* 2. Activation : on supprime NOS anciens caches d'une version précédente,
      et seulement eux. Toutes les applications de ferrusdantioch.github.io
      partagent la même liste de caches : supprimer tout ce qui n'est pas
      CACHE effacerait aussi la copie hors ligne des autres applications.
      On ne touche donc qu'aux noms qui commencent par « refuge-v ». */
const PREFIXE = 'refuge-v';

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles
        .filter((k) => k !== CACHE && k.startsWith(PREFIXE))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 3. La personne a touché « Mettre à jour » : cette version prend le relais.
      La page le remarque (événement « controllerchange ») et se recharge. */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'activer') self.skipWaiting();
});

/* 4. Interception des requêtes : on sert la copie rangée dans le téléphone
      (instantané, hors-ligne). On ne va sur internet que pour un fichier
      absent de la copie.
      On ne remplace JAMAIS en arrière-plan un fichier déjà rangé : sinon
      l'application changerait en douce, sans passer par « Mettre à jour ».
      On ne cherche que dans CACHE, la copie de CETTE version : pendant
      qu'une nouvelle version attend, sa copie existe déjà à côté.
      ignoreSearch : les raccourcis de l'icône ouvrent « index.html?mode=bouclier »
      ou « ?vue=respiration ». Sans cette option, ces adresses ne correspondaient
      à rien dans le cache, et le raccourci « Bouclier » échouait hors-ligne. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((enCache) => {
      if (enCache) return enCache;
      return fetch(e.request).then((rep) => {
        if (rep && rep.status === 200 && rep.type === 'basic') c.put(e.request, rep.clone());
        return rep;
      });
    }))
  );
});
