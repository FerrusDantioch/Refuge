/* Service Worker de Refuge.
   Rôle : rendre l'application utilisable SANS connexion internet.
   En crise, on ne peut pas dépendre du réseau : tout est mis en cache
   la première fois, puis servi depuis le téléphone. */

const CACHE = 'refuge-v29';

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

/* NOUVELLE VERSION : JAMAIS SANS L'ACCORD DE LA PERSONNE
   Chaque version a sa copie (« refuge-vN »). La copie EN SERVICE est notée à
   part, dans le petit cache « refuge-choix » : c'est elle qui sert les
   fichiers, et elle ne change qu'après un appui sur « Mettre à jour ».
   Le navigateur peut activer une nouvelle version de ce fichier sans rien
   demander (quand Refuge est complètement fermée puis rouverte) : même alors,
   l'ancienne copie reste affichée, et la page propose « Mettre à jour ».
   ⚠️ Les messages « etat », « activer » et « recharger » échangés avec la
   page ne doivent jamais changer de nom : une ancienne page doit toujours
   pouvoir parler à un service worker plus récent. */
const CHOIX = 'refuge-choix';
const CLE_CHOIX = './__version-en-service__';

/* Le nom de la copie en service (ou null si rien n'est encore noté). */
async function versionEnService() {
  const r = await (await caches.open(CHOIX)).match(CLE_CHOIX);
  return r ? r.text() : null;
}

async function choisirVersion(nom) {
  await (await caches.open(CHOIX)).put(CLE_CHOIX, new Response(nom));
}

/* Supprime NOS copies, sauf celles à garder. Toutes les applications de
   ferrusdantioch.github.io partagent la même liste de caches : on ne touche
   qu'aux noms qui commencent par « refuge-v ». */
const PREFIXE = 'refuge-v';

async function menage(aGarder) {
  for (const k of await caches.keys()) {
    if (k.startsWith(PREFIXE) && !aGarder.includes(k)) await caches.delete(k);
  }
}

/* 1. Installation : on télécharge et on range tout dans la copie de cette
      version. { cache: 'reload' } oblige à reprendre chaque fichier sur le
      serveur, sans passer par le petit cache du navigateur (GitHub Pages le
      garde 10 minutes) : sinon, deux mises à jour publiées coup sur coup
      pourraient ranger d'anciens fichiers sous le nouveau numéro de version.
      Volontairement, PAS de self.skipWaiting() ici (voir l'étape 3). */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
  );
});

/* 2. Activation. Si aucune copie n'est encore notée « en service » (toute
      première installation, ou arrivée depuis une version d'avant ce
      système), celle-ci entre en service. Sinon, la copie en service ne
      change pas. On garde la copie en service et celle de cette version. */
let actif = false;

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    let enService = await versionEnService();
    if (!enService || !(await caches.has(enService))) {
      enService = CACHE;
      await choisirVersion(CACHE);
    }
    await menage([enService, CACHE]);
    actif = true;
    await self.clients.claim();
  })());
});

/* 3. Messages de la page.
      « etat » : une nouvelle version attend-elle l'accord de la personne ?
      « activer » : la personne a touché « Mettre à jour » dans les Réglages. Cette
      version entre en service. Si ce service worker attendait encore, il
      prend le relais (la page le remarque, « controllerchange », et se
      recharge) ; s'il était déjà actif, il demande aux pages de se recharger. */
self.addEventListener('message', (e) => {
  const type = e.data && e.data.type;
  if (type === 'etat' && e.ports[0]) {
    e.waitUntil(versionEnService().then((v) => {
      e.ports[0].postMessage({ nouvelleVersion: v !== null && v !== CACHE });
    }));
  }
  if (type === 'activer') {
    e.waitUntil((async () => {
      await choisirVersion(CACHE);
      if (!actif) {
        await self.skipWaiting();
        return;
      }
      await menage([CACHE]);
      for (const page of await self.clients.matchAll({ type: 'window' })) {
        page.postMessage({ type: 'recharger' });
      }
    })());
  }
});

/* 4. Interception des requêtes : on sert la copie EN SERVICE (instantané,
      hors-ligne). Un fichier qui y manque est cherché dans la copie de cette
      version, puis sur internet (et gardé dans la copie en service).
      On ne remplace JAMAIS en arrière-plan un fichier déjà rangé : sinon
      l'application changerait en douce, sans passer par « Mettre à jour ».
      ignoreSearch : les raccourcis de l'icône ouvrent « index.html?mode=bouclier »
      ou « ?vue=respiration ». Sans cette option, ces adresses ne correspondaient
      à rien dans le cache, et le raccourci « Bouclier » échouait hors-ligne. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const enService = (await versionEnService()) || CACHE;
    const copie = await caches.open(enService);
    let rep = await copie.match(e.request, { ignoreSearch: true });
    if (!rep && enService !== CACHE) rep = await (await caches.open(CACHE)).match(e.request, { ignoreSearch: true });
    if (rep) return rep;
    rep = await fetch(e.request);
    if (rep && rep.status === 200 && rep.type === 'basic') copie.put(e.request, rep.clone());
    return rep;
  })());
});
