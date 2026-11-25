# Refuge — à régler après la présentation

Points relevés par l'audit d'octobre 2026 et pas encore traités. Rien ici
n'empêche d'utiliser l'application : ce sont des améliorations, de la plus
utile à la moins urgente. Coche une case quand c'est réglé.

Durée estimée : **rapide** (moins d'une heure), **moyen** (une demi-journée),
**long** (plusieurs jours ou un changement d'organisation).

---

## À vérifier sur le téléphone

- [x] **Respiration et mise en veille** *(corrigé en octobre 2026)*. Dans
      Réglages, décocher « Garder l'écran allumé ». Lancer une séance de
      3 minutes sans toucher le téléphone : l'écran doit rester allumé
      jusqu'à « C'est fini », puis s'éteindre normalement.
      ✅ Vérifié sur le téléphone de Johan le 21 octobre 2026 : ça fonctionne.
- [x] **Bouton « retour » d'Android** *(réglé en novembre 2026, `refuge-v32`,
      vérifié en tests automatisés — confirmation sur téléphone recommandée)*.
      Avec Refuge installée, ouvrir « Montrer un message », puis faire le geste
      retour : l'écran plein écran se referme sans fermer l'application.

---

## Important

### 1. Le bouton « retour » d'Android ferme toute l'application — *moyen* — ✅ *réglé en novembre 2026 (`refuge-v32`)*

- ✅ *Réglé en novembre 2026 (`refuge-v32`).* L'ouverture de chacun des
  7 écrans modaux plein écran (`#carte-sos`, `#carte-urgences`, `#ecran-carte`,
  `#ecran-liens`, `#ecran-monte`, `#ecran-emotions`, `#ecran-proches`) inscrit
  désormais un état dans l'historique (`history.pushState`) et le referme
  proprement sur `popstate`, sans casser l'envoi SMS, l'appel, la
  restauration ni le bouclier sensoriel.

### 2. Une adresse à part pour Refuge — *long*

- **Problème** : toutes les applications publiées sur
  `ferrusdantioch.github.io` partagent le même espace de stockage.
  - « Effacer les données » d'une seule d'entre elles dans Chrome efface
    aussi le journal, le protocole et les réglages de Refuge.
  - Chacune de ces applications pourrait techniquement lire les données
    des autres. Rien n'est envoyé sur internet aujourd'hui, mais c'est
    une fragilité pour une application qui garde des données sensibles.
- **Piste** : publier Refuge à sa propre adresse (Cloudflare Pages,
  Netlify, sous-domaine d'un nom de domaine…). Cela règle aussi la limite
  de Chrome Android, qui n'installe qu'une seule application par adresse.
- **Attention** : à la nouvelle adresse, Refuge repart vide et doit être
  réinstallée. Prévenir les personnes qui l'utilisent de faire d'abord une
  sauvegarde (Réglages › « Enregistrer une sauvegarde »), puis de la
  restaurer à la nouvelle adresse.

---

## Mineur

### 3. Clavier — *rapide à moyen* — ✅ *réglé en novembre 2026 (`refuge-v32`)*
- ✅ *Réglé en novembre 2026 (`refuge-v32`).* La touche `Échap` ferme les
  7 écrans modaux plein écran, `Tab`/`Shift+Tab` reste piégé à l'intérieur
  (avec `inert` sur `<main>` et `<nav>`), et le focus revient au bouton
  ouvreur. En mode bouclier, le contour `:focus-visible` passe à `#5a5a5a`
  (contraste > 3:1 sur `#000000`).

### 4. Lecteurs d'écran — *rapide* — ✅ *réglé en novembre 2026 (`refuge-v32`)*
- ✅ *Réglé en novembre 2026 (`refuge-v32`).* L'accueil dispose désormais d'un
  `<h1>` dédié, et les groupes « Durée », « Intensité ressentie » et
  « Déclencheurs » du journal sont reliés à leurs titres via `aria-labelledby`.

### 5. Thème clair : petits textes gris un peu pâles — *rapide* — ✅ *réglé en novembre 2026 (`refuge-v32`)*
- ✅ *Réglé en novembre 2026 (`refuge-v32`).* `--texte-doux` a été assombri
  sur les 8 thèmes clairs (≥ 4,5:1 sur `--bg`, `--surface`, `--surface-2`
  et `--accent-fond`).

### 6. Très petit téléphone — *rapide* — ✅ *réglé en novembre 2026 (`refuge-v32`)*
- ✅ *Réglé en novembre 2026 (`refuge-v32`).* À 320 px de large avec le
  texte « Très grand », les 5 onglets (y compris « Réglages ») tiennent sans
  débordement tout en conservant une hauteur tactile ≥ 68 px.

### 7. Messages d'erreur manquants — *rapide* — ✅ *réglé en novembre 2026 (`refuge-v32`)*
- ✅ *Réglé en novembre 2026 (`refuge-v32`).* Les échecs IndexedDB lors de la
  suppression (`afficherCrises`), de l'export CSV (`#btn-export-csv`), de la
  lecture du journal et de la suppression d'un lien affichent désormais un
  message clair ; un `?vue=` inconnu se replie proprement sur l'accueil.

### 8. Petits textes — *rapide* — ✅ *réglé en octobre 2026*
- ✅ *Réglé en octobre 2026.* Les apostrophes étaient mélangées (’ et ') :
  on le voyait par exemple sur la carte de l'écran verrouillé. Tous les
  textes affichés utilisent maintenant l'apostrophe droite (').
- ✅ *Réglé en octobre 2026.* Dans le journal, le choix « 2 h + »
  s'affichait « 2 heures ». Il s'affiche maintenant « 2 h ou plus ».
- ✅ *Réglé en octobre 2026.* `manifest.json` rangeait l'application dans
  la catégorie « medical », alors que Refuge n'est pas un dispositif
  médical. Cette catégorie est retirée ; restent « health » et
  « lifestyle ».

### 9. Garantir « rien ne sort du téléphone » par construction — *moyen* — ✅ *réglé en novembre 2026 (`refuge-v32`)*
- ✅ *Réglé en novembre 2026 (`refuge-v32`).* Le script d'amorce du `<head>`
  est extrait dans `theme-init.js`, les 43 attributs `style="…"` ont été
  remplacés par des règles dans `styles.css`, et une politique CSP stricte
  (`default-src 'none'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self'`,
  `connect-src 'self'`, `media-src 'self' blob:`, `object-src 'none'`,
  `base-uri 'none'`, `manifest-src 'self'`, `worker-src 'self'`) est en place
  dans `index.html`.

---

## Documentation (sans effet sur l'application)

- [x] `CLAUDE.md` cite encore `refuge-v14` comme exemple de version du
      cache. La version actuelle est dans `sw.js`.
      *(corrigé en octobre 2026 : l'exemple renvoie au numéro de `sw.js`)*
- [x] `README.md` parle d'un fichier `refuge-github.zip` qui n'existe plus,
      et d'un dépôt nommé `refuge` alors que le vrai s'appelle `Refuge`.
      *(corrigé en octobre 2026, dans `GUIDE-GITHUB.md` aussi)*

---

## À savoir avant de toucher au manifest

`manifest.json` fixe désormais explicitement `"id": "/Refuge/index.html"` tout
en conservant `"start_url": "./index.html"`. Pour Chrome, l'identité de
l'application reste exactement `https://ferrusdantioch.github.io/Refuge/index.html`.
**Ne jamais changer ni `start_url` ni `id`.** Sinon, pour les téléphones où
Refuge est déjà installée, ce serait une autre application, qui ne recevrait
plus les mises à jour.
